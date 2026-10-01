// เพจ Facebook: เก็บโทเค็นเพจในแถว shop_state id='fb' (อ่านได้เฉพาะแอดมิน/เซิร์ฟเวอร์)
// FB_APP_ID / FB_APP_SECRET บน Vercel ใช้แลกโทเค็นชั่วคราวเป็นแบบไม่หมดอายุ
import { SB_URL } from './shop.js';
import { withFbTags } from './hashtags.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
export const FB_API = 'https://graph.facebook.com/v21.0';
const APP_ID = process.env.FB_APP_ID || '';
const APP_SECRET = process.env.FB_APP_SECRET || '';
export const appConfigured = () => /^\d{5,}$/.test(APP_ID) && APP_SECRET.length >= 16;

const hdr = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

const fbRow = (brand) => (brand === 'readlab' ? 'fb_readlab' : 'fb');
export async function loadFb(brand = '') {
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.${fbRow(brand)}&select=data`, { headers: hdr });
  const rows = r.ok ? await r.json() : [];
  const d = rows?.[0]?.data;
  if (d && d.pageId && d.token) return { ...d, brand: brand === 'readlab' ? 'readlab' : '' };
  if (brand === 'readlab') return null;
  // ทางเลือกเดิม: ใส่โทเค็นตรงใน Vercel
  const pageId = process.env.FB_PAGE_ID || '', token = process.env.FB_PAGE_TOKEN || '';
  if (/^\d{5,}$/.test(pageId) && token.length > 20) return { pageId, token, pageName: '', source: 'env' };
  return null;
}

export async function saveFb(data) {
  // updated_at เก่าจงใจ: ไม่ให้แท็บแอดมินคิดว่าข้อมูลร้านถูกแก้จากที่อื่น
  const body = [{ id: fbRow(data.brand), data, updated_at: '2000-01-01T00:00:00Z' }];
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`save fb: ${r.status} ${await r.text()}`);
}

export async function clearFb(brand = '') {
  await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.${fbRow(brand)}`, { method: 'DELETE', headers: hdr });
}

export async function fbGet(path, params) {
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`${FB_API}/${path}?${q}`);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `facebook ${r.status}`);
  return j;
}

// โทเค็นผู้ใช้ชั่วคราว (จาก Graph API Explorer) → โทเค็นผู้ใช้อายุยาว → โทเค็นเพจ (ไม่หมดอายุ)
export async function exchangeForPages(shortToken, pageIdHint = '') {
  if (!appConfigured()) throw new Error('ยังไม่ได้ใส่ FB_APP_ID / FB_APP_SECRET บน Vercel (ใส่แล้วต้อง Redeploy)');
  const long = await fbGet('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: APP_ID, client_secret: APP_SECRET, fb_exchange_token: shortToken });
  const me = await fbGet('me', { access_token: long.access_token, fields: 'id,name', metadata: '1' });
  // โทเค็นเพจโดยตรง (เลือกเพจใน Graph API Explorer แล้ว) → ใช้ได้เลย
  if (me.metadata?.type === 'page') return { user: { id: me.id, name: me.name }, pages: [{ id: me.id, name: me.name, access_token: long.access_token }], userToken: '' };
  let pages = [];
  try {
    const acc = await fbGet('me/accounts', { access_token: long.access_token, fields: 'id,name,access_token,followers_count', limit: 50 });
    pages = acc.data || [];
  } catch (e) { console.error('me/accounts', e); }
  // บางบัญชี me/accounts ว่างทั้งที่มีสิทธิ์เพจ → ขอโทเค็นเพจจากเลขเพจโดยตรง
  if (!pages.length && /^\d{5,}$/.test(pageIdHint)) {
    const pg = await fbGet(pageIdHint, { access_token: long.access_token, fields: 'id,name,access_token,followers_count' });
    if (pg.access_token) pages = [pg];
  }
  return { user: me, pages, userToken: long.access_token };
}

// โพสต์ 1 รายการขึ้นเพจ: มีรูป → /photos (caption), ไม่มีรูป → /feed (message + link)
export const isVideoUrl = (u) => /\.(mp4|mov|m4v)(\?|$)/i.test(String(u || ''));
// โพสต์ Reels: start -> อัปโหลดไฟล์วิดีโอ -> finish (ต้องมีสิทธิ์ publish_video ในโทเค็นเพจ)
// เดิมให้ Facebook ดึงไฟล์เองจากลิงก์ (file_url) แต่ได้ 503 บ่อย จึงดาวน์โหลดไฟล์มาส่งเป็นไบต์เอง และลองซ้ำเมื่อเซิร์ฟเวอร์ Facebook ล่มชั่วคราว
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const transient = (status, j) => status >= 500 || status === 429 || !!(j && j.error && (j.error.is_transient || [1, 2, 4, 17, 341].includes(j.error.code)));
async function fbPostRetry(url, params, tries = 3) {
  let j = {}, st = 0;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { method: 'POST', body: new URLSearchParams(params) });
    st = r.status; j = await r.json().catch(() => ({}));
    if (r.ok && !j.error) return j;
    if (!transient(st, j) || i === tries - 1) break;
    await sleep(2500 * (i + 1));
  }
  throw new Error(j.error?.message || `facebook ${st}`);
}
async function publishReel(fb, p) {
  let start;
  try { start = await fbPostRetry(`${FB_API}/${fb.pageId}/video_reels`, { access_token: fb.token, upload_phase: 'start' }); }
  catch (e) { throw new Error(`reels start: ${e.message} (ต้องมีสิทธิ์ publish_video)`); }
  if (!start.video_id) throw new Error('reels start failed (ไม่ได้ video_id)');
  const vr = await fetch(p.image_url);
  if (!vr.ok) throw new Error(`ดาวน์โหลดไฟล์คลิปจากคลังไม่ได้ (${vr.status})`);
  const buf = Buffer.from(await vr.arrayBuffer());
  if (buf.length < 1000) throw new Error('ไฟล์คลิปว่างหรือเสีย');
  let err = '';
  for (let i = 0; i < 4; i++) {
    let st = 0, uj = {};
    try {
      const up = await fetch(`https://rupload.facebook.com/video-upload/v21.0/${start.video_id}`, { method: 'POST', headers: { Authorization: `OAuth ${fb.token}`, offset: '0', file_size: String(buf.length), 'Content-Type': 'application/octet-stream' }, body: buf });
      st = up.status; uj = await up.json().catch(() => ({}));
      if (up.ok && !uj.error && uj.success !== false) { err = ''; break; }
    } catch (e) { st = 599; uj = { error: { message: String(e.message || e) } }; }
    err = uj.error?.message || uj.debug_info?.message || `reels upload ${st}`;
    if (!transient(st, uj)) break;
    await sleep(3000 * (i + 1));
  }
  if (err) throw new Error(err);
  await fbPostRetry(`${FB_API}/${fb.pageId}/video_reels`, { access_token: fb.token, video_id: start.video_id, upload_phase: 'finish', video_state: 'PUBLISHED', description: cap(p) });
  return start.video_id;
}
// p.raw = ใช้ข้อความตามที่เขียนมา ไม่เติมแฮชแท็ก SheetLab (ใช้กับเพจ ReadLab)
const cap = (p) => (p.raw ? String(p.text || '') : withFbTags(p.text));
export async function publishToPage(fb, p) {
  if (isVideoUrl(p.image_url)) return publishReel(fb, p);
  const params = new URLSearchParams({ access_token: fb.token });
  let url;
  if (p.image_url) {
    params.set('url', p.image_url);
    params.set('caption', cap(p));
    url = `${FB_API}/${fb.pageId}/photos`;
  } else {
    params.set('message', cap(p));
    if (p.link_url) params.set('link', p.link_url);
    url = `${FB_API}/${fb.pageId}/feed`;
  }
  const r = await fetch(url, { method: 'POST', body: params });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `facebook ${r.status}`);
  return j.post_id || j.id;
}
