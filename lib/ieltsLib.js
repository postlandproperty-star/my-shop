// 📚 คลัง IELTS ฟรี เฟส 2 (คุณแดน 11 ต.ค. 69 "ทำเหมือน engnovate แต่ทำดีกว่า"): ดึงคนจาก Google แล้วพาไปลอง AI ตรวจ Writing/Speaking (VIP)
// · /ielts หน้ารวม · /ielts/samples ตัวอย่าง Band 9 อธิบายไทย (Writing Task 2, จดหมาย GT, Speaking Part 2 มีเสียงอ่าน)
// · /ielts/dictation ฝึกฟังแล้วพิมพ์ตาม + พูดตาม (เสียง Google TTS สำเนียงอังกฤษ) · /ielts/daily ข้อสอบ IELTS วันละ 5 ข้อ + ตารางอันดับของวันนี้ (คนเล่นจริงเท่านั้น)
// เนื้อหาสร้างด้วย AI ครั้งเดียวผ่าน content.js action=ielts_gen (คีย์ร้าน) เก็บใน shop_state id=ielts_lib · แต่งใหม่ทั้งหมด ไม่ใช่ข้อสอบจริง
import { shell } from './quiz.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const arr = (a, n, f) => (Array.isArray(a) ? a : []).map(f).filter(Boolean).slice(0, n);
export const slugify = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').filter((w) => !/^(the|a|an|of|to|and|or|for|in|on|is|are|that|some|people|you|your|should|do|does|what|why|how|with|this|be|it)$/.test(w)).slice(0, 7).join('-') || 'x';
export const KIND = { t2: { name: 'Writing Task 2', icon: '✍️', check: '/vip/write' }, t1g: { name: 'Writing Task 1 (จดหมาย GT)', icon: '✉️', check: '/vip/write' }, p2: { name: 'Speaking Part 2', icon: '🎙', check: '/vip/speak' } };
export const DICT_TOPICS = [
  ['accommodation', 'จองที่พัก (Part 1)', 'a phone call booking student accommodation: names spelled out, prices, dates, room features'],
  ['enrolment', 'สมัครเรียน/ลงทะเบียน (Part 1)', 'enrolling at a language school: course times, fees, address, phone number'],
  ['library-tour', 'แนะนำห้องสมุด (Part 2)', 'a librarian explaining library facilities, opening hours and borrowing rules'],
  ['city-tour', 'ทัวร์เมือง (Part 2)', 'a guide describing a city walking tour, meeting points, directions and times'],
  ['health-centre', 'ศูนย์สุขภาพ (Part 1)', 'registering at a local health centre: appointment times, documents, symptoms'],
  ['assignment', 'คุยงานกลุ่ม (Part 3)', 'two university students discussing a group assignment, deadlines and research methods'],
  ['environment-lecture', 'บรรยายสิ่งแวดล้อม (Part 4)', 'an academic lecture about plastic pollution in oceans with data and causes'],
  ['psychology-lecture', 'บรรยายจิตวิทยา (Part 4)', 'an academic lecture about how sleep affects memory, with research findings'],
  ['job-interview', 'สัมภาษณ์งานพาร์ทไทม์ (Part 1)', 'a phone enquiry about a part-time job: shifts, pay per hour, experience needed'],
  ['sports-club', 'สมัครสมาชิกฟิตเนส (Part 1)', 'joining a sports centre: membership types, prices, class timetable'],
];

// ---------- คำสั่งให้ AI สร้างเนื้อหา ----------
export function samplePrompt(kind, question) {
  const what = kind === 't2' ? 'an IELTS Writing Task 2 essay (about 280-320 words, 4-5 paragraphs)' : kind === 't1g' ? 'an IELTS General Training Writing Task 1 letter (about 170-200 words, with greeting and sign-off)' : 'an IELTS Speaking Part 2 long-turn answer as natural spoken English (about 230-270 words, 2 minutes, first person, with natural discourse markers, no headings)';
  return `Write ${what} that would score Band 9 for this question, then explain it for Thai learners.
QUESTION:
${question}

Return ONLY JSON (Thai in fields ending _th, clear natural Thai, neutral tone without ครับ/ค่ะ, no markdown):
{"title_th":"short Thai title for the topic (max 60 chars)","topic":"one English topic word e.g. Education",
"answer":"the Band 9 answer in English (use \\n\\n between paragraphs)",
"structure_th":[{"part":"e.g. Introduction / Body 1 / Opening","note_th":"what this part does and why it works"}],
"vocab":[{"en":"advanced word or collocation used in the answer","th":"Thai meaning","note_th":"how/when to use it"}],
"why_th":["4-5 specific reasons this answer reaches Band 9, linked to the band descriptors"],
"tips_th":"2-3 sentences: how a Band 6 learner can copy this approach"}
Rules: original writing, never copied. structure_th 3-6 items. vocab 8-12 items that appear in the answer.`;
}
export function dictPrompt(topic, desc) {
  return `Create one IELTS Listening-style dictation exercise for Thai learners about: ${desc}.
Return ONLY JSON: {"title":"English title (max 50 chars)","sentences":[{"en":"one sentence a speaker says, 8-18 words, natural spoken British English, include typical IELTS details (spelled names, numbers, dates, prices, times) in about half of them","th":"Thai translation","key":"the hard-to-hear word or number in this sentence"}]}
Rules: exactly 10 sentences forming a coherent conversation or talk in order. No speaker labels inside "en". Original content.`;
}
export function dailyPrompt(n, seen) {
  return `Create ${n} short IELTS-style practice questions for Thai learners (Band 5.5-7 level), a varied mix of: vocabulary in context, collocation, grammar for writing, paraphrase matching (which option means the same), and very short reading (2-3 sentence passage then True/False/Not Given or multiple choice).
Return ONLY JSON: {"items":[{"type":"vocab|collocation|grammar|paraphrase|reading","passage":"2-3 sentences for reading items, otherwise empty string","q":"the question","choices":["A","B","C","D"],"answer":0,"explain_th":"Thai explanation of why the answer is right and the trap in the wrong options, 1-3 sentences"}]}
Rules: for True/False/Not Given use exactly 3 choices ["True","False","Not Given"]. answer is the 0-based index. Original content, no ครับ/ค่ะ in Thai.${seen ? ' Avoid these topics already used: ' + seen.slice(0, 600) : ''}`;
}

// ---------- แปลงผล AI ----------
const parseJ = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?|```$/g, '').trim(); try { return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); } catch (e) { return null; } };
export function normSample(raw, kind, question) {
  const j = parseJ(raw); if (!j || !txt(j.answer, 5000) || !KIND[kind]) return null;
  return { kind, slug: kind + '-' + slugify(question.split('\n')[0]), question: txt(question, 1500), title: txt(j.title_th, 80) || txt(question, 60), topic: txt(j.topic, 30),
    answer: txt(j.answer, 5000), structure: arr(j.structure_th, 6, (x) => x && txt(x.part, 40) ? { part: txt(x.part, 40), note: txt(x.note_th, 300) } : null),
    vocab: arr(j.vocab, 12, (x) => x && txt(x.en, 60) ? { en: txt(x.en, 60), th: txt(x.th, 80), note: txt(x.note_th, 160) } : null),
    why: arr(j.why_th, 5, (x) => txt(x, 300)), tips: txt(j.tips_th, 500), at: new Date().toISOString() };
}
export function normDict(raw, slug, name) {
  const j = parseJ(raw); if (!j) return null;
  const s = arr(j.sentences, 12, (x) => x && txt(x.en, 200) ? { en: txt(x.en, 200), th: txt(x.th, 300), key: txt(x.key, 40) } : null);
  return s.length >= 6 ? { slug, name, title: txt(j.title, 60), sentences: s, at: new Date().toISOString() } : null;
}
export function normDaily(raw) {
  const j = parseJ(raw); if (!j) return [];
  return arr(j.items, 40, (x) => { const ch = arr(x?.choices, 4, (c) => txt(c, 160)), a = Number(x?.answer); if (!x || !txt(x.q, 400) || ch.length < 3 || !(a >= 0 && a < ch.length)) return null; return { type: txt(x.type, 20), passage: txt(x.passage, 700), q: txt(x.q, 400), choices: ch, answer: a, explain: txt(x.explain_th, 400) }; });
}
// ข้อสอบประจำวัน: เลือก 5 ข้อตามวันที่ (ทุกคนได้ชุดเดียวกัน) วนทั้งคลัง
export const thDay = (t = Date.now()) => new Date(t + 7 * 3600e3).toISOString().slice(0, 10);
export function dailySet(pool, day = thDay()) {
  const P = pool || []; if (P.length < 5) return [];
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / 864e5), start = (n * 5) % P.length;
  return [...Array(5).keys()].map((i) => ({ ...P[(start + i) % P.length], i: (start + i) % P.length }));
}
// ตารางอันดับวันนี้: คะแนนมากก่อน เวลาน้อยก่อน · ชื่อเล่นกรองตัวอักษรแปลก
export const cleanNick = (s) => String(s || '').replace(/[<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
export function rankBoard(entries) { return (entries || []).slice().sort((a, b) => b.score - a.score || a.secs - b.secs || String(a.at).localeCompare(String(b.at))); }

// ---------- หน้าเว็บ ----------
const CSS = `<style>.il-hero{background:linear-gradient(135deg,#eef4ff,#fff7ed)}.il-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.il-t{display:flex;flex-direction:column;gap:4px;padding:14px;border:1.5px solid var(--line,#e5e7eb);border-radius:14px;text-decoration:none;color:inherit;background:#fff}.il-t i{font-style:normal;font-size:26px}.il-t b{font-size:16px}.il-t span{font-size:13px;color:#555}.il-t.hot{border-color:#2563eb;background:#eef4ff}
.il-list a{display:flex;gap:10px;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--line,#eee);text-decoration:none;color:inherit}.il-list a span{font-size:13px;color:#555}.il-q{background:#f8fafc;border-radius:12px;padding:12px 14px;white-space:pre-wrap;font-weight:600;line-height:1.6}.il-ans{white-space:pre-wrap;line-height:1.85;font-size:16.5px}.il-ans mark{background:#fef3c7;padding:0 2px;border-radius:3px}
.il-voc{display:grid;gap:6px}.il-voc div{background:#f8fafc;border-radius:8px;padding:6px 10px}.il-st{border-left:4px solid #2563eb;padding:4px 10px;margin:6px 0}.il-cta{display:flex;gap:8px;flex-wrap:wrap}.il-say{border:1.5px solid var(--line,#ddd);background:#fff;border-radius:99px;padding:6px 14px;cursor:pointer;font:inherit;font-weight:600}
.dc-s{border:1.5px solid var(--line,#e5e7eb);border-radius:12px;padding:10px 12px;margin:10px 0}.dc-s.ok{border-color:#16a34a;background:#f0fdf4}.dc-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.dc-s input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;border:1.5px solid #ccc;border-radius:10px;margin-top:8px}.dc-res{margin-top:6px;line-height:1.8}.dc-res .w-ok{color:#15803d}.dc-res .w-bad{color:#b91c1c;text-decoration:line-through}.dc-res .w-miss{color:#b45309;font-weight:700}
.dq{border:1.5px solid var(--line,#e5e7eb);border-radius:12px;padding:12px;margin:10px 0}.dq .ch{display:grid;gap:6px;margin-top:8px}.dq .ch button{text-align:left;font:inherit;padding:10px 12px;border-radius:10px;border:1.5px solid #ddd;background:#fff;cursor:pointer}.dq .ch button.right{border-color:#16a34a;background:#f0fdf4}.dq .ch button.wrong{border-color:#dc2626;background:#fef2f2}.dq .ex{font-size:14px;color:#444;margin-top:6px}
.lb{width:100%;border-collapse:collapse}.lb td,.lb th{padding:6px 8px;border-top:1px solid #eee;text-align:left}.lb tr.me{background:#fef3c7}.dl-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}</style>`;
const page = (o) => shell({ ...o, tab: 'quiz' });

export function hubPage(lib, { settings = {}, site = '' } = {}) {
  const S = (lib && lib.samples) || [], Dc = (lib && lib.dict) || [], dn = ((lib && lib.daily) || []).length;
  const t = (href, i, b, s, hot) => `<a class="il-t${hot ? ' hot' : ''}" href="${href}"><i aria-hidden="true">${i}</i><b>${b}</b><span>${s}</span></a>`;
  const body = `<header class="card il-hero"><span class="chip">IELTS</span><h1>ฝึก IELTS ครบทุกทักษะ อธิบายภาษาไทย</h1><p>ตรวจ Writing และ Speaking ด้วย AI · ตัวอย่างคำตอบ Band 9 พร้อมคำอธิบาย · ฝึกฟังแล้วพิมพ์ตาม · ข้อสอบประจำวันพร้อมตารางอันดับ · คำนวณคะแนน</p></header>
<section class="card"><h2>🤖 ให้ AI ตรวจ (ทดลองฟรี)</h2><div class="il-grid">${t('/vip/write', '✍️', 'ตรวจ Writing', 'Task 1 · Task 2 · จดหมาย ได้คะแนน 4 เกณฑ์ + จุดแก้ภาษาไทย', 1)}${t('/vip/speak', '🎙', 'ตรวจ Speaking', 'อัดเสียงตอบ ได้คะแนน + คำที่ออกเสียงผิด', 1)}</div></section>
<section class="card"><h2>📚 ฝึกฟรี</h2><div class="il-grid">${t('/ielts/samples', '⭐', 'ตัวอย่าง Band 9', `${S.length} ข้อ อธิบายโครงสร้างและศัพท์`)}${t('/ielts/dictation', '🎧', 'ฟังแล้วพิมพ์ตาม', `${Dc.length} บท เสียงสำเนียงอังกฤษ`)}${t('/ielts/daily', '📅', 'ข้อสอบวันนี้', `5 ข้อ · ตารางอันดับ${dn ? '' : ' (เร็วๆ นี้)'}`)}${t('/ielts-band-calculator', '🧮', 'คำนวณคะแนน', 'Listening · Reading · Overall')}${t('/vip/mock', '⏱️', 'ข้อสอบจับเวลา', 'สำหรับสมาชิก VIP')}${t('/topic/ielts', '📖', 'สรุปเนื้อหา IELTS', 'บทความและแบบทดสอบ')}</div></section>
${S.length ? `<section class="card"><h2>⭐ ตัวอย่างล่าสุด</h2><div class="il-list">${S.slice(-5).reverse().map((x) => `<a href="/ielts/samples/${esc(x.slug)}"><b>${esc(KIND[x.kind].icon)} ${esc(x.title)}</b><span>${esc(KIND[x.kind].name)}</span></a>`).join('')}</div></section>` : ''}
<section class="card"><h2>📘 อยากได้แบบเป็นเล่ม</h2><p>ชุดหนังสือ IELTS ครบทุกทักษะ อธิบายภาษาไทย มีทั้งไฟล์ PDF และเล่มพิมพ์ <a href="/store?utm_source=ielts-hub">ดูในร้าน ›</a></p></section>${CSS}`;
  return page({ title: 'ฝึก IELTS ออนไลน์ฟรี ตรวจ Writing Speaking ด้วย AI อธิบายภาษาไทย · SheetLab', desc: 'ฝึก IELTS ครบทุกทักษะ ตรวจ Writing และ Speaking ด้วย AI อธิบายภาษาไทย ตัวอย่างคำตอบ Band 9 ฝึกฟังแล้วพิมพ์ตาม ข้อสอบประจำวัน และคำนวณคะแนน', canonical: `${site}/ielts`, body, pixelId: settings.pixelId });
}

export function samplesPage(lib, { settings = {}, site = '' } = {}) {
  const S = (lib && lib.samples) || [];
  const grp = Object.keys(KIND).map((k) => { const L = S.filter((x) => x.kind === k); return L.length ? `<section class="card"><h2>${KIND[k].icon} ${KIND[k].name} <span class="fine">(${L.length})</span></h2><div class="il-list">${L.map((x) => `<a href="/ielts/samples/${esc(x.slug)}"><b>${esc(x.title)}</b><span>${esc(x.topic)}</span></a>`).join('')}</div></section>` : ''; }).join('');
  const body = `<header class="card"><span class="chip">ฟรี</span><h1>⭐ ตัวอย่างคำตอบ IELTS Band 9 อธิบายภาษาไทย</h1><p>อ่านตัวอย่างระดับ Band 9 พร้อมคำอธิบายว่าทำไมได้คะแนนสูง โครงสร้างแต่ละย่อหน้า และคำศัพท์ที่ควรจำ แล้วลองเขียน/พูดข้อเดียวกันให้ AI ตรวจ · ตัวอย่างแต่งใหม่โดย SheetLab ไม่ใช่ข้อสอบจริง</p></header>${grp || '<p class="card">กำลังเพิ่มตัวอย่าง</p>'}${CSS}`;
  return page({ title: 'ตัวอย่าง IELTS Writing Speaking Band 9 อธิบายภาษาไทย · SheetLab', desc: 'ตัวอย่างเรียงความ IELTS Writing Task 2 จดหมาย General Training และ Speaking Part 2 ระดับ Band 9 พร้อมคำอธิบายภาษาไทย โครงสร้าง และคำศัพท์', canonical: `${site}/ielts/samples`, body, pixelId: settings.pixelId });
}

export function samplePage(x, { settings = {}, site = '', audio = '' } = {}) {
  const K = KIND[x.kind], words = (x.answer.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
  let ans = esc(x.answer); for (const v of x.vocab) { const w = esc(v.en); if (w.length > 3) ans = ans.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i'), '<mark title="' + esc(v.th) + '">$1</mark>'); }
  const body = `<p class="fine"><a href="/ielts">IELTS</a> › <a href="/ielts/samples">ตัวอย่าง Band 9</a> › ${esc(K.name)}</p>
<header class="card"><span class="chip">${esc(K.icon)} ${esc(K.name)}</span><h1>${esc(x.title)}</h1><div class="il-q">${esc(x.question)}</div></header>
<section class="card"><div class="dl-top"><h2>⭐ ตัวอย่าง Band 9 <span class="fine">(${words} คำ)</span></h2>${x.kind === 'p2' ? `<button class="il-say" id="il-play" data-src="${esc(audio)}">🔊 ฟังเสียงอ่าน</button>` : ''}</div><div class="il-ans">${ans}</div><p class="fine">คำที่ไฮไลต์ = คำศัพท์น่าจำ (แตะค้างเพื่อดูความหมาย)</p></section>
${x.why.length ? `<section class="card"><h2>🏆 ทำไมได้ Band 9</h2><ul>${x.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></section>` : ''}
${x.structure.length ? `<section class="card"><h2>🧱 โครงสร้าง</h2>${x.structure.map((s) => `<div class="il-st"><b>${esc(s.part)}</b><p>${esc(s.note)}</p></div>`).join('')}</section>` : ''}
${x.vocab.length ? `<section class="card"><h2>📚 คำศัพท์น่าจำ</h2><div class="il-voc">${x.vocab.map((v) => `<div><b>${esc(v.en)}</b> = ${esc(v.th)}${v.note ? ` <span class="fine">· ${esc(v.note)}</span>` : ''}</div>`).join('')}</div></section>` : ''}
${x.tips ? `<section class="card"><h2>💡 เอาไปใช้ยังไง</h2><p>${esc(x.tips)}</p></section>` : ''}
<section class="card"><h2>ลองทำข้อนี้เอง</h2><p>${x.kind === 'p2' ? 'อัดเสียงตอบคำถามเดียวกัน แล้วให้ AI ฟังและบอกจุดที่ต้องแก้เป็นภาษาไทย' : 'เขียนตอบโจทย์เดียวกัน แล้วให้ AI ให้คะแนนและอธิบายจุดแก้เป็นภาษาไทย'} (ทดลองฟรี)</p><div class="il-cta"><a class="btn" href="${K.check}?s=${esc(x.slug)}">${x.kind === 'p2' ? '🎙 อัดเสียงตอบข้อนี้' : '✍️ เขียนข้อนี้แล้วให้ AI ตรวจ'}</a><a class="btn" style="background:var(--bg);color:var(--ink)" href="/ielts/samples">ตัวอย่างอื่น</a></div></section>${CSS}
<script>(function(){var b=document.getElementById('il-play');if(!b)return;var a=null;b.onclick=function(){if(b.dataset.src){if(!a){a=new Audio(b.dataset.src);a.onended=function(){b.textContent='🔊 ฟังเสียงอ่าน';};}if(a.paused){a.play();b.textContent='⏸ หยุด';}else{a.pause();b.textContent='🔊 ฟังเสียงอ่าน';}return;}try{speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(document.querySelector('.il-ans').innerText);u.lang='en-GB';speechSynthesis.speak(u);}catch(x){}};})();</script>`;
  return page({ title: `${x.title} · ตัวอย่าง IELTS ${K.name} Band 9 · SheetLab`, desc: `ตัวอย่าง IELTS ${K.name} Band 9: ${x.question.split('\n')[0].slice(0, 110)} พร้อมคำอธิบายภาษาไทย โครงสร้าง และคำศัพท์`, canonical: `${site}/ielts/samples/${x.slug}`, body, pixelId: settings.pixelId,
    ld: { '@context': 'https://schema.org', '@type': 'Article', headline: x.title, inLanguage: 'th', about: 'IELTS ' + K.name, author: { '@type': 'Organization', name: 'SheetLab' }, datePublished: x.at } });
}

export function dictListPage(lib, { settings = {}, site = '' } = {}) {
  const D = (lib && lib.dict) || [];
  const body = `<header class="card"><span class="chip">ฟรี</span><h1>🎧 ฝึกฟัง IELTS: ฟังแล้วพิมพ์ตาม (Dictation) และพูดตาม (Shadowing)</h1><p>ฟังทีละประโยคด้วยเสียงสำเนียงอังกฤษแบบข้อสอบ พิมพ์สิ่งที่ได้ยิน แล้วกดตรวจ ระบบบอกคำที่ฟังพลาดทันที พร้อมคำแปลไทย · ฝึกพูดตามเพื่อออกเสียงให้ชัด</p></header>
<section class="card"><div class="il-list">${D.map((d) => `<a href="/ielts/dictation/${esc(d.slug)}"><b>${esc(d.title || d.name)}</b><span>${esc(d.name)} · ${d.sentences.length} ประโยค</span></a>`).join('') || '<p>กำลังเพิ่มบทฝึก</p>'}</div></section>${CSS}`;
  return page({ title: 'ฝึกฟัง IELTS Listening Dictation Shadowing ออนไลน์ฟรี มีคำแปลไทย · SheetLab', desc: 'ฝึกฟัง IELTS แบบ dictation ฟังแล้วพิมพ์ตามทีละประโยค เสียงสำเนียงอังกฤษ ตรวจคำที่ฟังพลาดทันที พร้อมคำแปลไทย และฝึกพูดตาม shadowing', canonical: `${site}/ielts/dictation`, body, pixelId: settings.pixelId });
}

export function dictPage(d, { settings = {}, site = '' } = {}) {
  const body = `<p class="fine"><a href="/ielts">IELTS</a> › <a href="/ielts/dictation">ฝึกฟัง</a></p><header class="card"><span class="chip">🎧 ${esc(d.name)}</span><h1>${esc(d.title || d.name)}</h1><p class="fine">กด ▶ ฟัง (ฟังซ้ำได้ หรือกด 🐢 ฟังช้า) พิมพ์สิ่งที่ได้ยินแล้วกด Enter · เปิด "พูดตาม" เพื่ออัดเสียงตัวเองเทียบกับต้นฉบับ</p>
<div class="dc-bar"><label><input type="checkbox" id="dc-sh"> 🗣 โหมดพูดตาม (Shadowing)</label><span class="fine" id="dc-score"></span></div></header>
${d.sentences.map((s, i) => `<section class="dc-s" data-i="${i}" data-en="${esc(s.en)}" data-src="${esc(s.audio || '')}"><div class="dc-bar"><b>${i + 1}.</b><button class="il-say" data-play="1">▶ ฟัง</button><button class="il-say" data-play="0.75">🐢 ฟังช้า</button><button class="il-say dc-rec" hidden>● พูดตาม</button><button class="il-say" data-show>ดูเฉลย</button></div><input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="พิมพ์สิ่งที่ได้ยิน แล้วกด Enter" aria-label="ประโยคที่ ${i + 1}"><div class="dc-res" hidden></div></section>`).join('')}
<section class="card"><h2>ฝึกต่อ</h2><div class="il-cta"><a class="btn" href="/ielts/dictation">บทอื่น</a><a class="btn" href="/vip/speak">🎙 ให้ AI ตรวจ Speaking</a></div></section>${CSS}
<script>(function(){var TH=${JSON.stringify(d.sentences.map((s) => s.th)).replace(/</g, '\\u003c')},done={},cur=null;
function norm(t){return String(t||'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9' ]+/g,' ').replace(/\\s+/g,' ').trim().split(' ').filter(Boolean);}
function diff(a,b){var n=a.length,m=b.length,L=[];for(var i=0;i<=n;i++){L.push(new Array(m+1).fill(0));}for(i=n-1;i>=0;i--)for(var j=m-1;j>=0;j--)L[i][j]=a[i]===b[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);var out=[];i=0;j=0;while(i<n&&j<m){if(a[i]===b[j]){out.push(['ok',a[i]]);i++;j++;}else if(L[i+1][j]>=L[i][j+1]){out.push(['miss',a[i]]);i++;}else{out.push(['bad',b[j]]);j++;}}while(i<n)out.push(['miss',a[i++]]);while(j<m)out.push(['bad',b[j++]]);return out;}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function play(sec,rate){if(cur){cur.pause();}var src=sec.dataset.src;if(src){cur=new Audio(src);cur.playbackRate=rate;cur.play();return;}try{speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(sec.dataset.en);u.lang='en-GB';u.rate=rate*.95;speechSynthesis.speak(u);}catch(x){}}
function check(sec,show){var a=norm(sec.dataset.en),b=norm(sec.querySelector('input').value),r=sec.querySelector('.dc-res'),d=diff(a,b),ok=d.filter(function(x){return x[0]==='ok';}).length,pc=Math.round(ok/a.length*100);
 r.hidden=false;r.innerHTML=(show?'':'<b>'+pc+'%</b> · ')+d.map(function(x){return '<span class="w-'+x[0]+'">'+esc(x[1])+'</span>';}).join(' ')+'<br><span class="fine">'+esc(sec.dataset.en)+'</span><br><span class="fine">🇹🇭 '+esc(TH[+sec.dataset.i]||'')+'</span>';if(pc===100)sec.classList.add('ok');done[sec.dataset.i]=show?0:pc;var v=Object.keys(done).map(function(k){return done[k];});document.getElementById('dc-score').textContent='ทำแล้ว '+v.length+'/'+TH.length+' ข้อ · เฉลี่ย '+Math.round(v.reduce(function(s,x){return s+x;},0)/v.length)+'%';}
document.querySelectorAll('.dc-s').forEach(function(sec){sec.querySelectorAll('[data-play]').forEach(function(b){b.onclick=function(){play(sec,+b.dataset.play);sec.querySelector('input').focus();};});
 sec.querySelector('[data-show]').onclick=function(){check(sec,true);};sec.querySelector('input').addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();check(sec,false);}});
 var rb=sec.querySelector('.dc-rec'),mr=null,ch=[];rb.onclick=function(){if(mr){mr.stop();return;}if(!navigator.mediaDevices||!window.MediaRecorder){alert('เบราว์เซอร์นี้อัดเสียงไม่ได้');return;}navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){ch=[];mr=new MediaRecorder(s);mr.ondataavailable=function(e){ch.push(e.data);};mr.onstop=function(){s.getTracks().forEach(function(t){t.stop();});var a=sec.querySelector('audio')||document.createElement('audio');a.controls=true;a.src=URL.createObjectURL(new Blob(ch,{type:mr.mimeType}));sec.appendChild(a);mr=null;rb.textContent='● พูดตาม';};mr.start();rb.textContent='■ หยุด';}).catch(function(){alert('อนุญาตไมโครโฟนก่อน');});};});
document.getElementById('dc-sh').onchange=function(){var on=this.checked;document.querySelectorAll('.dc-rec').forEach(function(b){b.hidden=!on;});};})();</script>`;
  return page({ title: `${d.title || d.name} · ฝึกฟัง IELTS Dictation · SheetLab`, desc: `ฝึกฟัง IELTS ${d.name} ฟังแล้วพิมพ์ตามทีละประโยค เสียงสำเนียงอังกฤษ ตรวจคำที่ฟังพลาด พร้อมคำแปลไทย`, canonical: `${site}/ielts/dictation/${d.slug}`, body, pixelId: settings.pixelId });
}

export function dailyIeltsPage(set, { settings = {}, site = '', day = thDay() } = {}) {
  const Q = set.map(({ answer, explain, i, ...q }) => q);
  const body = `<p class="fine"><a href="/ielts">IELTS</a> › ข้อสอบวันนี้</p><header class="card"><span class="chip">📅 ${esc(day)}</span><h1>ข้อสอบ IELTS วันนี้ 5 ข้อ</h1><p class="fine">ทุกคนได้ชุดเดียวกันทั้งวัน ทำจบแล้วใส่ชื่อเล่นขึ้นตารางอันดับได้ (คะแนนมากก่อน ถ้าเท่ากันใครเร็วกว่าอยู่บน) · ชุดใหม่ทุกเที่ยงคืน</p></header>
<div id="dq">${Q.length ? '' : '<p class="card">กำลังเตรียมข้อสอบ กลับมาใหม่เร็วๆ นี้</p>'}</div><section class="card" id="lb"><h2>🏆 ตารางอันดับวันนี้</h2><p class="fine">กำลังโหลด...</p></section>${CSS}
<script>(function(){var Q=${JSON.stringify(Q).replace(/</g, '\\u003c')},D=${JSON.stringify(day)},box=document.getElementById('dq'),ans=Q.map(function(){return -1;}),t0=0,KEY='sl_ield_'+D;
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function get(k){try{return localStorage.getItem(k);}catch(x){return null;}}function put(k,v){try{localStorage.setItem(k,v);}catch(x){}}
function board(me){fetch('/api/order?m=ielts_daily&d='+D,{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){var L=j.board||[],h='<h2>🏆 ตารางอันดับวันนี้</h2>';if(!L.length)h+='<p>ยังไม่มีใครส่งวันนี้ เป็นคนแรกเลย</p>';else h+='<table class="lb"><thead><tr><th>#</th><th>ชื่อ</th><th>คะแนน</th><th>เวลา</th></tr></thead><tbody>'+L.map(function(x,i){return '<tr'+(me&&x.id===me?' class="me"':'')+'><td>'+(i+1)+'</td><td>'+e(x.nick)+'</td><td>'+x.score+'/5</td><td>'+x.secs+' วิ</td></tr>';}).join('')+'</tbody></table>';h+='<p class="fine">'+(j.total||0)+' คนเล่นวันนี้ · แสดง 20 อันดับแรก</p>';document.getElementById('lb').innerHTML=h;});}
if(!Q.length){board();return;}
var prev=get(KEY);if(prev){try{prev=JSON.parse(prev);}catch(x){prev=null;}}
box.innerHTML=Q.map(function(q,n){return '<section class="dq" data-n="'+n+'"><b>'+(n+1)+'.</b> '+(q.passage?'<p class="fine" style="white-space:pre-wrap">'+e(q.passage)+'</p>':'')+'<p><b>'+e(q.q)+'</b></p><div class="ch">'+q.choices.map(function(c,k){return '<button type="button" data-k="'+k+'">'+e(c)+'</button>';}).join('')+'</div><p class="ex"></p></section>';}).join('')+'<button class="btn" id="dq-go" style="width:100%;margin:10px 0">ส่งคำตอบ</button>';
box.querySelectorAll('.dq').forEach(function(s){var n=+s.dataset.n;s.querySelectorAll('.ch button').forEach(function(b){b.onclick=function(){if(!t0)t0=Date.now();if(s.classList.contains('done'))return;ans[n]=+b.dataset.k;s.querySelectorAll('.ch button').forEach(function(y){y.style.borderColor=y===b?'#2563eb':'';});};});});
document.addEventListener('click',function(){if(!t0)t0=Date.now();},{once:true});t0=Date.now();
function show(r){r.res.forEach(function(x,n){var s=box.querySelector('[data-n="'+n+'"]');s.classList.add('done');var bs=s.querySelectorAll('.ch button');if(x.pick>=0&&x.pick!==x.answer)bs[x.pick].classList.add('wrong');bs[x.answer].classList.add('right');s.querySelector('.ex').textContent=x.explain||'';});var g=document.getElementById('dq-go');if(g)g.remove();
 var h='<section class="card"><h2>ได้ '+r.score+'/5 · '+r.secs+' วินาที</h2>'+(r.id?'<p>ขึ้นตารางอันดับแล้ว ✅</p>':'<form id="dq-nick" class="dc-bar"><input name="n" maxlength="20" placeholder="ชื่อเล่นที่จะโชว์ในตาราง" style="flex:1;font:inherit;padding:10px;border:1.5px solid #ccc;border-radius:10px" required><button class="btn">ขึ้นตาราง</button></form>')+'<p class="fine">ฝึกต่อ: <a href="/vip/write">✍️ ตรวจ Writing</a> · <a href="/ielts/dictation">🎧 ฝึกฟัง</a> · <a href="/ielts/samples">⭐ ตัวอย่าง Band 9</a></p></section>';box.insertAdjacentHTML('afterbegin',h);
 var f=document.getElementById('dq-nick');if(f)f.onsubmit=function(ev){ev.preventDefault();var b=f.querySelector('button');b.disabled=true;fetch('/api/order?m=ielts_daily',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({d:D,ans:r.ans,secs:r.secs,nick:f.n.value})}).then(function(x){return x.json();}).then(function(j){if(j.ok){r.id=j.id;put(KEY,JSON.stringify(r));f.outerHTML='<p>ขึ้นตารางอันดับแล้ว ✅ อันดับ '+j.rank+'</p>';board(j.id);}else{b.disabled=false;alert(j.error||'ส่งไม่สำเร็จ');}});};}
document.getElementById('dq-go')&&(document.getElementById('dq-go').onclick=function(){var left=ans.filter(function(a){return a<0;}).length;if(left&&!confirm('ยังไม่ได้ตอบ '+left+' ข้อ ส่งเลยไหม'))return;var secs=Math.max(1,Math.round((Date.now()-t0)/1000));
 fetch('/api/order?m=ielts_daily&grade=1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({d:D,ans:ans,secs:secs,grade:1})}).then(function(x){return x.json();}).then(function(j){if(!j.ok){alert(j.error||'ตรวจไม่สำเร็จ');return;}var r={ans:ans,secs:secs,score:j.score,res:j.res};put(KEY,JSON.stringify(r));show(r);});});
if(prev&&prev.res)show(prev);board(prev&&prev.id);})();</script>`;
  return page({ title: `ข้อสอบ IELTS ประจำวัน ${day} 5 ข้อ พร้อมเฉลยภาษาไทย · SheetLab`, desc: 'ข้อสอบ IELTS วันละ 5 ข้อ คำศัพท์ ไวยากรณ์ paraphrase และ reading สั้น พร้อมเฉลยภาษาไทย และตารางอันดับของวันนี้', canonical: `${site}/ielts/daily`, body, pixelId: settings.pixelId });
}
