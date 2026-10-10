import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Migration-only declarations. Request handlers use the existing D1 tables.
export const trialRequests = sqliteTable("trial_requests", {
  requestId: text("request_id").primaryKey().notNull(),
  sessionHash: text("session_hash").notNull(),
  ipHash: text("ip_hash").notNull(),
  action: text("action", { enum: ["generate", "expand", "synthesize"] }).notNull(),
  dayBucket: text("day_bucket").notNull(),
  monthBucket: text("month_bucket").notNull(),
  reservedMicroyuan: integer("reserved_microyuan").notNull(),
  admittedAt: integer("admitted_at").notNull(),
  leaseUntil: integer("lease_until").notNull(),
  completedAt: integer("completed_at"),
  outcome: text("outcome"),
}, (table) => [
  check("trial_action_valid", sql`${table.action} IN ('generate', 'expand', 'synthesize')`),
  check("trial_reserved_positive", sql`${table.reservedMicroyuan} > 0`),
  index("trial_month").on(table.monthBucket),
  index("trial_day").on(table.dayBucket),
  index("trial_session_day").on(table.sessionHash, table.dayBucket),
  index("trial_ip_day").on(table.ipHash, table.dayBucket),
  index("trial_lease").on(table.leaseUntil),
]);
