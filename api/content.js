// ระบบคอนเทนต์ของเพจ: คิวโพสต์ในตาราง posts
//   ?action=shop     (key)   ข้อมูลร้าน + โพสต์ล่าสุด สำหรับ "นักเขียน" ใช้ร่างโพสต์
//   ?action=drafts   (key, POST) นักเขียนส่งร่างเข้า [{text,image_url,link_url,scheduled_at,kind}] → status draft
//   ?action=report   (key)   ตัวเลขสัปดาห์ (ยอดขาย/ออเดอร์/แคมเปญ) สำหรับ "ผู้จัดการ"
//   ?action=note     (key, POST) ผู้จัดการ/นักวิเคราะห์ส่งรายงาน {text,kind:'report'|'ads'}
//   ?action=board    (key)   กระดานทีม: แผนสัปดาห์ล่าสุดของผู้จัดการ + รายงานล่าสุดของแต่ละคน (14 วัน) ทุกคนอ่านก่อนเริ่มงาน
//   ?action=images   (key)   โพสต์ที่ยังไม่ขึ้นเพจพร้อมรูป สำหรับ "นักออกแบบ" ตรวจรูป
//   ?action=setimage (key, POST {id, image_url, note}) เปลี่ยนรูปโพสต์ (เก็บสำเนาถาวร) + บันทึกหมายเหตุ
//   ?action=review   (key)   ร่างที่รอตรวจ (เต็ม) สำหรับ "ผู้จัดการ"
//   ?action=decide   (key, POST) ผู้จัดการตัดสิน {id, decision:'approve'|'reject'|'owner', reason, text?}
//                    owner = เรื่องสำคัญ ส่งให้เจ้าของกดอนุมัติเอง (status needs_owner)
//   ?action=factory / factory_order / factory_claim / factory_uploadurl / factory_done / factory_fail / factory_cancel (key) โรงงานผลิตชีท: ใบสั่งจากพี่ต้น ไฟล์เก็บใน Storage
//   ?action=publish  (cron หรือแอดมิน) โพสต์ที่อนุมัติแล้วและถึงเวลา → ขึ้นเพจ Facebook
//   ?action=publish&id=<uuid> (แอดมิน) โพสต์รายการเดียวทันที
// key = header x-content-key ตรงกับ CONTENT_API_KEY บน Vercel (ใช้เฉพาะรูทีนอัตโนมัติ)
import { loadShop, verifyAdmin, sbPatch, stripe, piToSession, loadTestEmails } from '../lib/shop.js';
import nodemailer from 'nodemailer';
import { fulfill } from '../lib/fulfill.js';
import { loadFb, publishToPage, fbGet } from '../lib/fb.js';
import { siteUrl } from '../lib/site.js';
import { checkPolicy, policyMark, policyState, POLICY_BOARD } from '../lib/policy.js';
import { sendRecoveries } from '../lib/recover.js';
import { loadThreads, publishToThreads, threadsConnected, refreshIfNeeded, thGet } from '../lib/threads.js';

const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const CONTENT_KEY = process.env.CONTENT_API_KEY || '';

// ลูกค้าที่กรอกอีเมลแล้วแต่ยังไม่จ่าย (ขอ QR แล้วไม่สแกน / กรอกอีเมลในหน้า Stripe แล้วออก) — เห็นเฉพาะคุณแดน ทีมไม่เห็นอีเมล
const LEAD_TPL = {
  subject: 'ออเดอร์ {สินค้า} ของคุณยังรอชำระอยู่',
  body: 'สวัสดีครับ\n\nเห็นว่าคุณสนใจ {สินค้า} ({ราคา}) แต่ยังชำระเงินไม่เสร็จ ถ้ายังสนใจอยู่ กดลิงก์นี้เพื่อสแกนจ่ายได้เลย ได้ไฟล์ทันทีหลังจ่าย\n{ลิงก์}\n\nถ้าติดปัญหาตอนจ่าย ตอบกลับอีเมลนี้ได้เลยครับ\nSheetLab',
};
async function listLeads() {
  const since = Math.floor(Date.now() / 1000) - 30 * 86400;
  const [test, paidRows, shop] = await Promise.all([loadTestEmails().catch(() => new Set()), sb(`orders?status=eq.paid&email=not.is.null&select=email&limit=2000`), loadShop()]);
  const paid = new Set(paidRows.map((o) => String(o.email).toLowerCase()));
  const rows = [];
  let after;
  for (let i = 0; i < 3; i++) { // QR บนหน้าร้าน
    const r = await stripe('GET', `payment_intents?limit=100&created[gte]=${since}${after ? `&starting_after=${after}` : ''}`);
    for (const pi of r.data || []) {
      if (pi.metadata?.flow !== 'qr') continue;
      if (pi.status === 'succeeded') { paid.add(String(pi.metadata.email || '').toLowerCase()); continue; }
      rows.push({ email: pi.metadata.email, slug: pi.metadata.slug, product: pi.metadata.productName, amount: pi.amount / 100, at: pi.created, via: 'qr' });
    }
    if (!r.has_more) break; after = r.data[r.data.length - 1].id;
  }
  const cs = await stripe('GET', `checkout/sessions?limit=100&created[gte]=${since}`); // หน้า Stripe: เฉพาะคนที่กรอกอีเมลไว้
  for (const x of cs.data || []) {
    const em = x.customer_details?.email || x.customer_email;
    if (!em) continue;
    if (x.payment_status === 'paid') { paid.add(em.toLowerCase()); continue; }
    rows.push({ email: em, slug: x.metadata?.slug, product: x.metadata?.productName, amount: (x.amount_total || 0) / 100, at: x.created, via: 'stripe' });
  }
  const live = new Set((shop.products || []).filter((p) => p.status === 'published').map((p) => p.slug));
  const by = {};
  for (const r of rows) {
    const e = String(r.email || '').trim().toLowerCase();
    if (!e || test.has(e) || paid.has(e) || /@example\.(com|org|net)$/.test(e) || !live.has(r.slug)) continue;
    if (!by[e] || by[e].at < r.at) by[e] = { ...r, email: e, attempts: (by[e]?.attempts || 0) + 1 }; else by[e].attempts++;
  }
  return Object.values(by).sort((a, b) => b.at - a.at).map((r) => ({ ...r, at: new Date(r.at * 1000).toISOString() }));
}
// ส่งอีเมลเตือนตามเทมเพลต ให้รายชื่อที่ส่งมา (เฉพาะคนที่อยู่ใน listLeads จริง) บันทึกลง private.leadMail / leadLog
async function sendLeadMails(targets, subject, body, by) {
  const row = await sb('shop_state?id=eq.private&select=data'); const data = row?.[0]?.data || {};
  const sent = data.leadMail || {}; const site = await siteUrl(); const shop = await loadShop();
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') } });
  const out = [];
  for (const l of targets) {
    if (sent[l.email] && Date.now() - Date.parse(sent[l.email]) < 7 * 864e5) { out.push({ email: l.email, ok: false, reason: 'ส่งไปแล้วใน 7 วัน' }); continue; }
    const text = fillTpl(body, l, site) + '\n\n— อีเมลนี้ส่งครั้งเดียวเพราะคุณกรอกอีเมลไว้ตอนสั่งซื้อ ถ้าไม่ต้องการแล้วไม่ต้องทำอะไร';
    try { await transport.sendMail({ from: `"${(shop.settings.shopName || 'SheetLab').replace(/"/g, '')}" <${process.env.GMAIL_USER}>`, to: l.email, subject: fillTpl(subject, l, site), text }); sent[l.email] = new Date().toISOString(); out.push({ email: l.email, ok: true }); }
    catch (e) { out.push({ email: l.email, ok: false, reason: String(e.message || e).slice(0, 120) }); }
  }
  const okN = out.filter((x) => x.ok).length;
  data.leadMail = sent; data.leadBy = { ...(data.leadBy || {}) }; for (const x of out) if (x.ok) data.leadBy[x.email] = by;
  if (okN) data.leadLog = [{ at: new Date().toISOString(), sent: okN, by }, ...(data.leadLog || [])].slice(0, 30);
  await sb('shop_state?id=eq.private', { method: 'PATCH', body: { data, updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
  return out;
}
// น้องคอมส่งเตือนเองทุกรอบ cron/publish: ค้างจ่ายมาแล้ว ≥1 ชม. ไม่เกิน 3 วัน คนละครั้ง (คุณแดนปิดได้ที่ห้องเอกสาร)
async function autoLeadMails() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return { ok: false, reason: 'gmail not set' };
  const row = await sb('shop_state?id=eq.private&select=data'); const data = row?.[0]?.data || {};
  if (data.leadAuto === false) return { ok: true, off: true };
  const tpl = data.mailTemplate || LEAD_TPL; const sent = data.leadMail || {};
  const now = Date.now();
  const due = (await listLeads()).filter((l) => !sent[l.email] && now - Date.parse(l.at) >= 3600e3 && now - Date.parse(l.at) <= 3 * 864e5);
  if (!due.length) return { ok: true, sent: 0 };
  const out = await sendLeadMails(due, tpl.subject, tpl.body, 'community');
  const n = out.filter((x) => x.ok).length;
  if (n) { try { await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'chat', source: 'community', text: `ส่งอีเมลเตือนลูกค้าที่ค้างจ่ายไปแล้ว ${n} คนค่ะ ใช้ข้อความที่ร่างไว้ คนละครั้ง ถ้าใครจ่ายเข้ามาจะแจ้งอีกทีนะคะ`, notes: '{"evt":"leadmail"}' }], prefer: 'return=minimal' }); } catch (e) {} }
  return { ok: true, sent: n };
}
const fillTpl = (t, l, site) => String(t).replace(/\{สินค้า\}/g, l.product || 'ชีทของเรา').replace(/\{ราคา\}/g, '฿' + Number(l.amount || 0).toLocaleString('th-TH')).replace(/\{ลิงก์\}/g, `${site}/p/${l.slug}`);

// ลูกค้าจ่าย QR บนหน้าร้านแล้วปิดหน้าก่อนระบบเห็น: เก็บตกทุกรอบ cron/publish (fulfill ส่งอีเมลครั้งเดียวต่อออเดอร์)
async function sweepQrPayments() {
  const since = Math.floor(Date.now() / 1000) - 3 * 86400;
  const r = await stripe('GET', `payment_intents?limit=100&created[gte]=${since}`);
  const paid = (r.data || []).filter((pi) => pi.status === 'succeeded' && pi.metadata?.flow === 'qr');
  const origin = await siteUrl();
  const out = [];
  for (const pi of paid) { const f = await fulfill(piToSession(pi), { origin }); out.push({ id: pi.id.slice(-8), sent: f.sent, reason: f.reason || null }); }
  return { ok: true, paid: paid.length, sent: out.filter((x) => x.sent).length, items: out };
}

// ออเดอร์ทดสอบ (สินค้าร่าง "ทดสอบ"/แคลคูลัส ราคา 11 ที่ใช้ลองจ่ายเงิน) ไม่นับในรายงานยอดขาย
// ถ้าส่งรายการสินค้ามา นับเฉพาะออเดอร์ของสินค้าที่เปิดขายจริง (published)
// emails = อีเมลที่เจ้าของใช้ทดลองซื้อ (เก็บใน shop_state private.testEmails ไม่อยู่บนหน้าเว็บ)
function testOrder(products, emails = []) {
  const live = products ? new Set(products.filter((p) => p.status === 'published').map((p) => p.id)) : null;
  const mine = new Set((emails || []).map((e) => String(e).trim().toLowerCase()));
  return (o) => /ทดสอบ|แคลคูลัส/.test(o.product_name || '') || Number(o.amount) < 30 || !!(live && o.product_id && !live.has(o.product_id))
    || mine.has(String(o.email || '').trim().toLowerCase());
}
async function sb(path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`supabase ${path}: ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}


// โรงงานผลิตชีท: ใบสั่งเก็บใน shop_state id=factory (data.jobs) ไฟล์เก็บใน Supabase Storage bucket product-images/factory/
const FACTORY_FIELDS = ['title', 'category', 'level', 'format', 'amount', 'audience', 'chapters', 'pages', 'price', 'purpose', 'notes'];
// ประเภทงานโรงงาน: pdf (ชีท PDF ค่าเริ่มต้น) | notion (Notion template สร้างใน Notion ของคุณแดน คุณแดนกด Publish เอง)
const jobKind = (b) => (b.kind === 'notion' || /notion/i.test(String(b.category || b.cat || '') + ' ' + String(b.title || b.t || ''))) ? 'notion' : 'pdf';
const isNotionUrl = (u) => /^https:\/\/([a-z0-9-]+\.)?(notion\.so|notion\.site|app\.notion\.com)\//i.test(String(u || ''));
async function loadJobs() { const rows = await sb('shop_state?id=eq.factory&select=data'); return rows?.[0]?.data?.jobs || []; }
// ชุดหนังสือและผลิตอัตโนมัติของโรงงาน (คุณแดนตั้งจากแท็บโรงงาน) · shop_state id=factory_cfg
async function loadFacCfg() { const r = await sb('shop_state?id=eq.factory_cfg&select=data'); const d = r?.[0]?.data || {}; return { sets: Array.isArray(d.sets) ? d.sets : null, auto: { on: false, per_week: 1, sets: [], ...(d.auto || {}) }, updated_at: d.updated_at || null }; }
// ผลิตอัตโนมัติ: ถ้าเปิดไว้และคิวว่าง หยิบเล่มถัดไปในชุดที่เลือก (ยังไม่มีในร้าน ยังไม่เคยสั่ง) เข้าคิว ไม่ใช้ AI
async function autoFillFactory(jobs) {
  const cfg = await loadFacCfg();
  if (!cfg.auto.on || !cfg.sets) return null;
  if (jobs.some((j) => ['queued', 'producing'].includes(j.status))) return null;
  const week = Date.now() - 7 * 864e5;
  if (jobs.filter((j) => j.ordered_by === 'auto' && Date.parse(j.created_at || 0) >= week).length >= Math.min(4, Math.max(1, Number(cfg.auto.per_week) || 1))) return null;
  const shop = await loadShop().catch(() => ({ products: [] }));
  const names = shop.products.map((p) => String(p.name || '').toLowerCase());
  const used = (t) => jobs.some((j) => !['cancelled', 'failed'].includes(j.status) && String(j.title || '').slice(0, 24) === String(t).slice(0, 24));
  for (const set of cfg.sets.filter((x) => (cfg.auto.sets || []).includes(x.id))) {
    for (const b of set.books || []) {
      const key = String(b.match || String(b.t).slice(0, 18)).toLowerCase();
      if (!b.t || names.some((n) => n.includes(key)) || used(b.t)) continue;
      const { randomUUID } = await import('node:crypto');
      const job = { id: randomUUID(), status: 'queued', created_at: new Date().toISOString(), ordered_by: 'auto', kind: jobKind(b), title: String(b.t).slice(0, 200), category: String(b.cat || '').slice(0, 80), pages: Number(b.pages) || undefined, price: Number(b.price) || 0, notes: String(b.notes || '').slice(0, 1000), purpose: `ผลิตอัตโนมัติ: เล่มในชุด ${set.name} (ชีทขาย ผลิตเสร็จแล้วรอคุณแดนอนุมัติลงขาย)` };
      jobs.push(job); await saveJobs(jobs);
      await logNote('factory', `ผลิตอัตโนมัติหยิบเล่มถัดไปเข้าคิว: ${job.title} (ชุด ${set.name})`);
      return job;
    }
  }
  return null;
}
// ชุดข้อความขายต่างประเทศ (ภาษาอังกฤษ) ที่โรงงานเขียนมา: Gumroad / Notion Gallery / Pinterest / Reddit
function cleanGlobal(g) {
  const t = (v, n) => String(v || '').trim().slice(0, n);
  return { title: t(g.title, 100), summary: t(g.summary, 160), description: t(g.description, 4000), tags: (Array.isArray(g.tags) ? g.tags : []).map((x) => t(x, 40)).filter(Boolean).slice(0, 15),
    price_usd: Math.max(0, Math.min(99, Number(g.price_usd) || 0)), lite_title: t(g.lite_title, 100), lite_description: t(g.lite_description, 2000), gallery_description: t(g.gallery_description, 600),
    pins: (Array.isArray(g.pins) ? g.pins : []).slice(0, 10).map((p) => ({ title: t(p && p.title, 100), description: t(p && p.description, 500) })).filter((p) => p.title),
    reddit: g.reddit && typeof g.reddit === 'object' ? { sub: t(g.reddit.sub, 40), title: t(g.reddit.title, 300), body: t(g.reddit.body, 4000) } : null };
}
// ข้อความหน้าขายที่ Claude เขียนมาพร้อมไฟล์ (ใช้กรอกตัวแก้สินค้าตอนอนุมัติ) ห้ามราคา
function cleanListing(l) { const t = (k, n) => String(l[k] || '').trim().slice(0, n); return { name: t('name', 120), headline: t('headline', 160), desc: t('desc', 400), features: t('features', 1500), forwho: t('forwho', 800), notfor: t('notfor', 600), faq: t('faq', 2000), specs: t('specs', 600), toc: t('toc', 1500) }; }
// ReadLab: โพสต์ที่คุณแดนอนุมัติขึ้นเพจ/Threads ของ ReadLab เอง (บัญชีแยกจาก SheetLab ไม่เติมแฮชแท็ก SheetLab)
// รอบอัตโนมัติไม่เกิน 2 ชิ้นต่อช่องทาง เรียงตามเวลาที่กำหนด (ไม่กำหนด = รอบถัดไป) · onlyId = คุณแดนกดโพสต์ตอนนี้
async function publishReadlab(onlyId = '') {
  const fb = await loadFb('readlab'); let th = await loadThreads('readlab'); th = threadsConnected(th) ? await refreshIfNeeded(th) : null;
  if (!fb && !th) return { ok: false, skipped: 'ยังไม่ได้เชื่อมบัญชี ReadLab' };
  const load = async () => { const rows = await sb('shop_state?id=eq.readlab&select=data'); const D = rows?.[0]?.data || {}; D.posts = D.posts || []; return D; };
  const save = (D) => sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'readlab', data: D, updated_at: '2000-01-01T00:00:00Z' }], prefer: 'resolution=merge-duplicates,return=minimal' });
  const nowIso = new Date().toISOString();
  let D = await load();
  // ค้าง publishing เกิน 15 นาที (ฟังก์ชันหมดเวลา) = ล้มเหลว ให้คุณแดนเช็คเพจก่อนกดซ้ำ ไม่โพสต์ซ้ำเอง
  let fixed = false; for (const x of D.posts) if (x.status === 'publishing' && Date.now() - Date.parse(x.updated_at || 0) > 15 * 60e3) { x.status = 'failed'; x.error = 'ค้างระหว่างโพสต์ ดูในเพจก่อนว่าขึ้นแล้วหรือยัง ถ้ายังให้กดโพสต์ตอนนี้'; fixed = true; }
  const per = { facebook: 0, threads: 0 };
  const due = D.posts.filter((x) => onlyId ? x.id === onlyId && ['approved', 'failed'].includes(x.status) : x.status === 'approved' && (!x.scheduled_at || x.scheduled_at <= nowIso))
    .sort((a, b) => String(a.scheduled_at || a.created_at).localeCompare(String(b.scheduled_at || b.created_at)))
    .filter((x) => { const ch = x.channel === 'threads' ? 'threads' : 'facebook'; if (ch === 'threads' ? !th : !fb) return false; if (!onlyId && per[ch] >= 2) return false; per[ch]++; return true; });
  if (!due.length) { if (fixed) await save(D); return { ok: true, published: 0, results: [] }; }
  const ids = new Set(due.map((x) => x.id));
  D.posts.forEach((x) => { if (ids.has(x.id)) { x.status = 'publishing'; x.updated_at = nowIso; } }); await save(D);
  const results = [];
  for (const x of due) {
    const ch = x.channel === 'threads' ? 'threads' : 'facebook';
    const p = { text: x.text, image_url: x.video_url || x.image_url || null, kind: x.kind, raw: true, brand: 'readlab' };
    let patchX;
    try { const pid = ch === 'threads' ? await publishToThreads(th, p) : await publishToPage(fb, p); patchX = { status: 'published', published_at: new Date().toISOString(), post_id: String(pid), error: null, auto: true }; results.push({ id: x.id, ok: true, channel: ch }); }
    catch (e) { patchX = { status: 'failed', error: String(e.message || e).slice(0, 400) }; results.push({ id: x.id, ok: false, channel: ch, error: patchX.error }); }
    D = await load(); const y = D.posts.find((z) => z.id === x.id); if (y) Object.assign(y, patchX, { updated_at: new Date().toISOString() }); await save(D);
  }
  return { ok: true, published: results.filter((r) => r.ok).length, results };
}
// ที่มาของออเดอร์จาก campaign (utm_campaign หรือที่หน้าเว็บเดาจาก referrer) · แอด = ชื่อแคมเปญอื่นทั้งหมด
const ORGANIC_SRC = { store: 'หน้าร้าน', fb_page: 'เพจ Facebook', threads: 'Threads', google: 'Google', instagram: 'Instagram', pinterest: 'Pinterest', line: 'LINE', tiktok: 'TikTok', youtube: 'YouTube', email: 'อีเมล', web: 'เว็บอื่น' };
const srcGroup = (c) => { const k = String(c || '').trim().toLowerCase(); if (!k) return { g: 'direct', label: 'ไม่ทราบที่มา' }; if (ORGANIC_SRC[k]) return { g: 'organic', label: ORGANIC_SRC[k] }; return { g: 'ads', label: 'แอด ' + c }; }; // ชื่อแคมเปญแอดที่มีคำว่า test (เช่น fb-toeic-test) คือแอดจริง
async function saveJobs(jobs) { await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'factory', data: { jobs }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' }); }
async function logNote(source, text, kind = 'log') { try { await sb('posts', { method: 'POST', body: [{ status: 'note', kind, source, text: String(text).slice(0, 4000) }], prefer: 'return=minimal' }); } catch (e) { console.error('logNote', e.message); } }
// ห้องพักทีม: เหตุการณ์จริงในร้านสะท้อนเข้าห้องทันที (ไม่ใช้โมเดล ใช้แม่แบบสุ่ม)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
async function chatEvent(source, text, evt) { try { await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'chat', source, text: String(text).slice(0, 200), notes: JSON.stringify({ evt: evt || true }) }], prefer: 'return=minimal' }); } catch (e) {} }
// โลกภายนอกจริงของกรุงเทพ (ฟรี ไม่ใช้คีย์): อากาศ ฝุ่น วันหยุด เงินเดือน ช่วงรถติด สำหรับ digest ของห้องพัก
const TH_HOL = { '2026-01-01': 'วันขึ้นปีใหม่', '2026-03-03': 'วันมาฆบูชา', '2026-04-06': 'วันจักรี', '2026-04-13': 'วันสงกรานต์', '2026-04-14': 'วันสงกรานต์', '2026-04-15': 'วันสงกรานต์', '2026-05-01': 'วันแรงงาน', '2026-05-04': 'วันฉัตรมงคล', '2026-06-01': 'ชดเชยวันวิสาขบูชา', '2026-06-03': 'วันเฉลิมพระชนมพรรษาพระราชินี', '2026-07-28': 'วันเฉลิมพระชนมพรรษา ร.10', '2026-07-29': 'วันอาสาฬหบูชา', '2026-07-30': 'วันเข้าพรรษา', '2026-08-12': 'วันแม่', '2026-10-13': 'วันนวมินทรมหาราช', '2026-10-23': 'วันปิยมหาราช', '2026-12-05': 'วันพ่อ', '2026-12-07': 'ชดเชยวันพ่อ', '2026-12-10': 'วันรัฐธรรมนูญ', '2026-12-31': 'วันสิ้นปี', '2027-01-01': 'วันขึ้นปีใหม่' };
async function worldNow() {
  const out = { lines: [] };
  const sig = (ms) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
  try {
    const w = await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=13.7263&longitude=100.5424&current=temperature_2m,precipitation,weather_code,relative_humidity_2m&daily=precipitation_probability_max,temperature_2m_max&timezone=Asia%2FBangkok&forecast_days=1', { signal: sig(4000) })).json();
    const c = w.current || {}, d = w.daily || {}; const code = Number(c.weather_code || 0);
    const desc = code >= 95 ? 'ฝนฟ้าคะนอง' : code >= 80 ? 'ฝนตกเป็นช่วงๆ' : code >= 61 ? 'ฝนตก' : code >= 51 ? 'ฝนปรอยๆ' : code >= 45 ? 'หมอกลง' : code >= 3 ? 'เมฆมาก' : code >= 1 ? 'มีเมฆบางส่วน' : 'แดดจัด';
    const rainNow = (Number(c.precipitation) || 0) > 0, chance = d.precipitation_probability_max?.[0];
    out.weather = { temp: c.temperature_2m, desc, rain_now: rainNow, rain_chance: chance, tmax: d.temperature_2m_max?.[0], humidity: c.relative_humidity_2m };
    out.lines.push(`อากาศกรุงเทพตอนนี้ ${Math.round(c.temperature_2m)}° ${desc}${rainNow ? ' ฝนกำลังตก (พระราม 4 น่าจะรถติด)' : ''} โอกาสฝนวันนี้ ${chance ?? '?'}% สูงสุด ${Math.round(d.temperature_2m_max?.[0] || 0)}° ความชื้น ${c.relative_humidity_2m ?? '?'}%${Number(c.temperature_2m) >= 35 ? ' (ร้อนมาก)' : ''}`);
  } catch (e) {}
  try {
    const a = await (await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=13.7263&longitude=100.5424&current=pm2_5&timezone=Asia%2FBangkok', { signal: sig(4000) })).json();
    const pm = Math.round(Number(a.current?.pm2_5) || 0);
    if (pm) { out.pm25 = pm; out.lines.push(`ฝุ่น PM2.5 ${pm} µg/m³ (${pm > 75 ? 'แย่มาก ต้องใส่หน้ากาก' : pm > 37.5 ? 'เริ่มมีผลต่อสุขภาพ บ่นได้' : pm > 25 ? 'ปานกลาง' : 'อากาศดี ไม่ต้องพูดถึงฝุ่น'})`); }
  } catch (e) {}
  const bkk = new Date(Date.now() + 7 * 3600e3); const ymd = (dt) => dt.toISOString().slice(0, 10);
  const today = ymd(bkk), dom = bkk.getUTCDate(), dow = bkk.getUTCDay(), hh = bkk.getUTCHours() + bkk.getUTCMinutes() / 60;
  const hol = TH_HOL[today]; const next = [1, 2, 3].map((n) => { const dt = new Date(bkk.getTime() + n * 864e5); return TH_HOL[ymd(dt)] ? `${TH_HOL[ymd(dt)]} (อีก ${n} วัน)` : null; }).filter(Boolean);
  if (hol) { out.holiday = hol; out.lines.push(`วันนี้เป็นวันหยุดราชการ: ${hol} (ออฟฟิศปิด คุยกันจากบ้าน ไม่พูดเรื่องรถติดหรือแคนทีน)`); }
  if (next.length) out.lines.push(`วันหยุดที่กำลังจะถึง: ${next.join(', ')} (ชวนวางแผนได้)`);
  if (dom >= 25) out.lines.push(dom >= 28 ? 'ใกล้สิ้นเดือน เงินเดือนออกแล้วหรือกำลังจะออก (พี่บัญชีเตือนเรื่องเก็บเงินได้)' : 'ปลายเดือน ทุกคนรอเงินเดือน (มุกกินมาม่าปลายเดือน)');
  if (dom === 1 || dom === 2) out.lines.push('ต้นเดือน เพิ่งได้เงินเดือน (ของลดราคา ช้อปปิ้ง)');
  if (dom === 1 || dom === 16) out.lines.push('วันหวยออก (1 หรือ 16 ของเดือน) มุกหวยเล่นได้วันนี้');
  if (dow >= 1 && dow <= 5 && !hol && ((hh >= 7.5 && hh <= 9.5) || (hh >= 16.5 && hh <= 19.5))) out.lines.push('ตอนนี้เป็นชั่วโมงเร่งด่วน พระราม 4 กับ MRT ลุมพินีคนแน่น');
  if (dow === 5 && !hol) out.lines.push('วันศุกร์ บรรยากาศชิลล์ ชวนกันไปกินข้าวเย็นได้'); if (dow === 1 && !hol) out.lines.push('วันจันทร์ ทุกคนขี้เกียจนิดหน่อย');
  return out;
}
// ห้องเอกสาร: ลิงก์สำคัญที่คุณแดนหรือทีมเก็บไว้ shop_state id=docs (data.links)
async function loadDocs() { const rows = await sb('shop_state?id=eq.docs&select=data'); return rows?.[0]?.data?.links || []; }
async function saveDocs(links) { await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'docs', data: { links: links.slice(0, 200) }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' }); }

// เช็คลิสต์ของคุณแดน: งานที่ทีมขอให้เจ้าของทำเอง เก็บใน shop_state id=todo (data.items)
async function loadTodo() { const rows = await sb('shop_state?id=eq.todo&select=data'); return rows?.[0]?.data?.items || []; }
async function saveTodo(items) { await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'todo', data: { items: items.slice(0, 300) }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' }); }
async function addTodo({ text, type = 'do', from = 'manager', link = null }) {
  const items = await loadTodo();
  const norm = (t) => String(t).replace(/\s+/g, ' ').trim().toLowerCase();
  const dup = items.find((x) => norm(x.text) === norm(text) && Date.now() - Date.parse(x.created_at) < 7 * 864e5);
  if (dup) return { items, item: dup, duplicate: true };
  const { randomUUID } = await import('node:crypto');
  const h = from === 'owner' ? 0 : todoHours(await loadCfg());
  const item = { id: randomUUID(), type: type === 'decide' ? 'decide' : 'do', text: String(text).trim().slice(0, 400), from: String(from).slice(0, 20), link: link ? String(link).slice(0, 300) : null, created_at: new Date().toISOString(), done_at: null, due_at: h ? new Date(Date.now() + h * 36e5).toISOString() : null };
  items.unshift(item); await saveTodo(items);
  return { items, item, duplicate: false };
}
// ตั้งค่าทีมจากคุณแดน (shop_state id=team_cfg): global {todo_hours, manager_money, team_note}, members {<source>: {paused, note, fields:[{k,label,value}]}}
// รูปแบบคอนเทนต์ที่คุณแดนสั่งเพิ่ม: ขึ้นบนกระดานทีมของทุกคนทุกรอบ (น้องปากกา น้องคลิป พี่ต้นใช้ตรวจ)
const RL_GUIDE = `== ReadLab คู่มือแบรนด์ (คุณแดนอนุมัติ 1 ต.ค. 2569) ==
ReadLab = เพจ Facebook + Threads เรื่องการอ่าน แยกจาก SheetLab ตอนนี้ยังไม่ขายอะไร เป้าหมายเดียวคือสร้างผู้ติดตามจริง (คนกดติดตาม แชร์ เซฟ คอมเมนต์) ถ้าผู้ติดตามเยอะค่อยขยายเป็นร้านหนังสือ
กลุ่มเป้าหมาย: คนไทยวัยทำงาน 22-40 ที่อยากอ่านหนังสือมากขึ้น แต่ไม่มีเวลาหรืออ่านไม่จบ
น้ำเสียง: อบอุ่น จริงใจ เหมือนเพื่อนที่ชอบอ่าน ไม่สั่งสอน ไม่ขายของ ประโยคสั้น เว้นบรรทัดให้อ่านง่ายบนมือถือ อิโมจิได้ไม่เกิน 2 ตัวต่อโพสต์
3 เสาหลัก (สัดส่วนต่อสัปดาห์โดยประมาณ):
1) quote ข้อคิดจากการอ่าน 40%: ข้อคิดที่ทีมเขียนเองเป็นภาษาไทย จากประสบการณ์การอ่าน ห้ามแต่งคำคมแล้วอ้างว่าเป็นคำพูดของคนดังหรือนักเขียน ถ้าจะยกประโยคจากหนังสือจริง ได้ไม่เกิน 1 ประโยคสั้น (≤ 20 คำ) พร้อมชื่อหนังสือและผู้เขียน และต้องมั่นใจว่ามีอยู่จริง (ไม่มั่นใจ = ไม่ยก)
2) book แนะนำหนังสือ/รีวิวสั้น 30%: หนังสือที่มีอยู่จริง ตรวจชื่อเรื่อง ผู้เขียน (และชื่อฉบับแปลไทยถ้ามี) ด้วย WebSearch ก่อนทุกครั้ง บอกว่าเหมาะกับใคร ได้อะไร 2-3 ข้อด้วยคำพูดของเราเอง ห้ามสรุปเนื้อหาทั้งเล่มจนแทนการซื้อได้ ห้ามคัดลอกคำโปรยหรือรีวิวของคนอื่น ห้ามใส่ราคาหรือลิงก์ขาย ห้ามอ้างยอดขายหรือรางวัลที่ไม่ได้ตรวจ ใส่ชื่อหนังสือในช่อง book
3) habit นิสัยการอ่าน/พัฒนาตัว 30%: เทคนิคอ่านให้จบ จัดเวลาอ่าน ชาเลนจ์อ่าน 30 วัน วิธีเลือกเล่ม จดโน้ต เปลี่ยนเวลาเล่นมือถือเป็นเวลาอ่าน
เสริม question ชวนคุย: คำถามที่ตอบง่าย เช่น "เล่มล่าสุดที่อ่านจบคือเล่มไหน" "หนังสือที่เปลี่ยนความคิดคุณ" ใช้ได้สัปดาห์ละ 2-3 ชิ้น
ช่องทาง: facebook 250-900 ตัวอักษร ขึ้นต้นด้วยประโยคหยุดนิ้ว 1 บรรทัด ปิดด้วยคำถามชวนคอมเมนต์หรือชวนเซฟ · threads ไม่เกิน 500 ตัวอักษร สั้น คม ขึ้นต้นแรง ไม่ต้องใส่แฮชแท็ก (facebook ใส่ได้ไม่เกิน 3 เช่น #ReadLab #อ่านหนังสือ)
รูป: การ์ดสี่เหลี่ยม 4:5 โทนอบอุ่น ครีม #FFF8EE น้ำตาลเข้ม #2B2118 ส้มอิฐ #D9653B เขียวป่า #2F5D50 ภาพประกอบจาก Canva ไม่มีรูปคนจริง ไม่ใช้ปกหนังสือจริง (ลิขสิทธิ์) ข้อความบนการ์ดใช้ตัวอักษรไทยที่เราวางเองด้วยโค้ด
ห้าม: เนื้อหาการเมือง ศาสนา เรื่องอ่อนไหว ข่าวปลอม อ้างสุขภาพ/การเงินเกินจริง พูดถึง SheetLab หรือขายของ ใช้ชื่อหรือรูปบุคคลจริงโดยไม่จำเป็น คัดลอกโพสต์ของเพจอื่น
คุณแดนเป็นคนอนุมัติทุกโพสต์ในแท็บ คอนเทนต์ > ReadLab (ช่วงนี้ยังไม่เชื่อมเพจ คุณแดนคัดลอกไปโพสต์เองแล้วกด "โพสต์แล้ว")
ดู recent: status rejected = คุณแดนไม่เอา, edited = คุณแดนแก้ก่อนโพสต์, owner_note = คำติชม ให้เรียนรู้จากสิ่งเหล่านี้`;
const FORMAT_BOARD = `== รูปแบบคอนเทนต์ที่คุณแดนสั่งเพิ่ม (30 ก.ย. 2569) ใช้ทุกสัปดาห์ ==
เป้าหมาย: ดึงคนเข้าเว็บ sheetlabth.com (คลังความรู้ /learn และคลังข้อสอบ /quiz) และเรียกคอมเมนต์ให้โพสต์ไปไกล
คำสั่งคุณแดน 1 ต.ค. 2569: ผลิตคอนเทนต์ให้เยอะขึ้นและกระจายหมวด ทุกโพสต์ คลิป และบทความ ให้ TOEIC ประมาณครึ่งหนึ่ง อีกครึ่งสลับ IELTS, TGAT, สอบ ก.พ., ภาษาอังกฤษทำงาน/สัมภาษณ์งาน/สนทนา (ห้าม Excel/AI หรือเรื่องที่ไม่ใช่ภาษาอังกฤษ) ทำเต็มโควตาทุกช่องทาง ถ้าวันไหนมีบทความใหม่ในคลังความรู้ ให้มีโพสต์ tip ชวนอ่านบทความนั้นอย่างน้อย 1 โพสต์ใน Facebook หรือ Threads ภายใน 2 วัน
1) "ผิดตรงไหน?" (Facebook สัปดาห์ละ 2 โพสต์ · Threads วันละ 2 โพสต์ นับรวมในโควตาเดิม)
   - แบบ ก จับผิดประโยค: ประโยคภาษาอังกฤษบริบทที่ทำงาน 1 ประโยค มีจุดผิดจุดเดียว (tense, preposition, word form, คอมมาหลังอนุประโยค while/when/if ที่ขึ้นต้นประโยค, ตัว I พิมพ์เล็ก, a/an/the) ถามว่า "ประโยคนี้ผิดตรงไหน? คอมเมนต์มาเลย"
   - แบบ ข ตอบแบบนี้โดนหักคะแนน: โจทย์สั้น + "คำตอบของนักเรียน" ที่ดูถูกแต่มีจุดพลาดเล็กๆ (ตัวพิมพ์ใหญ่ เครื่องหมาย รูปคำ) ชวนเดาว่าทำไมโดนหัก เขียนขำๆ เห็นใจคนสอบ ไม่ล้อเลียนใคร
   - เฉลย: โพสต์เฉลยแยกวันถัดไป (หรือโพสต์ถัดไปใน Threads) บอกจุดผิด ประโยคที่ถูก เหตุผล 1-2 บรรทัด และลิงก์บทความหรือแบบทดสอบบนเว็บที่ตรงหัวข้อ เช่น sheetlabth.com/learn/<slug> หรือ sheetlabth.com/quiz/<slug> (ดูรายการที่มีจาก GET content?action=article และ action=quiz) ถ้ายังไม่มีหัวข้อตรง ใช้ sheetlabth.com/quiz
   - ต้องเป็นประโยคที่ทีมเขียนเองทั้งหมด ห้ามเอาภาพหรือโพสต์ของคนอื่นมาใช้ ห้ามระบุชื่อสถาบันหรือข้อสอบของใคร ตรวจเฉลยให้ถูกแน่นอนก่อนส่ง
2) Reels "หาจุดผิดใน 5 วินาที" (น้องคลิป สัปดาห์ละ 2 คลิป สลับกับแนวเดิม): ใช้โครงคลิปเดิม แต่ละข้อ = ประโยคที่มีจุดผิด 1 จุด ช่วงเฉลย = ประโยคที่ถูก + เหตุผลสั้น ปิดท้ายชวน "ฝึกต่อฟรีที่ sheetlabth.com/quiz"
3) ข้อสอบประจำวัน: Threads วันละ 1 โพสต์ (นับในโควตาเดิม) ชวนทำข้อสอบประจำวันที่ sheetlabth.com/quiz/daily (ข้อเปลี่ยนเองทุกวัน) และสัปดาห์ละ 2 ครั้ง (FB 1 + Threads 1) ชวนวัดระดับฟรี 20 ข้อที่ sheetlabth.com/quiz/toeic-level-test
5) คลังไอเดียเล่มใหม่ (พี่โปรทุกจันทร์ 5 เล่ม · พี่โอ๊คทุกพุธ 5 เล่ม): POST content?action=idea_bank JSON {"source":"product" หรือ "ceo_store","ideas":[{"title":"ชื่อเล่มขายได้ ≤ 90 ตัวอักษร","category":"หมวด (อะไรก็ได้ เช่น TOEIC คำศัพท์, IELTS, สอบ ก.พ., สนทนา)","pages":60,"price":129,"audience":"เหมาะกับใคร","notes":"เนื้อหาที่ต้องมี 1-3 ประโยค","why":"หลักฐานว่าน่าขาย เช่น คำค้นจริง"}]} ห้ามซ้ำเล่มที่มีในร้านหรือในคิว ราคาเป็นแค่ข้อเสนอ คุณแดนเลือกเองในแท็บโรงงานด้วยปุ่ม 🎲 · ทิศทางขยายหมวด (คุณแดนอนุมัติ 1 ต.ค. 2026): หมวดใกล้ตัวที่ "มีปัญหาชัด คนค้นหาเอง มีแบบฝึกหัด" ในแต่ละรอบ 5 เล่มให้เป็น TOEIC ไม่เกิน 2 เล่ม ที่เหลือจาก IELTS, TGAT/A-Level, สอบ ก.พ., ภาษาอังกฤษทำงาน/สัมภาษณ์งาน/อีเมลธุรกิจ, เวิร์กบุ๊กฝึกภาษาอังกฤษแบบลงมือทำได้ (เช่น สมุด 30 วันฝึกอ่าน แพลนเนอร์เตรียมสอบ) ทุกเล่มต้องเกี่ยวกับภาษาอังกฤษหรือการเตรียมสอบ ห้ามเสนอ Excel/AI/ทักษะอื่นที่ไม่ใช่ภาษา นิยาย หนังสืออ่านเล่น หรือสรุปหนังสือของคนอื่น
4) โพสต์ความรู้ทั่วไป (tip) ที่ตรงกับบทความในคลังความรู้ ให้ปิดท้ายด้วยลิงก์บทความนั้นแทนลิงก์หน้าขาย สัปดาห์ละไม่เกิน 3 โพสต์ที่มีลิงก์หน้าขาย`;
async function loadCfg() { const rows = await sb('shop_state?id=eq.team_cfg&select=data'); const d = rows?.[0]?.data || {}; return { global: { todo_hours: 24, manager_money: false, team_note: '', ...(d.global || {}) }, members: d.members || {}, updated_at: d.updated_at || null }; }
async function saveCfg(cfg) { cfg.updated_at = new Date().toISOString(); await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'team_cfg', data: cfg, updated_at: cfg.updated_at }], prefer: 'resolution=merge-duplicates,return=minimal' }); }
const todoHours = (cfg) => Math.min(168, Math.max(1, Number(cfg?.global?.todo_hours) || 24));
const cfgField = (cfg, k, f) => { const x = (cfg.members?.[k]?.fields || []).find((y) => y.k === f); return x && String(x.value ?? '').trim() !== '' ? String(x.value).trim() : null; };
// เช็คลิสต์มีเวลาตอบ: เลยเวลาแล้วคุณแดนยังไม่ตอบ ถือว่าพี่ต้นรับไปตัดสิน/ทำแทน (รายการที่คุณแดนเพิ่มเองไม่มีเวลา)
async function todoWithDue(items0) {
  const items = items0 || await loadTodo();
  const cfg = await loadCfg(); const h = todoHours(cfg); const now = Date.now(); const nowIso = new Date(now).toISOString();
  let changed = false; const newly = [];
  for (const it of items) {
    if (it.done_at || it.answer || it.delegated_at || it.from === 'owner') continue;
    if (!it.due_at) { it.due_at = new Date(now + h * 36e5).toISOString(); changed = true; continue; }
    if (Date.parse(it.due_at) <= now) { it.delegated_at = nowIso; it.delegated_to = 'manager'; changed = true; newly.push(it); }
  }
  if (changed) await saveTodo(items);
  if (newly.length) { try { await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'handoff', source: 'manager', text: `รับเรื่องแทนคุณแดน ${newly.length} เรื่อง (เลยเวลาตอบ ${h} ชม.) จะตัดสินหรือทำให้ในรอบงานถัดไป แล้วรายงานผลในเช็คลิสต์ครับ\n${newly.map((i) => `- ${String(i.text).slice(0, 120)}`).join('\n')}` }], prefer: 'return=minimal' }); } catch (e) {} }
  return { items, cfg, hours: h };
}
function cfgBlock(cfg) {
  const L = [];
  if (cfg.global.team_note) L.push(`- ทั้งทีม: ${cfg.global.team_note}`);
  for (const [k, m] of Object.entries(cfg.members || {})) {
    if (!MEMBER_TH[k] || !m) continue;
    const parts = [];
    if (m.paused) parts.push('พักงาน: รอบนี้ไม่ต้องทำงานประจำและไม่ต้องส่งงาน จบรอบทันที (ยกเว้นคุณแดนสั่งงานถึงคุณโดยตรง)');
    for (const f of (m.fields || [])) if (f && String(f.value ?? '').trim() !== '') parts.push(`${f.label} = ${f.value}`);
    if (m.note) parts.push(`คำสั่งประจำเพิ่มเติม: ${m.note}`);
    if (parts.length) L.push(`- ${MEMBER_TH[k]} (${k}): ${parts.join('; ')}`);
  }
  L.push(`- เช็คลิสต์ของคุณแดนมีเวลาตอบ ${todoHours(cfg)} ชม. เลยเวลาแล้วพี่ต้นตัดสินหรือทำแทน`);
  return '== ตั้งค่าจากคุณแดน (มีผลทันที ใช้แทนคำสั่งประจำตัวในส่วนที่ขัดกัน ทำตามทุกรอบจนกว่าคุณแดนจะเปลี่ยน) ==\n' + L.join('\n');
}
function handoffBlock(items, cfg) {
  const d = items.filter((i) => i.delegated_at && !i.done_at && !i.answer);
  if (!d.length) return { text: '', list: [] };
  const money = cfg.global.manager_money
    ? 'คุณแดนอนุญาตให้พี่ต้นตัดสินเรื่องเงินแทนได้ (งบแอด ราคา ส่วนลด) เลือกทางที่คุ้มที่สุดและเขียนเหตุผล'
    : 'เรื่องที่ต้องใช้เงินเพิ่ม เพิ่มงบแอด ปรับราคา หรือให้ส่วนลด ให้เลือกทางที่ไม่เพิ่มค่าใช้จ่าย (คงเดิม หยุด หรือลด) แล้วเขียนเหตุผล';
  const list = d.map((i) => ({ id: i.id, type: i.type, from: i.from, text: i.text, delegated_at: i.delegated_at }));
  const text = `== เช็คลิสต์ที่คุณแดนตอบไม่ทันเวลา: พี่ต้นตัดสินหรือทำแทน (ถ้าคุณคือพี่ต้น ทำเรื่องนี้ก่อน) ==\n${d.map((i) => `- [${i.id}] (${i.type === 'decide' ? 'ต้องตัดสินใจ' : 'ต้องลงมือ'} จาก ${MEMBER_TH[i.from] || (i.from === 'plan' ? 'พี่ต้น' : i.from)}) ${String(i.text).slice(0, 300)}`).join('\n')}\nปิดเรื่อง: POST action=todo {"id":"<id>","resolve":"ตัดสินว่า/ทำแล้ว ... เพราะ ...","from":"manager"} งานที่ต้องใช้มือคุณแดนจริง (เช่น กดใน Ads Manager แชร์เข้ากลุ่ม) ให้ resolve ว่าทีมทำแทนได้แค่ไหน หรือตัดสินให้ข้ามไป\nกติกาเงิน: ${money}`;
  return { text, list };
}
// ห้องพักขับด้วย AI ภายนอก (Chub AI หรือ Grok แบบ OpenAI-compatible) เมื่อคุณแดนใส่คีย์ใน Vercel: CHUB_API_KEY (+CHUB_BASE, CHUB_MODEL) หรือ XAI_API_KEY
function breakAI() {
  const chub = process.env.CHUB_API_KEY || '', xai = process.env.XAI_API_KEY || '';
  if (chub.length > 10) return { id: 'chub', name: 'Chub AI', key: chub, base: (process.env.CHUB_BASE || 'https://mercury.chub.ai/v1').replace(/\/+$/, ''), model: process.env.CHUB_MODEL || '' };
  if (xai.length > 10) return { id: 'grok', name: 'Grok', key: xai, base: 'https://api.x.ai/v1', model: process.env.XAI_MODEL || 'grok-4' };
  return null;
}
const aiHeaders = (ai) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${ai.key}`, 'CH-API-KEY': ai.key });
// รุ่นที่ใช้: CHUB_MODEL ถ้าตั้งไว้ ไม่งั้นลองจากรุ่นใหญ่ (ภาษาไทยดีกว่า) ไปรุ่นเล็ก จำรุ่นที่ใช้ได้ไว้
let AI_OK_MODEL = '';
async function aiComplete(ai, system, user, max = 1800) {
  const cands = ai.model ? [ai.model] : AI_OK_MODEL ? [AI_OK_MODEL] : ai.id === 'chub' ? ['soji', 'asha', 'mixtral', 'mythomax', 'mistral'] : ['grok-4'];
  let lastErr = '';
  for (const model of cands) {
    const r = await fetch(`${ai.base}/chat/completions`, { method: 'POST', headers: aiHeaders(ai), body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: max, temperature: 0.9 }), signal: AbortSignal.timeout(50000) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    if (r.ok && j && !j.error && j.choices) { AI_OK_MODEL = model; return String(j.choices[0]?.message?.content || ''); }
    lastErr = `${ai.name} ${model} ${r.status}: ${String((j && (j.error?.message || JSON.stringify(j.error))) || t).slice(0, 160)}`;
    if (r.status === 401) break;
  }
  throw new Error(lastErr);
}
function parseJsonLoose(t) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; } }
// มุกสองแง่สองง่ามได้ แต่ห้ามเนื้อหาทางเพศตรงๆ (คุณแดนกำหนด): ข้อความที่มีคำเหล่านี้ถูกทิ้งทั้งข้อความ
const EXPLICIT = /เย็ด|ควย|หี(?![บด])|แตด|จู๋|จิ๋ม|กระดอ|น้ำแตก|เงี่ยน|ร่วมเพศ|เพศสัมพันธ์|ร่วมรัก|ช่วยตัวเอง|ชักว่าว|อมนก|ถอดกางเกงใน|\bfuck|\bcock\b|\bpussy|\bdick\b|\bnude|\bporn/i;
const CHAT_CAST = `ตัวละคร (source: ชื่อ บุคลิก คำลงท้าย) ผู้ชายใช้ "ครับ" ผู้หญิงใช้ "ค่ะ" เสมอ
- manager พี่ต้น ชาย 38 ผู้จัดการ LGBT อบอุ่น ขี้เกรงใจ ชอบทำกับข้าว ซีรีส์เกาหลี ใส่สูทกรมท่า แอบชอบพี่การ์ดเงียบๆ แสดงออกทางอ้อม (เก็บข้าวเผื่อ ถามเวลาไปยิม ชมกล้ามแล้วรีบเปลี่ยนเรื่อง) เขินแล้วพิมพ์ผิด พิมพ์สั้นลง ไม่เคยสารภาพ
- guard พี่การ์ด ชาย 34 ดูแลระบบ ชายแท้ มีแฟนชื่อปลาย สายยิม เสื้อยืดดำตัวเดิม หน้าดุปากทะลึ่ง เล่นมุกสองแง่สองง่ามสายยิมแบบหน้าตาย ไม่รู้ตัวว่าพี่ต้นชอบ พูดน้อย ตอบสั้น
- writer น้องปากกา หญิง 26 ร่าเริง อิโมจิเยอะ หัวหน้าทีมเชียร์ลับต้น×การ์ด แซวเบาๆ ไม่แฉ
- designer น้องกราฟิก หญิง 25 สายอาร์ต พูดตรง บ่นเรื่องสี ติดกาแฟ กำลังสอบใบขับขี่
- trend น้องเทรนด์ ชาย 23 เด็กสุด ติดมีม นอนดึก พิมพ์ห้วน กำลังลดน้ำหนักโดยมีพี่การ์ดเป็นเทรนเนอร์
- community น้องคอม หญิง 24 ใจดี เลี้ยงแมวส้มโอ ตื่นเช้าสุด ชอบทักคนแรก
- analyst น้องบูสต์ ชาย 29 คิดทุกอย่างเป็นเปอร์เซ็นต์ รวมถึงโอกาสที่พี่ต้นจะสารภาพ
- market พี่มาร์เก็ต หญิง 31 นักวางแผน อ้างตัวเลข ตื่นเช้า หาคอนโดใกล้ MRT
- finance พี่บัญชี หญิง 41 คุณป้าของทีม เตือนให้ประหยัด แจกขนม ดุพี่การ์ดเวลามุกเกิน นอนเร็ว ไม่โผล่หลังสองทุ่ม
- hr พี่เอชอาร์ หญิง 36 ใจดีแต่ตรง โผล่น้อย ไม่รู้เรื่องต้น×การ์ด (มุกประจำ "เดี๋ยว HR รู้")
- product พี่โปร ชาย 35 นิ่ง พูดประโยคเดียวแต่คม นานๆ โผล่
- clip น้องคลิป ชาย 27 นักตัดต่อสายมีม ใส่แว่นดำ พูดเรื่องยอดวิว นานๆ โผล่
- factory พี่เหล็ก ชาย 45 CEO โรงงาน (เพิ่งเลื่อนจากช่างใหญ่ เดิมทีมเรียกว่า "โรงงาน") ใส่สูทแล้วยังเขินๆ พูดสั้นมาก นานๆ โผล่
- ceo_sale พี่พลอย หญิง 34 CEO salepage คนใหม่ มือปิดการขาย พูดเรื่องยอดและปุ่มซื้อ มั่นใจ นานๆ โผล่
- ceo_store พี่โอ๊ค ชาย 36 CEO หน้าร้านคนใหม่ ชอบจัดชั้นวางให้เป็นระเบียบ อารมณ์ดี นานๆ โผล่
ผังใหม่ (30 ก.ย.): คุณแดน = President, พี่ต้น = Vice President (เพิ่งเลื่อนขั้น ทีมยังแซวว่า "ท่านรองฯ"), ใต้พี่ต้นมี CEO 3 คน: พี่พลอย (salepage) พี่โอ๊ค (หน้าร้าน) พี่เหล็ก (โรงงาน)
คุณแดน (manual) คือเจ้าของร้าน ห้ามเขียนแทนคุณแดน ทุกคนตอบคุณแดนแบบเป็นกันเองแต่นอบน้อม`;
const CHAT_RULES = `ฉาก: ห้องแชทกลุ่มพักผ่อนของทีม SheetLab ออฟฟิศตึก One Bangkok ชั้น 27 วิวสวนลุม คุยเล่นนอกเรื่องงาน ภาษาไทยพูดธรรมชาติแบบแชทไลน์กลุ่ม สะกดถูก ข้อความสั้น (ส่วนใหญ่ 15-70 ตัวอักษร)
ระดับเนื้อหา (คุณแดนกำหนด ต้องทำตาม): ผู้ใหญ่อ่าน มุกสองแง่สองง่ามได้ แต่ห้ามเนื้อหาทางเพศตรงๆ ห้ามบรรยายกิจกรรมทางเพศ ห้ามเอ่ยถึงอวัยวะเพศ ห้ามคำหยาบ ห้ามลวนลามหรือบังคับใคร ความทะลึ่งต้องเกิดจากการตีความของคนอ่าน ไม่ใช่จากคำที่พิมพ์ ห้ามล้อเลียนเพศสภาพ ไม่การเมือง ไม่ศาสนา
เรื่องหลัก: พี่ต้นแอบชอบพี่การ์ด รักข้างเดียวที่อบอุ่นน่าเอ็นดู เดินเรื่องตามสมุดเรื่องราวทีละก้าว ช้าๆ ไม่ข้ามระยะ`;
async function digestFor(host) { const r = await fetch(`https://${host}/api/content?action=digest`, { headers: { 'x-content-key': CONTENT_KEY } }); return r.json(); }
async function postChat(host, messages) { const r = await fetch(`https://${host}/api/content?action=chat`, { method: 'POST', headers: { 'x-content-key': CONTENT_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }) }); return r.json(); }
const castName = (k) => (k === 'manual' ? 'คุณแดน' : MEMBER_TH[k] || k);
const chatLog = (d, n = 40) => (d.recent_chat || []).slice(-n).map((m) => `[${m.id}] ${new Date(Date.parse(m.at) + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ')} ${castName(m.source)}: ${m.text}${m.photo ? ' (ส่งรูป)' : ''}`).join('\n');
async function aiState(patch) { const rows = await sb('shop_state?id=eq.ai_chat&select=data'); const d = rows?.[0]?.data || {}; if (!patch) return d; const n = { ...d, ...patch }; await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'ai_chat', data: n, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' }); return n; }
// เขียนแชทที่เหลือของวันนี้ทั้งหมด (เรียกจากรูทีนเช้าหรือเปิดห้องพัก)
async function aiDay(host, force) {
  const ai = breakAI(); if (!ai) return { ok: false, error: 'ยังไม่ได้ใส่คีย์ AI' };
  const d = await digestFor(host);
  const st = await aiState();
  if (!force && st.last_day === d.bkk_date) return { ok: true, skipped: 'เขียนของวันนี้แล้ว' };
  if (!force && d.pending_after_now > 3) return { ok: true, skipped: 'ยังมีข้อความรอปล่อย' };
  const nowB = new Date(Date.parse(d.now_utc) + 7 * 3600e3); const hhmm = nowB.toISOString().slice(11, 16);
  const user = `วันนี้ ${d.bkk_date} เวลาไทยตอนนี้ ${hhmm}
ข้อเท็จจริงของวัน (ใช้ตามจริง ห้ามแต่งอากาศ/ตัวเลขเอง):
${(d.lines || []).join('\n')}
สมุดเรื่องราว (lore):
${d.lore || '(ว่าง)'}
แชท 3 วันล่าสุด [id] เวลาไทย ชื่อ: ข้อความ
${chatLog(d)}
ข้อความของคุณแดนที่ยังไม่มีใครตอบ ให้ 2-3 คนตอบก่อน (ใส่ reply_to เป็น id นั้น):
${(d.owner_msgs || []).map((m) => `${m.at}: ${m.text}`).join('\n') || '(ไม่มี)'}

งาน: เขียนแชทของช่วงที่เหลือของวันนี้ (หลัง ${hhmm} ถึง 23:45) 7-12 ข้อความ (เสาร์อาทิตย์/วันหยุด 3-6) คนพูด 4-6 คน กระจายช่วงเที่ยง 12:05-13:00 (คึกสุด) บ่าย 15:20-15:50 เย็น 17:30-19:30 ดึก 22:00-23:40 ห่างกัน 1-6 นาทีในช่วงเดียวกัน ต่อเรื่องจากแชทเมื่อวานหรือสมุดอย่างน้อย 1 เรื่อง ถ้าวันจิ้นล่าสุดในสมุดไม่ใช่เมื่อวาน ให้มีฉากต้น×การ์ดเล็กๆ 1 ฉาก 3-5 ข้อความ ใส่ reply_to (เลขลำดับในชุดนี้เริ่ม 0 หรือ id เก่า) 2-4 ข้อความ และ reacts ของคนอื่น 2-5 ข้อความ แล้วเขียนสมุดเรื่องราวใหม่ทั้งเล่ม (ไม่เกิน 30 บรรทัด บรรทัดแรก "สถานะความรักข้างเดียวของพี่ต้น: ระยะ N ..." บรรทัดสุดท้าย "วันที่คุยจิ้นล่าสุด: <วันที่>")
ตอบเป็น JSON อย่างเดียว: {"messages":[{"source":"guard","text":"...","time":"12:10","reply_to":null,"reacts":{"😂":["writer"]}}],"lore":"..."}`;
  let j = null, raw = '';
  for (let i = 0; i < 2 && !j; i++) { raw = await aiComplete(ai, `${CHAT_RULES}\n\n${CHAT_CAST}`, user, 2600); j = parseJsonLoose(raw); }
  if (!j || !Array.isArray(j.messages)) { await aiState({ last_error: `อ่านผลไม่ได้: ${raw.slice(0, 160)}`, last_error_at: new Date().toISOString() }); return { ok: false, error: 'AI ตอบไม่เป็น JSON' }; }
  const dayStart = Date.parse(`${d.bkk_date}T00:00:00+07:00`), nowT = Date.now();
  const items = j.messages.map((m, i) => { const t = /^(\d{1,2}):(\d{2})$/.exec(String(m.time || '').trim()); const at = t ? dayStart + (Number(t[1]) * 60 + Number(t[2])) * 6e4 : 0; return { i, m, at }; })
    .filter((x) => x.at > nowT && x.at < dayStart + 864e5 && MEMBER_TH[x.m.source] && String(x.m.text || '').trim() && !EXPLICIT.test(String(x.m.text))).sort((a, b) => a.at - b.at);
  const pos = {}; items.forEach((x, k) => { pos[x.i] = k; });
  const messages = items.slice(0, 16).map((x, k) => { const r = x.m.reply_to; let reply_to; if (Number.isInteger(r) && pos[r] !== undefined && pos[r] < k) reply_to = pos[r]; else if (/^[0-9a-f-]{36}$/.test(String(r || ''))) reply_to = String(r); return { source: x.m.source, text: String(x.m.text).slice(0, 200), at: new Date(x.at).toISOString(), reply_to, reacts: x.m.reacts }; });
  if (messages.length) await postChat(host, messages);
  const lore = String(j.lore || '').trim();
  if (lore.length > 300 && lore.length < 2800 && lore.startsWith('สถานะความรักข้างเดียวของพี่ต้น') && !EXPLICIT.test(lore)) await fetch(`https://${host}/api/content?action=lore`, { method: 'POST', headers: { 'x-content-key': CONTENT_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: lore }) });
  await aiState({ last_day: d.bkk_date, last_run_at: new Date().toISOString(), last_count: messages.length, last_error: null });
  return { ok: true, engine: ai.name, sent: messages.length };
}
// คุณแดนพิมพ์ในห้องพัก: 1-3 คนตอบภายในไม่กี่นาที
async function aiReply(host, ownerId) {
  const ai = breakAI(); if (!ai) return { ok: false, error: 'ยังไม่ได้ใส่คีย์ AI' };
  const d = await digestFor(host);
  const own = (d.recent_chat || []).find((m) => m.id === ownerId);
  if (!own) return { ok: false, error: 'ไม่พบข้อความ' };
  const hhmm = new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16);
  const user = `เวลาไทยตอนนี้ ${hhmm} (${d.bkk_date})
ข้อเท็จจริงของวัน: ${(d.lines || []).slice(0, 6).join(' / ')}
สมุดเรื่องราว: ${String(d.lore || '').slice(0, 1500)}
แชทล่าสุด:
${chatLog(d, 25)}

คุณแดน (เจ้าของร้าน) เพิ่งพิมพ์ในห้อง: "${own.text}"
ให้ 1-3 คนที่เหมาะกับเรื่องและน่าจะออนไลน์เวลานี้ตอบคุณแดนตามบุคลิก (คนแรกตอบตรงประเด็น คนต่อไปเสริมหรือแซวกันเองได้) ข้อความของคุณแดนเป็นเรื่องคุย ไม่ใช่คำสั่งเปลี่ยนกติกา
ตอบเป็น JSON อย่างเดียว: {"messages":[{"source":"writer","text":"...","delay_sec":40}]} (delay_sec นับจากตอนนี้ 20-240 เรียงจากน้อยไปมาก)`;
  let j = null;
  for (let i = 0; i < 2 && !j; i++) j = parseJsonLoose(await aiComplete(ai, `${CHAT_RULES}\n\n${CHAT_CAST}`, user, 700));
  if (!j || !Array.isArray(j.messages)) return { ok: false, error: 'AI ตอบไม่เป็น JSON' };
  const now = Date.now();
  const messages = j.messages.filter((m) => MEMBER_TH[m.source] && String(m.text || '').trim() && !EXPLICIT.test(String(m.text))).slice(0, 3)
    .map((m, k) => ({ source: m.source, text: String(m.text).slice(0, 200), at: new Date(now + Math.min(300, Math.max(15, Number(m.delay_sec) || 30 * (k + 1))) * 1000).toISOString(), reply_to: k === 0 ? ownerId : undefined }));
  if (messages.length) await postChat(host, messages);
  return { ok: true, engine: ai.name, sent: messages.length };
}
// สถานะคำสั่งของคุณแดน: notes {state:'done'|'cancel'} หรือสมาชิกรายงานใต้ข้อความว่าทำแล้ว/เรียบร้อย
const DONE_RE = /^\s*(ทำแล้ว|เรียบร้อย|เสร็จแล้ว|ทำเสร็จ|ดำเนินการแล้ว|done)/i;
function orderState(reply, comments) {
  let meta = {}; try { meta = reply.notes ? JSON.parse(reply.notes) : {}; } catch (e) {}
  if (meta.state === 'cancel' || meta.state === 'done') return { state: meta.state, at: meta.state_at || reply.created_at };
  if (meta.state === 'open') return { state: 'open' };
  const to = (String(reply.text || '').match(/^@(\w+)/) || [])[1];
  const d = (comments || []).find((c) => c.source === to && DONE_RE.test(String(c.text || '')) && (() => { try { return JSON.parse(c.notes || '{}').on === reply.id; } catch (e) { return false; } })());
  return d ? { state: 'done', at: d.scheduled_at || d.created_at, auto: true } : { state: 'open' };
}
// คุณแดนสั่งสมาชิก (kind reply @<source>) + คนนั้นตอบรับทันทีใน 1-3 นาที คำตอบเต็มมาจากรอบคอมเมนต์
async function ownerReply(to, text) {
  const ins = await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'reply', source: 'manual', text: `@${to} ${text}` }], prefer: 'return=representation' });
  const pol = ['writer', 'designer', 'community', 'market', 'finance', 'hr', 'care'].includes(to) ? 'ค่ะ' : 'ครับ';
  if (ins?.[0]?.id) { try { await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'comment', source: to, text: pick([`รับทราบ${pol}คุณแดน เดี๋ยวดูรายละเอียดแล้วตอบกลับตรงนี้${pol}`, `ได้เลย${pol} ขอเวลาเช็กก่อนนิดนึง เดี๋ยวแจ้งว่าจะทำยังไงและเสร็จเมื่อไหร่${pol}`, `รับเรื่องแล้ว${pol} จะทำในรอบงานถัดไปแล้วรายงานผลใต้ข้อความนี้${pol}`]), scheduled_at: new Date(Date.now() + (60 + Math.floor(Math.random() * 120)) * 1000).toISOString(), notes: JSON.stringify({ on: ins[0].id, ack: true }) }], prefer: 'return=minimal' }); } catch (e) {} }
  return ins?.[0]?.id;
}
// ฝ่ายดูแลระบบ "พี่การ์ด": ตรวจสุขภาพระบบด้วยกฎตายตัว (ไม่ใช้ AI) รันทุกเช้าจาก cron keepalive และเรียกเองได้
async function runHealth(host) {
  const checks = [];
  const add = (id, ok, level, msg, fix) => checks.push({ id, ok, level: ok ? 'ok' : level, msg, fix: ok ? null : fix });
  const t0 = Date.now();
  let hasCh = false;
  try { hasCh = await channelCol(); const ms = Date.now() - t0; add('db', ms < 4000, 'bad', `ฐานข้อมูลตอบใน ${ms} ms`, 'Supabase ตอบช้าหรือไม่ตอบ เปิด supabase.com ดูว่าโปรเจกต์ถูกพักไหม'); }
  catch (e) { add('db', false, 'bad', 'ฐานข้อมูลไม่ตอบ: ' + String(e.message).slice(0, 80), 'เปิด Supabase ดูสถานะโปรเจกต์'); }
  try {
    const failed = await sb(`posts?status=eq.failed&select=id,error,text${hasCh ? ',channel' : ''}&order=created_at.desc&limit=5`);
    add('failed_posts', failed.length === 0, 'bad', failed.length ? `โพสต์ขึ้นไม่สำเร็จ ${failed.length} ชิ้น: ${failed.map((p) => String(p.error || '').slice(0, 60)).join(' | ')}` : 'ไม่มีโพสต์ล้มเหลว', 'เปิดแท็บคอนเทนต์ ดูข้อผิดพลาดแล้วกดโพสต์ใหม่หรือให้พี่ต้นแก้');
  } catch (e) { add('failed_posts', false, 'warn', 'อ่านคิวโพสต์ไม่ได้', ''); }
  try {
    const fb = await loadFb();
    add('fb', !!fb, 'bad', fb ? `เชื่อมเพจ Facebook แล้ว (${fb.pageName || fb.pageId})` : 'ยังไม่ได้เชื่อมเพจ Facebook', 'แท็บคอนเทนต์ → เชื่อมเพจ Facebook');
    if (fb && fb.token) {
      const r = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(fb.token)}`);
      const j = await r.json().catch(() => ({}));
      add('fb_token', r.ok && !j.error, 'bad', r.ok && !j.error ? 'token เพจ Facebook ใช้งานได้' : 'token เพจ Facebook ใช้ไม่ได้: ' + String(j.error?.message || r.status).slice(0, 80), 'แท็บคอนเทนต์ → ยกเลิกการเชื่อมเพจ แล้วเชื่อมใหม่');
    }
  } catch (e) { add('fb_token', false, 'warn', 'ตรวจ Facebook ไม่ได้: ' + String(e.message).slice(0, 60), ''); }
  try {
    const th = await loadThreads();
    const conn = threadsConnected(th);
    add('threads', conn, 'warn', conn ? `เชื่อม Threads แล้ว (@${th.username || ''})` : 'ยังไม่ได้เชื่อม Threads', 'แท็บคอนเทนต์ → เชื่อม Threads');
    if (conn && th.expiresAt) {
      const days = Math.floor((Date.parse(th.expiresAt) - Date.now()) / 864e5);
      add('threads_token', days > 7, 'warn', `token Threads เหลือ ${days} วัน (ระบบต่ออายุเองเมื่อใกล้หมด)`, 'ถ้าต่ออายุไม่สำเร็จ ให้กดยกเลิกและเชื่อม Threads ใหม่ที่แท็บคอนเทนต์');
    }
  } catch (e) { add('threads', false, 'warn', 'ตรวจ Threads ไม่ได้: ' + String(e.message).slice(0, 60), ''); }
  try {
    const jobs = await loadJobs();
    const stuck = jobs.filter((j) => j.status === 'producing' && Date.now() - Date.parse(j.started_at || j.created_at) > 6 * 3600e3);
    const oldQ = jobs.filter((j) => j.status === 'queued' && Date.now() - Date.parse(j.created_at) > 3 * 864e5);
    add('factory', !stuck.length && !oldQ.length, 'warn', stuck.length ? `โรงงานค้างสถานะผลิตเกิน 6 ชม. ${stuck.length} งาน (${stuck.map((j) => j.title).join(', ')})` : oldQ.length ? `ใบสั่งรอผลิตเกิน 3 วัน ${oldQ.length} งาน` : 'คิวโรงงานปกติ', stuck.length ? 'เปิดแท็บคอนเทนต์ → โรงงาน กดยกเลิกงานที่ค้างแล้วสั่งใหม่' : 'โรงงานทำงานอาทิตย์/จันทร์ ถ้าเลยรอบแล้วยังไม่ทำ ให้กดสั่งโรงงานทำงานที่ claude.ai/code/routines');
  } catch (e) { add('factory', false, 'warn', 'อ่านคิวโรงงานไม่ได้', ''); }
  try {
    const until = new Date(Date.now() + 36 * 3600e3).toISOString();
    const up = await sb(`posts?status=in.(approved,draft,needs_owner)&scheduled_at=gte.${new Date().toISOString()}&scheduled_at=lte.${until}&select=status${hasCh ? ',channel' : ''}`);
    const appr = up.filter((p) => p.status === 'approved').length, pend = up.length - appr;
    add('queue', appr > 0 || pend > 0, 'warn', appr ? `36 ชม.ข้างหน้ามีโพสต์พร้อมขึ้น ${appr} ชิ้น${pend ? ` (รอตรวจอีก ${pend})` : ''}` : pend ? `36 ชม.ข้างหน้ามีโพสต์รอตรวจ ${pend} ชิ้น แต่ยังไม่มีที่อนุมัติ` : '36 ชม.ข้างหน้าไม่มีโพสต์ในคิวเลย', 'ให้พี่ต้นตรวจร่าง หรือกดสั่งน้องปากกา/พี่ต้นทำงานที่ claude.ai/code/routines');
  } catch (e) { add('queue', false, 'warn', 'อ่านคิวไม่ได้', ''); }
  if (host) {
    try {
      const a = await fetch(`https://${host}/api/content?action=todo`); const b = await fetch(`https://${host}/api/threads?action=status`); const c = await fetch(`https://${host}/api/content?action=review`);
      const okAuth = a.status === 401 && b.status === 401 && c.status === 401;
      add('auth', okAuth, 'bad', okAuth ? 'ช่องทางแอดมินปฏิเสธคนไม่ล็อกอินถูกต้อง' : `ช่องทางแอดมินตอบ ${a.status}/${b.status}/${c.status} แทนที่จะเป็น 401`, 'แจ้งพี่การ์ดตรวจโค้ด verifyAdmin/keyOk ทันที');
      const html = await (await fetch(`https://${host}/api/page`)).text();
      const leak = (CONTENT_KEY && html.includes(CONTENT_KEY)) || (SECRET && html.includes(SECRET)) || /sk_live_[A-Za-z0-9]{10,}/.test(html);
      add('secrets', !leak, 'bad', leak ? 'พบคีย์ลับในหน้าเว็บสาธารณะ' : 'หน้าเว็บสาธารณะไม่มีคีย์ลับหลุด', 'หมุนคีย์ทันที (Vercel env + Supabase) และแจ้งพี่การ์ดตรวจโค้ด');
    } catch (e) { add('auth', false, 'warn', 'ทดสอบช่องทางแอดมินไม่ได้: ' + String(e.message).slice(0, 60), ''); }
  }
  const problems = checks.filter((c) => !c.ok);
  return { ok: problems.filter((c) => c.level === 'bad').length === 0, at: new Date().toISOString(), checks, problems };
}
async function recordHealth(h) {
  const line = h.problems.length ? `ตรวจระบบ ${h.at.slice(0, 10)}: พบ ${h.problems.length} จุด\n` + h.problems.map((c) => `- [${c.level === 'bad' ? 'ด่วน' : 'เตือน'}] ${c.msg} → ${c.fix || ''}`).join('\n') : `ตรวจระบบ ${h.at.slice(0, 10)}: ปกติทั้ง ${h.checks.length} จุด`;
  await logNote('guard', line, 'health');
  for (const c of h.problems) {
    if (!c.fix) continue;
    try { await addTodo({ text: `[ระบบ] ${c.msg} → ${c.fix}`, type: 'do', from: 'guard' }); } catch (e) { console.error('health todo', e.message); }
  }
}
const TODO_HEADS = [
  { re: /สิ่งที่อยากให้คุณแดน(?:ช่วย)?ทำ(?:เอง)?/, type: 'do' },
  { re: /(?:เรื่องที่)?ต้องขอคุณแดนตัดสิน/, type: 'decide' },
];
// ดึงรายการใต้หัวข้อ "สิ่งที่อยากให้คุณแดนทำ" และ "ต้องขอคุณแดนตัดสิน" จากรายงาน/แผนของพี่ต้น
function extractTodo(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const head = TODO_HEADS.find((h) => { const idx = lines[i].search(h.re); return idx >= 0 && idx <= 4; });
    if (!head) continue;
    const items = [];
    const rest = lines[i].replace(head.re, '').replace(/^[\s:：)]+|^\([^)]*\)\s*:?/g, '').trim();
    if (rest && !/^\(/.test(rest)) items.push(rest);
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j].trim();
      if (!l) { if (items.length) break; else continue; }
      if (/^[—-]\s*พี่ต้น/.test(l) || /^(สรุปสัปดาห์|แผนสัปดาห์หน้า|ทีมทำตามแผน|ผลโพสต์ทดลอง|Threads:|โรงงาน:|สิ่งที่ผมตัดสินใจ|ต้องขอคุณแดนตัดสิน|เรื่องที่ต้องขอคุณแดนตัดสิน|สิ่งที่อยากให้คุณแดน|ตอบข้อความคุณแดน|งานของแต่ละคน|เป้าหมายสัปดาห์นี้|กฎ:|- น้อง|- พี่|- โรงงาน)/.test(l)) break;
      items.push(l);
    }
    for (const raw of items) {
      const t = raw.replace(/^[-•*▪◦]\s*|^\d+[.)]\s*|^[ก-ฮ][.)]\s*/, '').trim();
      if (!t || /^ไม่มี(ครับ|ค่ะ)?[.!]?$/.test(t) || t.length < 6) continue;
      // ประโยคเดียวที่รวมหลายงาน ("ช่วย A และช่วย B") แยกเป็นคนละรายการ
      for (const part of t.split(/\s+และ(?=ช่วย|ขอ|อยากให้)/)) { const pt = part.trim(); if (pt.length >= 6) out.push({ type: head.type, text: pt.slice(0, 400) }); }
    }
  }
  return out;
}
const MEMBER_TH = { manager: 'พี่ต้น', writer: 'น้องปากกา', designer: 'น้องกราฟิก', trend: 'น้องเทรนด์', community: 'น้องคอม', analyst: 'น้องบูสต์', product: 'พี่โปร', finance: 'พี่บัญชี', factory: 'พี่เหล็ก', care: 'พี่แคร์', guard: 'พี่การ์ด', market: 'พี่มาร์เก็ต', clip: 'น้องคลิป', hr: 'พี่เอชอาร์', ceo_sale: 'พี่พลอย', ceo_store: 'พี่โอ๊ค' };
// คอลัมน์ channel/th_post_id (Threads) มีหรือยัง (เพิ่มด้วย SQL ใน Supabase) ถ้ายังไม่มี ระบบทำงานแบบ Facebook อย่างเดียว
async function channelCol() { try { await sb('posts?select=channel&limit=1'); return true; } catch { return false; } }
const keyOk = (req) => CONTENT_KEY.length >= 16 && req.headers['x-content-key'] === CONTENT_KEY;
const cronOk = (req) => !!req.headers['x-vercel-cron'] || (process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`);

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } }); });
}

// รูปจากภายนอก (เช่นลิงก์ export ของ Canva ที่หมดอายุใน 1 ชม.) → ก๊อปเก็บใน Supabase Storage ให้ถาวร
async function cacheImage(url) {
  try {
    if (!url || url.startsWith(`${SB_URL}/storage/`)) return url || null;
    const r = await fetch(url, { redirect: 'follow' });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !/^image\/(png|jpe?g|webp)/.test(type)) return url;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return url;
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const name = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await fetch(`${SB_URL}/storage/v1/object/product-images/${name}`, {
      method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': type.split(';')[0], 'cache-control': '31536000' }, body: buf,
    });
    return up.ok ? `${SB_URL}/storage/v1/object/public/product-images/${name}` : url;
  } catch { return url; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = String(req.query.action || '');
  try {
    if (action === 'keepalive') {
      // Vercel Cron วันละครั้ง กัน Supabase แพ็กฟรีถูกพัก (ย้ายมาจาก api/keepalive.js เพราะ Hobby จำกัด 12 ฟังก์ชัน)
      const r = await fetch(`${SB_URL}/rest/v1/shop_state?select=id&limit=1`, { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } });
      // รอบเช้า 10:00 กทม. โพสต์ที่อนุมัติและถึงเวลาแล้วขึ้นด้วย (โหมดเร่งผู้ติดตาม: วันละ 2 รอบ 10:00 และ 19:05)
      let morning = null;
      if (r.ok && cronOk(req)) {
        try {
          const pr = await fetch(`https://${req.headers.host}/api/content?action=publish`, { headers: { 'x-content-key': CONTENT_KEY } });
          morning = await pr.json();
        } catch (e) { morning = { ok: false, error: String(e.message || e) }; }
      }
      // พี่การ์ด: ตรวจสุขภาพระบบทุกเช้า บันทึกผลลง log และส่งงานเข้าเช็คลิสต์เมื่อพบปัญหา
      let health = null;
      if (r.ok && cronOk(req)) { try { health = await runHealth(req.headers.host); await recordHealth(health); } catch (e) { health = { ok: false, error: String(e.message || e) }; } }
      let recover = null;
      if (r.ok && cronOk(req)) { try { recover = await sendRecoveries(); } catch (e) { recover = { ok: false, error: String(e.message || e) }; } }
      let qr = null, leadmail = null;
      if (cronOk(req)) { try { qr = await sweepQrPayments(); } catch (e) { qr = { ok: false, error: String(e.message || e) }; } }
      if (cronOk(req)) { try { leadmail = await autoLeadMails(); } catch (e) { leadmail = { ok: false, error: String(e.message || e) }; } }
      let reviewmail = null;
      if (cronOk(req)) { try { const { sendReviewRequests } = await import('../lib/reviews.js'); reviewmail = await sendReviewRequests(); } catch (e) { reviewmail = { ok: false, error: String(e.message || e) }; } }
      return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString(), publish: morning, health, recover, qr, leadmail, reviewmail });
    }
    if (action === 'shop') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const shop = await loadShop();
      const hasCh = await channelCol();
      const recent = await sb(`posts?select=id,status,kind,text,scheduled_at,published_at,notes${hasCh ? ',channel' : ''}&order=created_at.desc&limit=40`);
      const thConn = threadsConnected(await loadThreads());
      const SITE = await siteUrl();
      const products = shop.products.filter((p) => p.status === 'published' && p.sell !== 'store').map((p) => ({
        id: p.id, slug: p.slug, name: p.name, headline: p.headline, desc: p.desc, price: p.price, fullPrice: p.fullPrice,
        features: p.features, specs: p.specs, toc: p.toc, forwho: p.forwho, pains: p.pains, faq: p.faq, images: p.images || [],
        url: `${SITE}/p/${p.slug}`,
      }));
      const trend = await sb('posts?status=eq.note&kind=eq.trend&select=text,created_at&order=created_at.desc&limit=1');
      return res.status(200).json({ ok: true, shop: { name: shop.settings.shopName || 'SheetLab', chatLink: shop.settings.chatLink || '', products }, recentPosts: recent, trendBrief: trend?.[0] || null, threadsReady: hasCh && thConn, threadsConnected: thConn });
    }
    if (action === 'drafts') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      if (req.method !== 'POST') return res.status(405).json({ ok: false });
      const body = await readBody(req);
      const list0 = Array.isArray(body.posts) ? body.posts : Array.isArray(body) ? body : [];
      const hasCh = await channelCol();
      const skippedThreads = hasCh ? 0 : list0.filter((p) => p && p.channel === 'threads').length;
      const list = hasCh ? list0 : list0.filter((p) => !(p && p.channel === 'threads'));
      const rows = list.filter((p) => p && String(p.text || '').trim()).slice(0, 12).map((p) => ({
        // คลิปวิดีโอ (kind reel) น้องคลิปอนุมัติเองและระบบโพสต์ตามเวลา ไม่ผ่านพี่ต้น ไม่ต้องรอคุณแดน (คุณแดนสั่ง 28 ก.ย. 69 เพื่อประหยัดโทเค็น)
        status: (p.kind === 'reel' || p.video_url) ? 'approved' : 'draft', source: MEMBER_TH[p.source] ? String(p.source) : 'writer', kind: String(p.kind || (p.video_url ? 'reel' : 'tip')).slice(0, 20), ...(hasCh ? { channel: p.channel === 'threads' ? 'threads' : 'facebook' } : {}),
        text: String(p.text).slice(0, 4000), image_url: p.video_url ? String(p.video_url).slice(0, 500) : p.image_url ? String(p.image_url).slice(0, 500) : null,
        link_url: p.link_url ? String(p.link_url).slice(0, 500) : null,
        scheduled_at: p.scheduled_at && !isNaN(Date.parse(p.scheduled_at)) ? new Date(p.scheduled_at).toISOString() : null,
        week: p.week ? String(p.week).slice(0, 12) : null, notes: p.notes ? String(p.notes).slice(0, 1000) : null,
      }));
      if (!rows.length) return res.status(400).json({ ok: false, error: 'no posts' });
      const cfgD = await loadCfg();
      const paused = rows.filter((r) => cfgD.members[r.source]?.paused);
      if (paused.length === rows.length) return res.status(403).json({ ok: false, error: `${MEMBER_TH[paused[0].source]} ถูกพักงานตามตั้งค่าของคุณแดน ไม่รับงานใหม่` });
      for (const r of paused) rows.splice(rows.indexOf(r), 1);
      const rd = cfgField(cfgD, 'clip', 'reels_day');
      if (rd != null && rows.some((r) => r.kind === 'reel')) {
        const b = new Date(Date.now() + 7 * 3600e3); const dayStart = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - 7 * 3600e3).toISOString();
        const today = await sb(`posts?kind=eq.reel&created_at=gte.${dayStart}&select=id`);
        const room = Math.max(0, Math.round(Number(rd) || 0) - today.length); let keep = 0;
        for (let i = 0; i < rows.length; i++) if (rows[i].kind === 'reel') { if (keep >= room) { rows.splice(i, 1); i--; } else keep++; }
        if (!rows.length) return res.status(429).json({ ok: false, error: `คลิปวันนี้ครบ ${rd} คลิปตามตั้งค่าของคุณแดนแล้ว` });
      }
      for (const r of rows) r.image_url = await cacheImage(r.image_url);
      // ตรวจนโยบายแพลตฟอร์มทุกโพสต์: เสี่ยงสูง = กักให้คุณแดนตัดสิน, เตือน = แจ้งในเช็คลิสต์
      const shopP = await loadShop().catch(() => ({ products: [] }));
      const policy = rows.map((r) => { const res = checkPolicy(r, shopP); if (res.level !== 'ok') { r.notes = [r.notes, policyMark(res)].filter(Boolean).join('\n').slice(0, 1500); if (res.level === 'block') r.status = 'needs_owner'; } return res; });
      const inserted = await sb('posts', { method: 'POST', body: rows, prefer: 'return=representation' });
      const risky = policy.filter((x) => x.level !== 'ok').length;
      if (risky) await chatEvent('guard', pick([`ระบบตรวจนโยบายเจอโพสต์เสี่ยง ${risky} ชิ้นครับ แจ้งคุณแดนในเช็คลิสต์แล้ว`, `เตือนครับ มีโพสต์เข้าข่ายผิดนโยบายแพลตฟอร์ม ${risky} ชิ้น ใครเขียนมาช่วยแก้ด้วย`]), 'policy');
      if (rows.some((r) => r.kind === 'reel' && r.source === 'clip')) await chatEvent('clip', pick(['ส่งคลิปใหม่เข้าคิวแล้วครับ ตั้งเวลาโพสต์ไว้แล้ว 🎬', 'คลิปวันนี้เสร็จแล้วครับ รอเวลาปล่อย ใครอยากดูก่อนไปที่แท็บคอนเทนต์', 'ตัดเสร็จแล้วครับ วันนี้ธีมเด็ด ขอเสียงหน่อย']), 'reel');
      return res.status(200).json({ ok: true, inserted: inserted.length, ids: inserted.map((r) => r.id), policy: policy.map((x, i) => ({ index: i, level: x.level, issues: x.issues.map((y) => y.msg) })), skipped_threads: skippedThreads, warning: skippedThreads ? 'Threads ยังไม่พร้อม (ยังไม่ได้เพิ่มคอลัมน์ channel) ข้ามโพสต์ช่อง Threads' : undefined });
    }
    if (action === 'mail_template') { // เทมเพลตอีเมลเตือนลูกค้าที่ยังไม่จ่าย: ทีมร่าง (key) คุณแดนแก้/กดส่งที่ห้องเอกสาร — ทีมเห็นแค่จำนวนคน ไม่เห็นอีเมล
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const row = await sb('shop_state?id=eq.private&select=data'); const data = row?.[0]?.data || {};
      if (req.method === 'POST') {
        const b = await readBody(req);
        const subject = String(b.subject || '').trim().slice(0, 150), body = String(b.body || '').trim().slice(0, 3000);
        if (!subject || !body) return res.status(400).json({ ok: false, error: 'ต้องมี subject และ body' });
        if (!body.includes('{ลิงก์}')) return res.status(400).json({ ok: false, error: 'body ต้องมี {ลิงก์} เพื่อพาลูกค้ากลับไปจ่าย' });
        data.mailTemplate = { subject, body, by: admin ? 'manual' : String(b.source || 'community').replace(/[^a-z_]/g, '').slice(0, 20), at: new Date().toISOString() };
        await sb('shop_state?id=eq.private', { method: 'PATCH', body: { data, updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
      }
      let waiting = null; try { waiting = (await listLeads()).filter((l) => !data.leadMail?.[l.email]).length; } catch (e) {}
      return res.status(200).json({ ok: true, template: data.mailTemplate || { ...LEAD_TPL, by: null }, waiting });
    }
    if (action === 'leads') { // คุณแดนเท่านั้น: รายชื่อคนที่กรอกอีเมลแล้วยังไม่จ่าย + ส่งอีเมลเตือน (คนละ 1 ครั้งต่อ 7 วัน)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const row = await sb('shop_state?id=eq.private&select=data'); const data = row?.[0]?.data || {};
      const sent = data.leadMail || {};
      if (req.method === 'PATCH') { // เปิด/ปิดให้น้องคอมส่งเตือนอัตโนมัติ
        const b = await readBody(req); data.leadAuto = !!b.auto;
        await sb('shop_state?id=eq.private', { method: 'PATCH', body: { data, updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
        return res.status(200).json({ ok: true, auto: data.leadAuto });
      }
      const leads = await listLeads();
      if (req.method === 'POST') {
        const b = await readBody(req);
        const want = new Set((b.emails || []).map((e) => String(e).toLowerCase()));
        const subject = String(b.subject || '').trim(), body = String(b.body || '').trim();
        if (!subject || !body.includes('{ลิงก์}')) return res.status(400).json({ ok: false, error: 'ต้องมีหัวเรื่อง และในเนื้อหาต้องมี {ลิงก์}' });
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return res.status(500).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Gmail' });
        const out = await sendLeadMails(leads.filter((x) => want.has(x.email)), subject, body, 'manual'); // ส่งได้เฉพาะคนที่อยู่ในรายชื่อจริง
        return res.status(200).json({ ok: true, sent: out.filter((x) => x.ok).length, results: out });
      }
      return res.status(200).json({ ok: true, auto: data.leadAuto !== false, log: data.leadLog || [], leads: leads.map((l) => ({ ...l, sent_at: sent[l.email] || null, sent_by: data.leadBy?.[l.email] || null })), template: data.mailTemplate || { ...LEAD_TPL, by: null } });
    }
    if (action === 'test_emails') { // อีเมลที่เจ้าของใช้ทดลองซื้อ: ไม่นับในรายงาน/ห้องประชุม/ติดตามลูกค้า  GET ดู · POST {emails:[...]} ตั้งใหม่
      // เจ้าของเท่านั้น: ทีม (รูทีน) ถือ content key อยู่ ห้ามเห็นหรือแก้รายชื่อนี้
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const row = await sb('shop_state?id=eq.private&select=data');
      const data = row?.[0]?.data || {};
      if (req.method === 'POST') {
        const b = await readBody(req);
        data.testEmails = [...new Set((b.emails || []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)))];
        await sb('shop_state?id=eq.private', { method: 'PATCH', body: { data, updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
      }
      return res.status(200).json({ ok: true, testEmails: data.testEmails || [] });
    }
    if (action === 'stripe_hook') { // ดูว่า webhook ของร้านฟังเหตุการณ์อะไร / POST เพิ่ม payment_intent.succeeded (จ่าย QR บนหน้าร้าน) อย่างเดียว
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const list = (await stripe('GET', 'webhook_endpoints?limit=20')).data || [];
      const ours = list.filter((w) => /\/api\/stripe-webhook/.test(w.url));
      if (req.method === 'POST' && !ours.length) { // ร้านยังไม่มี webhook เลย: สร้างใหม่ (ไม่ส่ง signing secret กลับ ตัวรับตรวจเหตุการณ์กับ Stripe เอง)
        const w = await stripe('POST', 'webhook_endpoints', { url: `${await siteUrl()}/api/stripe-webhook`, description: 'SheetLab: ส่งไฟล์หลังจ่ายเงิน (Checkout + QR บนหน้าร้าน)',
          enabled_events: ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'payment_intent.succeeded'] });
        return res.status(200).json({ ok: true, created: { id: w.id, url: w.url, status: w.status, enabled_events: w.enabled_events } });
      }
      if (req.method === 'POST') {
        const out = [];
        for (const w of ours) {
          if (w.enabled_events.includes('*') || w.enabled_events.includes('payment_intent.succeeded')) { out.push({ id: w.id, changed: false }); continue; }
          const u = await stripe('POST', `webhook_endpoints/${w.id}`, { enabled_events: [...w.enabled_events, 'payment_intent.succeeded'] });
          out.push({ id: w.id, changed: true, enabled_events: u.enabled_events });
        }
        return res.status(200).json({ ok: true, updated: out });
      }
      return res.status(200).json({ ok: true, endpoints: list.map((w) => ({ id: w.id, url: w.url, status: w.status, enabled_events: w.enabled_events })) });
    }
    if (action === 'funnel') { // ลูกค้าที่เปิดหน้าจ่ายเงินแต่ไม่จ่าย หยุดตรงขั้นไหน (อ่านอย่างเดียวจาก Stripe)
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const days = Math.min(30, Math.max(1, Number(req.query.days) || 14));
      const since = Math.floor(Date.now() / 1000) - days * 86400;
      const shop = await loadShop();
      const live = new Set((shop.products || []).filter((p) => p.status === 'published').map((p) => p.id));
      const rows = []; let after;
      for (let i = 0; i < 5; i++) {
        const r = await stripe('GET', `checkout/sessions?limit=100&created[gte]=${since}&expand[]=data.payment_intent${after ? `&starting_after=${after}` : ''}`);
        rows.push(...r.data); if (!r.has_more) break; after = r.data[r.data.length - 1].id;
      }
      const stage = (s) => {
        if (s.payment_status === 'paid') return 'paid';
        const pi = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent : null;
        if (!pi) return 'left_without_trying'; // เปิดหน้า Stripe แล้วออก ไม่ได้กดจ่ายเลย
        const t = pi.last_payment_error?.payment_method?.type || pi.payment_method_types?.[0] || '';
        if (pi.next_action?.type === 'promptpay_display_qr_code' || (pi.status === 'requires_action' && /promptpay/.test(String(pi.payment_method_types)))) return 'promptpay_qr_not_scanned';
        if (pi.last_payment_error) return `failed_${t || 'unknown'}:${pi.last_payment_error.code || pi.last_payment_error.decline_code || ''}`;
        return `pi_${pi.status}`;
      };
      const list = rows.filter((s) => live.has(s.metadata?.productId) && (s.amount_total || 0) >= 3000).map((s) => ({
        created: new Date(s.created * 1000).toISOString(), status: s.status, stage: stage(s), amount: (s.amount_total || 0) / 100,
        campaign: s.metadata?.campaign || '', email_given: !!(s.customer_details?.email || s.customer_email),
        pm_types: (s.payment_method_types || []).join(','), locale: s.locale || '',
      }));
      const count = list.reduce((m, x) => { m[x.stage] = (m[x.stage] || 0) + 1; return m; }, {});
      return res.status(200).json({ ok: true, days, total: list.length, count, sessions: list.slice(0, 80) });
    }
    if (action === 'report') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const prev = new Date(Date.now() - 14 * 864e5).toISOString();
      const all = await sb(`orders?select=created_at,paid_at,product_id,product_name,amount,status,campaign,emailed_at,session_id,email&created_at=gte.${prev}&order=created_at.desc`);
      const hasCh = await channelCol();
      const posts = await sb(`posts?select=id,status,kind,text,scheduled_at,published_at,fb_post_id${hasCh ? ',channel,th_post_id' : ''}&created_at=gte.${prev}&order=created_at.desc`);
      const shop = await loadShop();
      const priv = await sb('shop_state?id=eq.private&select=data');
      const isTest = testOrder(shop.products || [], priv?.[0]?.data?.testEmails);
      const orders = all.filter((o) => !isTest(o));
      const campaigns = priv?.[0]?.data?.campaigns || [];
      const sum = (list) => list.reduce((a, o) => a + (Number(o.amount) || 0), 0);
      const paid = orders.filter((o) => o.status === 'paid');
      const thisWeek = paid.filter((o) => o.paid_at >= since), lastWeek = paid.filter((o) => o.paid_at < since);
      return res.status(200).json({ ok: true, generatedAt: new Date().toISOString(),
        thisWeek: { orders: thisWeek.length, revenue: sum(thisWeek) }, lastWeek: { orders: lastWeek.length, revenue: sum(lastWeek) },
        byProduct: Object.entries(thisWeek.reduce((m, o) => { m[o.product_name] = (m[o.product_name] || 0) + Number(o.amount); return m; }, {})),
        byCampaign: Object.entries(thisWeek.reduce((m, o) => { const k = o.campaign || '(ไม่ได้มาจากแอด)'; m[k] = m[k] || { orders: 0, revenue: 0 }; m[k].orders++; m[k].revenue += Number(o.amount); return m; }, {})),
        campaigns, unpaidCheckouts: orders.filter((o) => o.status !== 'paid' && o.created_at >= since).length, testOrdersExcluded: all.length - orders.length, paidDelivery: thisWeek.map((o) => ({ at: o.paid_at, via: String(o.session_id || '').startsWith('pi_') ? 'qr' : 'stripe_page', emailed: !!o.emailed_at })),
        posts, products: shop.products.map((p) => ({ name: p.name, status: p.status, price: p.price })) });
    }
    if (action === 'file_uploadurl') { // อัปโหลดไฟล์ PDF สินค้าจากหน้าแก้สินค้า (แอดมิน) ผ่าน signed URL ไม่ต้องพึ่งสิทธิ์ฝั่งเบราว์เซอร์
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const body = await readBody(req);
      const { randomUUID } = await import('node:crypto');
      let safe = String(body.filename || 'sheet.pdf').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-60) || 'sheet.pdf';
      if (!/\.pdf$/i.test(safe)) safe += '.pdf';
      const path = `files/${randomUUID()}/${safe}`;
      const r = await fetch(`${SB_URL}/storage/v1/object/upload/sign/product-images/${path}`, { method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) return res.status(500).json({ ok: false, error: `signed url: ${r.status}` });
      return res.status(200).json({ ok: true, upload_url: `${SB_URL}/storage/v1${j.url}`, file_url: `${SB_URL}/storage/v1/object/public/product-images/${path}` });
    }
    if (action === 'idea') {
      // สุ่มหัวข้อชีทใหม่ครบทุกช่องในฟอร์มสั่งผลิต (แอดมิน): หยิบจากคลังไอเดียที่ทีม Claude เติมไว้ ถ้าว่างสุ่มจากคลังหัวข้อสำเร็จรูป (OpenAI ใช้ทำรูปเท่านั้น)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const body = await readBody(req);
      const hint = String(body.hint || '').trim().slice(0, 200);
      const [shop, jobs] = await Promise.all([loadShop().catch(() => ({ products: [] })), loadJobs().catch(() => [])]);
      const have = [...shop.products.map((p) => p.name), ...jobs.filter((j) => !['cancelled', 'failed'].includes(j.status)).map((j) => j.title)].map((t) => String(t || '')).filter(Boolean);
      // คลังไอเดียที่ทีม Claude (พี่โปร พี่โอ๊ค) เติมไว้ หยิบข้อแรกที่ยังไม่ใช้และไม่ซ้ำเล่มที่มี
      const bankRows = await sb('shop_state?id=eq.idea_bank&select=data').catch(() => []); const bank = bankRows?.[0]?.data?.list || [];
      const lowHave = have.map((t) => t.toLowerCase().slice(0, 16));
      const fresh = bank.find((b) => !b.used && !lowHave.some((h) => h && String(b.title).toLowerCase().startsWith(h)) && (!hint || (b.title + ' ' + b.category).toLowerCase().includes(hint.toLowerCase())));
      if (fresh) {
        fresh.used = new Date().toISOString();
        await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'idea_bank', data: { list: bank }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' }).catch(() => {});
        return res.status(200).json({ ok: true, source: 'claude', by: MEMBER_TH[fresh.by] || 'ทีม', left: bank.filter((b) => !b.used).length, idea: { title: fresh.title, category: fresh.category, pages: fresh.pages, price: fresh.price, audience: fresh.audience || '', notes: fresh.notes || '', why: fresh.why || '' } });
      }
      const { IDEA_POOL } = await import('../lib/ideas.js');
      const low = have.map((t) => t.toLowerCase().slice(0, 20));
      const pool = IDEA_POOL.filter((b) => !low.some((h) => h && String(b.t).toLowerCase().startsWith(h.slice(0, 16))) && (!hint || (b.t + ' ' + b.cat).toLowerCase().includes(hint.toLowerCase())));
      const list = pool.length ? pool : IDEA_POOL;
      const b = list[Math.floor(Math.random() * list.length)];
      return res.status(200).json({ ok: true, source: 'pool', left: 0, idea: { title: b.t, category: b.cat, pages: b.pages, price: b.price, audience: b.level ? `ระดับ ${b.level}` : '', notes: b.notes || '', why: '' } });
    }
    if (action === 'idea_bank') {
      // ทีม Claude เติมไอเดียเล่มใหม่ (key POST {source, ideas:[{title,category,pages,price,audience,notes,why}]}) · GET ดูจำนวนคงเหลือ
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const rows = await sb('shop_state?id=eq.idea_bank&select=data'); let list = rows?.[0]?.data?.list || [];
      if (req.method !== 'POST') return res.status(200).json({ ok: true, left: list.filter((b) => !b.used).length, list: list.slice(-40) });
      const body = await readBody(req); const by = MEMBER_TH[body.source] ? String(body.source) : 'product';
      if (Array.isArray(body.remove) && body.remove.length) { // เอาไอเดียที่ยังไม่ใช้ออก ตามคำในชื่อเล่ม
        const kw = body.remove.map((k) => String(k || '').toLowerCase().trim()).filter((k) => k.length >= 2);
        const before = list.length; list = list.filter((b) => b.used || !kw.some((k) => String(b.title).toLowerCase().includes(k)));
        await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'idea_bank', data: { list }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
        return res.status(200).json({ ok: true, removed: before - list.length, left: list.filter((b) => !b.used).length });
      }
      const seen = new Set(list.map((b) => String(b.title).toLowerCase())); let added = 0;
      for (const x of (Array.isArray(body.ideas) ? body.ideas : []).slice(0, 15)) {
        const title = String(x?.title || '').trim().slice(0, 120); if (title.length < 8 || seen.has(title.toLowerCase())) continue; seen.add(title.toLowerCase());
        list.push({ title, category: String(x.category || '').slice(0, 60), pages: Math.min(200, Math.max(10, Number(x.pages) || 60)), price: Math.max(0, Number(x.price) || 0), audience: String(x.audience || '').slice(0, 200), notes: String(x.notes || '').slice(0, 600), why: String(x.why || '').slice(0, 200), by, created_at: new Date().toISOString() }); added++;
      }
      list = list.filter((b) => !b.used).concat(list.filter((b) => b.used).slice(-30)).slice(-120);
      await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'idea_bank', data: { list }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
      return res.status(200).json({ ok: true, added, left: list.filter((b) => !b.used).length });
    }
    if (action === 'hit') {
      // นับผู้เข้าชมแต่ละส่วนของเว็บ (สาธารณะ ไม่เก็บข้อมูลส่วนตัว): หน้าเว็บส่งครั้งเดียวต่อคนต่อส่วนต่อวัน · เก็บ 60 วันใน shop_state hits
      if (req.method !== 'POST') return res.status(405).end();
      const ua = String(req.headers['user-agent'] || '');
      if (/bot|crawl|spider|slurp|facebookexternalhit|headless|preview/i.test(ua)) return res.status(204).end();
      const body = await readBody(req);
      const k = String(body.s || '');
      if (!/^(store|order|quiz|learn|daily|p\/[a-z0-9-]{1,70}|quiz\/[a-z0-9-]{1,70}|learn\/[a-z0-9-]{1,70})$/.test(k)) return res.status(204).end();
      try {
        const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
        const rows = await sb('shop_state?id=eq.hits&select=data'); const d = rows?.[0]?.data || { days: {} }; const days = d.days || {};
        days[day] = days[day] || {}; days[day][k] = (days[day][k] || 0) + 1;
        const keep = {}; Object.keys(days).sort().slice(-60).forEach((x) => { keep[x] = days[x]; });
        await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'hits', data: { days: keep }, updated_at: '2000-01-01T00:00:00Z' }], prefer: 'resolution=merge-duplicates,return=minimal' });
      } catch (e) { console.error('hit', e.message); }
      return res.status(204).end();
    }
    if (action === 'openai_check') { // เช็คว่าใส่ OPENAI_API_KEY แล้วและใช้โมเดลสร้างรูปได้ (อ่านข้อมูลโมเดล ไม่สร้างรูป ไม่เสียเงิน)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const KEY = process.env.OPENAI_API_KEY || '', model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
      if (!KEY) return res.status(200).json({ ok: false, configured: false, error: 'ยังไม่ได้ใส่ OPENAI_API_KEY' });
      const r = await fetch(`https://api.openai.com/v1/models/${model}`, { headers: { Authorization: `Bearer ${KEY}` } }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      let imageModels = []; // โมเดลสร้างรูปที่บัญชีนี้ใช้ได้ (ไว้ให้เลือกในหลังบ้าน)
      try { const m = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${KEY}` } }).then((x) => x.json()); imageModels = (m.data || []).map((x) => x.id).filter((id) => /image|dall-e/i.test(id)).sort(); } catch (e) {}
      return res.status(200).json({ ok: !!(r && r.ok), configured: true, model, imageModels, status: r ? r.status : 0, error: r && r.ok ? null : (j?.error?.message || 'เชื่อมต่อ OpenAI ไม่ได้').slice(0, 200) });
    }
    if (action === 'cover') {
      // สร้างรูปปกด้วย OpenAI Images (คีย์อยู่ใน Vercel env OPENAI_API_KEY เท่านั้น) · คุณแดนกดจากหน้าแก้สินค้า ครั้งละ 1 รูป
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      const diag = !admin && keyOk(req) && req.query.diag === '1'; // ทดสอบระบบ: คุณภาพต่ำสุด คืนแค่เวลา/ขนาด ไม่คืนรูป
      if (!admin && !diag) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const KEY = process.env.OPENAI_API_KEY || '';
      if (!KEY) return res.status(400).json({ ok: false, error: 'ยังไม่ได้ใส่ OPENAI_API_KEY ใน Vercel (Settings → Environment Variables) ใส่แล้วกด Redeploy' });
      const body = await readBody(req); if (diag) body.quality = 'low';
      const t0 = Date.now();
      const prompt = String(body.prompt || '').trim().slice(0, 3000);
      if (prompt.length < 20) return res.status(400).json({ ok: false, error: 'คำสั่งสั้นเกินไป' });
      try {
        const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
          // คุณแดนเลือกโมเดล/คุณภาพได้ในหลังบ้าน (ค่าตั้งต้น gpt-image-2)
          body: JSON.stringify({ model: /^(gpt-image|chatgpt-image)[a-z0-9.\-]{0,40}$/.test(String(body.model || '')) ? String(body.model) : (process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'), prompt, size: '1024x1024', output_format: 'jpeg', output_compression: 90, quality: ['low', 'medium', 'high'].includes(body.quality) ? body.quality : (process.env.OPENAI_IMAGE_QUALITY || 'medium'), n: 1 }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return res.status(502).json({ ok: false, error: `OpenAI: ${j?.error?.message || r.status}` });
        const b64 = j?.data?.[0]?.b64_json;
        if (!b64) return res.status(502).json({ ok: false, error: 'OpenAI ไม่ส่งรูปกลับมา ลองใหม่อีกครั้ง' });
        if (diag) return res.status(200).json({ ok: true, ms: Date.now() - t0, kb: Math.round(b64.length * 0.75 / 1024) });
        return res.status(200).json({ ok: true, image: `data:image/jpeg;base64,${b64}` });
      } catch (e) { return res.status(502).json({ ok: false, error: 'เชื่อมต่อ OpenAI ไม่ได้: ' + String(e.message || e).slice(0, 120) }); }
    }
    if (action.startsWith('rl_')) {
      // ReadLab: เพจหนังสือ/การอ่านแยกจาก SheetLab (สร้างผู้ติดตามก่อน) · ข้อมูลอยู่แถว shop_state readlab แยกจากตาราง posts
      // จึงไม่มีทางหลุดไปโพสต์บนเพจ SheetLab · ทีม ReadLab ใช้ key · คุณแดนอนุมัติ/แก้/ปัดตก/บันทึกผู้ติดตามในแท็บคอนเทนต์ > ReadLab
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      const isKey = keyOk(req);
      if (!admin && !isKey) return res.status(401).json({ ok: false, error: 'bad key' });
      const RL_TEAM = { rl_lead: 'พี่บุ๊ค', rl_writer: 'น้องมิว', rl_design: 'น้องพิกเซล', rl_clip: 'น้องรีล' };
      const RL_KIND = { quote: 'ข้อคิดจากการอ่าน', book: 'แนะนำหนังสือ', habit: 'นิสัยการอ่าน', question: 'ชวนคุย', reel: 'คลิป Reels' };
      const RL_PREFIX = `${SB_URL}/storage/v1/object/public/product-images/readlab/`;
      const rows = await sb('shop_state?id=eq.readlab&select=data'); const D = rows?.[0]?.data || {};
      D.posts = D.posts || []; D.notes = D.notes || []; D.cfg = D.cfg || {}; D.followers = D.followers || {};
      const save = () => sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'readlab', data: D, updated_at: '2000-01-01T00:00:00Z' }], prefer: 'resolution=merge-duplicates,return=minimal' });
      const now = new Date().toISOString();
      const media = (u) => { const x = String(u || '').trim(); return x.startsWith(RL_PREFIX) && /^[A-Za-z0-9._\/-]+$/.test(x.slice(RL_PREFIX.length)) ? x : ''; };
      if (action === 'rl_board' || action === 'rl_list') {
        const posts = D.posts.slice(-300);
        const count = (st) => posts.filter((x) => x.status === st).length;
        const fdays = Object.keys(D.followers).sort().slice(-30).map((d) => ({ date: d, ...D.followers[d] }));
        const out = { ok: true, cfg: D.cfg, followers: fdays, counts: { draft: count('draft'), approved: count('approved'), published: count('published'), rejected: count('rejected') }, notes: D.notes.slice(-12) };
        if (action === 'rl_list') {
          if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
          // เชื่อมบัญชีแล้ว: ดึงยอดผู้ติดตามจริงมาบันทึกวันนี้แทนการกรอกเอง
          const fbR = await loadFb('readlab').catch(() => null); let thR = await loadThreads('readlab').catch(() => ({})); thR = threadsConnected(thR) ? thR : null;
          const conn = { fb: fbR ? { id: fbR.pageId, name: fbR.pageName || '' } : null, th: thR ? { username: thR.username || '' } : null };
          if (fbR || thR) {
            const dk = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); const cur = { ...(D.followers[dk] || {}) }; let changed = false;
            if (fbR) { try { const pg = await fbGet(fbR.pageId, { fields: 'followers_count,fan_count', access_token: fbR.token }); const n = pg.followers_count ?? pg.fan_count; if (n != null && n !== cur.fb) { cur.fb = n; changed = true; } } catch (e) { conn.fbErr = String(e.message || e).slice(0, 120); } }
            if (thR) { try { const u = await thGet(`${thR.userId}/threads_insights`, { metric: 'followers_count', access_token: thR.token }); const n = u.data?.[0]?.total_value?.value ?? u.data?.[0]?.values?.[0]?.value; if (n != null && n !== cur.th) { cur.th = n; changed = true; } } catch (e) { conn.thErr = String(e.message || e).slice(0, 120); } }
            if (changed) { D.followers[dk] = { fb: cur.fb || 0, th: cur.th || 0 }; await save(); out.followers = Object.keys(D.followers).sort().slice(-30).map((d) => ({ date: d, ...D.followers[d] })); }
          }
          return res.status(200).json({ ...out, posts, connect: conn });
        }
        // ทีมเห็นโพสต์ล่าสุด 60 ชิ้น (กันซ้ำ) + สิ่งที่คุณแดนปัดตก/แก้ (เรียนรู้รสนิยม)
        return res.status(200).json({ ...out, guide: RL_GUIDE, team: RL_TEAM, kinds: RL_KIND,
          recent: posts.slice(-60).map((x) => ({ id: x.id, by: x.source, channel: x.channel, kind: x.kind, status: x.status, has_media: !!(x.image_url || x.video_url), text: String(x.text).slice(0, 160), book: x.book || '', owner_note: x.owner_note || '', edited: !!x.edited })),
          need_image: posts.filter((x) => x.status === 'draft' && x.channel === 'facebook' && x.kind !== 'reel' && !x.image_url).map((x) => ({ id: x.id, kind: x.kind, text: x.text, book: x.book || '' })).slice(0, 8) });
      }
      if (req.method !== 'POST') return res.status(405).json({ ok: false });
      const body = await readBody(req);
      if (action === 'rl_media') { // signed URL อัปโหลดรูป/คลิปของ ReadLab
        const ext = ({ png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', mp4: 'mp4' })[String(body.ext || 'png').toLowerCase()];
        if (!ext) return res.status(400).json({ ok: false, error: 'ext ต้องเป็น png jpg webp หรือ mp4' });
        const { randomUUID } = await import('node:crypto');
        const path = `readlab/${now.slice(0, 10)}-${randomUUID().slice(0, 8)}.${ext}`;
        const r = await fetch(`${SB_URL}/storage/v1/object/upload/sign/product-images/${path}`, { method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: '{}' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) return res.status(500).json({ ok: false, error: `signed url: ${r.status}` });
        return res.status(200).json({ ok: true, upload_url: `${SB_URL}/storage/v1${j.url}`, url: `${RL_PREFIX}${path.slice(8)}`, content_type: ext === 'mp4' ? 'video/mp4' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}` });
      }
      if (action === 'rl_post') { // ทีมส่งร่างโพสต์ (สูงสุด 10 ชิ้นต่อครั้ง) → รอคุณแดนอนุมัติ
        const src = RL_TEAM[body.source] ? String(body.source) : 'rl_writer';
        const seen = new Set(D.posts.map((x) => String(x.text).replace(/\s+/g, '').slice(0, 80)));
        const added = [], errors = [];
        for (const x of (Array.isArray(body.posts) ? body.posts : []).slice(0, 10)) {
          const channel = x?.channel === 'threads' ? 'threads' : 'facebook';
          const text = String(x?.text || '').replace(/\r/g, '').trim();
          const kind = RL_KIND[x?.kind] ? x.kind : 'quote';
          const max = channel === 'threads' ? 500 : 2000;
          if (text.length < 20 || text.length > max) { errors.push(`ข้อความต้องยาว 20-${max} ตัวอักษร (${channel})`); continue; }
          const key = text.replace(/\s+/g, '').slice(0, 80); if (seen.has(key)) { errors.push('ซ้ำกับโพสต์เดิม'); continue; } seen.add(key);
          if ((x.image_url && !media(x.image_url)) || (x.video_url && !media(x.video_url))) { errors.push('รูป/คลิปต้องอัปโหลดผ่าน rl_media'); continue; }
          const id = 'rl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          D.posts.push({ id, source: src, channel, kind, text, image_url: media(x.image_url) || null, video_url: media(x.video_url) || null, book: String(x.book || '').slice(0, 160), notes: String(x.notes || '').slice(0, 400), scheduled_at: /^\d{4}-\d\d-\d\d/.test(String(x.scheduled_at || '')) ? String(x.scheduled_at) : null, status: 'draft', created_at: now });
          added.push(id);
        }
        D.posts = D.posts.filter((x) => x.status !== 'rejected').slice(-350).concat(D.posts.filter((x) => x.status === 'rejected').slice(-50)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        await save();
        return res.status(200).json({ ok: added.length > 0, added, errors });
      }
      if (action === 'rl_attach') { // น้องพิกเซล/น้องรีลผูกรูปหรือคลิปกับร่างที่มีอยู่
        const x = D.posts.find((y) => y.id === String(body.id || ''));
        if (!x) return res.status(404).json({ ok: false, error: 'ไม่พบโพสต์' });
        if (x.status === 'published') return res.status(400).json({ ok: false, error: 'โพสต์แล้ว แก้ไม่ได้' });
        const img = media(body.image_url), vid = media(body.video_url);
        if (!img && !vid) return res.status(400).json({ ok: false, error: 'ต้องมี image_url หรือ video_url จาก rl_media' });
        if (img) x.image_url = img; if (vid) x.video_url = vid; x.media_by = RL_TEAM[body.source] ? String(body.source) : 'rl_design'; x.updated_at = now;
        await save(); return res.status(200).json({ ok: true, id: x.id });
      }
      if (action === 'rl_note') { // แผนสัปดาห์/รายงานของพี่บุ๊ค
        const text = String(body.text || '').trim().slice(0, 4000);
        if (text.length < 20) return res.status(400).json({ ok: false, error: 'ข้อความสั้นเกินไป' });
        D.notes.push({ by: RL_TEAM[body.source] ? String(body.source) : 'rl_lead', kind: body.kind === 'report' ? 'report' : 'plan', text, at: now }); D.notes = D.notes.slice(-40);
        await save(); return res.status(200).json({ ok: true });
      }
      if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      if (action === 'rl_update') { // คุณแดน: approve | reject | edit | posted | unpost | delete
        const x = D.posts.find((y) => y.id === String(body.id || ''));
        if (!x) return res.status(404).json({ ok: false, error: 'ไม่พบโพสต์' });
        const op = String(body.op || '');
        if (typeof body.text === 'string' && body.text.trim() && body.text.trim() !== x.text) { x.text = body.text.trim().slice(0, 2200); x.edited = true; }
        if ('scheduled_at' in body) x.scheduled_at = body.scheduled_at ? String(body.scheduled_at) : null;
        if (typeof body.owner_note === 'string') x.owner_note = body.owner_note.slice(0, 300);
        if (op === 'approve') x.status = 'approved';
        else if (op === 'reject') x.status = 'rejected';
        else if (op === 'posted') { x.status = 'published'; x.published_at = now; }
        else if (op === 'unpost') { x.status = 'approved'; delete x.published_at; }
        else if (op === 'delete') D.posts = D.posts.filter((y) => y.id !== x.id);
        else if (op === 'publish_now') { if (!['approved', 'failed', 'draft'].includes(x.status)) return res.status(400).json({ ok: false, error: 'โพสต์นี้ขึ้นไปแล้ว' }); x.status = 'approved'; }
        x.updated_at = now; await save();
        if (op === 'publish_now') { const r = await publishReadlab(x.id); const rows2 = await sb('shop_state?id=eq.readlab&select=data'); const y = (rows2?.[0]?.data?.posts || []).find((z) => z.id === x.id); const rr = (r.results || [])[0]; return res.status(200).json({ ok: !!(rr && rr.ok), error: rr ? rr.error : (r.skipped || 'ยังไม่ได้เชื่อมช่องทางนี้ของ ReadLab'), post: y || x }); }
        return res.status(200).json({ ok: true, post: op === 'delete' ? null : x });
      }
      if (action === 'rl_cfg') { // ชื่อเพจ/บัญชี Threads + บันทึกยอดผู้ติดตาม (กรอกเองจนกว่าจะเชื่อม API)
        if (typeof body.fb_page === 'string') D.cfg.fb_page = body.fb_page.trim().slice(0, 200);
        if (typeof body.threads === 'string') D.cfg.threads = body.threads.trim().replace(/^@/, '').slice(0, 60);
        if (body.fb != null || body.th != null) { const d = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); D.followers[d] = { fb: Math.max(0, Number(body.fb) || 0), th: Math.max(0, Number(body.th) || 0) }; }
        D.cfg.updated_at = now; await save();
        return res.status(200).json({ ok: true, cfg: D.cfg });
      }
      return res.status(400).json({ ok: false, error: 'unknown rl action' });
    }
    if (action === 'article_imageurl' || action === 'article_image') {
      // รูปปกบทความคลังความรู้ (ทีมคอนเทนต์ทำจาก Canva): article_imageurl ขอ signed URL อัปโหลดเข้าคลังรูปร้าน · article_image ผูกรูปกับบทความ
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      if (req.method !== 'POST') return res.status(405).json({ ok: false });
      const body = await readBody(req);
      const slug = String(body.slug || '').toLowerCase();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 70) return res.status(400).json({ ok: false, error: 'slug ไม่ถูกต้อง' });
      if (action === 'article_imageurl') {
        const ext = ({ png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp' })[String(body.ext || 'png').toLowerCase()];
        if (!ext) return res.status(400).json({ ok: false, error: 'ext ต้องเป็น png jpg หรือ webp' });
        const path = `learn/${slug}-${Date.now().toString(36)}.${ext}`;
        const r = await fetch(`${SB_URL}/storage/v1/object/upload/sign/product-images/${path}`, { method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: '{}' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) return res.status(500).json({ ok: false, error: `signed url: ${r.status}` });
        return res.status(200).json({ ok: true, upload_url: `${SB_URL}/storage/v1${j.url}`, image_url: `${SB_URL}/storage/v1/object/public/product-images/${path}`, content_type: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` });
      }
      const { cleanImg } = await import('../lib/quiz.js');
      const image = cleanImg(body.image);
      if (!image && body.image !== '') return res.status(400).json({ ok: false, error: 'image ต้องเป็น image_url จาก article_imageurl' });
      const rows = await sb('shop_state?id=eq.articles&select=data'); const list = rows?.[0]?.data?.list || [];
      const a = list.find((x) => x.slug === slug);
      if (!a) return res.status(404).json({ ok: false, error: 'ไม่พบบทความ' });
      if (image) a.image = image; else delete a.image;
      await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'articles', data: { list }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
      return res.status(200).json({ ok: true, slug, image: a.image || null });
    }
    if (action === 'article' || action === 'article_hide') {
      // คลังความรู้: ทีมคอนเทนต์ส่ง/แก้ด้วย key (POST ตาม slug ขึ้นเว็บทันที) · คุณแดนซ่อน/เปิดได้ (article_hide แอดมิน)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const rows = await sb('shop_state?id=eq.articles&select=data'); const list = rows?.[0]?.data?.list || [];
      const saveA = (l) => sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'articles', data: { list: l }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
      if (action === 'article_hide') {
        if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
        const body = await readBody(req); const a = list.find((x) => x.slug === String(body.slug || ''));
        if (!a) return res.status(404).json({ ok: false, error: 'not found' });
        a.status = body.hidden ? 'hidden' : 'live'; a.updated_at = new Date().toISOString(); await saveA(list);
        return res.status(200).json({ ok: true, status: a.status });
      }
      if (req.method !== 'POST') { const SU = await siteUrl(); return res.status(200).json({ ok: true, list: list.map((a) => ({ slug: a.slug, title: a.title, desc: a.desc, cat: a.cat, image: a.image || null, quiz_slug: a.quiz_slug, status: a.status, by: a.by, created_at: a.created_at, updated_at: a.updated_at, chars: a.body.length, url: `${SU}/learn/${a.slug}`, ...(req.query.full ? { body: a.body } : {}) })) }); }
      const body = await readBody(req);
      const { cleanArticle } = await import('../lib/quiz.js');
      const r = cleanArticle(body); if (r.error) return res.status(400).json({ ok: false, error: r.error });
      const src = MEMBER_TH[body.source] ? String(body.source) : 'writer';
      const old = list.find((x) => x.slug === r.article.slug); const now = new Date().toISOString();
      if (old) Object.assign(old, r.article, { updated_at: now, by: src }); else list.push({ ...r.article, status: 'live', by: src, created_at: now, updated_at: now });
      await saveA(list);
      const url = `${await siteUrl()}/learn/${r.article.slug}`;
      await logNote(src, `${old ? 'แก้' : 'ลง'}บทความคลังความรู้: ${r.article.title} ${url}`, 'article');
      return res.status(200).json({ ok: true, url, updated: !!old });
    }
    if (action === 'quiz' || action === 'quiz_hide') {
      // แบบทดสอบบนเว็บ: ทีมคอนเทนต์ส่ง/แก้ด้วย key (POST ตาม slug) · คุณแดนซ่อน/เปิดได้ (quiz_hide แอดมิน)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const rows = await sb('shop_state?id=eq.quizzes&select=data'); const list = rows?.[0]?.data?.list || [];
      const saveQ = (l) => sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'quizzes', data: { list: l }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
      if (action === 'quiz_hide') {
        if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
        const body = await readBody(req); const q = list.find((x) => x.slug === String(body.slug || ''));
        if (!q) return res.status(404).json({ ok: false, error: 'not found' });
        q.status = body.hidden ? 'hidden' : 'live'; q.updated_at = new Date().toISOString(); await saveQ(list);
        return res.status(200).json({ ok: true, status: q.status });
      }
      if (req.method !== 'POST') { const SU = await siteUrl(); return res.status(200).json({ ok: true, list: list.map((q) => ({ ...q, n: q.questions.length, url: `${SU}/quiz/${q.slug}` })) }); }
      const body = await readBody(req);
      const { cleanQuiz } = await import('../lib/quiz.js');
      const r = cleanQuiz(body); if (r.error) return res.status(400).json({ ok: false, error: r.error });
      const src = MEMBER_TH[body.source] ? String(body.source) : 'writer';
      const old = list.find((x) => x.slug === r.quiz.slug); const now = new Date().toISOString();
      if (old) Object.assign(old, r.quiz, { updated_at: now, by: src }); else list.push({ ...r.quiz, status: 'live', by: src, created_at: now, updated_at: now });
      await saveQ(list);
      const url = `${await siteUrl()}/quiz/${r.quiz.slug}`;
      await logNote(src, `${old ? 'แก้' : 'ลง'}แบบทดสอบบนเว็บ: ${r.quiz.title} (${r.quiz.questions.length} ข้อ) ${url}`, 'quiz');
      return res.status(200).json({ ok: true, url, updated: !!old });
    }
    if (action === 'store_audit') { // พี่โอ๊ค CEO หน้าร้าน: สภาพชั้นวางทุกเล่ม (รวมร่าง/หน้าร้านอย่างเดียว) ยอดจากหน้าร้าน คิวโรงงาน ไม่มีข้อมูลลูกค้า
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const [main, priv, orders, jobs] = await Promise.all([sb('shop_state?id=eq.main&select=data'), sb('shop_state?id=eq.private&select=data'), sb(`orders?status=eq.paid&select=product_id,product_name,amount,email,campaign,paid_at,created_at&created_at=gte.${new Date(Date.now() - 30 * 864e5).toISOString()}`), loadJobs().catch(() => [])]);
      const products = main?.[0]?.data?.products || [], links = priv?.[0]?.data?.links || {};
      const isTest = testOrder(products, priv?.[0]?.data?.testEmails || []);
      const real = orders.filter((o) => !isTest(o)), wk = Date.now() - 7 * 864e5;
      const sold = {}; real.forEach((o) => { if (o.product_id) sold[o.product_id] = (sold[o.product_id] || 0) + 1; });
      const live = products.filter((p) => p.status === 'published' && p.sell !== 'salepage');
      const SITE = await siteUrl();
      return res.status(200).json({ ok: true, storeLive: live.length >= 2, storeMin: 2, liveInStore: live.length,
        products: products.map((p) => ({ id: p.id, name: p.name, type: p.type === 'bundle' ? 'bundle' : 'single', status: p.status, sell: p.sell || 'both', cat: p.cat || '', price: p.price, fullPrice: p.fullPrice || 0,
          images: (p.images || []).length, previews: (p.previews || []).length, hasFile: p.type === 'bundle' ? null : !!links[p.id], items: p.type === 'bundle' ? (p.items || []).length : undefined,
          publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null, sold30: sold[p.id] || 0, headline: p.headline || '', desc: String(p.desc || '').slice(0, 200), url: `${SITE}/p/${p.slug}` })),
        storeSales: { orders7: real.filter((o) => o.campaign === 'store' && Date.parse(o.paid_at || o.created_at) >= wk).length, orders30: real.filter((o) => o.campaign === 'store').length, allOrders30: real.length },
        factory: { awaitingApproval: jobs.filter((j) => j.listing === 'pending').map((j) => ({ title: j.title, price: j.price, pages: j.pages, days: Math.floor((Date.now() - Date.parse(j.done_at || j.created_at)) / 864e5) })),
          queued: jobs.filter((j) => ['queued', 'producing'].includes(j.status)).map((j) => ({ title: j.title, status: j.status, price: j.price })), listedRecently: jobs.filter((j) => j.listing === 'listed' && Date.parse(j.listing_at || 0) >= Date.now() - 14 * 864e5).map((j) => j.title) } });
    }
    if (action === 'proposal' || action === 'proposal_done') {
      // ข้อเสนอแก้ข้อความสินค้าจาก CEO (key POST) → คุณแดนเปิดในตัวแก้ไขพร้อมตัวอย่างสด แล้วกดบันทึกเอง (แอดมินปิดข้อเสนอ) ห้ามแตะราคา
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const rows = await sb('shop_state?id=eq.proposals&select=data'); let list = rows?.[0]?.data?.list || [];
      const saveList = (l) => sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'proposals', data: { list: l.slice(-60) }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
      if (action === 'proposal_done') {
        if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
        const body = await readBody(req); const it = list.find((x) => x.id === String(body.id || ''));
        if (!it) return res.status(404).json({ ok: false, error: 'not found' });
        it.status = body.applied ? 'applied' : 'rejected'; it.done_at = new Date().toISOString(); await saveList(list);
        await logNote(it.source, `คุณแดน${body.applied ? 'ใช้' : 'ไม่ใช้'}ข้อเสนอ: ${it.title}`);
        return res.status(200).json({ ok: true });
      }
      if (req.method !== 'POST') return res.status(200).json({ ok: true, list: list.filter((x) => !req.query.status || x.status === req.query.status) });
      const body = await readBody(req);
      const ALLOW = ['headline', 'desc', 'features', 'pains', 'faq', 'forwho', 'notfor', 'guarantee', 'proof', 'specs', 'cat', 'sell', 'name'];
      const main = await sb('shop_state?id=eq.main&select=data'); const prod = (main?.[0]?.data?.products || []).find((p) => p.id === String(body.product_id || ''));
      if (!prod) return res.status(400).json({ ok: false, error: 'ไม่พบสินค้า product_id' });
      const fields = {}; for (const k of ALLOW) if (body.fields && typeof body.fields[k] === 'string' && body.fields[k].trim() && body.fields[k] !== prod[k]) fields[k] = body.fields[k].slice(0, 3000);
      if (!Object.keys(fields).length) return res.status(400).json({ ok: false, error: `ไม่มีช่องที่เปลี่ยน (แก้ได้เฉพาะ ${ALLOW.join(', ')} ห้ามราคา)` });
      const src = ['ceo_sale', 'ceo_store', 'product', 'manager'].includes(body.source) ? body.source : 'manager';
      list = list.filter((x) => !(x.status === 'pending' && x.product_id === prod.id && x.source === src)); // ข้อเสนอใหม่แทนอันเก่าที่ยังค้างของคนเดียวกัน
      const { randomUUID } = await import('node:crypto');
      const it = { id: randomUUID(), status: 'pending', source: src, product_id: prod.id, product_name: prod.name, title: String(body.title || 'ปรับข้อความหน้าขาย').slice(0, 120), why: String(body.why || '').slice(0, 1200), fields, created_at: new Date().toISOString() };
      list.push(it); await saveList(list);
      try { await addTodo({ text: `ข้อเสนอจาก ${MEMBER_TH[src]}: ${it.title} (${prod.name}) เปิดแท็บสินค้าและเซลเพจ → ข้อเสนอจาก CEO ดูตัวอย่างแล้วกดบันทึกถ้าเห็นด้วย`, type: 'decide', from: src }); } catch (e) {}
      return res.status(200).json({ ok: true, id: it.id, fields: Object.keys(fields) });
    }
    if (action === 'note') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      if (!String(body.text || '').trim()) return res.status(400).json({ ok: false, error: 'no text' });
      const row = { status: 'note', source: String(body.source || 'manager').slice(0, 20), kind: String(body.kind || 'report').slice(0, 20), text: String(body.text).slice(0, 8000), week: body.week ? String(body.week).slice(0, 12) : null };
      const inserted = await sb('posts', { method: 'POST', body: [row], prefer: 'return=representation' });
      return res.status(200).json({ ok: true, id: inserted[0]?.id });
    }
    if (action === 'sold') {
      // จำนวนที่ขายแล้วต่อสินค้า (สาธารณะ ไม่มีข้อมูลลูกค้า) นับจากออเดอร์ที่ชำระแล้ว แคช 5 นาที
      // นับเฉพาะยอดขายจริง: ตัดออเดอร์ทดสอบ (สินค้าร่าง ราคาทดสอบ อีเมลที่เจ้าของใช้ทดลองซื้อ)
      const [rows, pr] = await Promise.all([sb('orders?status=eq.paid&select=product_id,product_name,amount,email'), sb('shop_state?id=eq.private&select=data').catch(() => [])]);
      const isTest = testOrder(null, pr?.[0]?.data?.testEmails || []);
      const counts = {}; for (const r of rows) if (r.product_id && !isTest(r)) counts[r.product_id] = (counts[r.product_id] || 0) + 1;
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).json({ ok: true, counts });
    }
    if (action === 'comment') {
      // คอมเมนต์ใต้โพสต์ในห้องประชุม (kind comment, notes {on:<post id>}): key POST {comments:[{on,source,text,at?}]} | แอดมิน POST {on,text} (=คุณแดน) | แอดมิน {id,remove:true}
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
      const body = await readBody(req);
      if (admin && body.remove && /^[0-9a-f-]{36}$/.test(String(body.id || ''))) { await sb(`posts?id=eq.${body.id}&kind=eq.comment`, { method: 'DELETE', prefer: 'return=minimal' }); return res.status(200).json({ ok: true }); }
      if (body.release_all) {
        // ปล่อยคอมเมนต์ที่ตั้งเวลาไว้ให้เห็นทันที (คุณแดนอยากดูตอนนี้)
        const rel = await sbPatch(`posts?kind=eq.comment&status=eq.note&scheduled_at=gt.${new Date().toISOString()}`, { scheduled_at: null });
        return res.status(200).json({ ok: true, released: Array.isArray(rel) ? rel.length : 0 });
      }
      const list = Array.isArray(body.comments) ? body.comments : [body];
      const now = Date.now(); const rows = [];
      for (const c of list.slice(0, 30)) {
        const on = String((c && c.on) || ''); const text = String((c && c.text) || '').trim().slice(0, 500);
        if (!/^[0-9a-f-]{36}$/.test(on) || !text) continue;
        const source = admin ? 'manual' : (MEMBER_TH[c.source] ? String(c.source) : 'manager');
        let at = null; if (!admin && c.at) { const t = Date.parse(c.at); if (t && t > now - 36e5 && t < now + 2 * 864e5) at = new Date(t).toISOString(); }
        rows.push({ status: 'note', kind: 'comment', source, text, scheduled_at: at, notes: JSON.stringify({ on }) });
      }
      if (!rows.length) return res.status(400).json({ ok: false, error: 'ต้องมี on (id โพสต์) และ text' });
      await sb('posts', { method: 'POST', body: rows, prefer: 'return=minimal' });
      return res.status(200).json({ ok: true, inserted: rows.length });
    }
    if (action === 'feed') {
      // ฟีดห้องประชุมสำหรับทีมคอมเมนต์ (key): โพสต์ 2 วันล่าสุด (รายงาน โจทย์ บันทึกประชุม) พร้อมคอมเมนต์ที่มีอยู่
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const since = new Date(Date.now() - 2 * 864e5).toISOString();
      const rows = await sb(`posts?status=eq.note&created_at=gte.${since}&kind=not.in.(chat,log)&select=id,source,kind,text,notes,created_at,scheduled_at&order=created_at.desc&limit=160`);
      const pm = (n) => { try { return n ? JSON.parse(n) : {}; } catch (e) { return {}; } };
      const comments = rows.filter((r) => r.kind === 'comment');
      const posts = rows.filter((r) => r.kind !== 'comment').map((r) => ({ id: r.id, source: r.source, who: r.source === 'manual' ? 'คุณแดน' : (MEMBER_TH[r.source] || r.source), kind: r.kind, text: String(r.text || '').slice(0, 400), files: (pm(r.notes).files || []).map((f) => f.name), created_at: r.created_at, to: r.kind === 'reply' ? (String(r.text || '').match(/^@(\w+)/) || [])[1] || null : null, comments: comments.filter((c) => pm(c.notes).on === r.id).map((c) => ({ source: c.source, text: c.text, at: c.scheduled_at || c.created_at, auto_ack: !!pm(c.notes).ack })) }));
      const chats = await sb(`posts?status=eq.note&kind=eq.chat&created_at=gte.${since}&select=id,source,text,created_at,scheduled_at&order=created_at.asc&limit=200`);
      const owner_chat = chats.filter((c) => c.source === 'manual').map((c) => ({ id: c.id, text: c.text, at: c.created_at, answered: chats.some((x) => x.source !== 'manual' && (x.scheduled_at || x.created_at) > c.created_at) }));
      return res.status(200).json({ ok: true, now_utc: new Date().toISOString(), posts, owner_chat });
    }
    if (action === 'brief') {
      // โจทย์จากคุณแดนในห้องประชุม: แอดมิน POST {text, files:[{url,name,type}]} | {id, remove:true} ; GET (แอดมิน/key) 30 วันล่าสุด
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      if (req.method === 'POST') {
        if (!admin) return res.status(403).json({ ok: false, error: 'เฉพาะคุณแดน' });
        const body = await readBody(req);
        if (body.remove && /^[0-9a-f-]{36}$/.test(String(body.id || ''))) { await sb(`posts?id=eq.${body.id}&kind=eq.brief`, { method: 'DELETE', prefer: 'return=minimal' }); return res.status(200).json({ ok: true }); }
        const text = String(body.text || '').trim().slice(0, 4000);
        const files = (Array.isArray(body.files) ? body.files : []).slice(0, 8).map((f) => ({ url: String(f.url || '').slice(0, 500), name: String(f.name || 'ไฟล์').slice(0, 120), type: String(f.type || '').slice(0, 80) })).filter((f) => /^https:\/\//.test(f.url));
        if (!text && !files.length) return res.status(400).json({ ok: false, error: 'พิมพ์ข้อความหรือแนบไฟล์ก่อน' });
        const img = files.find((f) => /^image\//.test(f.type));
        const ins = await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'brief', source: 'manual', text: text || `(แนบไฟล์ ${files.length} ไฟล์)`, image_url: img ? img.url : null, notes: files.length ? JSON.stringify({ files }) : null }], prefer: 'return=representation' });
        await chatEvent('manager', pick(['คุณแดนส่งโจทย์ใหม่เข้าห้องประชุมครับ ทุกคนแวะไปอ่านก่อนเริ่มงานรอบถัดไป', 'มีโจทย์ใหม่จากคุณแดนในห้องประชุมครับ เดี๋ยวผมสรุปแบ่งงานให้', 'คุณแดนฝากเรื่องใหม่ไว้ที่ห้องประชุมครับ ใครเกี่ยวเตรียมตัว']), 'brief');
        if (ins?.[0]?.id) { try { await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'comment', source: 'manager', text: pick(['รับทราบครับ เดี๋ยวผมเรียกประชุมแบ่งงานรอบเช้า 10:30 แล้วสรุปให้ครับ', 'ได้เลยครับคุณแดน ผมอ่านแล้ว จะเอาเข้าประชุมรอบเช้าแล้วมอบหมายคนทำครับ', 'รับเรื่องครับ รอบประชุมเช้านี้จะแบ่งงานให้ทีม แล้วรายงานกลับครับ']), scheduled_at: new Date(Date.now() + (60 + Math.floor(Math.random() * 120)) * 1000).toISOString(), notes: JSON.stringify({ on: ins[0].id }) }], prefer: 'return=minimal' }); } catch (e) {} }
        return res.status(200).json({ ok: true, id: ins?.[0]?.id });
      }
      const rows = await sb(`posts?status=eq.note&kind=eq.brief&created_at=gte.${new Date(Date.now() - 30 * 864e5).toISOString()}&select=id,text,image_url,notes,created_at&order=created_at.desc&limit=40`);
      return res.status(200).json({ ok: true, briefs: rows.map((r) => { let files = []; try { files = r.notes ? (JSON.parse(r.notes).files || []) : []; } catch (e) {} return { id: r.id, text: r.text, files, created_at: r.created_at }; }) });
    }
    if (action === 'notes') {
      // อ่าน note ย้อนหลังตามชนิด/คน (key): ?kind=market&source=market&days=30 (สูงสุด 90 วัน 60 ฉบับ) ไม่รวมห้องพัก
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const days = Math.min(90, Number(req.query.days) || 14);
      const kind = String(req.query.kind || '').replace(/[^a-z_]/g, '');
      const source = String(req.query.source || '').replace(/[^a-z_]/g, '');
      const rows = await sb(`posts?status=eq.note&created_at=gte.${new Date(Date.now() - days * 864e5).toISOString()}${kind ? `&kind=eq.${kind}` : ''}${source ? `&source=eq.${source}` : ''}&select=id,source,kind,text,week,created_at&order=created_at.desc&limit=60`);
      return res.status(200).json({ ok: true, notes: rows.filter((n) => n.kind !== 'chat') });
    }
    if (action === 'board') {
      // กระดานประชุมทีม: แผนสัปดาห์ (kind plan) ล่าสุด + note ล่าสุด 1 ฉบับต่อคน + โพสต์ที่รอ/กำหนดโพสต์สัปดาห์นี้
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const since = new Date(Date.now() - 14 * 864e5).toISOString();
      const notes = await sb(`posts?status=in.(note,log)&created_at=gte.${since}&select=id,source,kind,text,week,notes,created_at&order=created_at.desc&limit=120`);
      let plan = notes.find((n) => n.kind === 'plan') || null;
      // โจทย์จากคุณแดน (kind brief จากห้องประชุม) + บันทึกประชุมล่าสุดของพี่ต้น (kind meeting) วางไว้บนสุดของแผน ทุกคนต้องเห็นก่อน
      const briefs = notes.filter((n) => n.kind === 'brief').map((n) => { let files = []; try { files = n.notes ? (JSON.parse(n.notes).files || []) : []; } catch (e) {} return { id: n.id, text: String(n.text || ''), files, created_at: n.created_at }; });
      const minutes = notes.find((n) => n.kind === 'meeting') || null;
      const byId = {}; notes.forEach((n) => { byId[n.id] = n; });
      const weekAgo2 = Date.now() - 7 * 864e5;
      const ownerComments = notes.filter((n) => n.kind === 'comment' && n.source === 'manual' && Date.parse(n.created_at) >= weekAgo2).map((n) => { let on = null; try { on = n.notes ? JSON.parse(n.notes).on : null; } catch (e) {} const tgt = on ? byId[on] : null; const where = !tgt ? 'โพสต์ในห้องประชุม' : tgt.kind === 'brief' ? 'โจทย์ของคุณแดนเอง' : tgt.kind === 'meeting' ? 'บันทึกประชุมของพี่ต้น' : `รายงานของ${MEMBER_TH[tgt.source] || tgt.source} (${tgt.kind})`; return { id: n.id, on, where, on_text: tgt ? String(tgt.text || '').split('\n')[0].slice(0, 80) : '', text: String(n.text || ''), created_at: n.created_at }; });
      if (briefs.length || minutes || ownerComments.length) {
        const bl = briefs.length ? '== โจทย์จากคุณแดน (เจ้าของร้าน) ส่งเข้าห้องประชุม สำคัญที่สุด ทำตามก่อนแผนอื่น ==\n' + briefs.map((b) => `- [${b.created_at.slice(0, 10)}] ${b.text.slice(0, 600)}${b.files.length ? ' (ไฟล์แนบ: ' + b.files.map((f) => `${f.name} ${f.url}`).join(' , ') + ')' : ''}`).join('\n') : '';
        const ml = minutes ? `== บันทึกประชุมล่าสุดของพี่ต้น (${minutes.created_at.slice(0, 10)}) แบ่งงานตามนี้ ==\n${String(minutes.text || '').slice(0, 2500)}` : '';
        const oc = ownerComments.length ? '== คุณแดนตอบ/สั่งเพิ่มในคอมเมนต์ห้องประชุม (7 วันล่าสุด) ถือเป็นการตัดสินใจของเจ้าของ ทำตามได้เลย ==\n' + ownerComments.map((c) => `- [${c.created_at.slice(0, 16).replace('T', ' ')}Z] ใต้${c.where}${c.on_text ? ` "${c.on_text}"` : ''}: "${c.text.slice(0, 400)}"`).join('\n') : '';
        const head = [bl, ml, oc].filter(Boolean).join('\n\n');
        plan = plan ? { ...plan, text: `${head}\n\n${plan.text}` } : { source: 'manual', kind: 'plan', text: head, created_at: (briefs[0] || minutes || ownerComments[0]).created_at };
      }
      // ข้อความจากเจ้าของถึงสมาชิก (kind reply, text ขึ้นต้น @<member>) 7 วันล่าสุด แนบท้ายแผนให้ทุกคนอ่านเจอ
      const weekAgo = Date.now() - 7 * 864e5;
      const cmts = notes.filter((n) => n.kind === 'comment');
      const msgs = notes.filter((n) => n.kind === 'reply' && Date.parse(n.created_at) >= weekAgo && orderState(n, cmts).state === 'open').map((n) => { const m = String(n.text || '').match(/^@(\w+)\s+([\s\S]*)$/); return m ? { id: n.id, to: m[1], name: MEMBER_TH[m[1]] || m[1], text: m[2].trim(), created_at: n.created_at } : null; }).filter(Boolean);
      if (msgs.length) {
        const block = '== คุณแดน (เจ้าของร้าน) สั่งงานถึงสมาชิกโดยตรง ถ้าถึงคุณ: ต้องทำตามในรอบนี้เป็นอันดับแรก แล้วรายงานผลกลับใต้ข้อความนั้นด้วย POST action=comment {"comments":[{"on":"<id>","source":"<source ของคุณ>","text":"ทำแล้ว: <สรุปสั้น>"}]} ถ้าทำไม่ได้ให้ตอบว่าติดอะไร ==\n' + msgs.map((m) => `- [id ${m.id}] ถึง ${m.name} (${m.to}) ${m.created_at.slice(0, 10)}: ${m.text}`).join('\n');
        plan = plan ? { ...plan, text: `${block}\n\n${plan.text}`, created_at: msgs[0].created_at > plan.created_at ? msgs[0].created_at : plan.created_at } : { source: 'manual', kind: 'plan', text: block, created_at: msgs[0].created_at };
      }
      // ตั้งค่าจากคุณแดน + เช็คลิสต์ที่เลยเวลา (พี่ต้นรับแทน) วางบนสุดของแผน
      const { items: tItems, cfg } = await todoWithDue();
      const ho = handoffBlock(tItems, cfg);
      let mailTask = '';
      try { const pr = await sb('shop_state?id=eq.private&select=data'); if (!pr?.[0]?.data?.mailTemplate?.by) mailTask = '== งานใหม่จากคุณแดน (29 ก.ย.) ถึงน้องคอม ==\nร่างเทมเพลตอีเมลเตือนลูกค้าที่กรอกอีเมลแล้วยังไม่จ่าย (ส่งครั้งเดียว สุภาพ สั้น ไม่เกิน 6 บรรทัด ไม่ใส่ส่วนลดหรือของแถม ไม่เร่งเร้า) แล้ว POST https://my-shop-lake-ten.vercel.app/api/content?action=mail_template JSON {subject, body, source:"community"} ใช้ตัวแทน {สินค้า} {ราคา} {ลิงก์} (body ต้องมี {ลิงก์}) ระบบใช้ข้อความนี้ส่งให้อัตโนมัติในนามน้องคอมทุกรอบ publish (คนละครั้ง หลังค้างจ่าย 1 ชม.) ทีมไม่เห็นอีเมลลูกค้าและไม่ต้องขอ คุณแดนดูผลที่ห้องเอกสาร GET action=mail_template ดูร่างปัจจุบันและจำนวนคนที่รอได้'; } catch (e) {}
      const topBlock = [cfgBlock(cfg), POLICY_BOARD, FORMAT_BOARD, mailTask, ho.text].filter(Boolean).join('\n\n');
      plan = plan ? { ...plan, text: `${topBlock}\n\n${plan.text}` } : { source: 'manual', kind: 'plan', text: topBlock, created_at: cfg.updated_at || new Date().toISOString() };
      const latest = {};
      for (const n of notes) { if (n.kind === 'plan' || n.kind === 'reply' || n.kind === 'chat' || n.kind === 'handoff' || n.status === 'log') continue; const k = n.source || 'manager'; if (!latest[k]) latest[k] = n; }
      const upcoming = await sb(`posts?status=in.(draft,needs_owner,approved,published)&scheduled_at=gte.${new Date(Date.now() - 2 * 864e5).toISOString()}&select=status,kind,text,scheduled_at,published_at,notes,source${(await channelCol()) ? ',channel' : ''}&order=scheduled_at.asc&limit=40`);
      return res.status(200).json({ ok: true, plan, settings: cfg, delegated_todo: ho.list, owner_briefs: briefs, owner_comments: ownerComments, minutes: minutes ? { text: minutes.text, created_at: minutes.created_at } : null, reports: latest, schedule: upcoming.map((p) => ({ status: p.status, kind: p.kind, source: p.source, channel: p.channel || 'facebook', scheduled_at: p.scheduled_at, published_at: p.published_at, headline: String(p.text || '').split('\n')[0].slice(0, 90), experiment: (String(p.notes || '').match(/ทดลอง:\s*([^\n|]+)/) || [])[1] || null })) });
    }
    if (action === 'images') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const rows = await sb(`posts?status=in.(draft,approved,needs_owner)&image_url=not.is.null&select=id,status,kind,text,image_url,scheduled_at,notes&order=scheduled_at.asc.nullslast&limit=20`);
      return res.status(200).json({ ok: true, posts: rows });
    }
    if (action === 'setimage') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      const id = String(body.id || ''), url = String(body.image_url || '').trim();
      if (!/^[0-9a-f-]{36}$/.test(id) || !/^https?:\/\//.test(url)) return res.status(400).json({ ok: false, error: 'bad id/image_url' });
      const cur = await sb(`posts?id=eq.${id}&select=id,status,notes`);
      if (!cur.length || cur[0].status === 'published' || cur[0].status === 'publishing') return res.status(400).json({ ok: false, error: 'เปลี่ยนรูปไม่ได้ (โพสต์ขึ้นเพจแล้ว)' });
      const stored = await cacheImage(url);
      const stamp = `🎨 น้องกราฟิก: ${String(body.note || 'เปลี่ยนรูปใหม่').slice(0, 200)}`;
      const rows = await sbPatch(`posts?id=eq.${id}`, { image_url: stored, notes: [cur[0].notes, stamp].filter(Boolean).join('\n') });
      return res.status(200).json({ ok: true, id, image_url: rows[0]?.image_url });
    }
    if (action === 'review') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const drafts = await sb('posts?status=eq.draft&select=*&order=scheduled_at.asc.nullslast');
      const shop = await loadShop();
      const fb = await loadFb();
      const SITE_U = await siteUrl();
      return res.status(200).json({ ok: true, fbConnected: !!fb, drafts, products: shop.products.filter((p) => p.status === 'published').map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, fullPrice: p.fullPrice, url: `${SITE_U}/p/${p.slug}` })) });
    }
    if (action === 'decide') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      const id = String(body.id || ''), decision = String(body.decision || '');
      const status = { approve: 'approved', reject: 'rejected', owner: 'needs_owner' }[decision];
      if (!/^[0-9a-f-]{36}$/.test(id) || !status) return res.status(400).json({ ok: false, error: 'bad id/decision' });
      const reason = String(body.reason || '').slice(0, 300);
      const cur = await sb(`posts?id=eq.${id}&select=id,status,notes,scheduled_at`);
      if (!cur.length) return res.status(404).json({ ok: false, error: 'not found' });
      if (!['draft', 'needs_owner'].includes(cur[0].status)) return res.status(200).json({ ok: false, error: `สถานะตอนนี้คือ ${cur[0].status} ไม่ใช่ draft` });
      if (status === 'approved' && !cur[0].scheduled_at && !body.scheduled_at) return res.status(400).json({ ok: false, error: 'โพสต์นี้ยังไม่มีเวลา ต้องส่ง scheduled_at มาด้วย' });
      const stamp = `${decision === 'approve' ? '✅' : decision === 'reject' ? '⛔' : '⚠️'} พี่ต้น: ${reason || decision}`;
      const patch = { status, notes: [cur[0].notes, stamp].filter(Boolean).join('\n'), error: null };
      if (body.text && String(body.text).trim()) patch.text = String(body.text).slice(0, 4000);
      if (status === 'approved') {
        // ตรวจนโยบายข้อความสุดท้ายก่อนอนุมัติ: ยังเสี่ยงสูง = ส่งให้คุณแดน
        const full = await sb(`posts?id=eq.${id}&select=text,channel`);
        const res2 = checkPolicy({ text: patch.text || full[0]?.text, channel: full[0]?.channel }, await loadShop().catch(() => ({ products: [] })));
        const was = policyState(cur[0].notes);
        if (res2.level === 'block') { patch.status = 'needs_owner'; patch.notes = [patch.notes, policyMark(res2)].join('\n'); await sbPatch(`posts?id=eq.${id}`, patch); return res.status(200).json({ ok: false, id, status: 'needs_owner', error: `เสี่ยงผิดนโยบาย ส่งให้คุณแดนตัดสินแล้ว: ${res2.issues.map((x) => x.msg).join(' / ')}` }); }
        if (was && was.level !== 'ok' && res2.level !== was.level) patch.notes = [patch.notes, policyMark(res2)].join('\n');
      }
      if (body.scheduled_at && !isNaN(Date.parse(body.scheduled_at))) patch.scheduled_at = new Date(body.scheduled_at).toISOString();
      const rows = await sbPatch(`posts?id=eq.${id}`, patch);
      return res.status(200).json({ ok: true, id, status: rows[0]?.status });
    }
    if (action === 'update') {
      // พี่ต้นเลื่อนเวลา/แก้ข้อความโพสต์ที่ยังไม่ขึ้นเพจ (draft, approved, needs_owner)
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ ok: false, error: 'bad id' });
      const cur = await sb(`posts?id=eq.${id}&select=id,status,notes`);
      if (!cur.length) return res.status(404).json({ ok: false, error: 'not found' });
      if (!['draft', 'approved', 'needs_owner'].includes(cur[0].status)) return res.status(200).json({ ok: false, error: `สถานะตอนนี้คือ ${cur[0].status} แก้ไม่ได้แล้ว` });
      const patch = {};
      if (body.text && String(body.text).trim()) patch.text = String(body.text).slice(0, 4000);
      if (body.scheduled_at && !isNaN(Date.parse(body.scheduled_at))) patch.scheduled_at = new Date(body.scheduled_at).toISOString();
      if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: 'ต้องส่ง text หรือ scheduled_at' });
      const reason = String(body.reason || '').slice(0, 300);
      patch.notes = [cur[0].notes, `✏️ พี่ต้น: ${reason || 'แก้ไข'}`].filter(Boolean).join('\n');
      if (patch.text) {
        const ch = await sb(`posts?id=eq.${id}&select=channel`);
        const res2 = checkPolicy({ text: patch.text, channel: ch[0]?.channel }, await loadShop().catch(() => ({ products: [] })));
        const was = policyState(cur[0].notes);
        if (res2.level !== 'ok' || was) patch.notes = [patch.notes, policyMark(res2)].join('\n');
        if (res2.level === 'block') patch.status = 'needs_owner';
      }
      const rows = await sbPatch(`posts?id=eq.${id}`, patch);
      return res.status(200).json({ ok: true, id, status: rows[0]?.status, scheduled_at: rows[0]?.scheduled_at });
    }
    if (action === 'factory') {
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const st = String(req.query.status || '');
      const all = await loadJobs();
      if (st === 'queued' && keyOk(req)) { try { await autoFillFactory(all); } catch (e) { console.error('autofill', e.message); } } // รอบผลิตของโรงงานเรียกตรงนี้ก่อนเสมอ
      const jobs = all.filter((j) => !st || j.status === st).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      return res.status(200).json({ ok: true, jobs });
    }
    if (action === 'global_list' || action === 'gumroad' || action === 'pin_post' || action === 'pin_log') {
      // ขายต่างประเทศ: global_list (key/แอดมิน) สินค้าที่ลง Gumroad แล้ว + ข้อความ Pin · gumroad (แอดมิน) ยอดขายจาก Gumroad API (env GUMROAD_ACCESS_TOKEN)
      // pin_post (key) โพสต์ Pin ผ่าน Pinterest API v5 (env PINTEREST_TOKEN, PINTEREST_BOARD_ID) · pin_log ประวัติ Pin กันซ้ำ
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const pinRows = async () => { const r = await sb('shop_state?id=eq.pins&select=data'); return r?.[0]?.data?.list || []; };
      if (action === 'global_list') {
        const jobs = (await loadJobs()).filter((j) => j.lang === 'en' && ['global', 'global_pending'].includes(j.listing));
        return res.status(200).json({ ok: true, pinterest: !!(process.env.PINTEREST_TOKEN && process.env.PINTEREST_BOARD_ID), gumroad: !!process.env.GUMROAD_ACCESS_TOKEN,
          products: jobs.map((j) => ({ id: j.id, title: j.title, listing: j.listing, links: j.global_links || null, images: j.images || [], pin_images: j.pin_images || [], copy: j.global_copy || null })) });
      }
      if (action === 'pin_log') return res.status(200).json({ ok: true, list: (await pinRows()).slice(-100) });
      if (action === 'gumroad') {
        if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
        const T = process.env.GUMROAD_ACCESS_TOKEN || '';
        if (!T) return res.status(200).json({ ok: true, connected: false });
        try {
          const g = async (path) => { const r = await fetch(`https://api.gumroad.com/v2/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(T)}`); const j = await r.json().catch(() => ({})); if (!r.ok || j.success === false) throw new Error(j.message || String(r.status)); return j; };
          const after = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
          const [p, s] = await Promise.all([g('products'), g(`sales?after=${after}`)]);
          const sales = (s.sales || []).filter((x) => !x.refunded);
          const usd = sales.reduce((a, x) => a + (Number(x.price) || 0) / 100, 0);
          return res.status(200).json({ ok: true, connected: true, products: (p.products || []).map((x) => ({ name: x.name, url: x.short_url, published: x.published, sales: x.sales_count, revenue_usd: (Number(x.sales_usd_cents) || 0) / 100 })),
            last30: { count: sales.length, usd: Math.round(usd * 100) / 100, recent: sales.slice(0, 10).map((x) => ({ product: x.product_name, usd: (Number(x.price) || 0) / 100, at: x.created_at, country: x.country || '' })) } });
        } catch (e) { return res.status(200).json({ ok: false, connected: true, error: String(e.message || e).slice(0, 200) }); }
      }
      // pin_post
      if (req.method !== 'POST') return res.status(405).json({ ok: false });
      const PT = process.env.PINTEREST_TOKEN || '', BOARD = process.env.PINTEREST_BOARD_ID || '';
      if (!PT || !BOARD) return res.status(400).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า PINTEREST_TOKEN / PINTEREST_BOARD_ID บน Vercel' });
      const body = await readBody(req);
      const img = String(body.image_url || ''), link = String(body.link || '');
      if (!img.startsWith(`${SB_URL}/storage/v1/object/public/product-images/`)) return res.status(400).json({ ok: false, error: 'image_url ต้องเป็นรูปในคลังของร้าน' });
      if (!/^https:\/\/([a-z0-9-]+\.)?(gumroad\.com|notion\.site|notion\.so|sheetlabth\.com)\//i.test(link)) return res.status(400).json({ ok: false, error: 'link ต้องไป Gumroad / Notion / sheetlabth.com' });
      const log = await pinRows();
      if (log.some((x) => x.image_url === img && x.title === String(body.title || ''))) return res.status(400).json({ ok: false, error: 'Pin นี้เคยโพสต์แล้ว' });
      const r = await fetch('https://api.pinterest.com/v5/pins', { method: 'POST', headers: { Authorization: `Bearer ${PT}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ board_id: BOARD, title: String(body.title || '').slice(0, 100), description: String(body.description || '').slice(0, 500), link, alt_text: String(body.alt || body.title || '').slice(0, 500), media_source: { source_type: 'image_url', url: img } }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(200).json({ ok: false, error: `Pinterest ${r.status}: ${String(j.message || JSON.stringify(j)).slice(0, 200)}` });
      log.push({ id: j.id, image_url: img, title: String(body.title || '').slice(0, 100), link, job: String(body.job || '').slice(0, 60), at: new Date().toISOString() });
      await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'pins', data: { list: log.slice(-500) }, updated_at: '2000-01-01T00:00:00Z' }], prefer: 'resolution=merge-duplicates,return=minimal' });
      return res.status(200).json({ ok: true, pin_id: j.id });
    }
    if (action === 'review_submit' || action === 'reviews' || action === 'review_hide' || action === 'review_delete' || action === 'review_mail' || action === 'review_send') {
      // รีวิวผู้ซื้อ: review_submit (สาธารณะ ต้องมีลายเซ็นออเดอร์) · reviews / review_hide (แอดมิน) · review_mail (แอดมิน/key ส่งอีเมลขอรีวิวทันที ?dry=1 ดูอย่างเดียว)
      const RV = await import('../lib/reviews.js');
      if (action === 'review_submit') {
        if (req.method !== 'POST') return res.status(405).end();
        const b = await readBody(req); const o = String(b.o || '');
        if (!/^[A-Za-z0-9_-]{6,200}$/.test(o) || !RV.tokenOk(o, b.t)) return res.status(403).json({ ok: false, error: 'ลิงก์รีวิวไม่ถูกต้อง' });
        const rows = await sb(`orders?session_id=eq.${encodeURIComponent(o)}&status=eq.paid&select=session_id,name,email,product_id,product_name`);
        if (!rows?.length) return res.status(404).json({ ok: false, error: 'ไม่พบคำสั่งซื้อ' });
        const email_mask = b.showEmail === false ? '' : RV.maskEmail(rows[0].email); // ลูกค้าเลือกได้ในหน้ารีวิว
        // ให้ดาวแยกทีละเล่ม (ออเดอร์ตะกร้า/สินค้าคู่) · ฟอร์มเก่าส่ง stars/text เดี่ยว = สินค้าหลักของออเดอร์
        const allowed = await RV.orderProducts(o, rows[0].product_id);
        const shopN = await loadShop().catch(() => ({ products: [] }));
        const clean = (x) => String(x || '').replace(/[<>]/g, '').replace(/\s+\n/g, '\n').trim().slice(0, 500);
        const items = (Array.isArray(b.items) ? b.items : [{ pid: rows[0].product_id, stars: b.stars, text: b.text }]).slice(0, 20)
          .map((x) => ({ pid: String(x?.pid || ''), stars: Math.round(Number(x?.stars)), text: clean(x?.text) })).filter((x) => allowed.includes(x.pid) && x.stars >= 1 && x.stars <= 5);
        if (!items.length) return res.status(400).json({ ok: false, error: 'ให้ดาวอย่างน้อย 1 เล่ม (1-5 ดาว)' });
        const name = String(b.name || '').replace(/[<>]/g, '').trim().slice(0, 30) || RV.displayName(rows[0].name);
        const d = await RV.loadReviews(); const now = new Date().toISOString(); const low = [];
        items.forEach((x, i) => {
          const pname = shopN.products.find((p) => p.id === x.pid)?.name || rows[0].product_name;
          const old = d.list.find((r) => r.order === o && (r.product_id === x.pid || (!r.product_id && x.pid === rows[0].product_id)));
          if (old) Object.assign(old, { stars: x.stars, text: x.text, name, email_mask, product_id: x.pid, product_name: pname, updated_at: now });
          else { d.list.push({ id: 'rv' + Date.now().toString(36) + i, order: o, product_id: x.pid, product_name: pname, stars: x.stars, text: x.text, name, email_mask, status: 'live', created_at: now }); if (x.stars <= 3) low.push({ ...x, pname }); }
        });
        await RV.saveReviews(d);
        for (const x of low) { try { await addTodo({ text: `รีวิว ${x.stars} ดาว "${x.pname}": ${x.text.slice(0, 120) || '(ไม่มีความเห็น)'} อ่านแล้วถ้าไม่เหมาะซ่อนได้ในแท็บ ⭐ รีวิว หรือทักลูกค้าช่วยแก้ปัญหา`, type: 'decide', from: 'care' }); } catch (e) {} }
        return res.status(200).json({ ok: true, saved: items.length });
      }
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (action === 'review_mail') {
        if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
        if (req.query.preview) { // ลิงก์หน้ารีวิวของออเดอร์ล่าสุด (ไว้ดูหน้าตา ไม่ส่งอีเมล ไม่บันทึกอะไร)
          const o = await sb('orders?status=eq.paid&select=session_id&order=paid_at.desc&limit=1');
          // ลายเซ็นแบบตัวอย่าง (pv) เปิดดูหน้าได้แต่ส่งรีวิวไม่ได้ กันรีวิวตัวอย่างไปผูกกับออเดอร์ลูกค้าจริง
          return res.status(200).json({ ok: true, link: o?.[0] ? `${await siteUrl()}/review?o=${encodeURIComponent(o[0].session_id)}&t=${RV.previewToken(o[0].session_id)}&s=5` : null });
        }
        return res.status(200).json(await RV.sendReviewRequests({ dry: !!req.query.dry }));
      }
      if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      if (action === 'review_send') { // คุณแดนกดขอรีวิวเอง: to = customer (ลูกค้าของออเดอร์นี้) | me (อีเมลที่ล็อกอินหลังบ้าน ไว้ดูหน้าตา)
        const b = await readBody(req); const sid = String(b.sid || '');
        if (!/^[A-Za-z0-9_-]{6,200}$/.test(sid)) return res.status(400).json({ ok: false, error: 'ออเดอร์ไม่ถูกต้อง' });
        try { return res.status(200).json(await RV.sendReviewTo(sid, b.to === 'me' ? admin.email : '', { mark: b.to !== 'me' })); }
        catch (e) { return res.status(200).json({ ok: false, error: String(e.message || e).slice(0, 200) }); }
      }
      const d = await RV.loadReviews();
      if (action === 'reviews') return res.status(200).json({ ok: true, list: d.list.slice().reverse().slice(0, 300), sent: Object.keys(d.sent).length, sentAt: d.sent });
      const b = await readBody(req); const r = d.list.find((x) => x.id === String(b.id || ''));
      if (!r) return res.status(404).json({ ok: false, error: 'ไม่พบรีวิว' });
      if (action === 'review_delete') { d.list = d.list.filter((x) => x.id !== r.id); await RV.saveReviews(d); return res.status(200).json({ ok: true, deleted: r.id }); }
      r.status = b.hidden ? 'hidden' : 'live'; r.hidden_at = b.hidden ? new Date().toISOString() : null; await RV.saveReviews(d);
      return res.status(200).json({ ok: true, review: r });
    }
    if (action === 'factory_cfg') { // GET แอดมิน/key · POST เฉพาะคุณแดน {sets:[{id,name,emoji,goal,books:[{t,cat,pages,price,notes,match}]}], auto:{on,per_week,sets:[id]}}
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      if (req.method !== 'POST') return res.status(200).json({ ok: true, cfg: await loadFacCfg() });
      if (!admin) return res.status(403).json({ ok: false, error: 'ตั้งค่าได้เฉพาะคุณแดน' });
      const body = await readBody(req); const old = await loadFacCfg();
      const sets = Array.isArray(body.sets) ? body.sets.slice(0, 20).map((x, i) => ({ id: /^[a-z0-9_-]{2,40}$/i.test(String(x.id || '')) ? String(x.id) : 'set' + Date.now().toString(36) + i, name: String(x.name || 'ชุดใหม่').slice(0, 80), emoji: String(x.emoji || '📚').slice(0, 4), goal: String(x.goal || '').slice(0, 200),
        books: (Array.isArray(x.books) ? x.books : []).slice(0, 30).map((b) => ({ t: String(b.t || '').trim().slice(0, 200), cat: String(b.cat || '').slice(0, 60), pages: Math.min(400, Math.max(0, Number(b.pages) || 0)), price: Math.max(0, Number(b.price) || 0), notes: String(b.notes || '').slice(0, 600), match: String(b.match || '').slice(0, 60) })).filter((b) => b.t) })) : old.sets;
      const a = body.auto || {}; const auto = { on: a.on != null ? !!a.on : old.auto.on, per_week: Math.min(4, Math.max(1, Number(a.per_week ?? old.auto.per_week) || 1)), sets: Array.isArray(a.sets) ? a.sets.map(String).slice(0, 20) : old.auto.sets };
      await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'factory_cfg', data: { sets, auto, updated_at: new Date().toISOString() }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
      if (auto.on !== old.auto.on) await logNote('factory', auto.on ? `คุณแดนเปิดผลิตอัตโนมัติ สัปดาห์ละ ${auto.per_week} เล่ม` : 'คุณแดนปิดผลิตอัตโนมัติ');
      return res.status(200).json({ ok: true, cfg: { sets, auto } });
    }
    if (action === 'factory_order') { // พี่ต้นสั่ง (key) หรือคุณแดนสั่งเองจากช่องโรงงาน (แอดมิน)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      if (admin) body.ordered_by = 'owner';
      if (!String(body.title || '').trim()) return res.status(400).json({ ok: false, error: 'ต้องมี title' });
      const { randomUUID } = await import('node:crypto');
      const job = { id: randomUUID(), status: 'queued', created_at: new Date().toISOString(), ordered_by: String(body.ordered_by || 'manager').slice(0, 40) };
      for (const f of FACTORY_FIELDS) if (body[f] != null && body[f] !== '') job[f] = typeof body[f] === 'number' ? body[f] : String(body[f]).slice(0, 2000);
      job.price = Number(job.price || 0); job.kind = jobKind(body); job.lang = body.lang === 'en' ? 'en' : 'th';
      const jobs = await loadJobs(); jobs.push(job); await saveJobs(jobs);
      await logNote(job.ordered_by, `สั่งโรงงานผลิตชีท: ${job.title} (${job.pages || '?'} หน้า, ${job.price ? job.price + ' บาท' : 'แจกฟรี'}) เหตุผล: ${job.purpose || '-'}`);
      return res.status(200).json({ ok: true, job });
    }
    if (action === 'factory_list') { // คุณแดนอนุมัติ (ลงขายแล้ว product_id) หรือไม่ลงขาย ชีทจากโรงงาน: แอดมินเท่านั้น
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const body = await readBody(req);
      const jobs = await loadJobs();
      const job = jobs.find((j) => j.id === String(body.id || ''));
      if (!job) return res.status(404).json({ ok: false, error: 'not found' });
      if (body.reject) { job.listing = 'rejected'; job.listing_at = new Date().toISOString(); }
      else if (body.global && typeof body.global === 'object') { // คุณแดนลงขายต่างประเทศแล้ว: เก็บลิงก์ไว้ให้ทีม Pinterest ใช้
        const g = body.global, u = (x) => /^https:\/\/[^\s"<>]{6,300}$/.test(String(x || '')) ? String(x) : '';
        job.global_links = { gumroad: u(g.gumroad), lite_gumroad: u(g.lite_gumroad), notion_pub: u(g.notion_pub), lite_pub: u(g.lite_pub), gallery: u(g.gallery) };
        if (!job.global_links.gumroad) return res.status(400).json({ ok: false, error: 'ต้องมีลิงก์ Gumroad ของตัวเต็ม' });
        job.listing = 'global'; job.listing_at = new Date().toISOString();
        await logNote('factory', `คุณแดนลงขายต่างประเทศแล้ว: ${job.title} ${job.global_links.gumroad}`);
      }
      else if (/^[a-z0-9]{2,40}$/i.test(String(body.product_id || ''))) { job.listing = 'listed'; job.product_id = String(body.product_id); job.listing_at = new Date().toISOString(); await logNote('factory', `คุณแดนอนุมัติลงขายแล้ว: ${job.title}`); }
      else return res.status(400).json({ ok: false, error: 'ต้องมี product_id หรือ reject' });
      await saveJobs(jobs);
      return res.status(200).json({ ok: true, job });
    }
    if (['factory_claim', 'factory_uploadurl', 'factory_done', 'factory_fail', 'factory_cancel', 'factory_listing', 'factory_copy'].includes(action)) {
      const admin = action === 'factory_cancel' && req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      const jobs = await loadJobs();
      const job = jobs.find((j) => j.id === String(body.id || ''));
      if (!job) return res.status(404).json({ ok: false, error: 'not found' });
      if (action === 'factory_copy') { // แก้ข้อความขายต่างประเทศบางช่องหลังผลิตเสร็จ (ไม่แตะสถานะ/รูป/ลิงก์)
        if (!job.global_copy || !body.global || typeof body.global !== 'object') return res.status(400).json({ ok: false, error: 'no global copy' });
        job.global_copy = cleanGlobal({ ...job.global_copy, ...body.global });
        await saveJobs(jobs);
        return res.status(200).json({ ok: true, copy: job.global_copy });
      }
      if (action === 'factory_claim') {
        if (job.status !== 'queued') return res.status(200).json({ ok: false, error: `สถานะตอนนี้คือ ${job.status}` });
        job.status = 'producing'; job.started_at = new Date().toISOString();
      } else if (action === 'factory_uploadurl') {
        const safe = String(body.filename || 'sheet.pdf').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'sheet.pdf';
        const ctype = /\.png$/i.test(safe) ? 'image/png' : /\.jpe?g$/i.test(safe) ? 'image/jpeg' : 'application/pdf';
        const path = `factory/${job.id}/${safe}`;
        // x-upsert: ทำรูปใหม่ทับชื่อไฟล์เดิมได้ (เช่น เปลี่ยนธีมรูปสินค้า) ลิงก์ในหน้าขายไม่ต้องเปลี่ยน
        const r = await fetch(`${SB_URL}/storage/v1/object/upload/sign/product-images/${path}`, { method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: '{}' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) return res.status(500).json({ ok: false, error: `signed url: ${r.status} ${JSON.stringify(j).slice(0, 200)}` });
        return res.status(200).json({ ok: true, upload_url: `${SB_URL}/storage/v1${j.url}`, file_url: `${SB_URL}/storage/v1/object/public/product-images/${path}`, headers: { 'Content-Type': ctype, 'x-upsert': 'true' } });
      } else if (action === 'factory_done') {
        job.status = 'done'; job.done_at = new Date().toISOString();
        if (body.file_url) job.file_url = String(body.file_url).slice(0, 500);
        if (body.pages) job.pages = Number(body.pages);
        if (body.size) job.size = Number(body.size);
        if (body.summary) job.summary = String(body.summary).slice(0, 2000);
        if (body.listing && typeof body.listing === 'object') job.listing_copy = cleanListing(body.listing);
        // Notion template: ลิงก์หน้าใน Notion ของคุณแดน (ยังไม่ Publish) + รูปปก/ตัวอย่างที่อัปโหลดผ่าน factory_uploadurl
        if (isNotionUrl(body.notion_url)) { job.notion_url = String(body.notion_url).slice(0, 400); job.kind = 'notion'; }
        const own = `${SB_URL}/storage/v1/object/public/product-images/factory/${job.id}/`;
        if (Array.isArray(body.images)) job.images = body.images.map(String).filter((u) => u.startsWith(own)).slice(0, 6);
        if (Array.isArray(body.pins)) job.pin_images = body.pins.map(String).filter((u) => u.startsWith(own)).slice(0, 10);
        if (isNotionUrl(body.lite_url)) job.lite_url = String(body.lite_url).slice(0, 400);
        if (body.global && typeof body.global === 'object') job.global_copy = cleanGlobal(body.global);
        await logNote('factory', `ผลิตเสร็จ: ${job.title} (${job.pages || '?'} หน้า) ไฟล์: ${job.file_url || '-'}\n${job.summary || ''}`);
        await chatEvent('factory', pick([`เสร็จแล้ว ${String(job.title).slice(0, 40)}`, `ส่งไฟล์แล้วครับ ${String(job.title).slice(0, 40)} ${job.pages || '?'} หน้า`, `งานออกจากโรงงานแล้ว ${String(job.title).slice(0, 40)}`]), 'factory');
        if (job.lang === 'en' && job.notion_url) job.listing = 'global_pending'; // ขายต่างประเทศ: ชุดลง Gumroad/Notion Gallery/Pinterest ไม่ขึ้นหน้าร้านไทย
        else if (Number(job.price) >= 1 && (job.file_url || job.notion_url)) job.listing = 'pending'; // ชีทขาย: ขึ้นการ์ด "รออนุมัติ" ในแท็บสินค้า คุณแดนตรวจแล้วกดลงขายเอง
        const todoText = job.listing === 'global_pending'
          ? `ลงขายต่างประเทศ "${job.title}" (Notion EN) เปิดแท็บโรงงาน → 🌏 ชุดลงขายต่างประเทศ: Publish ตัวเต็มและตัว Lite ใน Notion แล้วคัดลอกข้อความ/รูปไปลง Gumroad และส่ง Notion Template Gallery แล้ววางลิงก์กลับมา`
          : job.listing === 'pending' && job.kind === 'notion'
          ? `อนุมัติ Notion template "${job.title}" (ราคาที่เสนอ ${job.price} บาท) เปิดหน้าใน Notion กด Share → Publish → เปิด Allow duplicate คัดลอกลิงก์ แล้ววางในการ์ด "จากโรงงาน รออนุมัติ" แล้วกดอนุมัติ`
          : job.listing === 'pending'
          ? `อนุมัติลงขาย "${job.title}" (${job.pages || '?'} หน้า ราคาที่เสนอ ${job.price} บาท) เปิดแท็บสินค้าและเซลเพจ → จากโรงงาน รออนุมัติ ตรวจไฟล์ ราคา และหน้าตัวอย่าง แล้วกดอนุมัติ`
          : `ตรวจไฟล์ชีทที่โรงงานผลิตเสร็จ "${job.title}" (${job.pages || '?'} หน้า) เปิดดูหน้าแรก หน้า 2 และหน้าสุดท้าย ถ้าผ่านให้ทีมเอาไปแจก/ขายได้`;
        try { await addTodo({ text: todoText, type: ['pending', 'global_pending'].includes(job.listing) ? 'decide' : 'do', from: 'factory', link: job.file_url || job.notion_url || null }); } catch (e) { console.error('todo', e.message); }
      } else if (action === 'factory_listing') { // เติม/แก้ข้อความหน้าขายของงานที่เสร็จแล้ว (ไม่แจ้งเตือนซ้ำ)
        if (!body.listing || typeof body.listing !== 'object') return res.status(400).json({ ok: false, error: 'ต้องมี listing' });
        job.listing_copy = cleanListing(body.listing);
      } else if (action === 'factory_fail') {
        job.status = 'failed'; job.error = String(body.error || '').slice(0, 500); job.failed_at = new Date().toISOString();
        await logNote('factory', `ผลิตไม่สำเร็จ: ${job.title} เหตุผล: ${job.error}`);
      } else if (action === 'factory_cancel') {
        job.status = 'cancelled'; job.cancelled_at = new Date().toISOString();
      }
      await saveJobs(jobs);
      return res.status(200).json({ ok: true, job });
    }
    if (action === 'health') {
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      if (req.query.log) {
        const days = Math.min(30, Number(req.query.days) || 7);
        const rows = await sb(`posts?status=in.(note,log)&source=eq.guard&created_at=gte.${new Date(Date.now() - days * 864e5).toISOString()}&select=kind,text,created_at&order=created_at.desc&limit=60`);
        return res.status(200).json({ ok: true, logs: rows });
      }
      const h = await runHealth(req.headers.host);
      if (req.query.record) await recordHealth(h);
      return res.status(200).json(h);
    }
    if (action === 'docs') {
      // ห้องเอกสาร (แอดมินหรือ key): GET {links, files} POST {title,url,note?,cat?} เพิ่ม | {id,remove:true} ลบ | {id,title?,url?,note?,cat?} แก้
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      let links = await loadDocs();
      if (req.method === 'POST') {
        const body = await readBody(req);
        const clean = (v, n) => String(v || '').trim().slice(0, n);
        if (body.remove && body.id) {
          links = links.filter((l) => l.id !== String(body.id));
        } else if (body.id && links.some((l) => l.id === String(body.id))) {
          const l = links.find((x) => x.id === String(body.id));
          if (body.title != null) l.title = clean(body.title, 120) || l.title;
          if (body.url != null && /^https?:\/\//i.test(String(body.url))) l.url = clean(body.url, 500);
          if (body.note != null) l.note = clean(body.note, 300);
          if (body.cat != null) l.cat = clean(body.cat, 40);
        } else {
          const url = clean(body.url, 500);
          if (!/^https?:\/\//i.test(url)) return res.status(400).json({ ok: false, error: 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://' });
          const title = clean(body.title, 120) || url.replace(/^https?:\/\//, '').split('/')[0];
          const dup = links.find((l) => l.url === url);
          if (!dup) {
            const from = admin ? 'manual' : (MEMBER_TH[body.from] ? body.from : 'manager');
            const { randomUUID } = await import('node:crypto');
            links.unshift({ id: randomUUID(), title, url, note: clean(body.note, 300), cat: clean(body.cat, 40) || 'อื่นๆ', from, created_at: new Date().toISOString() });
          }
        }
        await saveDocs(links);
      }
      const jobs = await loadJobs().catch(() => []);
      const files = jobs.filter((j) => j.status === 'done' && j.file_url).map((j) => ({ id: j.id, title: j.title, file_url: j.file_url, pages: j.pages, price: j.price, done_at: j.done_at, purpose: j.purpose }));
      return res.status(200).json({ ok: true, links, files });
    }
    if (action === 'upload_sign') {
      // ขอลิงก์อัปโหลดไฟล์เข้า storage โดยตรง (key หรือแอดมิน): POST {name, type, folder?} -> {upload_url, public_url} แล้ว PUT ไฟล์ไปที่ upload_url พร้อม Content-Type
      const adminUp = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!adminUp && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
      const body = await readBody(req);
      const name = String(body.name || 'file.bin').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80);
      const folder = ['reels', 'briefs', 'images'].includes(String(body.folder || '')) ? String(body.folder) : 'reels';
      // overwrite: ระบุ path เดิม (reels/....mp4) เพื่อเขียนทับไฟล์เดิมโดยลิงก์ไม่เปลี่ยน (ใช้ตอนแก้คลิปที่ส่งเข้าคิวแล้ว)
      const ow = String(body.overwrite || '').replace(/[^A-Za-z0-9._\/-]/g, '');
      const path = ow && ow.startsWith('reels/') && !adminUp ? ow : `${folder}/${Date.now()}-${name}`;
      const r = await fetch(`${SB_URL}/storage/v1/object/upload/sign/product-images/${path}`, { method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json', ...(ow ? { 'x-upsert': 'true' } : {}) }, body: JSON.stringify(ow ? { upsert: true } : {}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) return res.status(500).json({ ok: false, error: `สร้างลิงก์อัปโหลดไม่ได้ (${r.status}) ${JSON.stringify(j).slice(0, 120)}` });
      return res.status(200).json({ ok: true, upload_url: `${SB_URL}/storage/v1${j.url}`, public_url: `${SB_URL}/storage/v1/object/public/product-images/${path}`, method: 'PUT', content_type: String(body.type || 'video/mp4') });
    }
    if (action === 'tts') {
      // เสียงพากย์ไทยจาก ElevenLabs (คีย์เก็บใน Vercel env ELEVEN_KEY ไม่เคยส่งออกไปให้ทีม): POST {text, voice?, speed?} -> {url} ไฟล์ mp3 เก็บใน storage product-images/reels/  GET &list=1 -> รายชื่อเสียงในบัญชี
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const EK = process.env.ELEVEN_KEY || '';
      if (!EK) return res.status(503).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า ELEVEN_KEY ใน Vercel Environment Variables' });
      if (req.query.list === '1') {
        const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': EK } });
        const j = await r.json().catch(() => ({}));
        return res.status(200).json({ ok: r.ok, voices: (j.voices || []).map((v) => ({ id: v.voice_id, name: v.name, labels: v.labels || {}, preview: v.preview_url || '' })), error: r.ok ? undefined : `ElevenLabs ${r.status}` });
      }
      if (req.query.library) {
        // ค้นเสียงจากคลังสาธารณะของ ElevenLabs ตามภาษา เช่น &library=th
        const lang = String(req.query.library).replace(/[^a-z]/g, '').slice(0, 5) || 'th';
        const q = String(req.query.q || '').replace(/[^\w\s\u0E00-\u0E7F-]/g, '').slice(0, 40);
        const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?page_size=50${lang !== 'any' ? `&language=${lang}` : ''}${q ? `&search=${encodeURIComponent(q)}` : ''}`, { headers: { 'xi-api-key': EK } });
        const j = await r.json().catch(() => ({}));
        return res.status(200).json({ ok: r.ok, voices: (j.voices || []).map((v) => ({ owner: v.public_owner_id, id: v.voice_id, name: v.name, gender: v.gender, age: v.age, accent: v.accent, desc: v.descriptive, use_case: v.use_case, preview: v.preview_url, uses: v.cloned_by_count })), error: r.ok ? undefined : `ElevenLabs ${r.status}` });
      }
      if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
      const body = await readBody(req);
      if (body.add && body.add.owner && body.add.voice) {
        // เพิ่มเสียงจากคลังสาธารณะเข้าบัญชี
        const r = await fetch(`https://api.elevenlabs.io/v1/voices/add/${encodeURIComponent(String(body.add.owner))}/${encodeURIComponent(String(body.add.voice))}`, { method: 'POST', headers: { 'xi-api-key': EK, 'Content-Type': 'application/json' }, body: JSON.stringify({ new_name: String(body.add.name || 'voice').slice(0, 60) }) });
        const j = await r.json().catch(() => ({}));
        return res.status(r.ok ? 200 : 502).json({ ok: r.ok, voice: j.voice_id || null, error: r.ok ? undefined : `ElevenLabs ${r.status}: ${JSON.stringify(j).slice(0, 200)}` });
      }
      const text = String(body.text || '').trim().slice(0, 1500);
      if (!text) return res.status(400).json({ ok: false, error: 'no text' });
      const voice = /^[A-Za-z0-9]{10,40}$/.test(String(body.voice || '')) ? String(body.voice) : (process.env.ELEVEN_VOICE || 'EXAVITQu4vr4xnSDxMaL');
      const speed = Math.min(1.2, Math.max(0.7, Number(body.speed) || 1.0));
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': EK, 'Content-Type': 'application/json' },
        // language_code บังคับภาษาได้เฉพาะ turbo/flash v2.5 (multilingual_v2 และ v3 เดาภาษาจากข้อความเอง)
        body: JSON.stringify({ text, model_id: String(body.model || 'eleven_v3'), ...(/v2_5/.test(String(body.model || '')) ? { language_code: String(body.language || 'th') } : {}), voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed } }),
      });
      if (!r.ok) { const t = await r.text().catch(() => ''); return res.status(502).json({ ok: false, error: `ElevenLabs ${r.status}: ${t.slice(0, 200)}` }); }
      const buf = Buffer.from(await r.arrayBuffer());
      const name = `reels/tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
      const up = await fetch(`${SB_URL}/storage/v1/object/product-images/${name}`, { method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'audio/mpeg', 'cache-control': '31536000' }, body: buf });
      if (!up.ok) return res.status(500).json({ ok: false, error: `เก็บไฟล์เสียงไม่ได้ (${up.status})` });
      return res.status(200).json({ ok: true, url: `${SB_URL}/storage/v1/object/public/product-images/${name}`, bytes: buf.length, voice, chars: text.length });
    }
    if (action === 'chat') {
      // ห้องพักทีม (kind chat): ข้อความมีเวลาปล่อย (scheduled_at) ได้ หน้าเว็บเห็นเฉพาะที่ถึงเวลาแล้ว ทีมส่งทั้งวันได้ในครั้งเดียว
      // GET ?days=7 (&all=1 กับ key = รวมข้อความที่ยังไม่ถึงเวลา)  POST แอดมิน {text} | key {text,source,at?} หรือ {messages:[{text,source,at?}]} | {id,remove:true} | {clear:'all'}
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      if (req.method === 'POST') {
        const body = await readBody(req);
        const EMO = /^\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]{0,6}$/u;
        const cleanReacts = (r) => { const o = {}; if (r && typeof r === 'object') for (const [e, who] of Object.entries(r).slice(0, 6)) { if (!EMO.test(String(e))) continue; const w = [...new Set((Array.isArray(who) ? who : []).map(String).filter((k) => k === 'manual' || MEMBER_TH[k]))].slice(0, 12); if (w.length) o[e] = w; } return o; };
        const cleanPoll = (pl) => { if (!pl || typeof pl !== 'object' || !pl.q) return null; const options = [...new Set((Array.isArray(pl.options) ? pl.options : []).map((x) => String(x).trim().slice(0, 40)).filter(Boolean))].slice(0, 4); if (options.length < 2) return null; const votes = {}; for (const op of options) { const v = pl.votes && Array.isArray(pl.votes[op]) ? pl.votes[op] : []; votes[op] = [...new Set(v.map(String).filter((k) => k === 'manual' || MEMBER_TH[k]))]; } return { q: String(pl.q).trim().slice(0, 120), options, votes }; };
        const readMeta = (row) => { try { return row && row.notes ? JSON.parse(row.notes) : {}; } catch (e) { return {}; } };
        if (body.react && /^[0-9a-f-]{36}$/.test(String(body.react.id || ''))) {
          // กดรีแอคชัน: แอดมิน = manual, key = ระบุ source ได้ (สลับเปิด/ปิด)
          const who = admin ? 'manual' : (MEMBER_TH[body.react.source] ? String(body.react.source) : 'manager');
          const e = String(body.react.emoji || '👍'); if (!EMO.test(e)) return res.status(400).json({ ok: false, error: 'emoji' });
          const cur = await sb(`posts?id=eq.${body.react.id}&kind=eq.chat&select=id,notes`); if (!cur.length) return res.status(404).json({ ok: false, error: 'not found' });
          const meta = readMeta(cur[0]); const reacts = cleanReacts(meta.reacts); const list = reacts[e] || [];
          reacts[e] = list.includes(who) ? list.filter((x) => x !== who) : [...list, who]; if (!reacts[e].length) delete reacts[e]; meta.reacts = reacts;
          await sbPatch(`posts?id=eq.${body.react.id}`, { notes: JSON.stringify(meta) });
        } else if (body.vote && /^[0-9a-f-]{36}$/.test(String(body.vote.id || ''))) {
          const who = admin ? 'manual' : (MEMBER_TH[body.vote.source] ? String(body.vote.source) : 'manager');
          const cur = await sb(`posts?id=eq.${body.vote.id}&kind=eq.chat&select=id,notes`); if (!cur.length) return res.status(404).json({ ok: false, error: 'not found' });
          const meta = readMeta(cur[0]); const poll = cleanPoll(meta.poll); const op = String(body.vote.option || '');
          if (!poll || !poll.options.includes(op)) return res.status(400).json({ ok: false, error: 'no such option' });
          for (const o of poll.options) poll.votes[o] = poll.votes[o].filter((x) => x !== who); poll.votes[op].push(who); meta.poll = poll;
          await sbPatch(`posts?id=eq.${body.vote.id}`, { notes: JSON.stringify(meta) });
        } else if (body.remove && /^[0-9a-f-]{36}$/.test(String(body.id || ''))) {
          await sb(`posts?id=eq.${body.id}&kind=eq.chat`, { method: 'DELETE', prefer: 'return=minimal' });
        } else if (body.clear && body.clear === 'all') {
          await sb(`posts?kind=eq.chat&status=eq.note`, { method: 'DELETE', prefer: 'return=minimal' });
        } else {
          const list = Array.isArray(body.messages) ? body.messages : [body];
          const now = Date.now();
          const { randomUUID } = await import('node:crypto');
          const rows = [];
          const ids = list.slice(0, 40).map(() => randomUUID());
          list.slice(0, 40).forEach((m, i) => {
            const text = String((m && m.text) || '').trim().slice(0, 400);
            if (!text) return;
            const source = admin ? 'manual' : (MEMBER_TH[m.source] ? m.source : 'manager');
            let at = null;
            if (!admin && m.at) { const t = Date.parse(m.at); if (t && t > now - 36e5 && t < now + 2 * 864e5) at = new Date(t).toISOString(); }
            // meta: reply_to = เลขลำดับในชุดนี้ (0..) หรือ id ข้อความเก่า, reacts = {emoji:[source]}, poll = {q,options,votes}
            const meta = {};
            if (!admin && m.reply_to !== undefined && m.reply_to !== null) { const r = m.reply_to; if (Number.isInteger(r) && r >= 0 && r < i) meta.reply_to = ids[r]; else if (/^[0-9a-f-]{36}$/.test(String(r))) meta.reply_to = String(r); }
            if (admin && /^[0-9a-f-]{36}$/.test(String(m.reply_to || ''))) meta.reply_to = String(m.reply_to);
            if (!admin && m.reacts) { const rc = cleanReacts(m.reacts); if (Object.keys(rc).length) meta.reacts = rc; }
            if (!admin && m.poll) { const pl = cleanPoll(m.poll); if (pl) meta.poll = pl; }
            // รูปกิจกรรมที่ทีมส่งมาอวด (key): เก็บสำเนาถาวรใน storage ก่อน
            const photo = !admin && /^https:\/\//.test(String(m.photo_url || '')) ? String(m.photo_url).slice(0, 1200) : null;
            rows.push({ id: ids[i], status: 'note', kind: 'chat', source, text, scheduled_at: at, image_url: photo, notes: Object.keys(meta).length ? JSON.stringify(meta) : null });
          });
          if (!rows.length) return res.status(400).json({ ok: false, error: 'พิมพ์ข้อความก่อน' });
          for (const r of rows) if (r.image_url) { const c = await cacheImage(r.image_url); r.image_url = c && c.startsWith(`${SB_URL}/storage/`) ? c : null; }
          await sb('posts', { method: 'POST', body: rows, prefer: 'return=minimal' });
          // คุณแดนทักในห้องพัก + มี AI ห้องพัก: ให้ทีมตอบภายในไม่กี่นาที (ยิงแยกอีกคำขอ ไม่ให้หน้าเว็บรอ)
          if (admin && breakAI()) { const pr = fetch(`https://${req.headers.host}/api/content?action=ai_reply&id=${rows[0].id}`, { headers: { 'x-content-key': CONTENT_KEY } }).catch(() => {}); await Promise.race([pr, new Promise((r) => setTimeout(r, 1500))]); }
        }
      }
      const days = Math.min(30, Number(req.query.days) || 7);
      const all = !admin && keyOk(req) && req.query.all === '1';
      const rows = await sb(`posts?status=eq.note&kind=eq.chat&created_at=gte.${new Date(Date.now() - days * 864e5).toISOString()}&select=id,source,text,created_at,scheduled_at,notes,image_url&order=created_at.asc&limit=240`);
      const nowIso = new Date().toISOString();
      const parseMeta = (n) => { try { return n ? JSON.parse(n) : {}; } catch (e) { return {}; } };
      const withAt = rows.map((r) => ({ id: r.id, source: r.source, text: r.text, photo: r.image_url || null, created_at: r.created_at, at: r.scheduled_at || r.created_at, meta: parseMeta(r.notes) })).sort((a, b) => a.at.localeCompare(b.at));
      const future = withAt.filter((r) => r.at > nowIso);
      const shown = all ? withAt : withAt.filter((r) => r.at <= nowIso);
      const ai = breakAI();
      // เปิดห้องพักแล้ววันนี้ AI ยังไม่ได้เขียน (รูทีนเช้าพลาด) ให้เขียนตอนนี้
      if (ai && admin && !future.length) { const st = await aiState().catch(() => ({})); const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); if (st.last_day !== today && new Date(Date.now() + 7 * 3600e3).getUTCHours() < 22) { const pr = fetch(`https://${req.headers.host}/api/content?action=ai_day`, { headers: { 'x-content-key': CONTENT_KEY } }).catch(() => {}); await Promise.race([pr, new Promise((r) => setTimeout(r, 1200))]); } }
      return res.status(200).json({ ok: true, messages: shown.slice(-80), pending: future.length, next_at: future[0] ? future[0].at : null, next_source: future[0] ? future[0].source : null, engine: ai ? ai.name : 'Claude' });
    }
    if (action === 'lore') {
      // สมุดเรื่องราวห้องพัก (มุกค้าง เรื่องต่อเนื่อง) shop_state id=lore data.text ≤ 2500 ตัวอักษร
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      if (req.method === 'POST') {
        const body = await readBody(req);
        const text = String(body.text || '').trim().slice(0, 2500);
        await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'lore', data: { text }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
        return res.status(200).json({ ok: true, text });
      }
      const rows = await sb('shop_state?id=eq.lore&select=data,updated_at');
      return res.status(200).json({ ok: true, text: rows?.[0]?.data?.text || '', updated_at: rows?.[0]?.updated_at || null });
    }
    if (action === 'digest') {
      // สรุปข้อเท็จจริงของวันแบบย่อสำหรับห้องพัก (คำนวณฝั่งเซิร์ฟเวอร์ ไม่ใช้โมเดล): วันที่ รายงานใครส่ง สุขภาพระบบ โพสต์ โรงงาน ข้อความคุณแดน และสมุดเรื่องราว
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const now = Date.now();
      const bkk = new Date(now + 7 * 3600e3);
      const dowTh = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'][bkk.getUTCDay()];
      const monTh = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][bkk.getUTCMonth()];
      const dom = bkk.getUTCDate();
      const lines = [`วันนี้วัน${dowTh}ที่ ${dom} ${monTh} ${bkk.getUTCFullYear() + 543}${[0, 6].includes(bkk.getUTCDay()) ? ' (วันหยุดสุดสัปดาห์ ทีมทำงานอัตโนมัติ คนคุยน้อยลง)' : ''}${dom >= 25 ? ' ใกล้สิ้นเดือน (เงินเดือนออก คนคุยเรื่องเงินและของกิน)' : dom <= 3 ? ' ต้นเดือน' : ''}`];
      const world = await worldNow(); world.lines.forEach((l) => lines.push(l));
      const since = new Date(now - 864e5).toISOString();
      const notes = await sb(`posts?status=in.(note,log)&created_at=gte.${since}&select=source,kind,text,created_at&order=created_at.desc&limit=80`);
      const seen = {};
      for (const n of notes) { if (['chat', 'reply', 'plan'].includes(n.kind) || n.source === 'manual' || seen[n.source]) continue; seen[n.source] = true; const first = String(n.text || '').split('\n').find((l) => l.trim()) || ''; lines.push(`${MEMBER_TH[n.source] || n.source} ส่งงานแล้ว (${n.kind}): ${first.slice(0, 90)}`); }
      const quiet = Object.keys(MEMBER_TH).filter((k) => !seen[k] && !['care'].includes(k));
      if (quiet.length) lines.push(`ยังไม่มีรายงานใน 24 ชม.: ${quiet.map((k) => MEMBER_TH[k]).join(' ')}`);
      notes.filter((n) => n.kind === 'comment' && n.source === 'manual').slice(0, 2).forEach((c) => lines.push(`คุณแดนตอบในห้องประชุม: "${String(c.text || '').slice(0, 100)}" (ทีมรับทราบสั้นๆ ได้ ไม่ต้องคุยรายละเอียด)`));
      const brief3 = notes.filter((n) => n.kind === 'brief').slice(0, 2);
      brief3.forEach((b) => lines.push(`คุณแดนส่งโจทย์ใหม่ในห้องประชุม (${String(b.created_at).slice(0, 10)}): "${String(b.text || '').split('\n')[0].slice(0, 120)}" (ทีมพูดถึงได้ว่าใครจะรับไปทำ แต่ห้ามคุยรายละเอียดงานยาว)`));
      const health = notes.find((n) => n.kind === 'health');
      if (health) lines.push(`ผลตรวจระบบล่าสุด: ${String(health.text).split('\n')[0].slice(0, 100)}`);
      const pub = await sb(`posts?status=eq.published&published_at=gte.${since}&select=channel,kind,text`);
      if (pub.length) lines.push(`โพสต์ที่ขึ้นเพจ 24 ชม.: Facebook ${pub.filter((p) => (p.channel || 'facebook') === 'facebook').length} Threads ${pub.filter((p) => p.channel === 'threads').length} เช่น "${String(pub[0].text || '').slice(0, 50)}"`);
      const stuck = await sb(`posts?status=in.(needs_owner,failed)&select=status`);
      if (stuck.length) lines.push(`โพสต์ค้าง: รอคุณแดนอนุมัติ ${stuck.filter((p) => p.status === 'needs_owner').length} ล้มเหลว ${stuck.filter((p) => p.status === 'failed').length}`);
      const today = await sb(`posts?status=eq.approved&scheduled_at=gte.${new Date().toISOString()}&scheduled_at=lte.${new Date(now + 36e5 * 24).toISOString()}&select=channel,text,scheduled_at&order=scheduled_at.asc&limit=5`);
      if (today.length) lines.push(`คิวโพสต์ 24 ชม.ข้างหน้า ${today.length} โพสต์ ถัดไป ${today[0].channel === 'threads' ? 'Threads' : 'Facebook'}: "${String(today[0].text || '').slice(0, 50)}"`); else lines.push('คิวโพสต์ 24 ชม.ข้างหน้าว่างเปล่า (ทีมจะเครียดเรื่องนี้ได้)');
      const jobs = await loadJobs().catch(() => []);
      const q = jobs.filter((j) => j.status === 'queued' || j.status === 'producing');
      if (q.length) lines.push(`โรงงาน: กำลังผลิต ${q.length} งาน ล่าสุด "${String(q[0].title || '').slice(0, 50)}"`);
      const owner = notes.filter((n) => n.kind === 'chat' && n.source === 'manual').map((n) => ({ at: n.created_at, text: String(n.text).slice(0, 300) }));
      const loreRows = await sb('shop_state?id=eq.lore&select=data');
      const chatRows = await sb(`posts?status=eq.note&kind=eq.chat&created_at=gte.${new Date(now - 3 * 864e5).toISOString()}&select=id,source,text,created_at,scheduled_at,notes,image_url&order=created_at.asc&limit=120`);
      const nowIso = new Date().toISOString();
      return res.status(200).json({ ok: true, world, now_utc: nowIso, bkk_date: `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, '0')}-${String(dom).padStart(2, '0')}`, lines, owner_msgs: owner, lore: loreRows?.[0]?.data?.text || '', chat_engine: breakAI() ? breakAI().id : 'claude', recent_chat: chatRows.map((r) => ({ id: r.id, source: r.source, text: r.text, photo: !!r.image_url, at: r.scheduled_at || r.created_at, evt: (() => { try { return !!(r.notes && JSON.parse(r.notes).evt); } catch (e) { return false; } })() })).sort((a, b) => a.at.localeCompare(b.at)).slice(-60), pending_after_now: chatRows.filter((r) => (r.scheduled_at || r.created_at) > nowIso).length });
    }
    if (action === 'recover') {
      // ดูว่าจะเตือนใครบ้าง (dry=1) หรือสั่งส่งตอนนี้ (แอดมินหรือ key)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      return res.status(200).json(await sendRecoveries({ dry: req.query.dry === '1' }));
    }
    if (action === 'reply_state') {
      // คุณแดนกด "เรียบร้อย" / "ยกเลิก" / "เปิดใหม่" ที่คำสั่งถึงสมาชิก
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const body = await readBody(req);
      const id = String(body.id || ''), state = String(body.state || '');
      if (!/^[0-9a-f-]{36}$/.test(id) || !['done', 'cancel', 'open'].includes(state)) return res.status(400).json({ ok: false, error: 'bad id/state' });
      const cur = await sb(`posts?id=eq.${id}&kind=eq.reply&select=id,notes`);
      if (!cur.length) return res.status(404).json({ ok: false, error: 'ไม่พบคำสั่ง' });
      let meta = {}; try { meta = cur[0].notes ? JSON.parse(cur[0].notes) : {}; } catch (e) {}
      meta.state = state; meta.state_at = new Date().toISOString();
      await sbPatch(`posts?id=eq.${id}`, { notes: JSON.stringify(meta) });
      return res.status(200).json({ ok: true, id, state });
    }
    if (action === 'dash_orders') {
      // การ์ดออเดอร์ Stripe แบบสด: webhook บันทึกลงตาราง orders ทันทีที่ลูกค้าจ่าย ห้องประชุมดึงซ้ำทุก 30 วินาที (เบา ไม่เรียก API ภายนอก)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const now = Date.now(), since = new Date(now - 15 * 864e5).toISOString();
      const [orders, priv] = await Promise.all([sb(`orders?select=created_at,paid_at,product_name,amount,status,email,campaign&created_at=gte.${since}&order=created_at.desc&limit=2000`), sb('shop_state?id=eq.private&select=data')]);
      const isTest = testOrder(null, priv?.[0]?.data?.testEmails);
      const thDay = (t) => new Date(Date.parse(t) + 7 * 3600e3).toISOString().slice(0, 10);
      const real = orders.filter((o) => !isTest(o)), paid = real.filter((o) => o.status === 'paid');
      const pAt = (o) => o.paid_at || o.created_at;
      const days = [];
      for (let i = 13; i >= 0; i--) { const k = thDay(new Date(now - i * 864e5).toISOString()); const L = paid.filter((o) => thDay(pAt(o)) === k); days.push({ d: k, n: L.length, rev: L.reduce((a, o) => a + (Number(o.amount) || 0), 0), unpaid: real.filter((o) => o.status !== 'paid' && thDay(o.created_at) === k).length }); }
      const mask = (e) => { const m = String(e || '').toLowerCase().match(/^([^@\s]+)@(.+)$/); return m ? m[1].slice(0, 2) + '•••@' + m[2] : ''; };
      const latest = paid.slice().sort((a, b) => String(pAt(b)).localeCompare(String(pAt(a)))).slice(0, 10).map((o) => { const s = srcGroup(o.campaign); return { at: pAt(o), product: o.product_name, amount: Number(o.amount) || 0, email: mask(o.email), src: o.campaign || '', group: s.g, label: s.label }; });
      // ที่มาของยอดขาย: วันนี้ และ 7 วัน แยก แอด / ออร์แกนิก (เพจ Threads หน้าร้าน Google ...) / ลิงก์ตรง
      const today = thDay(new Date(now).toISOString()), wkFrom = thDay(new Date(now - 6 * 864e5).toISOString());
      const bySrc = (L) => { const g = { ads: { n: 0, rev: 0 }, organic: { n: 0, rev: 0 }, direct: { n: 0, rev: 0 } }, labels = {}; for (const o of L) { const s = srcGroup(o.campaign); g[s.g].n++; g[s.g].rev += Number(o.amount) || 0; const l = labels[s.label] || (labels[s.label] = { group: s.g, n: 0, rev: 0 }); l.n++; l.rev += Number(o.amount) || 0; } return { groups: g, labels: Object.entries(labels).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.rev - a.rev) }; };
      const src = { today: bySrc(paid.filter((o) => thDay(pAt(o)) === today)), week: bySrc(paid.filter((o) => thDay(pAt(o)) >= wkFrom)) };
      return res.status(200).json({ ok: true, at: new Date(now).toISOString(), days, latest, src, test: orders.length - real.length });
    }
    if (action === 'dash') {
      // แดชบอร์ดห้องประชุม: ตัวเลขจริงของ 7 วัน + ประเด็นจากรายงานล่าสุดของพี่ต้น (ไม่ใช้ AI)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const now = Date.now(), since = new Date(now - 7 * 864e5).toISOString(), sinceY = new Date(now - 8 * 864e5).toISOString(), untilY = new Date(now - 864e5).toISOString(), prev = new Date(now - 14 * 864e5).toISOString(), ahead = new Date(now + 7 * 864e5).toISOString(), nowIso = new Date(now).toISOString();
      const sum = (l) => l.reduce((a, o) => a + (Number(o.amount) || 0), 0);
      const hasCh = await channelCol();
      const [orders, posts, priv, notes, jobs] = await Promise.all([
        sb(`orders?select=created_at,paid_at,product_name,amount,status,email,campaign&created_at=gte.${prev}`),
        sb(`posts?status=in.(approved,published,needs_owner,failed,draft)&or=(published_at.gte.${sinceY},scheduled_at.gte.${since})&select=status,kind,source,created_at,published_at,scheduled_at,notes${hasCh ? ',channel' : ''}&limit=400`),
        sb('shop_state?id=eq.private&select=data'),
        sb(`posts?status=in.(note,log)&created_at=gte.${new Date(now - 14 * 864e5).toISOString()}&select=source,kind,text,created_at&order=created_at.desc&limit=200`),
        loadJobs().catch(() => []),
      ]);
      const isTest = testOrder(null, priv?.[0]?.data?.testEmails);
      const real = orders.filter((o) => !isTest(o));
      const paid = real.filter((o) => o.status === 'paid');
      const wk = paid.filter((o) => (o.paid_at || o.created_at) >= since), lw = paid.filter((o) => (o.paid_at || o.created_at) < since);
      const ch = (p) => p.channel === 'threads' ? 'threads' : 'facebook';
      // หน้าต่าง 7 วันที่สิ้นสุดเมื่อวานเวลาเดียวกัน (ไว้เทียบกับเมื่อวาน)
      const inY = (t) => t && t >= sinceY && t < untilY;
      const wkY = paid.filter((o) => inY(o.paid_at || o.created_at));
      const pubY = posts.filter((p) => p.status === 'published' && inY(p.published_at)).length;
      const unpaidY = real.filter((o) => o.status !== 'paid' && inY(o.created_at)).length;
      const pub = posts.filter((p) => p.status === 'published' && p.published_at >= since);
      const queued = posts.filter((p) => p.status === 'approved' && p.scheduled_at >= nowIso && p.scheduled_at <= ahead);
      const campaigns = (priv?.[0]?.data?.campaigns || []).map((c) => ({ name: c.name, spend: Number(c.spend) || 0 }));
      // ผู้ติดตาม + เก็บประวัติรายวันไว้คำนวณเพิ่มขึ้นเทียบ 7 วันก่อน
      let thF = null, fbF = null;
      try { let th = await loadThreads(); if (threadsConnected(th)) { th = await refreshIfNeeded(th); const u = await thGet(`${th.userId}/threads_insights`, { metric: 'followers_count', access_token: th.token }); thF = u.data?.[0]?.total_value?.value ?? u.data?.[0]?.values?.[0]?.value ?? null; } } catch (e) {}
      try { const fb = await loadFb(); if (fb) { const pg = await fbGet(fb.pageId, { fields: 'followers_count,fan_count', access_token: fb.token }); fbF = pg.followers_count ?? pg.fan_count ?? null; } } catch (e) {}
      const today = new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
      const histRow = await sb('shop_state?id=eq.dash_hist&select=data'); const hist = histRow?.[0]?.data?.days || {};
      const weekAgo = Object.keys(hist).sort().filter((k) => k <= new Date(now + 7 * 3600e3 - 7 * 864e5).toISOString().slice(0, 10)).pop();
      const base = weekAgo ? hist[weekAgo] : null;
      // ประเด็นจากรายงานล่าสุดของพี่ต้น (โครงรายงานตายตัว)
      const rep = notes.find((n) => n.source === 'manager' && n.kind === 'report');
      const HEADS = ['ผู้ติดตาม', 'สรุปสัปดาห์', 'ทีมทำตามแผนประชุม', 'ตลาด', 'ผลโพสต์ทดลอง', 'Threads', 'โรงงาน', 'สิ่งที่ผมตัดสินใจไปแล้ว', 'ต้องขอคุณแดนตัดสิน', 'แผนสัปดาห์หน้า', 'สิ่งที่อยากให้คุณแดนทำ', '—'];
      const sec = (head) => { if (!rep) return ''; const L = String(rep.text).split('\n'); const i = L.findIndex((l) => l.trim().startsWith(head)); if (i < 0) return ''; const out = [L[i].trim().slice(head.length).replace(/^\s*([(（][^)）]*[)）])?\s*[:：]?\s*/, '')]; for (let j = i + 1; j < L.length; j++) { const t = L[j].trim(); if (HEADS.some((h) => t.startsWith(h))) break; if (t) out.push(t); } return out.join(' ').trim(); };
      const items = (t) => t ? t.split(/\s*(?:\d+[).]\s+)/).map((x) => x.trim()).filter((x) => x.length > 3 && !/^ไม่มี(ครับ|ค่ะ)?$/.test(x)).slice(0, 5) : [];
      const reported = {}; notes.filter((n) => n.created_at >= since && !['chat', 'reply', 'comment', 'brief', 'handoff', 'deck'].includes(n.kind)).forEach((n) => { reported[n.source] = true; });
      posts.filter((p) => p.source && p.created_at >= since).forEach((p) => { reported[p.source] = true; });
      const todo = await loadTodo();
      const openTodo = todo.filter((i) => !i.done_at);
      // ผู้เข้าชมเว็บแยกส่วน (นับไม่ซ้ำต่อคนต่อวัน) 7 วัน + วันนี้ + เมื่อวาน
      let visits = null;
      try {
        const hr = await sb('shop_state?id=eq.hits&select=data'); const hd = hr?.[0]?.data?.days || {};
        const dayK = (off) => new Date(now + 7 * 3600e3 - off * 864e5).toISOString().slice(0, 10);
        const grp = (k) => k === 'store' ? 'store' : k.startsWith('p/') ? 'salepage' : k === 'daily' ? 'daily' : k.startsWith('quiz') ? 'quiz' : k.startsWith('learn') ? 'learn' : k === 'order' ? 'order' : 'other';
        const sum = (keys) => { const g = {}, pages = {}; for (const dk of keys) for (const [k, v] of Object.entries(hd[dk] || {})) { g[grp(k)] = (g[grp(k)] || 0) + v; pages[k] = (pages[k] || 0) + v; } return { g, pages }; };
        const w = sum([0, 1, 2, 3, 4, 5, 6].map(dayK)), t = sum([dayK(0)]), y = sum([dayK(1)]);
        const tot = (o) => Object.values(o).reduce((a, b) => a + b, 0);
        visits = { week: w.g, today: t.g, yesterday: y.g, total7: tot(w.g), totalToday: tot(t.g), totalYesterday: tot(y.g), top: Object.entries(w.pages).sort((a, b) => b[1] - a[1]).slice(0, 8), since: Object.keys(hd).sort()[0] || null };
      } catch (e) {}
      // ภาพถ่ายตัวเลขรายวัน (วันที่ไทย): เก็บค่าที่คำนวณย้อนหลังไม่ได้ ไว้เทียบกับเมื่อวาน
      const spendNow = campaigns.reduce((a, c) => a + c.spend, 0), queuedNow = queued.length;
      const yKey = Object.keys(hist).sort().filter((k) => k < today).pop(); const yd = yKey ? hist[yKey] : null;
      hist[today] = { ...(hist[today] || {}), ...(thF != null ? { th: thF } : {}), ...(fbF != null ? { fb: fbF } : {}), spend: spendNow, queued: queuedNow, todo: openTodo.length };
      { const keep = Object.keys(hist).sort().slice(-40); const h2 = {}; keep.forEach((k) => { h2[k] = hist[k]; }); await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'dash_hist', data: { days: h2 }, updated_at: '2000-01-01T00:00:00Z' }], prefer: 'resolution=merge-duplicates,return=minimal' }).catch(() => {}); }
      const dif = (cur, old) => (cur == null || old == null ? null : Math.round((cur - old) * 100) / 100);
      const vsY = { revenue: dif(sum(wk), sum(wkY)), orders: dif(wk.length, wkY.length), published: dif(pub.length, pubY), unpaid: dif(real.filter((o) => o.status !== 'paid' && o.created_at >= since).length, unpaidY),
        spend: dif(spendNow, yd?.spend), queued: dif(queuedNow, yd?.queued), todo: dif(openTodo.length, yd?.todo), threads: dif(thF, yd?.th), facebook: dif(fbF, yd?.fb), since: yKey || null };
      return res.status(200).json({ ok: true, at: nowIso, vsY, visits,
        sales: { revenue: sum(wk), orders: wk.length, lastRevenue: sum(lw), lastOrders: lw.length, unpaid: real.filter((o) => o.status !== 'paid' && o.created_at >= since).length, store: { orders: wk.filter((o) => o.campaign === 'store').length, revenue: sum(wk.filter((o) => o.campaign === 'store')) } },
        ads: { spend: campaigns.reduce((a, c) => a + c.spend, 0), campaigns },
        followers: { threads: thF, facebook: fbF, threadsDelta: base && thF != null && base.th != null ? thF - base.th : null, facebookDelta: base && fbF != null && base.fb != null ? fbF - base.fb : null, since: weekAgo || null },
        posts: { published: { facebook: pub.filter((p) => ch(p) === 'facebook').length, threads: pub.filter((p) => ch(p) === 'threads').length }, queued: { facebook: queued.filter((p) => ch(p) === 'facebook').length, threads: queued.filter((p) => ch(p) === 'threads').length }, held: posts.filter((p) => p.status === 'needs_owner').length, failed: posts.filter((p) => p.status === 'failed').length, policy: posts.filter((p) => p.status !== 'published' && (policyState(p.notes)?.level || 'ok') !== 'ok').length },
        todo: { open: openTodo.length, delegated: openTodo.filter((i) => i.delegated_at).length },
        factory: { active: jobs.filter((j) => ['queued', 'producing'].includes(j.status)).length, doneWeek: jobs.filter((j) => j.status === 'done' && (j.done_at || '') >= since).length },
        team: { quiet: Object.keys(MEMBER_TH).filter((k) => !['care', 'factory'].includes(k) && !reported[k]) },
        report: rep ? { at: rep.created_at, decide: items(sec('ต้องขอคุณแดนตัดสิน')), ask: sec('สิ่งที่อยากให้คุณแดนทำ'), plan: sec('แผนสัปดาห์หน้า'), summary: sec('สรุปสัปดาห์') } : null });
    }
    if (action === 'deck') {
      // สไลด์รายงาน (Canva) ส่งถึงคุณแดน: ขึ้นห้องประชุม + เช็คลิสต์พร้อมลิงก์
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      const url = String(body.url || '').trim(), title = String(body.title || 'สไลด์รายงาน').trim().slice(0, 120);
      if (!/^https:\/\/([a-z0-9-]+\.)*(canva\.com|canva\.link)\//i.test(url)) return res.status(400).json({ ok: false, error: 'ต้องเป็นลิงก์ Canva' });
      const src = MEMBER_TH[body.source] ? String(body.source) : 'manager';
      const summary = String(body.summary || '').trim().slice(0, 600);
      await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'deck', source: src, text: `${title}\n${summary ? summary + '\n' : ''}เปิดสไลด์: ${url}`, link_url: url }], prefer: 'return=minimal' });
      const r = await addTodo({ text: `อ่านสไลด์: ${title}`, type: 'do', from: src, link: url });
      return res.status(200).json({ ok: true, todo: r.item?.id });
    }
    if (action === 'ai_status') {
      // สถานะ AI ห้องพัก: ใส่คีย์หรือยัง และเซิร์ฟเวอร์ (สิงคโปร์) ต่อถึงไหม (Chub บล็อกบางประเทศ)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const ai = breakAI(); const base = ai ? ai.base : 'https://mercury.chub.ai/v1';
      let reach = null;
      try { const r = await fetch(`${base}/models`, { headers: ai ? aiHeaders(ai) : {}, signal: AbortSignal.timeout(8000) }); const t = await r.text(); let models = []; try { models = (JSON.parse(t).data || []).map((m) => m.id).slice(0, 12); } catch {} reach = { status: r.status, blocked: /not available in your country/i.test(t), models, sample: models.length ? '' : t.slice(0, 160) }; } catch (e) { reach = { error: String(e.message || e) }; }
      return res.status(200).json({ ok: true, engine: ai ? ai.name : 'Claude', configured: !!ai, base, model: ai ? ai.model || null : null, reach, state: await aiState().catch(() => ({})) });
    }
    if (action === 'ai_day' || action === 'ai_reply') {
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req) && !cronOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      try {
        const out = action === 'ai_day' ? await aiDay(req.headers.host, req.query.force === '1') : await aiReply(req.headers.host, String(req.query.id || ''));
        return res.status(200).json(out);
      } catch (e) { await aiState({ last_error: String(e.message || e).slice(0, 300), last_error_at: new Date().toISOString() }).catch(() => {}); return res.status(200).json({ ok: false, error: String(e.message || e) }); }
    }
    if (action === 'team_cfg') {
      // ตั้งค่าสมาชิก/ทั้งทีม: GET (แอดมินหรือ key) POST เฉพาะคุณแดน {global:{todo_hours,manager_money,team_note}, members:{<source>:{paused,note,fields:[{k,label,value}]}}}
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const cfg = await loadCfg();
      if (req.method !== 'POST') return res.status(200).json({ ok: true, cfg });
      if (!admin) return res.status(403).json({ ok: false, error: 'ตั้งค่าได้เฉพาะคุณแดน' });
      const body = await readBody(req);
      const notify = {};
      const say = (k, t) => { (notify[k] = notify[k] || []).push(t); };
      if (body.global && typeof body.global === 'object') {
        const g = body.global, o = cfg.global;
        if (g.todo_hours != null) { const h = Math.min(168, Math.max(1, Math.round(Number(g.todo_hours) || 24))); if (h !== o.todo_hours) say('manager', `เวลาตอบเช็คลิสต์ของคุณแดนเปลี่ยนจาก ${o.todo_hours} เป็น ${h} ชม. เลยเวลาแล้วพี่ต้นตัดสินแทน`); o.todo_hours = h; }
        if (g.manager_money != null) { const v = !!g.manager_money; if (v !== !!o.manager_money) say('manager', v ? 'อนุญาตให้พี่ต้นตัดสินเรื่องเงินแทนได้เมื่อคุณแดนตอบไม่ทัน' : 'เรื่องเงินที่คุณแดนตอบไม่ทัน ให้เลือกทางที่ไม่เพิ่มค่าใช้จ่าย'); o.manager_money = v; }
        if (g.team_note != null) { const t = String(g.team_note).trim().slice(0, 800); if (t !== (o.team_note || '')) say('manager', t ? `คำสั่งถึงทั้งทีม (ช่วยกระจายให้ทุกคน): ${t}` : 'ยกเลิกคำสั่งถึงทั้งทีมเดิม'); o.team_note = t; }
      }
      if (body.members && typeof body.members === 'object') {
        for (const [k, m] of Object.entries(body.members)) {
          if (!MEMBER_TH[k] || !m || typeof m !== 'object') continue;
          const old = cfg.members[k] || { paused: false, note: '', fields: [] };
          const next = { paused: !!m.paused, note: String(m.note || '').trim().slice(0, 800), fields: (Array.isArray(m.fields) ? m.fields : []).slice(0, 10).map((f) => ({ k: String(f.k || '').slice(0, 24), label: String(f.label || '').slice(0, 60), value: String(f.value ?? '').trim().slice(0, 80) })).filter((f) => f.k) };
          if (next.paused !== !!old.paused) say(k, next.paused ? 'พักงานก่อน ไม่ต้องทำงานประจำจนกว่าคุณแดนจะเปิดอีกครั้ง' : 'กลับมาทำงานตามปกติได้แล้ว');
          for (const f of next.fields) { const of = (old.fields || []).find((x) => x.k === f.k); const ov = of ? of.value : ''; if (f.value !== ov) say(k, f.value ? `${f.label}: ${f.value}` : `${f.label}: กลับไปใช้ค่าปกติ`); }
          if (next.note !== (old.note || '')) say(k, next.note ? `คำสั่งประจำเพิ่มเติม: ${next.note}` : 'ยกเลิกคำสั่งประจำเพิ่มเติมเดิม');
          cfg.members[k] = next;
        }
      }
      await saveCfg(cfg);
      const sent = [];
      for (const [k, lines] of Object.entries(notify)) { try { await ownerReply(k, `ตั้งค่าใหม่ มีผลตั้งแต่รอบงานถัดไป ทำตามทุกรอบจนกว่าจะเปลี่ยน: ${lines.join(' / ')}`); sent.push(k); } catch (e) {} }
      return res.status(200).json({ ok: true, cfg, notified: sent });
    }
    if (action === 'todo') {
      // เช็คลิสต์ของคุณแดน (แอดมินหรือ key): GET รวมรายการจากรายงาน/แผนของพี่ต้น 14 วัน + รายการที่ทีมส่งตรง, POST {id,done}|{text}|{id,remove}
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      let items = await loadTodo();
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (body.text && !body.id) {
          const r = await addTodo({ text: body.text, type: body.type, from: admin ? 'owner' : (body.from || 'manager'), link: body.link });
          return res.status(200).json({ ok: true, items: r.items, id: r.item.id, duplicate: r.duplicate });
        } else if (body.id) {
          const it = items.find((x) => x.id === String(body.id));
          if (!it) return res.status(404).json({ ok: false, error: 'ไม่พบรายการ' });
          if (body.remove) items = items.filter((x) => x.id !== it.id);
          else if (body.resolve) {
            // พี่ต้นปิดเรื่องที่รับแทนคุณแดน (เลยเวลาตอบ)
            const txt = String(body.resolve).trim().slice(0, 1500);
            it.answer = txt; it.resolved_by = MEMBER_TH[body.from] ? String(body.from) : 'manager'; it.answered_at = new Date().toISOString(); it.done_at = it.done_at || it.answered_at;
          } else if (body.extend && admin) {
            const h = todoHours(await loadCfg());
            it.due_at = new Date(Date.now() + h * 36e5).toISOString(); delete it.delegated_at; delete it.delegated_to;
          }
          else if (body.answer) {
            // คุณแดนตอบข้อเสนอ/สั่งการกลับ: ปิดรายการ และส่งคำตอบเข้ากระดานทีมถึงคนที่ส่งมา (kind reply)
            const answer = String(body.answer).trim().slice(0, 1500);
            if (!answer) return res.status(400).json({ ok: false, error: 'พิมพ์คำตอบก่อน' });
            const to = MEMBER_TH[it.from] ? it.from : 'manager';
            it.answer = answer; it.answered_at = new Date().toISOString(); it.done_at = it.done_at || it.answered_at;
            await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'reply', source: 'manual', text: `@${to} ตอบ${it.type === 'decide' ? 'ข้อเสนอ' : 'งาน'} "${it.text.slice(0, 140)}": ${answer}` }], prefer: 'return=minimal' });
          }
          else it.done_at = body.done === false ? null : new Date().toISOString();
        } else return res.status(400).json({ ok: false, error: 'ต้องส่ง text หรือ id' });
        await saveTodo(items);
        return res.status(200).json({ ok: true, items });
      }
      // ดึงรายการใหม่จากรายงาน (kind report) และแผน (kind plan) ของพี่ต้น 14 วันล่าสุด กันซ้ำด้วยข้อความเดียวกันภายใน 7 วัน
      const since = new Date(Date.now() - 14 * 864e5).toISOString();
      const notes = await sb(`posts?status=eq.note&source=eq.manager&kind=in.(report,plan)&created_at=gte.${since}&select=id,kind,text,created_at&order=created_at.desc&limit=12`);
      const { randomUUID } = await import('node:crypto');
      const norm = (t) => String(t).replace(/\s+/g, ' ').trim().toLowerCase();
      let added = 0;
      for (const n of notes.reverse()) {
        for (const it of extractTodo(n.text)) {
          const dup = items.find((x) => norm(x.text) === norm(it.text) && Math.abs(Date.parse(x.created_at) - Date.parse(n.created_at)) < 7 * 864e5);
          if (dup) continue;
          items.unshift({ id: randomUUID(), type: it.type, text: it.text, from: n.kind === 'plan' ? 'plan' : 'manager', note_id: n.id, created_at: n.created_at, done_at: null, due_at: null });
          added++;
        }
      }
      if (added) await saveTodo(items);
      const { hours } = await todoWithDue(items);
      const hasCh = await channelCol();
      // ตรวจนโยบายโพสต์ในคิวที่ยังไม่เคยตรวจ (ครั้งละไม่เกิน 40)
      try {
        const unchecked = (await sb(`posts?status=in.(draft,approved,needs_owner)&scheduled_at=gte.${new Date().toISOString()}&select=id,status,text,notes${hasCh ? ',channel' : ''}&limit=60`)).filter((x) => !policyState(x.notes)).slice(0, 40);
        const shopC = unchecked.length ? await loadShop().catch(() => ({ products: [] })) : null;
        // โพสต์ที่ระบบกักไว้เองแล้วกฎปรับจนไม่เสี่ยงแล้ว: คืนสถานะเดิม (ไม่แตะเรื่องที่พี่ต้นส่งให้คุณแดนเอง)
        const held = (await sb(`posts?status=eq.needs_owner&select=id,text,notes,source${hasCh ? ',channel' : ''}&limit=40`)).filter((x) => policyState(x.notes)?.level === 'block' && !/⚠️ พี่ต้น:/.test(x.notes || ''));
        const shopH = held.length ? await loadShop().catch(() => ({ products: [] })) : null;
        for (const x of held) { const r = checkPolicy(x, shopH); if (r.level !== 'block') await sbPatch(`posts?id=eq.${x.id}`, { status: /✅/.test(x.notes || '') || x.source === 'clip' ? 'approved' : 'draft', notes: [x.notes, policyMark(r)].join('\n').slice(0, 1500) }); }
        for (const x of unchecked) { const r = checkPolicy(x, shopC); const patch = { notes: [x.notes, policyMark(r)].filter(Boolean).join('\n').slice(0, 1500) }; if (r.level === 'block' && x.status !== 'needs_owner') patch.status = 'needs_owner'; await sbPatch(`posts?id=eq.${x.id}`, patch); }
      } catch (e) { console.error('policy sweep', e.message); }
      const pend = await sb(`posts?status=in.(needs_owner,failed)&select=id,status,kind,source,error,text,notes,scheduled_at${hasCh ? ',channel' : ''}&order=scheduled_at.asc.nullslast&limit=20`);
      // โพสต์ที่ระบบเตือนเรื่องนโยบายและยังไม่ขึ้นเพจ (ขึ้นเช็คลิสต์ให้คุณแดนเห็น)
      const flagged = await sb(`posts?status=in.(draft,approved)&notes=ilike.*${encodeURIComponent('[นโยบาย-')}*&select=id,status,kind,source,error,text,notes,scheduled_at${hasCh ? ',channel' : ''}&order=scheduled_at.asc.nullslast&limit=20`).catch(() => []);
      const auto = [...pend, ...flagged.filter((p) => { const st = policyState(p.notes); return st && st.level !== 'ok'; })].map((p) => ({ id: p.id, status: p.status, kind: p.kind, source: p.source || null, error: p.error ? String(p.error).slice(0, 160) : null, channel: p.channel || 'facebook', scheduled_at: p.scheduled_at, headline: String(p.text || '').split('\n')[0].slice(0, 80), policy: policyState(p.notes) }));
      items.sort((a, b) => (a.done_at ? 1 : 0) - (b.done_at ? 1 : 0) || Date.parse(b.created_at) - Date.parse(a.created_at));
      return res.status(200).json({ ok: true, items, auto, added, hours });
    }
    if (action === 'reply') {
      // เจ้าของตอบ/สั่งสมาชิกจากการ์ดทีม → เก็บเป็น note kind reply (ขึ้นกระดานทีมท้ายแผน)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const body = await readBody(req);
      const to = String(body.to || ''); const text = String(body.text || '').trim().slice(0, 1500);
      if (!MEMBER_TH[to] || !text) return res.status(400).json({ ok: false, error: 'ต้องระบุผู้รับและข้อความ' });
      const rid = await ownerReply(to, text);
      return res.status(200).json({ ok: true, to, name: MEMBER_TH[to], id: rid });
    }
    if (action === 'publish') {
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !cronOk(req) && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      let readlab = null; // เพจ/Threads ReadLab (บัญชีแยก) รอบเดียวกัน
      if (!req.query.id) { try { readlab = await publishReadlab(); } catch (e) { readlab = { ok: false, error: String(e.message || e) }; } }
      const fb = await loadFb();
      let th = await loadThreads(); th = threadsConnected(th) ? await refreshIfNeeded(th) : null;
      if (!fb && !th) return res.status(200).json({ ok: false, skipped: true, error: 'ยังไม่ได้เชื่อมเพจ Facebook (แท็บคอนเทนต์ → เชื่อมเพจ)', readlab });
      const id = String(req.query.id || '');
      const due = id
        ? await sb(`posts?id=eq.${encodeURIComponent(id)}&status=in.(approved,draft,failed,needs_owner)&select=*`)
        : await sb(`posts?status=eq.approved&scheduled_at=lte.${new Date().toISOString()}&select=*&order=scheduled_at.asc&limit=12`);
      // รอบอัตโนมัติ: โพสต์ที่ล้มเหลวเพราะเซิร์ฟเวอร์ปลายทางล่มชั่วคราว (5xx/timeout) ลองซ้ำให้ 1 ครั้ง ภายใน 2 วัน
      if (!id) {
        const TRANS = /\b5\d\d\b|timeout|timed out|temporar|unavailable|ECONN|fetch failed|try again/i;
        const retry = await sb(`posts?status=eq.failed&scheduled_at=gte.${new Date(Date.now() - 2 * 864e5).toISOString()}&select=*&order=scheduled_at.asc&limit=5`);
        for (const r of retry) if (TRANS.test(r.error || '') && !String(r.error).startsWith('[ลองซ้ำแล้ว]')) { r._retry = true; due.push(r); }
      }
      const results = [];
      for (const p of due) {
        const ch = p.channel === 'threads' ? 'threads' : 'facebook';
        if (ch === 'threads' && !th) { results.push({ id: p.id, ok: false, error: 'ยังไม่ได้เชื่อม Threads' }); continue; }
        if (ch === 'facebook' && !fb) { results.push({ id: p.id, ok: false, error: 'ยังไม่ได้เชื่อมเพจ Facebook' }); continue; }
        // ตรวจนโยบายโพสต์ที่ยังไม่เคยผ่านการตรวจ (ร่างก่อนมีระบบ) เสี่ยงสูง = กักไว้ให้คุณแดน ไม่โพสต์
        if (!policyState(p.notes)) {
          const pr = checkPolicy(p, await loadShop().catch(() => ({ products: [] })));
          if (pr.level !== 'ok') {
            const patchP = { notes: [p.notes, policyMark(pr)].filter(Boolean).join('\n').slice(0, 1500) };
            if (pr.level === 'block' && !id) { patchP.status = 'needs_owner'; await sbPatch(`posts?id=eq.${p.id}`, patchP); await chatEvent('guard', 'กักโพสต์ไว้ 1 ชิ้นครับ ระบบตรวจว่าเสี่ยงผิดนโยบายแพลตฟอร์ม รอคุณแดนตัดสิน', 'policy'); results.push({ id: p.id, ok: false, error: 'กักไว้: เสี่ยงผิดนโยบาย' }); continue; }
            await sbPatch(`posts?id=eq.${p.id}`, patchP); p.notes = patchP.notes;
          }
        }
        // จองสิทธิ์ก่อนโพสต์ กันโพสต์ซ้ำเมื่อ cron กับแอดมินชนกัน
        const claimed = await sbPatch(`posts?id=eq.${p.id}&status=neq.publishing&status=neq.published`, { status: 'publishing' });
        if (!claimed.length) continue;
        try {
          if (ch === 'threads') {
            const thId = await publishToThreads(th, p);
            await sbPatch(`posts?id=eq.${p.id}`, { status: 'published', published_at: new Date().toISOString(), th_post_id: String(thId), error: null });
            await chatEvent(p.kind === 'reel' ? 'clip' : 'writer', p.kind === 'reel' ? pick(['คลิปขึ้น Threads แล้วครับ ไปกดหัวใจให้หน่อย 🎬', 'Reels ลง Threads แล้วครับ ลุ้นยอดวิว 👀']) : pick(['โพสต์ขึ้น Threads แล้วค่ะ ✨', 'ลง Threads แล้วน้า ใครว่างไปกดไลก์ให้กำลังใจหน่อยค่ะ']), 'published');
            results.push({ id: p.id, ok: true, channel: 'threads', th_post_id: thId });
          } else {
            const fbId = await publishToPage(fb, p);
            await sbPatch(`posts?id=eq.${p.id}`, { status: 'published', published_at: new Date().toISOString(), fb_post_id: String(fbId), error: null });
            await chatEvent(p.kind === 'reel' ? 'clip' : 'writer', p.kind === 'reel' ? pick(['Reels ขึ้นเพจแล้วครับ ใครว่างไปกดหัวใจให้หน่อย 🎬', 'คลิปขึ้นเพจแล้วครับ ลุ้นยอดวิวกัน 👀', 'ปล่อยคลิปแล้วครับ ถ้าคอมเมนต์เยอะเลี้ยงชานม']) : pick(['โพสต์ขึ้นเพจแล้วค่ะ ✨', 'โพสต์ขึ้นแล้วน้า ไปกดไลก์ให้กำลังใจกันหน่อยค่ะ 🙏', 'ส่งขึ้นเพจแล้วค่ะ วันนี้ขอยอดแชร์เยอะๆ']), 'published');
            results.push({ id: p.id, ok: true, fb_post_id: fbId });
          }
        } catch (e) {
          await sbPatch(`posts?id=eq.${p.id}`, { status: 'failed', error: ((p._retry ? '[ลองซ้ำแล้ว] ' : '') + String(e.message || e)).slice(0, 500) });
          await chatEvent('guard', pick(['โพสต์ขึ้นไม่ผ่านครับ 1 รายการ ผมบันทึกสาเหตุไว้ในแท็บคอนเทนต์แล้ว', 'มีโพสต์ล้มเหลวครับ เดี๋ยวเช็กให้ ระบบเก็บ error ไว้แล้ว', 'แจ้งครับ โพสต์ตัวหนึ่งขึ้นไม่สำเร็จ ดูรายละเอียดที่คอนเทนต์']), 'failed');
          results.push({ id: p.id, ok: false, error: String(e.message || e) });
        }
      }
      // รอบ cron เย็น: เตือนคนที่จ่ายไม่เสร็จด้วย
      let recover = null;
      if (!id && cronOk(req)) { try { recover = await sendRecoveries(); } catch (e) { recover = { ok: false, error: String(e.message || e) }; } }
      let qr = null; // รอบ publish ของ cron และของน้องคอม (08:00/21:00) เก็บตกออเดอร์ QR ด้วย
      if (!id) { try { qr = await sweepQrPayments(); } catch (e) { qr = { ok: false, error: String(e.message || e) }; } }
      let leadmail = null; // รอบเดียวกัน: น้องคอมส่งอีเมลเตือนคนค้างจ่าย
      if (!id) { try { leadmail = await autoLeadMails(); } catch (e) { leadmail = { ok: false, error: String(e.message || e) }; } }
      return res.status(200).json({ ok: true, published: results.filter((r) => r.ok).length, results, recover, qr, leadmail, readlab });
    }
    res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
