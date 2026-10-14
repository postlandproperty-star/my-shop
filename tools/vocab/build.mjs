// สร้างคลัง "คำศัพท์ 3000 คำที่ต้องรู้" (หน้า /vocab) → src/vocab/<level>.json
// คำ ความหมาย และประโยคตัวอย่างแต่งใหม่ด้วย AI (Gemini ผ่าน fal) ไม่คัดลอกรายการหรือนิยามของพจนานุกรมใด
// ใช้: node tools/vocab/build.mjs plan a1 36   → วางแผนบท (หัวข้อ + คำ)
//      node tools/vocab/build.mjs more b2 34   → เพิ่มบทต่อจากที่มี (ไม่ซ้ำคำทุกระดับ)
//      node tools/vocab/build.mjs fill a1       → เขียนความหมาย/ตัวอย่างให้ทุกบทที่ยังไม่ครบ (รันซ้ำได้)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
const KEY = readFileSync(`${homedir()}/.config/sheetlab/fal-key`, 'utf8').trim();
const LV = ['a1', 'a2', 'b1', 'b2'], DESC = { a1: 'CEFR A1 (very first everyday words)', a2: 'CEFR A2 (elementary everyday words)', b1: 'CEFR B1 (intermediate, work/study/news)', b2: 'CEFR B2 (upper-intermediate, abstract and academic)' };
const file = (lv) => new URL(`../../src/vocab/${lv}.json`, import.meta.url);
const load = (lv) => (existsSync(file(lv)) ? JSON.parse(readFileSync(file(lv), 'utf8')) : null);
const save = (lv, d) => writeFileSync(file(lv), JSON.stringify(d));

async function ai(prompt, model = 'google/gemini-2.5-flash') {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://fal.run/openrouter/router/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }) });
      const j = await r.json(); const t = j?.choices?.[0]?.message?.content || '';
      return JSON.parse(t.trim().replace(/^```(json)?|```$/g, ''));
    } catch (e) { console.error('retry', i, e.message); await new Promise((r) => setTimeout(r, 3000)); }
  }
  throw new Error('AI failed');
}
const clean = (w) => String(w || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function plan(lv, n, keep = false) { // keep = ต่อจากบทที่มีอยู่ (เพิ่มบท)
  const prev = LV.filter((l) => l !== lv).flatMap((l) => (load(l)?.units || []).flatMap((u) => u.words.map((x) => x.w)));
  const units = keep ? load(lv)?.units || [] : [], seen = new Set([...prev, ...units.flatMap((u) => u.words.map((x) => x.w))].map(clean));
  // ขอทีละ 8 บท (ขอทีเดียวทั้งระดับ คำตอบยาวจนถูกตัดกลางทาง)
  for (let tries = 0; units.length < n && tries < 10; tries++) {
    const k = Math.min(8, n - units.length);
    const p = await ai(`You are building an original English vocabulary course for Thai learners. Level: ${DESC[lv]}.
Make exactly ${k} units grouped by practical topics (everyday life, people, home, food, travel, work, school, health, feelings, time, nature, shopping, money, technology, society, etc.; at higher levels include abstract/academic topics and useful verbs/adjectives/adverbs).
${units.length ? `Topics already made (choose different ones): ${units.map((u) => u.t).join(', ')}.` : ''}
Each unit has exactly 22 DIFFERENT single words (a few common 2-word compounds are fine, e.g. "post office"), all suitable for ${DESC[lv]}.
Mix nouns, verbs, adjectives and adverbs where natural. No proper nouns, no duplicates anywhere in your answer.
Do NOT use any of these words (already taught): ${[...seen].join(', ')}
Return JSON: {"units":[{"t":"short English topic","th":"short Thai topic name","words":["word", ...22]}]}`, 'google/gemini-2.5-pro').catch(() => ({ units: [] }));
    for (const u of p.units || []) {
      const words = []; for (const w of u.words || []) { const c = clean(w); if (c && !seen.has(c) && /^[a-z][a-z' -]*$/.test(c)) { seen.add(c); words.push({ w: c }); } }
      if (words.length >= 12 && units.length < n) units.push({ id: units.length + 1, t: String(u.t).slice(0, 60), th: String(u.th).slice(0, 40), words });
    }
    save(lv, { level: lv, units }); console.log(lv, units.length, 'units', units.reduce((a, u) => a + u.words.length, 0), 'words');
  }
}

const stem = (w) => w.split(' ').map((x) => x.slice(0, Math.max(4, Math.min(x.length, 5))));
const badDef = (x) => !x.def || stem(x.w).some((s) => s.length >= 3 && x.def.toLowerCase().includes(s));
async function fillUnit(lv, u) {
  const need = u.words.filter((x) => !x.th || badDef(x) || !x.ex);
  if (!need.length) return 0;
  const r = await ai(`Write learner dictionary entries for Thai learners of English (${DESC[lv]}), topic "${u.t}".
For each word give:
- "pos": part of speech in English (noun, verb, adjective, adverb, preposition, pronoun, phrase...)
- "th": the most common Thai meaning, 1-4 words, natural Thai
- "def": a very simple English definition (6-14 words) that lets a learner GUESS the word. It must NOT contain the word itself or any form of it (no same root).
- "ex": one short natural example sentence (6-12 words) using the word, level-appropriate
- "exth": natural Thai translation of the example
Write everything originally in your own words. Words: ${need.map((x) => x.w).join(', ')}
Return JSON: {"items":[{"w":"word","pos":"","th":"","def":"","ex":"","exth":""}]}`);
  const by = Object.fromEntries((r.items || []).map((x) => [clean(x.w), x]));
  let ok = 0;
  for (const x of need) {
    const g = by[x.w]; if (!g) continue;
    const y = { w: x.w, pos: String(g.pos || '').slice(0, 20), th: String(g.th || '').slice(0, 60), def: String(g.def || '').slice(0, 140), ex: String(g.ex || '').slice(0, 160), exth: String(g.exth || '').slice(0, 200) };
    if (!badDef(y) && y.th && y.ex.toLowerCase().includes(x.w.split(' ')[0].slice(0, 3))) { Object.assign(x, y); ok++; }
  }
  return need.length - ok;
}
async function fill(lv) {
  const d = load(lv); let left = 0;
  for (let round = 0; round < 3; round++) {
    left = 0; const q = [...d.units];
    await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) { const u = q.shift(); left += await fillUnit(lv, u).catch((e) => (console.error(u.id, e.message), u.words.length)); save(lv, d); } }));
    console.log(lv, 'round', round, 'missing', left); if (!left) break;
  }
  // คำที่ยังเขียนนิยามไม่ผ่านหลังลอง 3 รอบ: ตัดออก
  for (const u of d.units) u.words = u.words.filter((x) => x.th && x.def && x.ex && !badDef(x));
  save(lv, d); console.log(lv, 'done', d.units.reduce((a, u) => a + u.words.length, 0), 'words');
}
const [cmd, lv, n] = process.argv.slice(2);
if (!LV.includes(lv)) throw new Error('level a1|a2|b1|b2');
if (cmd === 'plan') await plan(lv, Number(n) || 36); else if (cmd === 'more') await plan(lv, Number(n), true); else if (cmd === 'fill') await fill(lv);
