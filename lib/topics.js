// หน้ารวมตามหัวข้อ /topic/<slug> (SEO): คำอธิบายสั้นที่ไม่เปลี่ยนตามเวลา + บทความ + แบบทดสอบฟรี + ชีทของร้านในหัวข้อเดียวกัน + คำถามที่พบบ่อย
// หัวข้อที่มีของน้อยกว่า MIN_ITEMS ยังไม่ให้ Google เก็บ (noindex และไม่อยู่ใน sitemap) กันหน้าบาง
import { shell, artCoverHtml, LEARN_CATS, QUIZ_CATS } from './quiz.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const MIN_ITEMS = 3;
const T = (x) => String(x || '').toLowerCase();
const isToeicCat = (c) => ['grammar', 'vocab', 'tips', 'listening', 'reading', 'mock'].includes(c);

export const TOPICS = [
  { slug: 'toeic', name: 'TOEIC', title: 'TOEIC ครบทุกเรื่อง ข้อสอบฟรี คำศัพท์ แกรมมาร์ เทคนิคทำข้อสอบ',
    desc: 'รวมทุกอย่างสำหรับเตรียมสอบ TOEIC ภาษาไทย แบบทดสอบฟรีพร้อมเฉลย สรุปแกรมมาร์ คำศัพท์ออกบ่อย และเทคนิค Reading Listening',
    intro: ['TOEIC เป็นข้อสอบภาษาอังกฤษในบริบทการทำงาน ที่บริษัทและหน่วยงานในไทยนิยมใช้ประกอบการสมัครงานและเลื่อนตำแหน่ง คะแนนเต็ม 990 แบ่งเป็นพาร์ต Listening และ Reading',
      'หน้านี้รวมบทความสรุปความรู้ แบบทดสอบฟรีพร้อมเฉลยภาษาไทย และชีทของ SheetLab ไว้ในที่เดียว แนะนำให้เริ่มจากแบบวัดระดับ แล้วเลือกฝึกเรื่องที่ยังพลาดบ่อย'],
    match: (x) => /toeic/.test(T(x.title || x.name)) || (isToeicCat(x.cat) && !/ielts|tgat|ก\.พ/.test(T(x.title || x.name))),
    faq: [['ควรเริ่มเตรียมสอบ TOEIC จากตรงไหน', 'เริ่มจากทำแบบวัดระดับเพื่อรู้จุดอ่อน แล้วฝึกคำศัพท์ที่ใช้ในที่ทำงานกับแกรมมาร์ที่ออกบ่อยควบคู่กัน และทำโจทย์จับเวลาเป็นประจำ'],
      ['ฝึก TOEIC วันละเท่าไหร่ดี', 'ฝึกสม่ำเสมอวันละ 30–60 นาทีได้ผลกว่าอ่านรวดเดียวนานๆ แบ่งเวลาให้ทั้งคำศัพท์ แกรมมาร์ และโจทย์ Reading/Listening'],
      ['แบบทดสอบในหน้านี้เป็นข้อสอบจริงไหม', 'ไม่ใช่ข้อสอบจริง เป็นโจทย์ที่ทีม SheetLab เขียนขึ้นใหม่ตามแนวข้อสอบ เพื่อฝึกและเช็คความเข้าใจ']] },
  { slug: 'toeic-grammar', name: 'TOEIC Grammar', title: 'Grammar TOEIC สรุปแกรมมาร์ออกบ่อย พร้อมแบบทดสอบฟรี',
    desc: 'สรุปแกรมมาร์ TOEIC ที่ออกบ่อย Tense Word form Preposition Conjunction พร้อมแบบทดสอบฟรีและเฉลยภาษาไทย',
    intro: ['โจทย์แกรมมาร์ใน TOEIC เน้นการเลือกคำให้ถูกตามโครงสร้างประโยค เช่น รูปคำ (Noun/Verb/Adjective/Adverb) Tense Preposition และคำเชื่อม ทั้งหมดอยู่ในบริบทของการทำงาน',
      'หน้านี้รวมบทความสรุปกฎแบบเข้าใจง่าย แบบทดสอบพร้อมเฉลย และชีทฝึกเพิ่ม เหมาะกับคนที่อยากเก็บคะแนนส่วน Reading ให้ได้มากขึ้น'],
    match: (x) => x.cat === 'grammar' || /grammar|แกรมมาร์|tense|preposition|conjunction|word form/.test(T(x.title || x.name)),
    faq: [['แกรมมาร์ TOEIC เรื่องไหนออกบ่อย', 'เรื่องที่เจอบ่อยคือรูปคำ (Word form) Tense Preposition คำเชื่อม และ Subject-Verb Agreement'],
      ['ทำโจทย์แกรมมาร์ให้เร็วขึ้นยังไง', 'ดูคำรอบช่องว่างก่อนอ่านทั้งประโยค เช่น ถ้าหน้าช่องเป็น the และหลังช่องเป็นคำนาม คำตอบมักเป็น Adjective'],
      ['ต้องท่องกฎแกรมมาร์ทั้งหมดไหม', 'ไม่จำเป็น เน้นเรื่องที่ออกบ่อยและฝึกโจทย์จนจำรูปแบบได้ จะได้ผลเร็วกว่า']] },
  { slug: 'toeic-vocabulary', name: 'คำศัพท์ TOEIC', title: 'คำศัพท์ TOEIC ออกสอบบ่อย ศัพท์ธุรกิจ พร้อมแบบทดสอบ',
    desc: 'คำศัพท์ TOEIC ที่ออกบ่อยในบริบทการทำงาน ประชุม การเงิน HR การตลาด พร้อมตัวอย่างประโยค แบบทดสอบ และชีทศัพท์',
    intro: ['คำศัพท์ใน TOEIC มาจากสถานการณ์ในที่ทำงาน เช่น ประชุม การสั่งซื้อ การเงิน งานบุคคล และการเดินทางเพื่อธุรกิจ การรู้ศัพท์กลุ่มนี้ช่วยได้ทั้งพาร์ต Listening และ Reading',
      'วิธีจำที่ได้ผลคือจำเป็นกลุ่มตามหัวข้อพร้อมตัวอย่างประโยค แล้วทวนซ้ำเป็นรอบ หน้านี้รวมบทความ แบบทดสอบ และชีทศัพท์ที่จัดหมวดไว้แล้ว'],
    match: (x) => x.cat === 'vocab' || /vocab|ศัพท์/.test(T(x.title || x.name)),
    faq: [['ควรจำศัพท์ TOEIC กี่คำ', 'ไม่มีตัวเลขตายตัว เริ่มจากศัพท์ที่ใช้ในที่ทำงานที่เจอบ่อยหลักร้อยคำ แล้วค่อยขยายตามหัวข้อที่ยังไม่แม่น'],
      ['จำศัพท์ให้ไม่ลืมทำยังไง', 'จำพร้อมตัวอย่างประโยค จัดเป็นกลุ่มหัวข้อ และทวนซ้ำเป็นรอบ เช่น วันถัดไป 3 วัน และ 1 สัปดาห์'],
      ['ศัพท์ธุรกิจกับศัพท์ TOEIC ต่างกันไหม', 'ทับซ้อนกันมาก เพราะ TOEIC ใช้บริบทการทำงานเป็นหลัก']] },
  { slug: 'toeic-reading', name: 'TOEIC Reading', title: 'TOEIC Reading เทคนิคอ่านเร็ว Part 5–7 พร้อมแบบฝึก',
    desc: 'เทคนิคทำ TOEIC Reading Part 5 6 7 ให้ทันเวลา อ่านอีเมล ประกาศ บทความ พร้อมแบบทดสอบและชีทฝึก',
    intro: ['ส่วน Reading ต้องทั้งรู้แกรมมาร์และอ่านจับใจความให้เร็ว โดยเฉพาะบทอ่านยาวอย่างอีเมล ประกาศ และบทความ', 'หน้านี้รวมเทคนิคการอ่าน การบริหารเวลา และโจทย์ฝึก ช่วยให้ทำทันและเดาน้อยลง'],
    match: (x) => x.cat === 'reading' || /reading|part 7|part 5|อ่าน/.test(T(x.title || x.name)) && /toeic/.test(T(x.title || x.name)),
    faq: [['ทำ Reading ไม่ทันควรทำยังไง', 'อ่านคำถามก่อนแล้วค่อยหาคำตอบในบทอ่าน ไม่ติดข้อยากนานเกินไป และฝึกจับเวลาเป็นประจำ'],
      ['ควรทำ Part ไหนก่อน', 'หลายคนเริ่ม Part 5 ที่ทำได้เร็วเพื่อเก็บเวลาไว้ให้บทอ่านยาว เลือกลำดับที่ตัวเองทำได้ดีที่สุดจากการฝึก']] },
  { slug: 'toeic-listening', name: 'TOEIC Listening', title: 'TOEIC Listening เทคนิคฟังจับใจความ พร้อมแบบฝึก',
    desc: 'เทคนิคฟัง TOEIC Listening Part 1–4 จับคำสำคัญ paraphrase และกับดักที่พบบ่อย พร้อมแบบฝึกและชีท',
    intro: ['ส่วน Listening ทดสอบการฟังบทสนทนาและประกาศในที่ทำงาน จุดที่คนพลาดบ่อยคือคำที่ถูกพูดใหม่ด้วยคำอื่น (paraphrase) และตัวเลือกที่มีคำซ้ำกับที่ได้ยิน', 'หน้านี้รวมเทคนิคและแบบฝึกให้ฟังได้แม่นขึ้น'],
    match: (x) => x.cat === 'listening' || /listening|shadowing|ฟัง/.test(T(x.title || x.name)),
    faq: [['ฝึกฟังภาษาอังกฤษให้เก่งขึ้นยังไง', 'ฟังทุกวันแบบมีสคริปต์ ฟังซ้ำ จดคำที่ฟังไม่ออก แล้วพูดตาม (shadowing) จะช่วยให้ฟังเร็วขึ้น'],
      ['ตัวเลือกที่มีคำเหมือนในเสียงเป็นคำตอบไหม', 'ไม่เสมอไป มักเป็นกับดัก ให้ฟังความหมายรวมมากกว่าคำที่ซ้ำกัน']] },
  { slug: 'ielts', name: 'IELTS', title: 'IELTS เตรียมสอบ Writing Speaking Reading Listening ภาษาไทย',
    desc: 'รวมบทความ แบบทดสอบ และชีทเตรียมสอบ IELTS ภาษาไทย โครงเรียงความ คำเชื่อม Speaking และคำศัพท์',
    intro: ['IELTS ใช้สำหรับเรียนต่อ ทำงาน และย้ายถิ่นฐาน ประเมินครบ 4 ทักษะ หน้านี้รวมความรู้และแบบฝึกที่อธิบายเป็นภาษาไทย', 'เหมาะกับคนที่อยากเข้าใจโครงสร้างการเขียนและการพูดให้เป็นระบบ'],
    match: (x) => x.cat === 'ielts' || /ielts/.test(T(x.title || x.name)),
    faq: [['เริ่มเตรียม IELTS จากทักษะไหน', 'เริ่มจากทักษะที่อ่อนที่สุด แต่ควรฝึก Writing และ Speaking สม่ำเสมอเพราะต้องใช้เวลาพัฒนา'],
      ['คำเชื่อมช่วยคะแนน Writing ไหม', 'ช่วยเรื่องความต่อเนื่องของเนื้อหา แต่ต้องใช้ให้ถูกความหมาย ไม่ใส่เยอะเกินจำเป็น']] },
  { slug: 'tgat', name: 'TGAT / A-Level', title: 'TGAT ภาษาอังกฤษ แนวข้อสอบ บทสนทนา เติมประโยค พร้อมเฉลย',
    desc: 'เตรียมสอบ TGAT และ A-Level ภาษาอังกฤษ แนวเติมประโยค บทสนทนา และการอ่าน พร้อมแบบทดสอบฟรีและเฉลยภาษาไทย',
    intro: ['ข้อสอบภาษาอังกฤษสำหรับเข้ามหาวิทยาลัยเน้นการสื่อสาร บทสนทนา และการอ่านจับใจความ หน้านี้รวมแบบฝึกและบทความที่อธิบายเป็นภาษาไทย'],
    match: (x) => x.cat === 'tgat' || /tgat|a-level|มหาลัย/.test(T(x.title || x.name)),
    faq: [['ฝึก TGAT ภาษาอังกฤษยังไงให้ได้ผล', 'ฝึกบทสนทนาและสำนวนที่ใช้บ่อย ทำโจทย์เติมประโยค และอ่านบทความสั้นจับใจความเป็นประจำ']] },
  { slug: 'kp', name: 'ก.พ. ภาษาอังกฤษ', title: 'ภาษาอังกฤษ ก.พ. แนวข้อสอบ Grammar คำศัพท์ บทสนทนา',
    desc: 'เตรียมสอบภาษาอังกฤษ ก.พ. แนว Grammar คำศัพท์ บทสนทนา และการอ่าน พร้อมแบบทดสอบฟรีและเฉลยภาษาไทย',
    intro: ['วิชาภาษาอังกฤษในการสอบ ก.พ. มีทั้งไวยากรณ์ คำศัพท์ บทสนทนา และการอ่าน หน้านี้รวมแบบฝึกและสรุปความรู้เป็นภาษาไทยสำหรับคนเตรียมสอบราชการ'],
    match: (x) => x.cat === 'kp' || /ก\.พ|ราชการ/.test(T(x.title || x.name)),
    faq: [['ภาษาอังกฤษ ก.พ. ควรเริ่มอ่านตรงไหน', 'เริ่มจากไวยากรณ์พื้นฐานที่ออกบ่อยและคำศัพท์ใกล้ตัว แล้วฝึกโจทย์บทสนทนาและการอ่านควบคู่']] },
  { slug: 'english-work', name: 'ภาษาอังกฤษทำงาน', title: 'ภาษาอังกฤษในที่ทำงาน อีเมล ประชุม สัมภาษณ์งาน',
    desc: 'ภาษาอังกฤษใช้งานจริงในที่ทำงาน เขียนอีเมล ประโยคประชุม สัมภาษณ์งาน และสนทนา พร้อมแบบฝึกภาษาไทย',
    intro: ['รวมประโยคและเทคนิคที่ใช้จริงในงาน เช่น เขียนอีเมลให้สุภาพ พูดในที่ประชุม และตอบคำถามสัมภาษณ์งาน อธิบายเป็นภาษาไทยพร้อมตัวอย่าง'],
    match: (x) => ['work', 'speak'].includes(x.cat) || /business email|interview|สัมภาษณ์|อีเมล|ประชุม|ทำงาน/.test(T(x.title || x.name)) && !/toeic/.test(T(x.title || x.name)),
    faq: [['เขียนอีเมลภาษาอังกฤษให้สุภาพยังไง', 'ขึ้นต้นด้วยคำทักทาย บอกจุดประสงค์ในประโยคแรก ใช้ประโยคขอร้องแบบสุภาพ เช่น Could you … และปิดท้ายด้วยคำขอบคุณ']] },
];

// ของในหัวข้อ: บทความ แบบทดสอบ สินค้า (ขายบนหน้าร้าน)
export function topicItems(t, { articles = [], quizzes = [], products = [] }) {
  const pr = products.filter((p) => p.status === 'published' && p.sell !== 'salepage' && /^[a-z0-9-]+$/.test(p.slug || '') && t.match({ name: p.name + ' ' + (p.headline || ''), cat: p.cat }));
  return { articles: articles.filter((a) => t.match(a)), quizzes: quizzes.filter((q) => t.match(q)), products: pr };
}
export const topicCount = (it) => it.articles.length + it.quizzes.length + it.products.length;
export const topicReady = (it) => topicCount(it) >= MIN_ITEMS && it.articles.length + it.quizzes.length >= 1; // ต้องมีเนื้อหาอย่างน้อย 1 ชิ้น ไม่ใช่แค่สินค้า

export function topicPage(t, it, { settings = {}, site = '', all = [] } = {}) {
  const url = `${site}/topic/${t.slug}`, ok = topicReady(it);
  const level = it.quizzes.find((q) => q.mode === 'level');
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: t.title, description: t.desc, url, inLanguage: 'th' },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'SheetLab', item: site }, { '@type': 'ListItem', position: 2, name: t.name, item: url }] },
    ...(t.faq?.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : [])];
  const others = all.filter((x) => x.slug !== t.slug);
  const body = `<header class="card"><span class="chip">หัวข้อ</span><h1 style="margin-top:6px">${esc(t.title)}</h1>${t.intro.map((p) => `<p>${esc(p)}</p>`).join('')}</header>
${level ? `<a class="card item" href="/quiz/${esc(level.slug)}" style="border:2px solid var(--brand)"><span class="chip">เริ่มที่นี่</span><b>${esc(level.title)}</b><span class="fine">รู้ระดับตัวเองก่อน แล้วค่อยเลือกฝึกเรื่องที่ยังพลาด →</span></a>` : ''}
${it.articles.length ? `<section class="card"><h2>บทความสรุป (${it.articles.length})</h2><div class="list agrid" style="margin-top:8px">${it.articles.map((a) => `<a class="item more" href="/learn/${esc(a.slug)}">${artCoverHtml(a)}<span><b>${esc(a.title)}</b><br><span class="fine">${esc(a.desc)}</span></span></a>`).join('')}</div></section>` : ''}
${it.quizzes.filter((q) => q !== level).length ? `<section class="card"><h2>แบบทดสอบฟรี พร้อมเฉลย</h2><div class="list" style="margin-top:8px">${it.quizzes.filter((q) => q !== level).map((q) => `<a class="item more" href="/quiz/${esc(q.slug)}"><span><span class="chip">${esc(QUIZ_CATS[q.cat] || 'TOEIC')} · ${(q.questions || []).length} ข้อ</span><br><b>${esc(q.title)}</b><br><span class="fine">${esc(q.desc || '')}</span></span></a>`).join('')}</div></section>` : ''}
${it.products.length ? `<section class="card"><h2>ชีทของ SheetLab ในหัวข้อนี้</h2><div class="list" style="margin-top:8px">${it.products.slice(0, 8).map((p) => `<a class="item more" href="/p/${esc(p.slug)}?utm_source=seo&utm_campaign=topic-${esc(t.slug)}">${(p.images || [])[0] ? `<span class="acov"><img src="${esc(p.images[0])}" alt="" loading="lazy"></span>` : ''}<span><b>${esc(p.name)}</b><br><span class="fine">${Number(p.price) >= 1 ? `฿${Number(p.price).toLocaleString('th-TH')} · ` : ''}ดูตัวอย่างก่อนซื้อ</span></span></a>`).join('')}</div></section>` : ''}
${t.faq?.length ? `<section class="card"><h2>คำถามที่พบบ่อย</h2>${t.faq.map(([q, a]) => `<details><summary><b>${esc(q)}</b></summary><p>${esc(a)}</p></details>`).join('')}</section>` : ''}
${others.length ? `<section class="card"><h2>หัวข้ออื่น</h2><p>${others.map((o) => `<a href="/topic/${esc(o.slug)}">${esc(o.name)}</a>`).join(' · ')}</p></section>` : ''}`;
  return shell({ title: `${t.title} · SheetLab`, desc: t.desc, canonical: url, body, ld, pixelId: settings.pixelId, noindex: !ok, tab: 'learn' });
}
