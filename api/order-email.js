// แอดมินกด "ส่งอีเมลซ้ำ": ส่งอีเมลลิงก์ไฟล์ของออเดอร์นี้อีกครั้ง
// GET /api/order-email?session_id=cs_...  (ต้องล็อกอินแอดมิน)
import { stripe, verifyAdmin, configured } from '../lib/shop.js';
import { fulfill } from '../lib/fulfill.js';
import { mailConfigured } from '../lib/mail.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
  const id = String(req.query.session_id || '');
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ ok: false, error: 'bad session id' });
  if (!configured().stripe) return res.status(500).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Stripe' });
  if (!mailConfigured()) return res.status(500).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD บน Vercel' });
  try {
    const s = await stripe('GET', `checkout/sessions/${id}`);
    const r = await fulfill(s, { force: true, origin: `https://${req.headers.host}` });
    res.status(r.sent ? 200 : 500).json({ ok: r.sent, to: r.to || null, error: r.sent ? null : r.reason });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
