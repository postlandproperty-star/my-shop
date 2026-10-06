// หน้า "บัญชีของฉัน" (/account): ลูกค้ายืนยันอีเมลผ่านลิงก์ในอีเมล (ระบบเดียวกับ VIP) แล้วเห็นทุกบริการที่เคยใช้ในที่เดียว
// ชีทที่ซื้อแล้ว (ลิงก์ไฟล์เหมือนในอีเมลยืนยันการซื้อ) · สถานะสมาชิก VIP · ข้อที่ต้องทวน
// อ่านอย่างเดียว ไม่แตะการจ่ายเงินหรือการส่งไฟล์
import { stripe, piToSession, sbSelect, loadShop, loadLinks } from './shop.js';
import { orderItems } from './fulfill.js';
import * as V from './members.js';

const MAX = 12;
async function orderFiles(r, shop, links) {
  const id = String(r.session_id || '');
  const s = id.startsWith('pi_') ? piToSession(await stripe('GET', `payment_intents/${id}`)) : /^cs_(live|test)_/.test(id) ? await stripe('GET', `checkout/sessions/${id}`) : null;
  if (!s || s.payment_status !== 'paid' || s.metadata?.vip) return null; // ค่าสมาชิก VIP แสดงในส่วนสมาชิก ไม่ใช่ไฟล์
  const items = (await orderItems(s, shop, links)).filter((i) => /^https:\/\//.test(i.link || '')).map((i) => ({ name: i.name, link: i.link }));
  return { at: r.created_at, name: r.product_name || '', amount: Number(r.amount) || 0, items };
}

export async function accountData(email) {
  const key = email.replace(/[%_*,()]/g, '');
  const rows = await sbSelect(`orders?status=eq.paid&email=ilike.${encodeURIComponent(key)}&select=session_id,created_at,product_name,amount&order=created_at.desc&limit=${MAX + 1}`).catch(() => []);
  let orders = [];
  if (rows.length) {
    const [shop, links] = await Promise.all([loadShop(), loadLinks().catch(() => ({}))]);
    orders = (await Promise.all(rows.slice(0, MAX).map((r) => orderFiles(r, shop, links).catch((e) => { console.error('account order', e.message); return { at: r.created_at, name: r.product_name || '', amount: Number(r.amount) || 0, items: [], err: true }; })))).filter(Boolean);
  }
  let mem = null; try { mem = await V.refreshMember(await V.getMember(email)); } catch (e) { /* ยังไม่ได้สร้างตารางสมาชิก */ }
  const active = V.isActive(mem);
  let review = null; if (active) { try { review = await V.openMistakeCount(email); } catch (e) {} }
  let courses = [], learn = null; try { const C = await import('./courses.js'); courses = await C.myCourses(email); if (courses.length) learn = await C.learnStats(email); } catch (e) { console.error('courses', e.message); }
  return { email, courses, learn, orders, more: rows.length > MAX, vip: { active, until: mem?.paid_until || null, plan: mem?.plan || null, card: !!mem?.stripe_sub, cancelAt: mem?.cancel_at || null }, review };
}
