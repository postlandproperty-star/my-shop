// Stripe เรียกมาที่นี่ทันทีที่มีการจ่ายสำเร็จ (แม้ลูกค้าปิดหน้าเว็บไปแล้ว) → บันทึกออเดอร์ + ส่งอีเมลลิงก์ไฟล์
// ตั้งค่าใน Stripe: Developers → Webhooks → endpoint https://<โดเมน>/api/stripe-webhook, event checkout.session.completed
// (ถ้าวาง Signing secret whsec_... ใน Vercel เป็น STRIPE_WEBHOOK_SECRET จะตรวจลายเซ็น ถ้าไม่มี จะดึงเหตุการณ์จาก Stripe ด้วย id มาตรวจแทน)
import { verifyStripeSignature, piToSession, stripe } from '../lib/shop.js';
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
  if (req.query && req.query.mx) { const { messengerHook } = await import('../lib/messengerHook.js'); return messengerHook(req, res); } // /api/messenger (แชทบอทเพจ)
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const body = await rawBody(req);
  let event;
  try { event = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'bad json' }); }
  if (/^whsec_/.test(secret)) {
    if (!(await verifyStripeSignature(body, req.headers['stripe-signature'], secret))) return res.status(400).json({ ok: false, error: 'bad signature' });
  } else {
    // ไม่มี signing secret บน Vercel: ไม่เชื่อ body ที่ส่งมา ดึงเหตุการณ์ตัวจริงจาก Stripe ด้วยเลข id แทน
    if (!/^evt_[A-Za-z0-9]+$/.test(String(event?.id || ''))) return res.status(400).json({ ok: false, error: 'bad event id' });
    try { event = await stripe('GET', `events/${event.id}`); } catch { return res.status(400).json({ ok: false, error: 'unknown event' }); }
  }
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const origin = `https://${req.headers.host}`;
      const r = await fulfill(session, { origin });
      return res.status(r.retry ? 500 : 200).json({ ok: !r.retry, sent: r.sent, reason: r.reason || null }); // 500 = ให้ Stripe ส่งมาใหม่
    }
    if (event.type === 'payment_intent.succeeded' && ['qr', 'card'].includes(event.data.object?.metadata?.flow)) { // QR หรือบัตรบนหน้าขาย // จ่ายด้วย QR บนหน้าร้าน
      const r = await fulfill(piToSession(event.data.object), { origin: `https://${req.headers.host}` });
      return res.status(r.retry ? 500 : 200).json({ ok: !r.retry, sent: r.sent, reason: r.reason || null });
    }
    res.status(200).json({ ok: true, ignored: event.type });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
