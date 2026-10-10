// 🧮 เครื่องมือ IELTS ฟรี (ดึงคนจาก Google แบบ engnovate · คุณแดน 11 ต.ค. 69 "ทำเหมือน engnovate แต่ทำดีกว่า")
// /ielts-band-calculator คิดคะแนน Band จากจำนวนข้อที่ถูก (Listening / Reading Academic / Reading GT) + คะแนนรวม 4 ทักษะ · คิดในเบราว์เซอร์ อธิบายภาษาไทย
import { shell } from './quiz.js';

// ตารางแปลงคะแนนโดยประมาณ (ข้อที่ถูกจาก 40 ข้อ → Band) ตามที่เผยแพร่ทั่วไป · ข้อสอบจริงแต่ละชุดอาจต่างกันเล็กน้อย
export const TABLES = {
  listening: [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]],
  academic: [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]],
  general: [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1], [0, 0]],
};
export const rawToBand = (kind, raw) => { const n = Math.max(0, Math.min(40, Math.round(Number(raw) || 0))); return (TABLES[kind] || TABLES.listening).find(([min]) => n >= min)[1]; };
// คะแนนรวม: เฉลี่ย 4 ทักษะ · เศษ .25 ปัดขึ้นเป็น .5 · เศษ .75 ปัดขึ้นเป็นเต็ม · ต่ำกว่านั้นปัดลง
export const overallBand = (a) => { const v = a.reduce((s, x) => s + Number(x || 0), 0) / 4, f = Math.floor(v), d = v - f; return d >= 0.75 ? f + 1 : d >= 0.25 ? f + 0.5 : f; };
// ข้อที่ต้องถูกอย่างน้อยเพื่อให้ได้ Band เป้าหมาย
export const rawNeeded = (kind, band) => { const t = (TABLES[kind] || TABLES.listening).slice().reverse().find(([, b]) => b >= band); return t ? t[0] : null; };

export function bandCalcPage({ settings = {}, site = '' } = {}) {
  const T = JSON.stringify(TABLES);
  const body = `<header class="card"><span class="chip">ฟรี</span><h1>🧮 คำนวณคะแนน IELTS (Band Score Calculator)</h1><p>ใส่จำนวนข้อที่ทำถูก ระบบแปลงเป็น Band ทันที และคิดคะแนนรวม (Overall) ให้แบบเดียวกับ IELTS พร้อมบอกว่าต้องถูกอีกกี่ข้อถึงเป้าหมาย</p></header>
<section class="card bc"><h2>🎧 Listening</h2><label>ทำถูก <input type="number" min="0" max="40" inputmode="numeric" id="bc-l" placeholder="0–40"> / 40 ข้อ</label><p class="bc-out" id="bc-lo"></p></section>
<section class="card bc"><h2>📖 Reading</h2><div class="bc-k" role="group" aria-label="ประเภทข้อสอบ"><button type="button" data-k="academic" aria-pressed="true">Academic</button><button type="button" data-k="general" aria-pressed="false">General Training</button></div><label>ทำถูก <input type="number" min="0" max="40" inputmode="numeric" id="bc-r" placeholder="0–40"> / 40 ข้อ</label><p class="bc-out" id="bc-ro"></p></section>
<section class="card bc"><h2>⭐ คะแนนรวม (Overall)</h2><div class="bc-4">${['Listening', 'Reading', 'Writing', 'Speaking'].map((s, i) => `<label>${s}<select id="bc-s${i}">${[...Array(19).keys()].map((k) => k / 2).reverse().map((v) => `<option value="${v}"${v === 6 ? ' selected' : ''}>${v.toFixed(1)}</option>`).join('')}</select></label>`).join('')}</div><p class="bc-big" id="bc-ov"></p><p class="fine" id="bc-ovx"></p>
<label class="bc-goal">เป้าหมาย Overall <select id="bc-g">${[5, 5.5, 6, 6.5, 7, 7.5, 8].map((v) => `<option value="${v}"${v === 6.5 ? ' selected' : ''}>${v.toFixed(1)}</option>`).join('')}</select></label><p id="bc-gx"></p></section>
<section class="card"><h2>วิธีคิดคะแนน IELTS</h2><p><b>Listening และ Reading</b> มี 40 ข้อ นับจำนวนข้อที่ถูกแล้วแปลงเป็น Band ตามตาราง ตารางนี้เป็นค่าโดยประมาณที่ใช้กันทั่วไป ข้อสอบจริงแต่ละชุดอาจต่างกัน 1–2 ข้อ Reading แบบ General Training ต้องถูกมากกว่า Academic เพื่อได้ Band เท่ากัน</p>
<p><b>คะแนนรวม (Overall)</b> = ค่าเฉลี่ย 4 ทักษะ ถ้าเศษเป็น .25 ปัดขึ้นเป็น .5 ถ้าเศษเป็น .75 ปัดขึ้นเป็นเลขเต็ม เช่น เฉลี่ย 6.25 → 6.5 · เฉลี่ย 6.75 → 7.0 · เฉลี่ย 6.125 → 6.0</p>
<p><b>Writing และ Speaking</b> ให้คะแนนจาก 4 เกณฑ์ ลองให้ AI ตรวจและอธิบายเป็นภาษาไทยได้ที่ <a href="/vip/write">✍️ ตรวจ Writing</a> และ <a href="/vip/speak">🎙 ตรวจ Speaking</a> (ทดลองฟรี)</p></section>
<section class="card"><h2>ตารางแปลงคะแนน</h2><div class="tbl"><table><thead><tr><th>Band</th><th>Listening</th><th>Reading Academic</th><th>Reading GT</th></tr></thead><tbody>${[9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4].map((b) => `<tr><td><b>${b.toFixed(1)}</b></td>${['listening', 'academic', 'general'].map((k) => { const i = TABLES[k].findIndex(([, x]) => x === b), lo = TABLES[k][i][0], hi = i ? TABLES[k][i - 1][0] - 1 : 40; return `<td>${lo === hi ? lo : lo + '–' + hi}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></section>
<style>.bc label{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-weight:600}.bc input{width:90px;font:inherit;font-size:20px;padding:8px;border:1.5px solid #ccc;border-radius:10px}.bc-out{font-size:18px;margin:10px 0 0;min-height:1.5em}.bc-out b,.bc-big b{font-size:28px}.bc-k{display:flex;gap:8px;margin-bottom:8px}.bc-k button{flex:1;border:2px solid #ddd;background:#fff;border-radius:10px;padding:8px;font:inherit;font-weight:600;cursor:pointer}.bc-k button[aria-pressed="true"]{border-color:var(--brand,#2563eb);background:#eef4ff}
.bc-4{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.bc-4 label{display:flex;flex-direction:column;font-weight:600;gap:4px}.bc select{font:inherit;font-size:18px;padding:6px;border-radius:10px;border:1.5px solid #ccc}.bc-big{font-size:20px;margin:12px 0 0}.bc-goal{margin-top:12px}</style>
<script>(function(){var T=${T},rk='academic';function band(k,n){n=Math.max(0,Math.min(40,Math.round(+n||0)));for(var i=0;i<T[k].length;i++)if(n>=T[k][i][0])return T[k][i][1];return 0;}
function need(k,b){var t=T[k].slice().reverse();for(var i=0;i<t.length;i++)if(t[i][1]>=b)return t[i][0];return null;}
function ov(a){var v=(a[0]+a[1]+a[2]+a[3])/4,f=Math.floor(v),d=v-f;return d>=.75?f+1:d>=.25?f+.5:f;}
function out(id,k,inp){var v=document.getElementById(inp).value,o=document.getElementById(id);if(v===''){o.innerHTML='';return;}var b=band(k,v),nx=null;for(var i=T[k].length-1;i>=0;i--)if(T[k][i][1]>b){nx=T[k][i];break;}o.innerHTML='ได้ประมาณ <b>Band '+b.toFixed(1)+'</b>'+(nx?' · ถูกเพิ่มอีก '+(nx[0]-Math.round(+v))+' ข้อ ได้ Band '+nx[1].toFixed(1):'');}
function all(){out('bc-lo','listening','bc-l');out('bc-ro',rk,'bc-r');var a=[0,1,2,3].map(function(i){return +document.getElementById('bc-s'+i).value;}),o=ov(a),g=+document.getElementById('bc-g').value;
 document.getElementById('bc-ov').innerHTML='Overall <b>'+o.toFixed(1)+'</b>';document.getElementById('bc-ovx').textContent='เฉลี่ย '+((a[0]+a[1]+a[2]+a[3])/4).toFixed(3).replace(/0+$/,'').replace(/\\.$/,'')+' → ปัดเป็น '+o.toFixed(1);
 var gx=document.getElementById('bc-gx');if(o>=g){gx.innerHTML='✅ ถึงเป้าหมาย '+g.toFixed(1)+' แล้ว';}else{var low=a.indexOf(Math.min.apply(null,a)),nm=['Listening','Reading','Writing','Speaking'][low],b2=a.slice(),k=0;while(ov(b2)<g&&k<20){b2[low]+=.5;k++;}gx.innerHTML='ยังขาดอีกนิด: ถ้าเพิ่ม <b>'+nm+'</b> (ทักษะที่ต่ำสุด) เป็น <b>'+b2[low].toFixed(1)+'</b> จะได้ Overall '+ov(b2).toFixed(1)+(low<2?' · ต้องถูกประมาณ '+need(low?rk:'listening',b2[low])+'/40 ข้อ':'');}}
document.querySelectorAll('.bc input,.bc select').forEach(function(x){x.addEventListener('input',all);});
document.querySelectorAll('[data-k]').forEach(function(b){b.onclick=function(){rk=b.dataset.k;document.querySelectorAll('[data-k]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});all();};});all();})();</script>`;
  const faq = [['IELTS Listening ถูกกี่ข้อได้ 7', `ประมาณ ${rawNeeded('listening', 7)}–${rawNeeded('listening', 7.5) - 1} ข้อจาก 40 ข้อ`], ['IELTS Reading Academic ถูกกี่ข้อได้ 6.5', `ประมาณ ${rawNeeded('academic', 6.5)}–${rawNeeded('academic', 7) - 1} ข้อจาก 40 ข้อ`], ['คะแนนรวม IELTS ปัดยังไง', 'เฉลี่ย 4 ทักษะ เศษ .25 ปัดขึ้นเป็น .5 และเศษ .75 ปัดขึ้นเป็นเลขเต็ม']];
  return shell({ title: 'คำนวณคะแนน IELTS Band Score Calculator ฟรี (Listening Reading Overall)', desc: 'คำนวณ Band IELTS จากจำนวนข้อที่ถูก Listening Reading Academic/General และคะแนนรวม Overall พร้อมบอกว่าต้องถูกอีกกี่ข้อถึงเป้าหมาย อธิบายภาษาไทย', canonical: `${site}/ielts-band-calculator`, body, pixelId: settings.pixelId, tab: 'vip',
    ld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) } });
}
