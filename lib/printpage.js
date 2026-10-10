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

// 📦 หน้าพิมพ์ของแม่ แบบใช้ง่ายสำหรับผู้สูงอายุ (คุณแดน 11 ต.ค. 69): ตัวใหญ่ ปุ่มใหญ่มีคำ ทีละงาน · ปุ่มสีฟ้า = เครื่องสี (ปก) · ปุ่มสีดำ = เครื่องขาวดำ (เนื้อหา)
// กดพิมพ์แล้วปุ่มเป็นสีเขียว ✓ (จำในเครื่อง) · ปุ่มใหญ่ "แพ็กเสร็จแล้ว" ถามยืนยันก่อน · ปรับขนาดตัวหนังสือได้ · หน้ารีเฟรชเองเมื่อไม่ได้ใช้งาน
// ลูกค้าปริ้นเอง = ใส่การ์ด QR ใบเดียวกันทุกออเดอร์ (sheetlabth.com/s) · จับคู่ไม่ได้ = เลือกเล่มครั้งเดียว · เล่มอื่นค้นหาได้ข้างล่าง (พับไว้)
const sheets = (pages) => (pages > 1 ? Math.ceil((pages - 1) / 2) : 0);
const pbtn = (url, sn, b, part) => {
  const cov = part === 'cover';
  return `<a class="pbtn ${cov ? 'cov' : 'bw'}" href="${esc(url(b.id, part))}" target="_blank" rel="noopener" data-mark="${esc(sn + '|' + b.id + '|' + part)}"><b>${cov ? '① พิมพ์ปก' : '② พิมพ์เนื้อหา'}</b><small>${cov ? 'เครื่องสี · 1 หน้า' : `เครื่องขาวดำ · พิมพ์ 2 หน้า${b.pages > 1 ? ` · ${b.pages - 1} หน้า` : ''}`}</small></a>`;
};
const bookRow = (url, sn, b, n, of) => `<div class="bk"><div class="bk-i">${b.img ? `<img src="${esc(b.img)}" alt="" loading="lazy">` : '<span class="noimg">📘</span>'}<div>${of > 1 ? `<span class="bk-n">เล่ม ${n} จาก ${of}</span>` : ''}<b>${esc(b.name)}</b>${b.pages ? `<span class="bk-p">${b.pages} หน้า · กระดาษประมาณ ${sheets(b.pages)} แผ่น</span>` : ''}${b.sku ? `<code class="pb-sku">SKU ${esc(b.sku)}</code>` : ''}</div></div><div class="bk-a">${pbtn(url, sn, b, 'cover')}${pbtn(url, sn, b, 'body')}</div></div>`;
function ordersBox(orders, list, url, act, cardUrl) {
  if (!orders) return '';
  const byId = {}; for (const x of list) { byId[x.id] = x; for (const b of x.books) byId[b.id] = byId[b.id] || { ...b, books: [b] }; }
  const opts = list.map((x) => `<option value="${esc(x.id)}">${esc((x.set ? '📦 ' : '') + x.name)}</option>`).join('');
  const item = (o, it) => { const x = it.pid && byId[it.pid], pr = /ร้าน\s*ปริ้น|ร้าน\s*พิมพ์|เล่มพิมพ์/i.test(it.variation || '') && !/ลูกค้า/.test(it.variation || '');
    const qty = it.qty > 1 ? `<span class="qty">× ${it.qty}</span>` : '';
    if (!x) return `<div class="it unk"><div class="it-h"><span class="tag">❓ ยังไม่รู้ว่าเล่มไหน</span><b>${esc(it.name)}</b>${qty}</div><label class="map">เลือกหนังสือที่ตรงกัน (เลือกครั้งเดียว ครั้งหน้าระบบจำได้เอง)<select data-po-sel="${esc(o.sn)}|${esc(it.itemId || '')}|${esc(it.name)}"><option value="">— กดเพื่อเลือกหนังสือ —</option>${opts}</select></label></div>`;
    if (!pr) return `<div class="it file"><div class="it-h"><span class="tag fl">🎫 ส่งการ์ด QR</span><b>${esc(x.name)}</b>${qty}</div><p class="say">หยิบ <b>การ์ด QR SheetLab 1 ใบ</b> ใส่กล่อง (การ์ดเดียวกันทุกออเดอร์) ไม่ต้องพิมพ์หนังสือ</p><p class="fine"><a href="${esc(cardUrl)}" target="_blank" rel="noopener">การ์ดหมด? กดพิมพ์การ์ด</a> · <a href="${esc(url(x.id, 'card'))}" target="_blank" rel="noopener">บัตรเฉพาะเล่มนี้</a></p></div>`;
    const bs = x.books, keys = bs.flatMap((b) => [o.sn + '|' + b.id + '|cover', o.sn + '|' + b.id + '|body']);
    return `<div class="it pr" data-keys="${esc(keys.join(','))}"><div class="it-h"><span class="tag pr">📘 พิมพ์เป็นเล่ม</span><b>${esc(x.name)}</b>${qty}</div>${it.qty > 1 ? `<p class="say warn">⚠️ ลูกค้าสั่ง <b>${it.qty} ชุด</b> พิมพ์ทุกอย่าง ${it.qty} ครั้ง (ตั้งจำนวนสำเนา = ${it.qty} ตอนกดพิมพ์)</p>` : ''}<p class="prog">พิมพ์แล้ว <b class="pg-n">0</b> จาก ${keys.length} ไฟล์</p>${bs.map((b, i) => bookRow(url, o.sn, b, i + 1, bs.length)).join('')}</div>`; };
  const card = (o, i, done) => `<article class="o${done ? ' done' : ''}"><div class="o-h"><span class="o-no">${done ? '✓ เสร็จแล้ว' : `งานที่ ${i + 1}`}</span><span class="o-sn">ออเดอร์ #${esc(o.sn)}${o.date ? ` · สั่งเมื่อ ${esc(o.date)}` : ''}</span>${done ? `<button class="undo" data-po="undo" data-sn="${esc(o.sn)}">↩ ยังไม่เสร็จ</button>` : ''}</div>${done ? '' : o.items.map((it) => item(o, it)).join('') + `<button class="donebtn" data-po="done" data-sn="${esc(o.sn)}">✅ แพ็กใส่กล่องเสร็จแล้ว</button>`}</article>`;
  const n = orders.todo.length;
  return `<section class="sum ${n ? 'has' : 'none'}">${n ? `มีงานต้องทำ <b>${n}</b> ออเดอร์` : '✅ ไม่มีงานค้าง พักผ่อนได้เลย'}</section>
  ${orders.todo.map((o, i) => card(o, i, false)).join('')}
  ${orders.done.length ? `<details class="dn"><summary>งานที่เสร็จแล้ว (${orders.done.length})</summary>${orders.done.map((o, i) => card(o, i, true)).join('')}</details>` : ''}
  <script>const PO=${JSON.stringify(act)};document.addEventListener('click',async e=>{const b=e.target.closest('[data-po]');if(!b)return;if(b.dataset.po==='done'&&!confirm('แพ็กออเดอร์นี้ใส่กล่องเสร็จแล้วใช่ไหม?'))return;b.disabled=true;b.textContent='กำลังบันทึก...';await fetch(PO,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:b.dataset.po,sn:b.dataset.sn})});location.reload();});
  document.addEventListener('change',async e=>{const s=e.target.closest('[data-po-sel]');if(!s||!s.value)return;const [sn,itemId,...n]=s.dataset.poSel.split('|');s.disabled=true;await fetch(PO,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'map',sn,itemId,name:n.join('|'),pid:s.value})});location.reload();});</script>`;
}

export function printPage(list, url, orders, act, cardUrl = '/shopee-card') {
  const cbtn = (b) => `<div class="bk-a">${pbtn(url, 'x', b, 'cover')}${pbtn(url, 'x', b, 'body')}</div>`;
  const catRow = (b, qr) => `<div class="bk"><div class="bk-i">${b.img ? `<img src="${esc(b.img)}" alt="" loading="lazy">` : '<span class="noimg">📘</span>'}<div><b>${esc(b.name)}</b>${b.pages ? `<span class="bk-p">${b.pages} หน้า · กระดาษประมาณ ${sheets(b.pages)} แผ่น</span>` : ''}${b.sku ? `<code class="pb-sku">SKU ${esc(b.sku)}</code>` : ''}${qr ? `<a class="fine" href="${esc(url(b.id, 'card'))}" target="_blank" rel="noopener">บัตร QR เฉพาะเล่ม</a>` : ''}</div></div>${cbtn(b)}</div>`;
  const card = (x) => `<section class="pb-card" data-q="${esc(String(x.name + ' ' + (x.sku || '') + ' ' + (x.sku ? x.sku + '-p' : '') + ' ' + x.books.map((b) => b.name + ' ' + b.sku + (b.sku ? ' ' + b.sku + '-p' : '')).join(' ')).toLowerCase())}"><h3>${x.shopee ? '<b class="pb-tag">Shopee</b> ' : ''}${x.set ? '📦 ' : ''}${esc(x.name)}${x.set ? ` <i>· ${x.books.length} เล่ม</i>` : ''}${x.set && x.sku ? ` <code class="pb-sku">SKU ${esc(x.sku)}</code>` : ''}${x.set ? ` <a class="fine" href="${esc(url(x.id, 'card'))}" target="_blank" rel="noopener">บัตร QR ทั้งชุด</a>` : ''}</h3>${x.books.map((b) => catRow(b, !x.set)).join('')}</section>`;
  const hasOrders = orders && (orders.todo.length || orders.done.length);
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>งานพิมพ์ · SheetLab</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>html{font-size:20px}body{font-family:'Sarabun',Tahoma,system-ui,sans-serif;background:#f4f1ea;color:#111;margin:0;line-height:1.5}main{max-width:1000px;margin:0 auto;padding:0 16px 60px}
.top{position:sticky;top:0;z-index:5;background:#fff;border-bottom:2px solid #e5e0d4;padding:10px 16px}.top-in{max-width:1000px;margin:0 auto;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.top h1{font-size:1.4rem;margin:0;flex:1 1 auto}
.top button{font:inherit;font-size:.9rem;font-weight:700;border:2px solid #333;background:#fff;border-radius:12px;padding:8px 14px;cursor:pointer;min-height:48px}.top .rf{background:#111;color:#fff}
.how{background:#fff;border-radius:18px;padding:14px 18px;margin:16px 0;border:2px solid #e5e0d4}.how h2{font-size:1.05rem;margin:0 0 8px}.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none}
.steps li{background:#faf8f3;border-radius:14px;padding:10px 12px;font-size:.95rem}.steps li b.n{display:inline-flex;width:1.6rem;height:1.6rem;border-radius:50%;background:#111;color:#fff;align-items:center;justify-content:center;margin-right:6px;font-size:.85rem}
kbd{display:inline-block;border:2px solid #333;border-bottom-width:4px;border-radius:8px;padding:0 8px;font:inherit;font-weight:800;background:#fff}.c-cov{color:#0b57d0;font-weight:800}.c-bw{color:#111;font-weight:800}
.sum{font-size:1.3rem;font-weight:700;border-radius:18px;padding:16px 20px;margin:16px 0}.sum.has{background:#fff1e6;border:3px solid #ea580c;color:#9a3412}.sum.none{background:#e8f7ec;border:3px solid #16a34a;color:#14532d}.sum b{font-size:1.6rem}
.o{background:#fff;border-radius:20px;padding:16px 18px;margin:0 0 20px;border:3px solid #ea580c;box-shadow:0 2px 10px rgba(0,0,0,.06)}.o.done{border-color:#cbd5c0;opacity:.75}.o-h{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;border-bottom:2px dashed #eee;padding-bottom:8px;margin-bottom:8px}.o-no{font-size:1.4rem;font-weight:800}.o-sn{color:#555;font-size:.85rem}
.it{padding:10px 0;border-bottom:1px solid #eee}.it-h{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:1.05rem}.tag{border-radius:10px;padding:2px 10px;font-weight:800;font-size:.9rem;background:#fde68a}.tag.pr{background:#dbeafe;color:#1e3a8a}.tag.fl{background:#fef3c7;color:#92400e}.qty{background:#dc2626;color:#fff;border-radius:10px;padding:0 10px;font-weight:800}
.say{font-size:1.05rem;margin:8px 0}.say.warn{background:#fee2e2;border-radius:12px;padding:8px 12px;color:#991b1b}.prog{margin:6px 0;font-size:.95rem;color:#14532d}.prog.all{background:#e8f7ec;border-radius:10px;padding:4px 10px;font-weight:800}
.bk{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px 0;border-top:1px solid #f1eee6}.bk-i{display:flex;gap:12px;align-items:center;flex:1 1 320px;min-width:0}.bk-i img{width:64px;height:88px;object-fit:cover;border-radius:6px;box-shadow:0 1px 5px rgba(0,0,0,.25)}.noimg{font-size:2.4rem}.bk-i b{display:block;font-size:1rem}.bk-n{display:inline-block;font-size:.8rem;background:#111;color:#fff;border-radius:8px;padding:0 8px;margin-bottom:2px}.bk-p{display:block;color:#555;font-size:.85rem}
.bk-a{display:flex;gap:10px;flex-wrap:wrap}.pbtn{display:flex;flex-direction:column;align-items:center;justify-content:center;text-decoration:none;border-radius:16px;padding:10px 16px;min-width:190px;min-height:72px;text-align:center;border:3px solid transparent}.pbtn b{font-size:1.1rem}.pbtn small{font-size:.8rem;opacity:.95}
.pbtn.cov{background:#0b57d0;color:#fff}.pbtn.bw{background:#111;color:#fff}.pbtn.ok{background:#e8f7ec;color:#14532d;border-color:#16a34a}.pbtn.ok b::before{content:'✓ '}.pbtn.wait{opacity:.6}.pbtn:focus-visible,button:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible{outline:4px solid #f59e0b;outline-offset:3px}
.donebtn{display:block;width:100%;margin-top:14px;font:inherit;font-size:1.25rem;font-weight:800;background:#16a34a;color:#fff;border:0;border-radius:16px;padding:16px;cursor:pointer;min-height:64px}.undo{margin-left:auto;font:inherit;font-size:.85rem;border:2px solid #999;background:#fff;border-radius:10px;padding:6px 12px;cursor:pointer}
.map{display:block;margin-top:8px;color:#9a3412;font-weight:700}.map select{display:block;width:100%;margin-top:6px;font:inherit;font-size:1rem;padding:10px;border:2px solid #ea580c;border-radius:12px;background:#fff}.unk{background:#fff7ed;border-radius:12px;padding:10px 12px}
.dn,.cat{background:#fff;border-radius:18px;padding:12px 18px;margin:16px 0;border:2px solid #e5e0d4}.dn summary,.cat summary{cursor:pointer;font-size:1.1rem;font-weight:800;min-height:44px;display:flex;align-items:center}
#q{width:100%;box-sizing:border-box;font:inherit;font-size:1.05rem;padding:14px 16px;border:3px solid #999;border-radius:14px;margin:10px 0 14px}.pb-card{border-top:2px solid #eee;padding:10px 0}.pb-card h3{font-size:1rem;margin:6px 0}.pb-card h3 i{font-style:normal;color:#555;font-weight:400}.pb-tag{background:#ee4d2d;color:#fff;border-radius:8px;padding:1px 8px;font-size:.75rem}
.pb-sku{display:inline-block;font-size:.75rem;background:#eef2ff;color:#3730a3;border-radius:6px;padding:0 6px;font-weight:700;margin-right:6px}.fine{font-size:.8rem;color:#555}a.fine{color:#0b57d0}.pb-none{color:#555;text-align:center;padding:20px}
#toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#111;color:#fff;border-radius:14px;padding:12px 20px;font-size:1rem;font-weight:700;display:none;z-index:9;max-width:90vw;text-align:center}</style></head>
<body><div class="top"><div class="top-in"><h1>🖨 งานพิมพ์ SheetLab</h1><button class="rf" id="rf">🔄 ดูออเดอร์ใหม่</button><button id="fs-" aria-label="ตัวหนังสือเล็กลง">ก−</button><button id="fs+" aria-label="ตัวหนังสือใหญ่ขึ้น">ก+ ตัวใหญ่</button></div></div><main>
<section class="how"><h2>วิธีพิมพ์ (ทำทีละปุ่ม)</h2><ol class="steps"><li><b class="n">1</b>กดปุ่มพิมพ์ ไฟล์จะเปิดหน้าใหม่ <span class="fine">(ครั้งแรกรอ 5–10 วินาที)</span></li><li><b class="n">2</b>กด <kbd>Ctrl</kbd> + <kbd>P</kbd> พร้อมกัน</li><li><b class="n">3</b>เลือกเครื่องพิมพ์ให้ตรงสีปุ่ม<br><span class="c-cov">ปุ่มฟ้า = เครื่องสี</span> · <span class="c-bw">ปุ่มดำ = เครื่องขาวดำ (พิมพ์ 2 หน้า)</span></li><li><b class="n">4</b>กด "พิมพ์" แล้วปิดหน้าไฟล์ กลับมาหน้านี้ ปุ่มที่ทำแล้วจะเป็น<b style="color:#16a34a"> สีเขียว ✓</b></li></ol></section>
${ordersBox(orders, list, url, act, cardUrl)}
<details class="cat"${hasOrders ? '' : ' open'}><summary>🔎 หาเล่มอื่นมาพิมพ์ (ไม่มีในออเดอร์)</summary>
<input id="q" type="search" placeholder="พิมพ์ชื่อหนังสือ หรือเลข SKU เช่น TOEIC, SL-101" autocomplete="off" aria-label="ค้นหาหนังสือ">
<div id="list">${list.map(card).join('') || '<p class="pb-none">ยังไม่มีหนังสือ</p>'}</div><p class="pb-none" id="none" hidden>ไม่เจอ ลองพิมพ์คำสั้นลง</p></details>
<p class="fine" style="text-align:center">ออเดอร์ใหม่ขึ้นเองภายในไม่กี่นาทีหลัง Shopee แจ้ง · หน้านี้รีเฟรชเองทุก 3 นาที</p></main><div id="toast" role="status"></div>
<script>(()=>{const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const fs=()=>{const v=Number(LS.get('pfs'))||20;document.documentElement.style.fontSize=v+'px';};fs();
document.getElementById('fs+').onclick=()=>{LS.set('pfs',Math.min(30,(Number(LS.get('pfs'))||20)+2));fs();};document.getElementById('fs-').onclick=()=>{LS.set('pfs',Math.max(16,(Number(LS.get('pfs'))||20)-2));fs();};
document.getElementById('rf').onclick=()=>location.reload();
const T=document.getElementById('toast');let tt;const toast=m=>{T.textContent=m;T.style.display='block';clearTimeout(tt);tt=setTimeout(()=>T.style.display='none',5000);};
const mark=()=>{document.querySelectorAll('[data-mark]').forEach(a=>{if(LS.get('pm:'+a.dataset.mark))a.classList.add('ok');});document.querySelectorAll('.it.pr').forEach(it=>{const ks=(it.dataset.keys||'').split(',').filter(Boolean),n=ks.filter(k=>LS.get('pm:'+k)).length,p=it.querySelector('.prog');if(p){p.querySelector('.pg-n').textContent=n;p.classList.toggle('all',n===ks.length);if(n===ks.length)p.innerHTML='✓ พิมพ์ครบทุกไฟล์แล้ว เหลือแพ็กใส่กล่อง';}});};mark();
let last=Date.now();document.addEventListener('click',e=>{last=Date.now();const a=e.target.closest('[data-mark]');if(!a)return;LS.set('pm:'+a.dataset.mark,'1');a.classList.add('ok');toast(a.classList.contains('cov')?'กำลังเปิดไฟล์ปก… แล้วกด Ctrl + P เลือกเครื่องสี':'กำลังเปิดไฟล์เนื้อหา… แล้วกด Ctrl + P เลือกเครื่องขาวดำ');mark();});
setInterval(()=>{const a=document.activeElement;if(document.visibilityState==='visible'&&Date.now()-last>150e3&&!(a&&/^(INPUT|SELECT)$/.test(a.tagName)))location.reload();},180e3);
const q=document.getElementById('q'),cs=[...document.querySelectorAll('.pb-card')],no=document.getElementById('none');q.addEventListener('input',()=>{last=Date.now();const v=q.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);let n=0;cs.forEach(c=>{const ok=v.every(w=>c.dataset.q.includes(w));c.hidden=!ok;if(ok)n++;});no.hidden=n>0;});})();</script></body></html>`;
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
