// หน้าเรียนคอร์ส /my-learning (หน้าตาแบบ Udemy): หน้าแรก "คอร์สของฉัน" (สถิติเรียนต่อเนื่อง + การ์ดคอร์ส) · หน้าเล่น (?c=slug) วิดีโอซ้าย เนื้อหาคอร์สแยกหมวดด้านขวา
// ใช้การเข้าระบบเดียวกับบัญชีของฉัน (คุกกี้ slvip) · ข้อมูลจาก /api/order?m=vip_acct · บันทึกเรียนจบ m=course_done · เข้าเรียน m=course_visit
import { shell } from './quiz.js';

const CSS = `<style>
main:has(#lrn){max-width:none;padding:0;margin:0}
#lrn{background:#fff;min-height:70vh;--d:#16161d;--d2:#2d2f31;--ln:#d1d7dc;--ac:#5624d0;--ok:#1e9e5b;color:#1c1d1f}
.lh{background:var(--d);color:#fff;padding:34px 16px 0}.lh-in{max-width:1180px;margin:0 auto}.lh h1{color:#fff;font-size:clamp(28px,5vw,44px);margin:0 0 22px;font-weight:700}
.lh-tabs{display:flex;gap:22px;overflow-x:auto}.lh-tabs a,.lh-tabs button{color:#d1d7dc;background:none;border:0;font:inherit;font-weight:700;padding:0 0 12px;border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap;text-decoration:none}.lh-tabs .on{color:#fff;border-color:#fff}
.lb{max-width:1180px;margin:0 auto;padding:28px 16px 60px;display:grid;gap:22px}
.ls-card{border:1px solid var(--ln);border-radius:10px;padding:22px 24px;display:grid;grid-template-columns:1fr auto auto;gap:18px 32px;align-items:center}
.ls-card h2{margin:0 0 6px;font-size:22px}.ls-card p{margin:0;color:#4b4f54}.ls-fire{display:flex;gap:10px;align-items:center}.ls-fire b{font-size:28px}.ls-fire span{color:#6a6f73}
.ls-ring{display:flex;gap:14px;align-items:center}.ls-ring svg{flex:none}.ls-ring ul{list-style:none;margin:0;padding:0;font-size:15px;line-height:1.7}.ls-ring li i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
.lg{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:22px}
.lc{display:grid;gap:6px;text-decoration:none;color:inherit;cursor:pointer;background:none;border:0;padding:0;text-align:left;font:inherit}
.lc-img{aspect-ratio:16/9;border:1px solid var(--ln);background:#f7f9fa center/cover no-repeat;display:grid;place-items:center;font-size:30px;font-weight:800;color:#fff;overflow:hidden}
.lc b{font-size:16px;line-height:1.35}.lc small{color:#6a6f73}.lc-bar{height:4px;background:#d1d7dc;margin-top:4px}.lc-bar i{display:block;height:100%;background:var(--ac)}.lc-st{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#2d2f31}
.lp-top{background:var(--d);color:#fff;display:flex;align-items:center;gap:16px;padding:10px 16px;position:sticky;top:0;z-index:5}.lp-top a{color:#fff;text-decoration:none;font-weight:800}.lp-top .t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:1px solid #555;padding-left:16px}
.lp-prog{display:flex;align-items:center;gap:8px;font-size:14px;color:#d1d7dc;white-space:nowrap}
.lp{display:grid;grid-template-columns:minmax(0,1fr) 380px;align-items:start}
.lp-v{background:#000;position:relative}.lp-v .fr{aspect-ratio:16/9;width:100%;display:block;border:0}.lp-none{aspect-ratio:16/9;display:grid;place-items:center;color:#d1d7dc;text-align:center;padding:20px}
.lp-nx{position:absolute;right:0;top:50%;transform:translateY(-50%);background:var(--ac);color:#fff;border:0;width:32px;height:56px;border-radius:6px 0 0 6px;font-size:20px;cursor:pointer}
.lp-side{border-left:1px solid var(--ln);max-height:calc(100vh - 52px);overflow:auto;position:sticky;top:52px;background:#fff}
.lp-side h3{margin:0;padding:16px;font-size:17px;border-bottom:1px solid var(--ln)}
.sec{border-bottom:1px solid var(--ln)}.sec>summary{list-style:none;cursor:pointer;padding:14px 16px;background:#f7f9fa}.sec>summary::-webkit-details-marker{display:none}.sec>summary b{display:block;font-size:15px}.sec>summary span{font-size:12px;color:#6a6f73}
.li{display:grid;grid-template-columns:22px 1fr;gap:10px;padding:12px 16px;cursor:pointer;align-items:start}.li:hover{background:#f2f3f5}.li.on{background:#d1d7dc}
.li input{width:18px;height:18px;margin:2px 0 0;accent-color:var(--d2)}.li .n{font-size:14px}.li .m{display:block;font-size:12px;color:#6a6f73;margin-top:4px}
.lp-tabs{display:flex;gap:22px;border-bottom:1px solid var(--ln);padding:0 24px}.lp-tabs button{background:none;border:0;font:inherit;font-weight:700;color:#6a6f73;padding:14px 0;border-bottom:2px solid transparent;cursor:pointer}.lp-tabs button.on{color:#1c1d1f;border-color:#1c1d1f}
.lp-body{padding:22px 24px 60px;max-width:860px}.lp-body h2{font-size:22px;margin:0 0 14px}.lp-stats{display:flex;gap:34px;margin:14px 0}.lp-stats b{display:block;font-size:18px}.lp-stats span{font-size:13px;color:#6a6f73}
.lp-doc{display:block;padding:10px 0;border-bottom:1px solid var(--ln);color:var(--ac)}.lp-done{margin-top:14px;padding:10px 18px;border-radius:6px;border:1px solid #1c1d1f;background:#fff;font:inherit;font-weight:700;cursor:pointer}.lp-done.ok{background:var(--ok);border-color:var(--ok);color:#fff}
.lmsg{max-width:560px;margin:40px auto;padding:0 16px;text-align:center}.lmsg a{display:inline-block;margin-top:14px;background:var(--ac,#5624d0);color:#fff;padding:12px 22px;border-radius:6px;font-weight:700;text-decoration:none}
@media(max-width:900px){.lp{grid-template-columns:1fr}.lp-side{position:static;max-height:none;border-left:0}.ls-card{grid-template-columns:1fr}.lp-top .t{display:none}.lp-tabs,.lp-body{padding-left:16px;padding-right:16px}}
</style>`;

const JS = `<script>(function(){var R=document.getElementById('lrn'),q=new URLSearchParams(location.search),J=null;
function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function post(m,o){return fetch('/api/order?m='+m,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o||{}),credentials:'same-origin'}).then(function(r){return r.json();});}
function th(d){return new Date(d+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short'});}
function pc(c){return c.lessons.length?Math.round(c.done.length/c.lessons.length*100):0;}
function ring(p,col,sz){var r=sz/2-5,C=2*Math.PI*r;return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 '+sz+' '+sz+'"><circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="#d1d7dc" stroke-width="6"/>'+(p>0?'<circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="6" stroke-dasharray="'+(C*Math.min(1,p))+' '+C+'" transform="rotate(-90 '+sz/2+' '+sz/2+')" stroke-linecap="round"/>':'')+'</svg>';}
var COL=['#5624d0','#1e6055','#b4690e','#a435f0','#0f7c90','#c0392b'];
function home(){var L=J.courses,s=J.learn||{weekLessons:0,weekDays:0,streak:0,goal:3};
 var h='<div class="lh"><div class="lh-in"><h1>คอร์สของฉัน</h1><div class="lh-tabs"><button class="on">คอร์สทั้งหมด</button><a href="/account">ไฟล์และบัญชีของฉัน</a></div></div></div><div class="lb">';
 h+='<section class="ls-card"><div><h2>'+(s.streak?'เรียนต่อเนื่องมา '+s.streak+' สัปดาห์ 🔥':'เริ่มสร้างนิสัยเรียนทุกสัปดาห์')+'</h2><p>เป้าหมาย: เรียนให้จบ '+s.goal+' บทต่อสัปดาห์ เรียนสม่ำเสมอได้ผลกว่าเรียนทีเดียวเยอะๆ</p></div>'
  +'<div class="ls-fire"><span style="font-size:30px">🔥</span><div><b>'+s.streak+'</b> สัปดาห์<br><span>เรียนต่อเนื่อง</span></div></div>'
  +'<div class="ls-ring">'+ring(s.weekLessons/s.goal,'#1e9e5b',64)+'<ul><li><i style="background:#1e9e5b"></i><b>'+s.weekLessons+'</b>/'+s.goal+' บทที่เรียนจบ</li><li><i style="background:#b4690e"></i><b>'+s.weekDays+'</b> วันที่เข้าเรียน</li><li>'+(s.from?th(s.from)+' – '+th(s.to):'')+'</li></ul></div></section>';
 h+=L.length?'<div class="lg">'+L.map(function(c,i){var p=pc(c);return '<button class="lc" data-c="'+e(c.slug)+'"><span class="lc-img" style="'+(c.image?'background-image:url('+e(c.image)+')':'background:'+COL[i%COL.length])+'">'+(c.image?'':e(c.title.slice(0,2)))+'</span><b>'+e(c.title)+'</b><small>SheetLab</small><span class="lc-bar"><i style="width:'+p+'%"></i></span><span class="lc-st">'+(p?(p===100?'เรียนจบแล้ว ✓':'เรียนแล้ว '+p+'%'):'เริ่มเรียน')+'</span></button>';}).join('')+'</div>'
  :'<p>ยังไม่มีคอร์สในบัญชีนี้ ถ้าซื้อแล้วแต่ไม่เห็น ตรวจว่าเข้าระบบด้วยอีเมลที่ใช้ซื้อ</p>';
 R.innerHTML=h+'</div>';[].forEach.call(R.querySelectorAll('.lc'),function(b){b.onclick=function(){go(b.dataset.c);};});}
function go(slug,lid){var u='/my-learning?c='+encodeURIComponent(slug)+(lid?'&l='+encodeURIComponent(lid):'');history.pushState({},'',u);q=new URLSearchParams(location.search);draw();}
var TAB='ov',OPEN={};
function player(c){var D=c.done,n=c.lessons.length,lid=q.get('l');var cur=c.lessons.find(function(l){return l.id===lid;})||c.lessons.find(function(l){return D.indexOf(l.id)<0;})||c.lessons[0];var i=c.lessons.indexOf(cur),nx=c.lessons[i+1],p=pc(c);
 var secs=[];c.lessons.forEach(function(l){var s=secs.find(function(x){return x.n===(l.section||'บทเรียน');});if(!s)secs.push(s={n:l.section||'บทเรียน',L:[]});s.L.push(l);});
 if(cur){var cs=secs.find(function(s){return s.L.indexOf(cur)>=0;});if(cs)OPEN[cs.n]=1;}
 var tot=c.lessons.reduce(function(a,l){return a+(l.min||0);},0),docs=c.lessons.filter(function(l){return l.file;});
 var h='<div class="lp-top"><a href="/my-learning" id="lp-home">SheetLab</a><span class="t">'+e(c.title)+'</span><span class="lp-prog">'+ring(p/100,'#a435f0',34)+' ความคืบหน้า '+D.length+'/'+n+'</span></div><div class="lp"><div>';
 h+='<div class="lp-v">'+(cur&&cur.embed?'<iframe class="fr" src="'+e(cur.embed)+'" allow="autoplay; fullscreen" allowfullscreen title="'+e(cur.title)+'"></iframe>':'<div class="lp-none">'+(cur?'บท "'+e(cur.title)+'" ยังไม่มีวิดีโอ เร็วๆ นี้':'ยังไม่มีบทเรียน')+'</div>')+(nx?'<button class="lp-nx" id="lp-nx" title="บทถัดไป">›</button>':'')+'</div>';
 h+='<div class="lp-tabs"><button data-t="ov" class="'+(TAB==='ov'?'on':'')+'">ภาพรวม</button><button data-t="doc" class="'+(TAB==='doc'?'on':'')+'">เอกสาร</button></div><div class="lp-body">';
 if(TAB==='doc'){var F=c.files||[];h+=F.length||docs.length?F.map(function(f){return '<a class="lp-doc" href="'+e(f.url)+'" target="_blank" rel="noopener">🎁 '+e(f.name)+'</a>';}).join('')+docs.map(function(l){return '<a class="lp-doc" href="'+e(l.file)+'" target="_blank" rel="noopener">⬇ '+e(l.title)+'</a>';}).join(''):'<p>คอร์สนี้ยังไม่มีเอกสารประกอบ</p>';}
 else h+=(cur?'<h2>'+(i+1)+'. '+e(cur.title)+'</h2><button class="lp-done'+(D.indexOf(cur.id)>=0?' ok':'')+'" id="lp-done">'+(D.indexOf(cur.id)>=0?'✓ เรียนจบบทนี้แล้ว':'✓ ทำเครื่องหมายว่าเรียนจบ')+'</button>':'')+'<p style="margin-top:22px">'+e(c.desc||'')+'</p><div class="lp-stats"><div><b>'+n+'</b><span>บทเรียน</span></div><div><b>'+(tot>=60?Math.floor(tot/60)+' ชม. '+(tot%60)+' นาที':tot+' นาที')+'</b><span>รวมทั้งหมด</span></div><div><b>'+p+'%</b><span>เรียนแล้ว</span></div></div>';
 h+='</div></div><aside class="lp-side"><h3>เนื้อหาคอร์ส</h3>'+secs.map(function(s,k){var d=s.L.filter(function(l){return D.indexOf(l.id)>=0;}).length,m=s.L.reduce(function(a,l){return a+(l.min||0);},0);
  return '<details class="sec" data-s="'+e(s.n)+'"'+(OPEN[s.n]?' open':'')+'><summary><b>หมวดที่ '+(k+1)+': '+e(s.n)+'</b><span>'+d+' / '+s.L.length+(m?' | '+m+' นาที':'')+'</span></summary>'+s.L.map(function(l){var dn=D.indexOf(l.id)>=0;return '<div class="li'+(l===cur?' on':'')+'" data-l="'+e(l.id)+'"><input type="checkbox" data-ck="'+e(l.id)+'" '+(dn?'checked':'')+' aria-label="เรียนจบ"><span class="n">'+(c.lessons.indexOf(l)+1)+'. '+e(l.title)+'<span class="m">▶ '+(l.min?l.min+' นาที':'วิดีโอ')+'</span></span></div>';}).join('')+'</details>';}).join('')+'</aside></div>';
 R.innerHTML=h;window.scrollTo(0,0);
 document.getElementById('lp-home').onclick=function(ev){ev.preventDefault();history.pushState({},'','/my-learning');q=new URLSearchParams('');draw();};
 [].forEach.call(R.querySelectorAll('.lp-tabs button'),function(b){b.onclick=function(){TAB=b.dataset.t;draw();};});
 [].forEach.call(R.querySelectorAll('.sec'),function(d){d.addEventListener('toggle',function(){OPEN[d.dataset.s]=d.open?1:0;});});
 [].forEach.call(R.querySelectorAll('.li'),function(x){x.onclick=function(ev){if(ev.target.tagName==='INPUT')return;go(c.slug,x.dataset.l);};});
 function mark(id,on,then){post('course_done',{course:c.id,lesson:id,on:on}).then(function(r){if(r.ok){c.done=r.done;if(J.learn&&on)J.learn.weekLessons++;then&&then();draw();}else alert(r.error||'บันทึกไม่สำเร็จ');});}
 [].forEach.call(R.querySelectorAll('[data-ck]'),function(x){x.onclick=function(ev){ev.stopPropagation();mark(x.dataset.ck,x.checked);};});
 var db=document.getElementById('lp-done');if(db)db.onclick=function(){var on=D.indexOf(cur.id)<0;mark(cur.id,on,function(){if(on&&nx){history.replaceState({},'','/my-learning?c='+encodeURIComponent(c.slug)+'&l='+encodeURIComponent(nx.id));q=new URLSearchParams(location.search);}});};
 var nb=document.getElementById('lp-nx');if(nb)nb.onclick=function(){go(c.slug,nx.id);};}
function draw(){var slug=q.get('c');var c=slug&&J.courses.find(function(x){return x.slug===slug||x.id===slug;});if(c)player(c);else home();}
window.addEventListener('popstate',function(){q=new URLSearchParams(location.search);if(J)draw();});
fetch('/api/order?m=vip_acct',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){
 if(!j.ok||!j.email){R.innerHTML='<div class="lmsg"><h1>คอร์สของฉัน</h1><p>เข้าสู่ระบบด้วยอีเมลที่ใช้ซื้อคอร์ส แล้วคอร์สจะขึ้นที่นี่</p><a href="/account?next=my-learning'+(q.get('c')?'&c='+encodeURIComponent(q.get('c')):'')+'">เข้าสู่ระบบ</a></div>';return;}
 J=j;J.courses=J.courses||[];draw();post('course_visit');}).catch(function(){R.innerHTML='<p class="lmsg">โหลดไม่สำเร็จ ลองรีเฟรช</p>';});})();</script>`;

export function learnPage({ settings = {}, site = '' } = {}) {
  return shell({ title: 'คอร์สของฉัน · SheetLab', desc: 'เรียนคอร์สที่ซื้อแล้ว ดูวิดีโอ ติดตามความคืบหน้า', canonical: `${site}/my-learning`, body: `${CSS}<div id="lrn"><p class="lmsg">กำลังโหลด...</p></div>${JS}`, pixelId: settings.pixelId, noindex: true });
}
