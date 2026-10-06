// คอร์สเรียนออนไลน์ (เรียนในหน้า "บัญชีของฉัน"): ลูกค้าใส่อีเมลที่ซื้อ → เห็นคอร์สที่ซื้อ แท็บบทเรียน + ความคืบหน้า · วิดีโอฝากไว้ใน Google Drive (แชร์แบบมีลิงก์)
// สิทธิ์เรียน: ออเดอร์ที่จ่ายแล้วมีสินค้าที่ผูกกับคอร์ส (ขายคอร์สแยก) หรือชุด@แพ็กเกจ (เช่น ชุด TOEIC แพ็กเกจ Pro) · ตั้งในหลังบ้าน แท็บ 🎓 คอร์สเรียน
// เก็บใน shop_state id=courses {list:[{id,slug,title,desc,grants:['productId','bundleId@pro'],lessons:[{id,section,title,url,min,free}]}]}
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
  return { id, slug: s(c.slug, 60).toLowerCase().replace(/[^a-z0-9-]+/g, '-') || id, title: s(c.title, 120), desc: s(c.desc, 600), image: /^https:\/\//.test(String(c.image || '')) ? s(c.image, 400) : '', on: c.on !== false,
    grants: (Array.isArray(c.grants) ? c.grants : []).map((g) => s(g, 80)).filter(Boolean).slice(0, 20),
    lessons: (Array.isArray(c.lessons) ? c.lessons : []).slice(0, 200).map((l, i) => ({ id: s(l.id, 40) || `l${i + 1}`, section: s(l.section, 80), title: s(l.title, 160), url: s(l.url, 400), min: Math.max(0, Math.round(Number(l.min) || 0)), free: !!l.free, file: s(l.file, 400) })).filter((l) => l.title) };
}
export async function loadCourses() { return ((await getRow('courses')) || {}).list || []; }
export async function saveCourses(list) { const L = list.map(cleanCourse); await putRow('courses', { list: L }); return L; }

// สิทธิ์จากออเดอร์ที่จ่ายแล้วของอีเมลนี้ → คีย์ที่ซื้อ ('productId' และ 'productId@plan')
async function boughtKeys(email) {
  const key = email.replace(/[%_*,()]/g, '');
  const rows = await sbSelect(`orders?status=eq.paid&email=ilike.${encodeURIComponent(key)}&select=session_id,product_id&order=created_at.desc&limit=40`).catch(() => []);
  const out = new Set();
  for (const r of rows) {
    if (r.product_id) out.add(String(r.product_id));
    const id = String(r.session_id || '');
    try {
      const ss = id.startsWith('pi_') ? piToSession(await stripe('GET', `payment_intents/${id}`)) : /^cs_(live|test)_/.test(id) ? await stripe('GET', `checkout/sessions/${id}`) : null;
      const m = ss?.metadata || {}; if (ss && ss.payment_status !== 'paid') continue;
      if (m.productId) { out.add(m.productId); if (m.plan) out.add(`${m.productId}@${m.plan}`); }
      for (const x of String(m.cart || '').split(',').filter(Boolean)) out.add(x);
      for (const x of String(m.cartPlans || '').split(',').filter(Boolean)) { const [p, k] = x.split(':'); if (p && k) out.add(`${p}@${k}`); }
    } catch (e) { /* ดึงจาก Stripe ไม่ได้ ใช้ product_id ของแถว */ }
  }
  return out;
}
export async function myCourses(email) {
  const [list, keys, prog] = await Promise.all([loadCourses(), boughtKeys(email), getRow('course_progress')]);
  const done = (prog || {})[email] || {};
  return list.filter((c) => c.on !== false && c.grants.some((g) => keys.has(g))).map((c) => ({ id: c.id, slug: c.slug, title: c.title, desc: c.desc, image: c.image || '',
    lessons: c.lessons.map((l) => ({ id: l.id, section: l.section, title: l.title, min: l.min, embed: embedUrl(l.url), file: l.file || '' })), done: done[c.id] || [] }));
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
