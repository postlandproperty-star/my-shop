// 🧍 ตัวละครซีรีส์ "มิวสอบ TOEIC" (วาดด้วยโค้ด ไม่ใช้รูป AI) + ตัวช่วยแอนิเมชัน ใช้ร่วมกันทุกตอน (ตอนที่ 2 ขึ้นไป)
// person(id, o) คืน SVG ของคน (จุดอ้างอิง = เท้า, สูง ~830) · face(id, อารมณ์, t) · arms(id, มุมแขนซ้าย, ขวา) · SHEETGUY = พี่ชีท
const $ = (id) => document.getElementById(id);
const cl = (x) => Math.max(0, Math.min(1, x));
const back = (p) => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const outc = (p) => 1 - Math.pow(1 - p, 3);

const MEW = { top: '#1F6FEB', legs: '#2B3A55' };
function person(id, o) {
  const sk = o.skin || '#F2C29B', hair = o.hair || '#1F1A24';
  const arm = (side) => `<g id="${id}-arm${side}" transform="translate(${side === 'L' ? -112 : 112} -540)"><rect x="-24" y="-6" width="48" height="150" rx="24" fill="${o.top}"/><rect x="-21" y="120" width="42" height="110" rx="21" fill="${sk}"/><circle cy="232" r="27" fill="${sk}"/></g>`;
  const hairBack = o.male ? '' : `<path d="M-150 -700 C-160 -860 160 -860 150 -700 L160 -575 C120 -560 90 -570 80 -600 L-80 -600 C-90 -570 -120 -560 -160 -575z" fill="${hair}"/>`;
  const bangs = o.male ? `<path d="M-125 -720 C-130 -840 130 -850 125 -720 C90 -770 40 -790 -10 -770 C-50 -790 -100 -770 -125 -720z" fill="${hair}"/>`
    : `<path d="M-128 -705 C-140 -850 140 -850 128 -705 C100 -760 40 -760 10 -790 C-20 -755 -80 -760 -128 -705z" fill="${hair}"/>`;
  return `<g id="${id}-legs"><rect x="-62" y="-260" width="46" height="250" rx="20" fill="${o.legs}"/><rect x="16" y="-260" width="46" height="250" rx="20" fill="${o.legs}"/><rect x="-78" y="-26" width="68" height="30" rx="14" fill="#0F1B33"/><rect x="10" y="-26" width="68" height="30" rx="14" fill="#0F1B33"/></g>
    ${arm('L')}${arm('R')}
    <path d="M-115 -560 Q0 -590 115 -560 L${o.male ? 105 : 140} -250 L${o.male ? -105 : -140} -250z" fill="${o.top}"/>
    ${o.male ? `${o.suit ? `<path d="M-45 -565 L0 -470 L45 -565z" fill="#F4F6FA"/>` : `<rect x="-105" y="-400" width="210" height="150" fill="${o.legs}"/>`}<path d="M0 -560 l-16 28 l16 140 l16 -140z" fill="${o.tie || '#E5484D'}"/>` : `<path d="M-125 -380 L125 -380 L150 -250 L-150 -250z" fill="${o.legs}"/>`}
    <rect x="-28" y="-610" width="56" height="60" fill="${sk}"/>
    ${hairBack}<circle cy="-700" r="122" fill="${sk}"/>${bangs}
    <circle cx="-62" cy="-655" r="18" fill="#F59AA6" opacity="0" id="${id}-blush1"/><circle cx="62" cy="-655" r="18" fill="#F59AA6" opacity="0" id="${id}-blush2"/>
    <line id="${id}-brL" x1="-68" y1="-750" x2="-22" y2="-752" stroke="${o.brow || hair}" stroke-width="10" stroke-linecap="round"/><line id="${id}-brR" x1="22" y1="-752" x2="68" y2="-750" stroke="${o.brow || hair}" stroke-width="10" stroke-linecap="round"/>
    <ellipse id="${id}-eyL" cx="-44" cy="-702" rx="14" ry="20" fill="#0F1B33"/><ellipse id="${id}-eyR" cx="44" cy="-702" rx="14" ry="20" fill="#0F1B33"/>
    ${o.glasses ? `<circle cx="-44" cy="-702" r="34" fill="none" stroke="#0F1B33" stroke-width="7"/><circle cx="44" cy="-702" r="34" fill="none" stroke="#0F1B33" stroke-width="7"/><line x1="-10" y1="-702" x2="10" y2="-702" stroke="#0F1B33" stroke-width="7"/>` : ''}
    <path id="${id}-mouth" d="M-30 -640 Q0 -615 30 -640" stroke="#7A2E2E" stroke-width="9" fill="#7A2E2E" stroke-linecap="round" stroke-linejoin="round"/>
    <path id="${id}-sweat" d="M140 -790 q22 38 0 52 q-22 -14 0 -52z" fill="#6EC1FF" opacity="0"/>`;
}
const MOUTH = { smile: 'M-30 -642 Q0 -612 30 -642', grin: 'M-38 -648 Q0 -585 38 -648z', shock: 'M-20 -650 a20 26 0 1 0 40 0 a20 26 0 1 0 -40 0z', sad: 'M-30 -625 Q0 -652 30 -625', flat: 'M-26 -636 L26 -636', talk: 'M-28 -646 Q0 -605 28 -646z' };
// อารมณ์: smile | happy | shock | sad | think | talk | determined | cringe
function face(id, mood, t) {
  const blink = (t % 3.3) < 0.12 ? 0.12 : 1;
  const ry = { shock: 27, happy: 7, sad: 18, think: 16, cringe: 9 }[mood] || 20;
  ['eyL', 'eyR'].forEach((e) => $(`${id}-${e}`).setAttribute('ry', ry * blink));
  $(`${id}-mouth`).setAttribute('d', MOUTH[{ shock: 'shock', happy: 'grin', sad: 'sad', cringe: 'sad', think: 'flat', talk: Math.floor(t * 9) % 2 ? 'talk' : 'flat', determined: 'smile' }[mood] || 'smile']);
  const br = { sad: 14, shock: 10, think: 6, cringe: -10, determined: -12 }[mood] || 0;
  $(`${id}-brL`).setAttribute('transform', `rotate(${-br} -45 -751) translate(0 ${mood === 'shock' ? -14 : 0})`); $(`${id}-brR`).setAttribute('transform', `rotate(${br} 45 -751) translate(0 ${mood === 'shock' ? -14 : 0})`);
  $(`${id}-sweat`).setAttribute('opacity', ['shock', 'sad'].includes(mood) ? 1 : 0);
  $(`${id}-sweat`).setAttribute('transform', `translate(0 ${((t * 40) % 30)})`);
  [1, 2].forEach((k) => $(`${id}-blush${k}`).setAttribute('opacity', mood === 'happy' ? 0.8 : 0));
}
function arms(id, L, R) { $(`${id}-armL`).setAttribute('transform', `translate(-112 -540) rotate(${L})`); $(`${id}-armR`).setAttribute('transform', `translate(112 -540) rotate(${R})`); }
// พี่ชีท: กระดาษมีหน้า + แว่น (มาสคอต SheetLab) · จุดอ้างอิง = ฐานกระดาษ
const SHEETGUY = `<path d="M-120 -330 h170 l70 70 v260 h-240z" fill="#fff" stroke="#0F1B33" stroke-width="8" stroke-linejoin="round"/><path d="M50 -330 v70 h70" fill="#DCE7F5" stroke="#0F1B33" stroke-width="8" stroke-linejoin="round"/>
  <rect x="-85" y="-120" width="170" height="14" rx="7" fill="#9DB4D3"/><rect x="-85" y="-85" width="130" height="14" rx="7" fill="#9DB4D3"/><rect x="-85" y="-50" width="150" height="14" rx="7" fill="#9DB4D3"/>
  <circle cx="-40" cy="-220" r="30" fill="none" stroke="#1F6FEB" stroke-width="8"/><circle cx="40" cy="-220" r="30" fill="none" stroke="#1F6FEB" stroke-width="8"/><line x1="-10" y1="-220" x2="10" y2="-220" stroke="#1F6FEB" stroke-width="8"/>
  <circle cx="-40" cy="-220" r="10" fill="#0F1B33"/><circle cx="40" cy="-220" r="10" fill="#0F1B33"/><path d="M-30 -170 Q0 -140 30 -170" stroke="#0F1B33" stroke-width="8" fill="none" stroke-linecap="round"/>`;

// ตัวช่วยของที่โผล่/หายตามเวลา: el มี data-in / data-out / data-anim (pop | fade | none | up)
function tick(els, t) {
  for (const el of els) {
    const a = +el.dataset.in, b = el.dataset.out ? +el.dataset.out : 1e9, k = el.dataset.anim || 'pop';
    const par = el.parentElement && el.parentElement.closest('[data-out]'); const bb = Math.min(b, par ? +par.dataset.out : 1e9);
    if (t < a || t > bb + 0.01) { el.style.opacity = 0; continue; }
    const p = cl((t - a) / (k === 'quick' ? 0.15 : 0.35)), q = cl((bb - t) / 0.2);
    el.style.opacity = k === 'none' ? 1 : Math.min(cl(p * 2.2), q);
    el.style.transform = k === 'pop' || k === 'quick' ? `scale(${(0.4 + 0.6 * back(p)) * (0.92 + 0.08 * q)})` : k === 'up' ? `translateY(${(1 - outc(p)) * 160}px)` : '';
  }
}

// 🔤 คำอังกฤษเด้ง (คุณแดน 23 ต.ค. 69 ไม่ใส่ซับอังกฤษเต็ม แต่ให้คำสำคัญเด้งตอนพากย์ถึง): POP = [[วินาที, 'crack', 'รอยร้าว', {top|left|right}], ...]
// การ์ดเล็กเหนือแถบซับ (ค่าเริ่มต้น top 1175 ชิดซ้าย พ้นพี่ชีทมุมขวา) · เด้งเร็ว 0.15 วิ อยู่ 1.6 วิ · ทีละคำ (ตัวถัดไปมา ตัวเก่าหายก่อน)
// อยู่ในขอบปลอดภัย IG/FB: ห้ามมีตัวหนังสือบนสุด 250 px และล่างสุด 380 px
function popWords(list) {
  if (!document.getElementById('popw-css')) document.head.insertAdjacentHTML('beforeend', `<style id="popw-css">.popw{position:absolute;z-index:9;display:flex;flex-direction:column;align-items:flex-start;padding:10px 30px 12px;border-radius:26px;background:#0F1B33F2;border:5px solid #FFB000;box-shadow:0 10px 0 #0F1B3355;transform-origin:left center}.popw span{font-weight:800;font-size:66px;line-height:1.05;color:#FFC93C;font-family:K,sans-serif}.popw i{font-style:normal;font-weight:600;font-size:34px;color:#fff;font-family:K,sans-serif}</style>`);
  const L = list.slice().sort((x, y) => x[0] - y[0]);
  return L.map(([t, en, th, o = {}], i) => { const end = Math.min(t + 1.6, L[i + 1] ? L[i + 1][0] - 0.05 : 1e9);
    const pos = `top:${o.top ?? 1175}px;` + (o.right != null ? `right:${o.right}px;transform-origin:right center;` : `left:${o.left ?? 50}px;`);
    return `<div class="popw" data-in="${t.toFixed(2)}" data-out="${end.toFixed(2)}" data-anim="quick" style="${pos}"><span>${en}</span><i>${th}</i></div>`; }).join('');
}
