// ข้อสอบเสมือนจริงจับเวลา (สมาชิก VIP) /vip/mock: สุ่มข้อจากคลังข้อสอบของร้าน ตามหมวด · จับเวลาในเบราว์เซอร์
// ข้อที่ผิด/ไม่ได้ตอบเข้าสมุดจุดพลาด (vip_marks) · ไม่แปลงเป็นคะแนนสอบจริง (ไม่สัญญาคะแนน)
export const MOCK_KINDS = [
  { k: 'toeic', name: 'TOEIC แนว Part 5–7', desc: 'ไวยากรณ์ คำศัพท์ และการอ่าน บริบทที่ทำงาน', cats: ['grammar', 'vocab', 'reading', 'mock', 'tips', 'listening'], n: 30, mins: 18 },
  { k: 'mini', name: 'ฝึกเร็ว ทุกหมวด', desc: 'สุ่มจากคลังทั้งหมด เหมาะกับวันที่มีเวลาน้อย', cats: null, n: 15, mins: 9 },
  { k: 'ielts', name: 'IELTS คำศัพท์และไวยากรณ์', desc: 'คำเชื่อม collocation และไวยากรณ์สำหรับ Writing/Speaking', cats: ['ielts'], n: 20, mins: 12 },
  { k: 'tgat', name: 'TGAT English', desc: 'เติมประโยคและบทสนทนาสั้น', cats: ['tgat'], n: 20, mins: 12 },
  { k: 'kp', name: 'ภาษาอังกฤษ ก.พ.', desc: 'grammar คำศัพท์ และบทสนทนา', cats: ['kp'], n: 20, mins: 12 },
  { k: 'work', name: 'ภาษาอังกฤษในที่ทำงาน', desc: 'อีเมล ประชุม สัมภาษณ์งาน', cats: ['work', 'speak'], n: 15, mins: 9 },
];
const MIN_POOL = 10;

// ข้อที่ใช้ได้: ตัวเลือก 2-6 ข้อ มีคำตอบชัด (ข้ามแบบพิมพ์คำตอบ)
function pool(quizzes, cats) {
  const out = [];
  for (const qz of quizzes) {
    if (cats && !cats.includes(qz.cat)) continue;
    (qz.questions || []).forEach((x, i) => {
      if (x.type === 'type' || !Array.isArray(x.choices) || x.choices.length < 2 || x.choices.length > 6) return;
      if (!(Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.choices.length) || !x.q) return;
      out.push({ quiz: qz.slug, cat: qz.cat || '', title: qz.title, i, q: x.q, choices: x.choices, answer: x.answer, explain: x.explain || '' });
    });
  }
  return out;
}

// ชุดที่ทำได้ตอนนี้ (คลังมีข้อพอ) · ข้อน้อยกว่าที่ตั้งไว้ = ลดจำนวนข้อและเวลาตามสัดส่วน
export function mockKinds(quizzes) {
  return MOCK_KINDS.map((m) => { const have = pool(quizzes, m.cats).length; if (have < MIN_POOL) return null; const n = Math.min(m.n, have); return { k: m.k, name: m.name, desc: m.desc, n, mins: Math.max(5, Math.round((m.mins * n) / m.n)) }; }).filter(Boolean);
}

export function pickMock(quizzes, k, rnd = Math.random) {
  const m = MOCK_KINDS.find((x) => x.k === k), kind = mockKinds(quizzes).find((x) => x.k === k);
  if (!m || !kind) return null;
  const all = pool(quizzes, m.cats);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return { ...kind, questions: all.slice(0, kind.n) };
}
