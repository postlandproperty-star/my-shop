// งานราชการ /gov และ /gov/<slug>: สรุปสนามสอบใหญ่ (ก.พ. ท้องถิ่น ครูผู้ช่วย งานกรมต่างๆ) + ข้อสอบฟรี + ชีท + รับแจ้งเตือนทางอีเมล
// ข้อมูลแก้ในไฟล์นี้ (GOV_EXAMS) ยังไม่ดึงอัตโนมัติ · วันที่ทุกวันต้องตรวจกับประกาศจริงก่อนใส่ แล้วแก้ checked เป็นวันที่ตรวจ
// status.kind: 'open' = เปิดรับอยู่ (ต้องมี open/close เป็น YYYY-MM-DD) · 'soon' = มีกำหนดแล้วแต่ยังไม่เปิด · 'watch' = รอประกาศรอบถัดไป
// คนกดรับแจ้งเตือน → shop_state id=gov_watch (POST /api/order?m=govwatch)
import { SB_URL } from './shop.js';
import { shell, QUIZ_CATS } from './quiz.js';
import { TOPICS, topicItems } from './topics.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const H = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const thDate = (d) => { try { return new Date(d + 'T00:00:00+07:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }); } catch (e) { return d; } };

export const GOV_EXAMS = [
  { slug: 'kp-phak-kor', name: 'สอบ ก.พ. ภาค ก', icon: '🏛️', org: 'สำนักงาน ก.พ.', type: 'central', who: 'ป.ตรี ป.โท ปวส. ปวช. ที่อยากรับราชการพลเรือน',
    title: 'สอบ ก.พ. ภาค ก สรุปรูปแบบสอบ เกณฑ์ผ่าน และวิธีเตรียมภาษาอังกฤษ',
    desc: 'สรุปสอบ ก.พ. ภาค ก 3 วิชา จำนวนข้อ เกณฑ์ผ่าน และโครงสร้างภาษาอังกฤษ 25 ข้อ พร้อมข้อสอบฟรีและรับแจ้งเตือนเมื่อเปิดรับสมัคร',
    status: { kind: 'watch', note: 'รอบ 2569 เปิดรับสมัครเดือน ม.ค. 2569 (e-Exam และสอบกระดาษ) รอบถัดไปยังไม่ประกาศ' },
    checked: '2026-10-12',
    summary: ['ภาค ก คือการวัดความรู้ความสามารถทั่วไป ต้องสอบผ่านก่อนจึงสมัครสอบภาค ข ของกรมต่างๆ ได้', 'ผลสอบผ่านใช้ได้ตลอดไป ไม่มีวันหมดอายุ'],
    table: { head: ['วิชา', 'ข้อ', 'คะแนน', 'เกณฑ์ผ่าน'], rows: [['คิดวิเคราะห์ (ภาษาไทย ตัวเลข เหตุผล)', '50', '100', '60% (ป.โท 65%)'], ['ภาษาอังกฤษ', '25', '50', '50%'], ['ความรู้และลักษณะการเป็นข้าราชการที่ดี', '25', '50', '60%']], foot: 'ต้องผ่านทุกวิชาแยกกัน' },
    english: 'ภาษาอังกฤษ 25 ข้อ ข้อละ 2 คะแนน ต้องถูกอย่างน้อย 13 ข้อ แบ่งเป็นบทสนทนา 5 ข้อ คำศัพท์ 5 ข้อ ไวยากรณ์ 5 ข้อ และการอ่าน 10 ข้อ เน้นการสื่อสารพื้นฐาน',
    steps: ['ทำข้อสอบฟรีด้านล่างเพื่อดูว่าตอนนี้ได้กี่ข้อจาก 10', 'เก็บการอ่าน 10 ข้อก่อน เพราะเป็นส่วนที่คะแนนเยอะที่สุด', 'ท่องคำศัพท์ใกล้ตัวและประโยคบทสนทนาที่ใช้บ่อย', 'ฝึกจับเวลาให้ทำทันทั้ง 3 วิชา'],
    sources: [['ระบบรับสมัครและผลสอบ ก.พ. (ทางการ)', 'https://job3.ocsc.go.th/'], ['สำนักงาน ก.พ.', 'https://www.ocsc.go.th/']],
    faq: [['สอบ ก.พ. ภาค ก ภาษาอังกฤษต้องได้กี่ข้อ', 'ต้องได้อย่างน้อย 50% คือ 25 คะแนนจาก 50 หรือถูกอย่างน้อย 13 ข้อจาก 25 ข้อ'], ['ผลสอบ ภาค ก มีอายุกี่ปี', 'ผลสอบผ่านภาค ก ของ ก.พ. ใช้ได้ตลอดไป ไม่มีวันหมดอายุ'], ['ต้องสอบ e-Exam หรือสอบกระดาษ', 'เลือกได้ตามรอบที่ ก.พ. เปิด รอบ 2569 มีทั้งสองแบบ รายละเอียดดูในประกาศรับสมัครแต่ละรอบ']] },
  { slug: 'local-gov', name: 'สอบท้องถิ่น', icon: '🏘️', org: 'ก.ถ. · อบต. เทศบาล อบจ.', type: 'local', who: 'คนที่อยากทำงาน อบต. เทศบาล อบจ.',
    title: 'สอบท้องถิ่น ภาค ก สรุปวิชาที่สอบ ภาษาอังกฤษ และวิธีเตรียมตัว',
    desc: 'สรุปสอบท้องถิ่น (อบต. เทศบาล อบจ.) วิชาภาค ก ภาษาอังกฤษ 20 คะแนน พร้อมข้อสอบฟรีและรับแจ้งเตือนเมื่อเปิดรับสมัคร',
    status: { kind: 'watch', note: 'รอประกาศรับสมัครรอบถัดไปจากคณะกรรมการกลางการบริหารงานบุคคลส่วนท้องถิ่น (ก.ถ.)' },
    checked: '2026-10-12',
    summary: ['สอบเข้ารับราชการในองค์กรปกครองส่วนท้องถิ่น จัดสอบรวมทั่วประเทศ แยกจากสอบ ก.พ.', 'ภาค ก ของท้องถิ่นใช้แทนภาค ก ของ ก.พ. ไม่ได้ ต้องสอบแยก'],
    table: { head: ['ภาค ก', 'คะแนน', 'เกณฑ์ผ่าน'], rows: [['ภาษาอังกฤษ', '20 จาก 100', '50% ของคะแนนวิชา (รอบ 2568)'], ['วิชาอื่นในภาค ก', '80 จาก 100', 'ดูประกาศรอบนั้น']], foot: 'ตัวเลขจากรอบ 2568 อาจเปลี่ยนในรอบถัดไป' },
    english: 'ภาษาอังกฤษเป็นส่วนเล็กของภาค ก (20 คะแนนจาก 100) แต่ต้องผ่านเกณฑ์ เนื้อหาใกล้เคียงกับ ก.พ. คือบทสนทนา คำศัพท์ ไวยากรณ์ และการอ่านพื้นฐาน',
    steps: ['ทำข้อสอบฟรีด้านล่างเพื่อวัดพื้นฐาน', 'เตรียมภาษาอังกฤษชุดเดียวกับ ก.พ. ได้เลย', 'อ่านกฎหมายท้องถิ่นตามประกาศรอบนั้น'],
    sources: [['กรมส่งเสริมการปกครองท้องถิ่น', 'https://www.dla.go.th/']],
    faq: [['สอบท้องถิ่นต้องผ่าน ก.พ. ก่อนไหม', 'ไม่ต้อง สอบท้องถิ่นมีภาค ก ของตัวเอง แยกจาก ก.พ.'], ['ภาษาอังกฤษสอบท้องถิ่นยากไหม', 'ระดับพื้นฐานใกล้เคียงกับ ก.พ. ใช้ชีทและข้อสอบชุดเดียวกันฝึกได้']] },
  { slug: 'kru-phu-chuay', name: 'สอบครูผู้ช่วย', icon: '🍎', org: 'สำนักงาน ก.ค.ศ. · เขตพื้นที่การศึกษา', type: 'teacher', who: 'ผู้มีใบประกอบวิชาชีพครูที่อยากบรรจุ',
    title: 'สอบครูผู้ช่วย ภาค ก สรุปภาษาอังกฤษและวิธีเตรียมตัว',
    desc: 'สรุปสอบครูผู้ช่วย ภาค ก ส่วนภาษาอังกฤษ พร้อมข้อสอบฟรี ชีทเตรียมสอบ และรับแจ้งเตือนเมื่อเปิดรับสมัคร',
    status: { kind: 'watch', note: 'รอประกาศรับสมัครรอบถัดไปจากสำนักงาน ก.ค.ศ. และเขตพื้นที่การศึกษา' },
    checked: '2026-10-12',
    summary: ['สอบคัดเลือกครูผู้ช่วยจัดโดยหน่วยงานการศึกษา ต้องมีใบประกอบวิชาชีพครู', 'ภาค ก มีภาษาอังกฤษรวมอยู่ด้วย (ประมาณ 25 ข้อ ตามแนวที่ผ่านมา)'],
    table: null,
    english: 'ภาษาอังกฤษในภาค ก ของครูผู้ช่วยเน้นพื้นฐานเหมือน ก.พ. ทั้งคำศัพท์ ไวยากรณ์ บทสนทนา และการอ่าน จำนวนข้อและเกณฑ์ให้ดูในประกาศแต่ละรอบ',
    steps: ['ทำข้อสอบฟรีด้านล่างเพื่อวัดพื้นฐาน', 'ฝึกภาษาอังกฤษชุดเดียวกับ ก.พ.', 'ติดตามประกาศของเขตพื้นที่ที่จะสมัคร'],
    sources: [['สำนักงาน ก.ค.ศ.', 'https://otepc.go.th/']],
    faq: [['สอบครูผู้ช่วยต้องผ่าน ก.พ. ไหม', 'ไม่ต้อง ครูผู้ช่วยมีการสอบภาค ก ของตัวเอง'], ['เตรียมภาษาอังกฤษครูผู้ช่วยยังไง', 'ฝึกคำศัพท์ ไวยากรณ์ และการอ่านพื้นฐาน ใช้ข้อสอบแนว ก.พ. ฝึกได้']] },
  { slug: 'ocsc-jobs', name: 'สมัครงานกรมต่างๆ (ภาค ข)', icon: '📋', org: 'กรมต่างๆ ผ่านระบบรับสมัครของ ก.พ.', type: 'central', who: 'คนที่สอบผ่าน ก.พ. ภาค ก แล้ว',
    title: 'สมัครงานราชการกรมต่างๆ ภาค ข หาประกาศที่ไหน ต้องเตรียมอะไร',
    desc: 'วิธีหาประกาศรับสมัครงานราชการของกรมต่างๆ (ภาค ข) หลังสอบผ่าน ก.พ. ภาค ก และสิ่งที่ต้องเตรียม พร้อมรับแจ้งเตือน',
    status: { kind: 'watch', note: 'กรมต่างๆ เปิดรับตลอดปี ดูรายการล่าสุดในระบบรับสมัครงานของ ก.พ.' },
    checked: '2026-10-12',
    summary: ['ภาค ข คือการสอบความรู้เฉพาะตำแหน่งของแต่ละกรม จัดโดยกรมที่เปิดรับ', 'ส่วนใหญ่ต้องผ่าน ก.พ. ภาค ก ในระดับวุฒิที่ตรงกันก่อนจึงสมัครได้'],
    table: null,
    english: 'บางตำแหน่ง เช่น งานต่างประเทศหรืองานที่ใช้ภาษา อาจสอบภาษาอังกฤษเพิ่มในภาค ข หรือขอผลสอบอย่าง TOEIC ดูในประกาศของตำแหน่งนั้น',
    steps: ['สอบให้ผ่าน ก.พ. ภาค ก ก่อน', 'เลือกตำแหน่งที่วุฒิตรงในระบบรับสมัครงานของ ก.พ.', 'อ่านหัวข้อสอบภาค ข ในประกาศแล้วเตรียมตามนั้น'],
    sources: [['ระบบรับสมัครงานราชการ ก.พ. (ทางการ)', 'https://job.ocsc.go.th/']],
    faq: [['ประกาศรับสมัครงานราชการดูได้ที่ไหน', 'ดูได้ที่ระบบรับสมัครงานของ ก.พ. และเว็บไซต์ของกรมที่เปิดรับ'], ['ไม่ผ่านภาค ก สมัครภาค ข ได้ไหม', 'ตำแหน่งส่วนใหญ่ต้องผ่านภาค ก ก่อน มีบางตำแหน่งที่ยกเว้น ดูในประกาศ']] },
];
export const GOV_TYPES = { central: 'ราชการส่วนกลาง', local: 'ท้องถิ่น', teacher: 'ครู' };
export const govBySlug = (s) => GOV_EXAMS.find((x) => x.slug === s) || null;
const KP_TOPIC = TOPICS.find((t) => t.slug === 'kp');

// วันเหลือก่อนปิดรับ (ตามเวลาไทย) · null ถ้าไม่มีวันปิด
export const daysLeft = (close, now = Date.now()) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(close || ''))) return null; return Math.ceil((Date.parse(close + 'T23:59:59+07:00') - now) / 864e5); };
function statusChip(st) {
  if (st.kind === 'open') { const d = daysLeft(st.close); return d != null && d < 0 ? '<span class="gv-st gv-off">ปิดรับแล้ว</span>' : `<span class="gv-st gv-on" data-close="${esc(st.close)}">เปิดรับ · เหลือ ${d} วัน</span>`; }
  if (st.kind === 'soon') return `<span class="gv-st gv-soon">เปิดรับ ${esc(thDate(st.open))}</span>`;
  return '<span class="gv-st gv-wait">รอประกาศรอบใหม่</span>';
}
const CSS = `<style>.gv-st{display:inline-block;font-size:13px;font-weight:600;padding:3px 10px;border-radius:999px;background:#EEF1F6;color:#334}.gv-on{background:#DCFCE7;color:#14532D}.gv-soon{background:#FEF3C7;color:#78350F}.gv-off{background:#F3F4F6;color:#6B7280}.gv-list{display:grid;gap:10px}.item.gv-it{display:flex;flex-direction:row;gap:12px;align-items:flex-start;text-decoration:none;color:inherit}.gv-ic{font-size:28px;line-height:1}.gv-it b{display:block;font-size:17px;margin:2px 0}.gv-tb{width:100%;border-collapse:collapse;font-size:15px;margin-top:8px}.gv-tb th,.gv-tb td{border-bottom:1px solid #E5E9F0;padding:8px 6px;text-align:left;vertical-align:top}.gv-tb th{font-size:13px;color:#56637D}.gv-src a{word-break:break-all}.gv-steps{margin:8px 0 0;padding-left:20px}.gv-steps li{margin:4px 0}.gv-hero{background:#0F1B33;color:#fff;border-radius:16px;padding:20px 16px 16px}.gv-hero h1{color:#fff;font-size:22px;margin:0 0 4px}.gv-hero p{color:#C7D2EA;margin:0 0 14px;font-size:15px}.gv-search{display:flex;gap:8px}.gv-search label{flex:1;min-width:0;display:flex;align-items:center;gap:8px;background:#fff;border-radius:10px;padding:0 12px;min-height:48px}.gv-search input{flex:1;min-width:0;border:0;outline:0;font:inherit;font-size:16px;color:#0F1B33;background:transparent}.gv-search button{border:0;border-radius:10px;background:var(--accent);color:#0F1B33;font:inherit;font-weight:600;padding:0 16px;min-height:48px;cursor:pointer;white-space:nowrap;flex:none}.gv-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.gv-chips button{border:1px solid #5B6B8C;background:transparent;color:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:14px;cursor:pointer;min-height:36px}.gv-chips button[aria-pressed=true]{background:#fff;color:#0F1B33;border-color:#fff}.gv-count{font-size:14px;color:var(--muted);margin:2px 4px}.gv-jobs{display:grid;gap:10px}.gv-job{display:flex;gap:14px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;text-decoration:none;color:var(--ink)}.gv-job:hover{border-color:var(--brand);box-shadow:0 2px 10px rgba(15,27,51,.08)}.gv-logo{flex:none;width:48px;height:48px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:26px}.gv-jb{flex:1;min-width:0}.gv-jb b{display:block;font-size:17px;line-height:1.35;margin:6px 0 2px}.gv-org{font-size:14px;color:var(--muted)}.gv-meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:8px;font-size:13px;color:var(--muted)}.gv-go{flex:none;color:var(--brand);font-size:20px;align-self:center}.gv-empty{text-align:center;padding:32px 16px}.gv-empty i{font-style:normal;font-size:44px;display:block}.gv-empty b{display:block;font-size:19px;margin:8px 0 4px}.gv-empty button{margin-top:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:10px;padding:9px 16px;font:inherit;cursor:pointer}@media (prefers-color-scheme:dark){.gv-st{background:#26304a;color:#dbe3f5}.gv-on{background:#14532D;color:#DCFCE7}.gv-soon{background:#78350F;color:#FEF3C7}.gv-tb th,.gv-tb td{border-color:#2c3650}}</style>`;
// นับวันใหม่ในเบราว์เซอร์ หน้าที่แคชไว้จะไม่โชว์จำนวนวันเก่า
const LIVE_JS = `<script>(function(){document.querySelectorAll('[data-close]').forEach(function(e){var d=Math.ceil((Date.parse(e.dataset.close+'T23:59:59+07:00')-Date.now())/864e5);if(d<0){e.className='gv-st gv-off';e.textContent='ปิดรับแล้ว';}else e.textContent='เปิดรับ · เหลือ '+d+' วัน';});})();</script>`;

function watchForm(slug) {
  return `<section class="card" id="watch"><h2>🔔 รับแจ้งเตือนเมื่อเปิดรับสมัคร</h2><p class="fine" style="margin:0 0 8px">กรอกอีเมลไว้ เมื่อมีประกาศรอบใหม่เราจะส่งสรุปพร้อมลิงก์ประกาศทางการให้ ฟรี ยกเลิกได้ทุกเมื่อ</p>
<form class="vp-form" id="gv-form"><input type="email" required placeholder="อีเมลของคุณ (เช่น name@gmail.com)" aria-label="อีเมล" id="gv-email"><button>แจ้งเตือนฉัน</button></form><div id="gv-done" hidden></div></section>
<script>(function(){var f=document.getElementById('gv-form'),d=document.getElementById('gv-done');f.onsubmit=function(e){e.preventDefault();var b=f.querySelector('button'),em=document.getElementById('gv-email').value.trim();b.disabled=true;b.textContent='กำลังบันทึก...';
fetch('/api/order?m=govwatch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${JSON.stringify(slug)},email:em})}).then(function(r){return r.json();}).then(function(j){if(!j.ok){b.disabled=false;b.textContent='แจ้งเตือนฉัน';alert(j.error||'บันทึกไม่สำเร็จ ลองใหม่');return;}if(window.slTrack)slTrack('click','gov-watch');f.hidden=true;d.hidden=false;d.innerHTML='<p class="vp-ok">บันทึกแล้ว 🎉 จะแจ้งไปที่ '+em.replace(/[<>&"]/g,'')+' เมื่อมีประกาศใหม่</p>';}).catch(function(){b.disabled=false;b.textContent='แจ้งเตือนฉัน';alert('เน็ตหลุด ลองใหม่อีกครั้ง');});};})();</script>`;
}

export function govIndex({ settings = {}, site = '' } = {}) {
  const url = `${site}/gov`;
  const live = (x) => (x.status.kind === 'open' && (daysLeft(x.status.close) ?? -1) >= 0) || x.status.kind === 'soon';
  const chip = (k, v, l) => `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${v === '' ? 'true' : 'false'}">${esc(l)}</button>`;
  const body = `${CSS}<section class="gv-hero"><h1>หางานราชการ สอบอะไรเปิดรับอยู่</h1><p>สรุปสนามสอบ วิชาที่สอบ เกณฑ์ผ่าน และลิงก์ประกาศทางการ ในที่เดียว</p>
<form class="gv-search" role="search" onsubmit="return false"><label><span aria-hidden="true">🔍</span><input id="gv-q" type="search" placeholder="ค้นหา เช่น ก.พ. ท้องถิ่น ครู" aria-label="ค้นหาสนามสอบ" autocomplete="off"></label><button type="submit">หางาน</button></form>
<div class="gv-chips" role="group" aria-label="สถานะ">${chip('s', '', 'ทั้งหมด')}${chip('s', 'live', 'เปิดรับ / ใกล้เปิด')}${chip('s', 'watch', 'รอประกาศ')}</div>
<div class="gv-chips" role="group" aria-label="ประเภท">${chip('t', '', 'ทุกประเภท')}${Object.entries(GOV_TYPES).map(([k, l]) => chip('t', k, l)).join('')}</div></section>
<p class="gv-count" id="gv-n" aria-live="polite">${GOV_EXAMS.length} สนามสอบ</p>
<div class="gv-jobs">${GOV_EXAMS.map((x) => `<a class="gv-job" href="/gov/${x.slug}" data-s="${live(x) ? 'live' : 'watch'}" data-t="${x.type}"><span class="gv-logo" aria-hidden="true">${x.icon}</span><span class="gv-jb">${statusChip(x.status)}<b>${esc(x.name)}</b><span class="gv-org">${esc(x.org)}</span><span class="gv-meta"><span>📍 ${esc(GOV_TYPES[x.type] || '')}</span><span>👤 ${esc(x.who)}</span></span></span><span class="gv-go" aria-hidden="true">›</span></a>`).join('')}</div>
<div class="card gv-empty" id="gv-empty" hidden><i aria-hidden="true">🔍</i><b>ไม่พบผลลัพธ์ที่ตรงกัน</b><span class="fine">ลองเปลี่ยนคำค้นหรือตัวกรอง</span><br><button type="button" id="gv-reset">ล้างตัวกรอง</button></div>
<section class="card"><h2>เตรียมภาษาอังกฤษสอบราชการ</h2><p>ก.พ. ท้องถิ่น และครูผู้ช่วยมีภาษาอังกฤษพื้นฐานเหมือนกัน ฝึกชุดเดียวใช้ได้ทุกสนาม</p><p><a class="btn" href="/topic/kp">ข้อสอบและชีทภาษาอังกฤษ ก.พ. →</a></p></section>
<p class="fine card">ข้อมูลในหน้านี้สรุปจากประกาศและแหล่งข้อมูลที่เปิดเผย ก่อนสมัครให้ตรวจรายละเอียดกับประกาศทางการทุกครั้ง SheetLab ไม่ใช่หน่วยงานราชการ</p>${LIVE_JS}
<script>(function(){var f={s:'',t:''},q=document.getElementById('gv-q');function run(){var w=q.value.trim().toLowerCase(),n=0;document.querySelectorAll('.gv-job').forEach(function(e){var ok=(!f.s||e.dataset.s===f.s)&&(!f.t||e.dataset.t===f.t)&&(!w||e.textContent.toLowerCase().indexOf(w)>=0);e.hidden=!ok;if(ok)n++;});document.getElementById('gv-n').textContent=n+' สนามสอบ';document.getElementById('gv-empty').hidden=n>0;}
q.addEventListener('input',run);document.querySelector('.gv-search').addEventListener('submit',function(){run();q.blur();});
document.querySelectorAll('.gv-chips button').forEach(function(b){b.addEventListener('click',function(){f[b.dataset.k]=b.dataset.v;document.querySelectorAll('.gv-chips button[data-k="'+b.dataset.k+'"]').forEach(function(x){x.setAttribute('aria-pressed',x===b);});run();});});
document.getElementById('gv-reset').addEventListener('click',function(){q.value='';f={s:'',t:''};document.querySelectorAll('.gv-chips button').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.v==='');});run();});})();</script>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'หางานราชการ สอบอะไรเปิดรับอยู่', url, inLanguage: 'th' }];
  return shell({ title: 'สอบราชการ ก.พ. ท้องถิ่น ครูผู้ช่วย สรุปรูปแบบสอบและวันรับสมัคร · SheetLab', desc: 'สรุปสอบ ก.พ. ภาค ก สอบท้องถิ่น และครูผู้ช่วย วิชาที่สอบ เกณฑ์ผ่าน ลิงก์ประกาศทางการ พร้อมข้อสอบภาษาอังกฤษฟรีและรับแจ้งเตือนเมื่อเปิดรับ', canonical: url, body, ld, pixelId: settings.pixelId, tab: 'gov' });
}

export function govPage(x, { settings = {}, site = '', quizzes = [], articles = [], products = [] } = {}) {
  const url = `${site}/gov/${x.slug}`, st = x.status;
  const it = KP_TOPIC ? topicItems(KP_TOPIC, { articles, quizzes, products }) : { quizzes: [], products: [], articles: [] };
  const dates = st.kind === 'open' || st.kind === 'soon' ? `<p style="margin:8px 0 0"><b>รับสมัคร</b> ${esc(thDate(st.open))}${st.close ? ` – ${esc(thDate(st.close))}` : ''}</p>` : '';
  const body = `${CSS}<p class="fine" style="margin:0 4px"><a href="/gov">‹ งานราชการทั้งหมด</a></p>
<header class="card"><div style="display:flex;gap:14px;align-items:flex-start"><span class="gv-logo" aria-hidden="true">${x.icon}</span><div style="min-width:0">${statusChip(st)}<h1 style="margin:6px 0 2px">${esc(x.title)}</h1><span class="gv-org">${esc(x.org)}</span></div></div>
<div class="gv-meta"><span>📍 ${esc(GOV_TYPES[x.type] || '')}</span><span>👤 ${esc(x.who)}</span></div>${dates}${st.note ? `<p class="fine" style="margin:8px 0 0">${esc(st.note)}</p>` : ''}
<p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="#watch">🔔 แจ้งเตือนเมื่อเปิดรับ</a>${x.sources[0] ? `<a class="btn" style="background:var(--surface);border:1px solid var(--line)" href="${esc(x.sources[0][1])}" target="_blank" rel="noopener nofollow">ประกาศทางการ ↗</a>` : ''}</p></header>
<section class="card"><h2>สรุปสั้น</h2>${x.summary.map((p) => `<p>${esc(p)}</p>`).join('')}</section>
${x.table ? `<section class="card"><h2>วิชาที่สอบและเกณฑ์ผ่าน</h2><table class="gv-tb"><thead><tr>${x.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${x.table.foot ? `<p class="fine" style="margin:6px 0 0">${esc(x.table.foot)}</p>` : ''}</section>` : ''}
<section class="card"><h2>ภาษาอังกฤษ</h2><p>${esc(x.english)}</p>${it.quizzes.length ? `<div class="gv-list" style="margin-top:8px">${it.quizzes.slice(0, 3).map((q) => `<a class="item" href="/quiz/${esc(q.slug)}?utm_source=gov&utm_campaign=gov-${x.slug}"><span class="chip">${esc(QUIZ_CATS[q.cat] || 'ข้อสอบฟรี')}</span> <b>${esc(q.title)}</b><span class="fine">${(q.questions || []).length} ข้อ · มีเฉลย · เริ่มทำ ฟรี →</span></a>`).join('')}</div>` : '<p><a href="/topic/kp">ดูแนวข้อสอบภาษาอังกฤษ ก.พ. →</a></p>'}</section>
${it.products.length ? `<section class="card"><h2>ชีทเตรียมสอบ</h2><div class="tprod" style="margin-top:8px">${it.products.slice(0, 4).map((p) => `<a class="item tcard" href="/p/${esc(p.slug)}?utm_source=gov&utm_campaign=gov-${x.slug}">${(p.images || [])[0] ? `<span class="acov"><img src="${esc(p.images[0])}" alt="" loading="lazy"></span>` : ''}<b>${esc(p.name)}</b><span class="tprice">${Number(p.price) >= 1 ? `฿${Number(p.price).toLocaleString('th-TH')}` : 'ฟรี'}</span><span class="tgo">ดูตัวอย่างก่อนซื้อ →</span></a>`).join('')}</div></section>` : ''}
<section class="card"><h2>เตรียมตัวยังไงดี</h2><ol class="gv-steps">${x.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>
${watchForm(x.slug)}
<section class="card gv-src"><h2>ประกาศทางการ</h2><ul>${x.sources.map(([l, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(l)}</a></li>`).join('')}</ul><p class="fine">ตรวจข้อมูลล่าสุด ${esc(thDate(x.checked))} · ก่อนสมัครให้อ่านประกาศทางการทุกครั้ง SheetLab ไม่ใช่หน่วยงานราชการ</p></section>
${x.faq?.length ? `<section class="card"><h2>คำถามที่พบบ่อย</h2>${x.faq.map(([q, a]) => `<details><summary><b>${esc(q)}</b></summary><p>${esc(a)}</p></details>`).join('')}</section>` : ''}
<section class="card"><h2>สนามสอบอื่น</h2><div class="gv-list">${GOV_EXAMS.filter((o) => o !== x).map((o) => `<a class="item gv-it" href="/gov/${o.slug}"><span class="gv-ic" aria-hidden="true">${o.icon}</span><span>${statusChip(o.status)}<b>${esc(o.name)}</b></span></a>`).join('')}</div></section>${LIVE_JS}`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'Article', headline: x.title, description: x.desc, inLanguage: 'th', dateModified: x.checked, url },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'SheetLab', item: site }, { '@type': 'ListItem', position: 2, name: 'งานราชการ', item: `${site}/gov` }, { '@type': 'ListItem', position: 3, name: x.name, item: url }] },
    ...(x.faq?.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: x.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : [])];
  return shell({ title: `${x.title} · SheetLab`, desc: x.desc, canonical: url, body, ld, pixelId: settings.pixelId, tab: 'gov' });
}

// รับแจ้งเตือน: คนเดิม+สนามเดิมไม่บันทึกซ้ำ
export async function govWatch(slug, email) {
  const r = await fetch(`${SB_URL}/rest/v1/shop_state?id=eq.gov_watch&select=data`, { headers: H });
  if (!r.ok) throw new Error('load ' + r.status);
  const list = (await r.json())?.[0]?.data?.list || [];
  if (list.some((x) => x.email === email && x.slug === slug)) return { ok: true, again: true };
  list.push({ email, slug, at: new Date().toISOString() });
  const w = await fetch(`${SB_URL}/rest/v1/shop_state?on_conflict=id`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ id: 'gov_watch', data: { list: list.slice(-20000) }, updated_at: new Date().toISOString() }]) });
  if (!w.ok) throw new Error('save ' + w.status);
  return { ok: true };
}
