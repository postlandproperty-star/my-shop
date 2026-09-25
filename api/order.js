// หน้าสินค้าเรียกหลังจ่ายเงิน: ตรวจกับ Stripe ว่า session นี้จ่ายจริง แล้วคืนลิงก์ไฟล์ + บันทึกออเดอร์
// GET /api/order?session_id=cs_...
import { loadShop, loadLinks, stripe, upsertOrders, sessionToOrder, configured } from '../lib/shop.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const id = String(req.query.session_id || '');
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ ok: false, error: 'bad session id' });
  const cfg = configured();
  if (!cfg.stripe) return res.status(500).json({ ok: false, error: 'stripe not configured' });
  try {
    const s = await stripe('GET', `checkout/sessions/${id}`);
    const order = sessionToOrder(s);
    if (cfg.supabase) { try { await upsertOrders([order]); } catch (e) { console.error(e); } }
    if (s.payment_status !== 'paid') return res.status(200).json({ ok: true, paid: false, status: s.payment_status });
    const shop = await loadShop();
    const p = shop.products.find((x) => x.id === order.product_id) || null;
    let link = '';
    if (cfg.supabase) { try { link = (await loadLinks())[order.product_id] || ''; } catch (e) { console.error(e); } }
    res.status(200).json({
      ok: true, paid: true,
      orderId: s.id.slice(-8).toUpperCase(),
      productId: order.product_id, productName: p ? p.name : order.product_name,
      amount: order.amount, currency: order.currency, email: order.email,
      link, sampleLink: p ? p.sampleLink || '' : '',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'verify failed' });
  }
}
