// Stripe เรียกมาที่นี่ทันทีที่มีการจ่ายสำเร็จ (แม้ลูกค้าปิดหน้าเว็บไปแล้ว) → บันทึกออเดอร์ + ส่งอีเมลลิงก์ไฟล์
// ตั้งค่าใน Stripe: Developers → Webhooks → endpoint https://<โดเมน>/api/stripe-webhook, event checkout.session.completed
// แล้ววาง Signing secret (whsec_...) ใน Vercel เป็น STRIPE_WEBHOOK_SECRET
import { verifyStripeSignature } from '../lib/shop.js';
import { fulfill } from '../lib/fulfill.js';

export const config = { api: { bodyParser: false } }; // ต้องใช้ body ดิบเพื่อตรวจลายเซ็น

function rawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!/^whsec_/.test(secret)) return res.status(500).json({ ok: false, error: 'STRIPE_WEBHOOK_SECRET not set' });
  const body = await rawBody(req);
  if (!(await verifyStripeSignature(body, req.headers['stripe-signature'], secret))) return res.status(400).json({ ok: false, error: 'bad signature' });
  let event;
  try { event = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'bad json' }); }
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const origin = `https://${req.headers.host}`;
      const r = await fulfill(session, { origin });
      return res.status(200).json({ ok: true, sent: r.sent, reason: r.reason || null });
    }
    res.status(200).json({ ok: true, ignored: event.type });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
