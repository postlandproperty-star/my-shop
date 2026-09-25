// ตัวช่วยฝั่งเซิร์ฟเวอร์: คุยกับ Supabase และ Stripe
// ค่าลับอ่านจาก Environment Variables ของ Vercel เท่านั้น ไม่เคยส่งไปหน้าเว็บ
export const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
export const SB_PUBLIC_KEY = 'sb_publishable_q4qdE3WFYdH15Klf7TToSQ_Tbh87eNs';
const SB_SECRET = process.env.SUPABASE_SECRET_KEY || '';
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';

export const configured = () => ({ stripe: /^(sk|rk)_(live|test)_/.test(STRIPE_SECRET), supabase: /^sb_secret_/.test(SB_SECRET) });

async function sbFetch(path, { secret = false, method = 'GET', body, prefer } = {}) {
  const key = secret ? SB_SECRET : SB_PUBLIC_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`supabase ${path}: ${r.status} ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null; // upsert แบบ return=minimal ตอบกลับว่างเปล่า
}

// ข้อมูลร้านที่ลูกค้าเห็นได้ (สินค้า ตั้งค่า) — ไม่มีลิงก์ไฟล์
export async function loadShop() {
  const rows = await sbFetch('shop_state?id=eq.main&select=data');
  const d = rows?.[0]?.data || {};
  return { products: d.products || [], settings: d.settings || {}, coupons: d.coupons || [] };
}

// ลิงก์ไฟล์ของสินค้า (อยู่ในแถว private ต้องใช้คีย์ลับ)
export async function loadLinks() {
  const rows = await sbFetch('shop_state?id=eq.private&select=data', { secret: true });
  return rows?.[0]?.data?.links || {};
}

// บันทึก/อัปเดตออเดอร์ (upsert ตาม session_id จึงเรียกซ้ำได้ไม่ซ้ำแถว)
export async function upsertOrders(rows) {
  if (!rows.length) return;
  await sbFetch('orders?on_conflict=session_id', { secret: true, method: 'POST', body: rows, prefer: 'resolution=merge-duplicates,return=minimal' });
}

// ตรวจว่า token ที่ส่งมาเป็นแอดมินที่ล็อกอิน Supabase จริง
export async function verifyAdmin(authHeader) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_PUBLIC_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

// เรียก Stripe API (แบบ form-encoded ตามที่ Stripe ต้องการ ไม่ต้องติดตั้งไลบรารี)
export async function stripe(method, path, params) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? encodeForm(params) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`stripe ${path}: ${j.error?.message || r.status}`);
  return j;
}

function encodeForm(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? encodeForm(item, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`)));
    else if (typeof v === 'object') encodeForm(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return prefix ? out : out.join('&');
}

// แปลง Checkout Session ของ Stripe เป็นแถวในตาราง orders
export function sessionToOrder(s) {
  const m = s.metadata || {};
  return {
    session_id: s.id,
    created_at: new Date(s.created * 1000).toISOString(),
    paid_at: s.payment_status === 'paid' ? new Date(s.created * 1000).toISOString() : null,
    product_id: m.productId || null,
    product_name: m.productName || null,
    slug: m.slug || null,
    email: s.customer_details?.email || s.customer_email || null,
    name: s.customer_details?.name || null,
    amount: (s.amount_total || 0) / 100,
    currency: (s.currency || 'thb').toUpperCase(),
    status: s.payment_status === 'paid' ? 'paid' : s.status === 'expired' ? 'expired' : 'pending',
    campaign: m.campaign || null,
    payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id || null,
  };
}

export function htmlError(res, title, detail) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(500).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:40px 16px;text-align:center;max-width:520px;margin:auto"><h2>${title}</h2><p style="color:#56637D">${detail}</p><p><a href="javascript:history.back()">กลับ</a></p></body>`);
}
