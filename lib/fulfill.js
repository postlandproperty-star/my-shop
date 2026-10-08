// หลังจ่ายเงินสำเร็จ: หาไฟล์ของทุกรายการในออเดอร์ และส่งอีเมลขอบคุณ+ลิงก์ (ครั้งเดียวต่อออเดอร์)
import { loadShop, loadLinks, upsertOrders, sessionToOrder, sbPatch, sbInsert, configured, loadTestEmails } from './shop.js';
import { sendOrderEmail, mailConfigured } from './mail.js';
import { sendPurchase } from './capi.js';
import { useReward } from './rewards.js';
import { activateVip, sendWelcome } from './members.js';

// รายการไฟล์ของ session (สินค้าหลัก + สินค้าคู่ หรือทุกเล่มในตะกร้า)
// ไฟล์ที่ลูกค้าได้ = สินค้าที่ซื้อ + ของแถมที่คุณแดนเลือกไว้ (p.bonusIds สินค้าเดี่ยวที่มีลิงก์ไฟล์) ของทุกชิ้นที่ซื้อ (คุณแดน 8 ต.ค. 69)
export async function orderItems(session, shop, links) {
  const items = await baseItems(session, shop, links), m = session.metadata || {}, find = (id) => shop.products.find((x) => x.id === id);
  const bought = m.cart ? String(m.cart).split(',').filter(Boolean) : [m.productId, m.bumpProductId].filter(Boolean), have = new Set(items.map((i) => i.productId));
  for (const id of bought) for (const bid of (find(id) || {}).bonusIds || []) {
    const b = find(bid); if (!b || b.type === 'bundle' || b.kind === 'course' || have.has(bid)) continue;
    have.add(bid); items.push({ productId: bid, name: `${b.name} (ของแถม)`, link: links[bid] || '', bonus: true });
  }
  return items;
}
async function baseItems(session, shop, links) {
  const m = session.metadata || {};
  const find = (id) => shop.products.find((x) => x.id === id);
  const items = [];
  if (m.cart) { // ตะกร้า: ทุกเล่มที่ลูกค้าใส่ (metadata.cart = รหัสสินค้าคั่นด้วยจุลภาค)
    const plans = Object.fromEntries(String(m.cartPlans || '').split(',').filter(Boolean).map((x) => x.split(':')));
    const seen = new Set(), add = (it) => { if (seen.has(it.productId)) return; seen.add(it.productId); items.push(it); };
    for (const id of String(m.cart).split(',').filter(Boolean)) {
      const p = find(id);
      if (p && p.type === 'bundle') { // ชุดในตะกร้า: ไฟล์ทุกเล่มในชุด + ไฟล์เพิ่มของแพ็กเกจ
        for (const bid of p.items || []) { const b = find(bid); add({ productId: bid, name: b ? b.name : 'ไฟล์', link: links[bid] || '' }); }
        const pk = plans[id] || p.planDefault || '';
        for (const line of String(links[`${p.id}@${pk}`] || '').split('\n')) { const i = line.lastIndexOf('|'); if (i < 1) continue; const name = line.slice(0, i).trim(), link = line.slice(i + 1).trim(); if (name && /^https:\/\//.test(link)) add({ productId: `${p.id}@${pk}`, name, link }); }
      } else add({ productId: id, name: p ? p.name : 'ไฟล์', link: links[id] || '' });
    }
    return items;
  }
  const main = find(m.productId);
  if (main && main.type === 'bundle') { // ชุด: ไฟล์ทุกเล่มในชุด + ของแถมตามแพ็กเกจ (บรรทัด "ชื่อ | ลิงก์" เก็บเป็นความลับใน links["<id>@<แพ็กเกจ>"])
    for (const bid of main.items || []) { const b = find(bid); items.push({ productId: bid, name: b ? b.name : 'ไฟล์', link: links[bid] || '' }); }
    for (const line of String(links[`${main.id}@${m.plan || main.planDefault || ''}`] || '').split('\n')) {
      const i = line.lastIndexOf('|'); if (i < 1) continue;
      const name = line.slice(0, i).trim(), link = line.slice(i + 1).trim();
      if (name && /^https:\/\//.test(link)) items.push({ productId: `${main.id}@${m.plan || ''}`, name, link });
    }
    return items;
  }
  items.push({ productId: m.productId, name: main ? main.name : m.productName || 'ไฟล์', link: links[m.productId] || '' });
  if (m.bumpProductId) {
    const bp = find(m.bumpProductId);
    items.push({ productId: m.bumpProductId, name: bp ? bp.name : m.bumpProductName || 'ไฟล์', link: links[m.bumpProductId] || '' });
  }
  return items;
}

// ส่งอีเมล: ปกติส่งเฉพาะออเดอร์ที่ยังไม่เคยส่ง (จองสิทธิ์ผ่านคอลัมน์ emailed_at กันส่งซ้ำจาก webhook + หน้าเว็บพร้อมกัน)
// force=true ใช้ตอนแอดมินกด "ส่งอีเมลซ้ำ"
export async function fulfill(session, { force = false, origin = '', to: altTo = '' } = {}) { // altTo = คุณแดนส่งเองไปอีเมลอื่นที่ลูกค้าขอ (ไม่เปลี่ยนอีเมลในออเดอร์)
  if (session.payment_status !== 'paid') return { sent: false, reason: 'not paid' };
  const cfg = configured();
  const order = sessionToOrder(session);
  // บันทึกออเดอร์ต้องสำเร็จก่อน (ไม่งั้นจองสิทธิ์ส่งอีเมลไม่ได้ และหน้า "หาออเดอร์" หาไม่เจอ) ลอง 2 ครั้ง ไม่ได้ให้ Stripe ส่ง webhook มาใหม่
  if (cfg.supabase) {
    let saved = false;
    for (let i = 0; i < 2 && !saved; i++) { try { await upsertOrders([order]); saved = true; } catch (e) { console.error('upsert', e); } }
    if (!saved) return { sent: false, items: [], reason: 'save failed', retry: true };
  }
  if (session.metadata?.vip) { // สมาชิก VIP: เปิดสิทธิ์แทนการส่งไฟล์ · จองสิทธิ์ผ่าน emailed_at ให้ทำครั้งเดียวต่อออเดอร์ (ส่งซ้ำ/เก็บตกเรียกซ้ำได้ปลอดภัย)
    const email = String(order.email || '').toLowerCase();
    if (!email || !cfg.supabase) return { sent: false, items: [], reason: 'no email' };
    const claimed = await sbPatch(`orders?session_id=eq.${encodeURIComponent(session.id)}&emailed_at=is.null`, { emailed_at: new Date().toISOString() });
    if (!claimed.length) return { sent: false, items: [], reason: 'already sent', vip: true, email };
    try {
      const r = await activateVip(session, email);
      try { await sendWelcome(email, r.until, origin || 'https://sheetlabth.com'); } catch (e) { console.error('vip mail', e); }
      return { sent: true, items: [], vip: true, email, until: r.until };
    } catch (e) {
      console.error('vip', e);
      await sbPatch(`orders?session_id=eq.${encodeURIComponent(session.id)}`, { emailed_at: null }).catch(() => {});
      return { sent: false, items: [], reason: 'vip failed', retry: true };
    }
  }
  const shop = await loadShop();
  let links = {};
  if (cfg.supabase) { try { links = await loadLinks(); } catch (e) { console.error('links', e); return { sent: false, items: [], reason: 'links failed', retry: true }; } }
  const items = (await orderItems(session, shop, links)).filter((i) => !i.bonus || /^https:\/\//.test(String(i.link || ''))); // ของแถมที่ยังไม่มีลิงก์ไฟล์: ข้ามไป ไม่ให้อีเมลมีลิงก์ว่าง
  if (session.metadata?.reward) { try { await useReward(session.metadata.reward, session.id); } catch (e) { console.error('reward', e); } } // โค้ดขอบคุณคนรีวิว ใช้ได้ครั้งเดียว
  const to = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(altTo || '').trim()) ? String(altTo).trim() : order.email;
  // แจ้ง Facebook ว่าซื้อแล้ว (Conversions API) ข้ามออเดอร์ทดลองของคุณแดน · Facebook ตัดซ้ำด้วย event_id ถ้าเรียกหลายรอบ
  try {
    const test = (await loadTestEmails().catch(() => new Set())).has(String(to || '').toLowerCase());
    if (!test && Number(order.amount) >= 30) {
      const m = session.metadata || {};
      const r = await sendPurchase({ pixelId: shop.settings?.pixelId, eventId: session.id, value: order.amount, currency: order.currency || 'THB', email: to, contentIds: items.map((i) => i.productId), contentName: order.product_name || '', meta: m, url: `${origin || 'https://sheetlabth.com'}/p/${m.slug || ''}`, time: session.created ? session.created * 1000 : Date.now() });
      if (!r.ok && !r.skipped) console.error('capi', r.error);
    }
  } catch (e) { console.error('capi', e); }
  if (!mailConfigured() || !to) return { sent: false, items, reason: !to ? 'no email' : 'mail not configured' };
  if (!cfg.supabase) return { sent: false, items, reason: 'supabase not configured' };
  // เล่มไหนยังไม่มีลิงก์ไฟล์: ยังไม่ส่งอีเมล (กันลูกค้าได้อีเมลว่าง) ออเดอร์ค้าง "ยังไม่ได้ส่ง" ให้เช็คสุขภาพร้านแจ้งคุณแดน แล้วรอบเก็บตกส่งให้เองเมื่อใส่ลิงก์แล้ว
  if (!force && (!items.length || items.some((it) => !it.bonus && !/^https:\/\//.test(String(it.link || ''))))) return { sent: false, items, reason: 'missing link' };
  const now = new Date().toISOString();
  // จองสิทธิ์: อัปเดตเฉพาะแถวที่ยังไม่ได้ส่ง ถ้าไม่มีแถวถูกอัปเดตแปลว่าส่งไปแล้ว
  const claimed = await sbPatch(`orders?session_id=eq.${encodeURIComponent(session.id)}${force ? '' : '&emailed_at=is.null'}`, { emailed_at: now });
  if (!claimed.length) return { sent: false, items, reason: 'already sent' };
  // ห้องพักทีม: พี่บัญชีแวะมาบอกว่าออเดอร์เข้า (ไม่มีข้อมูลลูกค้า) ยกเว้นเจ้าของทดลองซื้อเอง ทีมไม่ต้องรู้
  const ownerTest = (await loadTestEmails().catch(() => new Set())).has(String(to).toLowerCase());
  if (!ownerTest && !force) try {
    const baht = Math.round(Number(order.amount) || 0).toLocaleString('th-TH');
    const say = [`ออเดอร์เข้าค่ะ 🎉 ${baht} บาท เก็บเงินเรียบร้อย จดลงบัญชีแล้วนะ`, `ติ๊ง! มีคนซื้อชีทค่ะ ${baht} บาท วันนี้ขนมฟรีคนละชิ้น`, `ขายได้อีกแล้วค่ะ ${baht} บาท ใครทำโพสต์ตัวนี้มารับคำชม`];
    await sbInsert('posts', [{ status: 'note', kind: 'chat', source: 'finance', text: say[Math.floor(Math.random() * say.length)], notes: '{"evt":"order"}' }]);
  } catch (e) {}
  try {
    await sendOrderEmail(to, { orderId: session.id.slice(-8).toUpperCase(), items, amount: order.amount, settings: shop.settings, origin, title: order.product_name || '' });
    return { sent: true, items, to };
  } catch (e) {
    console.error('mail', e);
    await sbPatch(`orders?session_id=eq.${encodeURIComponent(session.id)}`, { emailed_at: null }).catch(() => {}); // คืนสิทธิ์ให้ลองใหม่ได้
    return { sent: false, items, reason: String(e.message || e) };
  }
}
