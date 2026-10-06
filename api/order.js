// หน้าสินค้าเรียกหลังจ่ายเงิน: ตรวจกับ Stripe ว่า session นี้จ่ายจริง แล้วคืนลิงก์ไฟล์ + บันทึกออเดอร์
// GET /api/order?session_id=cs_...  หรือ  ?pi=pi_...&k=<client_secret> (จ่ายด้วย QR บนหน้าร้าน)
import { stripe, sessionToOrder, upsertOrders, configured, piToSession, sbSelect } from '../lib/shop.js';
import { fulfill } from '../lib/fulfill.js';
import { createQrPayment } from '../lib/shop.js';
import * as V from '../lib/members.js';

// ---------- สมาชิก VIP (/vip) ?m=vip_* ----------
const json = (req) => { let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b || {}; };
const liveQuizzes = async () => ((await sbSelect('shop_state?id=eq.quizzes&select=data'))?.[0]?.data?.list || []).filter((x) => x.status !== 'hidden');
const originOf = (req) => `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
async function vip(req, res, m) {
  const origin = originOf(req), me = V.sessionEmail(req);
  if (m === 'vip_auth') { // ลิงก์จากอีเมล → ตั้งคุกกี้ แล้วกลับหน้า /vip
    const email = V.readToken(req.query.t, 'login'), back = req.query.n === 'account' ? '/account' : '/vip';
    if (!email) { res.writeHead(302, { Location: `${back}?e=link` }); return res.end(); }
    res.writeHead(302, { 'Set-Cookie': V.sessionCookie(email), Location: `${back}?in=1` }); return res.end();
  }
  if (m === 'vip_sync') { // กลับจากหน้าจ่ายบัตรของ Stripe: เปิดสิทธิ์ทันที (ไม่ต้องรอ webhook) แล้วเข้าระบบให้เลย
    const id = String(req.query.session_id || '');
    if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) { res.writeHead(302, { Location: '/vip' }); return res.end(); }
    try { const s = await stripe('GET', `checkout/sessions/${id}`); if (s.payment_status === 'paid' && s.metadata?.vip) { const r = await fulfill(s, { origin }); const email = r.email || String(s.customer_details?.email || s.customer_email || '').toLowerCase(); if (V.okEmail(email)) { res.writeHead(302, { 'Set-Cookie': V.sessionCookie(email), Location: '/vip?welcome=1' }); return res.end(); } } } catch (e) { console.error('vip sync', e); }
    res.writeHead(302, { Location: '/vip?welcome=1' }); return res.end();
  }
  const settings = await V.loadVip();
  const pub = { open: V.vipSellable(settings), monthly: settings.monthly, yearly: settings.yearly, packs: settings.packs };
  if (m === 'vip_me') {
    if (!me) return res.status(200).json({ ok: true, email: null, active: false, settings: pub });
    let mem = await V.getMember(me).catch(() => null); mem = await V.refreshMember(mem);
    const active = V.isActive(mem), review = active ? await V.openMistakeCount(me).catch(() => null) : null;
    return res.status(200).json({ ok: true, email: me, active, review, until: mem?.paid_until || null, plan: mem?.plan || null, card: !!mem?.stripe_sub, cancelAt: mem?.cancel_at || null, settings: pub });
  }
  if (m === 'vip_mock' && req.method === 'GET') { // ข้อสอบเสมือนจริง: ชุดที่ทำได้ + สถานะสมาชิก (ดูรายการได้ทุกคน เริ่มทำได้เฉพาะ VIP)
    const M = await import('../lib/mock.js');
    let active = false; if (me) { try { active = V.isActive(await V.refreshMember(await V.getMember(me))); } catch (e) {} }
    return res.status(200).json({ ok: true, email: me, active, open: pub.open, kinds: M.mockKinds(await liveQuizzes()) });
  }
  if (m === 'vip_acct') { // หน้า "บัญชีของฉัน": เฉพาะเจ้าของอีเมลที่ยืนยันผ่านลิงก์ในอีเมลแล้ว (คุกกี้ลงลายเซ็น)
    if (!me) return res.status(200).json({ ok: true, email: null, settings: pub });
    const A = await import('../lib/account.js');
    return res.status(200).json({ ok: true, ...(await A.accountData(me)), settings: pub });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = json(req);
  if (m === 'course_visit') { if (!me) return res.status(200).json({ ok: false }); try { const C = await import('../lib/courses.js'); await C.visit(me); } catch (e) {} return res.status(200).json({ ok: true }); }
  if (m === 'course_done') { // ทำเครื่องหมายเรียนจบบท (เฉพาะคนที่ยืนยันอีเมลแล้วและมีสิทธิ์เรียน)
    if (!me) return res.status(401).json({ ok: false, error: 'เข้าสู่ระบบก่อน' });
    try { const C = await import('../lib/courses.js'); return res.status(200).json({ ok: true, done: await C.markLesson(me, String(b.course || ''), String(b.lesson || ''), b.on !== false) }); }
    catch (e) { return res.status(400).json({ ok: false, error: String(e.message || e).slice(0, 120) }); }
  }
  if (m === 'vip_login') { // ส่งลิงก์เข้าระบบ (ไม่บอกว่ามีบัญชีหรือไม่ · ส่งได้ทุก 1 นาที)
    const email = String(b.email || '').trim().toLowerCase();
    if (!V.okEmail(email)) return res.status(400).json({ ok: false, error: 'กรอกอีเมลให้ถูกต้อง' });
    try {
      if (!(await V.loginThrottle(email))) return res.status(200).json({ ok: true });
      await V.sendLoginLink(email, origin, b.next === 'account' ? 'account' : '');
    } catch (e) { console.error('vip login', e); return res.status(500).json({ ok: false, error: 'ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง' }); }
    return res.status(200).json({ ok: true });
  }
  if (m === 'vip_logout') { res.setHeader('Set-Cookie', V.clearCookie); return res.status(200).json({ ok: true }); }
  if (m === 'vip_code') { // ใส่รหัส 6 หลักจากอีเมล → เข้าระบบบนเครื่องนี้ (ใช้ในแอปบนหน้าจอโฮมได้)
    const email = String(b.email || '').trim().toLowerCase(), code = String(b.code || '').replace(/\D/g, '');
    if (!V.okEmail(email) || code.length !== 6) return res.status(400).json({ ok: false, error: 'ใส่อีเมลและรหัส 6 หลัก' });
    const r = await V.checkCode(email, code);
    if (!r.ok) return res.status(400).json({ ok: false, error: r.locked ? 'ใส่รหัสผิดหลายครั้ง รอ 15 นาทีแล้วขอรหัสใหม่' : 'รหัสไม่ถูกต้องหรือหมดอายุ ขอรหัสใหม่ได้' });
    res.setHeader('Set-Cookie', V.sessionCookie(email)); return res.status(200).json({ ok: true });
  }
  if (!me) return res.status(401).json({ ok: false, error: 'เข้าสู่ระบบก่อน' });
  if (m === 'vip_buy') { // บัตร: ตัดอัตโนมัติรายเดือน/รายปี ยกเลิกเองได้
    const plan = b.plan === 'yearly' ? 'yearly' : 'monthly', price = settings[plan];
    if (!settings.open || !(price > 0)) return res.status(400).json({ ok: false, error: 'ยังไม่เปิดรับสมาชิกแบบนี้' });
    const name = plan === 'yearly' ? 'SheetLab VIP รายปี' : 'SheetLab VIP รายเดือน', md = { vip: '1', plan, email: me, productId: 'vip', productName: name };
    const s = await stripe('POST', 'checkout/sessions', { mode: 'subscription', customer_email: me, locale: 'th', line_items: [{ quantity: 1, price_data: { currency: 'thb', unit_amount: price * 100, recurring: { interval: plan === 'yearly' ? 'year' : 'month' }, product_data: { name } } }], metadata: md, subscription_data: { metadata: md }, success_url: `${origin}/api/order?m=vip_sync&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/vip` });
    return res.status(200).json({ ok: true, url: s.url });
  }
  if (m === 'vip_qr') { // PromptPay: จ่ายล่วงหน้าเป็นก้อน (ตัดอัตโนมัติไม่ได้)
    const months = [1, 3, 12].includes(Number(b.months)) ? Number(b.months) : 0, price = settings.packs[months] || 0;
    if (!settings.open || !months || !(price > 0)) return res.status(400).json({ ok: false, error: 'ยังไม่เปิดรับสมาชิกแบบนี้' });
    const q = await createQrPayment({ amount: price, email: me, description: `SheetLab VIP ${months} เดือน`, metadata: { vip: '1', months: String(months), productId: 'vip', productName: `SheetLab VIP ${months} เดือน` } });
    return res.status(200).json({ ok: true, ...q });
  }
  if (m === 'vip_cancel') { // ยกเลิกการตัดบัตรรอบถัดไป ใช้ได้จนหมดรอบที่จ่ายแล้ว
    const mem = await V.getMember(me);
    if (!mem?.stripe_sub) return res.status(400).json({ ok: false, error: 'ไม่มีการตัดบัตรอัตโนมัติ' });
    const sub = await stripe('POST', `subscriptions/${mem.stripe_sub}`, { cancel_at_period_end: 'true' });
    const at = sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : mem.paid_until;
    await V.putMember({ email: me, cancel_at: at }); return res.status(200).json({ ok: true, cancelAt: at });
  }
  if (['vip_mark', 'vip_marks', 'vip_mistakes', 'vip_mock'].includes(m)) {
    const mem = await V.refreshMember(await V.getMember(me).catch(() => null));
    if (!V.isActive(mem)) return res.status(403).json({ ok: false, error: 'สำหรับสมาชิก VIP' });
    if (m === 'vip_mark') {
      const quiz = String(b.quiz || ''), q = Number(b.q);
      if (!/^[a-z0-9-]{3,80}$/.test(quiz) || !(q >= 0 && q < 50)) return res.status(400).json({ ok: false });
      await V.markAnswer(me, quiz, q, !!b.ok); return res.status(200).json({ ok: true });
    }
    if (m === 'vip_marks') { // ส่งผลข้อสอบเสมือนจริงทั้งชุด: ผิด/ไม่ตอบ → สมุดจุดพลาด · ถูก → ปิดข้อที่เคยผิด
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 60).filter((it) => /^[a-z0-9-]{3,80}$/.test(String(it?.quiz || '')) && Number(it.q) >= 0 && Number(it.q) < 50);
      const r = await Promise.allSettled(items.map((it) => V.markAnswer(me, String(it.quiz), Number(it.q), !!it.ok)));
      return res.status(200).json({ ok: true, saved: r.filter((x) => x.status === 'fulfilled').length });
    }
    const qz = await liveQuizzes();
    if (m === 'vip_mock') {
      const M = await import('../lib/mock.js'), r = M.pickMock(qz, String(b.k || ''));
      if (!r) return res.status(400).json({ ok: false, error: 'ชุดนี้ยังมีข้อในคลังไม่พอ เลือกชุดอื่นก่อน' });
      return res.status(200).json({ ok: true, ...r });
    }
    return res.status(200).json({ ok: true, ...(await V.listMistakes(me, qz)) });
  }
  return res.status(400).json({ ok: false, error: 'unknown' });
}


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
  if (req.query.m === 'free') { // ขอชีทแจกฟรี: บันทึกอีเมล + ส่งลิงก์เข้าอีเมล + คืนลิงก์ให้ดาวน์โหลดทันที
    if (req.method !== 'POST') return res.status(405).json({ ok: false });
    const F = await import('../lib/free.js'); const b = json(req), f = F.freeBySlug(String(b.slug || '')), email = String(b.email || '').trim().toLowerCase();
    if (!f) return res.status(404).json({ ok: false, error: 'ไม่พบชีทนี้' });
    if (!F.okEmail(email)) return res.status(400).json({ ok: false, error: 'กรอกอีเมลให้ถูกต้อง' });
    const origin = originOf(req);
    try { await F.claimFree(f, email, { src: b.src, origin }); } catch (e) { console.error('free', e); }
    return res.status(200).json({ ok: true, file: `${origin}/free-file/${f.file}` });
  }
  if (/^vip_[a-z]+$/.test(String(req.query.m || ''))) { try { return await vip(req, res, req.query.m); } catch (e) { console.error('vip', e); return res.status(e.missing ? 503 : 500).json({ ok: false, error: e.missing ? 'ระบบสมาชิกยังไม่ได้ตั้งค่าฐานข้อมูล' : 'ระบบขัดข้อง ลองใหม่อีกครั้ง' }); } }
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
      link: items[0] ? items[0].link : '', items, emailed: r.sent || r.reason === 'already sent', pending: r.reason === 'missing link' || !!r.retry,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'verify failed' });
  }
}
