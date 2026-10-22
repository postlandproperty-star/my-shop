// ☁️ ความคืบหน้าย้ายร้านไป Cloudflare (คุณแดน 22 ต.ค. 69 "ส่งรายงานความคืบหน้าทางอีเมลเป็นระยะๆ พร้อมแบบเปอร์เซ็นต์")
// แผน: https://claude.ai/artifact/MepQtuFzHLgiBZ6QQ8QCaa · สถานะเก็บใน shop_state id=cf_move { done: { k: { f, at, note } }, mail: { pct, at } }
// w = น้ำหนัก (รวม 100) · f = ทำไปแล้วกี่ส่วน (0–1) · อีเมลไปหาคุณแดนเมื่อเปอร์เซ็นต์ขยับ และทุกวันจันทร์จนกว่าจะครบ
export const CF_STEPS = [
  { k: 'backup', phase: 0, name: 'สำรองฐานข้อมูลทุกวันไป Cloudflare R2 (เข้ารหัส)', w: 5 },
  { k: 'd1', phase: 0, name: 'สร้างฐานข้อมูลใหม่ D1 (ตารางเดียวกับของเดิม)', w: 3 },
  { k: 'quota', phase: 0, name: 'ลดโควตา Vercel ที่ใช้เปล่า (แคชหน้าเว็บ · หลังบ้านรีเฟรชช้าลง)', w: 2 },
  { k: 'email', phase: 1, name: 'ย้ายระบบส่งอีเมลออกจาก Gmail (ส่งได้เกินวันละ 500 ฉบับ)', w: 8 },
  { k: 'files', phase: 2, name: 'ย้ายไฟล์ทั้งหมด (รูปสินค้า PDF เสียง) ไป R2', w: 12 },
  { k: 'data', phase: 3, name: 'ย้ายข้อมูล (ออเดอร์ สินค้า สมาชิก) เข้า D1 และซิงก์ทุกวัน', w: 8 },
  { k: 'pages', phase: 3, name: 'หน้าร้าน หน้าขาย บทความ บน Cloudflare (โดเมนทดสอบ)', w: 12 },
  { k: 'checkout', phase: 3, name: 'ระบบจ่ายเงิน + Stripe + ส่งไฟล์ให้ลูกค้า บน Cloudflare (ทดสอบครบทุกกรณี)', w: 10 },
  { k: 'admin', phase: 3, name: 'หลังบ้าน โรงงาน โฆษณา บน Cloudflare', w: 12 },
  { k: 'cron', phase: 3, name: 'งานอัตโนมัติรายวัน (ตรวจระบบ โพสต์ ออโต้ไพลอต อีเมลรีวิว)', w: 5 },
  { k: 'switch', phase: 4, name: 'สลับโดเมนจริงไป Cloudflare ทีละส่วน (จ่ายเงินย้ายท้ายสุด ตอนตี 2–6)', w: 15 },
  { k: 'stable', phase: 5, name: 'วิ่งนิ่ง 2 สัปดาห์ เก็บข้อมูลชุดสุดท้าย แล้วยกเลิก Supabase/Vercel ได้', w: 8 },
];
export const CF_PHASES = ['เตรียมตัว', 'อีเมล', 'ไฟล์', 'สร้างระบบใหม่ (โดเมนทดสอบ)', 'สลับของจริง', 'ปิดของเก่า'];
// ที่ทำไปแล้วก่อนมีตัวนับ (21–22 ต.ค. 69)
export const CF_INIT = {
  backup: { f: 1, at: '2026-10-21', note: 'สำรองทุกวัน เก็บ 60 วัน' },
  d1: { f: 1, at: '2026-10-21', note: 'sheetlab-db' },
  quota: { f: 1, at: '2026-10-21', note: 'commit a10d587' },
  files: { f: 0.3, at: '2026-10-22', note: 'เสียง รูปมือถือ ชีทฟรี อยู่บน R2 แล้ว · เหลือรูปสินค้าและ PDF' },
};

export function cfProgress(state = {}) {
  const done = { ...CF_INIT, ...(state.done || {}) };
  const steps = CF_STEPS.map((s) => { const d = done[s.k] || {}; const f = Math.max(0, Math.min(1, Number(d.f) || 0)); return { ...s, f, at: d.at || null, note: d.note || '' }; });
  const pct = Math.round(steps.reduce((x, s) => x + s.w * s.f, 0));
  const next = steps.find((s) => s.f < 1) || null;
  const phase = next ? next.phase : 5;
  return { pct, steps, next, phase, phaseName: CF_PHASES[phase], canCancel: steps.every((s) => s.f >= 1) };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// เนื้ออีเมล (ownerMail ใส่หัว/ท้ายให้) · prev = เปอร์เซ็นต์รอบก่อน
export function cfMailBody(p, { prev = null, why = '' } = {}) {
  const bar = `<div style="background:#E3E8F0;border-radius:99px;height:14px;overflow:hidden"><div style="width:${p.pct}%;height:14px;background:#1F6FEB"></div></div>`;
  const row = (s) => `<tr><td style="padding:4px 6px 4px 0;vertical-align:top">${s.f >= 1 ? '✅' : s.f > 0 ? '🔄' : '⬜'}</td><td style="padding:4px 0">${esc(s.name)}${s.f > 0 && s.f < 1 ? ` <b>${Math.round(s.f * 100)}%</b>` : ''}${s.note ? `<br><span style="font-size:12px;color:#56637D">${esc(s.note)}</span>` : ''}</td></tr>`;
  const groups = CF_PHASES.map((n, i) => { const ss = p.steps.filter((s) => s.phase === i); return ss.length ? `<p style="margin:14px 0 4px;font-weight:700">ขั้น ${i}: ${esc(n)}</p><table style="border-collapse:collapse;font-size:14px">${ss.map(row).join('')}</table>` : ''; }).join('');
  return `<p style="font-size:28px;font-weight:800;margin:0 0 6px">${p.pct}%${prev != null && prev !== p.pct ? ` <span style="font-size:15px;color:#1A7F37">(+${p.pct - prev}%)</span>` : ''}</p>${bar}
<p style="margin:10px 0 0">${why ? esc(why) + ' · ' : ''}ตอนนี้อยู่ขั้น ${p.phase}: ${esc(p.phaseName)}${p.next ? ` · ถัดไป: ${esc(p.next.name)}` : ''}</p>
<p style="margin:6px 0 0;font-size:13px;color:#56637D">ระหว่างย้าย เว็บและระบบจ่ายเงินยังใช้ของเดิมตามปกติ ลูกค้าไม่สะดุด${p.canCancel ? '' : ' · ยังไม่ต้องยกเลิก Supabase/Vercel (จะแจ้งเมื่อครบ 100%)'}</p>${groups}
${p.canCancel ? '<p style="margin:16px 0 0;font-weight:700;color:#1A7F37">✅ ครบแล้ว ยกเลิกแผนรายเดือน Supabase ได้</p>' : ''}`;
}
