// ทดสอบส่วนที่เซิร์ฟเวอร์สร้างหน้าเอง (ไม่ต้องเปิดเบราว์เซอร์): หน้ารวมหัวข้อ SEO, ลิงก์ในบทความ, ข้อมูลคำถามที่พบบ่อยให้ Google
import fs from 'node:fs';
import path from 'node:path';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const { TOPICS, topicItems, topicReady, topicPage } = await import(path.join(root, 'lib/topics.js'));
const { renderMd, articlePage } = await import(path.join(root, 'lib/quiz.js'));
const shop = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixture-shop.json'), 'utf8'));
let bad = 0; const ok = (name, cond, d = '') => { console.log(`${cond ? '✓' : '✗'} ${name}${d ? ' — ' + d : ''}`); if (!cond) bad++; };
const articles = [{ slug: 'toeic-tense-guide', title: 'สรุป Tense TOEIC', desc: 'd', cat: 'grammar', body: 'x' }];
const quizzes = [{ slug: 'toeic-level-test', title: 'วัดระดับ TOEIC', cat: 'grammar', mode: 'level', questions: [1] }, { slug: 'toeic-tense-quiz', title: 'TOEIC Tense 10 ข้อ', cat: 'grammar', questions: [1] }];
const lds = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
for (const t of TOPICS) {
  const it = topicItems(t, { articles, quizzes, products: shop.products }), html = topicPage(t, it, { site: 'https://sheetlabth.com', all: TOPICS });
  let parsed = []; try { parsed = lds(html); } catch (e) { ok(`หัวข้อ ${t.slug}: JSON-LD อ่านได้`, false, e.message); continue; }
  ok(`หัวข้อ ${t.slug}: หน้าสร้างได้ · ${topicReady(it) ? 'ให้ Google เก็บ' : 'noindex (ของยังน้อย)'}`, html.includes('<h1') && parsed.some((x) => x['@type'] === 'CollectionPage') && (topicReady(it) ? !html.includes('noindex') : html.includes('noindex')));
}
ok('ไม่มีหัวข้อที่มีแต่สินค้าแต่ถูกให้เก็บ', TOPICS.every((t) => { const it = topicItems(t, { articles: [], quizzes: [], products: shop.products }); return !topicReady(it); }));
const md = renderMd('ลอง [ทำแบบทดสอบ](/quiz/toeic-tense-quiz) และ [เว็บอื่น](https://evil.com/x) และ [เต็ม](https://sheetlabth.com/learn/a)').html;
ok('ลิงก์ภายในเว็บในบทความใช้ได้ ลิงก์นอกเว็บไม่กลายเป็นลิงก์', md.includes('href="/quiz/toeic-tense-quiz"') && md.includes('href="/learn/a"') && !md.includes('evil.com/x"'));
const ap = articlePage({ slug: 'a', title: 'T', desc: 'D', cat: 'grammar', body: '## เนื้อหา\nข้อความ\n## คำถามที่พบบ่อย\n### ใช้ Present Perfect เมื่อไหร่\nใช้กับเหตุการณ์ที่ต่อเนื่องถึงปัจจุบัน\n### ข้อสองคือ\nคำตอบสอง\n## สรุป\nจบ', created_at: '2026-10-01' }, { products: shop.products, site: 'https://sheetlabth.com' });
const faq = lds(ap).find((x) => x['@type'] === 'FAQPage');
ok('บทความที่มี "คำถามที่พบบ่อย" ได้ข้อมูล FAQ ให้ Google', !!faq && faq.mainEntity.length === 2 && faq.mainEntity[0].name === 'ใช้ Present Perfect เมื่อไหร่');
const V = await import(path.join(root, 'lib/members.js'));
const tk = V.signToken('a@b.co', 60e3, 'login');
ok('VIP: ลิงก์เข้าระบบอ่านได้เฉพาะจุดประสงค์เดียวกัน และแก้ไขไม่ได้', V.readToken(tk, 'login') === 'a@b.co' && V.readToken(tk, 'session') === null && V.readToken(tk.slice(0, -2) + 'xx', 'login') === null && V.readToken(V.signToken('a@b.co', -1, 'login'), 'login') === null);
{ const P = await import('../lib/vipPage.js'); const v = V.normVip({ monthly: 149, page: { title: 'VIP <b>', perks: [{ t: 'ข้อสอบจับเวลา', vip: 'soon' }, { t: '' }], faq: [{ q: 'ถาม', a: '' }] } });
  const pv = P.vipPage(v, { preview: true }), live = P.vipPage(v, {});
  ok('VIP: ข้อความหน้าแก้ได้ (กรองช่องว่าง/HTML) · ตัวอย่างโชว์ราคาแม้ยังไม่เปิด แต่สมัครไม่ได้และไม่ให้ Google เก็บ', v.page.perks.length === 1 && v.page.faq.length === 0 && pv.includes('VIP &lt;b&gt;') && pv.includes('ข้อสอบจับเวลา') && pv.includes('data-plan="monthly"') && pv.includes('noindex') && pv.includes('vp-pv') && !live.includes('data-plan="monthly"') && !live.includes('noindex') && V.normVip({}).page.perks.length === 5); }
{ const M = await import('../lib/mock.js'); const mk = (slug, cat, n) => ({ slug, cat, title: slug, questions: Array.from({ length: n }, (_, i) => ({ q: 'q' + i, choices: ['a', 'b', 'c', 'd'], answer: i % 4, explain: '' })) });
  const bank = [mk('g1', 'grammar', 25), mk('g2', 'vocab', 10), mk('i1', 'ielts', 5), { slug: 't', cat: 'grammar', title: 't', questions: [{ type: 'type', q: 'x', answer: 'y' }] }];
  const kinds = M.mockKinds(bank), t = M.pickMock(bank, 'toeic'), keys = new Set(t.questions.map((x) => x.quiz + ':' + x.i));
  ok('ข้อสอบเสมือนจริง: ชุดที่คลังมีข้อไม่พอไม่ขึ้น · สุ่มไม่ซ้ำ ข้ามข้อแบบพิมพ์คำตอบ · ข้อน้อยกว่าที่ตั้ง = ลดข้อและเวลา', !kinds.some((k) => k.k === 'ielts') && t.n === 30 && t.questions.length === 30 && keys.size === 30 && t.questions.every((x) => x.choices.length === 4) && M.pickMock(bank, 'ielts') === null && kinds.find((k) => k.k === 'mini').n === 15); }
{ const W = await import('../lib/pwa.js'); const m = W.PWA_MANIFEST, has = (f) => fs.existsSync(path.join(process.cwd(), 'src', 'brand', f.replace(/^\//, '')));
  ok('แอปบนหน้าจอ: manifest ครบ (ชื่อ ไอคอน 192/512/maskable เปิดที่ /app เต็มจอ) · service worker ไม่ดักคำขอหน้าเว็บ', m.short_name && m.start_url.startsWith('/app') && m.display === 'standalone' && m.icons.every((i) => has(i.src)) && m.icons.some((i) => i.purpose === 'maskable') && !/fetch/.test(W.SW_JS.replace(/^\/\/.*$/m, '')));
  const V2 = await import('../lib/members.js'); ok('รหัสเข้าระบบ 6 หลัก: ตัวเลข 6 หลัก ไม่ขึ้นกับตัวพิมพ์ใหญ่เล็กของอีเมล เปลี่ยนตามช่วงเวลา', /^\d{6}$/.test(V2.loginCode('a@b.co')) && V2.loginCode('A@B.co') === V2.loginCode('a@b.co') && V2.loginCode('a@b.co', 1) !== V2.loginCode('a@b.co', 2)); }
{ const I = await import('../lib/insights.js'); ok('แถบขอคุกกี้: อยู่บนสุดของหน้าแบบไม่ลอยทับ (ไม่บังปุ่มซื้อเลยบนมือถือ)', /insertBefore\(b,document\.body\.firstChild\)/.test(I.TRACK_JS) && !/sl-consent[^<]*position:fixed/.test(I.TRACK_JS) && /position:relative/.test(I.TRACK_JS)); }
ok('VIP: ราคาเป็นจำนวนเต็มไม่ติดลบ ยังไม่เปิด = ขายไม่ได้', V.normVip({ monthly: '149.6', yearly: -5, packs: { 3: '399' } }).monthly === 150 && V.normVip({ yearly: -5 }).yearly === 0 && !V.vipSellable(V.normVip({ open: false, monthly: 149 })) && V.vipSellable(V.normVip({ open: true, packs: { 1: 99 } })));
const I = await import(path.join(root, 'lib/insights.js'));
const ce = I.cleanEvents({ sid: 'abc123xyz', src: 'google', dev: 'm', evs: [{ e: 'view', p: '/learn/a' }, { e: 'hack', p: '/x' }, { e: 'click', p: 'javascript:alert(1)', k: 'x' }, { e: 'read', p: '/learn/a', k: 100, v: 95 }] });
ok('พฤติกรรม: รับเฉพาะเหตุการณ์ที่รู้จักและ path ปกติ', ce.length === 2 && ce[1].v === 95 && ce.every((x) => x.sid === 'abc123xyz'));
const at = '2026-10-03T01:00:00Z', R = (sid, ev, path, k = '', v = null, src = 'google') => ({ at, sid, ev, path, k, v, src, dev: 'm' });
const sm = I.summarize([R('s1', 'view', '/'), R('s1', 'view', '/p/a'), R('s1', 'click', '/p/a', 'cartAdd'), R('s1', 'click', '/p/a', 'qrOpen'), R('s1', 'read', '/p/a', 75, 40),
  R('s2', 'view', '/learn/x'), R('s2', 'read', '/learn/x', 100, 200), R('s2', 'quiz', '/quiz/q', 'q:0', 0), R('s2', 'quizdone', '/quiz/q', 'q', 50)], [{ campaign: 'fb' }]);
ok('พฤติกรรม: สรุปคนเข้า ดูหน้าเดียว ขั้นการซื้อ อ่านนาน ออกจากเว็บ', sm.totals.sessions === 2 && sm.totals.bounce === 50 && sm.funnel.add === 1 && sm.funnel.pay === 1 && sm.funnel.paid === 1 && sm.articles[0].avg === 200 && sm.articles[0].pct100 === 100 && sm.pages.find((x) => x.p === '/p/a').exits === 1);
{ const C = await import('../lib/courses.js'); const c = C.cleanCourse({ title: 'x', emails: 'Owner@Gmail.com, bad-email\nhelper@site.co owner@gmail.com', lessons: [] });
  ok('คอร์ส: อีเมลเรียนฟรี เก็บเป็นตัวเล็ก ไม่ซ้ำ ตัดอีเมลผิดรูปแบบ', JSON.stringify(c.emails) === JSON.stringify(['owner@gmail.com', 'helper@site.co'])); }
{ const F = await import('../lib/fulfill.js'); const sh = { products: [{ id: 'c1', name: 'คอร์ส', kind: 'course', bonusIds: ['b1', 'b2', 'set1', 'c2'] }, { id: 'b1', name: 'ชีท Grammar' }, { id: 'b2', name: 'ชีทไม่มีลิงก์' }, { id: 'set1', type: 'bundle', name: 'ชุด', items: [] }, { id: 'c2', name: 'คอร์สอื่น', kind: 'course' }, { id: 'p1', name: 'เล่ม', bonusIds: ['b1'] }] };
  const links = { c1: 'https://x/c1', b1: 'https://x/b1', p1: 'https://x/p1' };
  const one = await F.orderItems({ metadata: { productId: 'c1' } }, sh, links), cart = await F.orderItems({ metadata: { cart: 'c1,p1' } }, sh, links);
  ok('ของแถม: ซื้อแล้วได้ไฟล์ของแถมที่เลือก (ไม่รวมชุด/คอร์ส ไม่ซ้ำในตะกร้า)', one.map((i) => i.productId).join() === 'c1,b1,b2' && one[1].bonus && /ของแถม/.test(one[1].name) && cart.filter((i) => i.productId === 'b1').length === 1, JSON.stringify(one.map((i) => i.productId)) + ' ' + JSON.stringify(cart.map((i) => i.productId))); }
{ const R = await import('../lib/recover.js'); const exp = '2026-10-11T03:00:00Z', m = R.buildRecoveryEmail({ shop: 'SheetLab', product: 'IELTS ครบชุด 13 เล่ม', amount: 990, url: 'https://sheetlabth.com/p/ielts?code=BACK12345#checkout', settings: {}, code: 'BACK12345', pct: 20, expires: exp, course: false });
  ok('ตามลูกค้าที่ยังไม่จ่าย: อีเมลมีโค้ด ลด 20% ราคาหลังลด (฿792) เวลาหมดอายุไทย ลิงก์ใส่โค้ดให้ · ค่าตั้งต้น 20% / 24 ชม.', /BACK12345/.test(m.html) && /฿792/.test(m.html) && /code=BACK12345/.test(m.html) && /ลด 20%/.test(m.subject) && /10:00/.test(m.text) && R.RECOVER_DEFAULT.pct === 20 && R.RECOVER_DEFAULT.hours === 24, m.subject); }
{ const SP = await import('../lib/salepost.js'); const txt = 'หนังสือ TOEIC Grammar เล่มนี้สรุปให้ครบใน 15 จุดที่ออกสอบบ่อยที่สุด พร้อมแบบฝึกหัด 500 ข้อ ดูรายละเอียดที่ลิงก์ในโพสต์';
  const k = SP.saleKit({ kind: 'sale', text: txt }, shop.products, 'https://sheetlabth.com'), k2 = SP.saleKit({ kind: 'tip', text: txt }, shop.products, ''), k3 = SP.saleKit({ kind: 'tip', text: 'x', link_url: 'https://sheetlabth.com/p/sheet-f4b6d891' }, shop.products, '');
  const again = k && SP.saleKit({ kind: 'sale', text: k.text }, shop.products, 'https://sheetlabth.com');
  ok('โพสต์ขาย: หาสินค้าจากข้อความ/ลิงก์ → ปกจริง + ตัวอย่าง 3 หน้า + ลิงก์ /p/slug (ไม่เติมซ้ำ) · โพสต์ความรู้ไม่แตะ', !!k && k.product.slug === 'toeic' && k.gallery.length === 4 && /👉 ดูตัวอย่างและสั่งซื้อ: https:\/\/sheetlabth\.com\/p\/toeic$/.test(k.text) && !k2 && k3 && k3.product.slug === 'sheet-f4b6d891' && again.text === k.text, k ? k.product.slug + ' ' + k.gallery.length : 'none'); }
console.log(bad ? `✗ unit ไม่ผ่าน ${bad}` : '✓ unit ผ่านทั้งหมด'); process.exit(bad ? 1 : 0);
