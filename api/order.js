// หน้าสินค้าเรียกหลังจ่ายเงิน: ตรวจกับ Stripe ว่า session นี้จ่ายจริง แล้วคืนลิงก์ไฟล์ + บันทึกออเดอร์
// GET /api/order?session_id=cs_...
import { stripe, sessionToOrder, upsertOrders, configured } from '../lib/shop.js';
import { fulfill } from '../lib/fulfill.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const id = String(req.query.session_id || '');
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ ok: false, error: 'bad session id' });
  const cfg = configured();
  if (!cfg.stripe) return res.status(500).json({ ok: false, error: 'stripe not configured' });
  try {
    const s = await stripe('GET', `checkout/sessions/${id}`);
    const order = sessionToOrder(s);
    if (s.payment_status !== 'paid') {
      if (cfg.supabase) { try { await upsertOrders([order]); } catch (e) { console.error(e); } }
      return res.status(200).json({ ok: true, paid: false, status: s.payment_status });
    }
    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const r = await fulfill(s, { origin }); // บันทึกออเดอร์ + ส่งอีเมลครั้งเดียว + คืนรายการไฟล์
    const items = r.items || [];
    res.status(200).json({
      ok: true, paid: true,
      orderId: s.id.slice(-8).toUpperCase(),
      productId: order.product_id, productName: items.map((it) => it.name).join(' + '),
      amount: order.amount, currency: order.currency, email: order.email,
      link: items[0] ? items[0].link : '', items, emailed: r.sent || r.reason === 'already sent',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'verify failed' });
  }
}
