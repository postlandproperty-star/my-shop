// หน้าสมาชิก VIP (/vip) และสมุดจุดพลาด (/vip/review) · สถานะสมาชิกโหลดในเบราว์เซอร์จาก /api/order?m=vip_me (คุกกี้ HttpOnly)
import { shell } from './quiz.js';
import { vipSellable, VIP_PAGE } from './members.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const baht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');

// preview = ตัวอย่างในแท็บ 👑 สมาชิก ของหลังบ้าน: แสดงราคาแม้ยังไม่เปิดรับ แต่กดสมัครไม่ได้
export function vipPage(v, { settings = {}, site = '', preview = false } = {}) {
  const pg = v.page || VIP_PAGE, hasPrice = v.monthly > 0 || v.yearly > 0 || Object.values(v.packs).some((x) => x > 0);
  const sell = vipSellable(v) || (preview && hasPrice);
  const plans = [
    v.monthly > 0 && `<div class="vp-plan"><b>รายเดือน</b><span class="vp-price">${baht(v.monthly)}<small>/เดือน</small></span><span class="fine">ตัดบัตรอัตโนมัติ ยกเลิกเองได้ทุกเมื่อ</span><button class="btn vp-buy" data-plan="monthly">สมัครด้วยบัตร</button></div>`,
    v.yearly > 0 && `<div class="vp-plan vp-best"><b>รายปี</b><span class="vp-price">${baht(v.yearly)}<small>/ปี</small></span><span class="fine">${v.monthly > 0 ? `เฉลี่ยเดือนละ ${baht(Math.round(v.yearly / 12))}` : 'ตัดบัตรปีละครั้ง'} · ยกเลิกเองได้</span><button class="btn vp-buy" data-plan="yearly">สมัครด้วยบัตร</button></div>`,
  ].filter(Boolean).join('');
  const packs = [1, 3, 12].filter((m) => v.packs[m] > 0).map((m) => `<button class="vp-pack" data-months="${m}"><b>${m} เดือน</b><span>${baht(v.packs[m])}</span></button>`).join('');
  const body = `${preview ? `<p class="vp-pv">👀 ตัวอย่างหน้าที่ลูกค้าเห็น${v.open ? ' (เปิดรับอยู่)' : ' · ยังไม่เปิดรับ ลูกค้ายังสมัครไม่ได้'} · ปุ่มในตัวอย่างกดสมัครไม่ได้</p>` : ''}<header class="card vp-hero"><span class="chip">สมาชิก</span><h1>${esc(pg.title)}</h1><p>${esc(pg.sub)}</p></header>
<section class="card" id="vp-acc" aria-live="polite"><p class="fine">กำลังโหลด...</p></section>
<section class="card"><h2>ได้อะไรบ้าง</h2><div class="tbl"><table><thead><tr><th></th><th>ฟรี</th><th>VIP</th></tr></thead><tbody>${pg.perks.map((x) => `<tr><td>${esc(x.t)}</td><td>${x.free ? '✅' : '–'}</td><td>${x.vip === 'soon' ? '🔜' : x.vip === 'yes' ? '✅' : '–'}</td></tr>`).join('')}</tbody></table></div></section>
<section class="card" id="vp-price"><h2>ราคา</h2>${sell ? `${plans ? `<div class="vp-plans">${plans}</div>` : ''}${packs ? `<p class="fine" style="margin:12px 0 6px">หรือจ่ายด้วย PromptPay ล่วงหน้า (ไม่ตัดอัตโนมัติ)</p><div class="vp-packs">${packs}</div>` : ''}<div id="vp-qr" hidden></div><p class="err" id="vp-err" hidden></p>` : '<p>เปิดรับสมาชิกเร็วๆ นี้ ระหว่างนี้ใช้คลังข้อสอบและคลังความรู้ได้ฟรีทั้งหมด</p><p><a class="btn" href="/quiz">ไปคลังข้อสอบ</a></p>'}</section>
${pg.faq.length ? `<section class="card"><h2>คำถามที่พบบ่อย</h2>${pg.faq.map((x) => `<details><summary><b>${esc(x.q)}</b></summary><p>${esc(x.a)}</p></details>`).join('')}</section>` : ''}
${preview ? PREVIEW_JS : VIP_JS}`;
  return shell({ title: `${pg.title} สมาชิกฝึกข้อสอบภาษาอังกฤษ · สมุดจุดพลาด`, desc: `${pg.title} ${pg.sub}`.slice(0, 160), canonical: `${site}/vip`, body, pixelId: preview ? '' : settings.pixelId, noindex: preview, tab: 'vip' });
}

export function vipReviewPage({ settings = {}, site = '' } = {}) {
  const body = `<header class="card"><span class="chip">VIP</span><h1>สมุดจุดพลาด</h1><p class="fine">ข้อที่คุณเคยตอบผิดจากคลังข้อสอบ ตอบถูกแล้วจะออกจากสมุดเอง</p></header><div id="rv-list" aria-live="polite"><p class="card fine">กำลังโหลด...</p></div>${REVIEW_JS}`;
  return shell({ title: 'สมุดจุดพลาด · SheetLab VIP', desc: 'ทวนข้อที่ตอบผิด', canonical: `${site}/vip/review`, body, pixelId: settings.pixelId, noindex: true, tab: 'vip' });
}

// ตัวอย่าง: ไม่เรียกระบบสมาชิก ไม่สร้างการจ่ายเงิน แค่แสดงกล่องเข้าระบบแบบที่ลูกค้าเห็น
const PREVIEW_JS = `<script>(function(){var a=document.getElementById('vp-acc');a.innerHTML='<h2>เข้าสู่ระบบ</h2><p class="fine">ใส่อีเมล แล้วกดลิงก์ที่ส่งไปในอีเมล ไม่ต้องตั้งรหัสผ่าน</p><form class="vp-form" onsubmit="return false"><input type="email" placeholder="name@gmail.com" aria-label="อีเมล" disabled><button disabled>ส่งลิงก์เข้าระบบ</button></form>';
document.querySelectorAll('.vp-buy,.vp-pack').forEach(function(b){b.disabled=true;b.title='ตัวอย่าง กดสมัครไม่ได้';});})();</script>`;

const VIP_JS = `<script>(function(){var acc=document.getElementById('vp-acc'),me=null;
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function d(x){return new Date(x).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});}
function post(m,b){return fetch('/api/order?m='+m,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{}),credentials:'same-origin'}).then(function(r){return r.json();});}
function err(t){var x=document.getElementById('vp-err');if(x){x.textContent=t;x.hidden=!t;}}
function draw(){var q=new URLSearchParams(location.search),h='';if(!me.email&&!(me.settings&&me.settings.open)&&q.get('e')!=='link'){acc.hidden=true;return;}acc.hidden=false;
 if(q.get('e')==='link')h+='<p class="err">ลิงก์หมดอายุหรือใช้ไม่ได้ ขอลิงก์ใหม่ด้านล่าง</p>';
 if(!me.email){h+='<h2>เข้าสู่ระบบ</h2><p class="fine">ใส่อีเมล แล้วกดลิงก์ที่ส่งไปในอีเมล ไม่ต้องตั้งรหัสผ่าน</p><form class="vp-form" id="vp-login"><input type="email" required placeholder="name@gmail.com" aria-label="อีเมล" id="vp-email"><button>ส่งลิงก์เข้าระบบ</button></form><p class="fine" id="vp-sent" hidden></p>';}
 else if(me.active){h+=(q.get('welcome')?'<p class="vp-ok">ยินดีต้อนรับสู่ VIP 🎉</p>':'')+'<h2>สมาชิก VIP ✅</h2><p>'+e(me.email)+' · ใช้ได้ถึง <b>'+d(me.until)+'</b>'+(me.cancelAt?' (ยกเลิกการต่ออายุแล้ว)':me.card?' · ต่ออายุอัตโนมัติ':'')+'</p><div class="vp-act"><a class="btn" href="/vip/review">📒 เปิดสมุดจุดพลาด</a><a class="btn" href="/quiz" style="background:var(--bg);color:var(--ink)">ทำข้อสอบต่อ</a>'+(me.card&&!me.cancelAt?'<button class="ghost" id="vp-cancel">ยกเลิกการต่ออายุ</button>':'')+'<button class="ghost" id="vp-out">ออกจากระบบ</button></div>';}
 else{h+='<h2>บัญชีของคุณ</h2><p>'+e(me.email)+' · ยังไม่เป็นสมาชิก'+(me.until?' (หมดอายุ '+d(me.until)+')':'')+'</p>'+(me.settings.open?'<p class="fine">เลือกแบบสมาชิกด้านล่าง</p>':'')+'<div class="vp-act"><button class="ghost" id="vp-out">ออกจากระบบ</button></div>';}
 acc.innerHTML=h;
 var f=document.getElementById('vp-login');if(f)f.onsubmit=function(ev){ev.preventDefault();var b=f.querySelector('button');b.disabled=true;post('vip_login',{email:document.getElementById('vp-email').value.trim()}).then(function(j){var s=document.getElementById('vp-sent');s.hidden=false;s.textContent=j.ok?'ส่งลิงก์ไปที่อีเมลแล้ว เปิดอีเมลแล้วกดลิงก์ (ดูในจดหมายขยะด้วย)':(j.error||'ส่งไม่สำเร็จ');b.disabled=false;});};
 var o=document.getElementById('vp-out');if(o)o.onclick=function(){post('vip_logout').then(function(){location.href='/vip';});};
 var c=document.getElementById('vp-cancel');if(c)c.onclick=function(){if(!confirm('ยกเลิกการต่ออายุ? ใช้ได้จนหมดรอบที่จ่ายแล้ว'))return;post('vip_cancel').then(function(j){if(j.ok)load();else alert(j.error||'ไม่สำเร็จ');});};}
function need(){if(me&&me.email)return true;err('');acc.scrollIntoView({behavior:'smooth',block:'center'});var i=document.getElementById('vp-email');if(i)i.focus();var s=document.getElementById('vp-sent');if(s){s.hidden=false;s.textContent='ใส่อีเมลเพื่อเข้าสู่ระบบก่อน แล้วค่อยกดสมัคร';}return false;}
document.querySelectorAll('.vp-buy').forEach(function(b){b.onclick=function(){if(!need())return;b.disabled=true;post('vip_buy',{plan:b.dataset.plan}).then(function(j){if(j.ok&&j.url)location.href=j.url;else{err(j.error||'ไม่สำเร็จ');b.disabled=false;}});};});
document.querySelectorAll('.vp-pack').forEach(function(b){b.onclick=function(){if(!need())return;b.disabled=true;post('vip_qr',{months:+b.dataset.months}).then(function(j){b.disabled=false;if(!j.ok){err(j.error||'ไม่สำเร็จ');return;}var w=document.getElementById('vp-qr');w.hidden=false;w.innerHTML='<p><b>สแกนจ่าย '+e(j.amount)+' บาท</b></p><img alt="QR PromptPay" src="'+e(j.png)+'"><p class="fine">จ่ายแล้วหน้านี้จะเปิดสิทธิ์ให้เอง</p>';w.scrollIntoView({behavior:'smooth',block:'center'});
 var t=setInterval(function(){fetch('/api/order?pi='+encodeURIComponent(j.pi)+'&k='+encodeURIComponent(j.k)).then(function(r){return r.json();}).then(function(x){if(x&&x.paid){clearInterval(t);w.innerHTML='<p class="vp-ok">จ่ายสำเร็จ เปิดสิทธิ์ VIP แล้ว 🎉</p>';load();}}).catch(function(){});},3000);});};});
function load(){fetch('/api/order?m=vip_me',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){me=j;draw();}).catch(function(){acc.innerHTML='<p class="err">โหลดไม่สำเร็จ ลองรีเฟรช</p>';});}
load();})();</script>`;

const REVIEW_JS = `<script>(function(){var box=document.getElementById('rv-list'),L='ABCD';
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
fetch('/api/order?m=vip_mistakes',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){
 if(!j.ok){box.innerHTML='<section class="card"><p>'+e(j.error||'โหลดไม่สำเร็จ')+'</p><p><a class="btn" href="/vip">ไปหน้า VIP</a></p></section>';return;}
 if(!j.open.length){box.innerHTML='<section class="card"><p>ยังไม่มีข้อที่ต้องทวน 🎉'+(j.fixed?' (แก้ถูกแล้ว '+j.fixed+' ข้อ)':'')+'</p><p><a class="btn" href="/quiz">ทำข้อสอบต่อ</a></p></section>';return;}
 box.innerHTML='<p class="fine" style="margin:0 0 8px">เหลือ '+j.open.length+' ข้อ'+(j.fixed?' · แก้ถูกแล้ว '+j.fixed+' ข้อ':'')+'</p>'+j.open.map(function(x,n){return '<section class="card q" data-n="'+n+'"><span class="chip">'+e(x.title)+' · ข้อ '+(x.i+1)+(x.wrong>1?' · ผิด '+x.wrong+' ครั้ง':'')+'</span><p style="font-weight:600;white-space:pre-line">'+e(x.q)+'</p><div class="ch">'+x.choices.map(function(c,k){return '<button type="button" data-k="'+k+'">('+L[k]+') '+e(c)+'</button>';}).join('')+'</div><p class="ex">'+e(x.explain)+'</p></section>';}).join('');
 box.querySelectorAll('.q').forEach(function(sec){var x=j.open[+sec.dataset.n];sec.querySelectorAll('.ch button').forEach(function(b){b.onclick=function(){if(sec.classList.contains('done'))return;var k=+b.dataset.k,bs=sec.querySelectorAll('.ch button'),ok=k===x.answer;if(!ok)b.classList.add('wrong');bs[x.answer].classList.add('right');bs.forEach(function(y){y.disabled=true;});sec.classList.add('done');
  fetch('/api/order?m=vip_mark',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quiz:x.quiz,q:x.i,ok:ok}),credentials:'same-origin'}).catch(function(){});};});});
}).catch(function(){box.innerHTML='<p class="card err">โหลดไม่สำเร็จ ลองรีเฟรช</p>';});})();</script>`;
