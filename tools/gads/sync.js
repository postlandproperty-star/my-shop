// 🔎 Google Ads Script ของร้าน (บัญชี 953-253-3805) · วางใน Google Ads → Tools → Bulk actions → Scripts · ตั้งให้รันทุกชั่วโมง
// ส่งตัวเลขแคมเปญรายวัน 30 วัน + คำค้นจริง 7 วัน ไปที่หลังบ้าน (api/content.js action=gads_sync) · แก้แอดเฉพาะเมื่อออโต้ไพลอตเปิดและตั้งงบ Google ไว้ (ปรับงบต่อวัน/หยุด/เปิดกลับ)
// KEY = private.gadsKey ใน shop_state (ใส่ตอนวางสคริปต์ ห้าม commit กุญแจจริง)
var URL = 'https://sheetlabth.com/api/content?action=gads_sync';
var KEY = '__GADS_KEY__';

function main() {
  var rows = [], terms = [];
  var it = AdsApp.search(
    'SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros, segments.date, ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value ' +
    'FROM campaign WHERE segments.date DURING LAST_30_DAYS');
  while (it.hasNext()) {
    var r = it.next();
    rows.push({ d: r.segments.date, id: String(r.campaign.id), name: r.campaign.name, st: r.campaign.status,
      budget: (Number(r.campaignBudget.amountMicros) || 0) / 1e6, i: Number(r.metrics.impressions) || 0, k: Number(r.metrics.clicks) || 0,
      cost: (Number(r.metrics.costMicros) || 0) / 1e6, conv: Number(r.metrics.conversions) || 0, val: Number(r.metrics.conversionsValue) || 0 });
  }
  // แคมเปญที่ยังไม่มีตัวเลข (เช่นเพิ่งสร้าง/หยุดอยู่) ก็ส่งสถานะไปด้วย
  var all = AdsApp.search('SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign WHERE campaign.status != "REMOVED"');
  while (all.hasNext()) {
    var c = all.next();
    rows.push({ d: '', id: String(c.campaign.id), name: c.campaign.name, st: c.campaign.status, budget: (Number(c.campaignBudget.amountMicros) || 0) / 1e6, i: 0, k: 0, cost: 0, conv: 0, val: 0 });
  }
  var st = AdsApp.search(
    'SELECT search_term_view.search_term, ad_group.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions ' +
    'FROM search_term_view WHERE segments.date DURING LAST_7_DAYS ORDER BY metrics.impressions DESC LIMIT 200');
  while (st.hasNext()) {
    var s = st.next();
    terms.push({ t: s.searchTermView.searchTerm, g: s.adGroup.name, i: Number(s.metrics.impressions) || 0, k: Number(s.metrics.clicks) || 0,
      cost: (Number(s.metrics.costMicros) || 0) / 1e6, conv: Number(s.metrics.conversions) || 0 });
  }
  var res = UrlFetchApp.fetch(URL, { method: 'post', contentType: 'application/json', headers: { 'x-gads-key': KEY },
    payload: JSON.stringify({ acct: AdsApp.currentAccount().getCustomerId(), rows: rows, terms: terms }), muteHttpExceptions: true });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
  // 🤖 ออโต้ไพลอตหลังบ้าน (งบ Google ที่คุณแดนตั้ง) ส่งคำสั่งกลับมา: ปรับงบต่อวัน / หยุดเมื่องบเดือนหมด / เปิดกลับเดือนใหม่
  var cmds = []; try { cmds = JSON.parse(res.getContentText()).cmds || []; } catch (e) {}
  var done = [];
  for (var i = 0; i < cmds.length; i++) {
    var x = cmds[i], r = { type: x.type, id: x.id, name: x.name };
    try {
      var ci = AdsApp.campaigns().withIds([Number(x.id)]).get();
      if (!ci.hasNext()) throw new Error('ไม่พบแคมเปญ');
      var camp = ci.next();
      if (x.type === 'gbudget' && x.to >= 1) camp.getBudget().setAmount(x.to);
      else if (x.type === 'gpause') camp.pause();
      else if (x.type === 'gresume') camp.enable();
      r.ok = true;
    } catch (e) { r.err = String(e.message || e); }
    done.push(r); Logger.log(JSON.stringify(r));
  }
  if (done.length) UrlFetchApp.fetch(URL, { method: 'post', contentType: 'application/json', headers: { 'x-gads-key': KEY }, payload: JSON.stringify({ done: done }), muteHttpExceptions: true });
}
