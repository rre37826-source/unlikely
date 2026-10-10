const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_KEY = 'unlikely.trial.session.v1';
const failure = code => Object.assign(new Error('Public trial unavailable'), { code });

export function chooseProvider(browser, local, trial) {
  if (browser) return { configured: true, mode: 'browser', model: browser.model };
  if (local?.configured) return { ...local, mode: 'local' };
  return { configured: trial?.available === true, mode: 'trial', model: null };
}

export function trialMessage(state, lang = 'en') {
  const zh = lang === 'zh';
  if (state?.available) return zh
    ? `免费试用 · 无需注册 · 今日还可使用 ${state.remaining ?? state.dailyLimit} 次。生成、拓展和整理共用额度。`
    : `Free trial · No sign-up · ${state.remaining ?? state.dailyLimit} actions left today. Generation, expansion and drafting share this allowance.`;
  const code = state?.reason || state?.code;
  if (code === 'checking') return zh ? '正在查看公共试用状态……也可以直接体验完整案例。' : 'Checking the public trial… Complete examples are ready to explore.';
  if (['TRIAL_QUOTA','TRIAL_RATE_LIMIT','TRIAL_BUDGET'].includes(code)) return zh ? '本轮公共试用额度已用完。已有网络仍可探索，也可以打开一个完整案例。' : 'The public trial allowance is used up. Keep exploring your map or open a complete example.';
  if (code === 'TRIAL_BUSY') return zh ? '公共试用正在忙，请稍后重试。你的内容已保留。' : 'The public trial is busy. Try again shortly; your work is preserved.';
  if (['TRIAL_DISABLED','TRIAL_CONFIG','unconfigured'].includes(code)) return zh ? '在线生成准备中。先用完整案例，体验从任务到创意主线的过程。' : 'Online generation is being prepared. Explore a complete example from task to creative route.';
  return zh ? '公共试用暂时不可用。你的内容已保留，可以继续探索已有网络或完整案例。' : 'The public trial is temporarily unavailable. Your work is preserved; existing maps and examples still work.';
}

export function createTrialClient(baseUrl, { fetchImpl = fetch, storage, randomUUID = () => crypto.randomUUID() } = {}) {
  let origin = '';
  try { const u = new URL(baseUrl); if (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname))) origin = u.origin; } catch {}
  let sessionId;
  try { sessionId = storage?.getItem(SESSION_KEY); } catch {}
  if (!UUID.test(sessionId || '')) { sessionId = randomUUID(); try { storage?.setItem(SESSION_KEY, sessionId); } catch {} }
  let state = { available: false, reason: origin ? 'checking' : 'unconfigured' };
  // Retry of an uncertain transport failure reuses its ID, never starts another paid call silently.
  let pending = null;
  let revision = 0;
  async function status() {
    if (!origin) return state;
    const ownRevision = ++revision;
    try {
      const r = await fetchImpl(`${origin}/api/trial/status`, { headers: { 'X-Trial-Session': sessionId }, credentials: 'omit', signal: AbortSignal.timeout(8000) });
      const data = await r.json();
      if (ownRevision !== revision) return state;
      state = r.ok && typeof data.available === 'boolean' ? data : { available: false, reason: 'unavailable' };
    } catch { if (ownRevision === revision) state = { available: false, reason: 'unavailable' }; }
    return state;
  }
  async function request(action, payload, { signal } = {}) {
    if (!origin) throw failure('TRIAL_DISABLED');
    ++revision;
    const fingerprint = JSON.stringify({ action, payload });
    if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, requestId: randomUUID() };
    const response = await fetchImpl(`${origin}/api/trial`, {
      method: 'POST', credentials: 'omit', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload, sessionId, requestId: pending.requestId })
    });
    let result; try { result = await response.json(); } catch { throw failure('INVALID_RESPONSE'); }
    pending = null;
    ++revision;
    if (result.trial) state = { ...result.trial, available: result.trial.remaining > 0, reason: result.trial.remaining > 0 ? undefined : 'TRIAL_QUOTA' };
    if (!response.ok) {
      if (['TRIAL_DISABLED','TRIAL_CONFIG','TRIAL_BUDGET','TRIAL_QUOTA','TRIAL_RATE_LIMIT'].includes(result.code)) state = { ...state, available: false, reason: result.code };
      throw failure(typeof result.code === 'string' ? result.code : 'PROVIDER');
    }
    return result;
  }
  return { status, request, get state() { return state; } };
}
