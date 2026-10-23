// 🎵 TikTok: เชื่อมบัญชี TikTok ของร้าน + ส่งคลิป Reels ไป TikTok (คุณแดน 24 ต.ค. 69 "รบกวนตั้งค่า tiktok api ให้หน่อย")
// แอป "SheetLab" (developers.tiktok.com) ยังไม่ผ่านการตรวจ → ค่าเริ่มต้น inbox = คลิปเข้ากล่องร่างในแอป TikTok ให้คุณแดนกดโพสต์เอง
// direct = โพสต์เองทันที (ก่อน TikTok อนุมัติแอป โพสต์ได้แค่แบบส่วนตัว SELF_ONLY)
// เก็บใน shop_state id=tiktok (อ่านได้เฉพาะคีย์ลับฝั่งเซิร์ฟเวอร์/แอดมิน) {clientKey, clientSecret, mode, state, stateAt, token:{...}, user:{display_name, avatar_url}}
import { SB_URL } from './shop.js';

export const TT_REDIRECT = 'https://sheetlabth.com/tiktok/callback';
export const TT_SCOPES = 'user.info.basic,video.upload,video.publish';
const API = 'https://open.tiktokapis.com/v2/';
const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const hdr = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

export function ttAuthUrl(clientKey, state, redirect = TT_REDIRECT) {
  const q = new URLSearchParams({ client_key: clientKey, scope: TT_SCOPES, response_type: 'code', redirect_uri: redirect, state });
  return 'https://www.tiktok.com/v2/auth/authorize/?' + q.toString().replace(/%2C/g, ',');
}
// โทเค็นเหลือ < 10 นาที (หรือไม่รู้วันหมด) → ต่ออายุก่อนใช้
export const ttNeedsRefresh = (tok, now = Date.now()) => !!tok && (!tok.expires_at || Date.parse(tok.expires_at) - now < 10 * 60e3);
export const ttConnected = (d, now = Date.now()) => !!(d && d.token && d.token.access_token && d.token.refresh_token && Date.parse(d.token.refresh_expires_at || 0) > now);
export const tokFrom = (j, now = Date.now()) => ({ access_token: j.access_token, refresh_token: j.refresh_token, open_id: j.open_id || '', scope: j.scope || '',
  expires_at: new Date(now + (Number(j.expires_in) || 86400) * 1000).toISOString(), refresh_expires_at: new Date(now + (Number(j.refresh_expires_in) || 31536000) * 1000).toISOString() });
// บรรทัดบันทึกในโน้ตโพสต์ (คู่กับ "IG ✓ ...") · ไม่ชนกับรูปแบบ IG
export const TT_LINE = /^TT (✓|ไม่ผ่าน).*$/m;
export const ttLine = (r) => (r && r.ok ? `TT ✓ ${r.publish_id} (${r.mode})` : `TT ไม่ผ่าน: ${String((r && r.error) || '').slice(0, 200)}`);
export const withTt = (notes, line) => (TT_LINE.test(notes || '') ? String(notes).replace(TT_LINE, line) : [notes, line].filter(Boolean).join('\n')).slice(0, 1500);
// แคปชัน TikTok: ไม่เกิน 2,200 ตัว · ไม่มีบรรทัดบอกว่าทำด้วย AI (กฎคุณแดน)
export const ttCaption = (t) => String(t || '').split('\n').filter((l) => !/สร้างด้วย\s*AI|made with AI/i.test(l)).join('\n').trim().slice(0, 2200);

export async function loadTT() {
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.tiktok&select=data`, { headers: hdr });
  const rows = r.ok ? await r.json() : [];
  return rows?.[0]?.data || {};
}
export async function saveTT(data) {
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'tiktok', data, updated_at: new Date().toISOString() }]) });
  if (!r.ok) throw new Error(`save tiktok: ${r.status} ${(await r.text()).slice(0, 200)}`);
}
// สถานะที่ส่งให้หน้าหลังบ้าน (ไม่มีรหัสลับ/โทเค็น)
export const ttPublic = (d) => ({ hasApp: !!(d.clientKey && d.clientSecret), clientKeyTail: d.clientKey ? String(d.clientKey).slice(-4) : '', connected: ttConnected(d), user: d.user || null, mode: d.mode === 'direct' ? 'direct' : 'inbox', redirect: TT_REDIRECT, last: d.last || null });

async function tokenReq(params) {
  const r = await fetch(API + 'oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' }, body: new URLSearchParams(params) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || `TikTok ไม่ให้โทเค็น (${r.status})`);
  return j;
}
export async function ttExchange(d, code) {
  return tokFrom(await tokenReq({ client_key: d.clientKey, client_secret: d.clientSecret, code, grant_type: 'authorization_code', redirect_uri: TT_REDIRECT }));
}
export async function ttFresh(d) {
  if (!ttConnected(d)) throw new Error('ยังไม่ได้เชื่อมบัญชี TikTok (หรือการเชื่อมหมดอายุ ต้องกดเชื่อมใหม่)');
  if (!ttNeedsRefresh(d.token)) return d;
  const t = tokFrom(await tokenReq({ client_key: d.clientKey, client_secret: d.clientSecret, grant_type: 'refresh_token', refresh_token: d.token.refresh_token }));
  const nd = { ...d, token: { ...t, open_id: t.open_id || d.token.open_id } };
  await saveTT(nd);
  return nd;
}
async function api(path, token, body) {
  const r = await fetch(API + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  const code = j?.error?.code;
  if (!r.ok || (code && code !== 'ok')) throw new Error(`${code || r.status}${j?.error?.message ? ': ' + j.error.message : ''}`);
  return j.data || {};
}
export async function ttUser(token) {
  const r = await fetch(API + 'user/info/?fields=open_id,display_name,avatar_url', { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  return j?.data?.user || {};
}
// ส่งคลิปไป TikTok: inbox = กล่องร่างในแอป · direct = โพสต์เลย (ถาม creator_info ก่อน ใช้ PUBLIC_TO_EVERYONE ถ้ามีให้เลือก)
// คลิปของร้าน < 64 MB ส่งก้อนเดียว · คืน { ok, publish_id, mode }
export async function pushToTikTok(d, videoUrl, caption, mode) {
  d = await ttFresh(d);
  const tok = d.token.access_token; mode = (mode || d.mode) === 'direct' ? 'direct' : 'inbox';
  const v = await fetch(videoUrl);
  if (!v.ok) throw new Error(`โหลดคลิปไม่ได้ (${v.status})`);
  const buf = Buffer.from(await v.arrayBuffer()), n = buf.length;
  if (!n) throw new Error('ไฟล์คลิปว่าง');
  if (n > 64e6) throw new Error('คลิปใหญ่เกิน 64 MB');
  const source_info = { source: 'FILE_UPLOAD', video_size: n, chunk_size: n, total_chunk_count: 1 };
  let init;
  if (mode === 'direct') {
    const ci = await api('post/publish/creator_info/query/', tok, {});
    const opts = ci.privacy_level_options || [];
    const privacy_level = opts.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : opts[0] || 'SELF_ONLY';
    init = await api('post/publish/video/init/', tok, { post_info: { title: ttCaption(caption), privacy_level, disable_duet: false, disable_comment: false, disable_stitch: false }, source_info });
  } else init = await api('post/publish/inbox/video/init/', tok, { source_info });
  if (!init.upload_url) throw new Error('TikTok ไม่ส่งลิงก์อัปโหลดมา');
  const up = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes 0-${n - 1}/${n}` }, body: buf });
  if (!up.ok) throw new Error(`อัปโหลดคลิปไป TikTok ไม่ได้ (${up.status})`);
  return { ok: true, publish_id: String(init.publish_id || ''), mode };
}
// ใช้ตอนโพสต์ Reels ขึ้นเพจสำเร็จ: ส่ง TikTok ต่อ (ไม่ทำให้โพสต์เพจล้ม) · คืนบรรทัดบันทึก หรือ '' ถ้ายังไม่ได้เชื่อม
export async function crossToTikTok(videoUrl, caption) {
  let d; try { d = await loadTT(); } catch (e) { return ''; }
  if (!ttConnected(d) || d.auto === false) return '';
  try { return ttLine(await pushToTikTok(d, videoUrl, caption)); }
  catch (e) { return ttLine({ ok: false, error: String(e.message || e) }); }
}
