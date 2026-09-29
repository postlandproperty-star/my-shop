// โดเมนร้าน: sheetlabth.com (คุณแดนซื้อผ่าน Vercel) ระบบสลับไปใช้เองทันทีที่โดเมนใหม่ตอบได้จริง
// ก่อนหน้านั้นใช้ my-shop-lake-ten.vercel.app ต่อไป (ที่อยู่เดิมยังใช้ได้ตลอด ทีม AI เรียก API ผ่านที่อยู่เดิมได้)
export const NEW_SITE = 'https://sheetlabth.com';
export const OLD_SITE = 'https://my-shop-lake-ten.vercel.app';
let cache = { at: 0, ok: false };
export async function newSiteLive() {
  if (Date.now() - cache.at < 10 * 60e3) return cache.ok;
  let ok = false;
  try {
    const r = await fetch(`${NEW_SITE}/api/content?action=sold`, { signal: AbortSignal.timeout(3000) });
    ok = r.ok && /json/.test(r.headers.get('content-type') || '');
  } catch {}
  cache = { at: Date.now(), ok };
  return ok;
}
export async function siteUrl() { return (await newSiteLive()) ? NEW_SITE : OLD_SITE; }
