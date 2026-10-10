// 🛒 Shopee Auto Delivery (คุณแดน 10 ต.ค. 69): Shopee ไม่ให้ขายสินค้าดิจิทัล ร้านจึงส่งบัตร QR ทางไปรษณีย์ ลูกค้าสแกนแล้วใส่เลขคำสั่งซื้อ
// Google Sheet "Shopee Auto Delivery" ของคุณแดน แท็บ Links: A = ชื่อสินค้าบน Shopee · B = ลิงก์ดาวน์โหลด (Apps Script เดิมของคุณแดนจับคู่ชื่อกับออเดอร์)
// เปิดสวิตช์ "ลง Shopee" ในหลังบ้าน → แถวเข้าแท็บ Links เอง · ปิดสวิตช์ (กดผิด) → แถวถูกลบ
// วิธีเชื่อม: Apps Script ตัวเล็กในชีตดึงรายการจาก action=shopee_sheet ทุก 5 นาที แถวที่ระบบเพิ่มมีป้าย "SheetLab:<id>" ในคอลัมน์ C แตะเฉพาะแถวพวกนี้ แถวที่คุณแดนพิมพ์เองไม่ถูกแตะ

const isBundle = (p) => p && p.type === 'bundle';
const okLink = (u) => /^https:\/\//.test(String(u || '').trim());

// รายการแถวที่ควรมีในชีต จากสินค้าที่เปิดสวิตช์ Shopee · ชุด = ลิงก์ทุกเล่ม (บรรทัดละเล่ม) · ไม่มีลิงก์ไฟล์ = ไม่ใส่ (รายงานใน missing)
export function shopeeRows(shop, links) {
  const products = (shop && shop.products) || [], find = (id) => products.find((x) => x.id === id), rows = [], missing = [];
  for (const p of products) {
    if (!p || !p.shopee) continue;
    const name = String(p.shopeeName || p.name || '').replace(/\s+/g, ' ').trim();
    let link = '';
    if (isBundle(p)) {
      const ls = (p.items || []).map((id) => String(links[id] || '').trim()).filter(okLink);
      if (ls.length === (p.items || []).length) link = ls.join('\n');
    } else if (okLink(links[p.id])) link = String(links[p.id]).trim();
    if (!name || !link) { missing.push({ id: p.id, name: name || p.id }); continue; }
    rows.push({ id: p.id, name, link, bundle: isBundle(p) || undefined, books: isBundle(p) ? (p.items || []).map((id) => (find(id) || {}).name || id) : undefined });
  }
  return { rows, missing };
}

// โค้ด Apps Script ที่คุณแดนวางในชีต (ส่วนขยาย → Apps Script → ไฟล์ใหม่) แล้วกดรัน slSetup ครั้งเดียว
export function shopeeScript(url) {
  return `// SheetLab → แท็บ Links (เพิ่ม/ลบสินค้าเองตามสวิตช์ "ลง Shopee" ในหลังบ้าน SheetLab)
// แตะเฉพาะแถวที่คอลัมน์ C ขึ้นต้นด้วย SheetLab: · แถวที่พิมพ์เองไม่ถูกแตะ
// วิธีใช้: เลือกฟังก์ชัน slSetup แล้วกด ▶ Run ครั้งเดียว (อนุญาตสิทธิ์) ระบบจะซิงก์ทุก 5 นาทีเอง
const SL_URL = '${url}';
const SL_TAB = 'Links';

function slSync() {
  const res = UrlFetchApp.fetch(SL_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('SheetLab ตอบ ' + res.getResponseCode());
  const j = JSON.parse(res.getContentText());
  if (!j.ok || !Array.isArray(j.rows)) throw new Error('SheetLab: ' + (j.error || 'ข้อมูลไม่ถูกต้อง'));
  const sh = SpreadsheetApp.getActive().getSheetByName(SL_TAB);
  if (!sh) throw new Error('ไม่พบแท็บ ' + SL_TAB);
  const want = {};
  j.rows.forEach(function (r) { want['SheetLab:' + r.id] = r; });
  const last = sh.getLastRow(), vals = last ? sh.getRange(1, 1, last, 3).getValues() : [];
  let added = 0, removed = 0, updated = 0;
  for (let i = vals.length - 1; i >= 0; i--) {
    const tag = String(vals[i][2] || '');
    if (tag.indexOf('SheetLab:') !== 0) continue;
    const w = want[tag];
    if (!w) { sh.deleteRow(i + 1); removed++; continue; }
    if (vals[i][0] !== w.name || vals[i][1] !== w.link) { sh.getRange(i + 1, 1, 1, 2).setValues([[w.name, w.link]]); updated++; }
    delete want[tag];
  }
  Object.keys(want).forEach(function (tag) { sh.appendRow([want[tag].name, want[tag].link, tag]); added++; });
  console.log('SheetLab sync: เพิ่ม ' + added + ' ลบ ' + removed + ' แก้ ' + updated);
}

function slSetup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'slSync') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('slSync').timeBased().everyMinutes(5).create();
  slSync();
}
`;
}
