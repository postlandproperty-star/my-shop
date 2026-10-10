// โค้ดขอบคุณคนรีวิว: รีวิวครั้งแรกของแต่ละออเดอร์ (ให้กี่ดาวก็ได้) ได้โค้ดลด REWARD_PCT% ใช้ได้ 1 ครั้ง ภายใน VALID_DAYS วัน
// ใช้ได้ทั้ง QR บนหน้าร้าน (ลดยอดใน PaymentIntent) และหน้าบัตร Stripe (คูปอง sl-review) · ถูกตัดเป็น "ใช้แล้ว" ตอนจ่ายสำเร็จ (fulfill)
// เก็บใน shop_state id=rewards {codes:{CODE:{email, order, pct, created, expires, used_at, used_order}}}
import { randomBytes } from 'node:crypto';
import { SB_URL, stripe } from './shop.js';

export const REWARD_PCT = 20;
export const VALID_DAYS = 30;
const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const hdr = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

async function load() {
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.rewards&select=data`, { headers: hdr });
  const j = r.ok ? await r.json() : [];
  return { codes: j?.[0]?.data?.codes || {} };
}
async function save(d) {
  const cut = Date.now() - 120 * 864e5; // เก็บย้อนหลัง 4 เดือน
  for (const [k, v] of Object.entries(d.codes)) if (Date.parse(v.expires) < cut) delete d.codes[k];
  await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'rewards', data: d, updated_at: new Date().toISOString() }]) });
}
const clean = (c) => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

// ออกโค้ดให้ออเดอร์ที่รีวิว (ออเดอร์ละ 1 โค้ด ถ้ามีแล้วคืนโค้ดเดิม)
export async function issueReward(order, email) {
  const d = await load();
  const old = Object.entries(d.codes).find(([, v]) => v.order === order);
  if (old) return { code: old[0], ...old[1] };
  let code; do { code = 'TY' + randomBytes(4).toString('hex').toUpperCase().slice(0, 6); } while (d.codes[code]);
  const now = Date.now();
  d.codes[code] = { email: String(email || '').toLowerCase(), order, pct: REWARD_PCT, created: new Date(now).toISOString(), expires: new Date(now + VALID_DAYS * 864e5).toISOString(), used_at: null };
  await save(d);
  return { code, ...d.codes[code] };
}

// ตรวจโค้ด: {ok, code, pct, expires} หรือ {ok:false, error}
export async function checkReward(input) {
  const code = clean(input); if (!code) return { ok: false, error: 'ใส่โค้ดก่อน' };
  const v = (await load()).codes[code];
  if (!v) return { ok: false, error: 'ไม่พบโค้ดนี้' };
  if (v.used_at) return { ok: false, error: 'โค้ดนี้ใช้ไปแล้ว' };
  if (Date.parse(v.expires) < Date.now()) return { ok: false, error: 'โค้ดหมดอายุแล้ว' };
  return { ok: true, code, pct: Number(v.pct) || REWARD_PCT, expires: v.expires };
}

// จ่ายสำเร็จ: ตัดโค้ดเป็นใช้แล้ว (เรียกจาก fulfill)
export async function useReward(input, orderId) {
  const code = clean(input); if (!code) return;
  const d = await load(); const v = d.codes[code]; if (!v || v.used_at) return;
  v.used_at = new Date().toISOString(); v.used_order = String(orderId || '').slice(0, 80);
  await save(d);
}

// คูปองบน Stripe สำหรับหน้าบัตร (สร้างครั้งแรกครั้งเดียว)
export async function stripeRewardCoupon(pct) {
  const id = `sl-review${pct}`;
  try { const c = await stripe('GET', `coupons/${id}`); if (c && c.id) return id; } catch (e) {}
  await stripe('POST', 'coupons', { id, percent_off: pct, duration: 'once', name: `ส่วนลด ${pct}%` });
  return id;
}

// โค้ดส่วนลดจากแชทเพจ (/deal): คนละ 1 โค้ด หมดอายุ 24 ชม. ใช้ได้ครั้งเดียว · กันกดรัว: เครื่องเดิม (IP) ได้โค้ดเดิมจนกว่าจะหมดอายุ · วันละไม่เกิน 300 โค้ด
export const DEAL_HOURS = 24;
export async function issueDeal(who, pct) {
  const d = await load(), now = Date.now(), key = 'deal:' + String(who || '').slice(0, 40);
  const old = Object.entries(d.codes).find(([, v]) => v.order === key && !v.used_at && Date.parse(v.expires) > now);
  if (old) return { code: old[0], ...old[1], again: true };
  const today = Object.values(d.codes).filter((v) => String(v.order || '').startsWith('deal:') && Date.parse(v.created) > now - 864e5).length;
  if (today >= 300) throw new Error('วันนี้แจกโค้ดครบแล้ว ลองใหม่พรุ่งนี้');
  let code; do { code = 'CHAT' + randomBytes(4).toString('hex').toUpperCase().slice(0, 5); } while (d.codes[code]);
  d.codes[code] = { email: '', order: key, pct: Math.max(1, Math.min(50, Math.round(Number(pct) || 10))), created: new Date(now).toISOString(), expires: new Date(now + DEAL_HOURS * 3600e3).toISOString(), used_at: null, kind: 'deal' };
  await save(d);
  return { code, ...d.codes[code] };
}
export async function dealStats() { const d = await load(), now = Date.now(); const L = Object.values(d.codes).filter((v) => v.kind === 'deal');
  return { issued7: L.filter((v) => Date.parse(v.created) > now - 7 * 864e5).length, used7: L.filter((v) => v.used_at && Date.parse(v.used_at) > now - 7 * 864e5).length, total: L.length, used: L.filter((v) => v.used_at).length }; }

// 📧 ตามลูกค้าที่เปิดหน้าจ่ายแต่ยังไม่จ่าย (คุณแดน 10 ต.ค. 69): โค้ดลด pct% ใช้ได้ครั้งเดียว ภายใน hours ชม. ผูกกับคำสั่งซื้อที่ค้าง (ต่อคำสั่งซื้อ 1 โค้ด)
export async function issueRecover(email, key, pct, hours) {
  const d = await load(), now = Date.now(), k = 'recover:' + String(key || '').slice(0, 80);
  const old = Object.entries(d.codes).find(([, v]) => v.order === k);
  if (old) return { code: old[0], ...old[1], again: true };
  let code; do { code = 'BACK' + randomBytes(4).toString('hex').toUpperCase().slice(0, 5); } while (d.codes[code]);
  d.codes[code] = { email: String(email || '').toLowerCase(), order: k, pct: Math.max(1, Math.min(50, Math.round(Number(pct) || 20))), created: new Date(now).toISOString(), expires: new Date(now + Math.max(1, Math.min(168, Number(hours) || 24)) * 3600e3).toISOString(), used_at: null, kind: 'recover' };
  await save(d);
  return { code, ...d.codes[code] };
}
export async function codesInfo(list) { const d = await load(); const o = {}; for (const c of list || []) { const v = d.codes[clean(c)]; if (v) o[clean(c)] = { used_at: v.used_at || null, used_order: v.used_order || null, expires: v.expires }; } return o; }
