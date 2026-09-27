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
import { loadShop, verifyAdmin, sbPatch } from '../lib/shop.js';
import { loadFb, publishToPage } from '../lib/fb.js';
import { loadThreads, publishToThreads, threadsConnected, refreshIfNeeded } from '../lib/threads.js';

const SB_URL = 'https://lpeqaorswhwzlplsaqpe.supabase.co';
const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const CONTENT_KEY = process.env.CONTENT_API_KEY || '';

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
async function loadJobs() { const rows = await sb('shop_state?id=eq.factory&select=data'); return rows?.[0]?.data?.jobs || []; }
async function saveJobs(jobs) { await sb('shop_state?on_conflict=id', { method: 'POST', body: [{ id: 'factory', data: { jobs }, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' }); }
async function logNote(source, text, kind = 'log') { try { await sb('posts', { method: 'POST', body: [{ status: 'note', kind, source, text: String(text).slice(0, 4000) }], prefer: 'return=minimal' }); } catch (e) { console.error('logNote', e.message); } }
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
  const item = { id: randomUUID(), type: type === 'decide' ? 'decide' : 'do', text: String(text).trim().slice(0, 400), from: String(from).slice(0, 20), link: link ? String(link).slice(0, 300) : null, created_at: new Date().toISOString(), done_at: null };
  items.unshift(item); await saveTodo(items);
  return { items, item, duplicate: false };
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
const MEMBER_TH = { manager: 'พี่ต้น', writer: 'น้องปากกา', designer: 'น้องกราฟิก', trend: 'น้องเทรนด์', community: 'น้องคอม', analyst: 'น้องบูสต์', product: 'พี่โปร', finance: 'พี่บัญชี', factory: 'โรงงาน', care: 'พี่แคร์', guard: 'พี่การ์ด', market: 'พี่มาร์เก็ต' };
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
      return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString(), publish: morning, health });
    }
    if (action === 'shop') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const shop = await loadShop();
      const hasCh = await channelCol();
      const recent = await sb(`posts?select=id,status,kind,text,scheduled_at,published_at,notes${hasCh ? ',channel' : ''}&order=created_at.desc&limit=40`);
      const thConn = threadsConnected(await loadThreads());
      const products = shop.products.filter((p) => p.status === 'published').map((p) => ({
        id: p.id, slug: p.slug, name: p.name, headline: p.headline, desc: p.desc, price: p.price, fullPrice: p.fullPrice,
        features: p.features, specs: p.specs, toc: p.toc, forwho: p.forwho, pains: p.pains, faq: p.faq, images: p.images || [],
        url: `https://my-shop-lake-ten.vercel.app/p/${p.slug}`,
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
        status: 'draft', source: 'writer', kind: String(p.kind || 'tip').slice(0, 20), ...(hasCh ? { channel: p.channel === 'threads' ? 'threads' : 'facebook' } : {}),
        text: String(p.text).slice(0, 4000), image_url: p.image_url ? String(p.image_url).slice(0, 500) : null,
        link_url: p.link_url ? String(p.link_url).slice(0, 500) : null,
        scheduled_at: p.scheduled_at && !isNaN(Date.parse(p.scheduled_at)) ? new Date(p.scheduled_at).toISOString() : null,
        week: p.week ? String(p.week).slice(0, 12) : null, notes: p.notes ? String(p.notes).slice(0, 1000) : null,
      }));
      if (!rows.length) return res.status(400).json({ ok: false, error: 'no posts' });
      for (const r of rows) r.image_url = await cacheImage(r.image_url);
      const inserted = await sb('posts', { method: 'POST', body: rows, prefer: 'return=representation' });
      return res.status(200).json({ ok: true, inserted: inserted.length, ids: inserted.map((r) => r.id) , skipped_threads: skippedThreads, warning: skippedThreads ? 'Threads ยังไม่พร้อม (ยังไม่ได้เพิ่มคอลัมน์ channel) ข้ามโพสต์ช่อง Threads' : undefined });
    }
    if (action === 'report') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const prev = new Date(Date.now() - 14 * 864e5).toISOString();
      const orders = await sb(`orders?select=created_at,paid_at,product_name,amount,status,campaign&created_at=gte.${prev}&order=created_at.desc`);
      const hasCh = await channelCol();
      const posts = await sb(`posts?select=id,status,kind,text,scheduled_at,published_at,fb_post_id${hasCh ? ',channel,th_post_id' : ''}&created_at=gte.${prev}&order=created_at.desc`);
      const shop = await loadShop();
      const priv = await sb('shop_state?id=eq.private&select=data');
      const campaigns = priv?.[0]?.data?.campaigns || [];
      const sum = (list) => list.reduce((a, o) => a + (Number(o.amount) || 0), 0);
      const paid = orders.filter((o) => o.status === 'paid');
      const thisWeek = paid.filter((o) => o.paid_at >= since), lastWeek = paid.filter((o) => o.paid_at < since);
      return res.status(200).json({ ok: true, generatedAt: new Date().toISOString(),
        thisWeek: { orders: thisWeek.length, revenue: sum(thisWeek) }, lastWeek: { orders: lastWeek.length, revenue: sum(lastWeek) },
        byProduct: Object.entries(thisWeek.reduce((m, o) => { m[o.product_name] = (m[o.product_name] || 0) + Number(o.amount); return m; }, {})),
        byCampaign: Object.entries(thisWeek.reduce((m, o) => { const k = o.campaign || '(ไม่ได้มาจากแอด)'; m[k] = m[k] || { orders: 0, revenue: 0 }; m[k].orders++; m[k].revenue += Number(o.amount); return m; }, {})),
        campaigns, unpaidCheckouts: orders.filter((o) => o.status !== 'paid' && o.created_at >= since).length,
        posts, products: shop.products.map((p) => ({ name: p.name, status: p.status, price: p.price })) });
    }
    if (action === 'note') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      if (!String(body.text || '').trim()) return res.status(400).json({ ok: false, error: 'no text' });
      const row = { status: 'note', source: String(body.source || 'manager').slice(0, 20), kind: String(body.kind || 'report').slice(0, 20), text: String(body.text).slice(0, 8000), week: body.week ? String(body.week).slice(0, 12) : null };
      const inserted = await sb('posts', { method: 'POST', body: [row], prefer: 'return=representation' });
      return res.status(200).json({ ok: true, id: inserted[0]?.id });
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
      const notes = await sb(`posts?status=in.(note,log)&created_at=gte.${since}&select=source,kind,text,week,created_at&order=created_at.desc&limit=120`);
      let plan = notes.find((n) => n.kind === 'plan') || null;
      // ข้อความจากเจ้าของถึงสมาชิก (kind reply, text ขึ้นต้น @<member>) 7 วันล่าสุด แนบท้ายแผนให้ทุกคนอ่านเจอ
      const weekAgo = Date.now() - 7 * 864e5;
      const msgs = notes.filter((n) => n.kind === 'reply' && Date.parse(n.created_at) >= weekAgo).map((n) => { const m = String(n.text || '').match(/^@(\w+)\s+([\s\S]*)$/); return m ? { to: m[1], name: MEMBER_TH[m[1]] || m[1], text: m[2].trim(), created_at: n.created_at } : null; }).filter(Boolean);
      if (msgs.length) {
        const block = '== ข้อความจากคุณแดน (เจ้าของร้าน) ถึงสมาชิก ตอบกลับสั้นๆ ในรายงาน/Slack ของคุณ และทำตามถ้าอยู่ในหน้าที่ ==\n' + msgs.map((m) => `- ถึง ${m.name} (${m.to}) ${m.created_at.slice(0, 10)}: ${m.text}`).join('\n');
        plan = plan ? { ...plan, text: `${plan.text}\n\n${block}`, created_at: msgs[0].created_at > plan.created_at ? msgs[0].created_at : plan.created_at } : { source: 'manual', kind: 'plan', text: block, created_at: msgs[0].created_at };
      }
      const latest = {};
      for (const n of notes) { if (n.kind === 'plan' || n.kind === 'reply' || n.kind === 'chat' || n.status === 'log') continue; const k = n.source || 'manager'; if (!latest[k]) latest[k] = n; }
      const upcoming = await sb(`posts?status=in.(draft,needs_owner,approved,published)&scheduled_at=gte.${new Date(Date.now() - 2 * 864e5).toISOString()}&select=status,kind,text,scheduled_at,published_at,notes,source${(await channelCol()) ? ',channel' : ''}&order=scheduled_at.asc&limit=40`);
      return res.status(200).json({ ok: true, plan, reports: latest, schedule: upcoming.map((p) => ({ status: p.status, kind: p.kind, source: p.source, channel: p.channel || 'facebook', scheduled_at: p.scheduled_at, published_at: p.published_at, headline: String(p.text || '').split('\n')[0].slice(0, 90), experiment: (String(p.notes || '').match(/ทดลอง:\s*([^\n|]+)/) || [])[1] || null })) });
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
      return res.status(200).json({ ok: true, fbConnected: !!fb, drafts, products: shop.products.filter((p) => p.status === 'published').map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, fullPrice: p.fullPrice, url: `https://my-shop-lake-ten.vercel.app/p/${p.slug}` })) });
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
      if (cur[0].status !== 'draft') return res.status(200).json({ ok: false, error: `สถานะตอนนี้คือ ${cur[0].status} ไม่ใช่ draft` });
      if (status === 'approved' && !cur[0].scheduled_at && !body.scheduled_at) return res.status(400).json({ ok: false, error: 'โพสต์นี้ยังไม่มีเวลา ต้องส่ง scheduled_at มาด้วย' });
      const stamp = `${decision === 'approve' ? '✅' : decision === 'reject' ? '⛔' : '⚠️'} พี่ต้น: ${reason || decision}`;
      const patch = { status, notes: [cur[0].notes, stamp].filter(Boolean).join('\n'), error: null };
      if (body.text && String(body.text).trim()) patch.text = String(body.text).slice(0, 4000);
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
      const rows = await sbPatch(`posts?id=eq.${id}`, patch);
      return res.status(200).json({ ok: true, id, status: rows[0]?.status, scheduled_at: rows[0]?.scheduled_at });
    }
    if (action === 'factory') {
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const st = String(req.query.status || '');
      const jobs = (await loadJobs()).filter((j) => !st || j.status === st).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      return res.status(200).json({ ok: true, jobs });
    }
    if (action === 'factory_order') {
      if (!keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      if (!String(body.title || '').trim()) return res.status(400).json({ ok: false, error: 'ต้องมี title' });
      const { randomUUID } = await import('node:crypto');
      const job = { id: randomUUID(), status: 'queued', created_at: new Date().toISOString(), ordered_by: String(body.ordered_by || 'manager').slice(0, 40) };
      for (const f of FACTORY_FIELDS) if (body[f] != null && body[f] !== '') job[f] = typeof body[f] === 'number' ? body[f] : String(body[f]).slice(0, 2000);
      job.price = Number(job.price || 0);
      const jobs = await loadJobs(); jobs.push(job); await saveJobs(jobs);
      await logNote(job.ordered_by, `สั่งโรงงานผลิตชีท: ${job.title} (${job.pages || '?'} หน้า, ${job.price ? job.price + ' บาท' : 'แจกฟรี'}) เหตุผล: ${job.purpose || '-'}`);
      return res.status(200).json({ ok: true, job });
    }
    if (['factory_claim', 'factory_uploadurl', 'factory_done', 'factory_fail', 'factory_cancel'].includes(action)) {
      const admin = action === 'factory_cancel' && req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'bad key' });
      const body = await readBody(req);
      const jobs = await loadJobs();
      const job = jobs.find((j) => j.id === String(body.id || ''));
      if (!job) return res.status(404).json({ ok: false, error: 'not found' });
      if (action === 'factory_claim') {
        if (job.status !== 'queued') return res.status(200).json({ ok: false, error: `สถานะตอนนี้คือ ${job.status}` });
        job.status = 'producing'; job.started_at = new Date().toISOString();
      } else if (action === 'factory_uploadurl') {
        const safe = String(body.filename || 'sheet.pdf').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'sheet.pdf';
        const path = `factory/${job.id}/${safe}`;
        const r = await fetch(`${SB_URL}/storage/v1/object/upload/sign/product-images/${path}`, { method: 'POST', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: '{}' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) return res.status(500).json({ ok: false, error: `signed url: ${r.status} ${JSON.stringify(j).slice(0, 200)}` });
        return res.status(200).json({ ok: true, upload_url: `${SB_URL}/storage/v1${j.url}`, file_url: `${SB_URL}/storage/v1/object/public/product-images/${path}`, headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'true' } });
      } else if (action === 'factory_done') {
        job.status = 'done'; job.done_at = new Date().toISOString();
        if (body.file_url) job.file_url = String(body.file_url).slice(0, 500);
        if (body.pages) job.pages = Number(body.pages);
        if (body.size) job.size = Number(body.size);
        if (body.summary) job.summary = String(body.summary).slice(0, 2000);
        await logNote('factory', `ผลิตเสร็จ: ${job.title} (${job.pages || '?'} หน้า) ไฟล์: ${job.file_url || '-'}\n${job.summary || ''}`);
        try { await addTodo({ text: `ตรวจไฟล์ชีทที่โรงงานผลิตเสร็จ "${job.title}" (${job.pages || '?'} หน้า) เปิดดูหน้าแรก หน้า 2 และหน้าสุดท้าย ถ้าผ่านให้ทีมเอาไปแจก/ขายได้`, type: 'do', from: 'factory', link: job.file_url || null }); } catch (e) { console.error('todo', e.message); }
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
    if (action === 'chat') {
      // ห้องพักทีม: แชทเล่นนอกเรื่องงาน (kind chat) GET อ่าน 80 ข้อความล่าสุด, POST {text} = คุณแดนแวะมาทัก (แอดมิน) หรือสมาชิกส่ง {text, source} (key)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (body.remove && /^[0-9a-f-]{36}$/.test(String(body.id || ''))) {
          // ลบข้อความในห้องพัก (คุณแดนหรือระบบ) ลบได้เฉพาะ kind chat
          await sb(`posts?id=eq.${body.id}&kind=eq.chat`, { method: 'DELETE', prefer: 'return=minimal' });
        } else if (body.clear && body.clear === 'all') {
          await sb(`posts?kind=eq.chat&status=eq.note`, { method: 'DELETE', prefer: 'return=minimal' });
        } else {
          const text = String(body.text || '').trim().slice(0, 400);
          if (!text) return res.status(400).json({ ok: false, error: 'พิมพ์ข้อความก่อน' });
          const source = admin ? 'manual' : (MEMBER_TH[body.source] ? body.source : 'manager');
          await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'chat', source, text }], prefer: 'return=minimal' });
        }
      }
      const days = Math.min(30, Number(req.query.days) || 7);
      const rows = await sb(`posts?status=eq.note&kind=eq.chat&created_at=gte.${new Date(Date.now() - days * 864e5).toISOString()}&select=id,source,text,created_at&order=created_at.asc&limit=120`);
      return res.status(200).json({ ok: true, messages: rows.slice(-80) });
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
          items.unshift({ id: randomUUID(), type: it.type, text: it.text, from: n.kind === 'plan' ? 'plan' : 'manager', note_id: n.id, created_at: n.created_at, done_at: null });
          added++;
        }
      }
      if (added) await saveTodo(items);
      const hasCh = await channelCol();
      const pend = await sb(`posts?status=in.(needs_owner,failed)&select=id,status,kind,text,scheduled_at${hasCh ? ',channel' : ''}&order=scheduled_at.asc.nullslast&limit=20`);
      const auto = pend.map((p) => ({ id: p.id, status: p.status, kind: p.kind, channel: p.channel || 'facebook', scheduled_at: p.scheduled_at, headline: String(p.text || '').split('\n')[0].slice(0, 80) }));
      items.sort((a, b) => (a.done_at ? 1 : 0) - (b.done_at ? 1 : 0) || Date.parse(b.created_at) - Date.parse(a.created_at));
      return res.status(200).json({ ok: true, items, auto, added });
    }
    if (action === 'reply') {
      // เจ้าของตอบ/สั่งสมาชิกจากการ์ดทีม → เก็บเป็น note kind reply (ขึ้นกระดานทีมท้ายแผน)
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const body = await readBody(req);
      const to = String(body.to || ''); const text = String(body.text || '').trim().slice(0, 1500);
      if (!MEMBER_TH[to] || !text) return res.status(400).json({ ok: false, error: 'ต้องระบุผู้รับและข้อความ' });
      await sb('posts', { method: 'POST', body: [{ status: 'note', kind: 'reply', source: 'manual', text: `@${to} ${text}` }], prefer: 'return=minimal' });
      return res.status(200).json({ ok: true, to, name: MEMBER_TH[to] });
    }
    if (action === 'publish') {
      const admin = req.headers.authorization ? await verifyAdmin(req.headers.authorization) : null;
      if (!admin && !cronOk(req) && !keyOk(req)) return res.status(401).json({ ok: false, error: 'ต้องล็อกอินแอดมิน' });
      const fb = await loadFb();
      let th = await loadThreads(); th = threadsConnected(th) ? await refreshIfNeeded(th) : null;
      if (!fb && !th) return res.status(200).json({ ok: false, skipped: true, error: 'ยังไม่ได้เชื่อมเพจ Facebook (แท็บคอนเทนต์ → เชื่อมเพจ)' });
      const id = String(req.query.id || '');
      const due = id
        ? await sb(`posts?id=eq.${encodeURIComponent(id)}&status=in.(approved,draft,failed,needs_owner)&select=*`)
        : await sb(`posts?status=eq.approved&scheduled_at=lte.${new Date().toISOString()}&select=*&order=scheduled_at.asc&limit=12`);
      const results = [];
      for (const p of due) {
        const ch = p.channel === 'threads' ? 'threads' : 'facebook';
        if (ch === 'threads' && !th) { results.push({ id: p.id, ok: false, error: 'ยังไม่ได้เชื่อม Threads' }); continue; }
        if (ch === 'facebook' && !fb) { results.push({ id: p.id, ok: false, error: 'ยังไม่ได้เชื่อมเพจ Facebook' }); continue; }
        // จองสิทธิ์ก่อนโพสต์ กันโพสต์ซ้ำเมื่อ cron กับแอดมินชนกัน
        const claimed = await sbPatch(`posts?id=eq.${p.id}&status=neq.publishing&status=neq.published`, { status: 'publishing' });
        if (!claimed.length) continue;
        try {
          if (ch === 'threads') {
            const thId = await publishToThreads(th, p);
            await sbPatch(`posts?id=eq.${p.id}`, { status: 'published', published_at: new Date().toISOString(), th_post_id: String(thId), error: null });
            results.push({ id: p.id, ok: true, channel: 'threads', th_post_id: thId });
          } else {
            const fbId = await publishToPage(fb, p);
            await sbPatch(`posts?id=eq.${p.id}`, { status: 'published', published_at: new Date().toISOString(), fb_post_id: String(fbId), error: null });
            results.push({ id: p.id, ok: true, fb_post_id: fbId });
          }
        } catch (e) {
          await sbPatch(`posts?id=eq.${p.id}`, { status: 'failed', error: String(e.message || e).slice(0, 500) });
          results.push({ id: p.id, ok: false, error: String(e.message || e) });
        }
      }
      return res.status(200).json({ ok: true, published: results.filter((r) => r.ok).length, results });
    }
    res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
