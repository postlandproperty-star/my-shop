// Threads (Meta): โทเค็นและ App ID/Secret ของ Threads เก็บในแถว shop_state id='threads' (เซิร์ฟเวอร์อ่านได้เท่านั้น)
import { SB_URL } from './shop.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
export const TH_API = 'https://graph.threads.net/v1.0';
export const SITE = 'https://my-shop-lake-ten.vercel.app';
export const TH_REDIRECT = `${SITE}/api/threads-callback`;
export const TH_SCOPES = 'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies';
const hdr = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

export async function loadThreads() {
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.threads&select=data`, { headers: hdr });
  const rows = r.ok ? await r.json() : [];
  return rows?.[0]?.data || {};
}
export const threadsConnected = (th) => !!(th && th.token && th.userId);

export async function saveThreads(data) {
  const body = [{ id: 'threads', data, updated_at: '2000-01-01T00:00:00Z' }];
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`save threads: ${r.status} ${await r.text()}`);
}

export async function thGet(path, params) {
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`${TH_API}/${path}?${q}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `threads ${r.status}`);
  return j;
}
export async function thPost(path, params) {
  const r = await fetch(`${TH_API}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `threads ${r.status}`);
  return j;
}

// โทเค็นอายุยาว 60 วัน ต่ออายุเมื่อเหลือน้อยกว่า 10 วัน (ต้องมีอายุอย่างน้อย 24 ชม. ก่อนต่อ)
export async function refreshIfNeeded(th) {
  if (!threadsConnected(th) || !th.expiresAt) return th;
  const left = Date.parse(th.expiresAt) - Date.now();
  if (left > 10 * 864e5) return th;
  try {
    const j = await thGet('refresh_access_token', { grant_type: 'th_refresh_token', access_token: th.token });
    const next = { ...th, token: j.access_token, expiresAt: new Date(Date.now() + (j.expires_in || 5184000) * 1000).toISOString(), refreshedAt: new Date().toISOString() };
    await saveThreads(next);
    return next;
  } catch (e) { console.error('threads refresh', e.message); return th; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// สร้าง container → รอประมวลผล → publish คืน media id
import { threadsTopic } from './hashtags.js';
export async function publishToThreads(th, post) {
  const text = String(post.text || '').trim();
  if (!text) throw new Error('ไม่มีข้อความ');
  if (text.length > 500) throw new Error(`ข้อความยาว ${text.length} ตัวอักษร Threads รับได้ไม่เกิน 500`);
  const params = { access_token: th.token, text };
  const isVideo = /\.(mp4|mov|m4v)(\?|$)/i.test(String(post.image_url || ''));
  if (isVideo) { params.media_type = 'VIDEO'; params.video_url = post.image_url; }
  else if (post.image_url) { params.media_type = 'IMAGE'; params.image_url = post.image_url; }
  else { params.media_type = 'TEXT'; if (post.link_url) params.link_attachment = post.link_url; }
  // วิดีโอใช้เวลาประมวลผลนาน ถ้ารอบก่อนหมดเวลา จะจำ container เดิมไว้ใน error แล้วมาเช็คต่อ ไม่อัปโหลดซ้ำ
  const resume = isVideo && String(post.error || '').match(/^th_container:(\d+)/);
  // หัวข้อ Threads (topic tag) ให้โพสต์ไปอยู่ในหมวด TOEIC ถ้า API ไม่รับ ลองใหม่แบบไม่มีหัวข้อ
  const topic = threadsTopic(text);
  let c;
  if (resume) c = { id: resume[1] };
  else if (topic) { try { c = await thPost(`${th.userId}/threads`, { ...params, topic_tag: topic }); } catch (e) { c = await thPost(`${th.userId}/threads`, params); } }
  else c = await thPost(`${th.userId}/threads`, params);
  let finished = false;
  for (let i = 0; i < (isVideo ? 9 : 12); i++) {
    await sleep(isVideo ? 5000 : post.image_url ? 4000 : 1500);
    const st = await thGet(c.id, { fields: 'status,error_message', access_token: th.token }).catch(() => ({ status: 'IN_PROGRESS' }));
    if (st.status === 'FINISHED') { finished = true; break; }
    if (st.status === 'ERROR' || st.status === 'EXPIRED') throw new Error(st.error_message || `container ${st.status}`);
  }
  if (isVideo && !finished) throw new Error(`th_container:${c.id} Threads กำลังประมวลผลวิดีโอ กดโพสต์ใหม่อีกครั้งใน 1 นาที`);
  const pub = await thPost(`${th.userId}/threads_publish`, { access_token: th.token, creation_id: c.id });
  return pub.id;
}
