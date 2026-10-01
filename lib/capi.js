// Facebook Conversions API: เซิร์ฟเวอร์แจ้ง Facebook ว่า "ซื้อแล้ว" ทุกครั้งที่ระบบยืนยันว่าจ่ายเงินจริง
// ไม่ต้องรอให้ลูกค้ากลับมาหน้าเว็บ (ลูกค้าจ่าย QR ในแอปธนาคารแล้วปิดไปเลยบ่อย Pixel ในเบราว์เซอร์จึงนับไม่ครบ)
// event_id = รหัสออเดอร์ (session/PI) ตรงกับ eventID ที่เบราว์เซอร์ยิง Facebook จะตัดตัวซ้ำให้เอง
// ต้องมี FB_CAPI_TOKEN (สร้างใน Events Manager → Pixel → Settings → Conversions API) บน Vercel
import { createHash } from 'node:crypto';

const sha = (v) => createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
const cookie = (req, k) => { const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${k}=([^;]+)`)); return m ? decodeURIComponent(m[1]).slice(0, 200) : ''; };

// เก็บข้อมูลเบราว์เซอร์ตอนสร้างการชำระเงิน (ใส่ใน metadata ของ Stripe) ไว้ส่งคู่กับเหตุการณ์ซื้อ ช่วยให้ Facebook จับคู่คนที่เห็นแอดได้แม่นขึ้น
export function capiMeta(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const out = { fbp: cookie(req, '_fbp'), fbc: cookie(req, '_fbc'), cip: ip.slice(0, 60), cua: String(req.headers['user-agent'] || '').slice(0, 400) };
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

export async function sendPurchase({ pixelId, eventId, value, currency = 'THB', email, contentIds = [], contentName = '', meta = {}, url = 'https://sheetlabth.com/checkout', time }) {
  const token = process.env.FB_CAPI_TOKEN || '';
  if (!token || !/^\d{6,20}$/.test(String(pixelId || ''))) return { ok: false, skipped: !token ? 'no FB_CAPI_TOKEN' : 'no pixel' };
  const user = { country: [sha('th')] };
  if (email) user.em = [sha(email)];
  if (meta.fbp) user.fbp = meta.fbp;
  if (meta.fbc) user.fbc = meta.fbc;
  if (meta.cip) user.client_ip_address = meta.cip;
  if (meta.cua) user.client_user_agent = meta.cua;
  const ev = { event_name: 'Purchase', event_time: Math.floor((time || Date.now()) / 1000), event_id: String(eventId), action_source: 'website', event_source_url: url, user_data: user,
    custom_data: { currency, value: Math.round(Number(value) * 100) / 100, content_ids: contentIds.filter(Boolean).map(String), content_type: 'product', ...(contentName ? { content_name: String(contentName).slice(0, 200) } : {}) } };
  const body = new URLSearchParams({ data: JSON.stringify([ev]), access_token: token });
  if (process.env.FB_CAPI_TEST_CODE) body.set('test_event_code', process.env.FB_CAPI_TEST_CODE);
  const r = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, { method: 'POST', body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) return { ok: false, error: j.error?.message || `facebook ${r.status}` };
  return { ok: true, received: j.events_received };
}
