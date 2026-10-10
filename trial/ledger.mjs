import { DAILY_LIMIT, GLOBAL_DAILY_LIMIT, MAX_INFLIGHT, LEASE_MS } from './limits.mjs';

// One write statement: SQLite serializes the read predicates and insertion
// together. Do not split these checks into a SELECT followed by an INSERT.
export const ADMIT_SQL = `INSERT INTO trial_requests
 (request_id, session_hash, ip_hash, action, day_bucket, month_bucket, reserved_microyuan, admitted_at, lease_until)
 SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
 WHERE NOT EXISTS (SELECT 1 FROM trial_requests WHERE request_id = ?1)
 AND COALESCE((SELECT SUM(reserved_microyuan) FROM trial_requests WHERE month_bucket = ?6), 0) + ?7 <= ?10
 AND (SELECT COUNT(*) FROM trial_requests WHERE day_bucket = ?5) < ?11
 AND (SELECT COUNT(*) FROM trial_requests WHERE day_bucket = ?5 AND session_hash = ?2) < ?12
 AND (SELECT COUNT(*) FROM trial_requests WHERE day_bucket = ?5 AND ip_hash = ?3) < ?12
 AND (SELECT COUNT(*) FROM trial_requests WHERE lease_until > ?8) < ?13
 RETURNING request_id`;

const SNAPSHOT_SQL = `SELECT
 COALESCE((SELECT SUM(reserved_microyuan) FROM trial_requests WHERE month_bucket = ?1), 0) AS reserved,
 (SELECT COUNT(*) FROM trial_requests WHERE day_bucket = ?2) AS day_count,
 (SELECT COUNT(*) FROM trial_requests WHERE day_bucket = ?2 AND session_hash = ?3) AS session_count,
 (SELECT COUNT(*) FROM trial_requests WHERE day_bucket = ?2 AND ip_hash = ?4) AS ip_count,
 (SELECT COUNT(*) FROM trial_requests WHERE lease_until > ?5) AS inflight,
 (SELECT MIN(lease_until) FROM trial_requests WHERE lease_until > ?5) AS next_lease`;

export function buckets(now) {
  const iso = new Date(now).toISOString();
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) };
}

export async function snapshot(db, identity, now) {
  const { day, month } = buckets(now);
  return db.prepare(SNAPSHOT_SQL).bind(month, day, identity.sessionHash || '', identity.ipHash, now).first();
}

export async function admit(db, { requestId, sessionHash, ipHash, action, cost, budget, now }) {
  const { day, month } = buckets(now);
  const admitted = await db.prepare(ADMIT_SQL).bind(requestId, sessionHash, ipHash, action, day, month, cost, now, now + LEASE_MS, budget, GLOBAL_DAILY_LIMIT, DAILY_LIMIT, MAX_INFLIGHT).first();
  return Boolean(admitted);
}

export async function isDuplicate(db, requestId) {
  return Boolean(await db.prepare('SELECT request_id FROM trial_requests WHERE request_id = ?1').bind(requestId).first());
}

export async function finish(db, requestId, outcome, now, definitive) {
  // Unknown remote state (network error / timeout / client cancellation) keeps
  // the entire original lease. Neither completion nor expiry refunds money.
  await db.prepare(`UPDATE trial_requests SET completed_at = ?2, outcome = ?3,
    lease_until = CASE WHEN ?4 = 1 THEN ?2 ELSE lease_until END WHERE request_id = ?1`)
    .bind(requestId, now, outcome, definitive ? 1 : 0).run();
}

export function remaining(state) {
  return Math.max(0, DAILY_LIMIT - Math.max(Number(state.session_count), Number(state.ip_count)));
}

export function blocked(state, cost, budget, now) {
  const nextDay = Date.parse(`${buckets(now).day}T00:00:00Z`) + 86_400_000;
  if (remaining(state) === 0) return { code: 'TRIAL_QUOTA', retryAfter: Math.ceil((nextDay - now) / 1000) };
  if (Number(state.reserved) + cost > budget) return { code: 'TRIAL_BUDGET' };
  if (Number(state.day_count) >= GLOBAL_DAILY_LIMIT) return { code: 'TRIAL_RATE_LIMIT', retryAfter: Math.ceil((nextDay - now) / 1000) };
  if (Number(state.inflight) >= MAX_INFLIGHT) return { code: 'TRIAL_BUSY', retryAfter: Math.max(1, Math.ceil((Number(state.next_lease) - now) / 1000)) };
  return null;
}
