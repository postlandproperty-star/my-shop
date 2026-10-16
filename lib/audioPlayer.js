// 🎧 หน้าเล่นเสียงประกอบหนังสือ /audio/<SKU> (คุณแดน 12 ต.ค. 69: "ลูกค้าไม่ต้องไปกดค้นหาเอง ทำเว็บเล่นเสียงตามบท")
// ลูกค้าสแกน QR ในเล่ม → หน้านี้ แบ่งตามบท กดฟังได้ทันที เล่นต่อเนื่อง ปรับความเร็ว ฟังซ้ำ จำตำแหน่งล่าสุด ควบคุมจากหน้าจอล็อกได้
// ไฟล์เสียงเก็บที่ Cloudflare R2 (book.base) · รายชื่อแทร็กอยู่ใน shop_state id=audio_lib {books: {SKU: {title, cover, base, chapters, tracks}}}
// ?t=12 = เริ่มที่แทร็กที่ 12 · ?ch=3 = เริ่มบทที่ 3 (QR รายบทในเล่ม)
import { shell } from './quiz.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SPEED_TH = { slow: 'ช้า 🐢', normal: 'ความเร็วปกติ', fast: 'เร็ว' };

// ชื่อไฟล์จากโรงงาน: 01-ch01-slow.mp3 · 09-ch09-contracts-legal-basics.mp3 · track-03.mp3
export function trackInfo(file) {
  const base = String(file).split('/').pop().replace(/\.(mp3|m4a|wav|ogg)$/i, '');
  const m = base.match(/^(\d+)[-_ ]?(?:ch(?:apter)?[-_ ]?(\d+))?[-_ ]?(.*)$/i);
  const n = m ? Number(m[1]) : 0, ch = m && m[2] ? Number(m[2]) : 0, rest = (m ? m[3] : base).replace(/[-_]+/g, ' ').trim();
  // คำในชื่อไฟล์ → ภาษาไทย (dialogue1-slow → บทสนทนา 1 · ช้า 🐢)
  let sp = ''; const words = rest.toLowerCase().split(' ').filter((w) => { if (SPEED_TH[w]) { sp = SPEED_TH[w]; return false; } return w.length > 1; }); // ตัวอักษรเดี่ยว (001a-band6) ไม่เอา
  const TH = { dialogue: 'บทสนทนา', conversation: 'บทสนทนา', listening: 'ฝึกฟัง', vocab: 'คำศัพท์', vocabulary: 'คำศัพท์', sentences: 'ประโยค', sentence: 'ประโยค', words: 'คำศัพท์', test: 'แบบทดสอบ', part: 'Part', track: 'แทร็ก', q: 'คำถามที่', question: 'คำถามที่', dictation: 'ฝึกฟังแล้วเขียน', band: 'คำตอบระดับ Band', cue: 'Cue Card' };
  const name = words.map((w) => { const m2 = w.match(/^([a-z]+)(\d+)$/); if (m2 && TH[m2[1]]) return `${TH[m2[1]]} ${Number(m2[2])}`; return TH[w] || w.replace(/^\w/, (c) => c.toUpperCase()); }).join(' ');
  const label = [(name && words.length === 1 && TH[words[0]] && n ? `${name} ข้อ ${n}` : name) || (sp ? '' : `แทร็ก ${n || ''}`.trim()), sp].filter(Boolean).join(' · ');
  return { n, ch, label };
}

// รายชื่อแทร็ก (เรียงตามเลข) + ชื่อบท (จากสารบัญสินค้า ถ้ามี)
export function buildBook({ sku, title, cover, base, files, chapters = {}, secs = {} }) {
  const tracks = files.filter((f) => /\.(mp3|m4a|wav|ogg)$/i.test(f)).map((f) => ({ f, sec: Math.round(Number(secs[f]) || 0), ...trackInfo(f) }))
    .sort((a, b) => a.n - b.n || String(a.f).localeCompare(String(b.f)));
  return { sku, title, cover: cover || '', base: String(base || '').replace(/\/$/, ''), chapters, tracks, at: new Date().toISOString() };
}

const mmss = (s) => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');

// demo = ลิงก์ตัวอย่างให้ลูกค้าที่ขอฟังก่อนซื้อ (/audio/SL-048?demo=1 · คุณแดน 16 ต.ค. 69): ฟังได้แค่ DEMO_N แทร็กแรก + ปุ่มไปหน้าขาย
export const DEMO_N = 3;
// ชื่อแทร็กคิดใหม่จากชื่อไฟล์ทุกครั้ง (รายชื่อใน audio_lib เก็บชื่อเก่าไว้ตอนอัปโหลด) → ปรับคำแปลแล้วทุกเล่มได้ชื่อใหม่ทันที
const relabel = (t) => ({ ...t, label: (t.f && trackInfo(t.f).label) || t.label });
// ตัวอย่างเสียงบนหน้าขาย (กล่อง 🎧 ฟังตัวอย่าง) · ไฟล์โหลดเมื่อกดเล่นเท่านั้น หน้าไม่ช้าลง
export function demoOf(book) {
  const T = (book && book.tracks) || [];
  return T.length ? { n: T.length, t: T.slice(0, DEMO_N).map(relabel).map((t) => ({ u: `${book.base}/${encodeURIComponent(t.f)}`, l: t.label })) } : null;
}
export function playerPage(book, { settings = {}, site = '', start = 0, demo = null } = {}) {
  const all = (book.tracks || []).length, T = (demo ? (book.tracks || []).slice(0, DEMO_N) : book.tracks || []).map(relabel), groups = [];
  for (const [i, t] of T.entries()) { const k = t.ch || 0; let g = groups.find((x) => x.ch === k); if (!g) groups.push(g = { ch: k, items: [] }); g.items.push({ ...t, i }); }
  const chName = (k) => (k ? `บทที่ ${k}${book.chapters?.[k] ? ` · ${book.chapters[k]}` : ''}` : 'ไฟล์เสียง');
  const list = groups.map((g) => `<section class="ap-ch"${g.ch ? ` id="ch${g.ch}"` : ''}><h2>${esc(chName(g.ch))}</h2>${g.items.map((t) => `<button type="button" class="ap-row" data-i="${t.i}"><span class="ap-ico" aria-hidden="true">▶</span><span class="ap-tt"><b>${esc(t.label)}</b><small>แทร็ก ${t.n || t.i + 1}${t.sec ? ` · ${mmss(t.sec)}` : ''}</small></span></button>`).join('')}</section>`).join('');
  const data = JSON.stringify({ sku: book.sku, base: book.base, start, demo: !!demo, tracks: T.map((t) => ({ u: `${book.base}/${encodeURIComponent(t.f)}`, l: t.label, c: t.ch ? chName(t.ch) : '', n: t.n })) }).replace(/</g, '\\u003c');
  const body = `<style>
.ap{max-width:640px;margin:0 auto;padding:16px 16px 230px}
.ap-hd{display:flex;gap:14px;align-items:center;margin:8px 0 18px}.ap-hd img{width:84px;height:auto;border-radius:10px;box-shadow:0 4px 14px rgba(15,27,51,.18)}
.ap-hd h1{font-size:21px;line-height:1.35;margin:0 0 4px}.ap-hd p{margin:0;color:var(--muted,#56637D);font-size:15px}
.ap-help{background:#FFF7DB;border:1px solid #F3D57A;border-radius:12px;padding:10px 14px;font-size:15px;margin:0 0 16px;color:#5a4300}
.ap-buy{display:block;text-align:center;margin:18px 0 0;padding:14px;border-radius:14px;background:#2440E8;color:#fff;font-weight:700;text-decoration:none;font-size:17px}
.ap-ch h2{font-size:17px;margin:20px 0 8px;color:#2440E8}
.ap-row{display:flex;gap:12px;align-items:center;width:100%;min-height:58px;padding:10px 14px;margin:0 0 8px;border:1px solid #D3DBE8;border-radius:14px;background:#fff;color:#0F1B33;font:inherit;text-align:left;cursor:pointer}
.ap-row:active{transform:scale(.99)}.ap-row.on{border-color:#2440E8;background:#EEF1FF}.ap-row.on .ap-ico{background:#2440E8;color:#fff}
.ap-ico{flex:none;width:40px;height:40px;border-radius:50%;background:#EEF1FF;color:#2440E8;display:grid;place-items:center;font-size:16px}
.ap-tt b{display:block;font-size:17px;font-weight:600}.ap-tt small{color:#56637D;font-size:14px}
.ap-bar{position:fixed;left:0;right:0;bottom:0;background:#0F1B33;color:#fff;padding:12px 16px calc(14px + env(safe-area-inset-bottom));box-shadow:0 -6px 20px rgba(0,0,0,.2);z-index:20}
.ap-in{max-width:640px;margin:0 auto}.ap-now{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0 0 6px}.ap-now b{color:#FFD23F}
.ap-seek{width:100%;accent-color:#FFD23F;height:28px}.ap-time{display:flex;justify-content:space-between;font-size:13px;color:#C9D3EA;margin:-4px 0 6px}
.ap-ctl{display:flex;align-items:center;justify-content:center;gap:10px}.ap-ctl button{border:0;border-radius:50%;width:52px;height:52px;background:#26365C;color:#fff;font-size:18px;cursor:pointer;font-family:inherit}
.ap-ctl .ap-play{width:68px;height:68px;background:#FFD23F;color:#0F1B33;font-size:26px}
.ap-opt{display:flex;justify-content:center;gap:8px;margin-top:10px;flex-wrap:wrap}.ap-opt button{border:1px solid #3A4C78;background:transparent;color:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-size:14px;cursor:pointer}.ap-opt button.on{background:#FFD23F;color:#0F1B33;border-color:#FFD23F}
@media (prefers-color-scheme:dark){.ap-row{background:#131C30;color:#EAF0FF;border-color:#27334F}.ap-row.on{background:#1E2A4A}.ap-tt small,.ap-hd p{color:#9AA7C4}.ap-ch h2{color:#8EA0FF}.ap-help{background:#3A2A0A;border-color:#6b5310;color:#F3D59B}}
</style>
<main class="ap">
<header class="ap-hd">${book.cover ? `<img src="${esc(book.cover)}" alt="">` : ''}<div><h1>${esc(book.title)}</h1><p>${demo ? `🎧 ตัวอย่างไฟล์เสียง · ${T.length} จาก ${all} แทร็ก` : `🎧 ไฟล์เสียงประกอบหนังสือ · ${T.length} แทร็ก`}</p></div></header>
${demo ? `<p class="ap-help">นี่คือตัวอย่าง ${T.length} แทร็กแรก ฟังได้เลยโดยไม่ต้องสมัคร · ซื้อเล่มแล้วได้ไฟล์เสียงครบทั้ง ${all} แทร็ก สแกน QR ในเล่มฟังได้ตลอด</p>` : `<p class="ap-help">กดชื่อแทร็กเพื่อฟัง ฟังจบแล้วเล่นแทร็กถัดไปเอง · ปรับความเร็วและฟังซ้ำได้ที่แถบด้านล่าง · ครั้งหน้ากลับมาเล่นต่อจากจุดเดิม</p>`}
${list || '<p>ยังไม่มีไฟล์เสียงของเล่มนี้</p>'}${demo ? `<a class="ap-buy" href="${esc(demo.href || '/store')}">📘 ดูหนังสือเล่มนี้ + หน้าตัวอย่าง →</a>` : ''}
</main>
<div class="ap-bar" role="region" aria-label="ตัวเล่นเสียง"><div class="ap-in">
<p class="ap-now" id="ap-now">กดชื่อแทร็กเพื่อเริ่มฟัง</p>
<input class="ap-seek" id="ap-seek" type="range" min="0" max="1000" value="0" aria-label="ตำแหน่งเสียง"><div class="ap-time"><span id="ap-cur">0:00</span><span id="ap-dur">0:00</span></div>
<div class="ap-ctl"><button type="button" id="ap-prev" aria-label="แทร็กก่อนหน้า">⏮</button><button type="button" id="ap-back" aria-label="ย้อน 5 วินาที">-5</button><button type="button" class="ap-play" id="ap-play" aria-label="เล่น">▶</button><button type="button" id="ap-fwd" aria-label="ข้าม 5 วินาที">+5</button><button type="button" id="ap-next" aria-label="แทร็กถัดไป">⏭</button></div>
<div class="ap-opt"><button type="button" data-sp="0.75">ช้า 0.75x</button><button type="button" data-sp="1" class="on">ปกติ</button><button type="button" data-sp="1.25">เร็ว 1.25x</button><button type="button" id="ap-rep" aria-pressed="false">🔁 ฟังซ้ำแทร็กนี้</button></div>
</div></div>
<audio id="ap-a" preload="none"></audio>
<script>(function(){var D=${data},A=document.getElementById('ap-a'),cur=-1,rep=false,K='ap:'+D.sku+(D.demo?':demo':''),$=function(i){return document.getElementById(i)};
function fmt(s){s=Math.max(0,s||0);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
function save(){try{localStorage.setItem(K,JSON.stringify({i:cur,t:A.currentTime||0}))}catch(e){}}
function mark(){document.querySelectorAll('.ap-row').forEach(function(b){var on=+b.dataset.i===cur;b.classList.toggle('on',on);b.querySelector('.ap-ico').textContent=on&&!A.paused?'❚❚':'▶'})}
function load(i,play,t){if(i<0||i>=D.tracks.length)return;cur=i;var x=D.tracks[i];A.src=x.u;A.playbackRate=+(document.querySelector('[data-sp].on')||{dataset:{sp:1}}).dataset.sp;
 $('ap-now').innerHTML=(x.c?'<b>'+x.c.replace(/[<&]/g,'')+'</b> · ':'')+x.l.replace(/[<&]/g,'');
 if(t)A.addEventListener('loadedmetadata',function f(){A.currentTime=t;A.removeEventListener('loadedmetadata',f)});
 if(play)A.play().catch(function(){});mark();save();
 if('mediaSession' in navigator){try{navigator.mediaSession.metadata=new MediaMetadata({title:x.l,artist:'SheetLab',album:document.title})}catch(e){}}
 var row=document.querySelector('.ap-row[data-i="'+i+'"]');if(row&&play)row.scrollIntoView({block:'nearest',behavior:'smooth'})}
document.querySelectorAll('.ap-row').forEach(function(b){b.addEventListener('click',function(){var i=+b.dataset.i;if(i===cur){A.paused?A.play():A.pause()}else load(i,true)})});
$('ap-play').onclick=function(){if(cur<0)load(0,true);else if(A.paused)A.play();else A.pause()};
$('ap-prev').onclick=function(){if(A.currentTime>3)A.currentTime=0;else load(cur-1,true)};$('ap-next').onclick=function(){load(cur+1,true)};
$('ap-back').onclick=function(){A.currentTime=Math.max(0,A.currentTime-5)};$('ap-fwd').onclick=function(){A.currentTime=Math.min(A.duration||0,A.currentTime+5)};
document.querySelectorAll('[data-sp]').forEach(function(b){b.onclick=function(){document.querySelectorAll('[data-sp]').forEach(function(x){x.classList.toggle('on',x===b)});A.playbackRate=+b.dataset.sp}});
$('ap-rep').onclick=function(){rep=!rep;this.classList.toggle('on',rep);this.setAttribute('aria-pressed',rep)};
A.addEventListener('play',function(){$('ap-play').textContent='❚❚';$('ap-play').setAttribute('aria-label','หยุด');mark()});
A.addEventListener('pause',function(){$('ap-play').textContent='▶';$('ap-play').setAttribute('aria-label','เล่น');mark();save()});
A.addEventListener('timeupdate',function(){var d=A.duration||0;$('ap-cur').textContent=fmt(A.currentTime);$('ap-dur').textContent=fmt(d);if(d)$('ap-seek').value=Math.round(A.currentTime/d*1000)});
$('ap-seek').addEventListener('input',function(){if(A.duration)A.currentTime=this.value/1000*A.duration});
A.addEventListener('ended',function(){if(rep){A.currentTime=0;A.play()}else load(cur+1,true)});
setInterval(function(){if(!A.paused)save()},5000);
if('mediaSession' in navigator){try{navigator.mediaSession.setActionHandler('previoustrack',function(){load(cur-1,true)});navigator.mediaSession.setActionHandler('nexttrack',function(){load(cur+1,true)})}catch(e){}}
var st=null;try{st=JSON.parse(localStorage.getItem(K)||'null')}catch(e){}
if(D.start>0){var j=D.tracks.findIndex(function(x){return x.n===D.start});load(j<0?0:j,false)}else if(st&&st.i>=0&&st.i<D.tracks.length){load(st.i,false,st.t);$('ap-now').innerHTML+=' <small>(ฟังต่อจากเดิม กด ▶)</small>'}
})();</script>`;
  return shell({ title: `ไฟล์เสียง ${book.title} · SheetLab`, desc: `ฟังไฟล์เสียงประกอบหนังสือ ${book.title} แบ่งตามบท กดฟังได้ทันที`, canonical: `${site}/audio/${book.sku}`, body, pixelId: settings.pixelId, noindex: true });
}

// QR รายบทในเล่ม: ?ch=3 → แทร็กแรกของบทที่ 3
export function startTrack(book, { t, ch } = {}) {
  if (Number(t) > 0) return Number(t);
  if (Number(ch) > 0) { const x = (book.tracks || []).find((y) => y.ch === Number(ch)); return x ? x.n : 0; }
  return 0;
}
