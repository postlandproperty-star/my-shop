// 📚 คำศัพท์ 3000 คำที่ต้องรู้ (/vocab) · ฝึกแบบ Parroto: เดาคำจากความหมาย การ์ด ควิซ ควิซกลับด้าน ฟังแล้วพูดตาม
// คำ/ความหมาย/ตัวอย่าง แต่งใหม่ (tools/vocab/build.mjs) อยู่ใน src/vocab/<level>.json ส่งไปกับ api/page.js (ไม่ดึงจาก Supabase)
// สิทธิ์ (คุณแดน 14 ต.ค. 69): ไม่ต้องล็อกอิน ฝึกบทแรกของทุกระดับได้เลย · บทอื่น = สมัครสมาชิกฟรี (ช่วงเปิดตัว ราคา 0) หรือ Pro เมื่อเปิดขาย
// ทุกบทแสดงรายการคำให้ Google เก็บได้ (SEO) · การล็อกอยู่ที่ส่วนฝึก ตรวจสิทธิ์ในเบราว์เซอร์ผ่าน m=vip_vocab (หน้าแคชได้เหมือนกันทุกคน)
// ความคืบหน้าเก็บในเบราว์เซอร์ (localStorage sl_vocab) · เข้าระบบแล้วซิงก์กับตาราง member_vocab ผ่าน /api/order?m=vip_vocab(_save)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shell } from './quiz.js';
import { LOGIN_FN } from './vipPage.js';

export const FREE_UNITS = 1;
export const LEVELS = {
  a1: { name: 'A1', th: 'พื้นฐาน', desc: 'คำแรกที่ต้องรู้ ใช้ในชีวิตประจำวัน' },
  a2: { name: 'A2', th: 'เบื้องต้น', desc: 'คำที่ใช้บ่อย คุยเรื่องทั่วไปได้คล่องขึ้น' },
  b1: { name: 'B1', th: 'กลาง', desc: 'คำสำหรับงาน การเรียน และข่าว' },
  b2: { name: 'B2', th: 'กลาง-สูง', desc: 'คำเชิงวิชาการและความคิดเห็น เตรียมสอบ IELTS / TOEIC' },
};
// หนังสือที่แนะนำท้ายบท (id สินค้าในร้าน · ไม่เจอ = หาเล่มคำศัพท์ที่ขายอยู่)
const UPSELL = { a1: 'pmuumy93l4', a2: 'pmuumy93l4', b1: 'bmuxz96bc', b2: 'pmutpl5hc42' };
const SOON = ['IELTS 600 คำพื้นฐาน', 'IELTS Band 6–7', 'TOEIC ธุรกิจ', 'อังกฤษ ก.พ.', 'ศัพท์ใช้งานจริง'];

// รูปประกอบ (tools/vocab/images.py) อยู่บน R2: ปกบท vocab/u/<level>-<id>.jpg · คำ vocab/w/<slug>.jpg (มีรูป = img:1 ในไฟล์คำ)
export const VIMG = 'https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/vocab/';
const wslug = (w) => String(w).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PICT = /^(noun|verb|adjective)/i; // ชนิดคำที่มีรูป (ตรงกับ images.py) · รูปยังไม่ขึ้น R2 = onerror ซ่อนเอง ไม่ต้อง deploy ใหม่
const unitImg = (lv, u) => (u ? `${VIMG}u/${lv}-${u.id}.jpg` : '');
const wordImg = (x) => (x.img || PICT.test(x.pos || '') ? `${VIMG}w/${wslug(x.w)}.jpg` : '');
const OE = ' onerror="this.remove()"';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cache = {};
export function loadLevel(lv) {
  if (!LEVELS[lv]) return null;
  if (!cache[lv]) { try { cache[lv] = JSON.parse(readFileSync(join(process.cwd(), 'src', 'vocab', `${lv}.json`), 'utf8')); } catch (e) { cache[lv] = { level: lv, units: [] }; } }
  return cache[lv];
}
export const isFree = (id) => Number(id) >= 1 && Number(id) <= FREE_UNITS;
export const levelCount = (lv) => (loadLevel(lv)?.units || []).reduce((a, u) => a + u.words.length, 0);
export function pickUpsell(lv, products = []) {
  const live = products.filter((p) => p.status === 'published' && p.sell !== 'salepage');
  return live.find((p) => p.id === UPSELL[lv]) || live.find((p) => /คำศัพท์|vocabulary/i.test(p.name || '')) || null;
}

// ---------- ความคืบหน้า (ตรวจก่อนเก็บลงตาราง member_vocab) ----------
const KEY_RE = /^(a1|a2|b1|b2)\.\d{1,3}\.[a-z][a-z' -]{0,39}$/, UNIT_RE = /^(a1|a2|b1|b2)\.\d{1,3}$/;
export function cleanProgress(d) {
  const o = { w: {}, u: {}, days: [] }; if (!d || typeof d !== 'object') return o;
  const int = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(x) || 0)));
  for (const [k, v] of Object.entries(d.w || {}).slice(0, 6000)) if (KEY_RE.test(k) && Array.isArray(v)) o.w[k] = [int(v[0], 0, 6), int(v[1], 0, 99999)];
  for (const [k, v] of Object.entries(d.u || {}).slice(0, 600)) if (UNIT_RE.test(k)) o.u[k] = int(v, 0, 100);
  o.days = [...new Set((Array.isArray(d.days) ? d.days : []).map((x) => int(x, 0, 99999)).filter(Boolean))].sort((a, b) => a - b).slice(-400);
  return o;
}

// ---------- หน้าเว็บ ----------
const CSS = `<style>
.vc-hero h1{margin:6px 0 4px}.vc-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.vc-stat{background:var(--bg);border-radius:12px;padding:10px;text-align:center}.vc-stat b{display:block;font-size:22px}.vc-stat span{font-size:12.5px;color:var(--muted)}
.vc-lv{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--ink);border:1.5px solid var(--line);border-radius:14px;padding:12px;margin-bottom:8px;background:var(--surface)}.vc-lv:hover,.vc-unit:hover{border-color:var(--brand)}
.vc-badge{flex:none;width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;background:#DDF3EA;color:#0F7A55}.vc-badge.b{background:#E7E9FD;color:#2440E8}
.vc-grow{flex:1;min-width:0}.vc-bar{height:6px;border-radius:3px;background:var(--bg);margin-top:6px;overflow:hidden}.vc-bar i{display:block;height:100%;width:0;background:var(--ok);border-radius:3px}
.vc-tag{flex:none;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;background:#DDF3EA;color:#0F7A55}.vc-tag.v{background:#FFF4D6;color:#8A5A00}
.vc-units{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}.vc-unit{display:flex;gap:10px;align-items:center;text-decoration:none;color:var(--ink);border:1.5px solid var(--line);border-radius:12px;padding:10px;background:var(--surface)}.vc-unit .n{flex:none;width:34px;height:34px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700}.vc-unit.done .n{background:#DDF3EA;color:#0F7A55}
.vc-chips{display:flex;flex-wrap:wrap;gap:6px}.vc-chip{font-size:13px;border:1.5px solid var(--line);border-radius:999px;padding:4px 10px;color:var(--muted)}
.vc-modes{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 12px}.vc-modes button{font:inherit;font-size:14px;font-weight:600;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:6px 12px;cursor:pointer}.vc-modes button.on{background:var(--brand);border-color:var(--brand);color:#fff}
.vc-top{display:flex;justify-content:space-between;font-size:13px;color:var(--muted)}.vc-q{border:1.5px solid var(--line);border-radius:14px;padding:18px 14px;text-align:center;background:var(--surface)}
.vc-pos{font-size:12.5px;color:var(--muted);margin:0 0 6px}.vc-def{font-size:18px;margin:0 0 8px}.vc-th{color:var(--muted);margin:0 0 10px}.vc-word{font-size:30px;font-weight:700;margin:4px 0}
.vc-blank{font-family:ui-monospace,Menlo,monospace;font-size:22px;letter-spacing:5px;margin:6px 0 12px;word-break:break-all}
.vc-in{display:flex;gap:8px}.vc-in input{flex:1;min-width:0;font:inherit;font-size:18px;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--bg);color:var(--ink);text-align:center}.vc-in input.bad{border-color:var(--bad);animation:vcsh .3s}.vc-in input.good{border-color:var(--ok);background:var(--okbg)}
@keyframes vcsh{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.vc-act{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px}.vc-act button,.vc-btn{font:inherit;font-weight:600;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:9px 14px;cursor:pointer;text-decoration:none;display:inline-block}.vc-act .go,.vc-btn.go{background:var(--brand);border-color:var(--brand);color:#fff}
.vc-ch{display:grid;gap:8px;margin-top:12px}.vc-ch button{font:inherit;font-size:16px;text-align:left;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:11px 14px;cursor:pointer}.vc-ch button.ok{border-color:var(--ok);background:var(--okbg)}.vc-ch button.no{border-color:var(--bad);background:var(--badbg)}
.vc-ex{background:var(--bg);border-radius:12px;padding:10px 12px;margin-top:12px;text-align:left}.vc-ex p{margin:0}.vc-ex .fine{margin-top:4px}
.vc-card{cursor:pointer;min-height:190px;display:flex;flex-direction:column;justify-content:center}
.vc-list{display:grid;gap:6px}.vc-li{display:flex;gap:10px;align-items:flex-start;border-bottom:1px solid var(--line);padding:8px 0}.vc-li b{min-width:110px}.vc-li .fine{margin:2px 0 0}
.vc-say{flex:none;font:inherit;border:0;background:var(--bg);border-radius:8px;padding:2px 8px;cursor:pointer}
.vc-lock{text-align:center}.vc-lock .big{font-size:40px;margin:0}.vc-prev{filter:blur(3px);user-select:none;pointer-events:none}
.vc-up{display:flex;gap:12px;align-items:center;text-decoration:none;color:var(--ink);border:1.5px dashed var(--line);border-radius:14px;padding:10px;margin-top:12px}.vc-up img{width:64px;height:64px;object-fit:cover;border-radius:10px}
.vc-res{text-align:center}.vc-res .big{font-size:36px;font-weight:700;margin:4px 0}
.vc-lvimg{flex:none;width:64px;height:64px;border-radius:14px;object-fit:cover;background:#FFF6E5}.vc-uimg{flex:none;width:56px;height:56px;border-radius:12px;object-fit:cover;background:#FFF6E5}
.vc-unit{position:relative}.vc-unit .n.ov{position:absolute;left:6px;top:6px;width:24px;height:24px;font-size:12px;border-radius:8px;background:rgba(255,255,255,.92)}
.vc-hero-img{width:100%;max-height:200px;object-fit:cover;border-radius:14px;margin:0 0 10px;background:#FFF6E5}
.vc-pic{display:block;width:150px;height:150px;margin:0 auto 10px;border-radius:16px;object-fit:cover;background:#FFF6E5}.vc-li img{width:44px;height:44px;border-radius:10px;object-fit:cover;flex:none}
</style>`;

const productCard = (p, lv) => {
  if (!p) return '';
  const img = (p.images || [])[0];
  return `<a class="vc-up" href="/p/${esc(p.slug)}?utm_campaign=vocab-${lv}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}<span><span class="fine">อยากได้ฉบับเต็มไว้อ่าน/พิมพ์</span><br><b>${esc(p.name)}</b><br>${Number(p.price) >= 1 ? `<strong>฿${Number(p.price).toLocaleString('th-TH')}</strong> · ` : ''}<span style="color:var(--brand);font-weight:600">ดูตัวอย่างในเล่ม ›</span></span></a>`;
};
const badge = (lv) => `<span class="vc-badge${lv[0] === 'b' ? ' b' : ''}">${LEVELS[lv].name}</span>`;
const crumbs = (items) => `<p class="fine">${items.map(([h, t]) => (h ? `<a href="${h}">${esc(t)}</a>` : esc(t))).join(' › ')}</p>`;

export function homePage({ settings = {}, site = '' } = {}) {
  const total = Object.keys(LEVELS).reduce((a, lv) => a + levelCount(lv), 0);
  const lvls = Object.entries(LEVELS).map(([lv, L]) => { const n = (loadLevel(lv)?.units || []).length; const im = unitImg(lv, loadLevel(lv).units[0]); return n ? `<a class="vc-lv" href="/vocab/${lv}" data-lv="${lv}" data-n="${levelCount(lv)}">${im ? `<img class="vc-lvimg" src="${im}" alt="" loading="lazy"${OE}>` : ''}${badge(lv)}<span class="vc-grow"><b>${L.name} · ${L.th}</b> <span class="fine">${n} บท · ${levelCount(lv)} คำ</span><br><span class="fine">${esc(L.desc)}</span><span class="vc-bar"><i></i></span></span><span class="vc-tag">บทแรกฟรี</span></a>` : ''; }).join('');
  const body = `${CSS}<header class="card vc-hero"><span class="chip">📚 คำศัพท์</span><h1>คำศัพท์ ${total >= 2900 ? '3000' : total.toLocaleString('th-TH')} คำที่ต้องรู้</h1><p class="fine">คำภาษาอังกฤษที่ใช้บ่อยที่สุด เรียงจากง่ายไปยาก A1 → B2 แบ่งเป็นบทละประมาณ 22 คำตามหัวข้อ ฝึกได้ 5 แบบ เดาคำจากความหมาย การ์ด ควิซ ควิซกลับด้าน และฟังแล้วพูดตาม คำที่จำไม่ได้ระบบพากลับมาทวนเอง · บทแรกของทุกระดับเริ่มได้เลย สมัครสมาชิกฟรีเพื่อฝึกครบทุกบท</p>
<div class="vc-stats"><div class="vc-stat"><b id="vc-learn">0</b><span>คำที่ฝึกแล้ว</span></div><div class="vc-stat"><b id="vc-due">0</b><span>ต้องทวนวันนี้</span></div><div class="vc-stat"><b id="vc-streak">0</b><span>วันติดต่อกัน</span></div></div>
<p id="vc-rev" hidden style="margin:10px 0 0"><a class="vc-btn go" href="/vocab/review">ทวนคำวันนี้ ›</a></p></header>
<section class="card"><h2>คำศัพท์ 3000 คำที่ต้องรู้</h2>${lvls}</section>
<section class="card"><h2>ชุดคำศัพท์อื่น</h2><p class="fine">กำลังทยอยเพิ่ม</p><div class="vc-chips">${SOON.map((x) => `<span class="vc-chip">${esc(x)}</span>`).join('')}</div></section>${HOME_JS}`;
  return shell({ title: 'คำศัพท์ภาษาอังกฤษ 3000 คำที่ต้องรู้ ฝึกฟรี A1–B2 · SheetLab', desc: 'ฝึกคำศัพท์ภาษาอังกฤษที่ใช้บ่อยที่สุด 3000 คำ ระดับ A1 ถึง B2 พร้อมความหมายไทย ประโยคตัวอย่าง เสียงอ่าน และระบบทวนคำที่จำไม่ได้ ฝึกฟรีไม่ต้องสมัคร', canonical: `${site}/vocab`, body, pixelId: settings.pixelId, tab: 'vocab' });
}

export function levelPage(lv, { settings = {}, site = '' } = {}) {
  const L = LEVELS[lv], d = loadLevel(lv);
  const units = d.units.map((u) => `<a class="vc-unit" href="/vocab/${lv}/${u.id}" data-u="${lv}.${u.id}">${unitImg(lv, u) ? `<img class="vc-uimg" src="${unitImg(lv, u)}" alt="" loading="lazy"${OE}><span class="n ov">${u.id}</span>` : `<span class="n">${u.id}</span>`}<span class="vc-grow"><b>${esc(u.th)}</b><br><span class="fine">${esc(u.t)} · ${u.words.length} คำ</span></span>${isFree(u.id) ? '<span class="vc-tag">ฟรี</span>' : '<span class="vc-tag v">สมาชิก</span>'}</a>`).join('');
  const body = `${CSS}<header class="card">${crumbs([['/vocab', 'คำศัพท์ 3000 คำ'], ['', L.name]])}<div style="display:flex;gap:12px;align-items:center">${badge(lv)}<div><h1 style="margin:0">ระดับ ${L.name} · ${L.th}</h1><p class="fine" style="margin:2px 0 0">${d.units.length} บท · ${levelCount(lv)} คำ · ${esc(L.desc)}</p></div></div><p class="fine">บทที่ 1 ฝึกได้ทันที ไม่ต้องสมัคร · บทอื่นสมัครสมาชิกฟรีด้วยอีเมลหรือ Google</p></header>
<section class="card"><div class="vc-units">${units}</div></section>${LEVEL_JS}`;
  return shell({ title: `คำศัพท์ภาษาอังกฤษระดับ ${L.name} (${L.th}) ${levelCount(lv)} คำ · SheetLab`, desc: `คำศัพท์ภาษาอังกฤษระดับ ${L.name} ${levelCount(lv)} คำ แบ่ง ${d.units.length} บทตามหัวข้อ พร้อมความหมายไทย ตัวอย่างประโยค และแบบฝึก`, canonical: `${site}/vocab/${lv}`, body, pixelId: settings.pixelId, tab: 'vocab' });
}

const wordList = (lv, u) => `<section class="card"><h2>คำศัพท์ในบทนี้</h2><div class="vc-list">${u.words.map((x) => `<div class="vc-li">${wordImg(x) ? `<img src="${wordImg(x)}" alt="" loading="lazy"${OE}>` : ''}<button class="vc-say" data-say="${esc(x.w)}" aria-label="ฟังเสียง ${esc(x.w)}">🔊</button><b>${esc(x.w)}</b><span><span>${esc(x.th)}</span> <span class="fine">(${esc(x.pos)})</span><p class="fine">${esc(x.ex)}</p></span></div>`).join('')}</div></section>`;
const json = (x) => JSON.stringify(x).replace(/</g, '\\u003c');

export function unitPage(lv, u, { settings = {}, site = '', product = null, next = null } = {}) {
  const L = LEVELS[lv];
  const data = { lv, u: u.id, words: u.words, next: next ? `/vocab/${lv}/${next.id}` : '', review: false, free: isFree(u.id) };
  const body = `${CSS}<header class="card">${crumbs([['/vocab', 'คำศัพท์ 3000 คำ'], [`/vocab/${lv}`, L.name], ['', `บทที่ ${u.id}`]])}<div style="display:flex;gap:12px;align-items:center">${unitImg(lv, u) ? `<img class="vc-lvimg" src="${unitImg(lv, u)}" alt=""${OE}>` : ''}<div><h1 style="margin:0 0 2px">บทที่ ${u.id} · ${esc(u.th)}</h1><p class="fine" style="margin:0">${esc(u.t)} · ${u.words.length} คำ · ระดับ ${L.name}</p></div></div></header>
<section class="card" id="vc-app"><p class="fine">กำลังโหลด...</p></section>${productCard(product, lv) ? `<section class="card">${productCard(product, lv)}</section>` : ''}${wordList(lv, u)}<script>window.VC=${json(data)};</script>${LEARN_JS}`;
  return shell({ title: `คำศัพท์ ${u.t} (${u.th}) ระดับ ${L.name} · SheetLab`, desc: `คำศัพท์ภาษาอังกฤษหมวด${u.th} ${u.words.length} คำ: ${u.words.slice(0, 8).map((x) => x.w).join(', ')} พร้อมความหมายไทยและตัวอย่างประโยค ฝึกฟรี`, canonical: `${site}/vocab/${lv}/${u.id}`, body, pixelId: settings.pixelId, tab: 'vocab', image: unitImg(lv, u) || undefined });
}

export function reviewPage(words, { settings = {}, site = '', needK = false } = {}) {
  const data = { lv: '', u: 0, words, next: '', review: true, needK };
  const body = `${CSS}<header class="card">${crumbs([['/vocab', 'คำศัพท์ 3000 คำ'], ['', 'ทวนคำวันนี้']])}<h1 style="margin:0">ทวนคำวันนี้</h1><p class="fine" style="margin:2px 0 0">คำที่ถึงรอบทวน ตอบถูกแล้วรอบถัดไปจะห่างขึ้นเรื่อยๆ ตอบผิดกลับมาทวนพรุ่งนี้</p></header>
<section class="card" id="vc-app"><p class="fine">กำลังโหลด...</p></section><script>window.VC=${json(data)};</script>${LEARN_JS}`;
  return shell({ title: 'ทวนคำศัพท์วันนี้ · SheetLab', desc: 'ทวนคำศัพท์ที่ถึงรอบ', canonical: `${site}/vocab/review`, body, pixelId: settings.pixelId, tab: 'vocab', noindex: true });
}


// ---------- สคริปต์ฝั่งเบราว์เซอร์ ----------
// ที่เก็บ: sl_vocab = {w:{'a1.3.word':[box,dueDay]}, u:{'a1.3':คะแนนดีสุด%}, days:[วันที่ฝึก]} · day = เลขวันตามเวลาไทย
const STORE_JS = String.raw`var SK='sl_vocab',GAP=[0,1,2,4,8,16,32];
function today(){return Math.floor((Date.now()+252e5)/864e5);}
function getS(){try{var s=JSON.parse(localStorage.getItem(SK)||'null');if(s&&s.w)return s;}catch(e){}return {w:{},u:{},days:[]};}
function putS(s){try{localStorage.setItem(SK,JSON.stringify(s));}catch(e){}}
function streak(s){var d=s.days||[],t=today(),n=0;if(d.indexOf(t)<0)t--;while(d.indexOf(t)>=0){n++;t--;}return n;}
function dueKeys(s){var t=today();return Object.keys(s.w).filter(function(k){return s.w[k][1]<=t;});}
function merge(a,b){var o={w:{},u:{},days:[]};[a,b].forEach(function(s){Object.keys(s.w||{}).forEach(function(k){var x=s.w[k],y=o.w[k];if(!y||x[1]>y[1])o.w[k]=x;});Object.keys(s.u||{}).forEach(function(k){o.u[k]=Math.max(o.u[k]||0,s.u[k]);});(s.days||[]).forEach(function(d){if(o.days.indexOf(d)<0)o.days.push(d);});});o.days.sort(function(x,y){return x-y;});return o;}
function sync(push){return fetch('/api/order?m=vip_vocab',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){if(!j.ok||!j.email)return null;var m=merge(getS(),j.data||{});putS(m);if(push)return fetch('/api/order?m=vip_vocab_save',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({data:m})}).then(function(){return m;});return m;}).catch(function(){return null;});}
`;

const HOME_JS = `<script>(function(){${STORE_JS}
function draw(){var s=getS(),t=today(),due=dueKeys(s);document.getElementById('vc-learn').textContent=Object.keys(s.w).length;document.getElementById('vc-due').textContent=due.length;document.getElementById('vc-streak').textContent=streak(s);
document.getElementById('vc-rev').hidden=!due.length;
[].forEach.call(document.querySelectorAll('.vc-lv'),function(a){var lv=a.getAttribute('data-lv'),n=+a.getAttribute('data-n')||1,k=Object.keys(s.w).filter(function(x){return x.indexOf(lv+'.')===0;}).length;a.querySelector('.vc-bar i').style.width=Math.min(100,Math.round(k/n*100))+'%';});}
draw();sync(false).then(function(m){if(m)draw();});})();</script>`;

const LEVEL_JS = `<script>(function(){${STORE_JS}
var s=getS();[].forEach.call(document.querySelectorAll('.vc-unit'),function(a){var k=a.getAttribute('data-u'),p=s.u[k];if(p!=null){a.classList.add('done');a.querySelector('.fine').textContent+=' · ทำได้ '+p+'%';}});})();</script>`;

const LEARN_JS = `<script>(function(){${STORE_JS}${LOGIN_FN}
var C=window.VC,box=document.getElementById('vc-app'),W=C.words.slice(),mode='guess',Q=[],i=0,wrong=[],okN=0,tries=0,hints=0,locked=false;
var MODES=[['guess','เดาคำ'],['card','การ์ด'],['quiz','ควิซ'],['rev','ควิซกลับด้าน'],['shadow','ฟังแล้วพูดตาม']];
var POS={noun:'คำนาม',verb:'คำกริยา',adjective:'คำคุณศัพท์',adverb:'คำกริยาวิเศษณ์',preposition:'คำบุพบท',pronoun:'คำสรรพนาม',conjunction:'คำสันธาน',phrase:'วลี',determiner:'คำนำหน้านาม',interjection:'คำอุทาน',number:'ตัวเลข'};
function e(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function key(x){return (x.lv||C.lv)+'.'+(x.u||C.u)+'.'+x.w;}
function shuf(a){a=a.slice();for(var j=a.length-1;j>0;j--){var k=Math.floor(Math.random()*(j+1)),t=a[j];a[j]=a[k];a[k]=t;}return a;}
var VOICE=null;function pickV(){var v=(window.speechSynthesis&&speechSynthesis.getVoices())||[];VOICE=v.filter(function(x){return /^en[-_]US/i.test(x.lang)&&/Samantha|Google|Microsoft|Natural/i.test(x.name);})[0]||v.filter(function(x){return /^en[-_](US|GB)/i.test(x.lang);})[0]||null;}
if(window.speechSynthesis){pickV();speechSynthesis.onvoiceschanged=pickV;}
function say(t,slow){if(!window.speechSynthesis)return;speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(t);u.lang='en-US';if(VOICE)u.voice=VOICE;u.rate=slow?0.6:0.92;speechSynthesis.speak(u);}
document.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('[data-say]');if(b){ev.preventDefault();say(b.getAttribute('data-say'),b.hasAttribute('data-slow'));}});
function mark(x,ok){var s=getS(),k=key(x),c=s.w[k]||[0,0],b=ok?Math.min(6,c[0]+1):0;s.w[k]=[b,today()+(ok?GAP[b]:1)];var t=today();if(s.days.indexOf(t)<0)s.days.push(t);putS(s);}
function pos(p){return POS[String(p).toLowerCase()]||p;}
function pic(x){return x.img||/^(noun|verb|adjective)/i.test(x.pos||'')?'<img class="vc-pic" src="https://pub-fdfc380c67f149de994eac621d6b147c.r2.dev/vocab/w/'+String(x.w).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.jpg" alt="" onerror="this.remove()">':'';}
function tabs(){return '<div class="vc-modes" role="tablist">'+MODES.map(function(m){return '<button data-m="'+m[0]+'" class="'+(m[0]===mode?'on':'')+'">'+m[1]+'</button>';}).join('')+'</div>';}
function top(){return '<div class="vc-top"><span>'+(C.review?'ทวนคำ':'บทที่ '+C.u)+'</span><span>'+Math.min(i+1,Q.length)+' / '+Q.length+'</span></div><div class="vc-bar" style="margin:4px 0 12px"><i style="width:'+Math.round(i/Q.length*100)+'%"></i></div>';}
function start(m,list){mode=m;Q=shuf(list||W);i=0;wrong=[];okN=0;show();}
function blank(w,n){return w.split('').map(function(c,j){return c===' '?'&nbsp;&nbsp;':c==='-'||c==="'"?c:j<n?c:'_';}).join(' ');}
function norm(s){return String(s).toLowerCase().replace(/[‘’]/g,"'").replace(/[-\s]+/g,' ').trim();}
function ex(x){return '<div class="vc-ex"><p><button class="vc-say" data-say="'+e(x.ex)+'" aria-label="ฟังประโยค">🔊</button> '+e(x.ex)+'</p><p class="fine">'+e(x.exth)+'</p></div>';}
function show(){locked=false;tries=0;hints=1;if(i>=Q.length)return done();var x=Q[i],h=tabs()+top();
 if(mode==='guess'){h+='<div class="vc-q">'+pic(x)+'<p class="vc-pos">'+e(x.pos)+' · '+e(pos(x.pos))+'</p><p class="vc-def">'+e(x.def)+'</p><p class="vc-th" id="vc-thh"><button class="vc-say" id="vc-thb">ดูความหมายไทย</button></p><div class="vc-blank" id="vc-bl">'+blank(x.w,1)+'</div><form class="vc-in" id="vc-f"><input id="vc-i" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="พิมพ์คำตอบ" placeholder="พิมพ์คำศัพท์"><button class="vc-btn go">ตรวจ</button></form><div id="vc-after"></div><div class="vc-act" id="vc-help"><button data-say="'+e(x.w)+'">🔊 ฟังเสียง</button><button id="vc-hint">ใบ้ 1 ตัว</button><button id="vc-skip">ไม่รู้ ดูเฉลย</button></div></div>';}
 else if(mode==='card'){h+='<div class="vc-q vc-card" id="vc-card">'+pic(x)+'<p class="vc-pos">'+e(pos(x.pos))+'</p><p class="vc-word">'+e(x.w)+'</p><p class="fine">แตะเพื่อดูความหมาย</p></div><div class="vc-act"><button data-say="'+e(x.w)+'">🔊 ฟังเสียง</button></div>';}
 else if(mode==='quiz'||mode==='rev'){var opts=shuf([x].concat(shuf(C.words.filter(function(y){return y.w!==x.w&&y.th!==x.th;})).slice(0,3)));
  h+='<div class="vc-q">'+pic(x)+(mode==='quiz'?'<p class="vc-pos">'+e(pos(x.pos))+'</p><p class="vc-word">'+e(x.w)+'</p><div class="vc-act" style="margin-top:4px"><button data-say="'+e(x.w)+'">🔊</button></div>':'<p class="vc-pos">เลือกคำภาษาอังกฤษที่แปลว่า</p><p class="vc-word" style="font-size:24px">'+e(x.th)+'</p><p class="fine">'+e(pos(x.pos))+'</p>')+'<div class="vc-ch">'+opts.map(function(o){return '<button data-ok="'+(o.w===x.w?1:0)+'">'+e(mode==='quiz'?o.th:o.w)+'</button>';}).join('')+'</div><div id="vc-after"></div></div>';}
 else {h+='<div class="vc-q">'+pic(x)+'<p class="vc-word" style="font-size:24px">'+e(x.w)+' <span class="fine">'+e(x.th)+'</span></p><p class="vc-def" style="font-size:20px">'+e(x.ex)+'</p><p class="fine">'+e(x.exth)+'</p><div class="vc-act"><button class="go" data-say="'+e(x.ex)+'">▶ ฟัง</button><button data-say="'+e(x.ex)+'" data-slow>🐢 ช้า</button>'+(window.MediaRecorder&&navigator.mediaDevices?'<button id="vc-rec">🎙 อัดเสียงตัวเอง</button>':'')+'</div><audio id="vc-au" controls hidden style="width:100%;margin-top:10px"></audio><div class="vc-act"><button class="go" id="vc-nx">ต่อไป ›</button></div></div>';}
 box.innerHTML=h;wire(x);}
function next(){i++;show();}
function after(x,ok){var a=document.getElementById('vc-after');a.innerHTML=(ok?'<p style="color:var(--ok);font-weight:700;margin:10px 0 0">ถูกต้อง ✓</p>':'<p style="color:var(--bad);font-weight:700;margin:10px 0 0">คำตอบ: '+e(x.w)+' = '+e(x.th)+'</p>')+ex(x)+'<div class="vc-act"><button class="go" id="vc-nx">ต่อไป ›</button></div>';document.getElementById('vc-nx').onclick=next;document.getElementById('vc-nx').focus();}
function result(x,ok){if(locked)return;locked=true;mark(x,ok);if(ok)okN++;else wrong.push(x);}
function wire(x){[].forEach.call(box.querySelectorAll('[data-m]'),function(b){b.onclick=function(){start(b.getAttribute('data-m'),W);};});
 if(mode==='guess'){var f=document.getElementById('vc-f'),inp=document.getElementById('vc-i');inp.focus();
  document.getElementById('vc-thb').onclick=function(){document.getElementById('vc-thh').textContent=x.th;tries++;};
  document.getElementById('vc-hint').onclick=function(){hints=Math.min(x.w.length,hints+1);tries++;document.getElementById('vc-bl').innerHTML=blank(x.w,hints);inp.focus();};
  document.getElementById('vc-skip').onclick=function(){result(x,false);inp.value=x.w;inp.disabled=true;document.getElementById('vc-help').hidden=true;say(x.w);after(x,false);};
  f.onsubmit=function(ev){ev.preventDefault();if(locked){next();return;}var v=norm(inp.value);if(!v)return;
   if(v===norm(x.w)){result(x,tries<2&&hints<3);inp.classList.add('good');inp.disabled=true;document.getElementById('vc-bl').innerHTML=blank(x.w,99);document.getElementById('vc-help').hidden=true;say(x.w);after(x,true);}
   else{tries++;inp.classList.remove('bad');void inp.offsetWidth;inp.classList.add('bad');if(tries>=3){document.getElementById('vc-skip').click();}}};
  inp.oninput=function(){inp.classList.remove('bad');};}
 else if(mode==='card'){var c=document.getElementById('vc-card');c.onclick=function(){if(c.getAttribute('data-f'))return;c.setAttribute('data-f',1);say(x.w);c.innerHTML=pic(x)+'<p class="vc-word" style="font-size:24px">'+e(x.w)+'</p><p style="font-size:20px;margin:0 0 6px">'+e(x.th)+'</p><p class="fine">'+e(x.def)+'</p>'+ex(x);var a=document.createElement('div');a.className='vc-act';a.innerHTML='<button id="vc-no">ยังไม่แม่น</button><button class="go" id="vc-yes">จำได้แล้ว ✓</button>';c.parentNode.insertBefore(a,c.nextSibling);
  document.getElementById('vc-no').onclick=function(){result(x,false);next();};document.getElementById('vc-yes').onclick=function(){result(x,true);next();};};}
 else if(mode==='quiz'||mode==='rev'){[].forEach.call(box.querySelectorAll('.vc-ch button'),function(b){b.onclick=function(){if(locked)return;var ok=b.getAttribute('data-ok')==='1';b.classList.add(ok?'ok':'no');if(!ok)box.querySelector('.vc-ch [data-ok="1"]').classList.add('ok');result(x,ok);say(x.w);after(x,ok);};});}
 else {document.getElementById('vc-nx').onclick=function(){var s=getS(),t=today();if(s.days.indexOf(t)<0){s.days.push(t);putS(s);}next();};var r=document.getElementById('vc-rec');if(r){var rec=null,ch=[];r.onclick=function(){if(rec&&rec.state==='recording'){rec.stop();return;}navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){ch=[];rec=new MediaRecorder(st);rec.ondataavailable=function(ev){ch.push(ev.data);};rec.onstop=function(){st.getTracks().forEach(function(t){t.stop();});var au=document.getElementById('vc-au');if(!au)return;au.src=URL.createObjectURL(new Blob(ch,{type:rec.mimeType||'audio/webm'}));au.hidden=false;au.play();r.textContent='🎙 อัดใหม่';};rec.start();r.textContent='⏹ หยุดอัด';}).catch(function(){r.textContent='เปิดไมค์ไม่ได้';});};}}}
function done(){var n=Q.length,p=n?Math.round(okN/n*100):0;
 if(!C.review&&mode!=='shadow'){var s=getS(),k=C.lv+'.'+C.u;s.u[k]=Math.max(s.u[k]||0,p);putS(s);}
 sync(true);
 var h=tabs()+'<div class="vc-res"><p class="fine">'+(mode==='shadow'?'ฝึกพูดครบทุกประโยคแล้ว':'จบรอบนี้')+'</p>'+(mode==='shadow'?'':'<p class="big">'+okN+' / '+n+'</p><p class="fine">ถูก '+p+'%</p>')+
 (wrong.length?'<p>คำที่ยังไม่แม่น: '+wrong.map(function(x){return '<b>'+e(x.w)+'</b>';}).join(', ')+'</p>':'')+'<div class="vc-act">'+(wrong.length?'<button class="go" id="vc-again">ฝึกคำที่ผิดอีกรอบ</button>':'')+
 (mode!=='quiz'?'<button data-m="quiz">ต่อด้วยควิซ</button>':'<button data-m="guess">ต่อด้วยเดาคำ</button>')+(C.next?'<a class="vc-btn'+(wrong.length?'':' go')+'" href="'+C.next+'">บทถัดไป ›</a>':'')+(C.review?'<a class="vc-btn" href="/vocab">กลับหน้าคำศัพท์</a>':'')+'</div></div>';
 if(C.free&&!C.review)h+='<div id="vc-join" style="margin-top:14px"></div>';
 box.innerHTML=h;var jn=document.getElementById('vc-join');if(jn)fetch('/api/order?m=vip_vocab',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){if(j.email)return;jn.innerHTML='<p style="margin:0 0 4px"><b>เก่งมาก! ฝึกต่อครบทุกบทได้ฟรี</b></p><p class="fine" style="margin:0">สมัครสมาชิกฟรีเพื่อบันทึกความคืบหน้าและเปิดทุกบท A1–B2</p><div id="vc-jf"></div>';slLogin(document.getElementById('vc-jf'),function(){sync(true).then(function(){location.href=C.next||'/vocab';});},'',0,'ใช้บัญชี Google หรืออีเมล ไม่ต้องตั้งรหัสผ่าน');}).catch(function(){});
 var a=document.getElementById('vc-again');if(a){var ww=wrong.slice();a.onclick=function(){start(mode==='shadow'?'guess':mode,ww);};}
 [].forEach.call(box.querySelectorAll('[data-m]'),function(b){b.onclick=function(){start(b.getAttribute('data-m'),W);};});}
if(C.review&&C.needK){var s0=getS(),uk={};dueKeys(s0).forEach(function(k){var p=k.split('.');uk[p[0]+'.'+p[1]]=1;});var ks=Object.keys(uk).slice(0,12);if(ks.length){location.replace('/vocab/review?k='+ks.join(','));return;}}
if(C.review){var s=getS(),due={};dueKeys(s).forEach(function(k){due[k]=1;});W=W.filter(function(x){return due[key(x)];});
 if(!W.length){box.innerHTML='<p>ยังไม่มีคำที่ต้องทวนวันนี้ 🎉</p><p><a class="vc-btn go" href="/vocab">ไปฝึกบทใหม่</a></p>';return;}}
function join(j){box.innerHTML='<div class="vc-lock"><p class="big">🔒</p><h2 style="margin:0 0 6px">'+(j.email?'บทนี้สำหรับสมาชิก Pro':'สมัครสมาชิกฟรีเพื่อฝึกบทนี้')+'</h2><p class="fine">'+(j.email?'อัปเกรดเป็น Pro เพื่อฝึกครบทุกบท':'ฟรี ฝึกได้ครบทุกบท A1–B2 และบันทึกความคืบหน้าให้อัตโนมัติ')+'</p>'+(j.email?(j.vipOpen?'<p><a class="vc-btn go" href="/vip">ดูสิทธิ์ Pro</a></p>':'<p class="fine">เปิดรับ Pro เร็วๆ นี้</p>'):'<div id="vc-jf" style="text-align:left"></div>')+'<p><a class="vc-btn" href="/vocab/'+C.lv+'/1">ฝึกบทที่ 1 (ฟรี)</a></p></div>';
 var f=document.getElementById('vc-jf');if(f)slLogin(f,function(){location.reload();},'',0,'ใช้บัญชี Google หรืออีเมล ไม่ต้องตั้งรหัสผ่าน');}
if(C.free||C.review){start('guess',W);return;}
box.innerHTML='<p class="fine">กำลังตรวจสิทธิ์สมาชิก...</p>';
fetch('/api/order?m=vip_vocab',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){if(j.unlocked){if(j.data)putS(merge(getS(),j.data));start('guess',W);}else join(j);}).catch(function(){join({});});})();</script>`;
