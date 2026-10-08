// แยกโค้ดหลังบ้านออกจากหน้าลูกค้า (คุณแดน 8 ต.ค. 69: หน้าขายโหลดเร็วขึ้น)
// src/index.html ยังเป็นไฟล์เดียวเหมือนเดิม · ตอนเสิร์ฟ: ฟังก์ชันที่ลูกค้าไม่ใช้ย้ายไป /adm.js (แอดมินโหลดตอนเปิดหลังบ้าน)
// ฟังก์ชันที่ย้ายไปเหลือตัวแทนเล็กๆ ถ้ามีใครเรียก จะโหลด /adm.js ให้ก่อนแล้วทำงานต่อตามปกติ (ไม่มีทางพัง แค่ช้าลงครั้งนั้น)
// act() (ปุ่มทั้งเว็บ): case ที่ชื่อปุ่มไม่ปรากฏในโค้ดฝั่งลูกค้า ย้ายไป actAdm() ใน /adm.js
import * as acorn from 'acorn';
import crypto from 'node:crypto';

// ฟังก์ชันที่หน้าลูกค้าใช้ (วัดจากการเปิดหน้าร้าน/หน้าขาย/ตะกร้า/ชำระเงินจริง + ขั้นตอนจ่ายเงิน QR/หน้าขอบคุณ)
// เพิ่มฟังก์ชันใหม่ที่หน้าลูกค้าใช้: ใส่ชื่อที่นี่ (เทส smoke ฟ้องถ้าหน้าลูกค้าต้องโหลด /adm.js)
export const KEEP = new Set(`load saveCache normalize tick loadSold drawLB initPixel track curProduct calc toast cartSave paidCard cartFab cartBtn drawCart drawToast
  bundleBooks bundlePlans bundleView shopHead rvSection storeItems storeMode fromPrice shelves stHead stFoot storeView cartView orderView crsPreview crsCurriculum
  shopView payLogos paySafe hasAdminAccess hit setHtml render act codeRow qrEmailGuess qrBox qrInner pvSync applyUrl
  go navTo route findOrder fakeQR payView thanksView orderRow selectProduct markPaid copyText codeApply qrPaint glideTo qrPrefetch qrSave qrStop qrPoll qrMake
  verifyOrder cover vipPageHref vipPageLink save loadScript authFetch sessionLost seed blankProduct newId`.split(/\s+/).filter(Boolean));

const LOADER = `var __admOk=0;function __admRun(t){if(__admOk)return;__admOk=1;var s=document.createElement('script');s.text=t;document.head.appendChild(s);}
function __adm(){if(__admOk)return;var x=new XMLHttpRequest();x.open('GET','/adm.js?v='+__admV,false);x.send();if(x.status!==200)throw new Error('adm '+x.status);__admRun(x.responseText);}
function __admGo(f,n,t,a){if(!__admOk)window.__admWhy=n;__adm();var g=window[n];if(g===f)throw new Error('adm: '+n);return g.apply(t,a);}
window.__admAsync=function(){return __admOk?Promise.resolve():fetch('/adm.js?v='+__admV).then(function(r){if(!r.ok)throw new Error('adm '+r.status);return r.text();}).then(__admRun);};
`;

const terminal = (ss) => { const l = ss[ss.length - 1]; return !!l && (/^(Break|Return|Throw)Statement$/.test(l.type) || (l.type === 'BlockStatement' && terminal(l.body))); };

export function splitHtml(html) {
  const a = html.indexOf('<script>'), b = html.lastIndexOf('</script>');
  if (a < 0 || b < a) return null;
  const src = html.slice(a + 8, b);
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
  const fns = ast.body.filter((n) => n.type === 'FunctionDeclaration');
  const act = fns.find((n) => n.id.name === 'act');
  const moved = fns.filter((n) => n !== act && !KEEP.has(n.id.name));
  const edits = []; // [start, end, replacement] ในสคริปต์หน้าลูกค้า
  for (const n of moved) edits.push([n.start, n.end, `function ${n.id.name}(){return __admGo(${n.id.name},"${n.id.name}",this,arguments)}`]);
  let actAdm = '';
  if (act) {
    const [pre, sw] = [act.body.body.slice(0, -1), act.body.body[act.body.body.length - 1]];
    if (sw && sw.type === 'SwitchStatement' && !sw.cases.some((c) => !c.test) && act.params.length === 2) {
      // โค้ดฝั่งลูกค้า (ไม่รวม act และฟังก์ชันที่ย้าย): ชื่อปุ่มที่ปรากฏในนี้ = ลูกค้ากดได้ → เก็บไว้ใน act
      const skip = [...moved, act].map((n) => [n.start, n.end]).sort((x, y) => x[0] - y[0]);
      let core = '', p = 0; for (const [s, e] of skip) { core += src.slice(p, s); p = e; } core += src.slice(p);
      const lits = new Set(); for (const m of core.matchAll(/['"`]([A-Za-z_$][\w$-]*)['"`]/g)) lits.add(m[1]);
      const groups = []; let g = [];
      for (const c of sw.cases) { g.push(c); if (terminal(c.consequent)) { groups.push(g); g = []; } }
      if (g.length) groups.push(g);
      const keepG = [], admG = [];
      for (const gr of groups) (gr.some((c) => c.test.type !== 'Literal' || lits.has(String(c.test.value))) ? keepG : admG).push(gr);
      const txt = (gr) => src.slice(gr[0].start, gr[gr.length - 1].end);
      const head = pre.map((s) => src.slice(s.start, s.end)).join('\n'), [pa, pb] = act.params.map((x) => src.slice(x.start, x.end));
      actAdm = `function actAdm(${pa},${pb}){${head}\nswitch(${src.slice(sw.discriminant.start, sw.discriminant.end)}){\n${admG.map(txt).join('\n')}\n}}`;
      edits.push([act.start, act.end, `function act(${pa},${pb}){${head}\nswitch(${src.slice(sw.discriminant.start, sw.discriminant.end)}){\n${keepG.map(txt).join('\n')}\ndefault:return actAdm(${pa},${pb});\n}}\nfunction actAdm(){return __admGo(actAdm,"actAdm",this,arguments)}`]);
    }
  }
  edits.sort((x, y) => x[0] - y[0]);
  let out = '', p = 0; for (const [s, e, r] of edits) { out += src.slice(p, s) + r; p = e; } out += src.slice(p);
  const chunk = moved.map((n) => src.slice(n.start, n.end)).join('\n') + '\n' + actAdm + '\n';
  const v = crypto.createHash('sha1').update(chunk).digest('hex').slice(0, 12);
  return { html: html.slice(0, a + 8) + `var __admV="${v}";` + LOADER + out + html.slice(b), chunk, v, moved: moved.length };
}
