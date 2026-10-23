// 🤖 ผลิตอัตโนมัติของโรงงาน (สวิตช์ "ให้ AI ผลิตเอง" บนบอร์ด): ตัดสินใจแบบไม่ใช้ AI · ใช้ทั้งตอนสร้างใบสั่ง (api/content.js) และตอนบอกสถานะบนบอร์ด
// คุณแดน 24 ต.ค. 69 "แล้วอันนี้ใช้ได้จริงมั้ยนิ" → พบว่า: หนังสือไม่เคยหยิบเพราะชุดเดียวที่เลือก (TOEIC 750+) ผลิตครบแล้ว + งานค้าง "กำลังผลิต" บังทั้งระบบ
// · คอร์ส ก.พ. บทที่ล้มเพราะเครดิตเสียงหมดถูกนับว่า "ทำแล้ว" เลยไม่เคยลองใหม่ · แกรมมาร์ทำครบแผนแล้ว
export const STALE_H = 12; // กำลังผลิตเกินนี้ (นับจากความคืบหน้าล่าสุด) = รอบผลิตหยุดกลางทาง
export const LESSON_TRIES = 2; // บทที่ล้มลองใหม่อัตโนมัติได้อีก 1 ครั้ง

// หัวข้อสำรองเมื่อชุดที่เลือกผลิตครบแล้ว: หมวดขายดีก่อน (IELTS → TOEIC → ก.พ. → ทั่วไป) · ชื่อขึ้นต้นภาษาอังกฤษเพื่อเช็คซ้ำกับร้าน/คลังได้
const RULES = 'เนื้อหาแต่งใหม่ทั้งหมด ห้ามลอกข้อสอบจริง (Cambridge/ETS/ก.พ.) · ถ้ามีไฟล์เสียงใช้ของฟรีเท่านั้น: Google โควตาฟรีรายเดือน แล้ว Kokoro (ห้ามเสียงที่ต้องจ่ายเงิน) · ฉบับเว็บเต็มเล่ม จำกัด ≤50 หน้าเฉพาะฉบับพิมพ์ Shopee · ก่อนผลิตเช็คว่าไม่ซ้ำเล่มในร้าน/คลัง ถ้าซ้ำให้ fail พร้อมเหตุผล';
export const BOOK_POOL = [
  { t: 'IELTS LISTENING MAP & PLAN LABELLING 200 ข้อ ฝึกฟังแผนที่และแผนผัง พร้อมไฟล์เสียง', cat: 'เตรียมสอบ IELTS', pages: 80 },
  { t: 'TOEIC LISTENING PART 2 QUESTION-RESPONSE 400 ข้อ จับตัวหลอกเสียงคล้าย พร้อมไฟล์เสียง', cat: 'เตรียมสอบ TOEIC', pages: 90 },
  { t: 'IELTS ACADEMIC WORD LIST 570 คำ พร้อมประโยคตัวอย่างและแบบฝึก', cat: 'เตรียมสอบ IELTS', pages: 90 },
  { t: 'TOEIC PART 6 TEXT COMPLETION 30 ชุด 120 ข้อ พร้อมเฉลยละเอียด', cat: 'เตรียมสอบ TOEIC', pages: 80 },
  { t: 'IELTS READING DIAGRAM & FLOW-CHART COMPLETION 200 ข้อ พร้อมเฉลยและจุดที่มีคำตอบ', cat: 'เตรียมสอบ IELTS', pages: 90 },
  { t: 'KP SYNONYM & ANTONYM ก.พ. 400 ข้อ คำเหมือนคำตรงข้ามที่ออกสอบ', cat: 'ภาษาอังกฤษ ก.พ.', pages: 70 },
  { t: 'IELTS PRONUNCIATION 300 คำที่คนไทยออกเสียงผิด พร้อมไฟล์เสียง', cat: 'เตรียมสอบ IELTS', pages: 60 },
  { t: 'TOEIC 600 STARTER 21 วัน สำหรับพื้นฐานน้อย พร้อมแบบฝึกทุกวัน', cat: 'เตรียมสอบ TOEIC', pages: 100 },
  { t: 'IELTS LINKING WORDS & COHESION 400 ตัวอย่าง เขียนให้ลื่นได้ Band 7', cat: 'เตรียมสอบ IELTS', pages: 70 },
  { t: 'PHRASAL VERBS 400 คำที่ใช้บ่อยในชีวิตจริง พร้อมตัวอย่างและแบบฝึก', cat: 'ภาษาอังกฤษทั่วไป', pages: 80 },
  { t: 'ENGLISH EMAIL WRITING 150 แบบอีเมลที่ทำงาน พร้อมประโยคสำเร็จรูป', cat: 'ภาษาอังกฤษทั่วไป', pages: 80 },
  { t: 'PREPOSITIONS IN ON AT 300 ข้อ ใช้ให้ถูกพร้อมเหตุผลทุกข้อ', cat: 'ภาษาอังกฤษทั่วไป', pages: 60 },
].map((b) => ({ ...b, notes: RULES }));

const k12 = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const ACTIVE = ['queued', 'producing'];
const NOT_BOOK = ['lesson', 'video', 'cover'];
const lastAct = (j) => Math.max(Date.parse(j.progress?.at || 0) || 0, Date.parse(j.started_at || j.created_at || 0) || 0);

// งานค้าง "กำลังผลิต": ครั้งแรกส่งกลับเข้าคิว 1 ครั้ง · ค้างซ้ำ = ปิดงาน (ไม่ลบอะไร) พร้อมเหตุผลให้เห็นบนบอร์ด · แก้ jobs ในที่ คืนรายการที่เปลี่ยน
export function fixStale(jobs, now = Date.now()) {
  const out = [];
  for (const j of jobs) {
    if (j.status !== 'producing' || now - lastAct(j) < STALE_H * 3600e3) continue;
    const h = Math.round((now - lastAct(j)) / 3600e3);
    if (!j.stale_retry) { j.status = 'queued'; j.stale_retry = 1; j.stale_note = `ค้างสถานะกำลังผลิต ${h} ชม. (รอบผลิตหยุดกลางทาง) ระบบส่งกลับเข้าคิวให้ผลิตใหม่ 1 ครั้ง`; delete j.progress; out.push({ id: j.id, title: j.title, act: 'requeue', h }); }
    else { j.status = 'failed'; j.failed_at = new Date(now).toISOString(); j.error = `ค้างสถานะกำลังผลิต ${h} ชม. เป็นรอบที่ 2 ระบบปิดงานไว้ (ไม่ลบไฟล์) กดสั่งใหม่ได้ในหน้าโรงงาน`; out.push({ id: j.id, title: j.title, act: 'fail', h }); }
  }
  return out;
}

// หนังสือเล่มถัดไป: ชุดที่คุณแดนเลือกก่อน หมดแล้วใช้หัวข้อสำรอง · ไม่ซ้ำสินค้าในร้าน ใบสั่งเดิม หรือเล่มในคลัง Mac
export function nextBook(cfg, jobs, names = [], library = []) {
  const keys = new Set([...names, ...library].map(k12).filter((k) => k.length >= 8));
  const taken = (t) => { const k = k12(t); return (k.length >= 8 && keys.has(k)) || jobs.some((j) => (!['cancelled', 'failed'].includes(j.status) || j.dup) && (String(j.title || '').slice(0, 24) === String(t).slice(0, 24) || (k.length >= 8 && k12(j.title) === k))); };
  const lower = names.map((n) => String(n).toLowerCase());
  for (const set of (cfg.sets || []).filter((x) => (cfg.auto?.sets || []).includes(x.id))) {
    for (const b of set.books || []) { const key = String(b.match || String(b.t).slice(0, 18)).toLowerCase(); if (b.t && !lower.some((n) => n.includes(key)) && !taken(b.t)) return { book: b, from: set.name }; }
  }
  const b = BOOK_POOL.find((x) => !taken(x.t)); return b ? { book: b, from: 'หัวข้อสำรองหมวดขายดี' } : null;
}

// ถึงรอบหยิบหนังสือไหม · คืนเหตุผลที่ยังไม่หยิบ (ใช้บอกบนบอร์ดด้วย)
export function bookGate(cfg, jobs, now = Date.now()) {
  const per = Math.min(4, Math.max(1, Number(cfg.auto?.per_week) || 1)), week = now - 7 * 864e5;
  const mine = jobs.filter((j) => j.ordered_by === 'auto' && !NOT_BOOK.includes(j.kind) && !j.export_no && !j.fill_id);
  const made7 = mine.filter((j) => Date.parse(j.created_at || 0) >= week), last = mine.map((j) => j.created_at).sort().pop() || null;
  const busy = jobs.filter((j) => ACTIVE.includes(j.status) && !j.paused && !NOT_BOOK.includes(j.kind));
  let wait = null;
  if (!cfg.auto?.on) wait = 'off'; else if (cfg.paused) wait = 'paused'; else if (made7.length >= per) wait = 'quota'; else if (busy.length) wait = 'busy';
  const nextAt = made7.length >= per ? new Date(Math.min(...made7.map((j) => Date.parse(j.created_at))) + 7 * 864e5).toISOString() : null;
  return { per, made7: made7.length, last, busy: busy.length, wait, nextAt };
}

// บทเรียนถัดไปของคอร์ส: บทในแผนที่ยังไม่มีในคอร์สและยังไม่เคยสั่ง · บทที่เคยล้ม (เช่นเครดิตเสียงหมด) ลองใหม่ได้ด้วยเลขบทเดิม
const INFRA = /TOP_UP|เติมเงิน|เครดิต|โควตา|quota/i;
export function nextLesson(c, jobs, now = Date.now()) {
  const mine = jobs.filter((j) => j.kind === 'lesson' && j.course_id === c.id);
  const items = String(c.plan || '').split('\n').map((x) => x.trim()).filter(Boolean).map((x) => { const p = x.split('|').map((y) => y.trim()); return p.length >= 2 ? { section: p[0], title: p[1], brief: p[2] || '' } : { section: '', title: p[0], brief: '' }; }).filter((x) => x.title);
  for (const it of items) {
    if ((c.lessons || []).some((l) => l.title === it.title)) continue;
    const js = mine.filter((j) => j.lesson_title === it.title);
    if (js.some((j) => j.status !== 'failed' || j.dup)) continue;
    // ล้มเพราะเงิน/โควตาเสียง (ไม่ใช่ตัวบท) ไม่นับเป็นครั้งที่ลอง แต่รอ 24 ชม. ก่อนลองใหม่ จะได้ไม่ลองทุกชั่วโมง
    if (js.filter((j) => !INFRA.test(j.error || '')).length >= LESSON_TRIES) continue;
    const f = js[js.length - 1];
    if (f && INFRA.test(f.error || '') && now - (Date.parse(f.failed_at || 0) || 0) < 864e5) continue;
    return { it, no: f ? Number(f.lesson_no) || null : null, retry: !!f, lastError: f ? String(f.error || '').slice(0, 160) : '' };
  }
  return null;
}
export function lessonGate(c, jobs, now = Date.now()) {
  const mine = jobs.filter((j) => j.kind === 'lesson' && j.course_id === c.id), week = now - 7 * 864e5, per = Number(c.auto?.perWeek) || 2;
  const auto = mine.filter((j) => j.auto), made7 = auto.filter((j) => Date.parse(j.created_at || 0) >= week).length, last = auto.map((j) => j.created_at).sort().pop() || null;
  const busy = mine.some((j) => ACTIVE.includes(j.status)), next = nextLesson(c, jobs, now);
  let wait = null;
  if (!c.auto?.on) wait = 'off'; else if (!c.plan) wait = 'noplan'; else if (busy) wait = 'busy'; else if (made7 >= per) wait = 'quota'; else if (!next) wait = 'done';
  return { per, made7, last, wait, next: next ? next.it.title : null, retry: !!next?.retry };
}
// ข้อความสถานะใต้สวิตช์บนบอร์ด (ภาษาไทยสั้นๆ)
export function gateText(g, nextTitle) {
  const d = (s) => new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
  const last = g.last ? `ล่าสุด ${d(g.last)}` : 'ยังไม่เคยผลิตเอง';
  const why = { off: 'ปิดอยู่', paused: 'โรงงานหยุดอยู่', quota: `สัปดาห์นี้ครบ ${g.made7}/${g.per} แล้ว${g.nextAt ? ' · รอบถัดไป ' + d(g.nextAt) : ''}`, busy: 'รอคิวว่างก่อน', noplan: 'ยังไม่มีแผนบทเรียน', done: 'ทำครบทุกบทในแผนแล้ว · เพิ่มหัวข้อในแผนคอร์สเพื่อผลิตต่อ' }[g.wait];
  return `${last} · ${why || (nextTitle ? `ถัดไป: ${String(nextTitle).slice(0, 40)}` : 'หัวข้อหมด')}`;
}
