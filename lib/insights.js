// พฤติกรรมคนเข้าเว็บ (เก็บเอง ไม่ระบุตัวตน ไม่ใช้คุกกี้): เปิดหน้า · อ่านนานแค่ไหน/ถึงไหน · กดอะไร · ทำแบบทดสอบ
// ตาราง web_events (สร้างครั้งเดียวด้วย SQL ในแท็บ 📈) · เครื่องที่ล็อกอินหลังบ้านไว้ไม่ถูกนับ · เก็บ 90 วัน
import { SB_URL } from './shop.js';

const SECRET = process.env.SUPABASE_SECRET_KEY || '';
const H = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

export const INSIGHTS_SQL = `create table if not exists web_events (id bigserial primary key, at timestamptz default now(), sid text, path text, ev text, k text, v real, src text, dev text);
create index if not exists web_events_at on web_events (at);
alter table web_events enable row level security;`;

// สคริปต์ในหน้าเว็บ (ทั้งหน้าร้าน/salepage และหน้าบทความ/ข้อสอบ/หัวข้อ) ส่งเป็นชุดทุก 15 วิ และตอนออกจากหน้า
// Microsoft Clarity (แผนที่ความร้อน + วิดีโอย้อนดูการใช้งาน): ใส่รหัสโปรเจกต์ที่คุณแดนสมัครเองที่นี่ (ไม่ใช่ความลับ) ว่าง = ปิด
// โหลดเฉพาะเมื่อผู้เข้าชมกด "ยอมรับ" ในแถบคุกกี้ (PDPA) และไม่โหลดในเครื่องที่ล็อกอินหลังบ้าน
export const CLARITY_ID = 'yrx4hk4hu7';
const CLARITY_JS = CLARITY_ID ? `<script>(function(){try{if(localStorage.getItem('sb-lpeqaorswhwzlplsaqpe-auth-token'))return;}catch(e){return;}var K='sl_consent';function load(){(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,'clarity','script','${CLARITY_ID}');}
var v=null;try{v=localStorage.getItem(K);}catch(e){}if(v==='yes')return load();if(v==='no')return;
document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.setAttribute('role','dialog');b.setAttribute('aria-label','การใช้คุกกี้');b.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:560px;margin:0 auto;background:#0F1B33;color:#fff;border-radius:14px;padding:12px 14px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center;flex-wrap:wrap';
b.innerHTML='<span style="flex:1 1 220px">เว็บนี้ใช้คุกกี้วิเคราะห์การใช้งาน (Microsoft Clarity) เพื่อปรับปรุงหน้าเว็บ ไม่เก็บชื่อหรือข้อมูลการจ่ายเงิน <a href="/privacy" style="color:#FFD23F">อ่านเพิ่ม</a></span><button data-c="no" style="font:inherit;border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;border-radius:10px;padding:7px 12px;cursor:pointer">ไม่ยอมรับ</button><button data-c="yes" style="font:inherit;font-weight:700;border:0;background:#FFD23F;color:#0F1B33;border-radius:10px;padding:7px 14px;cursor:pointer">ยอมรับ</button>';
b.addEventListener('click',function(e){var c=e.target.getAttribute&&e.target.getAttribute('data-c');if(!c)return;try{localStorage.setItem(K,c);}catch(x){}b.remove();if(c==='yes')load();});document.body.appendChild(b);});})();</script>` : '';
export const TRACK_JS = CLARITY_JS + `<script>(function(){try{if(localStorage.getItem('sb-lpeqaorswhwzlplsaqpe-auth-token')||/bot|crawl|spider|headless|lighthouse|preview/i.test(navigator.userAgent))return;}catch(e){return;}
var ss=window.sessionStorage,sid,src;try{sid=ss.getItem('sl_sid');if(!sid){sid=Math.random().toString(36).slice(2,10)+Date.now().toString(36);ss.setItem('sl_sid',sid);}src=ss.getItem('sl_src0');}catch(e){sid='t'+Math.random().toString(36).slice(2,12);}
if(!src){var u=new URLSearchParams(location.search),c=u.get('utm_campaign')||u.get('utm_source'),r=document.referrer,h='';try{h=r?new URL(r).hostname:'';}catch(e){}
 src=c?'ad:'+c.slice(0,40):!h?'direct':h===location.hostname?'internal':/google\\./.test(h)?'google':/facebook|fb\\.|messenger/.test(h)?'facebook':/line\\./.test(h)?'line':/instagram/.test(h)?'instagram':/threads/.test(h)?'threads':/bing|yahoo|duckduckgo/.test(h)?'search-other':'web:'+h.replace(/^www\\./,'').slice(0,40);
 try{ss.setItem('sl_src0',src);}catch(e){}}
var q=[],dev=innerWidth<760?'m':'d',cur=null,touch=Date.now();
function P(){return location.pathname.replace(/\\/+$/,'')||'/';}
function push(e,k,v){q.push({e:e,p:cur?cur.p:P(),k:k==null?'':String(k).slice(0,80),v:v==null||!isFinite(v)?null:+v});if(q.length>=25)flush();}
function flush(b){if(!q.length)return;var body=JSON.stringify({sid:sid,src:src,dev:dev,evs:q.splice(0,50)});try{if(b&&navigator.sendBeacon)navigator.sendBeacon('/api/content?action=ev',new Blob([body],{type:'application/json'}));else fetch('/api/content?action=ev',{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true}).catch(function(){});}catch(e){}}
function end(){if(!cur)return;push('read',cur.max,Math.round(cur.act/1000));cur=null;}
function start(){end();cur={p:P(),act:0,max:0};push('view','',null);depth();}
function depth(){if(!cur)return;var d=document.documentElement,hgt=Math.max(d.scrollHeight,1),pct=Math.min(100,Math.round((scrollY+innerHeight)/hgt*100)),b=pct>=97?100:pct>=75?75:pct>=50?50:pct>=25?25:0;if(b>cur.max)cur.max=b;}
['scroll','pointerdown','keydown','touchstart'].forEach(function(t){addEventListener(t,function(){touch=Date.now();if(t==='scroll')depth();},{passive:true});});
setInterval(function(){if(cur&&document.visibilityState==='visible'&&Date.now()-touch<30000)cur.act+=5000;},5000);
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-ev],[data-a],a[href]');if(!a)return;var k=a.getAttribute('data-ev')||a.getAttribute('data-a');
 if(!k&&a.tagName==='A'){var hr=a.getAttribute('href')||'';try{var x=new URL(hr,location.href);k=x.hostname===location.hostname?'link:'+(x.pathname.replace(/\\/+$/,'')||'/'):'out:'+x.hostname.replace(/^www\\./,'');}catch(err){}}
 if(k)push('click',k,null);},true);
var ps=history.pushState;history.pushState=function(){ps.apply(this,arguments);setTimeout(start,0);};addEventListener('popstate',function(){setTimeout(start,0);});
addEventListener('pagehide',function(){end();flush(true);});document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')flush(true);});
setInterval(flush,15000);window.slTrack=push;start();})();</script>`;

const EVS = new Set(['view', 'read', 'click', 'quiz', 'quizdone']);
export function cleanEvents(body) {
  const sid = String(body?.sid || '');
  if (!/^[a-z0-9]{6,40}$/.test(sid)) return [];
  const src = String(body.src || '').replace(/[^\w.:\-]/g, '').slice(0, 60) || 'direct', dev = body.dev === 'm' ? 'm' : 'd';
  return (Array.isArray(body.evs) ? body.evs : []).slice(0, 50).filter((x) => x && EVS.has(x.e) && /^\/[\w\-./]{0,118}$/.test(String(x.p || '')))
    .map((x) => ({ sid, path: String(x.p).slice(0, 120), ev: x.e, k: String(x.k ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, 80), v: Number.isFinite(Number(x.v)) && x.v !== null ? Number(x.v) : null, src, dev }));
}
export async function saveEvents(rows) {
  if (!rows.length) return;
  const r = await fetch(`${SB_URL}/rest/v1/web_events`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
  if (!r.ok) { const t = await r.text(); const e = new Error(`web_events ${r.status} ${t.slice(0, 120)}`); e.missing = /does not exist|PGRST205|42P01/.test(t); throw e; }
}
export async function pruneEvents(days = 90) { await fetch(`${SB_URL}/rest/v1/web_events?at=lt.${new Date(Date.now() - days * 864e5).toISOString()}`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } }); }
export async function insightsReady() { const r = await fetch(`${SB_URL}/rest/v1/web_events?select=id&limit=1`, { headers: H }); return r.ok; }

async function loadRows(since) {
  const out = [];
  for (let off = 0; off < 60000; off += 5000) {
    const r = await fetch(`${SB_URL}/rest/v1/web_events?at=gte.${since}&select=at,sid,path,ev,k,v,src,dev&order=at.asc&limit=5000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error(`web_events ${r.status}`);
    const j = await r.json(); out.push(...j); if (j.length < 5000) break;
  }
  return out;
}

const pageKind = (p) => p === '/' ? 'หน้าแรก' : p === '/store' ? 'ร้านค้า' : p.startsWith('/p/') ? 'หน้าขาย' : p.startsWith('/learn') ? 'บทความ' : p.startsWith('/quiz') ? 'แบบทดสอบ' : p.startsWith('/topic') ? 'หัวข้อ' : p.startsWith('/vip') ? 'VIP' : p === '/checkout' ? 'ชำระเงิน' : 'อื่นๆ';
const ADD = new Set(['cartTick', 'cartAdd']), BUY = new Set(['toCheckout', 'qrOpen', 'cartPay', 'payGo', 'cartOpen']), PAY = new Set(['qrOpen', 'payGo', 'cartPay']);

// สรุปให้แท็บ 📈 (ช่วงย้อนหลัง days วัน) + ออเดอร์ที่จ่ายแล้วในช่วงเดียวกันจากตาราง orders
export async function insightsReport(days = 7, paidOrders = []) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  return { ...summarize(await loadRows(since), paidOrders), days, since };
}
export function summarize(rows, paidOrders = []) {
  const S = new Map(), page = new Map(), clicks = new Map(), quiz = new Map(), qq = new Map(), src = new Map(), dev = { m: 0, d: 0 }, day = new Map();
  const pg = (p) => { let x = page.get(p); if (!x) page.set(p, x = { p, kind: pageKind(p), views: 0, secs: 0, reads: 0, r75: 0, r100: 0, exits: 0, lands: 0 }); return x; };
  for (const r of rows) {
    let s = S.get(r.sid); if (!s) { S.set(r.sid, s = { views: [], clicks: new Set(), src: r.src, dev: r.dev }); dev[r.dev === 'm' ? 'm' : 'd']++; src.set(r.src, (src.get(r.src) || 0) + 1); const dk = r.at.slice(0, 10); day.set(dk, (day.get(dk) || 0) + 1); }
    if (r.ev === 'view') { s.views.push(r.path); pg(r.path).views++; }
    else if (r.ev === 'read') { const x = pg(r.path); if (r.v > 0) { x.secs += Math.min(r.v, 1800); x.reads++; } if (Number(r.k) >= 75) x.r75++; if (Number(r.k) >= 100) x.r100++; }
    else if (r.ev === 'click') { clicks.set(r.k, (clicks.get(r.k) || 0) + 1); s.clicks.add(r.k); }
    else if (r.ev === 'quiz') { const [slug, i] = String(r.k).split(':'); let a = qq.get(r.k); if (!a) qq.set(r.k, a = { slug, i: Number(i), n: 0, ok: 0 }); a.n++; if (r.v > 0) a.ok++; let z = quiz.get(slug); if (!z) quiz.set(slug, z = { slug, starts: new Set(), done: 0, score: 0 }); z.starts.add(r.sid); }
    else if (r.ev === 'quizdone') { let z = quiz.get(r.k); if (!z) quiz.set(r.k, z = { slug: r.k, starts: new Set(), done: 0, score: 0 }); z.done++; z.score += Number(r.v) || 0; }
  }
  let bounce = 0, nViews = 0;
  const funnel = { product: 0, add: 0, buy: 0, pay: 0 };
  for (const s of S.values()) {
    nViews += s.views.length; if (s.views.length === 1) bounce++;
    if (s.views.length) { pg(s.views[0]).lands++; pg(s.views[s.views.length - 1]).exits++; }
    const sawProduct = s.views.some((p) => p.startsWith('/p/') || p === '/store' || p === '/'), cl = [...s.clicks];
    if (sawProduct) funnel.product++;
    if (cl.some((k) => ADD.has(k))) funnel.add++;
    if (cl.some((k) => BUY.has(k))) funnel.buy++;
    if (cl.some((k) => PAY.has(k))) funnel.pay++;
  }
  const pages = [...page.values()].map((x) => ({ ...x, avg: x.reads ? Math.round(x.secs / x.reads) : 0, pct75: x.views ? Math.round(x.r75 / x.views * 100) : 0, pct100: x.views ? Math.round(x.r100 / x.views * 100) : 0, exitRate: x.views ? Math.round(x.exits / x.views * 100) : 0 }));
  return {
    ok: true, events: rows.length,
    totals: { sessions: S.size, views: nViews, bounce: S.size ? Math.round(bounce / S.size * 100) : 0, perSession: S.size ? Math.round(nViews / S.size * 10) / 10 : 0, mobile: S.size ? Math.round(dev.m / S.size * 100) : 0 },
    daily: [...day.entries()].sort().map(([d, n]) => ({ d, n })),
    pages: pages.sort((a, b) => b.views - a.views).slice(0, 25),
    articles: pages.filter((x) => x.p.startsWith('/learn/')).sort((a, b) => b.avg - a.avg).slice(0, 15),
    exits: pages.filter((x) => x.exits >= 2).sort((a, b) => b.exits - a.exits).slice(0, 10),
    clicks: [...clicks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => ({ k, n })),
    funnel: { ...funnel, paid: paidOrders.length },
    sources: [...src.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => ({ k, n })),
    orderSources: Object.entries(paidOrders.reduce((m, o) => { const k = o.campaign || 'ไม่ระบุ'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })),
    quizzes: [...quiz.values()].map((z) => ({ slug: z.slug, starts: z.starts.size, done: z.done, avg: z.done ? Math.round(z.score / z.done) : 0 })).sort((a, b) => b.starts - a.starts).slice(0, 15),
    hardest: [...qq.values()].filter((a) => a.n >= 3).map((a) => ({ ...a, rate: Math.round(a.ok / a.n * 100) })).sort((a, b) => a.rate - b.rate).slice(0, 10),
  };
}
