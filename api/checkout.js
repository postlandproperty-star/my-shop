// ปุ่ม "ชำระเงิน" ชี้มาที่นี่: สร้างหน้าจ่ายเงิน Stripe จากราคาในหลังบ้าน แล้วพาลูกค้าไป
// GET /api/checkout?p=<slug>&c=<campaign>
// GET /api/checkout?cart=<id,id,...>&c=<campaign>  ตะกร้า: หลายเล่มจ่ายครั้งเดียว (ออเดอร์เดียว ได้ลิงก์ทุกเล่ม)
import { capiMeta } from '../lib/capi.js';
import { loadShop, stripe, configured, htmlError, createQrPayment, bundlePlan } from '../lib/shop.js';

// POST /api/checkout?m=qr  JSON {p, bump, c, e} → สร้าง QR PromptPay ให้แสดงบนหน้าร้านเลย (ลูกค้าไม่ต้องออกไปหน้า Stripe)
async function qr(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const b = typeof req.body === 'object' && req.body ? req.body : {};
  const email = String(b.e || '').trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(email)) return res.status(400).json({ ok: false, error: 'กรอกอีเมลให้ถูกต้อง (ใช้ส่งไฟล์)' });
  const shop = await loadShop();
  if (b.cart) { // หลายเล่มที่ลูกค้าติ๊กเลือก: QR เดียวยอดรวม ได้ลิงก์ทุกเล่มหลังจ่าย
    const ids = [...new Set((Array.isArray(b.cart) ? b.cart : String(b.cart).split(',')).map((s) => String(s).trim()).filter((s) => /^[A-Za-z0-9_-]{1,60}$/.test(s)))].slice(0, 20);
    const ps = ids.map((id) => shop.products.find((x) => x.id === id && x.status === 'published' && x.type !== 'bundle' && Number(x.price) >= 1)).filter(Boolean);
    if (!ps.length) return res.status(404).json({ ok: false, error: 'ไม่พบสินค้าที่เลือก กลับไปเลือกใหม่ที่หน้าร้าน' });
    let pname = ps.map((p) => p.name).join(' + '); if (pname.length > 400) pname = `${ps[0].name.slice(0, 200)} + อีก ${ps.length - 1} รายการ`;
    try {
      const r = await createQrPayment({ amount: ps.reduce((a, p) => a + Number(p.price), 0), email, description: `ตะกร้า ${ps.length} รายการ: ${pname}`.slice(0, 990) + ' QR',
        metadata: { productId: ps[0].id, productName: pname, slug: ps[0].slug, campaign: String(b.c || '').slice(0, 60), cart: ps.map((p) => p.id).join(','), plan: '', bumpProductId: '', bumpProductName: '', ...capiMeta(req) } });
      if (!r.png) return res.status(502).json({ ok: false, error: 'สร้าง QR ไม่สำเร็จ ลองจ่ายด้วยบัตรแทน' });
      return res.status(200).json({ ok: true, ...r });
    } catch (e) { console.error(e); return res.status(502).json({ ok: false, error: 'สร้าง QR ไม่สำเร็จ ลองจ่ายด้วยบัตรแทน' }); }
  }
  const p = shop.products.find((x) => x.slug === String(b.p || '') && x.status === 'published');
  if (!p || !(Number(p.price) >= 1)) return res.status(404).json({ ok: false, error: 'ไม่พบสินค้า' });
  const plan = p.type === 'bundle' ? bundlePlan(p, String(b.plan || '')) : null;
  if (p.type === 'bundle' && !plan) return res.status(400).json({ ok: false, error: 'ชุดนี้ยังไม่ได้ตั้งราคาแพ็กเกจ' });
  const bp = !plan && b.bump && p.bumpProductId ? shop.products.find((x) => x.id === p.bumpProductId && x.status === 'published') : null;
  const bumpPrice = bp && Number(p.bumpPrice) >= 1 ? Number(p.bumpPrice) : 0;
  const campaign = String(b.c || '').slice(0, 60);
  const pname = plan ? `${p.name} · แพ็กเกจ ${plan.name}` : p.name;
  try {
    const r = await createQrPayment({
      amount: plan ? Number(plan.price) : Number(p.price) + bumpPrice, email,
      description: `${pname}${bumpPrice ? ' + ' + bp.name : ''} (${p.slug}) QR`,
      metadata: { productId: p.id, productName: pname, slug: p.slug, campaign, plan: plan ? plan.key : '', bumpProductId: bumpPrice ? bp.id : '', bumpProductName: bumpPrice ? bp.name : '', ...capiMeta(req) },
    });
    if (!r.png) return res.status(502).json({ ok: false, error: 'สร้าง QR ไม่สำเร็จ ลองจ่ายผ่านหน้า Stripe แทน' });
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: 'สร้าง QR ไม่สำเร็จ ลองจ่ายผ่านหน้า Stripe แทน' });
  }
}

// GET /api/checkout?m=qrimg&pi=&k=  → รูป QR ของออเดอร์นี้จากโดเมนร้าน (ให้ปุ่ม "บันทึกรูป QR" เซฟลงเครื่องได้)
async function qrImage(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const id = String(req.query.pi || '');
  if (!/^pi_[A-Za-z0-9]+$/.test(id)) return res.status(400).end();
  const pi = await stripe('GET', `payment_intents/${id}`);
  if (!pi.client_secret || pi.client_secret !== String(req.query.k || '')) return res.status(403).end();
  const url = pi.next_action?.promptpay_display_qr_code?.image_url_png;
  if (!url) return res.status(404).end();
  const r = await fetch(url);
  if (!r.ok) return res.status(502).end();
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="SheetLab-QR-${Math.round(pi.amount / 100)}.png"`);
  return res.status(200).send(Buffer.from(await r.arrayBuffer()));
}

// ตะกร้า: เฉพาะเล่มเดี่ยวที่เผยแพร่และราคา ≥ 1 (ชุดซื้อจากหน้าชุดเพราะมีแพ็กเกจ) สูงสุด 20 รายการ ราคาจากหลังบ้านเสมอ
async function cartCheckout(req, res) {
  const ids = [...new Set(String(req.query.cart || '').split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{1,60}$/.test(s)))].slice(0, 20);
  const campaign = String(req.query.c || '').slice(0, 60);
  const email = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(String(req.query.e || '').trim()) ? String(req.query.e).trim().toLowerCase() : '';
  const shop = await loadShop();
  const ps = ids.map((id) => shop.products.find((x) => x.id === id && x.status === 'published' && x.type !== 'bundle' && Number(x.price) >= 1)).filter(Boolean);
  if (!ps.length) return htmlError(res, 'ตะกร้าว่าง', 'สินค้าในตะกร้าอาจถูกปิดการขายแล้ว กลับไปเลือกใหม่ที่หน้าร้าน');
  const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
  let pname = ps.map((p) => p.name).join(' + ');
  if (pname.length > 400) pname = `${ps[0].name.slice(0, 200)} + อีก ${ps.length - 1} รายการ`;
  const base = {
    mode: 'payment',
    locale: 'th',
    line_items: ps.map((p) => ({ quantity: 1, price_data: { currency: 'thb', unit_amount: Math.round(Number(p.price) * 100), product_data: Object.assign({ name: p.name, description: (p.headline || '').slice(0, 200) || undefined }, (p.images || [])[0] ? { images: [p.images[0]] } : {}) } })),
    adaptive_pricing: { enabled: false },
    allow_promotion_codes: true,
    success_url: `${origin}/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout`,
    metadata: { productId: ps[0].id, productName: pname, slug: ps[0].slug, campaign, cart: ps.map((p) => p.id).join(','), plan: '', bumpProductId: '', bumpProductName: '', ...capiMeta(req) },
    payment_intent_data: { description: `ตะกร้า ${ps.length} รายการ: ${pname}`.slice(0, 990) },
  };
  if (email) { base.customer_email = email; base.metadata.remind = '1'; base.expires_at = Math.floor(Date.now() / 1000) + 2 * 3600; }
  let session;
  try { session = await stripe('POST', 'checkout/sessions', email ? { ...base, after_expiration: { recovery: { enabled: true } } } : base); }
  catch (e) { if (!email) throw e; session = await stripe('POST', 'checkout/sessions', base); }
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(303, session.url);
}

export default async function handler(req, res) {
  if (req.query.m === 'qrimg') { try { return await qrImage(req, res); } catch (e) { console.error(e); return res.status(500).end(); } }
  if (req.query.m === 'qr') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false });
    if (!configured().stripe) return res.status(500).json({ ok: false, error: 'ร้านยังไม่พร้อมรับชำระเงิน' });
    return qr(req, res);
  }
  if (req.query.cart) {
    if (!configured().stripe) return htmlError(res, 'ร้านยังไม่พร้อมรับชำระเงิน', 'ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY บน Vercel');
    try { return await cartCheckout(req, res); }
    catch (e) { console.error(e); return htmlError(res, 'เปิดหน้าชำระเงินไม่สำเร็จ', 'ลองใหม่อีกครั้ง หรือทักแชทหาร้าน<br><small style="color:#999">' + String(e.message || e).replace(/[<>]/g, '') + '</small>'); }
  }
  const slug = String(req.query.p || '');
  const campaign = String(req.query.c || '').slice(0, 60);
  // ลิงก์จากแอด/ภายนอกที่ชี้มาหน้าบัตร Stripe ตรงๆ (และบอทตรวจลิงก์ของ Facebook) → พาไปส่วนชำระเงินบนหน้าขายของร้าน (QR พร้อมเพย์ขึ้นก่อน)
  // ปุ่ม "จ่ายด้วยบัตร" บนเว็บร้านส่ง card=1 มาเสมอ จึงไปหน้าบัตรได้ตามเดิม
  const sameSite = /^https?:\/\/([^/]*\.)?(sheetlabth\.com|my-shop-lake-ten\.vercel\.app)\//i.test(String(req.headers.referer || '')) || req.headers['sec-fetch-site'] === 'same-origin';
  if (/^[a-z0-9-]{1,80}$/i.test(slug) && req.query.card !== '1' && !sameSite) {
    const q = new URLSearchParams({ buy: '1', ...(campaign ? { utm_source: 'facebook', utm_medium: 'paid', utm_campaign: campaign } : {}), ...(req.query.plan ? { plan: String(req.query.plan).slice(0, 20) } : {}) });
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Location', `/p/${encodeURIComponent(slug)}?${q}`); return res.status(302).end();
  }
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
    const plan = p.type === 'bundle' ? bundlePlan(p, String(req.query.plan || '')) : null;
    if (p.type === 'bundle' && !plan) return htmlError(res, 'ยังไม่เปิดขายชุดนี้', 'ชุดนี้ยังไม่ได้ตั้งราคาแพ็กเกจ');
    const pname = plan ? `${p.name} · แพ็กเกจ ${plan.name}` : p.name;
    const bp = !plan && req.query.bump === '1' && p.bumpProductId ? shop.products.find((x) => x.id === p.bumpProductId && x.status === 'published') : null;
    const bumpPrice = bp && Number(p.bumpPrice) >= 1 ? Number(p.bumpPrice) : 0;
    const items = [{
      quantity: 1,
      price_data: {
        currency: 'thb',
        unit_amount: Math.round(Number(plan ? plan.price : p.price) * 100),
        product_data: Object.assign({ name: pname, description: (p.headline || '').slice(0, 200) || undefined }, img ? { images: [img] } : {}),
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
      metadata: { productId: p.id, productName: pname, slug: p.slug, campaign, plan: plan ? plan.key : '', bumpProductId: bumpPrice ? bp.id : '', bumpProductName: bumpPrice ? bp.name : '', ...capiMeta(req) },
      payment_intent_data: { description: `${pname}${bumpPrice ? ' + ' + bp.name : ''} (${p.slug})` },
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
