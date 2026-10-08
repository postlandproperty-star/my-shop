// คอร์สเรียนออนไลน์ (เรียนในหน้า "บัญชีของฉัน"): ลูกค้าใส่อีเมลที่ซื้อ → เห็นคอร์สที่ซื้อ แท็บบทเรียน + ความคืบหน้า · วิดีโอฝากไว้ใน Google Drive (แชร์แบบมีลิงก์)
// สิทธิ์เรียน: ออเดอร์ที่จ่ายแล้วมีสินค้าที่ผูกกับคอร์ส (ขายคอร์สแยก) หรือชุด@แพ็กเกจ (เช่น ชุด TOEIC แพ็กเกจ Pro) · ตั้งในหลังบ้าน แท็บ 🎓 คอร์สเรียน
// เก็บใน shop_state id=courses {list:[{id,slug,title,desc,emails:[เรียนได้เลยไม่ต้องซื้อ],grants:['productId','bundleId@pro'],lessons:[{id,section,title,url,min,free}]}]}
// ความคืบหน้า id=course_progress {<email>:{<courseId>:[lessonId...]}}
import { SB_URL, stripe, piToSession, sbSelect } from './shop.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const hdr = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
async function getRow(id) { const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.${id}&select=data`, { headers: hdr }); const j = r.ok ? await r.json() : []; return j?.[0]?.data || null; }
async function putRow(id, data) { const r = await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id, data, updated_at: '2000-01-01T00:00:00Z' }]) }); if (!r.ok) throw new Error('save ' + r.status); }

const s = (v, n) => String(v ?? '').trim().slice(0, n);
// ลิงก์วิดีโอ: Google Drive (เปลี่ยนเป็นหน้า preview ให้เล่นในเว็บ) หรือ YouTube (embed)
export function embedUrl(u) {
  u = String(u || '').trim();
  let m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || u.match(/drive\.google\.com\/open\?id=([\w-]+)/); if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/); if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`;
  return /^https:\/\//.test(u) ? u : '';
}
export function cleanCourse(c) {
  const id = s(c.id, 40) || 'c' + Date.now().toString(36);
  return { id, slug: s(c.slug, 60).toLowerCase().replace(/[^a-z0-9-]+/g, '-') || id, title: s(c.title, 120), desc: s(c.desc, 600), image: /^https:\/\//.test(String(c.image || '')) ? s(c.image, 400) : '', poster: /^https:\/\//.test(String(c.poster || '')) ? s(c.poster, 400) : '', on: c.on !== false,
    grants: (Array.isArray(c.grants) ? c.grants : []).map((g) => s(g, 80)).filter(Boolean).slice(0, 20),
    files: (Array.isArray(c.files) ? c.files : []).map((f) => ({ name: s(f.name, 120), url: /^https:\/\//.test(String(f.url || '')) ? s(f.url, 400) : '' })).filter((f) => f.name && f.url).slice(0, 10), // ไฟล์โบนัสของคอร์ส (แท็บเอกสารในหน้าเรียน)
    emails: [...new Set((Array.isArray(c.emails) ? c.emails : String(c.emails || '').split(/[\s,]+/)).map((e) => s(e, 120).toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e)))].slice(0, 50),
    // แผนบทเรียนให้โรงงานผลิต (บรรทัดละบท: หมวด | ชื่อบท | สิ่งที่สอน) · ผลิตอัตโนมัติสัปดาห์ละ N บท · บทที่โรงงานทำเสร็จเข้ามาเป็น "รออนุมัติ" (ลูกค้ายังไม่เห็น)
    plan: s(c.plan, 20000), brief: s(c.brief, 600), auto: { on: !!c.auto?.on, perWeek: Math.min(7, Math.max(1, Math.round(Number(c.auto?.perWeek) || 2))) },
    lessons: (Array.isArray(c.lessons) ? c.lessons : []).slice(0, 200).map((l, i) => ({ id: s(l.id, 40) || `l${i + 1}`, section: s(l.section, 80), title: s(l.title, 160), url: s(l.url, 400), min: Math.max(0, Math.round(Number(l.min) || 0)), free: !!l.free, file: s(l.file, 400),
      status: l.status === 'draft' ? 'draft' : 'live', cover: /^https:\/\//.test(String(l.cover || '')) ? s(l.cover, 400) : '', job: s(l.job, 60), at: s(l.at, 30) })).filter((l) => l.title) };
}
export async function loadCourses() { return ((await getRow('courses')) || {}).list || []; }
export async function saveCourses(list) { const L = list.map(cleanCourse); await putRow('courses', { list: L }); return L; }

// สิทธิ์จากออเดอร์ที่จ่ายแล้วของอีเมลนี้ → คีย์ที่ซื้อ ('productId' และ 'productId@plan')
// คีย์สิทธิ์ของออเดอร์เดียว ('productId', 'productId@plan', ของในตะกร้า) จาก metadata ของ Stripe
async function orderKeys(r) {
  const out = new Set(); if (r.product_id) out.add(String(r.product_id));
  const id = String(r.session_id || '');
  try {
    const ss = id.startsWith('pi_') ? piToSession(await stripe('GET', `payment_intents/${id}`)) : /^cs_(live|test)_/.test(id) ? await stripe('GET', `checkout/sessions/${id}`) : null;
    const m = ss?.metadata || {}; if (ss && ss.payment_status !== 'paid') return [];
    if (m.productId) { out.add(m.productId); if (m.plan) out.add(`${m.productId}@${m.plan}`); }
    for (const x of String(m.cart || '').split(',').filter(Boolean)) out.add(x);
    for (const x of String(m.cartPlans || '').split(',').filter(Boolean)) { const [p, k] = x.split(':'); if (p && k) out.add(`${p}@${k}`); }
  } catch (e) { /* ดึงจาก Stripe ไม่ได้ ใช้ product_id ของแถว */ }
  return [...out];
}
async function boughtKeys(email) {
  const key = email.replace(/[%_*,()]/g, '');
  const rows = await sbSelect(`orders?status=eq.paid&email=ilike.${encodeURIComponent(key)}&select=session_id,product_id&order=created_at.desc&limit=40`).catch(() => []);
  const out = new Set();
  for (const r of rows) for (const k of await orderKeys(r)) out.add(k);
  return out;
}
// แอดมิน: ใครเรียนคอร์สไหน (ซื้อสินค้าไหน / แพ็กเกจ / อีเมลฟรี) + ความคืบหน้า · สิทธิ์ของแต่ละออเดอร์เก็บแคชไว้ (ถาม Stripe ครั้งเดียวต่อออเดอร์)
export async function students() {
  const [list, prog, cache0] = await Promise.all([loadCourses(), getRow('course_progress'), getRow('course_access')]);
  const cache = cache0 || {}; let dirty = false;
  const rows = await sbSelect('orders?status=eq.paid&select=session_id,product_id,product_name,email,name,created_at,amount&order=created_at.desc&limit=600').catch(() => []);
  const need = rows.filter((r) => r.email && r.session_id && !cache[r.session_id]).slice(0, 80);
  for (let i = 0; i < need.length; i += 8) await Promise.all(need.slice(i, i + 8).map(async (r) => { cache[r.session_id] = await orderKeys(r); dirty = true; }));
  if (dirty) await putRow('course_access', cache).catch(() => {});
  const P = prog || {}, by = new Map();
  const add = (email, c, via, at) => {
    const e = String(email).toLowerCase(); const u = by.get(e) || { email: e, name: '', courses: [] }; by.set(e, u);
    if (u.courses.some((x) => x.id === c.id)) return u;
    const live = c.lessons.filter((l) => l.status !== 'draft'), done = ((P[e] || {})[c.id] || []).filter((id) => live.some((l) => l.id === id)).length;
    u.courses.push({ id: c.id, title: c.title, via, at: at || '', done, total: live.length }); return u;
  };
  for (const c of list) {
    for (const r of rows) { const keys = cache[r.session_id] || (r.product_id ? [String(r.product_id)] : []); const g = c.grants.find((k) => keys.includes(k)); if (g && r.email) { const u = add(r.email, c, g.includes('@') ? `แพ็กเกจ ${g.split('@')[1]} · ${r.product_name || ''}`.trim() : `ซื้อ ${r.product_name || 'คอร์ส'}`, r.created_at); if (!u.name && r.name) u.name = r.name; } }
    for (const e of c.emails || []) add(e, c, 'อีเมลที่ร้านให้สิทธิ์', '');
  }
  for (const u of by.values()) { const lg = (P[u.email] || {}).__log; u.last = lg?.days?.length ? lg.days[lg.days.length - 1] : ''; }
  return [...by.values()].sort((a, b) => String(b.courses[0]?.at || '').localeCompare(String(a.courses[0]?.at || '')));
}
// โรงงานผลิตบทเรียนเสร็จ → ใส่เป็นบท "รออนุมัติ" ในคอร์ส (ลูกค้ายังไม่เห็นจนกว่าคุณแดนกดอนุมัติ)
export async function addDraftLesson(courseId, l) {
  const list = await loadCourses(); const c = list.find((x) => x.id === courseId); if (!c) throw new Error('ไม่พบคอร์ส');
  const ex = c.lessons.find((x) => x.job && x.job === l.job);
  const row = { id: ex?.id || 'l' + Date.now().toString(36), section: l.section, title: l.title, url: l.url, min: l.min, status: 'draft', cover: l.cover || '', job: l.job || '', at: new Date().toISOString(), file: '' };
  if (ex) Object.assign(ex, row); else c.lessons.push(row);
  await saveCourses(list); return row;
}
export async function myCourses(email) {
  const [list, keys, prog] = await Promise.all([loadCourses(), boughtKeys(email), getRow('course_progress')]);
  const done = (prog || {})[email] || {};
  const me = email.toLowerCase(); // อีเมลที่ร้านให้สิทธิ์เรียนเต็ม (ไม่ต้องซื้อ) เช่น เจ้าของร้าน/ผู้ช่วยสอน
  return list.filter((c) => c.on !== false && ((c.emails || []).includes(me) || c.grants.some((g) => keys.has(g)))).map((c) => ({ id: c.id, slug: c.slug, title: c.title, desc: c.desc, image: c.image || '', files: c.files || [],
    lessons: c.lessons.filter((l) => l.status !== 'draft').map((l) => ({ id: l.id, section: l.section, title: l.title, min: l.min, embed: embedUrl(l.url), file: l.file || '' })), done: done[c.id] || [] }));
}
export async function markLesson(email, courseId, lessonId, on) {
  const cs = await myCourses(email); const c = cs.find((x) => x.id === courseId); if (!c || !c.lessons.some((l) => l.id === lessonId)) throw new Error('ไม่มีสิทธิ์เรียนบทนี้');
  const prog = (await getRow('course_progress')) || {}; const me = prog[email] || (prog[email] = {}); const L = new Set(me[courseId] || []);
  if (on) L.add(lessonId); else L.delete(lessonId); me[courseId] = [...L];
  const log = me.__log || (me.__log = { days: [], done: [] }); const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  if (!log.days.includes(today)) log.days.push(today); if (on) log.done.push({ c: courseId, l: lessonId, at: new Date().toISOString() });
  log.days = log.days.slice(-120); log.done = log.done.slice(-500);
  await putRow('course_progress', prog); return me[courseId];
}
// สถิติเรียนต่อเนื่อง (แบบ Udemy): สัปดาห์นี้เรียนจบกี่บท / เข้าเรียนกี่วัน / เรียนต่อเนื่องกี่สัปดาห์ (สัปดาห์เริ่มวันจันทร์ เวลาไทย)
const thDay = (t) => new Date(Date.parse(t) + 7 * 3600e3).toISOString().slice(0, 10);
const weekStart = (d) => { const x = new Date(d + 'T00:00:00Z'); const k = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - k); return x.toISOString().slice(0, 10); };
export async function learnStats(email) {
  const log = (((await getRow('course_progress')) || {})[email] || {}).__log || { days: [], done: [] };
  const today = thDay(new Date().toISOString()), wk = weekStart(today), end = new Date(Date.parse(wk + 'T00:00:00Z') + 6 * 864e5).toISOString().slice(0, 10);
  const weekLessons = log.done.filter((x) => weekStart(thDay(x.at)) === wk).length, weekDays = log.days.filter((d) => weekStart(d) === wk).length;
  const weeks = new Set([...log.days.map(weekStart), ...log.done.map((x) => weekStart(thDay(x.at)))]); let streak = 0, w = wk;
  if (!weeks.has(w)) w = new Date(Date.parse(w + 'T00:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
  while (weeks.has(w)) { streak++; w = new Date(Date.parse(w + 'T00:00:00Z') - 7 * 864e5).toISOString().slice(0, 10); }
  return { weekLessons, weekDays, streak, goal: 3, from: wk, to: end };
}
export async function visit(email) {
  const prog = (await getRow('course_progress')) || {}; const me = prog[email] || (prog[email] = {}); const log = me.__log || (me.__log = { days: [], done: [] });
  const today = thDay(new Date().toISOString()); if (log.days.includes(today)) return false; log.days.push(today); log.days = log.days.slice(-120); await putRow('course_progress', prog); return true;
}
