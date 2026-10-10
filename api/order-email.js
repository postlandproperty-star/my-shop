// แอดมินกด "ส่งอีเมลซ้ำ": ส่งอีเมลลิงก์ไฟล์ของออเดอร์นี้อีกครั้ง
// GET /api/order-email?session_id=cs_...  (ต้องล็อกอินแอดมิน หรือ header x-content-key)
import { stripe, verifyAdmin, configured, piToSession } from '../lib/shop.js';
import { fulfill } from '../lib/fulfill.js';
import { mailConfigured } from '../lib/mail.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.CONTENT_API_KEY || ''; // คีย์ร้าน (เครื่องคุณแดน) ใช้ส่งซ้ำได้ด้วย เช่น ส่งลิงก์ใหม่ให้ลูกค้าหลายคนที่คุณแดนสั่ง
  const admin = (key.length >= 16 && req.headers['x-content-key'] === key) || await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
  const id = String(req.query.session_id || '');
  if (!/^(cs_(live|test)|pi)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ ok: false, error: 'bad session id' });
  if (!configured().stripe) return res.status(500).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Stripe' });
  if (!mailConfigured()) return res.status(500).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD บน Vercel' });
  try {
    const s = id.startsWith('pi_') ? piToSession(await stripe('GET', `payment_intents/${id}`)) : await stripe('GET', `checkout/sessions/${id}`);
    const alt = String(req.query.to || '').trim().toLowerCase();
    if (alt && !/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/.test(alt)) return res.status(400).json({ ok: false, error: 'อีเมลไม่ถูกต้อง' });
    const r = await fulfill(s, { force: true, origin: `https://${req.headers.host}`, to: alt });
    if (r.sent && alt) { // ส่งเองไปอีเมลอื่น: จดไว้ในออเดอร์ + ขอรีวิวที่อีเมลนั้น 1 วันหลังส่ง (ครั้งเดียว)
      try { const RV = await import('../lib/reviews.js'); const d = await RV.loadReviews(); if (!d.sent[id] && !d.list.some((x) => x.order === id)) { d.follow[id] = { to: alt, at: new Date().toISOString() }; await RV.saveReviews(d); } } catch (e) { console.error('follow', e.message); }
    }
    res.status(r.sent ? 200 : 500).json({ ok: r.sent, to: r.to || null, alt: !!alt, error: r.sent ? null : r.reason });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
