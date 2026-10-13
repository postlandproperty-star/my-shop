// สร้าง lib/govContent.js จากไฟล์ JSON ในโฟลเดอร์นี้ (บทความ + ข้อสอบของโซนสอบราชการ /gov เท่านั้น ไม่ผ่านหลังบ้านกลาง)
// ใช้: node tools/content/gov-seo/build.mjs   · ตรวจทุกไฟล์ด้วย cleanArticle/cleanQuiz ก่อน ผิดไฟล์เดียว = ไม่เขียนทับ
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(DIR, '..', '..', '..');
const { cleanArticle, cleanQuiz } = await import(path.join(ROOT, 'lib', 'quiz.js'));
const subjOf = (x) => (['eng', 'think', 'law'].includes(x.subject) ? x.subject : 'eng');
// ลิงก์ในบทความให้อยู่ในโซน /gov (บทความ/ข้อสอบพี่น้องอยู่ที่ /gov/learn และ /gov/quiz)
const local = (body) => body.replace(/\]\(\/learn\/(kp-[a-z0-9-]+)\)/g, '](/gov/learn/$1)').replace(/\]\(\/quiz\)/g, '](/gov)').replace(/\]\(\/quiz\/(kp-[a-z0-9-]+)\)/g, '](/gov/quiz/$1)');
const files = [...fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(DIR, f)), path.join(DIR, '..', 'kp-english-10.json')];
const articles = [], quizzes = [], errs = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (Array.isArray(j.questions)) { const r = cleanQuiz({ ...j, cat: 'kp' }); if (r.error) { errs.push(`${path.basename(f)}: ${r.error}`); continue; } quizzes.push({ ...r.quiz, subject: subjOf(j), article_slug: String(j.article_slug || '') }); }
  else { const r = cleanArticle({ ...j, cat: 'kp', body: local(String(j.body || '')) }); if (r.error) { errs.push(`${path.basename(f)}: ${r.error}`); continue; } articles.push({ slug: r.article.slug, title: r.article.title, desc: r.article.desc, body: r.article.body, quiz_slug: r.article.quiz_slug, subject: subjOf(j) }); }
}
const slugs = new Set(), dup = [...articles, ...quizzes].map((x) => x.slug).filter((s) => slugs.has(s) || !slugs.add(s));
if (dup.length) errs.push('slug ซ้ำ: ' + dup.join(', '));
const known = new Set([...articles.map((a) => '/gov/learn/' + a.slug), ...quizzes.map((q) => '/gov/quiz/' + q.slug), '/gov', '/gov/kp-phak-kor', '/gov/local-gov', '/gov/kru-phu-chuay', '/topic/kp']);
for (const a of articles) for (const m of a.body.matchAll(/\]\((\/[^)]*)\)/g)) if (!known.has(m[1])) errs.push(`${a.slug}: ลิงก์ ${m[1]} ไม่มีในโซน`);
if (errs.length) { console.error('ไม่เขียนไฟล์:\n' + errs.join('\n')); process.exit(1); }
const order = { eng: 0, think: 1, law: 2 }; const by = (a, b) => order[a.subject] - order[b.subject] || a.slug.localeCompare(b.slug);
fs.writeFileSync(path.join(ROOT, 'lib', 'govContent.js'), `// สร้างอัตโนมัติจาก tools/content/gov-seo/*.json ด้วย build.mjs ห้ามแก้มือ\nexport const GOV_ARTICLES = ${JSON.stringify(articles.sort(by), null, 1)};\nexport const GOV_QUIZZES = ${JSON.stringify(quizzes.sort(by), null, 1)};\n`);
console.log(`OK บทความ ${articles.length} · ข้อสอบ ${quizzes.length}`);
