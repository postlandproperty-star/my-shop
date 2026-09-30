// แบบทดสอบ TOEIC ฟรี (/quiz และ /quiz/<slug>): หน้าเนื้อหาที่ Google เก็บได้ พาคนจากการค้นหามาหน้าขาย
// ทีมคอนเทนต์ (น้องปากกา) เขียนผ่าน API content?action=quiz · เก็บใน shop_state id=quizzes · คุณแดนซ่อนได้จากหลังบ้าน
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const QUIZ_CATS = { grammar: 'Grammar', vocab: 'คำศัพท์', listening: 'Listening', reading: 'Reading', mock: 'ข้อสอบเสมือนจริง' };
const FB_CHAT = 'https://m.me/1264839566720049';

// ตรวจและทำความสะอาดควิซที่ทีมส่งมา คืน {quiz} หรือ {error}
export function cleanQuiz(b) {
  const slug = String(b.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 70) return { error: 'slug ใช้ a-z 0-9 และ - เท่านั้น' };
  const title = String(b.title || '').trim();
  if (title.length < 8 || title.length > 90) return { error: 'title ยาว 8-90 ตัวอักษร' };
  const desc = String(b.desc || '').trim().slice(0, 220);
  if (desc.length < 20) return { error: 'desc อย่างน้อย 20 ตัวอักษร (ใช้เป็นคำอธิบายในผลค้นหา Google)' };
  const qs = Array.isArray(b.questions) ? b.questions : [];
  if (qs.length < 5 || qs.length > 20) return { error: 'ต้องมี 5-20 ข้อ' };
  const seen = new Set(), questions = [];
  for (const [i, q] of qs.entries()) {
    const text = String(q?.q || '').trim(), choices = Array.isArray(q?.choices) ? q.choices.map((c) => String(c || '').trim()) : [];
    const answer = Number(q?.answer), explain = String(q?.explain || '').trim();
    if (text.length < 5 || text.length > 400) return { error: `ข้อ ${i + 1}: โจทย์ยาว 5-400 ตัวอักษร` };
    if (choices.length !== 4 || choices.some((c) => !c || c.length > 120) || new Set(choices.map((c) => c.toLowerCase())).size !== 4) return { error: `ข้อ ${i + 1}: ต้องมี 4 ตัวเลือกไม่ซ้ำกัน` };
    if (!Number.isInteger(answer) || answer < 0 || answer > 3) return { error: `ข้อ ${i + 1}: answer ต้องเป็น 0-3` };
    if (explain.length < 15 || explain.length > 600) return { error: `ข้อ ${i + 1}: เฉลยอธิบาย 15-600 ตัวอักษร` };
    if (seen.has(text.toLowerCase())) return { error: `ข้อ ${i + 1}: โจทย์ซ้ำ` };
    seen.add(text.toLowerCase());
    questions.push({ q: text, choices, answer, explain });
  }
  return { quiz: { slug, title, desc, cat: QUIZ_CATS[b.cat] ? b.cat : '', product_id: String(b.product_id || '').slice(0, 40), questions } };
}

const CSS = `:root{--bg:#EDF1F7;--surface:#FFFFFF;--ink:#0F1B33;--muted:#56637D;--line:#D3DBE8;--brand:#2440E8;--ok:#0F7A55;--okbg:#DDF3EA;--bad:#B42318;--badbg:#FBE1DE;--accent:#FFD23F}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0B1220;--surface:#131C30;--ink:#EAF0FF;--muted:#9AA7C4;--line:#27334F;--brand:#8EA0FF;--ok:#5FD69B;--okbg:#133528;--bad:#FF8A7A;--badbg:#3A1A18}}
:root[data-theme="dark"]{--bg:#0B1220;--surface:#131C30;--ink:#EAF0FF;--muted:#9AA7C4;--line:#27334F;--brand:#8EA0FF;--ok:#5FD69B;--okbg:#133528;--bad:#FF8A7A;--badbg:#3A1A18}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 'IBM Plex Sans Thai','Noto Sans Thai',system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:18px 16px 60px;display:flex;flex-direction:column;gap:16px}
a{color:var(--brand)}h1,h2{font-family:'Mitr','IBM Plex Sans Thai',sans-serif;font-weight:500;line-height:1.3;margin:0;text-wrap:balance}h1{font-size:26px}h2{font-size:19px}
.top{display:flex;justify-content:space-between;align-items:center;gap:10px}.logo{font-family:'Mitr',sans-serif;font-size:22px;text-decoration:none}
.fine{font-size:14px;color:var(--muted)}.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px}
.q{display:flex;flex-direction:column;gap:10px}.qn{font-size:13px;font-weight:600;color:var(--brand)}.qt{font-weight:600;white-space:pre-line}
.ch{display:grid;gap:8px}.ch button{text-align:left;font:inherit;color:var(--ink);background:var(--bg);border:1.5px solid var(--line);border-radius:12px;padding:10px 14px;cursor:pointer}
.ch button:hover:not(:disabled){border-color:var(--brand)}.ch button:focus-visible{outline:3px solid var(--brand);outline-offset:2px}
.ch button.right{background:var(--okbg);border-color:var(--ok);font-weight:600}.ch button.wrong{background:var(--badbg);border-color:var(--bad)}
.ex{display:none;border-left:3px solid var(--brand);padding:4px 0 4px 12px;font-size:15px}.done .ex{display:block}
.score{position:sticky;bottom:12px;background:var(--ink);color:var(--surface);border-radius:999px;padding:8px 16px;align-self:center;font-weight:600;box-shadow:0 6px 20px rgba(15,27,51,.25)}
.cta{display:grid;grid-template-columns:96px minmax(0,1fr);gap:14px;align-items:center;text-decoration:none;color:var(--ink);border:2px solid var(--brand)}
.cta img{width:96px;height:96px;object-fit:contain;border-radius:10px;background:#fff}.cta b{font-size:17px}.btn{display:inline-block;background:var(--accent);color:#0F1B33;font-weight:700;border-radius:12px;padding:10px 18px;text-decoration:none;margin-top:6px}
.list{display:grid;gap:10px}.item{display:flex;flex-direction:column;gap:2px;text-decoration:none;color:var(--ink)}.item b{font-size:17px}
.chip{display:inline-block;font-size:12px;font-weight:600;color:var(--brand);background:rgba(36,64,232,.1);border-radius:999px;padding:1px 9px;align-self:flex-start}
footer{text-align:center;font-size:13px;color:var(--muted);padding-top:10px}`;

function shell({ title, desc, canonical, body, ld, pixelId, noindex }) {
  const pixel = /^\d{6,20}$/.test(String(pixelId || '')) ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');</script>` : '';
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}">${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600&family=Mitr:wght@500&display=swap" rel="stylesheet">
<style>${CSS}</style>${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}${pixel}</head><body><main>
<div class="top"><a class="logo" href="/">SheetLab</a><a class="fine" href="/quiz">แบบทดสอบทั้งหมด</a></div>
${body}
<footer>SheetLab · <a href="/">ชีทสรุป TOEIC</a> · <a href="/order">หาออเดอร์ของฉัน</a> · <a href="${FB_CHAT}" target="_blank" rel="noopener noreferrer">ทักแชท</a> · <a href="/privacy">นโยบายความเป็นส่วนตัว</a><br>แบบทดสอบจัดทำขึ้นใหม่เพื่อการฝึก ไม่ใช่ข้อสอบจริง · TOEIC เป็นเครื่องหมายการค้าจดทะเบียนของ ETS ร้านไม่มีส่วนเกี่ยวข้องหรือได้รับการรับรองจาก ETS</footer>
</main></body></html>`;
}

function productCard(p, site) {
  if (!p) return '';
  const img = (p.images || [])[0];
  return `<a class="card cta" href="/p/${esc(p.slug)}?utm_campaign=quiz">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span></span>'}<span><span class="fine">อยากฝึกให้ครบทุกจุดที่ออกสอบ</span><br><b>${esc(p.name)}</b><br>${Number(p.price) >= 1 ? `<strong>฿${Number(p.price).toLocaleString('th-TH')}</strong> ` : ''}<span class="btn">ดูตัวอย่างในเล่ม →</span></span></a>`;
}

export function quizPage(q, { products = [], settings = {}, site = '', others = [] } = {}) {
  const live = products.filter((p) => p.status === 'published');
  const prod = live.find((p) => p.id === q.product_id) || live.find((p) => p.type !== 'bundle') || live[0];
  const url = `${site}/quiz/${q.slug}`;
  const ld = { '@context': 'https://schema.org', '@type': 'Quiz', name: q.title, description: q.desc, url, inLanguage: 'th', educationalLevel: 'TOEIC', about: { '@type': 'Thing', name: 'TOEIC ' + (QUIZ_CATS[q.cat] || 'English') },
    hasPart: q.questions.map((x, i) => ({ '@type': 'Question', eduQuestionType: 'Multiple choice', position: i + 1, text: x.q,
      acceptedAnswer: { '@type': 'Answer', text: x.choices[x.answer], answerExplanation: { '@type': 'Comment', text: x.explain } },
      suggestedAnswer: x.choices.filter((_, k) => k !== x.answer).map((c) => ({ '@type': 'Answer', text: c })) })) };
  const L = 'ABCD';
  const body = `<header class="card"><span class="chip">แบบทดสอบ TOEIC ฟรี${q.cat && QUIZ_CATS[q.cat] ? ' · ' + QUIZ_CATS[q.cat] : ''}</span><h1 style="margin-top:6px">${esc(q.title)}</h1><p class="fine" style="margin:6px 0 0">${esc(q.desc)} · ${q.questions.length} ข้อ กดเลือกคำตอบแล้วดูเฉลยทันที</p></header>
${q.questions.map((x, i) => `<section class="card q" data-a="${x.answer}"><span class="qn">ข้อ ${i + 1}</span><div class="qt">${esc(x.q)}</div><div class="ch">${x.choices.map((c, k) => `<button type="button" data-k="${k}">(${L[k]}) ${esc(c)}</button>`).join('')}</div><div class="ex"><b>เฉลย (${L[x.answer]}) ${esc(x.choices[x.answer])}</b><br>${esc(x.explain)}</div></section>`).join('\n')}
<div class="score" id="score" aria-live="polite">ตอบแล้ว 0/${q.questions.length}</div>
${productCard(prod, site)}
${others.length ? `<section class="card"><h2>แบบทดสอบอื่น</h2><div class="list" style="margin-top:8px">${others.slice(0, 5).map((o) => `<a class="item" href="/quiz/${esc(o.slug)}"><b>${esc(o.title)}</b><span class="fine">${o.questions.length} ข้อ</span></a>`).join('')}</div></section>` : ''}
<script>(function(){var t=${q.questions.length},n=0,r=0,s=document.getElementById('score');document.querySelectorAll('.q').forEach(function(sec){var a=+sec.dataset.a;sec.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){if(sec.classList.contains('done'))return;sec.classList.add('done');var k=+b.dataset.k;n++;if(k===a)r++;else b.classList.add('wrong');sec.querySelectorAll('button')[a].classList.add('right');sec.querySelectorAll('button').forEach(function(x){x.disabled=true;});s.textContent=n<t?'ตอบแล้ว '+n+'/'+t+' · ถูก '+r:'ได้ '+r+'/'+t+' คะแนน'+(r/t>=.8?' เก่งมาก!':' ลองดูเฉลยแล้วฝึกเพิ่มนะ');});});});})();</script>`;
  return shell({ title: `${q.title} | แบบทดสอบ TOEIC ฟรี · SheetLab`, desc: q.desc, canonical: url, body, ld, pixelId: settings.pixelId });
}

export function quizIndex(list, { settings = {}, site = '' } = {}) {
  const body = `<header class="card"><h1>แบบทดสอบ TOEIC ฟรี</h1><p class="fine" style="margin:6px 0 0">ฝึกทำโจทย์แนว TOEIC พร้อมเฉลยอธิบายภาษาไทย กดเลือกคำตอบแล้วรู้ผลทันที ไม่ต้องสมัครสมาชิก</p></header>
${list.length ? `<div class="list">${list.map((q) => `<a class="card item" href="/quiz/${esc(q.slug)}"><span class="chip">${esc(QUIZ_CATS[q.cat] || 'TOEIC')}</span><b>${esc(q.title)}</b><span class="fine">${esc(q.desc)} · ${q.questions.length} ข้อ</span></a>`).join('')}</div>` : '<p class="card">แบบทดสอบชุดแรกกำลังมา</p>'}`;
  return shell({ title: 'แบบทดสอบ TOEIC ฟรี พร้อมเฉลย · SheetLab', desc: 'รวมแบบทดสอบ TOEIC ฟรี Grammar คำศัพท์ และ Reading พร้อมเฉลยอธิบายภาษาไทย ทำได้ทันทีบนมือถือ', canonical: `${site}/quiz`, body, pixelId: settings.pixelId, noindex: !list.length });
}
