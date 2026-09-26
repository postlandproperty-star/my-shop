// เพจ Facebook: เก็บโทเค็นเพจในแถว shop_state id='fb' (อ่านได้เฉพาะแอดมิน/เซิร์ฟเวอร์)
// FB_APP_ID / FB_APP_SECRET บน Vercel ใช้แลกโทเค็นชั่วคราวเป็นแบบไม่หมดอายุ
import { SB_URL } from './shop.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
export const FB_API = 'https://graph.facebook.com/v21.0';
const APP_ID = process.env.FB_APP_ID || '';
const APP_SECRET = process.env.FB_APP_SECRET || '';
export const appConfigured = () => /^\d{5,}$/.test(APP_ID) && APP_SECRET.length >= 16;

const hdr = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

export async function loadFb() {
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.fb&select=data`, { headers: hdr });
  const rows = r.ok ? await r.json() : [];
  const d = rows?.[0]?.data;
  if (d && d.pageId && d.token) return d;
  // ทางเลือกเดิม: ใส่โทเค็นตรงใน Vercel
  const pageId = process.env.FB_PAGE_ID || '', token = process.env.FB_PAGE_TOKEN || '';
  if (/^\d{5,}$/.test(pageId) && token.length > 20) return { pageId, token, pageName: '', source: 'env' };
  return null;
}

export async function saveFb(data) {
  // updated_at เก่าจงใจ: ไม่ให้แท็บแอดมินคิดว่าข้อมูลร้านถูกแก้จากที่อื่น
  const body = [{ id: 'fb', data, updated_at: '2000-01-01T00:00:00Z' }];
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`save fb: ${r.status} ${await r.text()}`);
}

export async function clearFb() {
  await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.fb`, { method: 'DELETE', headers: hdr });
}

export async function fbGet(path, params) {
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`${FB_API}/${path}?${q}`);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `facebook ${r.status}`);
  return j;
}

// โทเค็นผู้ใช้ชั่วคราว (จาก Graph API Explorer) → โทเค็นผู้ใช้อายุยาว → โทเค็นเพจ (ไม่หมดอายุ)
export async function exchangeForPages(shortToken) {
  if (!appConfigured()) throw new Error('ยังไม่ได้ใส่ FB_APP_ID / FB_APP_SECRET บน Vercel (ใส่แล้วต้อง Redeploy)');
  const long = await fbGet('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: APP_ID, client_secret: APP_SECRET, fb_exchange_token: shortToken });
  const me = await fbGet('me', { access_token: long.access_token, fields: 'id,name', metadata: '1' });
  // โทเค็นเพจโดยตรง (เลือกเพจใน Graph API Explorer แล้ว) → ใช้ได้เลย
  if (me.metadata?.type === 'page') return { user: { id: me.id, name: me.name }, pages: [{ id: me.id, name: me.name, access_token: long.access_token }] };
  let pages = [];
  try {
    const acc = await fbGet('me/accounts', { access_token: long.access_token, fields: 'id,name,access_token,followers_count', limit: 50 });
    pages = acc.data || [];
  } catch (e) { console.error('me/accounts', e); }
  return { user: me, pages };
}

// โพสต์ 1 รายการขึ้นเพจ: มีรูป → /photos (caption), ไม่มีรูป → /feed (message + link)
export async function publishToPage(fb, p) {
  const params = new URLSearchParams({ access_token: fb.token });
  let url;
  if (p.image_url) {
    params.set('url', p.image_url);
    params.set('caption', p.text || '');
    url = `${FB_API}/${fb.pageId}/photos`;
  } else {
    params.set('message', p.text || '');
    if (p.link_url) params.set('link', p.link_url);
    url = `${FB_API}/${fb.pageId}/feed`;
  }
  const r = await fetch(url, { method: 'POST', body: params });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `facebook ${r.status}`);
  return j.post_id || j.id;
}
