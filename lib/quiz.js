// คลังข้อสอบ (/quiz) และคลังความรู้ (/learn): หน้าเนื้อหาที่ Google เก็บได้ พาคนจากการค้นหามาหน้าขาย
// ทีมคอนเทนต์ (น้องปากกา) เขียนผ่าน API content?action=quiz / action=article · เก็บใน shop_state id=quizzes / articles
// คุณแดนซ่อนได้จากหลังบ้าน · ทุกข้อความจากทีมผ่าน esc() ก่อนขึ้นหน้า (บทความใช้ markdown ชุดเล็กที่แปลงเองอย่างปลอดภัย)
import { TRACK_JS } from './insights.js';
import { PWA_HEAD } from './pwa.js';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const QUIZ_CATS = { grammar: 'Grammar', vocab: 'คำศัพท์', listening: 'Listening', reading: 'Reading', mock: 'ข้อสอบเสมือนจริง', ielts: 'IELTS', tgat: 'TGAT / A-Level', kp: 'สอบ ก.พ.', work: 'อังกฤษทำงาน', speak: 'สนทนา' };
export const LEARN_CATS = { grammar: 'Grammar', vocab: 'คำศัพท์', tips: 'เทคนิคทำข้อสอบ', listening: 'Listening', reading: 'Reading', ielts: 'IELTS', tgat: 'TGAT / A-Level', kp: 'สอบ ก.พ.', work: 'อังกฤษทำงาน', speak: 'สนทนา' };
// รูปปกบทความ: ต้องอยู่ในคลังรูปของร้าน (อัปโหลดผ่าน action=article_imageurl) เท่านั้น
export const LEARN_IMG_PREFIX = 'https://lpeqaorswhwzlplsaqpe.supabase.co/storage/v1/object/public/product-images/learn/';
export const cleanImg = (u) => { const s = String(u || '').trim(); return s.startsWith(LEARN_IMG_PREFIX) && /^[A-Za-z0-9._\/-]+$/.test(s.slice(LEARN_IMG_PREFIX.length)) ? s : ''; };
const CAT_ICON = { grammar: '✍️', vocab: '📚', tips: '🎯', listening: '🎧', reading: '📖', ielts: '🌏', tgat: '🎓', kp: '🏛️', work: '💼', speak: '💬' };
// ปกบทความ: มีรูปใช้รูป ไม่มีรูปทำปกสีตามหมวดพร้อมไอคอน ให้การ์ดไม่โล่ง
export const artCoverHtml = (a) => artCover(a);
function artCover(a, cls = 'acov') {
  if (a.image) return `<span class="${cls}"><img src="${esc(a.image)}" alt="" loading="lazy" decoding="async"></span>`;
  return `<span class="${cls} ph c-${esc(a.cat || 'grammar')}" aria-hidden="true"><i>${CAT_ICON[a.cat] || '💡'}</i><em>${esc(LEARN_CATS[a.cat] || 'TOEIC')}</em></span>`;
}
const FB_CHAT = 'https://m.me/1264839566720049';
const thDate = (t) => { try { return new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }); } catch (e) { return ''; } };

// ---------- ตรวจข้อมูลจากทีม ----------
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
    const text = String(q?.q || '').trim(), explain = String(q?.explain || '').trim();
    if (text.length < 5 || text.length > 400) return { error: `ข้อ ${i + 1}: โจทย์ยาว 5-400 ตัวอักษร` };
    if (explain.length < 15 || explain.length > 600) return { error: `ข้อ ${i + 1}: เฉลยอธิบาย 15-600 ตัวอักษร` };
    if (seen.has(text.toLowerCase())) return { error: `ข้อ ${i + 1}: โจทย์ซ้ำ` };
    seen.add(text.toLowerCase());
    if (q?.type === 'type') { // พิมพ์คำตอบ: ตรวจใจดี ไม่สนตัวพิมพ์ใหญ่และเครื่องหมาย
      const accept = (Array.isArray(q.accept) ? q.accept : []).map((a) => String(a || '').trim()).filter(Boolean);
      if (accept.length < 1 || accept.length > 5 || accept.some((a) => a.length < 2 || a.length > 200)) return { error: `ข้อ ${i + 1}: accept ต้องมี 1-5 คำตอบที่ถูก (ตัวแรก = แบบเขียนสมบูรณ์)` };
      questions.push({ type: 'type', q: text, accept, explain });
      continue;
    }
    const choices = Array.isArray(q?.choices) ? q.choices.map((c) => String(c || '').trim()) : [];
    const answer = Number(q?.answer);
    if (choices.length !== 4 || choices.some((c) => !c || c.length > 120) || new Set(choices.map((c) => c.toLowerCase())).size !== 4) return { error: `ข้อ ${i + 1}: ต้องมี 4 ตัวเลือกไม่ซ้ำกัน` };
    if (!Number.isInteger(answer) || answer < 0 || answer > 3) return { error: `ข้อ ${i + 1}: answer ต้องเป็น 0-3` };
    questions.push({ q: text, choices, answer, explain });
  }
  return { quiz: { slug, title, desc, cat: QUIZ_CATS[b.cat] ? b.cat : '', product_id: String(b.product_id || '').slice(0, 40), article_slug: /^[a-z0-9-]{3,70}$/.test(String(b.article_slug || '')) ? b.article_slug : '', mode: b.mode === 'level' ? 'level' : '', questions } };
}

export function cleanArticle(b) {
  const slug = String(b.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 70) return { error: 'slug ใช้ a-z 0-9 และ - เท่านั้น' };
  const title = String(b.title || '').trim();
  if (title.length < 10 || title.length > 90) return { error: 'title ยาว 10-90 ตัวอักษร' };
  const desc = String(b.desc || '').trim();
  if (desc.length < 40 || desc.length > 200) return { error: 'desc ยาว 40-200 ตัวอักษร (ใช้ในผลค้นหา Google)' };
  const body = String(b.body || '').replace(/\r/g, '').trim();
  if (body.length < 800 || body.length > 14000) return { error: 'body ยาว 800-14000 ตัวอักษร' };
  if ((body.match(/^## /gm) || []).length < 2) return { error: 'body ต้องมีหัวข้อย่อย "## " อย่างน้อย 2 หัวข้อ' };
  if (/<\s*(script|iframe|style)|javascript:/i.test(body)) return { error: 'body ห้ามมี HTML หรือสคริปต์' };
  const image = cleanImg(b.image);
  if (b.image && !image) return { error: 'image ต้องเป็นลิงก์จาก action=article_imageurl เท่านั้น' };
  return { article: { slug, title, desc, cat: LEARN_CATS[b.cat] ? b.cat : 'grammar', body, ...(image ? { image } : {}), quiz_slug: /^[a-z0-9-]{3,70}$/.test(String(b.quiz_slug || '')) ? b.quiz_slug : '', product_id: String(b.product_id || '').slice(0, 40) } };
}

// markdown ชุดเล็ก: ## ### หัวข้อ, - และ 1. รายการ, > กล่องทิป, | ตาราง |, **ตัวหนา**, `โค้ด`, ย่อหน้า
export function renderMd(src) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]{1,120})\]\(((?:https:\/\/sheetlabth\.com)?\/[a-z0-9\-\/?=&_]*)\)/gi, (m, t2, u) => `<a href="${u.replace('https://sheetlabth.com', '')}">${t2}</a>`); // ลิงก์ภายในเว็บเท่านั้น
  const out = [], toc = []; let list = null, table = null, para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.t}>${list.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${list.t}>`); list = null; } };
  const flushTable = () => { if (table) { const [h, ...rows] = table; out.push(`<div class="tbl"><table><thead><tr>${h.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); table = null; } };
  const flush = () => { flushPara(); flushList(); flushTable(); };
  for (const raw of String(src).split('\n')) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.+)/))) { flush(); const lv = m[1].length, id = 's' + (toc.length + 1); if (lv === 2) toc.push({ id, t: m[2] }); out.push(`<h${lv}${lv === 2 ? ` id="${id}"` : ''}>${inline(m[2])}</h${lv}>`); continue; }
    if ((m = line.match(/^\s*\|(.+)\|\s*$/))) { flushPara(); flushList(); const cells = m[1].split('|').map((c) => c.trim()); if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; (table = table || []).push(cells); continue; }
    if ((m = line.match(/^\s*[-•]\s+(.+)/))) { flushPara(); flushTable(); if (!list || list.t !== 'ul') { flushList(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.+)/))) { flushPara(); flushTable(); if (!list || list.t !== 'ol') { flushList(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^>\s?(.*)/))) { flush(); out.push(`<aside class="tip">${inline(m[1])}</aside>`); continue; }
    flushList(); flushTable(); para.push(line.trim());
  }
  flush();
  return { html: out.join('\n'), toc };
}

// ---------- หน้าตา ----------
const CSS = `:root{--bg:#EDF1F7;--surface:#FFFFFF;--ink:#0F1B33;--muted:#56637D;--line:#D3DBE8;--brand:#2440E8;--ok:#0F7A55;--okbg:#DDF3EA;--bad:#B42318;--badbg:#FBE1DE;--accent:#FFD23F;--tipbg:#FFF6D6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0B1220;--surface:#131C30;--ink:#EAF0FF;--muted:#9AA7C4;--line:#27334F;--brand:#8EA0FF;--ok:#5FD69B;--okbg:#133528;--bad:#FF8A7A;--badbg:#3A1A18;--tipbg:#2A2614}}
:root[data-theme="dark"]{--bg:#0B1220;--surface:#131C30;--ink:#EAF0FF;--muted:#9AA7C4;--line:#27334F;--brand:#8EA0FF;--ok:#5FD69B;--okbg:#133528;--bad:#FF8A7A;--badbg:#3A1A18;--tipbg:#2A2614}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 'IBM Plex Sans Thai','Noto Sans Thai',system-ui,sans-serif}
.hd{background:var(--surface);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}.hd-in{max-width:760px;margin:0 auto;padding:0 16px}
.hd-top{display:flex;justify-content:space-between;align-items:center;padding:10px 0 4px}.logo{font-family:'Mitr',sans-serif;font-size:22px;text-decoration:none;color:var(--brand)}.logo::before{content:'';display:inline-block;width:1.25em;height:1.25em;background:url(/icon-48.png) center/contain no-repeat;vertical-align:-.25em;margin-right:.3em}
.hd-r{display:flex;gap:12px;align-items:center}.hd-acc{font-size:14px;font-weight:600;text-decoration:none;color:var(--ink);border:1.5px solid var(--line);border-radius:999px;padding:4px 12px}.hd-acc.on{border-color:var(--brand);color:var(--brand)}
.mk-kinds{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.mk-kind{display:flex;flex-direction:column;gap:4px;border:1.5px solid var(--line);border-radius:14px;padding:12px}.mk-meta{font-weight:600;font-size:14px}.mk-kind .btn{margin-top:6px}.mk-kind .btn:disabled{opacity:.5}
.mk-bar{position:sticky;top:0;z-index:6;display:flex;gap:10px;align-items:center;justify-content:space-between;background:var(--surface);border:1.5px solid var(--line);border-radius:14px;padding:8px 12px;margin-bottom:12px;box-shadow:0 4px 14px rgba(15,27,51,.1)}#mk-t{font-size:22px;font-variant-numeric:tabular-nums}#mk-t.low{color:var(--bad)}
.ch button.sel{border-color:var(--brand);box-shadow:inset 0 0 0 1.5px var(--brand);font-weight:600}.mk-score{font-size:44px;font-weight:700;margin:4px 0;line-height:1.1}.mk-score small{font-size:20px;color:var(--muted)}.mk-wonly .mk-ok{display:none}.mk-only{display:flex;gap:6px;align-items:center;margin-top:10px}
.mk-hist div{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line)}.mk-hist div:first-child{border-top:0}
.app-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px}@media(min-width:640px){.app-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.app-t{display:flex;flex-direction:column;gap:2px;background:var(--surface);border:1.5px solid var(--line);border-radius:16px;padding:14px;text-decoration:none;color:var(--ink)}.app-t:hover{border-color:var(--brand)}.app-t i{font-style:normal;font-size:28px;line-height:1.2}.app-t b{font-size:16px}.app-t span{font-size:13px;color:var(--muted)}.app-t.lock b::after{content:' 🔒';font-size:13px}
.pwa-box{display:flex;flex-direction:column;gap:6px;border:2px dashed var(--brand)}.pwa-box[hidden]{display:none}.pwa-box .btn{align-self:flex-start}.pwa-how{font-size:14.5px}
.ac-me{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding-block:12px}.ac-ord{border-top:1px solid var(--line);padding:10px 0}.ac-ord:first-of-type{border-top:0}.ac-ord .fine{margin:0 0 6px}.ac-items{display:flex;flex-direction:column;gap:6px}.ac-dl{text-align:left;font-size:15px}
.ac-me .ghost{font:inherit;font-size:14px;font-weight:600;color:var(--ink);background:var(--bg);border:1.5px solid var(--line);border-radius:999px;padding:5px 14px;cursor:pointer}
.nav{display:flex;gap:4px;overflow-x:auto}.nav a{flex:1;text-align:center;white-space:nowrap;text-decoration:none;color:var(--muted);font-weight:600;font-size:15px;padding:8px 10px;border-bottom:3px solid transparent}.nav a.on{color:var(--brand);border-color:var(--brand)}
@media(max-width:440px){.nav{gap:0}.nav a{font-size:13.5px;padding:8px 2px;letter-spacing:-.1px}}
main{max-width:760px;margin:0 auto;padding:16px 16px 60px;display:flex;flex-direction:column;gap:14px}
a{color:var(--brand)}h1,h2,h3{font-family:'Mitr','IBM Plex Sans Thai',sans-serif;font-weight:500;line-height:1.35;margin:0;text-wrap:balance}h1{font-size:25px}h2{font-size:20px}h3{font-size:17px}
.fine{font-size:14px;color:var(--muted)}.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px}
.chip{display:inline-block;font-size:12px;font-weight:600;color:var(--brand);background:rgba(36,64,232,.1);border-radius:999px;padding:1px 9px;align-self:flex-start}
.filters{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}.filters button{font:inherit;font-size:14px;white-space:nowrap;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:5px 14px;cursor:pointer}.filters button[aria-pressed="true"]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.search{width:100%;font:inherit;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:10px 14px}
.list{display:grid;gap:10px}.item{display:flex;flex-direction:column;gap:4px;text-decoration:none;color:var(--ink)}.item b{font-size:17px;line-height:1.4}.item:hover{border-color:var(--brand)}
.meta{display:flex;gap:6px 10px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.q{display:flex;flex-direction:column;gap:10px}.qn{font-size:13px;font-weight:600;color:var(--brand)}.qt{font-weight:600;white-space:pre-line}
.ch{display:grid;gap:8px}.ch button{text-align:left;font:inherit;color:var(--ink);background:var(--bg);border:1.5px solid var(--line);border-radius:12px;padding:10px 14px;cursor:pointer}
.ch button:hover:not(:disabled){border-color:var(--brand)}.ch button:focus-visible,.filters button:focus-visible{outline:3px solid var(--brand);outline-offset:2px}
.ch button.right{background:var(--okbg);border-color:var(--ok);font-weight:600}.ch button.wrong{background:var(--badbg);border-color:var(--bad)}
.ex{display:none;border-left:3px solid var(--brand);padding:4px 0 4px 12px;font-size:15px}.done .ex{display:block}
.score{position:sticky;bottom:12px;background:var(--ink);color:var(--surface);border-radius:999px;padding:8px 16px;align-self:center;font-weight:600;box-shadow:0 6px 20px rgba(15,27,51,.25)}
.cta{display:grid;grid-template-columns:88px minmax(0,1fr);gap:14px;align-items:center;text-decoration:none;color:var(--ink);border:2px solid var(--brand)}
.cta img{width:88px;height:88px;object-fit:contain;border-radius:10px;background:#fff}.cta b{font-size:16px}.btn{display:inline-block;background:var(--accent);color:#0F1B33;font-weight:700;border-radius:12px;padding:9px 16px;text-decoration:none;margin-top:6px}
.art h2{margin:26px 0 8px;scroll-margin-top:110px}.art h3{margin:18px 0 6px}.art p{margin:0 0 12px}.art ul,.art ol{margin:0 0 12px;padding-left:22px}.art li{margin:4px 0}
.art code{background:var(--bg);border-radius:6px;padding:1px 6px;font-size:.92em}
.tip{background:var(--tipbg);border-radius:12px;padding:10px 14px;margin:0 0 12px}
.tbl{overflow-x:auto;margin:0 0 12px}table{border-collapse:collapse;width:100%;font-size:15px}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}th{background:var(--bg)}
.kind-note{margin:10px 0 0;font-size:14px;background:var(--bg);border-radius:10px;padding:8px 12px}
.ty{display:flex;gap:8px}.ty input{flex:1;min-width:0;font:inherit;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);border-radius:12px;padding:10px 12px}.ty button{font:inherit;font-weight:600;border:0;border-radius:12px;padding:10px 14px;background:var(--ink);color:var(--surface);cursor:pointer}.ty button:disabled,.ty input:disabled{opacity:.6}
.res{font-size:15px;font-weight:600}.res.ok{color:var(--ok)}.res.no{color:var(--bad)}
.share{border:2px solid var(--accent)}.sharebtns{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.sharebtns a,.sharebtns button{font:inherit;font-size:14px;font-weight:600;text-align:center;text-decoration:none;border-radius:10px;padding:9px 4px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer}@media(max-width:380px){.sharebtns{grid-template-columns:1fr 1fr}}
.toc ol{margin:6px 0 0;padding-left:20px}.toc a{text-decoration:none}
.acov{display:block;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:var(--bg);margin:0 0 6px}.acov img{width:100%;height:100%;object-fit:cover;display:block}
.acov.ph{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff}.acov.ph i{font-style:normal;font-size:44px;line-height:1}.acov.ph em{font-style:normal;font-weight:600;font-size:14px;letter-spacing:.3px;opacity:.95}
.c-grammar{background:linear-gradient(135deg,#1E5EFF,#5B8CFF)}.c-vocab{background:linear-gradient(135deg,#0E9F6E,#34C38F)}.c-tips{background:linear-gradient(135deg,#E8590C,#FF922B)}.c-listening{background:linear-gradient(135deg,#7048E8,#9775FA)}.c-reading{background:linear-gradient(135deg,#0B7285,#22B8CF)}.c-ielts{background:linear-gradient(135deg,#C2255C,#F06595)}.c-tgat{background:linear-gradient(135deg,#5F3DC4,#845EF7)}.c-kp{background:linear-gradient(135deg,#2B8A3E,#51CF66)}.c-work{background:linear-gradient(135deg,#1864AB,#4DABF7)}.c-speak{background:linear-gradient(135deg,#D9480F,#FFA94D)}
.ahero{aspect-ratio:16/9;margin:4px 0 14px}
.agrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.agrid .item{padding:12px}
.more{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;align-items:center}
.tgo{color:var(--brand);font-weight:600;font-size:14px}
.thero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:18px;align-items:center;background:linear-gradient(135deg,#EEF2FF,#fff 60%)}.thero h1{margin:6px 0 8px}.thero-txt{grid-row:1;grid-column:1}.thero-txt p{margin:0 0 8px}.thero-stats{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:14px;color:var(--muted)}.thero-stats b{color:var(--brand);font-size:18px}
.thero-ban{grid-row:1;grid-column:2;display:block;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#E8EEFF}.thero-ban img{width:100%;height:100%;object-fit:cover;display:block}
@media(max-width:640px){.thero{grid-template-columns:1fr;padding:0;overflow:hidden;gap:0}.thero-ban{grid-column:1;border-radius:0}.thero-txt{grid-row:2;padding:14px 16px 16px}}
.alist{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-top:10px}
.acard{display:flex;flex-direction:column;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:box-shadow .15s,transform .15s}.acard:hover{box-shadow:0 8px 22px rgba(15,27,51,.12);transform:translateY(-2px)}
.acard .acov{margin:0;border-radius:0}.acard-b{display:flex;flex-direction:column;gap:5px;padding:10px 12px 12px;flex:1}.acard-m{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}.acard-m .chip{margin:0}
.acard b{font-size:16px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.acard-d{font-size:14px;color:var(--muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.acard .tgo{margin-top:auto;padding-top:2px}
@media(max-width:640px){.alist{grid-template-columns:1fr;gap:10px}.acard:not(:first-child){display:grid;grid-template-columns:116px minmax(0,1fr);gap:10px;padding:8px;align-items:start}.acard:not(:first-child) .acov{border-radius:10px;aspect-ratio:4/3}.acard:not(:first-child) .acard-b{padding:0;gap:3px}.acard:not(:first-child) .acard-d{display:none}.acard:not(:first-child) b{font-size:15px}.acard:not(:first-child) .acov.ph i{font-size:26px}.acard:not(:first-child) .acov.ph em{display:none}}
.tother{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.tother a{text-decoration:none;color:var(--ink);display:flex;flex-direction:column;gap:5px}.tother .acov{margin:0;border-radius:10px}.tother b{font-size:14.5px}
@media(max-width:640px){.tother{grid-template-columns:1fr 1fr}}
.tprod{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}.tcard{border:1px solid var(--line);border-radius:12px;padding:8px;background:var(--surface)}.tcard .acov{aspect-ratio:1/1;margin:0 0 6px}.tcard b{font-size:14.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.tprice{font-weight:700;color:#EE4D2D;font-size:17px}.more .acov{margin:0;border-radius:10px}.more .acov.ph i{font-size:26px}.more .acov.ph em{display:none}
footer{text-align:center;font-size:13px;color:var(--muted);padding-top:10px}
.fr-hero{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:18px;align-items:start}.fr-hero h1{margin:6px 0 6px}.fr-cover{width:100%;height:auto;border-radius:12px;box-shadow:0 10px 26px rgba(15,27,51,.18)}.fr-pts{margin:8px 0 12px;padding-left:20px}.fr-pts li{margin:3px 0}.fr-form{margin-top:4px}.fr-fb{background:#1877F2!important;color:#fff!important}.fr-pv{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fr-pv img{width:100%;height:auto;border-radius:10px;border:1px solid var(--line)}
@media(max-width:640px){.fr-hero{grid-template-columns:1fr}.fr-cover{max-width:220px;margin:0 auto;display:block}}
.adm-bar{position:sticky;top:0;z-index:30;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 16px;background:#0F1B33;color:#fff;font-size:13px}.adm-bar nav{display:flex;gap:4px;flex-wrap:wrap}.adm-bar a{color:#fff;text-decoration:none;font-weight:600;padding:4px 10px;border-radius:8px;background:rgba(255,255,255,.12)}.adm-bar a:hover{background:rgba(255,255,255,.25)}
.vp-hero h1{margin:6px 0 4px}.vp-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.vp-plan{display:flex;flex-direction:column;gap:6px;border:1.5px solid var(--line);border-radius:14px;padding:14px}.vp-best{border-color:var(--brand)}.vp-price{font-size:26px;font-weight:700;color:var(--brand)}.vp-price small{font-size:14px;color:var(--muted);font-weight:500}.vp-plan .btn{align-self:flex-start}
.vp-packs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.vp-pack{font:inherit;display:flex;flex-direction:column;gap:2px;align-items:center;border:1.5px solid var(--line);border-radius:12px;background:var(--surface);padding:10px 6px;cursor:pointer;color:var(--ink)}.vp-pack:hover{border-color:var(--brand)}.vp-pack span{font-weight:700;color:var(--brand)}
.vp-form{display:flex;gap:8px;flex-wrap:wrap}.vp-form input{flex:1;min-width:200px;font:inherit;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--bg);color:var(--ink)}.vp-form button,.vp-act button{font:inherit;font-weight:600;border:0;border-radius:12px;padding:10px 16px;background:var(--brand);color:#fff;cursor:pointer}.vp-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.vp-act .ghost{background:var(--bg);color:var(--ink);border:1.5px solid var(--line)}
.vp-pv{margin:0 0 10px;padding:8px 12px;border-radius:10px;background:#FFF4D6;font-size:14px;font-weight:600}#vp-qr{text-align:center;margin-top:12px}#vp-qr img{width:240px;max-width:100%;border-radius:12px;background:#fff}.vp-ok{background:var(--okbg);border-radius:12px;padding:10px 14px}`;

// เมนูหลักของทุกหน้า (หน้าร้านในแอปใช้ชุดเดียวกัน: stHead ใน src/index.html · ชุดตรวจเช็คให้ว่าตรงกัน)
export const SITE_NAV = [['home', '/', 'หน้าแรก'], ['store', '/store', 'ร้านชีท'], ['quiz', '/quiz', 'ข้อสอบฟรี'], ['learn', '/learn', 'ความรู้'], ['vip', '/vip', '👑 VIP']];
export function shell({ title, desc, canonical, body, ld, pixelId, noindex, tab, image }) {
  const pixel = /^\d{6,20}$/.test(String(pixelId || '')) ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');</script>` : '';
  const lds = (Array.isArray(ld) ? ld : ld ? [ld] : []).map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('');
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#2440E8">${PWA_HEAD}
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}">${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">${image ? `<meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600&family=Mitr:wght@500&display=swap" rel="stylesheet">
<style>${CSS}</style>${lds}${pixel}<script>(function(){try{var p=location.pathname.replace(/^\/|\/$/g,''),k=p==='quiz/daily'?'daily':p;if(!/^(quiz|learn|topic)(\\/[a-z0-9-]+)?$|^daily$/.test(k)||localStorage.getItem('sb-lpeqaorswhwzlplsaqpe-auth-token'))return;var d=new Date(Date.now()+252e5).toISOString().slice(0,10),key='hit:'+d+':'+k;if(localStorage.getItem(key))return;localStorage.setItem(key,'1');fetch('/api/content?action=hit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({s:k}),keepalive:true}).catch(function(){});}catch(e){}})();</script></head><body>
<script>(function(){try{var t=JSON.parse(localStorage.getItem('sb-lpeqaorswhwzlplsaqpe-auth-token')||'null');var e=t&&t.user&&t.user.email;if(!e||window.top!==window)return;var b=document.createElement('div');b.className='adm-bar';b.innerHTML='<span>หลังบ้าน · '+String(e).replace(/[<>&"]/g,'')+'</span><nav><a href="/">หน้าร้าน</a><a href="/store">ร้านค้า</a><a href="/#admin">หลังบ้าน</a><a href="/#factory">โรงงาน</a><a href="/#vip">👑 สมาชิก</a></nav>';document.addEventListener('DOMContentLoaded',function(){document.body.insertBefore(b,document.body.firstChild);});}catch(x){}})();</script>
<header class="hd"><div class="hd-in"><div class="hd-top"><a class="logo" href="/">SheetLab</a><span class="hd-r"><a class="hd-acc${tab === 'account' ? ' on' : ''}" href="/account">👤 บัญชีของฉัน</a><a class="fine" href="${FB_CHAT}" target="_blank" rel="noopener noreferrer">ทักแชท</a></span></div>
<nav class="nav" aria-label="เมนูหลัก">${SITE_NAV.map(([k, href, l]) => `<a href="${href}"${tab === k ? ' class="on" aria-current="page"' : ''}>${l}</a>`).join('')}</nav></div></header>
<main>
${body}
<footer>SheetLab · <a href="/">ชีทสรุป TOEIC</a> · <a href="/quiz">คลังข้อสอบ</a> · <a href="/learn">คลังความรู้</a> · <a href="/topic/toeic">TOEIC ครบทุกเรื่อง</a> · <a href="/topic/toeic-grammar">Grammar TOEIC</a> · <a href="/free">🎁 ชีทแจกฟรี</a> · <a href="/vip">สมาชิก VIP</a> · <a href="/app">📲 แอปฝึกข้อสอบ</a> · <a href="/account">บัญชีของฉัน</a> · <a href="/privacy">นโยบายความเป็นส่วนตัว</a><br>เนื้อหาและแบบทดสอบจัดทำขึ้นใหม่เพื่อการฝึก ไม่ใช่ข้อสอบจริง · TOEIC เป็นเครื่องหมายการค้าจดทะเบียนของ ETS ร้านไม่มีส่วนเกี่ยวข้องหรือได้รับการรับรองจาก ETS</footer>
</main>${TRACK_JS}</body></html>`;
}

function productCard(p, campaign) {
  if (!p) return '';
  const img = (p.images || [])[0];
  return `<a class="card cta" href="/p/${esc(p.slug)}?utm_campaign=${campaign}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span></span>'}<span><span class="fine">อยากฝึกให้ครบทุกจุดที่ออกสอบ</span><br><b>${esc(p.name)}</b><br>${Number(p.price) >= 1 ? `<strong>฿${Number(p.price).toLocaleString('th-TH')}</strong> ` : ''}<span class="btn">ดูตัวอย่างในเล่ม →</span></span></a>`;
}
const pickProduct = (products, id) => { const live = products.filter((p) => p.status === 'published' && p.sell !== 'salepage'); return live.find((p) => p.id === id) || live.find((p) => p.type !== 'bundle') || live[0] || products.find((p) => p.status === 'published'); };

// ตัวกรองหมวด + ค้นหาในหน้ารวม (ทำงานในเบราว์เซอร์ ไม่ต้องโหลดใหม่)
function filterUI(cats, items, placeholder) {
  const used = Object.keys(cats).filter((k) => items.some((x) => x.cat === k));
  return `<input class="search" id="fs" type="search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}">
${used.length > 1 ? `<div class="filters" role="group" aria-label="กรองตามหมวด"><button type="button" data-c="" aria-pressed="true">ทั้งหมด ${items.length}</button>${used.map((k) => `<button type="button" data-c="${k}" aria-pressed="false">${esc(cats[k])} ${items.filter((x) => x.cat === k).length}</button>`).join('')}</div>` : ''}
<script>(function(){var c='',q='',s=document.getElementById('fs');function run(){var n=0;document.querySelectorAll('[data-cat]').forEach(function(e){var ok=(!c||e.dataset.cat===c)&&(!q||e.textContent.toLowerCase().indexOf(q)>=0);e.hidden=!ok;if(ok)n++;});var z=document.getElementById('fz');if(z)z.hidden=n>0;}s.addEventListener('input',function(){q=s.value.trim().toLowerCase();run();});document.querySelectorAll('.filters button').forEach(function(b){b.addEventListener('click',function(){c=b.dataset.c;document.querySelectorAll('.filters button').forEach(function(x){x.setAttribute('aria-pressed',x===b);});run();});});})();</script>`;
}

// ---------- คลังข้อสอบ ----------
const L4 = 'ABCD';
function qBlock(x, i) {
  if (x.type === 'type') return `<section class="card q" data-type="1" data-acc="${esc(JSON.stringify(x.accept))}"><span class="qn">ข้อ ${i + 1} · พิมพ์คำตอบ</span><div class="qt">${esc(x.q)}</div><div class="ty"><input type="text" autocomplete="off" spellcheck="false" aria-label="คำตอบข้อ ${i + 1}" placeholder="พิมพ์คำตอบที่นี่"><button type="button">ตรวจคำตอบ</button></div><div class="res" aria-live="polite"></div><div class="ex"><b>เฉลย</b> ${esc(x.accept[0])}<br>${esc(x.explain)}</div></section>`;
  return `<section class="card q" data-a="${x.answer}"><span class="qn">ข้อ ${i + 1}</span><div class="qt">${esc(x.q)}</div><div class="ch">${x.choices.map((c, k) => `<button type="button" data-k="${k}">(${L4[k]}) ${esc(c)}</button>`).join('')}</div><div class="ex"><b>เฉลย (${L4[x.answer]}) ${esc(x.choices[x.answer])}</b><br>${esc(x.explain)}</div></section>`;
}
// ตรวจคำตอบในเบราว์เซอร์ (ทั้งแบบเลือกและแบบพิมพ์) + การ์ดแชร์ + ระดับโดยประมาณของแบบทดสอบวัดระดับ
const QUIZ_JS = `<script>(function(){var qs=document.querySelectorAll('.q'),t=qs.length,n=0,r=0,s=document.getElementById('score'),md=document.getElementById('qmode'),level=md&&md.dataset.mode==='level';
function nm(x){return String(x).toLowerCase().replace(/[’‘\`]/g,"'").replace(/[^a-z0-9' ]+/g,' ').replace(/\\s+/g,' ').trim();}
var vip=0,slug=location.pathname.split('/').pop();fetch('/api/order?m=vip_me',{credentials:'same-origin'}).then(function(x){return x.json();}).then(function(j){vip=j.active?1:0;window.__vipOpen=j.settings&&j.settings.open;}).catch(function(){});
function fin(ok,sec){if(window.slTrack)slTrack('quiz',slug+':'+Array.prototype.indexOf.call(qs,sec),ok?1:0);if(vip)fetch('/api/order?m=vip_mark',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quiz:slug,q:Array.prototype.indexOf.call(qs,sec),ok:ok}),credentials:'same-origin'}).catch(function(){});n++;if(ok)r++;sec.classList.add('done');if(s)s.textContent=n<t?'ตอบแล้ว '+n+'/'+t+' · ถูก '+r:'ได้ '+r+'/'+t+' คะแนน';if(n===t)done();}
qs.forEach(function(sec){
 if(sec.dataset.type){var inp=sec.querySelector('input'),btn=sec.querySelector('.ty button'),res=sec.querySelector('.res'),acc=JSON.parse(sec.dataset.acc);
  var check=function(){if(sec.classList.contains('done')||!inp.value.trim())return;var u=inp.value.trim(),ok=acc.some(function(a){return nm(a)===nm(u);});inp.disabled=btn.disabled=true;
   if(ok){res.className='res ok';res.textContent=u===acc[0]?'ถูกต้อง ✓':'ถูกต้อง ✓ ไม่หักคะแนนเพราะตัวพิมพ์ใหญ่หรือเครื่องหมาย แต่ข้อเขียนจริงควรเขียนตามเฉลยด้านล่าง';}
   else{var cw=nm(acc[0]).split(' '),uw=nm(u).split(' '),miss=cw.filter(function(w){return uw.indexOf(w)<0;}),extra=uw.filter(function(w){return w&&cw.indexOf(w)<0;});res.className='res no';res.textContent='ยังไม่ถูก'+(extra.length?' · คำที่ต้องแก้: '+extra.join(', '):'')+(miss.length?' · ควรใช้: '+miss.join(', '):'');}
   fin(ok,sec);};
  btn.addEventListener('click',check);inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();check();}});
 }else{var a=+sec.dataset.a;sec.querySelectorAll('.ch button').forEach(function(b){b.addEventListener('click',function(){if(sec.classList.contains('done'))return;var k=+b.dataset.k,bs=sec.querySelectorAll('.ch button');if(k!==a)b.classList.add('wrong');bs[a].classList.add('right');bs.forEach(function(x){x.disabled=true;});fin(k===a,sec);});});}
});
function done(){if(window.slTrack)slTrack('quizdone',slug,Math.round(r/t*100));var p=r/t,band=p>=.75?['ระดับดี','พื้นฐานแน่นแล้ว เหลือเก็บจุดหลอกและทำข้อสอบให้ทันเวลา ลองทำแบบทดสอบในคลังข้อสอบให้ครบทุกหมวด']:p>=.4?['ระดับกลาง','รู้หลักแต่ยังพลาดจุดที่ออกบ่อย เริ่มจากบทความ Grammar ในคลังความรู้ แล้วทำแบบทดสอบของแต่ละเรื่อง']:['ระดับเริ่มต้น','เริ่มจากพื้นฐาน Tense และรูปคำก่อน อ่านบทความในคลังความรู้ทีละเรื่องแล้วค่อยทำแบบทดสอบ'];
 var u=location.origin+location.pathname,head=level?band[0]+' ('+r+'/'+t+')':'ได้ '+r+'/'+t+' คะแนน',m=level?'ฉันวัดระดับ TOEIC ได้ '+band[0]+' ('+r+'/'+t+') ลองวัดของตัวเองดูไหม':'ฉันทำ '+document.title.split(' | ')[0]+' ได้ '+r+'/'+t+' คะแนน ลองทำดูไหม';
 if(s)s.textContent=head;document.getElementById('sharet').textContent=head;var st=document.getElementById('sharesub');if(st)st.textContent=level?band[1]+' · ผลนี้ประเมินคร่าวๆ ไม่ใช่คะแนน TOEIC จริง':'ชวนเพื่อนมาลองทำ แล้วดูว่าใครได้คะแนนมากกว่า';
 document.getElementById('shl').href='https://social-plugins.line.me/lineit/share?url='+encodeURIComponent(u)+'&text='+encodeURIComponent(m);document.getElementById('shf').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(u);document.getElementById('sht').href='https://www.threads.net/intent/post?text='+encodeURIComponent(m+' '+u);
 var c=document.getElementById('shc');c.onclick=function(){if(navigator.clipboard)navigator.clipboard.writeText(m+' '+u).then(function(){c.textContent='คัดลอกแล้ว';},function(){prompt('คัดลอกลิงก์',u);});else prompt('คัดลอกลิงก์',u);};
 var vn=document.getElementById('vipnote');if(vn&&r<t&&(vip||window.__vipOpen)){vn.hidden=false;vn.innerHTML=vip?'📒 บันทึกข้อที่ผิดลงสมุดจุดพลาดแล้ว <a href="/vip/review">ทวนเลย →</a>':'📒 สมาชิก VIP: ระบบเก็บข้อที่ผิดไว้ให้ทวนอัตโนมัติ <a href="/vip">ดูรายละเอียด →</a>';}
 var sh=document.getElementById('share');sh.hidden=false;sh.scrollIntoView({behavior:'smooth',block:'center'});}
})();</script>`;

export function quizPage(q, { products = [], settings = {}, site = '', others = [], article = null } = {}) {
  const prod = pickProduct(products, q.product_id);
  const url = `${site}/quiz/${q.slug}`;
  const ld = { '@context': 'https://schema.org', '@type': 'Quiz', name: q.title, description: q.desc, url, inLanguage: 'th', educationalLevel: 'TOEIC', about: { '@type': 'Thing', name: 'TOEIC ' + (QUIZ_CATS[q.cat] || 'English') },
    hasPart: q.questions.map((x, i) => x.type === 'type'
      ? { '@type': 'Question', eduQuestionType: 'Short answer', position: i + 1, text: x.q, acceptedAnswer: { '@type': 'Answer', text: x.accept[0], answerExplanation: { '@type': 'Comment', text: x.explain } } }
      : { '@type': 'Question', eduQuestionType: 'Multiple choice', position: i + 1, text: x.q,
        acceptedAnswer: { '@type': 'Answer', text: x.choices[x.answer], answerExplanation: { '@type': 'Comment', text: x.explain } },
        suggestedAnswer: x.choices.filter((_, k) => k !== x.answer).map((c) => ({ '@type': 'Answer', text: c })) }) };
  const L = 'ABCD';
  const body = `<header class="card"><span class="chip">คลังข้อสอบ${q.cat && QUIZ_CATS[q.cat] ? ' · ' + QUIZ_CATS[q.cat] : ''}</span><h1 style="margin-top:6px">${esc(q.title)}</h1><p class="fine" style="margin:6px 0 0">${esc(q.desc)}</p><div class="meta" style="margin-top:6px"><span>${q.questions.length} ข้อ</span><span>ใช้เวลาประมาณ ${Math.max(3, Math.round(q.questions.length * 0.6))} นาที</span><span>เฉลยทันทีทุกข้อ</span></div>
${q.questions.some((x) => x.type === 'type') ? '<p class="kind-note">✍️ พิมพ์คำตอบเอง ตรวจใจดี: ไม่หักคะแนนเพราะตัวพิมพ์ใหญ่ เล็ก หรือเครื่องหมาย แต่บอกให้รู้ว่าข้อเขียนจริงควรเขียนแบบไหน</p>' : ''}
${q.mode === 'level' ? '<p class="kind-note">ทำครบแล้วจะได้ระดับโดยประมาณและคำแนะนำว่าควรเริ่มฝึกตรงไหน ผลนี้เป็นการประเมินคร่าวๆ ไม่ใช่คะแนน TOEIC จริง</p><div id="qmode" data-mode="level" hidden></div>' : ''}
${article ? `<p style="margin:10px 0 0">📖 อยากทบทวนก่อนทำ? <a href="/learn/${esc(article.slug)}">${esc(article.title)}</a></p>` : ''}</header>
${q.questions.map((x, i) => qBlock(x, i)).join('\n')}
<div class="score" id="score" aria-live="polite">ตอบแล้ว 0/${q.questions.length}</div>
<section class="card share" id="share" hidden><b id="sharet">ทำครบแล้ว</b><p class="fine" id="sharesub" style="margin:4px 0 10px">ชวนเพื่อนมาลองทำ แล้วดูว่าใครได้คะแนนมากกว่า</p><div class="sharebtns"><a id="shl" target="_blank" rel="noopener noreferrer">LINE</a><a id="shf" target="_blank" rel="noopener noreferrer">Facebook</a><a id="sht" target="_blank" rel="noopener noreferrer">Threads</a><button type="button" id="shc">คัดลอกลิงก์</button></div><p class="kind-note" id="vipnote" hidden></p></section>
${productCard(prod, 'quiz')}
${others.length ? `<section class="card"><h2>แบบทดสอบอื่นในคลัง</h2><div class="list" style="margin-top:8px">${others.slice(0, 5).map((o) => `<a class="item" href="/quiz/${esc(o.slug)}"><b>${esc(o.title)}</b><span class="fine">${o.questions.length} ข้อ</span></a>`).join('')}</div></section>` : ''}
${QUIZ_JS}`;
  return shell({ title: `${q.title} | คลังข้อสอบ TOEIC ฟรี · SheetLab`, desc: q.desc, canonical: url, body, ld, pixelId: settings.pixelId, tab: 'quiz' });
}

// ข้อสอบประจำวัน: เลือก 1 ข้อแบบตัวเลือกจากทุกชุดตามวันที่ (เวลาไทย) ไม่ใช้ AI
export function dailyPick(list, now = Date.now()) {
  const pool = [];
  for (const qz of list.slice().sort((a, b) => a.slug.localeCompare(b.slug))) if (qz.mode !== 'level') qz.questions.forEach((x, i) => { if (x.type !== 'type') pool.push({ quiz: qz, x, i }); });
  if (!pool.length) return null;
  const day = Math.floor((now + 7 * 3600e3) / 864e5);
  return pool[(day * 7919) % pool.length];
}
export function dailyPage(pick, { settings = {}, site = '' } = {}) {
  const today = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Bangkok' });
  const body = pick ? `<header class="card"><span class="chip">ข้อสอบประจำวัน</span><h1 style="margin-top:6px">ข้อสอบ TOEIC ประจำวัน${esc(today)}</h1><p class="fine" style="margin:6px 0 0">วันละ 1 ข้อ ใช้เวลาไม่ถึงนาที กลับมาพรุ่งนี้มีข้อใหม่</p></header>
${qBlock(pick.x, 0).replace('ข้อ 1', 'ข้อวันนี้')}
<div class="score" id="score" aria-live="polite">เลือกคำตอบได้เลย</div>
<section class="card share" id="share" hidden><b id="sharet">ทำแล้ว</b><p class="fine" id="sharesub" style="margin:4px 0 10px"></p><div class="sharebtns"><a id="shl" target="_blank" rel="noopener noreferrer">LINE</a><a id="shf" target="_blank" rel="noopener noreferrer">Facebook</a><a id="sht" target="_blank" rel="noopener noreferrer">Threads</a><button type="button" id="shc">คัดลอกลิงก์</button></div></section>
<a class="card item" href="/quiz/${esc(pick.quiz.slug)}" style="border:2px solid var(--brand)"><span class="chip">ทำต่อทั้งชุด</span><b>${esc(pick.quiz.title)}</b><span class="fine">${pick.quiz.questions.length} ข้อ เฉลยทันที →</span></a>
${QUIZ_JS}` : '<p class="card">ข้อสอบประจำวันกำลังมา</p>';
  return shell({ title: 'ข้อสอบ TOEIC ประจำวัน · SheetLab', desc: 'ข้อสอบ TOEIC วันละ 1 ข้อ พร้อมเฉลยภาษาไทย ทำได้ไม่ถึงนาที', canonical: `${site}/quiz/daily`, body, pixelId: settings.pixelId, noindex: true, tab: 'quiz' });
}

export function quizIndex(list, { settings = {}, site = '' } = {}) {
  const body = `<header class="card"><h1>คลังข้อสอบภาษาอังกฤษฟรี</h1><p class="fine" style="margin:6px 0 0">ฝึกทำโจทย์แนว TOEIC IELTS TGAT และสอบ ก.พ. พร้อมเฉลยอธิบายภาษาไทย กดเลือกคำตอบแล้วรู้ผลทันที ไม่ต้องสมัครสมาชิก มีชุดใหม่ทุกสัปดาห์</p></header>
${list.length ? `<div class="list">${list.filter((q) => q.mode === 'level').map((q) => `<a class="card item" href="/quiz/${esc(q.slug)}" style="border:2px solid var(--brand)"><span class="chip">เริ่มที่นี่</span><b>${esc(q.title)}</b><span class="fine">${esc(q.desc)}</span></a>`).join('')}<a class="card item" href="/quiz/daily"><span class="chip">วันละ 1 ข้อ</span><b>ข้อสอบ TOEIC ประจำวัน</b><span class="fine">ข้อใหม่ทุกวัน ใช้เวลาไม่ถึงนาที</span></a></div>
${filterUI(QUIZ_CATS, list, 'ค้นหาแบบทดสอบ เช่น tense, คำศัพท์')}
<div class="list">${list.map((q) => `<a class="card item" href="/quiz/${esc(q.slug)}" data-cat="${esc(q.cat)}"><span class="chip">${esc(QUIZ_CATS[q.cat] || 'TOEIC')}</span><b>${esc(q.title)}</b><span class="fine">${esc(q.desc)}</span><span class="meta"><span>${q.questions.length} ข้อ</span><span>${thDate(q.updated_at || q.created_at)}</span></span></a>`).join('')}</div><p class="card fine" id="fz" hidden>ไม่พบแบบทดสอบที่ค้นหา</p>` : '<p class="card">แบบทดสอบชุดแรกกำลังมา</p>'}`;
  return shell({ title: 'คลังข้อสอบภาษาอังกฤษฟรี TOEIC IELTS TGAT ก.พ. พร้อมเฉลย · SheetLab', desc: 'รวมแบบทดสอบภาษาอังกฤษฟรี TOEIC IELTS TGAT และสอบ ก.พ. Grammar คำศัพท์ Reading พร้อมเฉลยอธิบายภาษาไทย ทำได้ทันทีบนมือถือ มีชุดใหม่ทุกสัปดาห์', canonical: `${site}/quiz`, body, pixelId: settings.pixelId, noindex: !list.length, tab: 'quiz' });
}

// ---------- คลังความรู้ ----------
export function articlePage(a, { products = [], settings = {}, site = '', others = [], quiz = null } = {}) {
  const prod = pickProduct(products, a.product_id);
  const url = `${site}/learn/${a.slug}`;
  const { html, toc } = renderMd(a.body);
  const mins = Math.max(2, Math.round(a.body.length / 900));
  const faq = []; { const m = String(a.body).split(/\n##\s+คำถามที่พบบ่อย[^\n]*\n/)[1]; if (m) { const part = m.split(/\n##\s/)[0]; for (const blk of ('\n' + part).split(/\n###\s+/).slice(1)) { const [q, ...rest] = blk.split('\n'); const ans = rest.join(' ').replace(/\*\*|`/g, '').trim(); if (q.trim() && ans) faq.push({ '@type': 'Question', name: q.trim(), acceptedAnswer: { '@type': 'Answer', text: ans.slice(0, 600) } }); } } }
  const ld = [...(faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.slice(0, 8) }] : []), { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.desc, inLanguage: 'th', url, mainEntityOfPage: url, datePublished: a.created_at, dateModified: a.updated_at || a.created_at,
    ...(a.image ? { image: a.image } : {}), author: { '@type': 'Organization', name: 'ทีม SheetLab' }, publisher: { '@type': 'Organization', name: 'SheetLab', url: site } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'คลังความรู้', item: `${site}/learn` }, { '@type': 'ListItem', position: 2, name: a.title, item: url }] }];
  const quizBox = quiz ? `<a class="card item" href="/quiz/${esc(quiz.slug)}" style="border:2px solid var(--brand)"><span class="chip">ลองทำแบบทดสอบ</span><b>${esc(quiz.title)}</b><span class="fine">${quiz.questions.length} ข้อ เฉลยทันที เช็คว่าเข้าใจจริงไหม →</span></a>` : '';
  const body = `<article class="card art"><span class="chip">คลังความรู้ · ${esc(LEARN_CATS[a.cat] || 'TOEIC')}</span><h1 style="margin-top:6px">${esc(a.title)}</h1>
<div class="meta" style="margin:6px 0 12px"><span>อ่าน ${mins} นาที</span><span>อัปเดต ${thDate(a.updated_at || a.created_at)}</span><span>โดยทีม SheetLab</span></div>
${a.image ? `<span class="acov ahero"><img src="${esc(a.image)}" alt="${esc(a.title)}" fetchpriority="high"></span>` : ''}
<p style="font-size:17px">${esc(a.desc)}</p>
${toc.length >= 3 ? `<nav class="toc" style="background:var(--bg);border-radius:12px;padding:10px 14px;margin:0 0 12px" aria-label="สารบัญ"><b>ในบทความนี้</b><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.t)}</a></li>`).join('')}</ol></nav>` : ''}
${html}</article>
${quizBox}
${productCard(prod, 'learn')}
${others.length ? `<section class="card"><h2>อ่านต่อ</h2><div class="list" style="margin-top:8px">${others.slice(0, 5).map((o) => `<a class="item more" href="/learn/${esc(o.slug)}">${artCover(o)}<span><b>${esc(o.title)}</b><br><span class="fine">${esc(o.desc)}</span></span></a>`).join('')}</div></section>` : ''}`;
  return shell({ title: `${a.title} · SheetLab`, desc: a.desc, canonical: url, body, ld, pixelId: settings.pixelId, tab: 'learn', image: a.image });
}

export function articleIndex(list, { settings = {}, site = '' } = {}) {
  const body = `<header class="card"><h1>คลังความรู้ภาษาอังกฤษ</h1><p class="fine" style="margin:6px 0 0">สรุป Grammar คำศัพท์ และเทคนิคทำข้อสอบ TOEIC IELTS TGAT สอบ ก.พ. และภาษาอังกฤษใช้ในงาน อ่านง่ายบนมือถือ ทุกบทความมีแบบทดสอบให้ลองทำต่อ</p></header>
${list.length ? `${filterUI(LEARN_CATS, list, 'ค้นหาบทความ เช่น tense, preposition')}
<div class="list agrid">${list.map((a) => `<a class="card item" href="/learn/${esc(a.slug)}" data-cat="${esc(a.cat)}">${artCover(a)}<span class="chip">${esc(LEARN_CATS[a.cat] || 'TOEIC')}</span><b>${esc(a.title)}</b><span class="fine">${esc(a.desc)}</span><span class="meta"><span>อ่าน ${Math.max(2, Math.round(a.body.length / 900))} นาที</span><span>${thDate(a.updated_at || a.created_at)}</span></span></a>`).join('')}</div><p class="card fine" id="fz" hidden>ไม่พบบทความที่ค้นหา</p>` : '<p class="card">บทความแรกกำลังมา</p>'}`;
  return shell({ title: 'คลังความรู้ภาษาอังกฤษ TOEIC IELTS สอบ ก.พ. สรุป Grammar คำศัพท์ เทคนิคทำข้อสอบ · SheetLab', desc: 'สรุปความรู้ภาษาอังกฤษ TOEIC IELTS TGAT สอบ ก.พ. ภาษาไทย Grammar คำศัพท์ และเทคนิคทำข้อสอบ อ่านง่าย พร้อมแบบทดสอบฟรีทุกบทความ', canonical: `${site}/learn`, body, pixelId: settings.pixelId, noindex: !list.length, tab: 'learn' });
}
