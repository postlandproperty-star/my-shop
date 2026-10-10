// 🖨 หน้าพิมพ์หนังสือของแม่ (คุณแดน 10 ต.ค. 69): ออเดอร์ Shopee เล่มพิมพ์ แม่เปิดหน้านี้บนคอม (ไม่ต้องล็อกอิน ลิงก์ลับ)
// แต่ละเล่มมี 2 ปุ่ม: ปก (หน้า 1 · เครื่องพิมพ์สี) และ เนื้อหา (หน้า 2 ถึงหน้าสุดท้าย · เครื่องขาวดำ) ระบบแยกไฟล์ PDF ให้เอง (splitPdf)
import { createHmac } from 'node:crypto';

export const printKey = (token) => createHmac('sha256', String(token)).update('print').digest('hex').slice(0, 32);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pagesOf = (p) => Number((String(p.specs || '').match(/(\d[\d,]*)\s*หน้า/) || [])[1]?.replace(/,/g, '')) || 0;
const printable = (p) => p && p.status === 'published' && p.kind !== 'course' && p.cat !== 'notion' && !/notion\.(so|site)/.test(String(p.link || ''));

// ไฟล์ PDF → { cover: หน้า 1, body: หน้า 2..สุดท้าย } (เล่มที่มีหน้าเดียว body = null)
export async function splitPdf(buf) {
  const { PDFDocument } = await import('pdf-lib');
  const src = await PDFDocument.load(buf, { ignoreEncryption: true }), n = src.getPageCount();
  const part = async (idx) => { const d = await PDFDocument.create(); (await d.copyPages(src, idx)).forEach((pg) => d.addPage(pg)); return Buffer.from(await d.save()); };
  return { pages: n, cover: await part([0]), body: n > 1 ? await part([...Array(n - 1).keys()].map((i) => i + 1)) : null };
}

// ลิงก์ Google Drive แบบดูไฟล์ → ลิงก์ดาวน์โหลดตรง (ไฟล์ที่แชร์ให้ทุกคนที่มีลิงก์)
export const directPdf = (u) => { const m = String(u || '').match(/drive\.google\.com\/file\/d\/([\w-]+)/); return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : String(u || ''); };

// รายการเล่ม: เปิดสวิตช์ Shopee ก่อน แล้วเล่มอื่นที่ขายอยู่ · ชุด = แสดงทุกเล่มในชุด
export function printList(shop) {
  const P = (shop && shop.products) || [], find = (id) => P.find((x) => x.id === id);
  const book = (b) => ({ id: b.id, name: b.name, sku: String(b.sku || '').trim(), pages: pagesOf(b), img: b.bookCover || (b.images || [])[0] || '' });
  const out = [];
  for (const p of P) {
    if (!p || p.status !== 'published') continue;
    if (p.type === 'bundle') { const bs = (p.items || []).map(find).filter((b) => b && b.cat !== 'notion' && !/notion\.(so|site)/.test(String(b.link || ''))); if (bs.length) out.push({ id: p.id, name: p.shopeeName || p.name, sku: String(p.sku || '').trim(), shopee: !!p.shopee, set: true, img: (p.images || [])[0] || '', books: bs.map(book) }); }
    else if (printable(p)) out.push({ ...book(p), name: p.shopeeName || p.name, shopee: !!p.shopee, set: false, books: [book(p)] });
  }
  return out.sort((a, b) => (b.shopee - a.shopee) || (a.set - b.set));
}

// 📦 ออเดอร์ Shopee ที่ต้องทำ (จากอีเมล · lib/shopeeorders.js) แสดงบนสุดของหน้าพิมพ์: ร้านปริ้นให้ = ปุ่มพิมพ์ทุกเล่ม · ลูกค้าปริ้นเอง = บัตร QR · จับคู่ไม่ได้ = เลือกเล่มครั้งเดียว
function ordersBox(orders, list, url, act) {
  if (!orders || (!orders.todo.length && !orders.done.length)) return '';
  const byId = {}; for (const x of list) { byId[x.id] = x; for (const b of x.books) byId[b.id] = byId[b.id] || { ...b, books: [b] }; }
  const opts = list.map((x) => `<option value="${esc(x.id)}">${esc((x.set ? '📦 ' : '') + x.name)}</option>`).join('');
  const item = (o, it) => { const x = it.pid && byId[it.pid], pr = /ร้าน\s*ปริ้น|ร้าน\s*พิมพ์|เล่มพิมพ์/i.test(it.variation || '') && !/ลูกค้า/.test(it.variation || '');
    const head = `<div class="po-it-h"><b>${esc(it.name)}</b><span class="po-var ${pr ? 'pr' : 'fl'}">${pr ? '🖨 ร้านปริ้นให้' : '🎫 ลูกค้าปริ้นเอง (ไฟล์)'}${it.qty > 1 ? ` × ${it.qty}` : ''}</span></div>`;
    if (!x) return `<div class="po-it">${head}<div class="po-map"><span>❓ ยังไม่รู้ว่าเป็นเล่มไหนในร้าน เลือกครั้งเดียว ครั้งหน้าจำได้เอง:</span><select data-po-sel="${esc(o.sn)}|${esc(it.itemId || '')}|${esc(it.name)}"><option value="">— เลือกสินค้า —</option>${opts}</select></div></div>`;
    const acts = pr ? x.books.map((b) => `<div class="po-bk"><span>${esc(b.name)}${b.pages ? ` <i>(${b.pages} หน้า)</i>` : ''}</span><span class="pb-acts"><a class="pb-c" href="${esc(url(b.id, 'cover'))}" target="_blank" rel="noopener">🖨 ปก</a><a class="pb-w" href="${esc(url(b.id, 'body'))}" target="_blank" rel="noopener">🖨 เนื้อหา</a></span></div>`).join('')
      : `<div class="po-bk"><span>${esc(x.name)}${x.set ? ` <i>(${x.books.length} เล่มในบัตรใบเดียว)</i>` : ''}</span><span class="pb-acts"><a class="pb-q" href="${esc(url(x.id, 'card'))}" target="_blank" rel="noopener">🎫 พิมพ์บัตร QR</a></span></div>`;
    return `<div class="po-it">${head}${acts}</div>`; };
  const card = (o, done) => `<article class="po-o${done ? ' done' : ''}"><div class="po-h"><b>ออเดอร์ #${esc(o.sn)}</b><span>${esc(o.date || '')}</span>${done ? `<button data-po="undo" data-sn="${esc(o.sn)}">↩ ยังไม่เสร็จ</button>` : `<button class="po-done" data-po="done" data-sn="${esc(o.sn)}">✓ แพ็กเสร็จแล้ว</button>`}</div>${done ? '' : o.items.map((it) => item(o, it)).join('')}</article>`;
  return `<section class="po"><h2>📦 ออเดอร์ Shopee ที่ต้องทำ <span>${orders.todo.length} ออเดอร์</span></h2>
  ${orders.todo.length ? orders.todo.map((o) => card(o, false)).join('') : '<p class="po-none">✅ ไม่มีออเดอร์ค้าง</p>'}
  ${orders.done.length ? `<details><summary>เสร็จแล้วล่าสุด (${orders.done.length})</summary>${orders.done.map((o) => card(o, true)).join('')}</details>` : ''}
  <p class="po-note">ออเดอร์ใหม่ขึ้นเองจากอีเมล Shopee (ภายในประมาณ 1 ชั่วโมง) · ค้นหาเล่มอื่นได้ที่ช่องค้นหาข้างล่าง</p></section>
  <script>const PO=${JSON.stringify(act)};document.addEventListener('click',async e=>{const b=e.target.closest('[data-po]');if(!b)return;b.disabled=true;await fetch(PO,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:b.dataset.po,sn:b.dataset.sn})});location.reload();});
  document.addEventListener('change',async e=>{const s=e.target.closest('[data-po-sel]');if(!s||!s.value)return;const [sn,itemId,...n]=s.dataset.poSel.split('|');s.disabled=true;await fetch(PO,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'map',sn,itemId,name:n.join('|'),pid:s.value})});location.reload();});</script>`;
}

export function printPage(list, url, orders, act) {
  const qbtn = (id) => `<a class="pb-q" href="${esc(url(id, 'card'))}" target="_blank" rel="noopener">🎫 บัตร QR <small>ลูกค้าปริ้นเอง (ไฟล์)</small></a>`;
  const btns = (b, card) => `<div class="pb-row"><div class="pb-b">${b.img ? `<img src="${esc(b.img)}" alt="" loading="lazy">` : ''}<span>${esc(b.name)}${b.pages ? ` <i>(${b.pages} หน้า)</i>` : ''}${b.sku ? `<br><code class="pb-sku">SKU ${esc(b.sku)}</code>` : ''}</span></div>
    <div class="pb-acts"><a class="pb-c" href="${esc(url(b.id, 'cover'))}" target="_blank" rel="noopener">🖨 ปก <small>เครื่องสี · 1 หน้า</small></a><a class="pb-w" href="${esc(url(b.id, 'body'))}" target="_blank" rel="noopener">🖨 เนื้อหา <small>เครื่องขาวดำ${b.pages > 1 ? ` · ${b.pages - 1} หน้า` : ''}</small></a>${card ? qbtn(b.id) : ''}</div></div>`;
  const card = (x) => `<section class="pb-card" data-q="${esc(String(x.name + ' ' + (x.sku || '') + ' ' + (x.sku ? x.sku + '-p' : '') + ' ' + x.books.map((b) => b.name + ' ' + b.sku + (b.sku ? ' ' + b.sku + '-p' : '')).join(' ')).toLowerCase())}"><h2>${x.shopee ? '<b class="pb-tag">🛒 Shopee</b> ' : ''}${x.set ? '📦 ' : ''}${esc(x.name)}${x.set ? ` <i>· ${x.books.length} เล่ม</i>` : ''}${x.set && x.sku ? ` <code class="pb-sku">SKU ${esc(x.sku)}</code>` : ''}</h2>${x.set ? `<div class="pb-setq"><span>ลูกค้าซื้อแบบไฟล์ (ปริ้นเอง): ใส่บัตร QR ของทั้งชุดใบเดียว</span>${qbtn(x.id)}</div>` : ''}${x.books.map((b) => btns(b, !x.set)).join('')}</section>`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>พิมพ์หนังสือ · SheetLab</title>
<style>body{font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;background:#f6f7fb;color:#1b1b1b;margin:0;padding:20px 16px;font-size:17px}main{max-width:860px;margin:0 auto}h1{font-size:24px;margin:0 0 10px}
.pb-how{background:#fff7e6;border:1px solid #f5d38a;border-radius:14px;padding:14px 18px;margin-bottom:14px}.pb-how ol{margin:6px 0 0;padding-left:22px;line-height:1.7}
#q{width:100%;box-sizing:border-box;font-size:18px;padding:12px 14px;border:2px solid #c9cfdb;border-radius:12px;margin:4px 0 14px}
.pb-card{background:#fff;border-radius:16px;padding:14px 16px;margin-bottom:12px;box-shadow:0 1px 6px rgba(0,0,0,.06)}.pb-card h2{font-size:18px;margin:0 0 8px}.pb-card h2 i,.pb-b i{color:#667;font-style:normal;font-weight:400}
.pb-tag{background:#ee4d2d;color:#fff;border-radius:8px;padding:2px 8px;font-size:13px}.pb-row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;border-top:1px solid #eef0f4;padding:10px 0}
.pb-b{display:flex;gap:10px;align-items:center;flex:1 1 300px}.pb-b img{width:48px;height:64px;object-fit:cover;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.2)}.pb-acts{display:flex;gap:8px;flex-wrap:wrap}
.pb-acts a{display:flex;flex-direction:column;align-items:center;text-decoration:none;font-weight:700;border-radius:12px;padding:10px 16px;min-width:130px;text-align:center}.pb-acts small{font-weight:400;font-size:13px}
.pb-c{background:#1e88e5;color:#fff}.po{background:#fff;border:2px solid #ee4d2d;border-radius:16px;padding:14px 16px;margin-bottom:16px}.po h2{font-size:20px;margin:0 0 10px}.po h2 span{background:#ee4d2d;color:#fff;border-radius:99px;padding:2px 10px;font-size:14px}.po-o{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;margin-bottom:10px}.po-o.done{opacity:.6}.po-h{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.po-h span{color:#667;font-size:14px}.po-h button{margin-left:auto;font-size:15px;font-weight:700;border-radius:10px;padding:8px 14px;border:1px solid #ccc;background:#fff;cursor:pointer}.po-h .po-done{background:#16a34a;color:#fff;border:0}.po-it{border-top:1px dashed #e5e7eb;margin-top:8px;padding-top:8px}.po-it-h{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.po-var{border-radius:8px;padding:2px 8px;font-size:14px;font-weight:700}.po-var.pr{background:#dbeafe;color:#1e40af}.po-var.fl{background:#fef3c7;color:#92400e}.po-bk{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:6px 0}.po-bk .pb-acts a{min-width:96px;padding:8px 12px}.po-map{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px;color:#b45309}.po-map select{font-size:15px;padding:6px;max-width:100%}.po-none,.po-note{color:#667;margin:6px 0 0;font-size:14px}.pb-q{background:#fff3e0;color:#b45309;border:2px solid #f59e0b}.pb-setq{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#fffbeb;border-radius:12px;padding:8px 12px;margin-bottom:6px;font-size:15px}.pb-w{background:#333;color:#fff}.pb-none{color:#667;text-align:center;padding:30px}.pb-sku{font-size:13px;background:#eef2ff;color:#3730a3;border-radius:6px;padding:1px 6px;font-weight:600}</style></head>
<body><main><h1>🖨 พิมพ์หนังสือตามออเดอร์ Shopee</h1>
<div class="pb-how"><b>วิธีพิมพ์</b><ol><li>ดูชื่อหนังสือ หรือ<b>เลข SKU</b> ในออเดอร์ Shopee แล้วพิมพ์ค้นหาในช่องข้างล่าง</li><li>กด <b>🖨 ปก</b> → ไฟล์ปกเปิดขึ้นมา → กด <b>Ctrl + P</b> → ช่องเครื่องพิมพ์เลือก <b>เครื่องสี</b> → พิมพ์</li><li>กด <b>🖨 เนื้อหา</b> → กด <b>Ctrl + P</b> → เลือก <b>เครื่องขาวดำ</b> → ตั้ง <b>พิมพ์สองหน้า (พลิกด้านยาว)</b> → พิมพ์</li><li>ชุดหลายเล่ม: พิมพ์ทีละเล่มตามรายการในชุด</li><li><b>ลูกค้าซื้อแบบไฟล์ (ปริ้นเอง)</b>: กด <b>🎫 บัตร QR</b> ของเล่ม/ชุดนั้น → พิมพ์บัตรใส่กล่องส่งไป ลูกค้าสแกนแล้วได้ไฟล์ของที่ซื้อทันที ไม่ต้องใส่เลขคำสั่งซื้อ</li><li>อยากค้นด้วย<b>เลขคำสั่งซื้อ Shopee</b>: เปิด Google Sheet "Shopee Auto Delivery" แท็บ <b>🖨 พิมพ์</b> ใส่เลขคำสั่งซื้อช่องสีเหลือง จะขึ้นหนังสือของออเดอร์นั้นพร้อมปุ่มพิมพ์</li></ol><small>กดครั้งแรกอาจรอ 5–10 วินาที (ระบบกำลังแยกไฟล์ปก/เนื้อหา) ครั้งต่อไปเร็ว</small></div>
${ordersBox(orders, list, url, act)}
<input id="q" type="search" placeholder="🔎 ค้นหาชื่อหนังสือ หรือเลข SKU เช่น TOEIC, SL-101" autocomplete="off">
<div id="list">${list.map(card).join('') || '<p class="pb-none">ยังไม่มีหนังสือ</p>'}</div><p class="pb-none" id="none" hidden>ไม่เจอ ลองพิมพ์คำสั้นลง</p></main>
<script>const q=document.getElementById('q'),cs=[...document.querySelectorAll('.pb-card')],no=document.getElementById('none');q.addEventListener('input',()=>{const v=q.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);let n=0;cs.forEach(c=>{const ok=v.every(w=>c.dataset.q.includes(w));c.hidden=!ok;if(ok)n++;});no.hidden=n>0;});</script></body></html>`;
}

// ข้อมูลสำหรับแท็บ "🖨 พิมพ์" ในชีต (ค้นด้วยเลขออเดอร์ Shopee): แถวละเล่ม · คอลัมน์ ชื่อบน Shopee (ใช้จับคู่กับแท็บ Data) · ชื่อเล่ม · ลิงก์ปก · ลิงก์เนื้อหา
export function printCsv(shop, url) {
  const P = (shop && shop.products) || [], find = (id) => P.find((x) => x.id === id), q = (t) => '"' + String(t == null ? '' : t).replace(/"/g, '""') + '"', rows = [];
  for (const p of P) {
    if (!p || !p.shopee) continue;
    const key = String(p.shopeeName || p.name || '').replace(/\s+/g, ' ').trim();
    const books = p.type === 'bundle' ? (p.items || []).map(find).filter((b) => b && b.cat !== 'notion') : [p];
    for (const b of books) rows.push([key, b.name, url(b.id, 'cover'), url(b.id, 'body')].map(q).join(','));
  }
  return rows.join('\r\n') + (rows.length ? '\r\n' : '');
}

// 🎫 บัตร QR ของสินค้า (ใส่กล่องพัสดุ Shopee แบบไฟล์): สแกนแล้วไปหน้าดาวน์โหลดของสินค้านั้นเลย ไม่ต้องจับคู่เลขคำสั่งซื้อ (คุณแดน 10 ต.ค. 69 "ไม่ต้องพึ่ง script.google")
export function cardPage(p, dl, n) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>บัตร QR · ${esc(p.name)}</title>
<style>@page{size:A4;margin:12mm}body{font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;margin:0;background:#f3f4f6;color:#111}.bar{text-align:center;padding:14px}.bar button{font-size:18px;font-weight:700;padding:12px 22px;border-radius:12px;border:0;background:#1e88e5;color:#fff;cursor:pointer}.bar p{color:#555;margin:8px 0 0;font-size:14px}
.card{width:90mm;margin:10mm auto;background:#fff;border:1.5px dashed #999;border-radius:6mm;padding:7mm 6mm;text-align:center;box-sizing:border-box}.logo{display:inline-block;font-weight:800;font-size:15px;background:#111;color:#fff;border-radius:99px;padding:3px 12px}
h1{font-size:15px;line-height:1.35;margin:4mm 0 3mm}#qr{display:flex;justify-content:center;margin:2mm 0}#qr img,#qr canvas{width:48mm;height:48mm}.big{font-size:16px;font-weight:800;margin:3mm 0 1mm}.fine{font-size:11.5px;color:#444;line-height:1.5}
@media print{body{background:#fff}.bar{display:none}.card{margin:0 auto}}</style></head>
<body><div class="bar"><button onclick="print()">🖨 พิมพ์บัตร (Ctrl + P)</button><p>ตัดตามเส้นประ แล้วใส่ในกล่องพัสดุ · ใช้กับลูกค้าที่ซื้อแบบไฟล์ (ปริ้นเอง)</p></div>
<div class="card"><span class="logo">SheetLab</span><h1>${esc(p.name)}${n > 1 ? `<br><small>(${n} เล่ม)</small>` : ''}</h1><div id="qr"></div>
<p class="big">📲 สแกนเพื่อดาวน์โหลดไฟล์</p><p class="fine">เปิดกล้องมือถือสแกน QR แล้วกดดาวน์โหลด<br>เปิดในคอมหรือแท็บเล็ตก็ได้ · เก็บบัตรนี้ไว้ โหลดซ้ำได้ทุกเมื่อ<br>มีปัญหาทักแชทร้านใน Shopee ได้เลย</p></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><script>new QRCode(document.getElementById('qr'),{text:${JSON.stringify(dl)},width:400,height:400,correctLevel:QRCode.CorrectLevel.M});</script></body></html>`;
}
