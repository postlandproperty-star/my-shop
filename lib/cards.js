// 🖼 การ์ดความรู้ลงเพจ (คุณแดน 11 ต.ค. 69 "ทำ content ลักษณะนี้โพสลง page ลงบ่อยๆ" ตัวอย่าง British Council / EduWorld)
// 2 แบบ: passage = เรื่องสั้นไฮไลต์คำ + กล่อง Top Tips อธิบายไทย · list = 5 คำ/วลี + ความหมาย + ประโยคตัวอย่าง + ภาพประกอบ
// เนื้อหาแต่งใหม่ด้วย AI (content.js action=card) · Mac วาดรูป (tools/content/card.mjs) รูปถ่ายฟรี CC0 จาก Openverse + อีโมจิ Noto · เข้าคิวโพสต์เป็นฉบับร่างให้พี่ต้นตรวจ
export const SERIES = [
  { k: 'linking', t: 'passage', brief: 'linking words (and, but, because, so, however, although, then...) in a short everyday story' },
  { k: 'phrasal', t: 'list', brief: '5 common phrasal verbs with one base verb (make, take, get, put, look, give, come, go, turn, break, bring, run)' },
  { k: 'tense', t: 'passage', brief: 'one verb tense in context (present perfect, past continuous, future plans, present simple habits) highlighted in a short story' },
  { k: 'confusing', t: 'list', brief: '5 commonly confused words Thai learners mix up (say/tell/speak/talk, borrow/lend, bring/take, fun/funny, etc.)' },
  { k: 'collocation', t: 'passage', brief: 'natural collocations (make a decision, take a break, do homework...) highlighted in a short story' },
  { k: 'idiom', t: 'list', brief: '5 everyday English idioms useful for IELTS Speaking (piece of cake, hit the books...) with natural examples' },
  { k: 'ielts', t: 'passage', brief: 'useful IELTS Writing Task 2 phrases (On the one hand, It is widely believed that, As a result...) highlighted in a short model paragraph' },
  { k: 'business', t: 'list', brief: '5 useful TOEIC/business email phrases (I am writing to..., Please find attached...) with when to use them' },
  { k: 'preposition', t: 'passage', brief: 'prepositions of time and place (in/on/at, by, until, during) highlighted in a short story' },
  { k: 'mistake', t: 'list', brief: '5 English mistakes Thai people often make (I very like, He don\'t, discuss about...) shown as the CORRECT form with a short why' },
];
// คำ/วลีในประโยคตัวอย่าง (ยอมรูปกริยาเปลี่ยน: take → takes/taking/taken) · อีโมจิเดี่ยว (อีโมจิผสม ZWJ เรนเดอร์ไม่ได้)
export const termRe = (term) => { const w = String(term || '').trim().split(/\s+/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); if (!w[0]) return null; w[0] = w[0].replace(/e$/, '') + '(?:e|es|s|ed|d|ing|en|n)?'; return new RegExp('\\b' + w.join('\\s+') + '\\b', 'i'); };
export const oneEmoji = (e) => { const s = String(e || '').split('\u200d')[0]; const m = s.match(/\p{Extended_Pictographic}\ufe0f?/u); return m ? m[0] : '💡'; };
const txt = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
export function cardPrompt(series, avoid) {
  const S = SERIES.find((x) => x.k === series) || SERIES[0];
  const common = `Return ONLY JSON. Thai text: natural, clear, neutral tone without ครับ/ค่ะ. English: natural, correct, A2-B2 level for Thai learners preparing for TOEIC/IELTS. Original content, never copied from British Council or any publisher. Avoid these recent topics: ${String(avoid || '').slice(0, 500)}.`;
  if (S.t === 'list') return `Create a Facebook learning card for Thai learners about: ${S.brief}.
${common}
{"title":"short English title, max 32 chars e.g. Phrasal Verbs with MAKE","title_th":"Thai subtitle max 40 chars","items":[{"term":"the word or phrase","meaning":"short English meaning max 60 chars","th":"Thai meaning max 40 chars","example":"natural example sentence max 70 chars that contains the term exactly","emoji":"ONE single emoji character (no combined/ZWJ emoji, no skin tones) that illustrates the example"}],"caption_th":"Facebook caption in Thai, 2-4 short lines: hook, why it matters for TOEIC/IELTS or daily life, then ask readers to write one sentence using a word from today in the comments (no 'comment yes' bait). No hashtags, no links.","hashtags":["4-6 short hashtags without #"]}
Rules: exactly 5 items; each example must contain the term (the first verb may change form, e.g. take → takes).`;
  return `Create a Facebook learning card for Thai learners about: ${S.brief}.
${common}
{"title":"short English story title max 28 chars e.g. My favourite meal","title_th":"Thai subtitle max 40 chars","photo":"2-3 English keywords for a stock photo matching the story e.g. breakfast eggs","paragraph":"an original 70-95 word story/paragraph in first person with exactly 4 target expressions wrapped like [[and]]","tips_title":"Top Tips title in English max 34 chars e.g. Linking words: when do we use them?","tips":[{"word":"the exact target expression as in the paragraph","th":"Thai rule of when/how to use it, max 45 chars"}],"caption_th":"Facebook caption in Thai, 2-4 short lines: hook, what to notice in the text, then ask readers to write one sentence using one of today's words in the comments (no engagement bait). No hashtags, no links.","hashtags":["4-6 short hashtags without #"]}
Rules: exactly 4 [[...]] marks, tips in the same order and wording as the marks.`;
}
const parseJ = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?|```$/g, '').trim(); try { return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); } catch (e) { return null; } };
export function normCard(raw, series) {
  const j = parseJ(raw), S = SERIES.find((x) => x.k === series) || SERIES[0]; if (!j) return null;
  const base = { series: S.k, type: S.t, title: txt(j.title, 40), title_th: txt(j.title_th, 50), caption: txt(j.caption_th, 700), hashtags: (Array.isArray(j.hashtags) ? j.hashtags : []).map((h) => txt(h, 30).replace(/^#|\s/g, '')).filter(Boolean).slice(0, 6) };
  if (!base.title) return null;
  if (S.t === 'list') {
    const items = (Array.isArray(j.items) ? j.items : []).map((x) => x && txt(x.term, 30) && txt(x.example, 90) ? { term: txt(x.term, 30), meaning: txt(x.meaning, 70), th: txt(x.th, 50), example: txt(x.example, 90), emoji: oneEmoji(x.emoji) } : null).filter((x) => x && termRe(x.term) && termRe(x.term).test(x.example));
    return items.length >= 4 ? { ...base, items: items.slice(0, 5) } : null;
  }
  const para = txt(j.paragraph, 900), marks = [...para.matchAll(/\[\[([^\]]{1,40})\]\]/g)].map((m) => m[1]);
  const tips = (Array.isArray(j.tips) ? j.tips : []).map((x) => x && txt(x.word, 40) ? { word: txt(x.word, 40), th: txt(x.th, 60) } : null).filter(Boolean);
  if (marks.length < 3 || tips.length < 3 || !tips.every((t) => marks.some((m) => m.toLowerCase() === t.word.toLowerCase()))) return null;
  return { ...base, photo: txt(j.photo, 40), paragraph: para, tips_title: txt(j.tips_title, 40), tips: tips.slice(0, 4) };
}
// ช่วงเวลาโพสต์การ์ด (เวลาไทย) · วันละ 2 โพสต์
export const SLOTS_TH = [12, 20];
export function nextSlot(taken, now = Date.now()) {
  const used = new Set((taken || []).map((t) => new Date(t).toISOString().slice(0, 13)));
  for (let d = 0; d < 30; d++) for (const h of SLOTS_TH) {
    const base = new Date(now + 7 * 3600e3); const t = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + d, h - 7, 0, 0);
    if (t > now + 30 * 60e3 && !used.has(new Date(t).toISOString().slice(0, 13))) return new Date(t).toISOString();
  }
  return null;
}
