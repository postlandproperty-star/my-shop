// 🤖 ออโต้ไพลอตแอด (คุณแดน 16 ต.ค. 69 "ไม่อยากนั่ง optimize เอง แค่ลงเงินอย่างเดียว" · งบ ฿10,000/เดือน · ยืนยันแล้ว)
// ระบบเพิ่ม/ลดงบเอง หยุดแอดที่เผาเงิน ต่ออายุแอดที่กำไร · ไม่เกินงบเดือน (+ เงินบูสต์ที่คุณแดนเติมเอง) · ไม่ทำรูป AI (เตือนให้เลือกรูปเอง)
// งบแบ่ง 💰 ตัวทำเงิน (มีออเดอร์จริงแล้ว) 80% + 🧪 ทดลองของใหม่ 20% · ขยับงบแต่ละแคมเปญไม่เกิน ±30% ทุก 3 วัน (บูสต์ 2 วัน)
// ใช้ยอดขายจริงในร้าน (ไม่ใช่ตัวเลข Facebook) · เปิด/ปิดได้ในหลังบ้าน แท็บโฆษณา (ap_set เฉพาะคุณแดน)
export const AP_DEFAULT = { on: false, monthTHB: 10000, testShare: 0.2, mode: 'cap', goalProfit: 50000, targetRoas: 2.5, boosts: [], log: [], camp: {}, mail: {} };
// 🎯 โหมดเป้ากำไร (คุณแดน 16 ต.ค. 69 "กำไรหลังหักค่าแอด ~5 หมื่น/เดือน"): เพิ่มงบเฉพาะแคมเปญที่ได้คืน ≥ เป้า (2.5) · 2–2.5 ถืองบ · < 2 ลด · งบเดือนเป็นเพดาน ไม่เทให้ถึง
export const apTh = (cfg) => cfg.mode === 'goal' ? { up: Number(cfg.targetRoas) || 2.5, down: 2 } : { up: 3, down: 1.5 };
const DAY = 864e5, TZ = 7 * 36e5;
const thDay = (t = Date.now()) => new Date(t + TZ).toISOString().slice(0, 10);
const money = (n) => '฿' + Math.round(n).toLocaleString('th-TH');

// สรุปแคมเปญที่วิ่งอยู่จาก adsStatus (รวมหลายรูปในแคมเปญเดียว) + ยอดขายจริง 7/14 วัน + CTR 7 วันนี้เทียบ 7 วันก่อน
export function campaignsOf(st, real, daily) {
  const now = Date.now(), map = new Map();
  for (const a of st.ads) {
    const id = a.campaignId || a.campaign; if (!id) continue;
    const c = map.get(id) || { id, name: a.campaign || a.name, adsetIds: new Set(), budgetOn: a.campaignBudget ? 'campaign' : 'adset', dailyTHB: a.dailyTHB || 0, price: a.price || 990, end: a.end, created: a.created, groups: new Set(), tags: new Set(), spend7: 0 };
    if (a.adsetId) c.adsetIds.add(a.adsetId); c.groups.add(a.group); c.spend7 += a.week.spendTHB || 0;
    [a.tag, a.campaign].filter(Boolean).forEach((t) => c.tags.add(t.toLowerCase()));
    if (a.created && a.created < c.created) c.created = a.created; if (a.dailyTHB) c.dailyTHB = a.dailyTHB;
    map.set(id, c);
  }
  const out = [];
  for (const c of map.values()) {
    const mine = real.filter((o) => c.tags.has(String(o.campaign).toLowerCase()));
    const m7 = mine.filter((o) => Date.parse(o.paid_at) >= now - 7 * DAY), m14 = mine.filter((o) => Date.parse(o.paid_at) >= now - 14 * DAY);
    const rows = (daily?.rows || []).filter((r) => r.c === c.id), cut = thDay(now - 7 * DAY), cut2 = thDay(now - 14 * DAY);
    const sum = (rs, k) => rs.reduce((x, r) => x + (r[k] || 0), 0), w1 = rows.filter((r) => r.d > cut), w0 = rows.filter((r) => r.d > cut2 && r.d <= cut);
    const ctr = (rs) => (sum(rs, 'i') >= 1000 ? sum(rs, 'k') / sum(rs, 'i') : null);
    const running = [...c.groups].some((g) => ['run', 'fix', 'review'].includes(g));
    out.push({ ...c, adsetIds: [...c.adsetIds], tags: [...c.tags], running, ended: !running && c.groups.has('ended'),
      orders7: m7.length, rev7: m7.reduce((x, o) => x + (Number(o.amount) || 0), 0), orders14: m14.length,
      roas7: c.spend7 ? m7.reduce((x, o) => x + (Number(o.amount) || 0), 0) / c.spend7 : null, ctr7: ctr(w1), ctrPrev: ctr(w0), age: (now - Date.parse(c.created || now)) / DAY });
  }
  return out;
}

// วางแผนงบ (ไม่ทำจริง) · คืน { actions, info }
export function planBudget(cfg, camps, { monthSpent = 0, now = Date.now() } = {}) {
  const d = new Date(now + TZ), dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(), left = Math.max(1, dim - d.getUTCDate() + 1);
  const boosts = (cfg.boosts || []).filter((b) => Date.parse(b.end) > now);
  const boostLeft = boosts.reduce((x, b) => x + Math.max(0, b.extraTHB * (Date.parse(b.end) - now) / (Date.parse(b.end) - Date.parse(b.start))), 0);
  // เปิดกลางเดือน: งบเดือนนั้นคิดตามวันที่เหลือหลังเปิด และนับยอดใช้ตั้งแต่วันที่เปิด (ผู้เรียกส่ง monthSpent ตั้งแต่ startDay) ไม่ให้ยอดก่อนเปิดกินงบ
  const onDay = cfg.onAt ? new Date(Date.parse(cfg.onAt) + TZ) : null, sameMonth = onDay && onDay.getUTCFullYear() === d.getUTCFullYear() && onDay.getUTCMonth() === d.getUTCMonth();
  const capMonth = sameMonth ? cfg.monthTHB * (dim - onDay.getUTCDate() + 1) / dim : cfg.monthTHB;
  const monthLeft = Math.max(0, capMonth - monthSpent), allowed = monthLeft / left; // ต่อวัน (ไม่รวมบูสต์)
  const testPool = Math.round(allowed * (cfg.testShare ?? 0.2)), corePool = Math.round(allowed - testPool);
  const live = camps.filter((c) => c.running), actions = [], target = {}, notes0 = [], TH = apTh(cfg);
  const isCore = (c) => c.orders14 >= 2 || (c.orders7 >= 1 && (c.roas7 || 0) >= 1.5);
  // ทดลองเฉพาะสินค้าชุด (คุณแดน 16 ต.ค. 69 "ราคาสูง คุ้มค่าแอด"): แอดเล่มเดี่ยวที่ยังไม่มีออเดอร์ → หยุด · ไม่รู้ว่าเป็นอะไร (แอดเก่าที่สร้างเอง) → ไม่แตะ
  const st = (c) => cfg.camp?.[c.id] || {}, since = (c) => (now - Date.parse(st(c).changedAt || 0)) / DAY;
  const boostOf = (c) => boosts.find((b) => b.campaignId === c.id);
  for (const c of live) {
    // 1) เผาเงิน: 7 วันใช้เกิน 2 เท่าของราคา (อย่างน้อย ฿400) แต่ไม่มีออเดอร์จริง (อายุแอด ≥ 3 วัน) → หยุด (บูสต์ก็หยุด)
    if (c.age >= 3 && c.spend7 >= Math.max(2 * c.price, 400) && !c.orders7) { actions.push({ type: 'pause', c, why: `7 วันใช้ไป ${money(c.spend7)} ไม่มีออเดอร์จริง` }); continue; }
    if (!isCore(c) && c.bundle === false && !boostOf(c)) { actions.push({ type: 'pause', c, why: 'ทดลองเฉพาะสินค้าชุด (เล่มเดี่ยวราคาต่ำ ไม่คุ้มค่าแอด)' }); continue; }
    const cur = c.dailyTHB || 0; let t = cur, why = '';
    if (isCore(c)) {
      if ((c.roas7 || 0) >= TH.up) { t = cur * 1.2; why = `ได้คืน ${c.roas7.toFixed(1)} เท่า (≥ ${TH.up}) เพิ่มงบ`; }
      else if (c.spend7 >= 500 && (c.roas7 || 0) < TH.down) { t = cur * 0.7; why = `ได้คืนแค่ ${(c.roas7 || 0).toFixed(1)} เท่า (< ${TH.down}) ลดงบ`; }
    }
    const b = boostOf(c);
    if (b) { const want = (b.baseTHB || cur) + b.extraTHB / Math.max(1, b.days); t = Math.max(t, Math.min(want, cur * 1.3)); why = why || 'บูสต์ที่คุณแดนเติม'; }
    target[c.id] = { c, cur, t, t0: t, why, core: isCore(c), boosted: !!b };
  }
  // 2) ให้อยู่ในงบ: ตัวทำเงินรวม ≤ corePool (+ บูสต์) · ตัวทดลองแบ่ง testPool (สูงสุด 2 ตัว ตัวใหม่สุดก่อน)
  const core = Object.values(target).filter((x) => x.core), test = Object.values(target).filter((x) => !x.core);
  const boostDaily = core.filter((x) => x.boosted).reduce((s, x) => s + Math.max(0, x.t - x.cur), 0);
  const coreSum = core.reduce((s, x) => s + x.t, 0), cap = corePool + boostDaily;
  if (coreSum > cap && coreSum > 0) { // งบไม่พอ: แบ่งตามยอดขายจริง 7 วัน (ตัวทำเงินได้มากสุด ไม่เกินที่อยากได้ แล้วเกลี่ยส่วนเหลือ) · ตัวที่ได้ไม่ถึง ฿60/วัน หยุดตัวที่ขายน้อยสุดทีละตัว
    const w = (x) => Math.max(1, x.c.rev7), free = core.filter((x) => !x.boosted).sort((a, b) => w(b) - w(a));
    const avail = Math.max(0, cap - core.filter((x) => x.boosted).reduce((s2, x) => s2 + x.t, 0));
    const alloc = (L) => { let rem = avail, S = L.slice(); L.forEach((x) => { x.t = x.t0; });
      for (let k = 0; k < 10 && S.length; k++) { const W = S.reduce((s2, x) => s2 + w(x), 0), full = S.filter((x) => rem * w(x) / W >= x.t0); if (!full.length) { S.forEach((x) => { x.t = rem * w(x) / W; }); break; } full.forEach((x) => { rem -= x.t0; }); S = S.filter((x) => !full.includes(x)); } };
    let keep = free.slice(); alloc(keep);
    while (keep.length > 1 && keep.some((x) => x.t < 60)) { keep[keep.length - 1].drop = true; keep = keep.slice(0, -1); alloc(keep); }
    for (const x of free) { if (x.drop) { actions.push({ type: 'pause', c: x.c, why: `งบเดือนไม่พอให้ทุกตัว ยกงบให้ตัวที่ขายดีกว่า (ยอดขาย 7 วัน ${money(x.c.rev7)})` }); x.skip = true; }
      else if (x.t < x.cur) x.why = 'คุมงบเดือน' + (x === free[0] ? ' (ขายดีสุด ได้งบมากสุด)' : ''); } }
  // คุณแดนเลือกเองว่าจะยิงแอดสินค้าไหน (16 ต.ค. 69 "จะเป็นคนเพิ่มสินค้าไปยิงโฆษณาเอง") → ระบบไม่สร้าง/ไม่หยุดแอดทดลองเพราะคิว แค่แบ่งงบทดลองให้ทุกตัวเท่ากัน
  test.forEach((x) => { x.t = Math.min(150, testPool / test.length); x.why = x.why || '🧪 ทดลอง'; }); // ทดลองตัวละไม่เกิน ฿150/วัน
  // 3) ขยับทีละไม่เกิน ±30% · แคมเปญเดิมต้องห่างจากครั้งก่อน ≥ 3 วัน (บูสต์ 2 วัน) · เปลี่ยน < 10% ไม่ต้องทำ
  for (const x of Object.values(target).filter((y) => !y.skip)) {
    const cur = x.cur || x.t; let t = Math.max(60, Math.min(Math.round(x.t), Math.round(cur * 1.3))); // เพิ่มทีละไม่เกิน 30% · ลดได้ทันทีเพื่อไม่ให้เกินงบเดือน
    if (monthLeft <= 0) t = 0;
    const wait = x.boosted ? 2 : 3;
    if (cur && Math.abs(t - cur) / cur < 0.1) continue;
    if (cfg.camp?.[x.c.id]?.changedAt && since(x.c) < wait && t > cur) continue;
    actions.push(t <= 0 ? { type: 'pause', c: x.c, why: 'งบเดือนนี้หมดแล้ว' } : { type: 'budget', c: x.c, from: cur, to: t, why: x.why || 'คุมงบเดือน' });
  }
  // 4) ต่ออายุ: เหลือ ≤ 2 วันและยังกำไร (ได้คืน ≥ 1.5) → ต่อ 7 วัน
  for (const c of live) if (c.end && Date.parse(c.end) - now < 2 * DAY && (c.roas7 || 0) >= 1.5) actions.push({ type: 'extend', c, days: 7, why: `ใกล้หมดอายุ ยังได้คืน ${c.roas7.toFixed(1)} เท่า` });
  if (test.length && testPool / test.length < 60) notes0.push({ key: 'testpool', text: `แอดทดลอง ${test.length} ตัว ได้งบแค่ ~${money(testPool / test.length)}/วัน/ตัว น้อยไปจนวัดผลช้า · ลองเพิ่มงบเดือน หรือหยุดบางตัว` });
  // 5) เตือน: รูปเริ่มเบื่อ (CTR ลด > 30%) · ตัวทำเงินติดเพดาน (ได้คืน ≥ 3 แต่ถูกคุมงบ)
  const notes = [...notes0];
  for (const c of live) if (c.ctr7 != null && c.ctrPrev && c.ctr7 < c.ctrPrev * 0.7) notes.push({ key: 'fatigue:' + c.id, text: `แอด "${c.name}" คนกดน้อยลง ${Math.round((1 - c.ctr7 / c.ctrPrev) * 100)}% (CTR ${(c.ctrPrev * 100).toFixed(2)}% → ${(c.ctr7 * 100).toFixed(2)}%) ควรเปลี่ยนรูป: หลังบ้าน → โฆษณา → ✏️ ที่แอดนี้ เลือกปก/หน้าตัวอย่างจริง` });
  for (const x of core) if ((x.c.roas7 || 0) >= TH.up && x.t < x.cur * 1.15 && !x.boosted) notes.push({ key: 'scale:' + x.c.id, text: `แอด "${x.c.name}" ได้คืน ${x.c.roas7.toFixed(1)} เท่า แต่ติดเพดานงบเดือน ${money(cfg.monthTHB)} · ถ้าเพิ่มงบเดือน หรือกด 🚀 บูสต์ น่าจะขายได้เพิ่ม` });
  const testRun = test.filter((x) => !x.skip).length, slots = Math.max(0, 2 - testRun), each = Math.min(150, Math.floor(testPool / Math.max(1, testRun + slots)));
  return { actions, notes, newTests: { slots: each >= 60 ? slots : 0, dailyTHB: Math.max(60, each) }, info: { monthTHB: cfg.monthTHB, capMonth: Math.round(capMonth), monthSpent: Math.round(monthSpent), monthLeft: Math.round(monthLeft), daysLeft: left, allowedDaily: Math.round(allowed), corePool, testPool, boostLeft: Math.round(boostLeft) } };
}

// 🏁 เส้นชัยเดือนนี้ (แบบเกม): กำไรหลังหักค่าแอด = ยอดขายจริงทุกช่องทาง − ค่าแอด · ด่าน 🥉25% 🥈50% 🥇100% 🏆150% ของเป้า · คาดการณ์สิ้นเดือนจากอัตราที่ผ่านมา
export function goalInfo({ goal = 50000, rev = 0, spend = 0, now = Date.now() } = {}) {
  const d = new Date(now + TZ), day = d.getUTCDate(), dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const profit = Math.round(rev - spend), pace = Math.round(profit / Math.max(1, day - 1 + (d.getUTCHours() + 1) / 24) * dim), left = dim - day;
  const levels = [[0.25, '🥉', 'ด่าน 1'], [0.5, '🥈', 'ด่าน 2'], [1, '🥇', 'เส้นชัย'], [1.5, '🏆', 'ด่านพิเศษ']].map(([k, icon, name]) => ({ at: Math.round(goal * k), icon, name, done: profit >= goal * k }));
  return { goal, rev: Math.round(rev), spend: Math.round(spend), profit, pct: Math.max(0, Math.round(profit / goal * 100)), pace, day, dim, left, needPerDay: left > 0 ? Math.max(0, Math.round((goal - profit) / left)) : 0, reached: profit >= goal, onTrack: pace >= goal, levels };
}
