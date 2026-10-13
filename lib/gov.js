// โซนสอบราชการ /gov และ /gov/<slug>: ขายข้อสอบและชีทเตรียมสอบ ก.พ. ท้องถิ่น ครูผู้ช่วย (ไม่มีประกาศรับสมัคร/วันรับสมัคร)
// สนามสอบแก้ในไฟล์นี้ (GOV_EXAMS) · ตัวเลขรูปแบบสอบต้องตรวจกับประกาศทางการ แล้วแก้ checked เป็นวันที่ตรวจ
// วิชา (GOV_SUBJECTS): ข้อสอบ/บทความ/ชีทจับวิชาจากหมวด (kp = อังกฤษ, kp-think, kp-law) หรือคำในชื่อ · เพิ่มวิชาใหม่ = เพิ่มแถวที่นี่ (ไม่แตะไฟล์อื่นของร้าน) · ตอนนี้วิชาอื่นจับจากคำในชื่อ เช่น "อนุกรมเลข ก.พ." "กฎหมาย ก.พ."
// ปุ่มกรองวิชาโชว์เฉพาะวิชาที่มีของจริง · สนามสอบบอกว่าสอบวิชาไหนใน subjects
import { shell, QUIZ_CATS } from './quiz.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const thDate = (d) => { try { return new Date(d + 'T00:00:00+07:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }); } catch (e) { return d; } };

export const GOV_EXAMS = [
  { slug: 'kp-phak-kor', subjects: ['eng', 'think', 'law'], name: 'สอบ ก.พ. ภาค ก', icon: '🏛️', org: 'สำนักงาน ก.พ.', who: 'ป.ตรี ป.โท ปวส. ปวช. ที่อยากรับราชการพลเรือน',
    title: 'สอบ ก.พ. ภาค ก สรุปรูปแบบสอบ เกณฑ์ผ่าน และวิธีเตรียมภาษาอังกฤษ',
    desc: 'สรุปสอบ ก.พ. ภาค ก 3 วิชา จำนวนข้อ เกณฑ์ผ่าน และโครงสร้างภาษาอังกฤษ 25 ข้อ พร้อมข้อสอบฟรีและชีทเตรียมสอบ',
    checked: '2026-10-12',
    summary: ['ภาค ก คือการวัดความรู้ความสามารถทั่วไป ต้องสอบผ่านก่อนจึงสมัครสอบภาค ข ของกรมต่างๆ ได้', 'ผลสอบผ่านใช้ได้ตลอดไป ไม่มีวันหมดอายุ'],
    table: { head: ['วิชา', 'ข้อ', 'คะแนน', 'เกณฑ์ผ่าน'], rows: [['คิดวิเคราะห์ (ภาษาไทย ตัวเลข เหตุผล)', '50', '100', '60% (ป.โท 65%)'], ['ภาษาอังกฤษ', '25', '50', '50%'], ['ความรู้และลักษณะการเป็นข้าราชการที่ดี', '25', '50', '60%']], foot: 'ต้องผ่านทุกวิชาแยกกัน' },
    english: 'ภาษาอังกฤษ 25 ข้อ ข้อละ 2 คะแนน ต้องถูกอย่างน้อย 13 ข้อ แบ่งเป็นบทสนทนา 5 ข้อ คำศัพท์ 5 ข้อ ไวยากรณ์ 5 ข้อ และการอ่าน 10 ข้อ เน้นการสื่อสารพื้นฐาน',
    steps: ['ทำข้อสอบฟรีเพื่อดูว่าตอนนี้ได้กี่ข้อจาก 10', 'เก็บการอ่าน 10 ข้อก่อน เพราะเป็นส่วนที่คะแนนเยอะที่สุด', 'ท่องคำศัพท์ใกล้ตัวและประโยคบทสนทนาที่ใช้บ่อย', 'ฝึกจับเวลาให้ทำทันทั้ง 3 วิชา'],
    site: ['สำนักงาน ก.พ.', 'https://www.ocsc.go.th/'],
    faq: [['สอบ ก.พ. ภาค ก ภาษาอังกฤษต้องได้กี่ข้อ', 'ต้องได้อย่างน้อย 50% คือ 25 คะแนนจาก 50 หรือถูกอย่างน้อย 13 ข้อจาก 25 ข้อ'], ['ผลสอบ ภาค ก มีอายุกี่ปี', 'ผลสอบผ่านภาค ก ของ ก.พ. ใช้ได้ตลอดไป ไม่มีวันหมดอายุ'], ['ข้อสอบในเว็บนี้เป็นข้อสอบจริงไหม', 'ไม่ใช่ข้อสอบจริง เป็นโจทย์ที่ทีม SheetLab เขียนขึ้นใหม่ตามแนวข้อสอบ เพื่อฝึกและเช็คความพร้อม']] },
  { slug: 'local-gov', subjects: ['eng', 'think', 'law'], name: 'สอบท้องถิ่น', icon: '🏘️', org: 'อบต. เทศบาล อบจ.', who: 'คนที่อยากทำงานองค์กรปกครองส่วนท้องถิ่น',
    title: 'สอบท้องถิ่น ภาค ก สรุปวิชาที่สอบ ภาษาอังกฤษ และวิธีเตรียมตัว',
    desc: 'สรุปสอบท้องถิ่น (อบต. เทศบาล อบจ.) วิชาภาค ก ภาษาอังกฤษ 20 คะแนน พร้อมข้อสอบฟรีและชีทเตรียมสอบ',
    checked: '2026-10-12',
    summary: ['สอบเข้ารับราชการในองค์กรปกครองส่วนท้องถิ่น จัดสอบรวมทั่วประเทศ แยกจากสอบ ก.พ.', 'ภาค ก ของท้องถิ่นใช้แทนภาค ก ของ ก.พ. ไม่ได้ ต้องสอบแยก'],
    table: { head: ['ภาค ก', 'คะแนน', 'เกณฑ์ผ่าน'], rows: [['ภาษาอังกฤษ', '20 จาก 100', '50% ของคะแนนวิชา'], ['วิชาอื่นในภาค ก', '80 จาก 100', 'ดูประกาศรอบนั้น']], foot: 'ตัวเลขจากรอบ 2568 อาจเปลี่ยนในรอบถัดไป' },
    english: 'ภาษาอังกฤษเป็นส่วนเล็กของภาค ก (20 คะแนนจาก 100) แต่ต้องผ่านเกณฑ์ เนื้อหาใกล้เคียงกับ ก.พ. คือบทสนทนา คำศัพท์ ไวยากรณ์ และการอ่านพื้นฐาน',
    steps: ['ทำข้อสอบฟรีเพื่อวัดพื้นฐาน', 'เตรียมภาษาอังกฤษชุดเดียวกับ ก.พ. ได้เลย', 'อ่านกฎหมายท้องถิ่นตามประกาศรอบนั้น'],
    site: ['กรมส่งเสริมการปกครองท้องถิ่น', 'https://www.dla.go.th/'],
    faq: [['สอบท้องถิ่นต้องผ่าน ก.พ. ก่อนไหม', 'ไม่ต้อง สอบท้องถิ่นมีภาค ก ของตัวเอง แยกจาก ก.พ.'], ['ภาษาอังกฤษสอบท้องถิ่นยากไหม', 'ระดับพื้นฐานใกล้เคียงกับ ก.พ. ใช้ชีทและข้อสอบชุดเดียวกันฝึกได้']] },
  { slug: 'kru-phu-chuay', subjects: ['eng'], name: 'สอบครูผู้ช่วย', icon: '🍎', org: 'สำนักงาน ก.ค.ศ. · เขตพื้นที่การศึกษา', who: 'ผู้มีใบประกอบวิชาชีพครูที่อยากบรรจุ',
    title: 'สอบครูผู้ช่วย ภาค ก สรุปภาษาอังกฤษและวิธีเตรียมตัว',
    desc: 'สรุปสอบครูผู้ช่วย ภาค ก ส่วนภาษาอังกฤษ พร้อมข้อสอบฟรีและชีทเตรียมสอบ',
    checked: '2026-10-12',
    summary: ['สอบคัดเลือกครูผู้ช่วยจัดโดยหน่วยงานการศึกษา ต้องมีใบประกอบวิชาชีพครู', 'ภาค ก มีภาษาอังกฤษรวมอยู่ด้วย (ประมาณ 25 ข้อ ตามแนวที่ผ่านมา)'],
    table: null,
    english: 'ภาษาอังกฤษในภาค ก ของครูผู้ช่วยเน้นพื้นฐานเหมือน ก.พ. ทั้งคำศัพท์ ไวยากรณ์ บทสนทนา และการอ่าน จำนวนข้อและเกณฑ์ให้ดูในประกาศแต่ละรอบ',
    steps: ['ทำข้อสอบฟรีเพื่อวัดพื้นฐาน', 'ฝึกภาษาอังกฤษชุดเดียวกับ ก.พ.', 'อ่านประกาศของเขตพื้นที่ที่จะสมัคร'],
    site: ['สำนักงาน ก.ค.ศ.', 'https://otepc.go.th/'],
    faq: [['สอบครูผู้ช่วยต้องผ่าน ก.พ. ไหม', 'ไม่ต้อง ครูผู้ช่วยมีการสอบภาค ก ของตัวเอง'], ['เตรียมภาษาอังกฤษครูผู้ช่วยยังไง', 'ฝึกคำศัพท์ ไวยากรณ์ และการอ่านพื้นฐาน ใช้ข้อสอบแนว ก.พ. ฝึกได้']] },
];
export const govBySlug = (s) => GOV_EXAMS.find((x) => x.slug === s) || null;
const T = (x) => String(x || '').toLowerCase();
const NON_ENG = /คิดวิเคราะห์|คณิต|เลข|อนุกรม|เงื่อนไข|ภาษาไทย|กฎหมาย|พ\.ร\.บ|ข้าราชการที่ดี|จริยธรรม/; // ชื่อที่เป็นวิชาอื่น ไม่ใช่อังกฤษ
const govCtx = (x) => /^kp/.test(x.cat || '') || /ก\.พ|ราชการ|ท้องถิ่น|ครูผู้ช่วย|ตำรวจ/.test(T(x.title || x.name));
export const GOV_SUBJECTS = [
  { key: 'eng', name: 'ภาษาอังกฤษ', icon: '🔤', match: (x) => x.cat === 'kp' || (!/^kp-/.test(x.cat || '') && /ก\.พ|ราชการ/.test(T(x.title || x.name)) && !NON_ENG.test(T(x.title || x.name))) },
  { key: 'think', name: 'คิดวิเคราะห์ (เลข เหตุผล ภาษาไทย)', icon: '🧮', match: (x) => x.cat === 'kp-think' || (!/^kp-law$/.test(x.cat || '') && govCtx(x) && /คิดวิเคราะห์|คณิต|เลข|อนุกรม|เงื่อนไข|ภาษาไทย/.test(T(x.title || x.name))) },
  { key: 'law', name: 'ข้าราชการที่ดี (กฎหมาย จริยธรรม)', icon: '⚖️', match: (x) => x.cat === 'kp-law' || (!/^kp-think$/.test(x.cat || '') && govCtx(x) && /กฎหมาย|พ\.ร\.บ|ข้าราชการที่ดี|จริยธรรม/.test(T(x.title || x.name))) },
];
const subjOf = (x) => (GOV_SUBJECTS.find((s) => s.match(x)) || {}).key || '';
// ข้อสอบและชีทของโซนนี้ (ทุกวิชา หรือเฉพาะวิชาที่ส่งมา) · แต่ละชิ้นติด _subj ไว้กรอง
export function govItems({ quizzes = [], articles = [], products = [] }, subjects = null) {
  const ok = (x) => { const k = subjOf(x); return k && (!subjects || subjects.includes(k)); };
  const tag = (x) => Object.assign(Object.create(x), { _subj: subjOf(x) });
  const pr = products.filter((p) => p.status === 'published' && p.sell !== 'salepage' && /^[a-z0-9-]+$/.test(p.slug || ''));
  return { quizzes: quizzes.filter(ok).map(tag), articles: articles.filter(ok).map(tag), products: pr.filter((p) => ok({ name: p.name + ' ' + (p.headline || ''), cat: p.cat })).map((p) => Object.assign(Object.create(p), { _subj: subjOf({ name: p.name + ' ' + (p.headline || ''), cat: p.cat }) })) };
}

const CSS = `<style>.gv-hero{background:#0F1B33;color:#fff;border-radius:16px;padding:20px 16px 16px}.gv-hero h1{color:#fff;font-size:22px;margin:0 0 4px}.gv-hero p{color:#C7D2EA;margin:0 0 14px;font-size:15px}.gv-search{display:flex;gap:8px}.gv-search label{flex:1;min-width:0;display:flex;align-items:center;gap:8px;background:#fff;border-radius:10px;padding:0 12px;min-height:48px}.gv-search input{flex:1;min-width:0;border:0;outline:0;font:inherit;font-size:16px;color:#0F1B33;background:transparent}.gv-search button{border:0;border-radius:10px;background:var(--accent);color:#0F1B33;font:inherit;font-weight:600;padding:0 16px;min-height:48px;cursor:pointer;white-space:nowrap;flex:none}.gv-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.gv-chips button{border:1px solid #5B6B8C;background:transparent;color:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:14px;cursor:pointer;min-height:36px}.gv-chips button[aria-pressed=true]{background:#fff;color:#0F1B33;border-color:#fff}
.gv-sec h2{font-size:18px;margin:6px 4px 8px}.gv-jobs{display:grid;gap:10px}.gv-job{display:flex;gap:14px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;text-decoration:none;color:var(--ink)}a.gv-job:hover{border-color:var(--brand);box-shadow:0 2px 10px rgba(15,27,51,.08)}.gv-logo{flex:none;width:48px;height:48px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:26px;overflow:hidden}.gv-logo img{width:100%;height:100%;object-fit:cover}.gv-jb{flex:1;min-width:0}.gv-jb b{display:block;font-size:17px;line-height:1.35;margin:4px 0 2px}.gv-org{font-size:14px;color:var(--muted)}.gv-meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:8px;font-size:13px;color:var(--muted)}.gv-tag{display:inline-block;font-size:12px;font-weight:600;padding:2px 9px;border-radius:999px;background:var(--bg);color:var(--ink)}.gv-price{font-weight:600;color:var(--ink);font-size:16px}.gv-go{flex:none;color:var(--brand);font-size:20px;align-self:center}
.gv-empty{text-align:center;padding:32px 16px}.gv-empty i{font-style:normal;font-size:44px;display:block}.gv-empty b{display:block;font-size:19px;margin:8px 0 4px}.gv-empty button{margin-top:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:10px;padding:9px 16px;font:inherit;cursor:pointer}
.gv-tb{width:100%;border-collapse:collapse;font-size:15px;margin-top:8px}.gv-tb th,.gv-tb td{border-bottom:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}.gv-tb th{font-size:13px;color:var(--muted)}.gv-steps{margin:8px 0 0;padding-left:20px}.gv-steps li{margin:4px 0}</style>`;

const examCard = (x) => `<a class="gv-job" href="/gov/${x.slug}" data-kind="exam" data-subj="${x.subjects.join(' ')}"><span class="gv-logo" aria-hidden="true">${x.icon}</span><span class="gv-jb"><span class="gv-tag">สนามสอบ</span><b>${esc(x.name)}</b><span class="gv-org">${esc(x.org)}</span><span class="gv-meta"><span>👤 ${esc(x.who)}</span><span>📚 ฝึกได้: ${x.subjects.map((k) => esc((GOV_SUBJECTS.find((s) => s.key === k) || {}).name || '')).join(' · ')}</span></span></span><span class="gv-go" aria-hidden="true">›</span></a>`;
const quizCard = (q, camp) => `<a class="gv-job" href="/quiz/${esc(q.slug)}?utm_source=gov&utm_campaign=${camp}" data-kind="quiz" data-subj="${q._subj || ''}"><span class="gv-logo" aria-hidden="true">📝</span><span class="gv-jb"><span class="gv-tag">${esc(QUIZ_CATS[q.cat] || 'ข้อสอบ')} · ฟรี</span><b>${esc(q.title)}</b><span class="gv-meta"><span>${(q.questions || []).length} ข้อ</span><span>มีเฉลยภาษาไทย</span><span>รู้คะแนนทันที</span></span></span><span class="gv-go" aria-hidden="true">›</span></a>`;
const sheetCard = (p, camp) => `<a class="gv-job" href="/p/${esc(p.slug)}?utm_source=gov&utm_campaign=${camp}" data-kind="sheet" data-subj="${p._subj || ''}"><span class="gv-logo" aria-hidden="true">${(p.images || [])[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">` : '📘'}</span><span class="gv-jb"><span class="gv-tag">ชีท</span><b>${esc(p.name)}</b><span class="gv-meta"><span class="gv-price">${Number(p.price) >= 1 ? `฿${Number(p.price).toLocaleString('th-TH')}` : 'ฟรี'}</span><span>ดูตัวอย่างก่อนซื้อ</span><span>ได้ไฟล์ทันทีหลังจ่าย</span></span></span><span class="gv-go" aria-hidden="true">›</span></a>`;
const noSheet = '<div class="gv-job" data-kind="sheet"><span class="gv-logo" aria-hidden="true">📘</span><span class="gv-jb"><span class="gv-tag">ชีท</span><b>ชีทภาษาอังกฤษสอบราชการ กำลังจัดทำ</b><span class="gv-org">ระหว่างนี้ลองทำข้อสอบฟรีเพื่อดูจุดที่ต้องเก็บก่อน</span></span></div>';

// หน้า /gov หน้าตาแบบหน้าแรกของร้าน (แถบน้ำเงิน · มีอะไรให้บ้าง · เตรียมสอบเรื่องไหน · ชีทแนะนำ) แต่ของทุกชิ้นเป็นสอบราชการ
// ใช้หลังบ้านเดิม: ข้อสอบ = แบบทดสอบ · ร้านชีท = สินค้าที่ไม่ใช่คอร์ส · คอร์ส = สินค้า kind course · แจกฟรี = สินค้าราคา 0
const HOME_CSS = `<style>main{max-width:960px}.gh-hero{background:var(--brand);color:#fff;margin-top:-16px;padding:26px 0 24px;box-shadow:0 0 0 100vmax var(--brand);clip-path:inset(0 -100vmax)}.gh-hero h1{color:#fff;font-size:28px;line-height:1.3;margin:0 0 6px}.gh-hero p{color:#E3E8FF;margin:0 0 16px}.gh-cta{display:flex;gap:10px;flex-wrap:wrap}.gh-cta a{display:inline-flex;align-items:center;min-height:46px;padding:0 18px;border-radius:12px;font-weight:600;text-decoration:none}.gh-b1{background:var(--accent);color:#0F1B33}.gh-b2{border:1.5px solid #fff;color:#fff}.gh-why{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0}.gh-why li{background:rgba(255,255,255,.16);border-radius:999px;padding:5px 12px;font-size:14px}
.gh-h2{font-size:22px;margin:10px 0 0}.gh-svc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.gh-svcc{display:flex;gap:12px;align-items:flex-start;text-decoration:none;color:var(--ink);background:var(--surface);border:1.5px solid var(--line);border-radius:16px;padding:14px}a.gh-svcc:hover{border-color:var(--brand)}.gh-svci{font-size:28px;line-height:1}.gh-svcc b{display:block;font-size:17px}.gh-svcc .fine{display:block;margin:4px 0 6px}.gh-go{color:var(--brand);font-weight:600;font-size:14px}.gh-soon{color:var(--muted);font-size:14px}
.gh-topics{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}.gh-tcard{display:flex;flex-direction:column;gap:2px;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;padding:0 0 10px}.gh-tcard b,.gh-tcard .fine{padding:0 10px}.gh-tcard b{margin-top:8px}.gh-tcov{display:flex;align-items:center;justify-content:center;aspect-ratio:16/9;background:linear-gradient(135deg,#DCE4FF,#F3F6FF);font-size:44px;overflow:hidden}.gh-tcov img{width:100%;height:100%;object-fit:cover}
.gh-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.gh-p{display:flex;flex-direction:column;gap:4px;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px}.gh-pc{display:flex;align-items:center;justify-content:center;aspect-ratio:3/4;border-radius:10px;background:var(--bg);overflow:hidden;font-size:40px}.gh-pc img{width:100%;height:100%;object-fit:cover}.gh-p b{font-size:15px;line-height:1.35}.gh-pr{font-weight:600}.gh-empty{background:var(--surface);border:1px dashed var(--line);border-radius:14px;padding:18px;text-align:center;color:var(--muted)}
@media (max-width:640px){.gh-hero h1{font-size:24px}.gh-svc{grid-template-columns:1fr;gap:8px}.gh-svcc{padding:12px}.gh-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gh-topics{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;margin:0 -16px;padding:0 16px 6px;scrollbar-width:none}.gh-tcard{flex:0 0 46%;scroll-snap-align:start}}</style>`;
const examImg = { 'kp-phak-kor': '/topic-img/kp.jpg?v=1' };
const prodCard = (p) => `<a class="gh-p" href="/p/${esc(p.slug)}?utm_source=gov&utm_campaign=gov"><span class="gh-pc">${(p.images || [])[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">` : (p.kind === 'course' ? '🎓' : '📘')}</span><b>${esc(p.name)}</b><span class="gh-pr">${Number(p.price) >= 1 ? `฿${Number(p.price).toLocaleString('th-TH')}` : 'ฟรี'}</span><span class="gh-go">${p.kind === 'course' ? 'ดูคอร์ส →' : 'ดูตัวอย่าง →'}</span></a>`;

export function govIndex({ settings = {}, site = '', quizzes = [], articles = [], products = [] } = {}) {
  const url = `${site}/gov`, it = govItems({ quizzes, articles, products });
  const courses = it.products.filter((p) => p.kind === 'course'), free = it.products.filter((p) => p.kind !== 'course' && !(Number(p.price) >= 1)), sheets = it.products.filter((p) => p.kind !== 'course' && Number(p.price) >= 1);
  const svc = (href, icon, name, desc, go, n) => n ? `<a class="gh-svcc" href="${href}"><span class="gh-svci" aria-hidden="true">${icon}</span><span><b>${name}</b><span class="fine">${desc}</span><span class="gh-go">${go}</span></span></a>` : `<div class="gh-svcc" aria-disabled="true"><span class="gh-svci" aria-hidden="true">${icon}</span><span><b>${name}</b><span class="fine">${desc}</span><span class="gh-soon">เร็วๆ นี้</span></span></div>`;
  const count = (x) => govItems({ quizzes, articles, products }, x.subjects); const n = (x) => { const c = count(x); return c.quizzes.length + c.products.length; };
  const firstQ = it.quizzes[0];
  const body = `${HOME_CSS}${CSS}<section class="gh-hero"><h1>ชีทและข้อสอบเตรียมสอบราชการ</h1><p>ก.พ. ท้องถิ่น ครูผู้ช่วย สรุปภาษาไทยเข้าใจง่าย พร้อมแบบฝึกและเฉลยละเอียด</p>
<div class="gh-cta"><a class="gh-b1" href="#sheets">เลือกซื้อชีท</a><a class="gh-b2" href="${firstQ ? `/quiz/${esc(firstQ.slug)}?utm_source=gov&utm_campaign=gov-hero` : '#practice'}">ลองทำข้อสอบฟรี</a></div>
<ul class="gh-why"><li>รับไฟล์ทันทีหลังจ่าย</li><li>สแกนจ่าย QR ได้</li><li>ไฟล์มีปัญหา คืนเงินเต็มจำนวน</li></ul></section>
<h2 class="gh-h2">โซนสอบราชการมีอะไรให้บ้าง</h2>
<div class="gh-svc">${svc('#practice', '📚', 'ฝึกฟรี', `ข้อสอบพร้อมเฉลย ${it.quizzes.length} ชุด ไม่ต้องสมัคร`, 'เริ่มฝึกฟรี →', it.quizzes.length)}${svc('#sheets', '🛒', 'ร้านชีท', `ชีทสอบราชการ ${sheets.length} รายการ ดูตัวอย่างก่อนซื้อ สแกนจ่ายแล้วได้ไฟล์ทันที`, 'เลือกซื้อชีท →', sheets.length)}${svc('#courses', '🎓', 'คอร์สเรียน', 'วิดีโอสอนทีละพาร์ต พร้อมฝึกทำและเฉลย เรียนในเว็บ', 'ดูคอร์สเรียน →', courses.length)}${svc('#free', '🎁', 'ชีทแจกฟรี', 'ชีทสอบราชการแจกฟรี โหลดได้ทันที', 'รับชีทฟรี →', free.length)}</div>
<h2 class="gh-h2">เตรียมสอบสนามไหนอยู่?</h2>
<div class="gh-topics">${GOV_EXAMS.map((x) => `<a class="gh-tcard" href="/gov/${x.slug}"><span class="gh-tcov">${examImg[x.slug] ? `<img src="${examImg[x.slug]}" alt="" loading="lazy" width="1200" height="675">` : `<span aria-hidden="true">${x.icon}</span>`}</span><b>${esc(x.name)}</b><span class="fine">${n(x)} รายการ</span></a>`).join('')}</div>
<h2 class="gh-h2" id="sheets">ชีทแนะนำ</h2>
${sheets.length ? `<div class="gh-grid">${sheets.slice(0, 8).map(prodCard).join('')}</div>` : '<p class="gh-empty">ชีทสอบราชการกำลังจัดทำ ระหว่างนี้ลองทำข้อสอบฟรีก่อน</p>'}
${courses.length ? `<h2 class="gh-h2" id="courses">คอร์สเรียน</h2><div class="gh-grid">${courses.map(prodCard).join('')}</div>` : ''}
${free.length ? `<h2 class="gh-h2" id="free">ชีทแจกฟรี</h2><div class="gh-grid">${free.map(prodCard).join('')}</div>` : ''}
<h2 class="gh-h2" id="practice">ฝึกฟรีก่อนซื้อ</h2>
<div class="gv-jobs">${it.quizzes.length ? it.quizzes.slice(0, 6).map((q) => quizCard(q, 'gov')).join('') : '<a class="gv-job" href="/topic/kp"><span class="gv-logo" aria-hidden="true">📝</span><span class="gv-jb"><span class="gv-tag">ข้อสอบ · ฟรี</span><b>แนวข้อสอบภาษาอังกฤษ ก.พ.</b></span><span class="gv-go" aria-hidden="true">›</span></a>'}</div>
<p class="fine card">ข้อสอบและชีทในโซนนี้ทีม SheetLab เขียนขึ้นใหม่ตามแนวข้อสอบ ไม่ใช่ข้อสอบจริง SheetLab ไม่ใช่หน่วยงานราชการ ก่อนสมัครสอบให้อ่านประกาศทางการทุกครั้ง</p>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'ชีทและข้อสอบเตรียมสอบราชการ ก.พ. ท้องถิ่น ครูผู้ช่วย', url, inLanguage: 'th' }];
  return shell({ title: 'ชีทและข้อสอบเตรียมสอบราชการ ก.พ. ท้องถิ่น ครูผู้ช่วย · SheetLab', desc: 'ข้อสอบ ก.พ. ฟรีพร้อมเฉลยภาษาไทย ชีทและคอร์สเตรียมสอบราชการ ก.พ. ภาค ก สอบท้องถิ่น ครูผู้ช่วย สแกนจ่ายแล้วได้ไฟล์ทันที', canonical: url, body, ld, pixelId: settings.pixelId, tab: 'gov', image: `${site}/topic-img/kp.jpg?v=1` });
}

export function govPage(x, { settings = {}, site = '', quizzes = [], articles = [], products = [] } = {}) {
  const url = `${site}/gov/${x.slug}`, it = govItems({ quizzes, articles, products }, x.subjects), camp = `gov-${x.slug}`;
  const body = `${CSS}<p class="fine" style="margin:0 4px"><a href="/gov">‹ เตรียมสอบราชการทั้งหมด</a></p>
<header class="card"><div style="display:flex;gap:14px;align-items:flex-start"><span class="gv-logo" aria-hidden="true">${x.icon}</span><div style="min-width:0"><span class="gv-tag">สนามสอบ</span><h1 style="margin:6px 0 2px">${esc(x.title)}</h1><span class="gv-org">${esc(x.org)}</span></div></div>
<div class="gv-meta"><span>👤 ${esc(x.who)}</span></div>${x.summary.map((p) => `<p>${esc(p)}</p>`).join('')}
<p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="#practice">📝 ทำข้อสอบฟรี</a>${it.products.length ? '<a class="btn" style="background:var(--surface);border:1px solid var(--line)" href="#sheets">📘 ดูชีท</a>' : ''}</p></header>
${x.table ? `<section class="card"><h2>วิชาที่สอบและเกณฑ์ผ่าน</h2><table class="gv-tb"><thead><tr>${x.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${x.table.foot ? `<p class="fine" style="margin:6px 0 0">${esc(x.table.foot)}</p>` : ''}</section>` : ''}
<section class="card"><h2>วิชาที่มีข้อสอบและชีทในโซนนี้</h2><p>${x.subjects.map((k) => GOV_SUBJECTS.find((s) => s.key === k)).filter(Boolean).map((s) => `${s.icon} ${esc(s.name)}`).join(' · ')}</p><h3 style="margin:10px 0 4px;font-size:16px">ภาษาอังกฤษ</h3><p>${esc(x.english)}</p></section>
<section class="gv-sec" id="practice"><h2>ข้อสอบฟรี พร้อมเฉลย</h2><div class="gv-jobs">${it.quizzes.length ? it.quizzes.slice(0, 4).map((q) => quizCard(q, camp)).join('') : '<p class="card"><a href="/topic/kp">ดูแนวข้อสอบภาษาอังกฤษ ก.พ. →</a></p>'}</div></section>
<section class="gv-sec" id="sheets"><h2>ชีทเตรียมสอบ</h2><div class="gv-jobs">${it.products.length ? it.products.slice(0, 4).map((p) => sheetCard(p, camp)).join('') : noSheet}</div></section>
<section class="card"><h2>เตรียมตัวยังไงดี</h2><ol class="gv-steps">${x.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>
${x.faq?.length ? `<section class="card"><h2>คำถามที่พบบ่อย</h2>${x.faq.map(([q, a]) => `<details><summary><b>${esc(q)}</b></summary><p>${esc(a)}</p></details>`).join('')}</section>` : ''}
<p class="fine card">รูปแบบสอบสรุปจากข้อมูลที่เปิดเผย ตรวจล่าสุด ${esc(thDate(x.checked))} อาจเปลี่ยนในแต่ละรอบ ก่อนสมัครให้อ่านประกาศทางการที่ <a href="${esc(x.site[1])}" target="_blank" rel="noopener nofollow">${esc(x.site[0])}</a> · SheetLab ไม่ใช่หน่วยงานราชการ</p>
<section class="gv-sec"><h2>สนามสอบอื่น</h2><div class="gv-jobs">${GOV_EXAMS.filter((o) => o !== x).map(examCard).join('')}</div></section>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'Article', headline: x.title, description: x.desc, inLanguage: 'th', dateModified: x.checked, url },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'SheetLab', item: site }, { '@type': 'ListItem', position: 2, name: 'เตรียมสอบราชการ', item: `${site}/gov` }, { '@type': 'ListItem', position: 3, name: x.name, item: url }] },
    ...(x.faq?.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: x.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : [])];
  return shell({ title: `${x.title} · SheetLab`, desc: x.desc, canonical: url, body, ld, pixelId: settings.pixelId, tab: 'gov' });
}
