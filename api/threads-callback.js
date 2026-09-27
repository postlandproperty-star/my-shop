// ปลายทาง OAuth ของ Threads: threads.net ส่ง code กลับมาที่นี่ → แลกโทเค็นอายุยาว → บันทึก → กลับหลังบ้าน
import { loadThreads, saveThreads, thGet, TH_REDIRECT, SITE } from '../lib/threads.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const back = (q) => { res.statusCode = 302; res.setHeader('Location', `${SITE}/?${q}`); res.end(); };
  try {
    const code = String(req.query.code || ''), state = String(req.query.state || '');
    if (req.query.error) return back(`threads=error&msg=${encodeURIComponent(String(req.query.error_description || req.query.error))}`);
    const th = await loadThreads();
    if (!code || !th.appId || !th.appSecret) return back('threads=error&msg=' + encodeURIComponent('ยังไม่ได้ตั้งค่า Threads App'));
    if (!state || state !== th.state) return back('threads=error&msg=' + encodeURIComponent('state ไม่ตรง ลองกดเชื่อมใหม่'));
    const r = await fetch('https://graph.threads.net/oauth/access_token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: th.appId, client_secret: th.appSecret, grant_type: 'authorization_code', redirect_uri: TH_REDIRECT, code }).toString() });
    const short = await r.json().catch(() => ({}));
    if (!r.ok || !short.access_token) return back('threads=error&msg=' + encodeURIComponent(short.error_message || short.error?.message || `แลกโทเค็นไม่ได้ (${r.status})`));
    const long = await thGet('access_token', { grant_type: 'th_exchange_token', client_secret: th.appSecret, access_token: short.access_token });
    const me = await thGet('me', { fields: 'id,username,threads_profile_picture_url', access_token: long.access_token });
    await saveThreads({ appId: th.appId, appSecret: th.appSecret, token: long.access_token, userId: String(me.id || short.user_id), username: me.username || '', picture: me.threads_profile_picture_url || '', expiresAt: new Date(Date.now() + (long.expires_in || 5184000) * 1000).toISOString(), connectedAt: new Date().toISOString() });
    return back('threads=ok');
  } catch (e) {
    console.error(e);
    return back('threads=error&msg=' + encodeURIComponent(String(e.message || e)));
  }
}
