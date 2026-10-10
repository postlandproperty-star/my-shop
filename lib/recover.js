// 📧 ตามลูกค้าที่เปิดหน้าจ่ายแต่ยังไม่จ่าย (คุณแดน 10 ต.ค. 69: "ส่งคูปอง 20% ทางอีเมล อายุ 24 ชม. เป็น automation มีแถบสถานะบอก")
// ครอบคลุม QR/บัตรบนหน้าขาย (PaymentIntent) และหน้าบัตร Stripe (Checkout Session) ที่ลูกค้ากรอกอีเมลไว้
// ส่ง 1 ฉบับต่อคน (ไม่ซ้ำอีเมลเดิมภายใน 30 วัน) หลังเปิดหน้าจ่ายเกิน 1 ชม. และยังไม่มีการจ่ายสำเร็จจากอีเมลนั้น
// เรียกจาก cron (10:00 และ 19:05 กทม.) + ทุกชั่วโมงที่ Mac ของคุณแดนเช็คคิวโรงงาน · ส่วนลด/อายุโค้ด/เปิดปิด = คุณแดนตั้งในหลังบ้าน
import nodemailer from 'nodemailer';
import { stripe, configured, loadShop, SB_URL, loadTestEmails } from './shop.js';
import { mailConfigured } from './mail.js';
import { siteUrl } from './site.js';
import { issueRecover, codesInfo } from './rewards.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const hdr = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const baht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;
const WAIT_MIN = 60, LOOK_H = 48, AGAIN_D = 30;
export const RECOVER_DEFAULT = { on: true, pct: 20, hours: 24 };

async function loadState() { const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.recovery&select=data`, { headers: hdr }); const j = r.ok ? await r.json() : []; return j?.[0]?.data || {}; }
async function saveState(d) { await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'recovery', data: d, updated_at: new Date().toISOString() }]) }); }
const norm = (st) => { st.sent = st.sent || {}; st.byEmail = st.byEmail || {}; st.log = st.log || []; st.cfg = { ...RECOVER_DEFAULT, ...(st.cfg || {}) }; return st; };

export async function recoverCfg(patch) {
  const st = norm(await loadState());
  if (patch) {
    if (typeof patch.on === 'boolean') st.cfg.on = patch.on;
    if (patch.pct != null) st.cfg.pct = Math.max(5, Math.min(50, Math.round(Number(patch.pct) || 20)));
    if (patch.hours != null) st.cfg.hours = Math.max(6, Math.min(72, Math.round(Number(patch.hours) || 24)));
    await saveState(st);
  }
  return st.cfg;
}

const thTime = (iso) => new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' น.';
export function buildRecoveryEmail({ shop, product, amount, url, settings, code, pct, expires, course }) {
  const subject = `โค้ดลด ${pct}% สำหรับ ${String(product).slice(0, 60)} (ใช้ได้ถึง ${thTime(expires)})`;
  const after = Math.round(amount * (100 - pct) / 100);
  const btn = `<a href="${esc(url)}" style="display:inline-block;background:#EE4D2D;color:#fff;font-weight:700;text-decoration:none;padding:14px 24px;border-radius:12px;margin:8px 0">ใช้โค้ดแล้วชำระต่อ</a>`;
  const html = `<!doctype html><html lang="th"><body style="margin:0;background:#EDF1F7;font-family:-apple-system,'IBM Plex Sans Thai','Noto Sans Thai',Segoe UI,Roboto,sans-serif;color:#0F1B33">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:16px;padding:28px 24px">
    <p style="font-size:13px;color:#56637D;margin:0 0 6px">${esc(shop)}</p>
    <h1 style="font-size:21px;margin:0 0 12px">คำสั่งซื้อของคุณยังไม่เสร็จ เราเก็บส่วนลดไว้ให้ ${pct}%</h1>
    <p style="margin:0 0 10px">คุณเปิดหน้าชำระเงิน <b>${esc(product)}</b> ไว้แต่ยังไม่ได้จ่าย ใช้โค้ดนี้ลด ${pct}% จาก ${baht(amount)} เหลือประมาณ <b>${baht(after)}</b></p>
    <div style="border:2px dashed #EE4D2D;border-radius:12px;padding:14px;text-align:center;margin:0 0 10px"><div style="font-size:13px;color:#56637D">โค้ดส่วนลด ${pct}% (ใช้ได้ 1 ครั้ง)</div><div style="font-size:28px;font-weight:800;letter-spacing:2px">${esc(code)}</div><div style="font-size:13px;color:#B42318">ใช้ได้ถึง ${thTime(expires)}</div></div>
    <p style="margin:0">${btn}</p>
    <p style="margin:6px 0 0;font-size:14px;color:#334">กดปุ่มแล้วโค้ดจะใส่ให้อัตโนมัติ ${course ? 'จ่ายเสร็จเข้าเรียนได้ทันที' : 'จ่ายเสร็จได้ไฟล์ทางอีเมลทันที'}</p>
    <hr style="border:0;border-top:1px solid #D3DBE8;margin:18px 0">
    <p style="margin:0 0 6px;font-weight:600">จ่ายพร้อมเพย์บนมือถือเครื่องเดียวกัน</p>
    <p style="margin:0;font-size:14px;color:#334">กดค้างที่ QR หรือแคปหน้าจอ แล้วเปิดแอปธนาคาร เลือกสแกนจากรูปภาพ ยอดเงินขึ้นให้อัตโนมัติ</p>
    ${settings.chatLink ? `<p style="font-size:14px;margin:14px 0 0">ติดปัญหาตรงไหน <a href="${esc(settings.chatLink)}" style="color:#2440E8">ทักแชทหาร้าน</a> ตอบเร็วครับ</p>` : ''}
    <p style="font-size:12px;color:#56637D;margin:18px 0 0">อีเมลนี้ส่งครั้งเดียว เกี่ยวกับคำสั่งซื้อที่คุณเริ่มไว้เท่านั้น ถ้าไม่ต้องการแล้ว ไม่ต้องทำอะไร</p>
  </div></div></body></html>`;
  const text = `${shop}\nคำสั่งซื้อของคุณยังไม่เสร็จ เราเก็บส่วนลดไว้ให้ ${pct}%\n${product} ราคา ${baht(amount)} เหลือประมาณ ${baht(after)}\nโค้ด: ${code} (ใช้ได้ถึง ${thTime(expires)})\nใช้โค้ดแล้วชำระต่อ: ${url}\n\nจ่ายพร้อมเพย์บนมือถือ: แคปหน้าจอ QR แล้วเปิดแอปธนาคาร เลือกสแกนจากรูปภาพ\n${settings.chatLink ? `ติดปัญหา ทักแชท: ${settings.chatLink}\n` : ''}\nอีเมลนี้ส่งครั้งเดียว เกี่ยวกับคำสั่งซื้อที่คุณเริ่มไว้เท่านั้น`;
  return { subject, html, text };
}

// คนที่เปิดหน้าจ่ายภายใน 48 ชม. (ล่าสุดต่อ 1 อีเมล) + อีเมลที่จ่ายสำเร็จแล้ว
async function attempts() {
  const since = Math.floor(Date.now() / 1000) - LOOK_H * 3600, paid = new Set(), out = [];
  const [pis, cs] = await Promise.all([stripe('GET', `payment_intents?limit=100&created[gte]=${since}`), stripe('GET', `checkout/sessions?limit=100&created[gte]=${since}`)]);
  for (const pi of pis.data || []) {
    const m = pi.metadata || {}, email = String(m.email || pi.receipt_email || '').trim().toLowerCase();
    if (!email || !['qr', 'card'].includes(m.flow)) continue;
    if (pi.status === 'succeeded') { paid.add(email); continue; }
    if (m.reward && /^BACK/.test(m.reward)) continue; // ใช้โค้ดตามลูกค้าแล้วยังไม่จ่าย ไม่ส่งซ้ำ
    out.push({ key: pi.id, src: m.flow, email, amount: (pi.amount || 0) / 100, product: m.productName || 'สินค้า', slug: m.slug || '', productId: m.productId || '', campaign: m.campaign || '', created: pi.created * 1000 });
  }
  for (const s of cs.data || []) {
    const m = s.metadata || {}, email = String(s.customer_details?.email || s.customer_email || '').trim().toLowerCase();
    if (!email) continue;
    if (s.payment_status === 'paid' || s.status === 'complete') { paid.add(email); continue; }
    out.push({ key: s.id, src: 'session', email, amount: (s.amount_total || 0) / 100, product: m.productName || 'สินค้า', slug: m.slug || '', productId: m.productId || '', campaign: m.campaign || '', created: s.created * 1000 });
  }
  try { // จ่ายแล้วจากตาราง orders (7 วัน) ก็ไม่ตาม
    const r = await fetch(`${SB_URL}/rest/v1/orders?status=eq.paid&created_at=gt.${new Date(Date.now() - 7 * 864e5).toISOString()}&select=email`, { headers: hdr });
    if (r.ok) for (const o of await r.json()) if (o.email) paid.add(String(o.email).toLowerCase());
  } catch (e) {}
  const latest = {}; for (const a of out) if (!latest[a.email] || a.created > latest[a.email].created) latest[a.email] = a;
  return { list: Object.values(latest).sort((a, b) => b.created - a.created), paid };
}

async function staffEmails() { try { const r = await fetch(`${SB_URL}/auth/v1/admin/users?per_page=200`, { headers: hdr }); const j = r.ok ? await r.json() : {}; return new Set((j.users || []).map((u) => String(u.email || '').toLowerCase()).filter(Boolean)); } catch (e) { return new Set(); } }
// ใครจะได้อีเมล (dry) / ส่งเลย · คืนเหตุผลที่ข้ามด้วย (แสดงในหลังบ้าน)
export async function sendRecoveries({ dry = false, force = false } = {}) {
  if (!configured().stripe) return { ok: false, skipped: 'no stripe' };
  const st = norm(await loadState()), cfg = st.cfg;
  if (!cfg.on && !dry) return { ok: true, off: true, sent: 0, results: [] };
  if (!mailConfigured() && !dry) return { ok: false, skipped: 'mail not configured' };
  if (!dry && !force && st.lastRun && Date.now() - Date.parse(st.lastRun) < 20 * 60e3) return { ok: true, sent: 0, results: [], recent: true };
  const [{ list, paid }, ownerTest, staff, shop, site] = await Promise.all([attempts(), loadTestEmails().catch(() => new Set()), staffEmails(), loadShop(), siteUrl()]);
  for (const e of staff) ownerTest.add(e); // บัญชีหลังบ้าน (คุณแดน/ทีม) ทดลองซื้อ ไม่ส่งโค้ด
  const live = new Map((shop.products || []).map((p) => [p.id, p]));
  const results = [], queue = [];
  for (const a of list) {
    const p = live.get(a.productId);
    const why = !EMAIL.test(a.email) ? 'อีเมลไม่ถูกต้อง' : /@example\.(com|org|net)$/.test(a.email) || ownerTest.has(a.email) || /^(test|ทดสอบ)([-_ ]|$)/i.test(a.campaign) || /ทดสอบ|แคลคูลัส/.test(a.product) ? 'ออเดอร์ทดสอบ'
      : a.amount < 30 ? 'ยอดต่ำกว่า ฿30' : paid.has(a.email) ? 'จ่ายแล้ว' : st.sent[a.key] || (st.byEmail[a.email] && Date.now() - Date.parse(st.byEmail[a.email]) < AGAIN_D * 864e5) ? 'ส่งให้อีเมลนี้แล้ว'
      : !p || p.status !== 'published' ? 'สินค้าปิดขาย' : Date.now() - a.created < WAIT_MIN * 60e3 ? 'รอครบ 1 ชม.' : '';
    if (why) { if (why === 'รอครบ 1 ชม.') queue.push({ key: a.key, email: a.email, product: a.product, at: new Date(a.created + WAIT_MIN * 60e3).toISOString() }); continue; }
    if (dry) { queue.push({ key: a.key, email: a.email, product: a.product, at: new Date().toISOString(), now: true }); continue; }
    const rc = await issueRecover(a.email, a.key, cfg.pct, cfg.hours);
    const url = `${site}/p/${encodeURIComponent(p.slug)}?code=${encodeURIComponent(rc.code)}#checkout`;
    const { subject, html, text } = buildRecoveryEmail({ shop: shop.settings.shopName || 'SheetLab', product: a.product, amount: a.amount, url, settings: shop.settings, code: rc.code, pct: rc.pct, expires: rc.expires, course: p.kind === 'course' });
    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') } });
    try { await transport.sendMail({ from: `"${(shop.settings.shopName || 'SheetLab').replace(/"/g, '')}" <${process.env.GMAIL_USER}>`, to: a.email, subject, text, html }); }
    catch (e) { results.push({ key: a.key, ok: false, error: String(e.message || e).slice(0, 120) }); continue; }
    const now = new Date().toISOString(); st.sent[a.key] = now; st.byEmail[a.email] = now;
    st.log.unshift({ key: a.key, src: a.src, email: a.email, product: a.product, amount: a.amount, code: rc.code, pct: rc.pct, sent: now, expires: rc.expires, opened: new Date(a.created).toISOString() });
    results.push({ key: a.key, ok: true, code: rc.code, email: a.email.replace(/^(.).*(@.*)$/, '$1***$2') });
  }
  const cut = Date.now() - 60 * 864e5;
  for (const k of Object.keys(st.sent)) if (Date.parse(st.sent[k]) < cut) delete st.sent[k];
  for (const k of Object.keys(st.byEmail)) if (Date.parse(st.byEmail[k]) < cut) delete st.byEmail[k];
  st.log = st.log.filter((x) => Date.parse(x.sent) > cut).slice(0, 300);
  if (!dry) { st.lastRun = new Date().toISOString(); await saveState(st); }
  return { ok: true, checked: list.length, sent: results.filter((x) => x.ok).length, results, queue };
}

// แถบสถานะในหลังบ้าน: ตั้งค่า + ที่ส่งไปแล้ว (ใช้โค้ดซื้อหรือยัง) + คิวที่จะส่งรอบถัดไป
export async function recoverStatus() {
  const st = norm(await loadState());
  const used = await codesInfo(st.log.map((x) => x.code));
  let paidAmt = {};
  const orders = Object.values(used).map((u) => u.used_order).filter(Boolean);
  if (orders.length) try { const r = await fetch(`${SB_URL}/rest/v1/orders?session_id=in.(${orders.map((o) => encodeURIComponent(o)).join(',')})&select=session_id,amount`, { headers: hdr }); if (r.ok) for (const o of await r.json()) paidAmt[o.session_id] = Number(o.amount) || 0; } catch (e) {}
  const log = st.log.map((x) => { const u = used[x.code] || {}; return { ...x, used_at: u.used_at || null, paid: u.used_order ? paidAmt[u.used_order] ?? null : null }; });
  let queue = [];
  try { queue = (await sendRecoveries({ dry: true })).queue || []; } catch (e) {}
  return { ok: true, cfg: st.cfg, lastRun: st.lastRun || null, log, queue };
}
