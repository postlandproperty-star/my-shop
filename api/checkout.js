// ปุ่ม "ชำระเงิน" ชี้มาที่นี่: สร้างหน้าจ่ายเงิน Stripe จากราคาในหลังบ้าน แล้วพาลูกค้าไป
// GET /api/checkout?p=<slug>&c=<campaign>
import { loadShop, stripe, configured, htmlError } from '../lib/shop.js';

export default async function handler(req, res) {
  const slug = String(req.query.p || '');
  const campaign = String(req.query.c || '').slice(0, 60);
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
    const session = await stripe('POST', 'checkout/sessions', {
      mode: 'payment',
      locale: 'th',
      line_items: items,
      adaptive_pricing: { enabled: false }, // แสดงเป็นบาทเสมอ PromptPay จะได้ขึ้นทุกครั้ง
      allow_promotion_codes: true,
      success_url: `${origin}/p/${p.slug}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/p/${p.slug}`,
      metadata: { productId: p.id, productName: p.name, slug: p.slug, campaign, bumpProductId: bumpPrice ? bp.id : '', bumpProductName: bumpPrice ? bp.name : '' },
      payment_intent_data: { description: `${p.name}${bumpPrice ? ' + ' + bp.name : ''} (${p.slug})` },
    });
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(303, session.url);
  } catch (e) {
    console.error(e);
    htmlError(res, 'เปิดหน้าชำระเงินไม่สำเร็จ', 'ลองใหม่อีกครั้ง หรือทักแชทหาร้าน<br><small style="color:#999">' + String(e.message || e).replace(/[<>]/g, '') + '</small>');
  }
}
