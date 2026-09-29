// ปุ่ม "ชำระเงิน" ชี้มาที่นี่: สร้างหน้าจ่ายเงิน Stripe จากราคาในหลังบ้าน แล้วพาลูกค้าไป
// GET /api/checkout?p=<slug>&c=<campaign>
import { loadShop, stripe, configured, htmlError, createQrPayment } from '../lib/shop.js';

// POST /api/checkout?m=qr  JSON {p, bump, c, e} → สร้าง QR PromptPay ให้แสดงบนหน้าร้านเลย (ลูกค้าไม่ต้องออกไปหน้า Stripe)
async function qr(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const email = String(b.e || '').trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(email)) return res.status(400).json({ ok: false, error: 'กรอกอีเมลให้ถูกต้อง (ใช้ส่งไฟล์)' });
  const shop = await loadShop();
  const p = shop.products.find((x) => x.slug === String(b.p || '') && x.status === 'published');
  if (!p || !(Number(p.price) >= 1)) return res.status(404).json({ ok: false, error: 'ไม่พบสินค้า' });
  const bp = b.bump && p.bumpProductId ? shop.products.find((x) => x.id === p.bumpProductId && x.status === 'published') : null;
  const bumpPrice = bp && Number(p.bumpPrice) >= 1 ? Number(p.bumpPrice) : 0;
  const campaign = String(b.c || '').slice(0, 60);
  try {
    const r = await createQrPayment({
      amount: Number(p.price) + bumpPrice, email,
      description: `${p.name}${bumpPrice ? ' + ' + bp.name : ''} (${p.slug}) QR`,
      metadata: { productId: p.id, productName: p.name, slug: p.slug, campaign, bumpProductId: bumpPrice ? bp.id : '', bumpProductName: bumpPrice ? bp.name : '' },
    });
    if (!r.png) return res.status(502).json({ ok: false, error: 'สร้าง QR ไม่สำเร็จ ลองจ่ายผ่านหน้า Stripe แทน' });
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: 'สร้าง QR ไม่สำเร็จ ลองจ่ายผ่านหน้า Stripe แทน' });
  }
}

export default async function handler(req, res) {
  if (req.query.m === 'qr') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false });
    if (!configured().stripe) return res.status(500).json({ ok: false, error: 'ร้านยังไม่พร้อมรับชำระเงิน' });
    return qr(req, res);
  }
  const slug = String(req.query.p || '');
  const campaign = String(req.query.c || '').slice(0, 60);
  // อีเมลที่ลูกค้ากรอกในหน้าร้าน: ใช้ส่งไฟล์ และเตือน 1 ครั้งถ้าจ่ายไม่เสร็จ
  const email = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(String(req.query.e || '').trim()) ? String(req.query.e).trim().toLowerCase() : '';
  if (!configured().stripe) return htmlError(res, 'ร้านยังไม่พร้อมรับชำระเงิน', 'ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY บน Vercel');
  try {
    const shop = await loadShop();
    const p = shop.products.find((x) => x.slug === slug && x.status === 'published');
    if (!p || !(Number(p.price) >= 1)) return htmlError(res, 'ไม่พบสินค้า', 'สินค้านี้อาจถูกปิดการขายแล้ว');
    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const img = (p.images || [])[0];
    // สินค้าคู่ (order bump): ลูกค้าติ๊กเพิ่ม → เพิ่มเป็นรายการที่ 2 ในราคาพิเศษ
    const bp = req.query.bump === '1' && p.bumpProductId ? shop.products.find((x) => x.id === p.bumpProductId && x.status === 'published') : null;
    const bumpPrice = bp && Number(p.bumpPrice) >= 1 ? Number(p.bumpPrice) : 0;
    const items = [{
      quantity: 1,
      price_data: {
        currency: 'thb',
        unit_amount: Math.round(Number(p.price) * 100),
        product_data: Object.assign({ name: p.name, description: (p.headline || '').slice(0, 200) || undefined }, img ? { images: [img] } : {}),
      },
    }];
    if (bumpPrice) items.push({
      quantity: 1,
      price_data: {
        currency: 'thb',
        unit_amount: Math.round(bumpPrice * 100),
        product_data: Object.assign({ name: `${bp.name} (ราคาพิเศษซื้อคู่)` }, (bp.images || [])[0] ? { images: [bp.images[0]] } : {}),
      },
    });
    const base = {
      mode: 'payment',
      locale: 'th',
      line_items: items,
      adaptive_pricing: { enabled: false }, // แสดงเป็นบาทเสมอ PromptPay จะได้ขึ้นทุกครั้ง
      allow_promotion_codes: true,
      success_url: `${origin}/p/${p.slug}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/p/${p.slug}`,
      metadata: { productId: p.id, productName: p.name, slug: p.slug, campaign, bumpProductId: bumpPrice ? bp.id : '', bumpProductName: bumpPrice ? bp.name : '' },
      payment_intent_data: { description: `${p.name}${bumpPrice ? ' + ' + bp.name : ''} (${p.slug})` },
    };
    if (email) {
      base.customer_email = email;
      base.metadata.remind = '1';
      base.expires_at = Math.floor(Date.now() / 1000) + 2 * 3600; // หมดอายุใน 2 ชม. ระบบจะเตือนรอบถัดไป
    }
    let session;
    try { session = await stripe('POST', 'checkout/sessions', email ? { ...base, after_expiration: { recovery: { enabled: true } } } : base); }
    catch (e) { if (!email) throw e; session = await stripe('POST', 'checkout/sessions', base); } // บางบัญชีเปิดลิงก์กู้ตะกร้าไม่ได้ ใช้ลิงก์หน้าสินค้าแทน
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(303, session.url);
  } catch (e) {
    console.error(e);
    htmlError(res, 'เปิดหน้าชำระเงินไม่สำเร็จ', 'ลองใหม่อีกครั้ง หรือทักแชทหาร้าน<br><small style="color:#999">' + String(e.message || e).replace(/[<>]/g, '') + '</small>');
  }
}
