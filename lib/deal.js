// หน้า /deal: ลิงก์ที่ตอบกลับอัตโนมัติในแชทเพจ Facebook ส่งให้ลูกค้า → ได้โค้ดส่วนลดส่วนตัว หมดอายุใน 24 ชม. (นับถอยหลัง) → กดไปเลือกซื้อ โค้ดใส่ให้เอง
// โค้ดออกตอนหน้าโหลดในเบราว์เซอร์เท่านั้น (บอทพรีวิวลิงก์ของ Messenger ไม่ได้โค้ด)
import { shell } from './quiz.js';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function dealPage({ pct = 10, site = '', settings = {} } = {}) {
  const body = `<main class="wrap" style="max-width:560px;padding:28px 16px 60px">
  <div class="card" style="padding:26px 22px;text-align:center;border-radius:18px">
    <p style="margin:0 0 6px;color:#56637D;font-size:14px">ของขวัญจากแชท SheetLab 🎁</p>
    <h1 style="font-size:26px;margin:0 0 6px">ส่วนลด ${esc(pct)}% ทุกเล่มและทุกชุด</h1>
    <p style="margin:0 0 18px;color:#56637D">ใช้ได้ 1 ครั้ง ภายใน 24 ชั่วโมงเท่านั้น</p>
    <div id="dl-box" style="border:2px dashed #2440E8;border-radius:14px;padding:16px;margin:0 0 14px;background:#F5F8FF">
      <div style="font-size:13px;color:#56637D">โค้ดของคุณ</div>
      <div id="dl-code" style="font-size:32px;font-weight:800;letter-spacing:2px;margin:4px 0">กำลังสร้างโค้ด...</div>
      <div id="dl-left" style="font-weight:700;color:#C2410C"></div>
    </div>
    <a id="dl-go" class="btn" href="/store" style="display:block;background:#EE4D2D;color:#fff;font-weight:800;padding:15px;border-radius:12px;text-decoration:none;font-size:17px">🛍 เลือกซื้อตอนนี้ (ใส่โค้ดให้แล้ว)</a>
    <button id="dl-copy" type="button" style="margin-top:10px;background:none;border:0;color:#2440E8;font:inherit;text-decoration:underline;cursor:pointer">คัดลอกโค้ด</button>
    <p style="font-size:13px;color:#56637D;margin:14px 0 0">สแกนจ่าย QR พร้อมเพย์หรือบัตร · ได้ไฟล์ทันทีหลังจ่าย · ส่วนลดคิดตอนชำระเงิน</p>
  </div></main>
<script>(async function(){var c=document.getElementById('dl-code'),l=document.getElementById('dl-left'),g=document.getElementById('dl-go');
try{var r=await fetch('/api/content?action=deal_code',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});var j=await r.json();
if(!j.ok){c.textContent='—';l.textContent=j.error||'สร้างโค้ดไม่ได้ ทักแชทร้านได้เลย';return;}
c.textContent=j.code;g.href='/store?code='+encodeURIComponent(j.code);try{sessionStorage.setItem('sl_code',j.code);}catch(e){}
document.getElementById('dl-copy').onclick=function(){try{navigator.clipboard.writeText(j.code);this.textContent='คัดลอกแล้ว ✓';}catch(e){}};
var end=Date.parse(j.expires);(function t(){var s=Math.max(0,Math.floor((end-Date.now())/1000));if(!s){l.textContent='โค้ดหมดอายุแล้ว';g.style.opacity=.5;return;}
var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;l.textContent='เหลือเวลา '+h+' ชม. '+String(m).padStart(2,'0')+' นาที '+String(x).padStart(2,'0')+' วินาที';setTimeout(t,1000);})();
}catch(e){c.textContent='—';l.textContent='สร้างโค้ดไม่ได้ ลองรีเฟรช';}})();</script>`;
  return shell({ title: `ส่วนลด ${pct}% ภายใน 24 ชม. · SheetLab`, desc: `โค้ดส่วนลดส่วนตัวจากแชท SheetLab ใช้ได้ภายใน 24 ชั่วโมง`, canonical: `${site}/deal`, body, pixelId: settings.pixelId, noindex: true });
}
