// หน้าสมาชิก VIP (/vip) และสมุดจุดพลาด (/vip/review) · สถานะสมาชิกโหลดในเบราว์เซอร์จาก /api/order?m=vip_me (คุกกี้ HttpOnly)
import { shell } from './quiz.js';
import { vipSellable, VIP_PAGE } from './members.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const baht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');

// เข้าระบบด้วยอีเมล: ส่งรหัส 6 หลัก (หรือกดปุ่มในอีเมล) ใช้ร่วมกันทุกหน้า
const LOGIN_FN = `function P(m,o){return fetch('/api/order?m='+m,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o||{}),credentials:'same-origin'}).then(function(r){return r.json();});}
function slLogin(el,done,pre){el.innerHTML=(pre||'')+'<section class="card"><h2>เข้าสู่ระบบ</h2><p class="fine">ใส่อีเมลที่ใช้ซื้อชีทหรือสมัครสมาชิก ระบบส่งรหัส 6 หลักไปที่อีเมล ไม่ต้องตั้งรหัสผ่าน</p><form class="vp-form" id="sl-lf"><input type="email" required autocomplete="email" placeholder="name@gmail.com" aria-label="อีเมล" id="sl-le"><button>ส่งรหัส</button></form><p class="fine" id="sl-ls" hidden></p><form class="vp-form" id="sl-cf" hidden><input id="sl-lc" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="รหัส 6 หลัก" aria-label="รหัส 6 หลักจากอีเมล"><button>เข้าสู่ระบบ</button></form><p class="err" id="sl-lx" hidden></p></section>';
 var f=el.querySelector('#sl-lf'),cf=el.querySelector('#sl-cf'),em='';
 f.onsubmit=function(ev){ev.preventDefault();var b=f.querySelector('button');b.disabled=true;em=el.querySelector('#sl-le').value.trim();P('vip_login',{email:em,next:'account'}).then(function(j){var s=el.querySelector('#sl-ls');s.hidden=false;b.disabled=false;if(j.ok){s.textContent='ส่งรหัสไปที่ '+em+' แล้ว ใส่รหัส 6 หลักด้านล่าง (ดูในจดหมายขยะด้วย) หรือกดปุ่มในอีเมลก็ได้';cf.hidden=false;b.textContent='ส่งรหัสอีกครั้ง';el.querySelector('#sl-lc').focus();}else s.textContent=j.error||'ส่งไม่สำเร็จ';}).catch(function(){b.disabled=false;});};
 cf.onsubmit=function(ev){ev.preventDefault();var b=cf.querySelector('button'),x=el.querySelector('#sl-lx');b.disabled=true;x.hidden=true;P('vip_code',{email:em,code:el.querySelector('#sl-lc').value}).then(function(j){b.disabled=false;if(j.ok)done();else{x.hidden=false;x.textContent=j.error||'ไม่สำเร็จ';}}).catch(function(){b.disabled=false;});};}`;


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

const VIP_JS = `<script>(function(){${LOGIN_FN}
var acc=document.getElementById('vp-acc'),me=null;
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function d(x){return new Date(x).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});}
function post(m,b){return fetch('/api/order?m='+m,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{}),credentials:'same-origin'}).then(function(r){return r.json();});}
function err(t){var x=document.getElementById('vp-err');if(x){x.textContent=t;x.hidden=!t;}}
function draw(){var q=new URLSearchParams(location.search),h='';if(!me.email&&!(me.settings&&me.settings.open)&&q.get('e')!=='link'){acc.hidden=true;return;}acc.hidden=false;
 if(!me.email){slLogin(acc,load,q.get('e')==='link'?'<p class="err">ลิงก์หมดอายุหรือใช้ไม่ได้ ขอรหัสใหม่ด้านล่าง</p>':'');var s=acc.querySelector('section.card');if(s)s.classList.remove('card');return;}
 if(q.get('e')==='link')h+='<p class="err">ลิงก์หมดอายุหรือใช้ไม่ได้ ขอลิงก์ใหม่ด้านล่าง</p>';
 if(!me.email){h+='<h2>เข้าสู่ระบบ</h2><p class="fine">ใส่อีเมล แล้วกดลิงก์ที่ส่งไปในอีเมล ไม่ต้องตั้งรหัสผ่าน</p><form class="vp-form" id="vp-login"><input type="email" required placeholder="name@gmail.com" aria-label="อีเมล" id="vp-email"><button>ส่งลิงก์เข้าระบบ</button></form><p class="fine" id="vp-sent" hidden></p>';}
 else if(me.active){h+=(q.get('welcome')?'<p class="vp-ok">ยินดีต้อนรับสู่ VIP 🎉</p>':'')+'<h2>สมาชิก VIP ✅</h2><p>'+e(me.email)+' · ใช้ได้ถึง <b>'+d(me.until)+'</b>'+(me.cancelAt?' (ยกเลิกการต่ออายุแล้ว)':me.card?' · ต่ออายุอัตโนมัติ':'')+'</p><div class="vp-act"><a class="btn" href="/vip/write">✍️ ตรวจ IELTS Writing</a><a class="btn" href="/vip/mock">⏱️ ข้อสอบเสมือนจริง</a><a class="btn" href="/vip/review">📒 เปิดสมุดจุดพลาด</a><a class="btn" href="/quiz" style="background:var(--bg);color:var(--ink)">ทำข้อสอบต่อ</a>'+(me.card&&!me.cancelAt?'<button class="ghost" id="vp-cancel">ยกเลิกการต่ออายุ</button>':'')+'<button class="ghost" id="vp-out">ออกจากระบบ</button></div>';}
 else{h+='<h2>บัญชีของคุณ</h2><p>'+e(me.email)+' · ยังไม่เป็นสมาชิก'+(me.until?' (หมดอายุ '+d(me.until)+')':'')+'</p>'+(me.settings.open?'<p class="fine">เลือกแบบสมาชิกด้านล่าง</p>':'')+'<div class="vp-act"><button class="ghost" id="vp-out">ออกจากระบบ</button></div>';}
 acc.innerHTML=h;
 var f=document.getElementById('vp-login');if(f)f.onsubmit=function(ev){ev.preventDefault();var b=f.querySelector('button');b.disabled=true;post('vip_login',{email:document.getElementById('vp-email').value.trim()}).then(function(j){var s=document.getElementById('vp-sent');s.hidden=false;s.textContent=j.ok?'ส่งลิงก์ไปที่อีเมลแล้ว เปิดอีเมลแล้วกดลิงก์ (ดูในจดหมายขยะด้วย)':(j.error||'ส่งไม่สำเร็จ');b.disabled=false;});};
 var o=document.getElementById('vp-out');if(o)o.onclick=function(){post('vip_logout').then(function(){location.href='/vip';});};
 var c=document.getElementById('vp-cancel');if(c)c.onclick=function(){if(!confirm('ยกเลิกการต่ออายุ? ใช้ได้จนหมดรอบที่จ่ายแล้ว'))return;post('vip_cancel').then(function(j){if(j.ok)load();else alert(j.error||'ไม่สำเร็จ');});};}
function need(){if(me&&me.email)return true;err('');acc.scrollIntoView({behavior:'smooth',block:'center'});var i=document.getElementById('sl-le');if(i)i.focus();var s=document.getElementById('sl-ls');if(s){s.hidden=false;s.textContent='ใส่อีเมลเพื่อเข้าสู่ระบบก่อน แล้วค่อยกดสมัคร';}return false;}
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

// การ์ด "เพิ่ม SheetLab ลงหน้าจอ" (ซ่อนเมื่อเปิดจากหน้าจอโฮมอยู่แล้ว / บนคอมที่ติดตั้งไม่ได้)
const INSTALL_JS = `<script>(function(){try{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(function(){});}catch(x){}
var st=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true,box=document.getElementById('pwa-box'),ev=null,ua=navigator.userAgent,ios=/iphone|ipad|ipod/i.test(ua),mob=ios||/android/i.test(ua);
if(!box||st)return;
function show(){if(!ev&&!mob)return;box.hidden=false;box.innerHTML='<b>📲 เพิ่ม SheetLab ลงหน้าจอ</b><span class="fine">เปิดฝึกได้ในแตะเดียว เต็มจอเหมือนแอป ไม่ต้องโหลดจาก App Store</span>'+(ev?'<button class="btn" id="pwa-go">เพิ่มลงหน้าจอ</button>':ios?'<span class="pwa-how">กดปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) → เลือก <b>เพิ่มไปยังหน้าจอโฮม</b> → <b>เพิ่ม</b></span>':'<span class="pwa-how">เปิดเมนูของเบราว์เซอร์ (⋮) → เลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b></span>');
 var g=document.getElementById('pwa-go');if(g)g.onclick=function(){ev.prompt();ev.userChoice.then(function(){ev=null;box.hidden=true;});};}
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();ev=e;show();});show();})();</script>`;

// หน้าแอป (/app): หน้าแรกเมื่อเปิดจากไอคอนบนหน้าจอ · ทางลัดไปทุกบริการ
export function appPage({ settings = {}, site = '' } = {}) {
  const t = (href, i, b, s, cls = '', id = '') => `<a class="app-t${cls}" href="${href}"><i aria-hidden="true">${i}</i><b>${b}</b><span${id ? ` id="${id}"` : ''}>${s}</span></a>`;
  const body = `<header class="card app-hi"><h1>ฝึกภาษาอังกฤษวันนี้ 👋</h1><p class="fine" id="app-me">กำลังโหลด...</p></header>
<div id="pwa-box" class="card pwa-box" hidden></div>
<div class="app-grid">${t('/vip/write', '✍️', 'ตรวจ IELTS Writing ด้วย AI', 'อธิบายภาษาไทย · ทดลองฟรี 1 ครั้ง', ' app-wide')}${t('/vip/mock', '⏱️', 'ข้อสอบเสมือนจริง', 'จับเวลา · VIP', ' app-vip')}${t('/vip/review', '📒', 'สมุดจุดพลาด', 'ทวนข้อที่เคยผิด · VIP', ' app-vip', 'app-rv')}${t('/quiz/daily', '📅', 'ข้อสอบวันนี้', 'วันละข้อ ไม่ถึงนาที')}${t('/quiz', '📚', 'คลังข้อสอบ', 'ฝึกฟรีพร้อมเฉลย')}${t('/learn', '📖', 'ความรู้', 'สรุปทุกหัวข้อ')}${t('/store', '🛒', 'ร้านชีท', 'ชีทสรุป PDF')}${t('/free', '🎁', 'ชีทแจกฟรี', 'รับไฟล์ทันที')}${t('/account', '👤', 'บัญชีของฉัน', 'ชีทที่ซื้อ · สมาชิก')}</div>
<div id="app-login"></div>${APP_JS}${INSTALL_JS}`;
  return shell({ title: 'SheetLab ฝึกข้อสอบภาษาอังกฤษ', desc: 'ข้อสอบ TOEIC IELTS TGAT ก.พ. พร้อมเฉลย ข้อสอบเสมือนจริงจับเวลา และสมุดจุดพลาด', canonical: `${site}/app`, body, pixelId: settings.pixelId, noindex: true, tab: 'app' });
}
const APP_JS = `<script>(function(){${LOGIN_FN}
var me=document.getElementById('app-me');function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
fetch('/api/order?m=vip_me',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){var open=j.settings&&j.settings.open;
 if(!j.email){me.innerHTML='ยังไม่ได้เข้าสู่ระบบ · <button class="chip" id="app-in">เข้าสู่ระบบ</button>';document.getElementById('app-in').onclick=function(){var b=document.getElementById('app-login');slLogin(b,function(){location.reload();});b.scrollIntoView({behavior:'smooth',block:'start'});};}
 else me.innerHTML=e(j.email)+' · '+(j.active?'👑 VIP ใช้ได้ถึง '+new Date(j.until).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'ยังไม่เป็น VIP'+(open?' · <a href="/vip">ดูสิทธิ์ VIP</a>':''));
 if(j.active&&j.review!=null)document.getElementById('app-rv').textContent=j.review?'เหลือทวน '+j.review+' ข้อ':'ไม่มีข้อค้าง 🎉';
 if(!j.active)document.querySelectorAll('.app-vip').forEach(function(a){a.classList.add('lock');if(open)a.href='/vip';});
}).catch(function(){me.textContent='โหลดไม่สำเร็จ ลองรีเฟรช';});})();</script>`;

// บัญชีของฉัน (/account): บัญชีเดียวใช้ได้ทุกบริการ · ข้อมูลโหลดในเบราว์เซอร์จาก /api/order?m=vip_acct (คุกกี้ HttpOnly)
export function accountPage({ settings = {}, site = '' } = {}) {
  const body = `<header class="card"><span class="chip">บัญชีของฉัน</span><h1>บัญชี SheetLab</h1><p class="fine">ชีทที่ซื้อแล้ว สมาชิก VIP และข้อที่ต้องทวน อยู่ในที่เดียว เข้าด้วยอีเมลที่ใช้ซื้อหรือสมัคร ไม่ต้องตั้งรหัสผ่าน</p></header>
<div id="pwa-box" class="card pwa-box" hidden></div>
<div id="ac" aria-live="polite"><p class="card fine">กำลังโหลด...</p></div>${ACCOUNT_JS}${INSTALL_JS}`;
  return shell({ title: 'บัญชีของฉัน · SheetLab', desc: 'ดูชีทที่ซื้อแล้ว โหลดไฟล์ใหม่ได้ตลอด และจัดการสมาชิก VIP', canonical: `${site}/account`, body, pixelId: settings.pixelId, noindex: true, tab: 'account' });
}

const ACCOUNT_JS = `<script>(function(){${LOGIN_FN}
var box=document.getElementById('ac'),q=new URLSearchParams(location.search);
if(q.get('course')){location.replace('/my-learning?c='+encodeURIComponent(q.get('course')));return;}
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function d(x){return new Date(x).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});}
function b(n){return '฿'+Number(n||0).toLocaleString('th-TH');}
var post=P;
function login(){slLogin(box,function(){location.href=q.get('next')==='my-learning'?'/my-learning'+(q.get('c')?'?c='+encodeURIComponent(q.get('c')):''):'/account?in=1';},q.get('e')==='link'?'<p class="card err">ลิงก์หมดอายุหรือใช้ไม่ได้ ขอรหัสใหม่ด้านล่าง</p>':'');}
function file(i){var n=/notion\\.(so|site)/.test(i.link);return '<a class="btn ac-dl" href="'+e(i.link)+'" target="_blank" rel="noopener">'+(n?'เปิดเทมเพลต ':'⬇ ')+e(i.name)+'</a>';}
function draw(j){var v=j.vip||{},h='';
 if(q.get('in'))h+='<p class="vp-ok">เข้าสู่ระบบแล้ว ✅</p>';
 h+='<section class="card ac-me"><span>'+e(j.email)+'</span><button class="ghost" id="ac-out">ออกจากระบบ</button></section>';
 var C=j.courses||[];if(C.length)h+='<section class="card"><h2>🎓 คอร์สของฉัน <a class="fine" href="/my-learning" style="float:right">เปิดหน้าเรียน ›</a></h2>'+C.map(function(c,i){var n=c.lessons.length,k=c.done.length,p=n?Math.round(k/n*100):0;return '<div class="cs-card"><b>'+e(c.title)+'</b><div class="cs-bar"><i style="width:'+p+'%"></i></div><p class="fine">เรียนแล้ว '+k+'/'+n+' บท ('+p+'%)</p><a class="btn cs-go" href="/my-learning?c='+encodeURIComponent(c.slug)+'">'+(k?'เรียนต่อ ›':'เริ่มเรียน ›')+'</a></div>';}).join('')+'</section>';
 h+='<section class="card"><h2>📄 ชีทของฉัน</h2>'+(j.orders.length?j.orders.map(function(o){return '<div class="ac-ord"><p class="fine">'+d(o.at)+' · '+e(o.name)+(o.amount?' · '+b(o.amount):'')+'</p>'+(o.items.length?'<div class="ac-items">'+o.items.map(file).join('')+'</div>':'<p class="fine">'+(o.err?'โหลดรายการไม่สำเร็จ ลองรีเฟรช':'ร้านกำลังเตรียมไฟล์ ทักแชทร้านได้เลย')+'</p>')+'</div>';}).join('')+(j.more?'<p class="fine">แสดงออเดอร์ล่าสุด 12 รายการ</p>':''):'<p>ยังไม่มีชีทที่ซื้อด้วยอีเมลนี้</p><p class="fine">ถ้าซื้อด้วยอีเมลอื่น ออกจากระบบแล้วเข้าด้วยอีเมลนั้น</p><p><a class="btn" href="/store">ไปร้านชีท</a></p>')+'</section>';
 h+='<section class="card"><h2>👑 สมาชิก VIP</h2>'+(v.active?'<p>ใช้ได้ถึง <b>'+d(v.until)+'</b>'+(v.cancelAt?' (ยกเลิกการต่ออายุแล้ว)':v.card?' · ต่ออายุอัตโนมัติ':'')+'</p><div class="vp-act"><a class="btn" href="/vip/write">✍️ ตรวจ IELTS Writing</a><a class="btn" href="/vip/mock">⏱️ ข้อสอบเสมือนจริง</a><a class="btn" href="/vip/review">📒 สมุดจุดพลาด'+(j.review?' ('+j.review+' ข้อ)':'')+'</a><a class="btn" href="/vip" style="background:var(--bg);color:var(--ink)">จัดการสมาชิก</a></div>':'<p>ยังไม่เป็นสมาชิก'+(v.until?' (หมดอายุ '+d(v.until)+')':'')+'</p>'+(j.settings&&j.settings.open?'<p><a class="btn" href="/vip">ดูสิทธิ์และราคา VIP</a></p>':'<p class="fine">ระบบสมาชิกเปิดเร็วๆ นี้ ระหว่างนี้ฝึกฟรีได้ที่ <a href="/quiz">คลังข้อสอบ</a></p>'))+'</section>';
 box.innerHTML=h;document.getElementById('ac-out').onclick=function(){post('vip_logout').then(function(){location.href='/account';});};}
fetch('/api/order?m=vip_acct',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){if(!j.ok){box.innerHTML='<p class="card err">'+e(j.error||'โหลดไม่สำเร็จ')+'</p>';return;}if(!j.email)login();else draw(j);}).catch(function(){box.innerHTML='<p class="card err">โหลดไม่สำเร็จ ลองรีเฟรช</p>';});})();</script>`;

// ข้อสอบเสมือนจริงจับเวลา (/vip/mock) · รายการชุดดูได้ทุกคน เริ่มทำได้เฉพาะสมาชิก VIP
export function vipMockPage({ settings = {}, site = '' } = {}) {
  const body = `<header class="card"><span class="chip">VIP</span><h1>⏱️ ข้อสอบเสมือนจริง</h1><p class="fine">จับเวลาเหมือนห้องสอบ ทำจบแล้วเห็นคะแนนทันที พร้อมเฉลยทุกข้อ ข้อที่พลาดเข้าสมุดจุดพลาดให้ทวนต่อ · ข้อสอบแต่งใหม่เพื่อการฝึก ไม่ใช่ข้อสอบจริง</p></header>
<div id="mk" aria-live="polite"><p class="card fine">กำลังโหลด...</p></div>${MOCK_JS}`;
  return shell({ title: 'ข้อสอบเสมือนจริงจับเวลา · SheetLab VIP', desc: 'ข้อสอบภาษาอังกฤษจับเวลา TOEIC IELTS TGAT ก.พ. พร้อมเฉลย สำหรับสมาชิก SheetLab VIP', canonical: `${site}/vip/mock`, body, pixelId: settings.pixelId, noindex: true, tab: 'vip' });
}

const MOCK_JS = `<script>(function(){var box=document.getElementById('mk'),L='ABCDEF',X=null,ans=[],t0=0,tick=null,done=false,HK='sl_mock_hist';
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function mmss(s){s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function hist(){try{return JSON.parse(localStorage.getItem(HK)||'[]');}catch(x){return [];}}
function post(m,o){return fetch('/api/order?m='+m,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o||{}),credentials:'same-origin'}).then(function(r){return r.json();});}
window.addEventListener('beforeunload',function(ev){if(X&&!done){ev.preventDefault();ev.returnValue='';}});
function home(j){var h='',H=hist();
 if(!j.active)h+='<section class="card"><h2>สำหรับสมาชิก VIP</h2><p>'+(j.email?'บัญชี '+e(j.email)+' ยังไม่เป็นสมาชิก':'เข้าสู่ระบบด้วยอีเมลก่อน ถ้าเป็นสมาชิกอยู่แล้ว')+'</p><div class="vp-act">'+(j.email?'':'<a class="btn" href="/account">เข้าสู่ระบบ</a>')+(j.open?'<a class="btn" href="/vip">ดูสิทธิ์และราคา VIP</a>':'<a class="btn" href="/quiz" style="background:var(--bg);color:var(--ink)">ฝึกฟรีที่คลังข้อสอบ</a>')+'</div></section>';
 h+='<section class="card"><h2>เลือกชุดข้อสอบ</h2>'+(j.kinds.length?'<div class="mk-kinds">'+j.kinds.map(function(k){return '<div class="mk-kind"><b>'+e(k.name)+'</b><span class="fine">'+e(k.desc)+'</span><span class="mk-meta">'+k.n+' ข้อ · '+k.mins+' นาที</span><button class="btn mk-go" data-k="'+e(k.k)+'"'+(j.active?'':' disabled')+'>เริ่มทำ</button></div>';}).join('')+'</div>':'<p class="fine">คลังข้อสอบยังมีข้อไม่พอ เร็วๆ นี้</p>')+'</section>';
 if(H.length)h+='<section class="card"><h2>ผลที่ผ่านมา (เครื่องนี้)</h2><div class="mk-hist">'+H.map(function(r){return '<div><span>'+new Date(r.at).toLocaleDateString('th-TH',{day:'numeric',month:'short'})+' · '+e(r.name)+'</span><b>'+r.ok+'/'+r.n+' ('+Math.round(r.ok/r.n*100)+'%)</b></div>';}).join('')+'</div></section>';
 box.innerHTML=h;box.querySelectorAll('.mk-go').forEach(function(b){b.onclick=function(){b.disabled=true;b.textContent='กำลังเตรียมข้อสอบ...';post('vip_mock',{k:b.dataset.k}).then(function(r){if(!r.ok){alert(r.error||'เริ่มไม่ได้');b.disabled=false;b.textContent='เริ่มทำ';return;}start(r);}).catch(function(){alert('เชื่อมต่อไม่ได้');b.disabled=false;b.textContent='เริ่มทำ';});};});}
function start(r){X=r;ans=r.questions.map(function(){return -1;});t0=Date.now();done=false;
 box.innerHTML='<div class="mk-bar" role="timer"><b id="mk-t">'+mmss(r.mins*60)+'</b><span id="mk-n">ตอบแล้ว 0/'+r.n+'</span><button class="btn" id="mk-send">ส่งคำตอบ</button></div>'+r.questions.map(function(x,n){return '<section class="card q mk-q" data-n="'+n+'"><span class="chip">ข้อ '+(n+1)+'/'+r.n+'</span><p style="font-weight:600;white-space:pre-line">'+e(x.q)+'</p><div class="ch">'+x.choices.map(function(c,k){return '<button type="button" data-k="'+k+'" aria-pressed="false">('+L[k]+') '+e(c)+'</button>';}).join('')+'</div><p class="ex"></p></section>';}).join('')+'<p style="text-align:center"><button class="btn" id="mk-send2">ส่งคำตอบ</button></p>';
 box.querySelectorAll('.mk-q').forEach(function(sec){var n=+sec.dataset.n;sec.querySelectorAll('.ch button').forEach(function(b){b.onclick=function(){if(done)return;ans[n]=+b.dataset.k;sec.querySelectorAll('.ch button').forEach(function(y){var on=y===b;y.classList.toggle('sel',on);y.setAttribute('aria-pressed',on);});var c=ans.filter(function(a){return a>=0;}).length;document.getElementById('mk-n').textContent='ตอบแล้ว '+c+'/'+X.n;};});});
 var send=function(){var left=ans.filter(function(a){return a<0;}).length;if(left&&!confirm('ยังไม่ได้ตอบ '+left+' ข้อ ส่งเลยไหม (ข้อที่ไม่ตอบนับเป็นผิด)'))return;finish();};
 document.getElementById('mk-send').onclick=send;document.getElementById('mk-send2').onclick=send;window.scrollTo(0,0);
 tick=setInterval(function(){var s=X.mins*60-(Date.now()-t0)/1000,el=document.getElementById('mk-t');if(el){el.textContent=mmss(s);el.classList.toggle('low',s<60);}if(s<=0)finish(true);},500);}
function finish(timeUp){if(done)return;done=true;clearInterval(tick);var used=Math.round((Date.now()-t0)/1000),ok=0,items=[];
 box.querySelectorAll('.mk-q').forEach(function(sec){var n=+sec.dataset.n,x=X.questions[n],a=ans[n],bs=sec.querySelectorAll('.ch button'),r=a===x.answer;if(r)ok++;items.push({quiz:x.quiz,q:x.i,ok:r});
  if(a>=0&&!r)bs[a].classList.add('wrong');bs[x.answer].classList.add('right');bs.forEach(function(y){y.disabled=true;});sec.classList.add('done');sec.querySelector('.ex').textContent=(a<0?'ไม่ได้ตอบ · ':'')+(x.explain||'');if(r)sec.classList.add('mk-ok');});
 var p=Math.round(ok/X.n*100),msg=p>=85?'แม่นมาก ลองชุดอื่นหรือเพิ่มความเร็วต่อ':p>=60?'ดีแล้ว ทวนข้อที่พลาดในสมุดจุดพลาด แล้วลองใหม่อีกรอบ':'ทวนพื้นฐานเรื่องที่พลาดก่อน แล้วค่อยลองใหม่';
 var H=hist();H.unshift({at:Date.now(),name:X.name,ok:ok,n:X.n});try{localStorage.setItem(HK,JSON.stringify(H.slice(0,10)));}catch(x){}
 var bar=box.querySelector('.mk-bar');bar.outerHTML='<section class="card mk-res"><p class="fine">'+(timeUp?'หมดเวลา · ':'')+e(X.name)+' · ใช้เวลา '+mmss(used)+'</p><p class="mk-score">'+ok+'<small>/'+X.n+'</small></p><p><b>'+p+'%</b> · '+msg+'</p><p class="fine" id="mk-saved">กำลังบันทึกข้อที่พลาดลงสมุดจุดพลาด...</p><div class="vp-act"><a class="btn" href="/vip/review">📒 เปิดสมุดจุดพลาด</a><a class="btn" href="/vip/mock" style="background:var(--bg);color:var(--ink)">ทำอีกชุด</a></div><label class="fine mk-only"><input type="checkbox" id="mk-wrong"> ดูเฉพาะข้อที่พลาด</label></section>';
 var s2=document.getElementById('mk-send2');if(s2)s2.parentNode.remove();window.scrollTo(0,0);
 document.getElementById('mk-wrong').onchange=function(){box.classList.toggle('mk-wonly',this.checked);};
 post('vip_marks',{items:items}).then(function(j){document.getElementById('mk-saved').textContent=j.ok?'ข้อที่พลาด '+(X.n-ok)+' ข้อ เข้าสมุดจุดพลาดแล้ว':'บันทึกสมุดจุดพลาดไม่สำเร็จ';}).catch(function(){document.getElementById('mk-saved').textContent='บันทึกสมุดจุดพลาดไม่สำเร็จ';});}
fetch('/api/order?m=vip_mock',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){if(!j.ok){box.innerHTML='<p class="card err">'+e(j.error||'โหลดไม่สำเร็จ')+'</p>';return;}home(j);}).catch(function(){box.innerHTML='<p class="card err">โหลดไม่สำเร็จ ลองรีเฟรช</p>';});})();</script>`;

// ✍️ ตรวจ IELTS Writing ด้วย AI อธิบายภาษาไทย (/vip/write) · เข้าระบบด้วยอีเมล · สมาชิก VIP ใช้ได้ทุกเดือน · ยังไม่เป็นสมาชิกทดลองฟรี 1 ครั้ง
export function vipWritePage({ settings = {}, site = '' } = {}) {
  const body = `<header class="card"><span class="chip">VIP</span><h1>✍️ ตรวจ IELTS Writing ด้วย AI</h1><p class="fine">วางโจทย์และงานเขียนของคุณ ได้คะแนนโดยประมาณ 4 เกณฑ์ จุดที่ต้องแก้อธิบายเป็นภาษาไทย ประโยคที่แก้ให้ คำศัพท์ที่ดีขึ้น และย่อหน้าตัวอย่างระดับ Band 7+ · คะแนนเป็นค่าประมาณเพื่อการฝึก ไม่ใช่คะแนนสอบจริง</p></header>
<div id="wr" aria-live="polite"><p class="card fine">กำลังโหลด...</p></div>${WRITE_CSS}${WRITE_JS}`;
  return shell({ title: 'ตรวจ IELTS Writing ด้วย AI อธิบายภาษาไทย · SheetLab VIP', desc: 'ตรวจ IELTS Writing Task 1 และ Task 2 ด้วย AI ได้คะแนนโดยประมาณ 4 เกณฑ์ พร้อมจุดแก้อธิบายภาษาไทย ประโยคที่แก้ และย่อหน้าตัวอย่าง Band 7+', canonical: `${site}/vip/write`, body, pixelId: settings.pixelId, noindex: true, tab: 'vip' });
}
const WRITE_CSS = `<style>.wr-tasks{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px}.wr-tasks button{flex:1 1 180px;border:2px solid var(--line,#ddd);background:#fff;border-radius:12px;padding:10px;font:inherit;font-weight:600;cursor:pointer}.wr-tasks button[aria-pressed="true"]{border-color:var(--brand,#2563eb);background:#eef4ff}
.wr-f label{display:block;font-weight:600;margin:12px 0 4px}.wr-f textarea{width:100%;box-sizing:border-box;font:inherit;font-size:16px;line-height:1.6;border:1.5px solid var(--line,#ccc);border-radius:12px;padding:10px 12px}.wr-row{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:4px}
.wr-wc{font-size:14px;font-weight:600}.wr-wc.low{color:#b45309}.wr-go{width:100%;margin-top:14px;font-size:17px;padding:14px}.wr-q{background:#fff7ed;border-radius:10px;padding:8px 12px;font-size:14px}
.wr-bands{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:10px 0}.wr-b{border:1.5px solid var(--line,#ddd);border-radius:12px;padding:10px;text-align:center}.wr-b b{display:block;font-size:26px}.wr-b span{font-size:13px;color:#555}.wr-b.all{background:#111;color:#fff;border-color:#111}.wr-b.all span{color:#ddd}.wr-b.weak{border-color:#f59e0b;background:#fffbeb}
.wr-c{margin:6px 0;font-size:14.5px}.wr-fix{border-left:4px solid #f59e0b;background:#fffbeb;border-radius:8px;padding:8px 12px;margin:8px 0}.wr-fix p{margin:4px 0}.wr-cor{border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:8px 12px;margin:8px 0}.wr-cor del{color:#b91c1c}.wr-cor ins{color:#15803d;text-decoration:none;font-weight:600}
.wr-voc{display:grid;grid-template-columns:1fr;gap:6px}.wr-voc div{background:#f8fafc;border-radius:8px;padding:6px 10px;font-size:14.5px}.wr-model{background:#f0fdf4;border-radius:12px;padding:12px;white-space:pre-wrap;line-height:1.7}.wr-hist a{display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid var(--line,#eee);text-decoration:none;color:inherit}
.wr-load{text-align:center;padding:26px 10px}.wr-load b{display:block;font-size:18px;margin-bottom:6px}.wr-q2{font-size:13.5px;color:#555;white-space:pre-wrap}</style>`;
const WRITE_JS = `<script>(function(){${LOGIN_FN}
var box=document.getElementById('wr'),S=null,task='t2',DK='sl_wr_draft';
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function wc(t){return (String(t||'').match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)||[]).length;}
function d(t){return new Date(t).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});}
function get(){try{return JSON.parse(localStorage.getItem(DK)||'{}');}catch(x){return {};}}
function put(o){try{localStorage.setItem(DK,JSON.stringify(o));}catch(x){}}
function load(){fetch('/api/order?m=vip_write',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){if(!j.ok){box.innerHTML='<p class="card err">'+e(j.error||'โหลดไม่สำเร็จ')+'</p>';return;}S=j;if(!j.email){slLogin(box,load,'<section class="card"><p>เข้าสู่ระบบด้วยอีเมลก่อน แล้ว<b>ทดลองตรวจฟรี 1 ครั้ง</b> (สมาชิก VIP ตรวจได้ทุกสัปดาห์)</p></section>');return;}form();}).catch(function(){box.innerHTML='<p class="card err">โหลดไม่สำเร็จ ลองรีเฟรช</p>';});}
function quota(){var j=S;if(j.active)return '<p class="fine">สมาชิก VIP · เดือนนี้ตรวจได้อีก <b>'+j.left+'</b> จาก '+j.cap+' ครั้ง</p>';return j.left>0?'<p class="wr-q">🎁 ทดลองตรวจฟรี <b>'+j.left+' ครั้ง</b> · สมาชิก VIP ตรวจได้ทุกสัปดาห์'+(j.open?' <a href="/vip">ดูสิทธิ์ VIP</a>':'')+'</p>':'<p class="wr-q">ใช้สิทธิ์ทดลองฟรีแล้ว '+(j.open?'<a href="/vip"><b>สมัคร VIP</b></a> เพื่อตรวจได้ทุกสัปดาห์':'ระบบสมาชิกกำลังจะเปิดเร็วๆ นี้')+'</p>';}
function form(){var dr=get();task=dr.task||task;var T=S.tasks,h='<section class="card wr-f">'+quota()+'<div class="wr-tasks" role="group" aria-label="ประเภทงานเขียน">'+Object.keys(T).map(function(k){return '<button type="button" data-t="'+k+'" aria-pressed="'+(k===task)+'">'+e(T[k].name)+'</button>';}).join('')+'</div>'
 +'<label for="wr-p">โจทย์ (Question)</label><textarea id="wr-p" rows="4" placeholder="วางโจทย์ภาษาอังกฤษ หรือกดสุ่มโจทย์">'+e(dr.prompt||'')+'</textarea><div class="wr-row"><button type="button" class="ghost" id="wr-rand">🎲 สุ่มโจทย์ฝึก</button><span class="fine">โจทย์ฝึกแต่งใหม่ ไม่ใช่ข้อสอบจริง</span></div>'
 +'<div id="wr-imgw"'+(task==='t1a'?'':' hidden')+'><label for="wr-img">รูปกราฟ/แผนที่ (ไม่บังคับ แต่ช่วยให้ตรวจตัวเลขได้)</label><input type="file" id="wr-img" accept="image/*"><span class="fine" id="wr-imgs"></span></div>'
 +'<label for="wr-e">งานเขียนของคุณ</label><textarea id="wr-e" rows="14" placeholder="พิมพ์หรือวางเรียงความภาษาอังกฤษ">'+e(dr.essay||'')+'</textarea><div class="wr-row"><span class="wr-wc" id="wr-wc"></span><span class="fine">ร่างบันทึกไว้ในเครื่องนี้อัตโนมัติ</span></div>'
 +'<p class="err" id="wr-err" hidden></p><button class="btn wr-go" id="wr-go"'+(S.left>0?'':' disabled')+'>✍️ ตรวจงานเขียน</button></section><div id="wr-out"></div>'+hist();
 box.innerHTML=h;var Q=document.getElementById('wr-p'),E=document.getElementById('wr-e'),img='';
 var upd=function(){var n=wc(E.value),m=T[task].min,w=document.getElementById('wr-wc');w.textContent=n+' คำ'+(n<m?' (ควรมีอย่างน้อย '+m+' คำ)':' ✓');w.className='wr-wc'+(n<m?' low':'');put({task:task,prompt:Q.value,essay:E.value});};upd();
 E.oninput=upd;Q.oninput=upd;
 box.querySelectorAll('[data-t]').forEach(function(b){b.onclick=function(){task=b.dataset.t;box.querySelectorAll('[data-t]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});document.getElementById('wr-imgw').hidden=task!=='t1a';upd();};});
 document.getElementById('wr-rand').onclick=function(){var L=S.prompts[task]||[];Q.value=L[Math.floor(Math.random()*L.length)]||'';upd();};
 var fi=document.getElementById('wr-img');fi.onchange=function(){var f=fi.files&&fi.files[0];img='';if(!f)return;var im=new Image(),u=URL.createObjectURL(f);im.onload=function(){var k=Math.min(1,1280/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);img=c.toDataURL('image/jpeg',.85);document.getElementById('wr-imgs').textContent=' แนบรูปแล้ว ✓';URL.revokeObjectURL(u);};im.src=u;};
 document.getElementById('wr-go').onclick=function(){var b=this,er=document.getElementById('wr-err'),out=document.getElementById('wr-out');er.hidden=true;b.disabled=true;
  out.innerHTML='<section class="card wr-load"><b>⏳ AI กำลังอ่านงานเขียนของคุณ</b><span class="fine" id="wr-tip">ใช้เวลาประมาณ 20–40 วินาที อย่าปิดหน้านี้</span></section>';out.scrollIntoView({behavior:'smooth'});
  var tips=['กำลังให้คะแนน 4 เกณฑ์...','กำลังหาประโยคที่ควรแก้...','กำลังเขียนย่อหน้าตัวอย่าง Band 7+...'],ti=0,tt=setInterval(function(){var x=document.getElementById('wr-tip');if(x)x.textContent=tips[ti++%tips.length];},7000);
  P('vip_write',{task:task,prompt:document.getElementById('wr-p').value,essay:document.getElementById('wr-e').value,image:task==='t1a'?img:''}).then(function(j){clearInterval(tt);b.disabled=false;
   if(!j.ok){out.innerHTML='';er.hidden=false;er.innerHTML=e(j.error||'ตรวจไม่สำเร็จ')+(j.needVip&&S.open?' · <a href="/vip">สมัคร VIP</a>':'');return;}
   S.left=j.left;out.innerHTML=R(j.result,document.getElementById('wr-e').value);out.scrollIntoView({behavior:'smooth'});if(j.id)S.history.unshift({id:j.id,task:task,band:j.result.band.overall,created_at:new Date().toISOString()});var hs=document.getElementById('wr-hist');if(hs)hs.outerHTML=hist();bindHist();var q=box.querySelector('.wr-f p');if(q)q.outerHTML=quota();if(!S.left)b.disabled=true;})
  .catch(function(){clearInterval(tt);b.disabled=false;out.innerHTML='';er.hidden=false;er.textContent='เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง';});};
 bindHist();}
function hist(){var H=S.history||[];if(!H.length)return '<section class="card" id="wr-hist" hidden></section>';return '<section class="card wr-hist" id="wr-hist"><h2>ที่เคยตรวจ</h2>'+H.map(function(x){return '<a href="#" data-h="'+e(x.id)+'"><span>'+d(x.created_at)+' · '+e((S.tasks[x.task]||{}).name||x.task)+'</span><b>Band '+Number(x.band).toFixed(1)+'</b></a>';}).join('')+'</section>';}
function bindHist(){box.querySelectorAll('[data-h]').forEach(function(a){a.onclick=function(ev){ev.preventDefault();var out=document.getElementById('wr-out');out.innerHTML='<p class="card fine">กำลังเปิด...</p>';fetch('/api/order?m=vip_write_get&id='+encodeURIComponent(a.dataset.h),{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){if(!j.ok){out.innerHTML='<p class="card err">'+e(j.error||'เปิดไม่ได้')+'</p>';return;}out.innerHTML='<section class="card"><p class="fine">'+d(j.item.at)+'</p><p class="wr-q2">'+e(j.item.prompt)+'</p></section>'+R(j.item.result,j.item.essay);out.scrollIntoView({behavior:'smooth'});});};});}
function R(r){var B=r.band,ks=[['c1',r.critName],['cc','Coherence & Cohesion'],['lr','Lexical Resource'],['gra','Grammar']],lo=Math.min(B.c1,B.cc,B.lr,B.gra),h='<section class="card"><h2>ผลการตรวจ</h2>'+(r.short?'<p class="wr-q">⚠️ งานนี้มี '+r.words+' คำ น้อยกว่า '+r.min+' คำที่ข้อสอบกำหนด คะแนนเกณฑ์แรกจึงถูกหัก</p>':'')
 +'<div class="wr-bands"><div class="wr-b all"><b>'+B.overall.toFixed(1)+'</b><span>Band โดยประมาณ</span></div>'+ks.map(function(k){return '<div class="wr-b'+(B[k[0]]===lo?' weak':'')+'"><b>'+B[k[0]].toFixed(1)+'</b><span>'+e(k[1])+'</span></div>';}).join('')+'</div>'
 +'<p>'+e(r.summary)+'</p>'+ks.map(function(k){return r.criteria[k[0]]?'<p class="wr-c"><b>'+e(k[1])+':</b> '+e(r.criteria[k[0]])+'</p>':'';}).join('')
 +(r.strengths.length?'<h3>👍 จุดที่ทำได้ดี</h3><ul>'+r.strengths.map(function(x){return '<li>'+e(x)+'</li>';}).join('')+'</ul>':'')+'</section>'
 +(r.fixes.length?'<section class="card"><h2>🔧 3 อย่างที่ควรแก้ก่อน</h2>'+r.fixes.map(function(f,i){return '<div class="wr-fix"><b>'+(i+1)+'. '+e(f.title)+'</b><p>'+e(f.why)+'</p><p><b>วิธีแก้:</b> '+e(f.how)+'</p></div>';}).join('')+'</section>':'')
 +(r.corrections.length?'<section class="card"><h2>✏️ ประโยคที่แก้ให้</h2>'+r.corrections.map(function(c){return '<div class="wr-cor"><p><del>'+e(c.original)+'</del></p><p><ins>'+e(c.better)+'</ins></p>'+(c.why?'<p class="fine">'+e(c.why)+'</p>':'')+'</div>';}).join('')+'</section>':'')
 +(r.vocab.length?'<section class="card"><h2>📚 คำศัพท์ที่ดีขึ้น</h2><div class="wr-voc">'+r.vocab.map(function(v){return '<div>'+e(v.basic)+' → <b>'+e(v.better)+'</b>'+(v.note?' <span class="fine">· '+e(v.note)+'</span>':'')+'</div>';}).join('')+'</div></section>':'')
 +(r.model?'<section class="card"><h2>⭐ ย่อหน้าตัวอย่าง Band 7+</h2><div class="wr-model">'+e(r.model)+'</div>'+(r.modelWhy?'<p class="fine">'+e(r.modelWhy)+'</p>':'')+'</section>':'')
 +(r.books&&r.books.length?'<section class="card"><h2>📘 ฝึกจุดที่อ่อนต่อด้วยเล่มนี้</h2>'+r.books.map(function(b){return '<p><a href="'+e(b.url)+'?utm_source=vip&utm_campaign=write">'+e(b.name)+'</a>'+(b.price?' · ฿'+b.price:'')+'</p>';}).join('')+'</section>':'')
 +'<p class="fine" style="text-align:center">คะแนนเป็นค่าประมาณจาก AI เพื่อการฝึก แก้ตามคำแนะนำแล้วกดตรวจอีกรอบได้</p>';return h;}
load();})();</script>`;
