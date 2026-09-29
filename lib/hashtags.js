// แฮชแท็กอัตโนมัติ (คุณแดนสั่ง 29 ก.ย.): ทุกโพสต์และคลิปต้องอยู่ในหมวด คนค้นหาเจอ
// Facebook/Reels: เติมท้ายโพสต์ตอนโพสต์จริง รวมไม่เกิน 5 แท็ก (เกินนี้ Facebook มองว่าสแปม)
// Threads: ใช้ topic_tag ของ API (ขึ้นเป็น "sheetlabth > TOEIC") ไม่เติมข้อความ
export const FB_TAGS = ['#TOEIC', '#ติวTOEIC', '#ภาษาอังกฤษ', '#SheetLab'];
export const TH_TOPIC = 'TOEIC';
export function withFbTags(text) {
  const t = String(text || '').trim();
  const have = (t.match(/#[^\s#]+/g) || []).map((x) => x.toLowerCase());
  const add = [];
  for (const tag of FB_TAGS) { if (have.length + add.length >= 5) break; if (!have.includes(tag.toLowerCase())) add.push(tag); }
  return add.length ? `${t}\n\n${add.join(' ')}` : t;
}
export function threadsTopic(text) {
  // ถ้าในข้อความมีแฮชแท็กอยู่แล้ว Threads ใช้อันแรกเป็นหัวข้อเอง ไม่ต้องส่ง topic_tag
  return /#[^\s#]+/.test(String(text || '')) ? null : TH_TOPIC;
}
