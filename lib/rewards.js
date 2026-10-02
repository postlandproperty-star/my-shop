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
  await stripe('POST', 'coupons', { id, percent_off: pct, duration: 'once', name: `ขอบคุณที่รีวิว ลด ${pct}%` });
  return id;
}
