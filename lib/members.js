// สมาชิก Pro: เข้าระบบด้วยลิงก์ทางอีเมล (ไม่มีรหัสผ่าน) · จ่ายบัตรตัดอัตโนมัติรายเดือน/รายปี (Stripe subscription) หรือ PromptPay จ่ายล่วงหน้า 1/3/12 เดือน
// ราคาเป็นของคุณแดน ตั้งในหลังบ้าน (shop_state id=vip) ยังไม่เปิดหรือยังไม่ใส่ราคา = หน้า /vip ขึ้น "เปิดรับสมาชิกเร็วๆ นี้"
// ตาราง members / member_mistakes สร้างครั้งเดียวด้วย SQL (VIP_SQL ด้านล่าง หลังบ้านแสดงให้คัดลอก) ปิด RLS ไว้ เข้าได้เฉพาะเซิร์ฟเวอร์
import { createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { SB_URL, stripe } from './shop.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const KEY = createHmac('sha256', SECRET || 'dev').update('sheetlab-vip-v1').digest();
const H = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const DAY = 864e5;

export const VIP_SQL = `create table if not exists members (email text primary key, status text default 'none', plan text, paid_until timestamptz, stripe_customer text, stripe_sub text, cancel_at timestamptz, login_sent_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists member_mistakes (email text not null, quiz_slug text not null, q int not null, wrong int default 1, last_wrong_at timestamptz default now(), fixed_at timestamptz, primary key (email, quiz_slug, q));
alter table members enable row level security;
alter table member_mistakes enable row level security;
create table if not exists member_writing (id uuid primary key default gen_random_uuid(), email text not null, task text, prompt text, essay text, result jsonb, band numeric, via text, created_at timestamptz default now());
create index if not exists member_writing_email_at on member_writing (email, created_at desc);
alter table member_writing enable row level security;
create table if not exists member_vocab (email text primary key, data jsonb not null default '{}', updated_at timestamptz default now());
alter table member_vocab enable row level security;
alter table members add column if not exists marketing boolean, add column if not exists marketing_at timestamptz, add column if not exists last_login_at timestamptz;`;

export const okEmail = (e) => typeof e === 'string' && e.length <= 120 && /^[^\s@,()<>|]+@[^\s@,()<>|]+\.[a-z]{2,}$/i.test(e);
export const isActive = (m) => !!(m && m.paid_until && Date.parse(m.paid_until) > Date.now());

// ---------- โทเคนลงลายเซ็น (ลิงก์เข้าระบบ 30 นาที / คุกกี้ 180 วัน) ----------
export function signToken(email, ms, purpose) {
  const p = Buffer.from(`${String(email).toLowerCase()}|${Date.now() + ms}|${purpose}`).toString('base64url');
  return `${p}.${createHmac('sha256', KEY).update(p).digest('base64url')}`;
}
export function readToken(t, purpose) {
  const [p, s] = String(t || '').split('.');
  if (!p || !s) return null;
  const a = Buffer.from(s), b = Buffer.from(createHmac('sha256', KEY).update(p).digest('base64url'));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [email, exp, pur] = Buffer.from(p, 'base64url').toString().split('|');
  return pur === purpose && Number(exp) > Date.now() && okEmail(email) ? email : null;
}
export const sessionEmail = (req) => { const m = String(req.headers.cookie || '').match(/(?:^|;\s*)slvip=([^;]+)/); return m ? readToken(decodeURIComponent(m[1]), 'session') : null; };
// slin=1 (อ่านได้จาก JS ไม่มีข้อมูลลับ) บอกหัวเว็บว่าเข้าระบบแล้ว → ปุ่ม "บัญชีของฉัน" · ไม่มี = ปุ่ม "สมัครสมาชิก" (คุณแดน 14 ต.ค. 69)
export const IN_COOKIE = `slin=1; Path=/; Max-Age=${180 * 86400}; Secure; SameSite=Lax`;
export const sessionCookie = (email) => [`slvip=${encodeURIComponent(signToken(email, 180 * DAY, 'session'))}; Path=/; Max-Age=${180 * 86400}; HttpOnly; Secure; SameSite=Lax`, IN_COOKIE];
export const clearCookie = ['slvip=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax', 'slin=; Path=/; Max-Age=0; Secure; SameSite=Lax'];

// ---------- ราคา/การเปิดรับ (คุณแดนตั้ง) ----------
// ข้อความหน้า /vip ที่คุณแดนแก้เองได้ในแท็บ 👑 สมาชิก (ว่าง = ใช้ค่าตั้งต้นนี้)
export const VIP_PAGE = {
  title: 'สมาชิก SheetLab', sub: 'สมัครฟรีด้วยอีเมลหรือบัญชี Google · ฝึกคำศัพท์ครบทุกบท ข้อสอบเสมือนจริง และระบบจำข้อที่พลาดพาทวนจนแม่น',
  perks: [
    { t: 'ตรวจ IELTS Writing ด้วย AI: คะแนน 4 เกณฑ์ + จุดแก้อธิบายภาษาไทย', free: true, vip: 'yes' },
    { t: 'ตรวจ IELTS Speaking ด้วย AI: อัดเสียงแล้วได้คะแนน + คำที่ออกเสียงผิด', free: true, vip: 'yes' },
    { t: 'คำศัพท์ 3000 คำที่ต้องรู้ ครบทุกบท A1–B2 พร้อมรูป เสียง และระบบทวน', free: false, vip: 'yes' },
    { t: 'บันทึกความคืบหน้าข้ามเครื่อง + อีเมลเตือนทวนคำศัพท์', free: true, vip: 'yes' },
    { t: 'บทความสรุปและแบบทดสอบในคลังทั้งหมด', free: true, vip: 'yes' },
    { t: 'สมุดจุดพลาด: เก็บทุกข้อที่ตอบผิดไว้ให้ทวนจนแม่น', free: false, vip: 'yes' },
    { t: 'ข้อสอบเสมือนจริงจับเวลา พร้อมคะแนนและเฉลยทุกข้อ', free: false, vip: 'yes' },
    { t: 'ข้อสอบใหม่ทุกสัปดาห์ พร้อมเฉลยภาษาไทย', free: true, vip: 'yes' },
  ],
  faq: [
    { q: 'ต้องตั้งรหัสผ่านไหม', a: 'ไม่ต้อง ใส่อีเมลแล้วกดลิงก์ที่ส่งไปในอีเมลเพื่อเข้าสู่ระบบ' },
    { q: 'ยกเลิกยังไง', a: 'แบบบัตร กดยกเลิกในหน้านี้ได้เลย ใช้ได้จนหมดรอบที่จ่ายแล้ว แบบ PromptPay ไม่มีการตัดเงินต่อ หมดอายุเอง' },
    { q: 'ใช้กับชีทที่ซื้อแยกไหม', a: 'Pro เป็นระบบฝึกบนเว็บ ส่วนชีท PDF ซื้อแยกในร้านค้า' },
  ],
};
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
function normPage(p) {
  if (!p || typeof p !== 'object') return JSON.parse(JSON.stringify(VIP_PAGE));
  const perks = (Array.isArray(p.perks) ? p.perks : []).map((x) => ({ t: txt(x?.t, 120), free: !!x?.free, vip: ['yes', 'soon', 'no'].includes(x?.vip) ? x.vip : 'yes' })).filter((x) => x.t).slice(0, 12);
  const faq = (Array.isArray(p.faq) ? p.faq : []).map((x) => ({ q: txt(x?.q, 150), a: txt(x?.a, 600) })).filter((x) => x.q && x.a).slice(0, 10);
  return { title: txt(p.title, 60) || VIP_PAGE.title, sub: txt(p.sub, 220) || VIP_PAGE.sub, perks: perks.length ? perks : VIP_PAGE.perks, faq };
}
export function normVip(d = {}) {
  const n = (x) => Math.max(0, Math.min(99999, Math.round(Number(x) || 0)));
  return { open: !!d.open, monthly: n(d.monthly), yearly: n(d.yearly), life: n(d.life), packs: { 1: n(d.packs?.[1]), 3: n(d.packs?.[3]), 12: n(d.packs?.[12]) }, page: normPage(d.page) };
}
export const vipSellable = (v) => v.open && (v.monthly > 0 || v.yearly > 0 || v.life > 0 || Object.values(v.packs).some((x) => x > 0));
// สมาชิกระบบเดียว (คุณแดน 14 ต.ค. 69): สมาชิกฟรี (อีเมล/Google) กับ Pro (จ่ายเงิน) · ยังไม่เปิดขาย Pro = "ราคาสมาชิก 0 บาท" สมาชิกฟรีใช้ทุกอย่างที่ไม่ใช้ AI ได้
// คุณแดน 14 ต.ค. 69 "ใช้ฟรี 100% ไปก่อน ครบ 100 คนค่อยคุยเรื่องเงิน": รวมตรวจ Writing/Speaking ด้วย AI (โควตา WRITE_CAP/เดือนเท่า Pro) · พอตั้งราคาและเปิดขาย ส่วน Pro กลับมาล็อกเอง
export const freeForMembers = (v) => !vipSellable(v);
export async function memberAccess(email, v) {
  if (!email) return { email: null, vip: false, unlocked: false, free: freeForMembers(v) };
  let mem = null; try { mem = await refreshMember(await getMember(email)); } catch (e) {}
  const vip = isActive(mem), { isAdminEmail } = await import('./shop.js');
  return { email, vip, mem, unlocked: vip || freeForMembers(v) || isAdminEmail(email), free: freeForMembers(v) };
}
// Google Sign-In (Client ID ไม่ใช่ความลับ · โปรเจกต์ Google Cloud "SheetLab Login" สร้าง 14 ต.ค. 69)
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '582450482047-b4j1oj5q2ofbk702hqkcrbdl5n7tg93p.apps.googleusercontent.com';
export async function verifyGoogle(credential) {
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(String(credential || ''))) return null;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`); if (!r.ok) return null;
  const t = await r.json();
  if (t.aud !== GOOGLE_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) || String(t.email_verified) !== 'true' || Number(t.exp) * 1000 < Date.now()) return null;
  const email = String(t.email || '').toLowerCase(); return okEmail(email) ? email : null;
}
export async function loadVip() {
  try { const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.vip&select=data`, { headers: H }); const j = r.ok ? await r.json() : []; return normVip(j?.[0]?.data); } catch (e) { return normVip(); }
}
export async function saveVip(d) {
  const v = normVip(d);
  await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'vip', data: v, updated_at: new Date().toISOString() }]) });
  return v;
}

// ---------- ตารางสมาชิก ----------
async function rest(path, opt = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) { const t = await r.text(); const e = new Error(`members ${r.status}: ${t.slice(0, 160)}`); e.missing = /does not exist|PGRST205|42P01/.test(t); throw e; }
  return r.status === 204 ? null : r.json().catch(() => null);
}
export async function getMember(email) { const r = await rest(`members?email=eq.${encodeURIComponent(email)}&select=*`); return r?.[0] || null; }
export async function putMember(row) {
  await rest('members?on_conflict=email', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ ...row, email: String(row.email).toLowerCase(), updated_at: new Date().toISOString() }]) });
}
// ขอลิงก์เข้าระบบได้ทุก 1 นาทีต่ออีเมล (กันคนอื่นใช้ยิงอีเมลใส่ลูกค้า) · ยังไม่ได้สร้างตารางสมาชิก = จำเวลาไว้ใน shop_state แทน
export async function loginThrottle(email) {
  const now = Date.now();
  try {
    const cur = await getMember(email);
    if (cur?.login_sent_at && now - Date.parse(cur.login_sent_at) < 60e3) return false;
    await putMember({ email, login_sent_at: new Date(now).toISOString() }); return true;
  } catch (e) { if (!e.missing) throw e; }
  const m = (await rest('shop_state?id=eq.login_rl&select=data'))?.[0]?.data || {};
  if (m[email] && now - m[email] < 60e3) return false;
  const keep = Object.fromEntries(Object.entries(m).filter(([, t]) => now - t < 3600e3)); keep[email] = now;
  await rest('shop_state?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'login_rl', data: keep, updated_at: new Date(now).toISOString() }]) });
  return true;
}
export async function openMistakeCount(email) { return ((await rest(`member_mistakes?email=eq.${encodeURIComponent(email)}&fixed_at=is.null&select=q&limit=1000`)) || []).length; }
export async function tablesReady() { try { await rest('members?select=email&limit=1'); await rest('member_mistakes?select=email&limit=1'); return true; } catch (e) { return false; } }
export async function memberStats() {
  const rows = await rest('members?select=email,status,plan,paid_until,stripe_sub,cancel_at,created_at&order=updated_at.desc&limit=500');
  const act = rows.filter(isActive);
  return { total: rows.filter((m) => m.paid_until).length, active: act.length, card: act.filter((m) => m.stripe_sub && !m.cancel_at).length, leaving: act.filter((m) => m.cancel_at).length, recent: act.slice(0, 20).map((m) => ({ email: m.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2'), plan: m.plan, until: m.paid_until, cancel: !!m.cancel_at })) };
}

// บัตรตัดอัตโนมัติ: ไม่ต้องรอ webhook ทุกรอบ หมดรอบเมื่อไหร่ถาม Stripe ว่าตัดผ่านไหม
const periodEnd = (s) => Number(s.current_period_end || s.items?.data?.[0]?.current_period_end || 0);
export async function refreshMember(m) {
  if (!m || !m.stripe_sub || isActive(m)) return m;
  try {
    const s = await stripe('GET', `subscriptions/${m.stripe_sub}`);
    const end = periodEnd(s);
    if (['active', 'trialing', 'past_due'].includes(s.status) && end * 1000 > Date.now()) m = { ...m, status: 'active', paid_until: new Date(end * 1000).toISOString() };
    else m = { ...m, status: s.status };
    await putMember({ email: m.email, status: m.status, paid_until: m.paid_until });
  } catch (e) { console.error('vip refresh', e.message); }
  return m;
}

// จ่ายสำเร็จ (เรียกจาก fulfill หลังจองสิทธิ์ออเดอร์แล้ว ทำครั้งเดียวต่อออเดอร์)
export async function activateVip(session, email) {
  const md = session.metadata || {};
  const cur = await getMember(email).catch(() => null);
  if (session.mode === 'subscription' && session.subscription) {
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const s = await stripe('GET', `subscriptions/${subId}`);
    const end = periodEnd(s) * 1000 || Date.now() + (md.plan === 'yearly' ? 365 : 31) * DAY;
    await putMember({ email, status: 'active', plan: md.plan || 'monthly', paid_until: new Date(end).toISOString(), stripe_sub: subId, stripe_customer: typeof session.customer === 'string' ? session.customer : session.customer?.id || null, cancel_at: null });
    return { until: new Date(end).toISOString() };
  }
  if (md.months === 'life') { const until = '2099-12-31T00:00:00.000Z'; await putMember({ email, status: 'active', plan: 'lifetime', paid_until: until }); return { until }; } // ตลอดชีพ จ่ายครั้งเดียว
  const months = [1, 3, 12].includes(Number(md.months)) ? Number(md.months) : 1; // PromptPay จ่ายล่วงหน้า ต่อจากวันหมดอายุเดิม
  const base = new Date(Math.max(Date.now(), Date.parse(cur?.paid_until || 0) || 0));
  base.setMonth(base.getMonth() + months);
  await putMember({ email, status: 'active', plan: `prepaid-${months}`, paid_until: base.toISOString() });
  return { until: base.toISOString() };
}

// คุณแดนให้สิทธิ์เอง (ทดลองระบบ / ของขวัญ / ชดเชย) ต่อจากวันหมดอายุเดิม ไม่เก็บเงิน
export async function grantVip(email, days) {
  const cur = await getMember(email).catch(() => null);
  const until = new Date(Math.max(Date.now(), Date.parse(cur?.paid_until || 0) || 0) + days * DAY).toISOString();
  await putMember({ email, status: 'active', plan: cur?.stripe_sub && isActive(cur) ? cur.plan : 'gift', paid_until: until });
  return { until };
}

// ---------- อีเมล ----------
const mailer = () => nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') } });
const box = (title, body, href, label) => `<!doctype html><html lang="th"><body style="margin:0;background:#EDF1F7;font-family:-apple-system,'IBM Plex Sans Thai','Noto Sans Thai',Segoe UI,Roboto,sans-serif;color:#0F1B33"><div style="max-width:520px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:16px;padding:26px 22px"><p style="font-size:13px;color:#56637D;margin:0 0 6px">SheetLab</p><h1 style="font-size:21px;margin:0 0 12px">${title}</h1>${body}<p style="margin:18px 0"><a href="${href}" style="display:inline-block;background:#2440E8;color:#fff;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:12px">${label}</a></p><p style="font-size:12.5px;color:#56637D;margin:0">ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร อีเมลนี้ไม่มีผลกับบัญชีของคุณ</p></div></div></body></html>`;
// รหัส 6 หลักในอีเมล ใช้แทนการกดลิงก์ได้ (แอปบนหน้าจอโฮมของ iPhone แยกคุกกี้จาก Safari กดลิงก์ในอีเมลแล้วจะไปเข้าระบบใน Safari แทน)
// ไม่ต้องเก็บรหัสในฐานข้อมูล: คิดจากอีเมล + ช่วงเวลา 10 นาที (ใช้ได้ช่วงปัจจุบันและก่อนหน้า = 10–20 นาที) · ลองผิดได้ 5 ครั้ง / 15 นาที
const otpWin = (t) => Math.floor(t / 600e3);
export function loginCode(email, win = otpWin(Date.now())) { const h = createHmac('sha256', KEY).update(`${String(email).toLowerCase()}|${win}|otp`).digest(); return String(h.readUInt32BE(0) % 1e6).padStart(6, '0'); }
export async function checkCode(email, code) {
  const now = Date.now(), st = (await rest('shop_state?id=eq.otp_tries&select=data'))?.[0]?.data || {}, cur = st[email] && now - st[email].t < 900e3 ? st[email] : null;
  if (cur && cur.n >= 5) return { ok: false, locked: true };
  const w = otpWin(now), c = Buffer.from(String(code)), ok = c.length === 6 && [w, w - 1].some((x) => timingSafeEqual(Buffer.from(loginCode(email, x)), c));
  const keep = Object.fromEntries(Object.entries(st).filter(([, v]) => now - v.t < 900e3));
  if (ok) delete keep[email]; else keep[email] = { n: (cur ? cur.n : 0) + 1, t: cur ? cur.t : now };
  if (!ok || st[email]) await rest('shop_state?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'otp_tries', data: keep, updated_at: new Date(now).toISOString() }]) });
  return { ok };
}
// next = 'account' → กลับไปหน้า "บัญชีของฉัน" หลังกดลิงก์ (ไม่ใส่ = หน้า /vip)
export async function sendLoginLink(email, origin, next = '') {
  const url = `${origin}/api/order?m=vip_auth&t=${encodeURIComponent(signToken(email, 30 * 60e3, 'login'))}${next === 'account' ? '&n=account' : ''}`, code = loginCode(email);
  await mailer().sendMail({ from: `"SheetLab" <${process.env.GMAIL_USER}>`, to: email, subject: `รหัสเข้าสู่ระบบ SheetLab: ${code}`, text: `รหัสเข้าสู่ระบบ SheetLab: ${code} (ใช้ได้ 10 นาที)\nหรือกดลิงก์นี้ (ใช้ได้ 30 นาที)\n${url}`, html: box('เข้าสู่ระบบ SheetLab', `<p style="margin:0 0 6px">ใส่รหัสนี้ในหน้าเว็บหรือแอป SheetLab (ใช้ได้ 10 นาที)</p><p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 14px">${code}</p><p style="margin:0">หรือกดปุ่มด้านล่างเพื่อเข้าสู่ระบบบนเครื่องนี้ (ใช้ได้ 30 นาที)</p>`, url, 'เข้าสู่ระบบ') });
}
export async function sendWelcome(email, until, origin) {
  const d = new Date(until).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
  const url = `${origin}/api/order?m=vip_auth&t=${encodeURIComponent(signToken(email, 7 * DAY, 'login'))}`;
  await mailer().sendMail({ from: `"SheetLab" <${process.env.GMAIL_USER}>`, to: email, subject: 'ยินดีต้อนรับสู่ SheetLab Pro 🎉', text: `สมาชิก Pro ของคุณใช้ได้ถึง ${d}\nเข้าสู่ระบบ: ${url}`, html: box('ยินดีต้อนรับสู่ SheetLab Pro 🎉', `<p style="margin:0 0 6px">สมาชิกของคุณใช้ได้ถึง <b>${d}</b></p><p style="margin:0">ทำแบบทดสอบในคลังข้อสอบได้เลย ข้อที่ตอบผิดจะถูกเก็บลงสมุดจุดพลาดให้ทวนอัตโนมัติ</p>`, url, 'เข้าสู่ระบบ Pro') });
}

// ---------- สมุดจุดพลาด ----------
export async function markAnswer(email, quiz, q, ok) {
  const now = new Date().toISOString();
  if (ok) { await rest(`member_mistakes?email=eq.${encodeURIComponent(email)}&quiz_slug=eq.${encodeURIComponent(quiz)}&q=eq.${q}&fixed_at=is.null`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ fixed_at: now }) }); return; }
  const old = (await rest(`member_mistakes?email=eq.${encodeURIComponent(email)}&quiz_slug=eq.${encodeURIComponent(quiz)}&q=eq.${q}&select=wrong`))?.[0];
  await rest('member_mistakes?on_conflict=email,quiz_slug,q', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ email, quiz_slug: quiz, q, wrong: (old?.wrong || 0) + 1, last_wrong_at: now, fixed_at: null }]) });
}
export async function listMistakes(email, quizzes) {
  const rows = await rest(`member_mistakes?email=eq.${encodeURIComponent(email)}&select=quiz_slug,q,wrong,last_wrong_at,fixed_at&order=last_wrong_at.desc&limit=300`);
  const bySlug = Object.fromEntries(quizzes.map((x) => [x.slug, x]));
  const open = [], fixed = rows.filter((r) => r.fixed_at).length;
  for (const r of rows.filter((x) => !x.fixed_at)) {
    const qz = bySlug[r.quiz_slug], x = qz?.questions?.[r.q];
    if (!x || x.type === 'type') continue;
    open.push({ quiz: r.quiz_slug, title: qz.title, cat: qz.cat || '', i: r.q, q: x.q, choices: x.choices, answer: x.answer, explain: x.explain, wrong: r.wrong });
  }
  return { open, fixed };
}

// ✍️ ตรวจ IELTS Writing (lib/writing.js) · เก็บประวัติในตาราง member_writing · โควตา: สมาชิก writeCap ครั้ง/เดือน · ยังไม่เป็นสมาชิก ทดลองฟรี writeFree ครั้ง (ต่ออีเมล)
export const WRITE_CAP = 30, WRITE_FREE = 1;
const enc = (e) => encodeURIComponent(String(e).toLowerCase());
// kind 'speak' = งาน Speaking (task ขึ้นต้น sp:) · อย่างอื่น = Writing · โควตาแยกกัน
const kindQ = (kind) => (kind === 'speak' ? '&task=like.sp:*' : '&task=not.like.sp:*');
export async function writingUsed(email, sinceIso, kind) { const q = sinceIso ? `&created_at=gte.${encodeURIComponent(sinceIso)}` : ''; return ((await rest(`member_writing?email=eq.${enc(email)}${q}${kindQ(kind)}&select=id&limit=500`)) || []).length; }
export async function saveWriting(row) { const r = await rest('member_writing', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ ...row, email: String(row.email).toLowerCase() }]) }); return r?.[0] || null; }
export async function listWriting(email, kind) { return (await rest(`member_writing?email=eq.${enc(email)}${kindQ(kind)}&select=id,task,band,created_at&order=created_at.desc&limit=20`)) || []; }
export async function getWriting(email, id) { if (!/^[0-9a-f-]{36}$/.test(String(id))) return null; return ((await rest(`member_writing?email=eq.${enc(email)}&id=eq.${String(id)}&select=*`)) || [])[0] || null; }

// 📚 ความคืบหน้าคำศัพท์ (/vocab) แถวเดียวต่ออีเมล · ตรวจรูปแบบด้วย cleanProgress (lib/vocab.js) ก่อนเก็บ
export async function getVocab(email) { return ((await rest(`member_vocab?email=eq.${enc(email)}&select=data`)) || [])[0]?.data || null; }
export async function saveVocab(email, data) { await rest('member_vocab?on_conflict=email', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ email: String(email).toLowerCase(), data, updated_at: new Date().toISOString() }]) }); }

// เข้าระบบสำเร็จ (รหัส 6 หลัก / ลิงก์ / Google) = เป็นสมาชิก · optin = ติ๊กยินยอมรับอีเมลเตือนทวน เคล็ดลับ โปรโมชัน (PDPA: แยกต่างหาก ไม่ติ๊กไว้ก่อน)
export async function noteLogin(email, optin) {
  const now = new Date().toISOString();
  try { await putMember({ email, last_login_at: now, ...(optin ? { marketing: true, marketing_at: now } : {}) }); } catch (e) { console.error('noteLogin', e.message); }
}
export async function unsubscribe(email) { await putMember({ email, marketing: false }); }
export const unsubLink = (email, origin) => `${origin}/api/order?m=vip_unsub&t=${encodeURIComponent(signToken(email, 400 * DAY, 'unsub'))}`;
// 📚 อีเมลเตือนทวนคำศัพท์ (เฉพาะคนที่ยินยอม · มีลิงก์ยกเลิกทุกฉบับ)
export async function sendVocabReminder(email, due, streak, origin) {
  const url = `${origin}/vocab/review`;
  await mailer().sendMail({ from: `"SheetLab" <${process.env.GMAIL_USER}>`, to: email, subject: `วันนี้มีคำศัพท์ต้องทวน ${due} คำ 📚`, text: `วันนี้มีคำศัพท์ถึงรอบทวน ${due} คำ ใช้เวลาไม่ถึง 5 นาที\n${url}\n\nไม่ต้องการรับอีเมลนี้: ${unsubLink(email, origin)}`,
    html: box(`วันนี้มีคำศัพท์ต้องทวน ${due} คำ`, `<p style="margin:0 0 6px">ทวนตอนที่กำลังจะลืม จำได้นานกว่าท่องใหม่หลายเท่า ใช้เวลาไม่ถึง 5 นาที</p>${streak > 1 ? `<p style="margin:0">ฝึกต่อเนื่องมา ${streak} วันแล้ว อย่าให้ขาดนะ 🔥</p>` : ''}`, url, 'ทวนคำวันนี้').replace('ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร อีเมลนี้ไม่มีผลกับบัญชีของคุณ', `ได้รับอีเมลนี้เพราะคุณเลือกรับการแจ้งเตือนจาก SheetLab · <a href="${unsubLink(email, origin)}" style="color:#56637D">ยกเลิกการรับอีเมล</a>`) });
}
export async function remindTargets() { return (await rest('members?marketing=eq.true&select=email&limit=2000')) || []; }
export async function vocabRows(emails) { if (!emails.length) return []; return (await rest(`member_vocab?email=in.(${emails.map((e) => `"${String(e).replace(/"/g, '')}"`).join(',')})&select=email,data`)) || []; }

// 👥 จัดการสมาชิก (หลังบ้าน เฉพาะคุณแดน): รายชื่อสมาชิกที่ยืนยันอีเมลแล้ว + ความคืบหน้าคำศัพท์ (ฟังก์ชัน member_vocab_summary ใน DB นับให้ ไม่ดึงข้อมูลทั้งก้อน)
export async function memberDirectory() {
  const [rows, voc] = await Promise.all([rest('members?select=email,plan,paid_until,stripe_sub,cancel_at,created_at,last_login_at,login_sent_at,marketing&order=created_at.desc&limit=3000'), rest('rpc/member_vocab_summary', { method: 'POST', body: '{}' }).catch(() => [])]);
  const VB = Object.fromEntries((voc || []).map((v) => [v.email, v])), today = Math.floor((Date.now() + 252e5) / 864e5), mid = (today * 864e5) - 252e5;
  const list = (rows || []).filter((m) => m.last_login_at || m.paid_until || VB[m.email]).map((m) => {
    const v = VB[m.email] || {}, act = isActive(m);
    return { email: m.email, joined: m.created_at, last: m.last_login_at || null, optin: !!m.marketing, tier: act ? (m.plan === 'gift' ? 'gift' : 'vip') : 'free', until: act ? m.paid_until : null, plan: m.plan || null, words: v.words || 0, units: v.units || 0, lastDay: v.last_day || 0 };
  });
  const sum = { total: list.length, today: list.filter((m) => Date.parse(m.joined) >= mid).length, week: list.filter((m) => Date.parse(m.joined) >= mid - 6 * 864e5).length, optin: list.filter((m) => m.optin).length,
    learners: list.filter((m) => m.lastDay >= today - 6).length, vip: list.filter((m) => m.tier === 'vip').length, gift: list.filter((m) => m.tier === 'gift').length,
    pending: (rows || []).filter((m) => !m.last_login_at && !m.paid_until && !VB[m.email]).length, goal: 100 };
  return { list, sum };
}
