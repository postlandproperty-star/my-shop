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
ok('VIP: ราคาเป็นจำนวนเต็มไม่ติดลบ ยังไม่เปิด = ขายไม่ได้', V.normVip({ monthly: '149.6', yearly: -5, packs: { 3: '399' } }).monthly === 150 && V.normVip({ yearly: -5 }).yearly === 0 && !V.vipSellable(V.normVip({ open: false, monthly: 149 })) && V.vipSellable(V.normVip({ open: true, packs: { 1: 99 } })));
console.log(bad ? `✗ unit ไม่ผ่าน ${bad}` : '✓ unit ผ่านทั้งหมด'); process.exit(bad ? 1 : 0);
