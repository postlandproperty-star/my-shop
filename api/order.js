// หน้าสินค้าเรียกหลังจ่ายเงิน: ตรวจกับ Stripe ว่า session นี้จ่ายจริง แล้วคืนลิงก์ไฟล์ + บันทึกออเดอร์
// GET /api/order?session_id=cs_...  หรือ  ?pi=pi_...&k=<client_secret> (จ่ายด้วย QR บนหน้าร้าน)
import { stripe, sessionToOrder, upsertOrders, configured, piToSession, sbSelect } from '../lib/shop.js';
import { fulfill } from '../lib/fulfill.js';

// หน้า /order "หาออเดอร์ของฉัน": POST ?m=resend {email} ส่งลิงก์ไฟล์ของออเดอร์ที่จ่ายแล้วไปที่อีเมลนั้นอีกรอบ
// ไม่บอกว่าอีเมลนี้มีออเดอร์หรือไม่ (ตอบเหมือนกันทุกกรณี) และส่งซ้ำได้ทุก 10 นาที กันคนอื่นใช้ยิงอีเมลใส่ลูกค้า
async function resend(req, res) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const email = String(body?.email || '').trim().toLowerCase();
  if (!/^[^\s@,()<>]+@[^\s@,()<>]+\.[a-z]{2,}$/i.test(email) || email.length > 120) return res.status(400).json({ ok: false, error: 'กรอกอีเมลให้ถูกต้อง' });
  const cfg = configured();
  if (!cfg.stripe || !cfg.supabase) return res.status(500).json({ ok: false, error: 'ระบบยังไม่พร้อม ทักแชทร้านได้เลย' });
  try {
    const rows = await sbSelect(`orders?status=eq.paid&email=ilike.${encodeURIComponent(email.replace(/[%_*]/g, ''))}&select=session_id,emailed_at&order=created_at.desc&limit=5`);
    const recent = rows.some((r) => r.emailed_at && Date.now() - Date.parse(r.emailed_at) < 10 * 60e3);
    if (!recent) {
      const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
      for (const r of rows) {
        const id = String(r.session_id || '');
        const s = id.startsWith('pi_') ? piToSession(await stripe('GET', `payment_intents/${id}`)) : /^cs_(live|test)_/.test(id) ? await stripe('GET', `checkout/sessions/${id}`) : null;
        if (s && s.payment_status === 'paid') await fulfill(s, { force: true, origin }).catch((e) => console.error('resend', e));
      }
    }
  } catch (e) { console.error(e); }
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.query.m === 'resend') return req.method === 'POST' ? resend(req, res) : res.status(405).json({ ok: false, error: 'POST only' });
  const id = String(req.query.session_id || '');
  const piId = String(req.query.pi || '');
  const isPi = /^pi_[A-Za-z0-9]+$/.test(piId);
  if (!isPi && !/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ ok: false, error: 'bad session id' });
  const cfg = configured();
  if (!cfg.stripe) return res.status(500).json({ ok: false, error: 'stripe not configured' });
  try {
    let s;
    if (isPi) {
      const pi = await stripe('GET', `payment_intents/${piId}`);
      if (!pi.client_secret || pi.client_secret !== String(req.query.k || '')) return res.status(403).json({ ok: false, error: 'bad key' });
      s = piToSession(pi);
    } else s = await stripe('GET', `checkout/sessions/${id}`);
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
