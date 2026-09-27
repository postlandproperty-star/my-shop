// หลังจ่ายเงินสำเร็จ: หาไฟล์ของทุกรายการในออเดอร์ และส่งอีเมลขอบคุณ+ลิงก์ (ครั้งเดียวต่อออเดอร์)
import { loadShop, loadLinks, upsertOrders, sessionToOrder, sbPatch, sbInsert, configured } from './shop.js';
import { sendOrderEmail, mailConfigured } from './mail.js';

// รายการไฟล์ของ session (สินค้าหลัก + สินค้าคู่)
export async function orderItems(session, shop, links) {
  const m = session.metadata || {};
  const find = (id) => shop.products.find((x) => x.id === id);
  const items = [];
  const main = find(m.productId);
  items.push({ productId: m.productId, name: main ? main.name : m.productName || 'ไฟล์', link: links[m.productId] || '' });
  if (m.bumpProductId) {
    const bp = find(m.bumpProductId);
    items.push({ productId: m.bumpProductId, name: bp ? bp.name : m.bumpProductName || 'ไฟล์', link: links[m.bumpProductId] || '' });
  }
  return items;
}

// ส่งอีเมล: ปกติส่งเฉพาะออเดอร์ที่ยังไม่เคยส่ง (จองสิทธิ์ผ่านคอลัมน์ emailed_at กันส่งซ้ำจาก webhook + หน้าเว็บพร้อมกัน)
// force=true ใช้ตอนแอดมินกด "ส่งอีเมลซ้ำ"
export async function fulfill(session, { force = false, origin = '' } = {}) {
  if (session.payment_status !== 'paid') return { sent: false, reason: 'not paid' };
  const cfg = configured();
  const order = sessionToOrder(session);
  if (cfg.supabase) { try { await upsertOrders([order]); } catch (e) { console.error('upsert', e); } }
  const shop = await loadShop();
  let links = {};
  if (cfg.supabase) { try { links = await loadLinks(); } catch (e) { console.error('links', e); } }
  const items = await orderItems(session, shop, links);
  const to = order.email;
  if (!mailConfigured() || !to) return { sent: false, items, reason: !to ? 'no email' : 'mail not configured' };
  if (!cfg.supabase) return { sent: false, items, reason: 'supabase not configured' };
  const now = new Date().toISOString();
  // จองสิทธิ์: อัปเดตเฉพาะแถวที่ยังไม่ได้ส่ง ถ้าไม่มีแถวถูกอัปเดตแปลว่าส่งไปแล้ว
  const claimed = await sbPatch(`orders?session_id=eq.${encodeURIComponent(session.id)}${force ? '' : '&emailed_at=is.null'}`, { emailed_at: now });
  if (!claimed.length) return { sent: false, items, reason: 'already sent' };
  // ห้องพักทีม: พี่บัญชีแวะมาบอกว่าออเดอร์เข้า (ไม่มีข้อมูลลูกค้า)
  try {
    const baht = Math.round(Number(order.amount) || 0).toLocaleString('th-TH');
    const say = [`ออเดอร์เข้าค่ะ 🎉 ${baht} บาท เก็บเงินเรียบร้อย จดลงบัญชีแล้วนะ`, `ติ๊ง! มีคนซื้อชีทค่ะ ${baht} บาท วันนี้ขนมฟรีคนละชิ้น`, `ขายได้อีกแล้วค่ะ ${baht} บาท ใครทำโพสต์ตัวนี้มารับคำชม`];
    await sbInsert('posts', [{ status: 'note', kind: 'chat', source: 'finance', text: say[Math.floor(Math.random() * say.length)], notes: '{"evt":"order"}' }]);
  } catch (e) {}
  try {
    await sendOrderEmail(to, { orderId: session.id.slice(-8).toUpperCase(), items, amount: order.amount, settings: shop.settings, origin });
    return { sent: true, items, to };
  } catch (e) {
    console.error('mail', e);
    await sbPatch(`orders?session_id=eq.${encodeURIComponent(session.id)}`, { emailed_at: null }).catch(() => {}); // คืนสิทธิ์ให้ลองใหม่ได้
    return { sent: false, items, reason: String(e.message || e) };
  }
}
