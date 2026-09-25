// แอดมินกด "ดึงออเดอร์จาก Stripe": ไล่ Checkout Session ล่าสุดจาก Stripe แล้วบันทึกลงตาราง orders
// GET /api/orders-sync  (ต้องแนบ Authorization: Bearer <Supabase access token ของแอดมิน>)
import { stripe, upsertOrders, sessionToOrder, verifyAdmin, configured } from '../lib/shop.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const cfg = configured();
  if (!cfg.stripe || !cfg.supabase) return res.status(500).json({ ok: false, error: 'ยังไม่ได้ตั้งค่าคีย์บน Vercel', cfg });
  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
  try {
    const rows = [];
    let starting_after;
    for (let page = 0; page < 5; page++) { // สูงสุด 500 รายการล่าสุด
      const r = await stripe('GET', `checkout/sessions?limit=100${starting_after ? `&starting_after=${starting_after}` : ''}`);
      for (const s of r.data) if (s.mode === 'payment') rows.push(sessionToOrder(s));
      if (!r.has_more) break;
      starting_after = r.data[r.data.length - 1].id;
    }
    await upsertOrders(rows);
    res.status(200).json({ ok: true, synced: rows.length, paid: rows.filter((o) => o.status === 'paid').length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
