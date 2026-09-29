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
const MEMBER_TH = { manager: 'พี่ต้น', writer: 'น้องปากกา', designer: 'น้องกราฟิก', trend: 'น้องเทรนด์', community: 'น้องคอม', analyst: 'น้องบูสต์', product: 'พี่โปร', finance: 'พี่บัญชี', factory: 'โรงงาน', care: 'พี่แคร์', guard: 'พี่การ์ด', market: 'พี่มาร์เก็ต', clip: 'น้องคลิป', hr: 'พี่เอชอาร์' };
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
        // คลิปวิดีโอ (kind reel) น้องคลิปอนุมัติเองและระบบโพสต์ตามเวลา ไม่ผ่านพี่ต้น ไม่ต้องรอคุณแดน (คุณแดนสั่ง 28 ก.ย. 69 เพื่อประหยัดโทเค็น)
        status: (p.kind === 'reel' || p.video_url) ? 'approved' : 'draft', source: MEMBER_TH[p.source] ? String(p.source) : 'writer', kind: String(p.kind || (p.video_url ? 'reel' : 'tip')).slice(0, 20), ...(hasCh ? { channel: p.channel === 'threads' ? 'threads' : 'facebook' } : {}),
        text: String(p.text).slice(0, 4000), image_url: p.video_url ? String(p.video_url).slice(0, 500) : p.image_url ? String(p.image_url).slice(0, 500) : null,
        link_url: p.link_url ? String(p.link_url).slice(0, 500) : null,
        scheduled_at: p.scheduled_at && !isNaN(Date.parse(p.scheduled_at)) ? new Date(p.scheduled_at).toISOString() : null,
        week: p.week ? String(p.week).slice(0, 12) : null, notes: p.notes ? String(p.notes).slice(0, 1000) : null,
      }));
      if (!rows.length) return res.status(400).json({ ok: false, error: 'no posts' });
      for (const r of rows) r.image_url = await cacheImage(r.image_url);
      const inserted = await sb('posts', { method: 'POST', body: rows, prefer: 'return=representation' });
      if (rows.some((r) => r.kind === 'reel' && r.source === 'clip')) await chatEvent('clip', pick(['ส่งคลิปใหม่เข้าคิวแล้วครับ ตั้งเวลาโพสต์ไว้แล้ว 🎬', 'คลิปวันนี้เสร็จแล้วครับ รอเวลาปล่อย ใครอยากดูก่อนไปที่แท็บคอนเทนต์', 'ตัดเสร็จแล้วครับ วันนี้ธีมเด็ด ขอเสียงหน่อย']), 'reel');
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
    if (action === 'sold') {
      // จำนวนที่ขายแล้วต่อสินค้า (สาธารณะ ไม่มีข้อมูลลูกค้า) นับจากออเดอร์ที่ชำระแล้ว แคช 5 นาที
      const rows = await sb('orders?status=eq.paid&select=product_id');
      const counts = {}; for (const r of rows) if (r.product_id) counts[r.product_id] = (counts[r.product_id] || 0) + 1;
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
      const rows = await sb(`posts?status=eq.note&created_at=gte.${since}&kind=not.in.(chat,reply,log)&select=id,source,kind,text,notes,created_at,scheduled_at&order=created_at.desc&limit=120`);
      const pm = (n) => { try { return n ? JSON.parse(n) : {}; } catch (e) { return {}; } };
      const comments = rows.filter((r) => r.kind === 'comment');
      const posts = rows.filter((r) => r.kind !== 'comment').map((r) => ({ id: r.id, source: r.source, who: r.source === 'manual' ? 'คุณแดน' : (MEMBER_TH[r.source] || r.source), kind: r.kind, text: String(r.text || '').slice(0, 400), files: (pm(r.notes).files || []).map((f) => f.name), created_at: r.created_at, comments: comments.filter((c) => pm(c.notes).on === r.id).map((c) => ({ source: c.source, text: c.text, at: c.scheduled_at || c.created_at })) }));
      return res.status(200).json({ ok: true, now_utc: new Date().toISOString(), posts });
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
      const msgs = notes.filter((n) => n.kind === 'reply' && Date.parse(n.created_at) >= weekAgo).map((n) => { const m = String(n.text || '').match(/^@(\w+)\s+([\s\S]*)$/); return m ? { to: m[1], name: MEMBER_TH[m[1]] || m[1], text: m[2].trim(), created_at: n.created_at } : null; }).filter(Boolean);
      if (msgs.length) {
        const block = '== ข้อความจากคุณแดน (เจ้าของร้าน) ถึงสมาชิก ตอบกลับสั้นๆ ในรายงาน/Slack ของคุณ และทำตามถ้าอยู่ในหน้าที่ ==\n' + msgs.map((m) => `- ถึง ${m.name} (${m.to}) ${m.created_at.slice(0, 10)}: ${m.text}`).join('\n');
        plan = plan ? { ...plan, text: `${plan.text}\n\n${block}`, created_at: msgs[0].created_at > plan.created_at ? msgs[0].created_at : plan.created_at } : { source: 'manual', kind: 'plan', text: block, created_at: msgs[0].created_at };
      }
      const latest = {};
      for (const n of notes) { if (n.kind === 'plan' || n.kind === 'reply' || n.kind === 'chat' || n.status === 'log') continue; const k = n.source || 'manager'; if (!latest[k]) latest[k] = n; }
      const upcoming = await sb(`posts?status=in.(draft,needs_owner,approved,published)&scheduled_at=gte.${new Date(Date.now() - 2 * 864e5).toISOString()}&select=status,kind,text,scheduled_at,published_at,notes,source${(await channelCol()) ? ',channel' : ''}&order=scheduled_at.asc&limit=40`);
      return res.status(200).json({ ok: true, plan, owner_briefs: briefs, owner_comments: ownerComments, minutes: minutes ? { text: minutes.text, created_at: minutes.created_at } : null, reports: latest, schedule: upcoming.map((p) => ({ status: p.status, kind: p.kind, source: p.source, channel: p.channel || 'facebook', scheduled_at: p.scheduled_at, published_at: p.published_at, headline: String(p.text || '').split('\n')[0].slice(0, 90), experiment: (String(p.notes || '').match(/ทดลอง:\s*([^\n|]+)/) || [])[1] || null })) });
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
      if (!['draft', 'needs_owner'].includes(cur[0].status)) return res.status(200).json({ ok: false, error: `สถานะตอนนี้คือ ${cur[0].status} ไม่ใช่ draft` });
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
        await chatEvent('factory', pick([`เสร็จแล้ว ${String(job.title).slice(0, 40)}`, `ส่งไฟล์แล้วครับ ${String(job.title).slice(0, 40)} ${job.pages || '?'} หน้า`, `งานออกจากโรงงานแล้ว ${String(job.title).slice(0, 40)}`]), 'factory');
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
            rows.push({ id: ids[i], status: 'note', kind: 'chat', source, text, scheduled_at: at, notes: Object.keys(meta).length ? JSON.stringify(meta) : null });
          });
          if (!rows.length) return res.status(400).json({ ok: false, error: 'พิมพ์ข้อความก่อน' });
          await sb('posts', { method: 'POST', body: rows, prefer: 'return=minimal' });
        }
      }
      const days = Math.min(30, Number(req.query.days) || 7);
      const all = !admin && keyOk(req) && req.query.all === '1';
      const rows = await sb(`posts?status=eq.note&kind=eq.chat&created_at=gte.${new Date(Date.now() - days * 864e5).toISOString()}&select=id,source,text,created_at,scheduled_at,notes&order=created_at.asc&limit=240`);
      const nowIso = new Date().toISOString();
      const parseMeta = (n) => { try { return n ? JSON.parse(n) : {}; } catch (e) { return {}; } };
      const withAt = rows.map((r) => ({ id: r.id, source: r.source, text: r.text, created_at: r.created_at, at: r.scheduled_at || r.created_at, meta: parseMeta(r.notes) })).sort((a, b) => a.at.localeCompare(b.at));
      const future = withAt.filter((r) => r.at > nowIso);
      const shown = all ? withAt : withAt.filter((r) => r.at <= nowIso);
      return res.status(200).json({ ok: true, messages: shown.slice(-80), pending: future.length, next_at: future[0] ? future[0].at : null, next_source: future[0] ? future[0].source : null });
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
      const chatRows = await sb(`posts?status=eq.note&kind=eq.chat&created_at=gte.${new Date(now - 3 * 864e5).toISOString()}&select=id,source,text,created_at,scheduled_at,notes&order=created_at.asc&limit=120`);
      const nowIso = new Date().toISOString();
      return res.status(200).json({ ok: true, world, now_utc: nowIso, bkk_date: `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, '0')}-${String(dom).padStart(2, '0')}`, lines, owner_msgs: owner, lore: loreRows?.[0]?.data?.text || '', recent_chat: chatRows.map((r) => ({ id: r.id, source: r.source, text: r.text, at: r.scheduled_at || r.created_at, evt: (() => { try { return !!(r.notes && JSON.parse(r.notes).evt); } catch (e) { return false; } })() })).sort((a, b) => a.at.localeCompare(b.at)).slice(-60), pending_after_now: chatRows.filter((r) => (r.scheduled_at || r.created_at) > nowIso).length });
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
      const pend = await sb(`posts?status=in.(needs_owner,failed)&select=id,status,kind,source,error,text,scheduled_at${hasCh ? ',channel' : ''}&order=scheduled_at.asc.nullslast&limit=20`);
      const auto = pend.map((p) => ({ id: p.id, status: p.status, kind: p.kind, source: p.source || null, error: p.error ? String(p.error).slice(0, 160) : null, channel: p.channel || 'facebook', scheduled_at: p.scheduled_at, headline: String(p.text || '').split('\n')[0].slice(0, 80) }));
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
            await chatEvent(p.kind === 'reel' ? 'clip' : 'writer', p.kind === 'reel' ? pick(['คลิปขึ้น Threads แล้วครับ ไปกดหัวใจให้หน่อย 🎬', 'Reels ลง Threads แล้วครับ ลุ้นยอดวิว 👀']) : pick(['โพสต์ขึ้น Threads แล้วค่ะ ✨', 'ลง Threads แล้วน้า ใครว่างไปกดไลก์ให้กำลังใจหน่อยค่ะ']), 'published');
            results.push({ id: p.id, ok: true, channel: 'threads', th_post_id: thId });
          } else {
            const fbId = await publishToPage(fb, p);
            await sbPatch(`posts?id=eq.${p.id}`, { status: 'published', published_at: new Date().toISOString(), fb_post_id: String(fbId), error: null });
            await chatEvent(p.kind === 'reel' ? 'clip' : 'writer', p.kind === 'reel' ? pick(['Reels ขึ้นเพจแล้วครับ ใครว่างไปกดหัวใจให้หน่อย 🎬', 'คลิปขึ้นเพจแล้วครับ ลุ้นยอดวิวกัน 👀', 'ปล่อยคลิปแล้วครับ ถ้าคอมเมนต์เยอะเลี้ยงชานม']) : pick(['โพสต์ขึ้นเพจแล้วค่ะ ✨', 'โพสต์ขึ้นแล้วน้า ไปกดไลก์ให้กำลังใจกันหน่อยค่ะ 🙏', 'ส่งขึ้นเพจแล้วค่ะ วันนี้ขอยอดแชร์เยอะๆ']), 'published');
            results.push({ id: p.id, ok: true, fb_post_id: fbId });
          }
        } catch (e) {
          await sbPatch(`posts?id=eq.${p.id}`, { status: 'failed', error: String(e.message || e).slice(0, 500) });
          await chatEvent('guard', pick(['โพสต์ขึ้นไม่ผ่านครับ 1 รายการ ผมบันทึกสาเหตุไว้ในแท็บคอนเทนต์แล้ว', 'มีโพสต์ล้มเหลวครับ เดี๋ยวเช็กให้ ระบบเก็บ error ไว้แล้ว', 'แจ้งครับ โพสต์ตัวหนึ่งขึ้นไม่สำเร็จ ดูรายละเอียดที่คอนเทนต์']), 'failed');
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
