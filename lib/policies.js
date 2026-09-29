// หน้านโยบายของร้าน (/privacy, /refund) — Meta ตรวจแอด, Stripe และ PDPA ต้องมีหน้าแบบนี้เป็นลิงก์สาธารณะ
// เสิร์ฟจาก api/page.js (ฟังก์ชันเต็มโควตา Hobby แล้ว จึงไม่แยกไฟล์ api ใหม่)
const FB_PAGE = 'https://www.facebook.com/1264839566720049';
const FB_CHAT = 'https://m.me/1264839566720049';
const UPDATED = '29 กันยายน 2569';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function contact(settings) {
  const chat = String(settings?.chatLink || '').trim() || FB_CHAT;
  const extra = String(settings?.contactInfo || '').trim();
  return `ทักแชทเพจ Facebook <a href="${esc(chat)}" target="_blank" rel="noopener noreferrer">SheetLab</a>${extra ? ` หรือ ${esc(extra)}` : ''}`;
}

const DOCS = {
  privacy: {
    title: 'นโยบายความเป็นส่วนตัว',
    body: (s) => `
<p>SheetLab (sheetlabth.com) ขายชีทสรุปและหนังสือเตรียมสอบในรูปแบบไฟล์ PDF นโยบายนี้อธิบายว่าเราเก็บและใช้ข้อมูลส่วนบุคคลของคุณอย่างไร ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
<h2>ข้อมูลที่เราเก็บ</h2>
<ul>
<li><b>ข้อมูลการสั่งซื้อ</b> ชื่อ อีเมล สินค้าที่ซื้อ ยอดเงิน และเวลาชำระเงิน ที่คุณกรอกในหน้าชำระเงินของ Stripe</li>
<li><b>ข้อมูลการชำระเงิน</b> Stripe เป็นผู้ประมวลผลบัตรและ PromptPay โดยตรง ร้านไม่เห็นและไม่เก็บเลขบัตรของคุณ</li>
<li><b>ข้อมูลการใช้งานเว็บไซต์</b> หน้าที่เปิดดู การกดปุ่มชำระเงิน และการซื้อ ผ่านคุกกี้และ Meta Pixel ของ Facebook</li>
<li><b>ข้อความที่คุณส่งหาเรา</b> เช่น แชทหรือคอมเมนต์บนเพจ Facebook และ Threads</li>
</ul>
<h2>เราใช้ข้อมูลเพื่อ</h2>
<ul>
<li>ส่งไฟล์สินค้า ใบเสร็จ และช่วยเหลือเมื่อดาวน์โหลดไม่ได้ (จำเป็นต่อการทำสัญญาซื้อขาย)</li>
<li>วัดผลและปรับปรุงโฆษณาบน Facebook และ Instagram (ประโยชน์โดยชอบด้วยกฎหมายของร้าน)</li>
<li>เก็บหลักฐานทางบัญชีและภาษีตามที่กฎหมายกำหนด</li>
</ul>
<p>เราไม่ขายหรือให้เช่าข้อมูลของคุณแก่ผู้ใด และไม่ส่งอีเมลโฆษณาหากคุณไม่ได้ขอ</p>
<h2>ผู้ให้บริการที่ได้รับข้อมูล</h2>
<ul>
<li>Stripe: รับชำระเงิน</li>
<li>Meta (Facebook): Pixel สำหรับวัดผลโฆษณา</li>
<li>Google (Gmail): ส่งอีเมลไฟล์สินค้า</li>
<li>Supabase และ Vercel: ระบบฐานข้อมูลและโฮสต์เว็บไซต์ (อาจเก็บข้อมูลบนเซิร์ฟเวอร์นอกประเทศไทย ภายใต้มาตรการคุ้มครองของผู้ให้บริการ)</li>
</ul>
<h2>ระยะเวลาเก็บ</h2>
<p>ข้อมูลการสั่งซื้อเก็บไว้เท่าที่จำเป็นต่อการให้บริการและตามระยะเวลาที่กฎหมายบัญชีกำหนด ข้อมูลที่ไม่จำเป็นแล้วจะถูกลบหรือทำให้ระบุตัวตนไม่ได้</p>
<h2>สิทธิของคุณ</h2>
<p>คุณขอเข้าถึง ขอสำเนา แก้ไข ลบ ระงับการใช้ หรือคัดค้านการใช้ข้อมูลของคุณได้ รวมถึงถอนความยินยอมและร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.) ได้ หากไม่ต้องการให้ Facebook ใช้ข้อมูลการเข้าชมเพื่อแสดงโฆษณา ปรับได้ที่การตั้งค่าโฆษณาในบัญชี Facebook หรือปิดคุกกี้ของบุคคลที่สามในเบราว์เซอร์</p>
<h2>ติดต่อร้าน</h2>
<p>${contact(s)}</p>`,
  },
  refund: {
    title: 'นโยบายการคืนเงิน',
    body: (s) => `
<p>สินค้าของ SheetLab เป็นไฟล์ดิจิทัล (PDF) ที่ส่งให้ดาวน์โหลดได้ทันทีหลังชำระเงินสำเร็จ</p>
<h2>กรณีที่ร้านแก้ไขหรือคืนเงินให้</h2>
<ul>
<li><b>ดาวน์โหลดไม่ได้ ไฟล์เสีย หรือได้รับไฟล์ผิดเล่ม</b> ร้านส่งไฟล์ที่ถูกต้องให้ใหม่ หากแก้ไม่ได้ คืนเงินเต็มจำนวน</li>
<li><b>ถูกตัดเงินซ้ำสำหรับออเดอร์เดียวกัน</b> คืนเงินส่วนที่ซ้ำเต็มจำนวน</li>
<li><b>ชำระเงินแล้วแต่ไม่ได้รับไฟล์</b> ร้านส่งไฟล์ให้ หรือคืนเงินหากคุณต้องการ</li>
</ul>
<h2>กรณีที่ไม่รับคืนเงิน</h2>
<p>เปลี่ยนใจหลังจากดาวน์โหลดไฟล์แล้ว เนื่องจากเป็นสินค้าดิจิทัลที่ส่งมอบครบถ้วนทันทีและไม่สามารถส่งคืนได้</p>
<h2>วิธีขอความช่วยเหลือหรือขอคืนเงิน</h2>
<ol>
<li>ติดต่อร้านภายใน 7 วันหลังชำระเงิน: ${contact(s)}</li>
<li>แจ้งอีเมลที่ใช้สั่งซื้อ วันที่ชำระเงิน และปัญหาที่พบ (แนบภาพหน้าจอได้ยิ่งดี)</li>
<li>ร้านตอบกลับภายใน 2 วันทำการ</li>
</ol>
<p>เงินคืนจะเข้าช่องทางเดิมที่ใช้ชำระผ่าน Stripe โดยปกติใช้เวลา 5–10 วันทำการ ขึ้นกับธนาคารหรือผู้ออกบัตร</p>`,
  },
};

export const POLICY_DOCS = Object.keys(DOCS);

export function policyPage(doc, settings = {}) {
  const d = DOCS[doc];
  if (!d) return null;
  const other = doc === 'privacy' ? ['/refund', 'นโยบายการคืนเงิน'] : ['/privacy', 'นโยบายความเป็นส่วนตัว'];
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${d.title} · SheetLab</title><meta name="description" content="${d.title}ของร้าน SheetLab (sheetlabth.com)">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600&family=Mitr:wght@500&display=swap" rel="stylesheet">
<style>
:root{--bg:#EDF1F7;--surface:#FFFFFF;--ink:#0F1B33;--muted:#56637D;--line:#D3DBE8;--brand:#2440E8}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0B1220;--surface:#131C30;--ink:#EAF0FF;--muted:#9AA7C4;--line:#27334F;--brand:#8EA0FF}}
:root[data-theme="dark"]{--bg:#0B1220;--surface:#131C30;--ink:#EAF0FF;--muted:#9AA7C4;--line:#27334F;--brand:#8EA0FF}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 'IBM Plex Sans Thai','Noto Sans Thai',system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px 48px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:24px 20px}
h1{font:500 26px/1.3 'Mitr','IBM Plex Sans Thai',sans-serif;margin:0 0 4px}
h2{font:500 18px/1.4 'Mitr','IBM Plex Sans Thai',sans-serif;margin:24px 0 6px}
p,li{overflow-wrap:anywhere}ul,ol{padding-left:22px}
a{color:var(--brand)}.fine{color:var(--muted);font-size:14px}
nav{display:flex;flex-wrap:wrap;gap:8px 16px;margin:0 0 16px;font-size:15px}
</style></head><body><main>
<nav><a href="/">← กลับหน้าร้าน SheetLab</a><a href="${other[0]}">${other[1]}</a></nav>
<div class="card"><h1>${d.title}</h1><p class="fine">ปรับปรุงล่าสุด ${UPDATED}</p>${d.body(settings)}</div>
<p class="fine" style="margin-top:16px">SheetLab · sheetlabth.com · <a href="${FB_PAGE}" target="_blank" rel="noopener noreferrer">เพจ Facebook</a></p>
</main></body></html>`;
}
