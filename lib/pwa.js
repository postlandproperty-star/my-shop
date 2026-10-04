// เว็บแอป (PWA): เพิ่ม SheetLab ลงหน้าจอโทรศัพท์ เปิดเต็มจอเหมือนแอป ไม่ต้องผ่าน App Store
// service worker ไม่ดัก/ไม่แคชหน้าเว็บเลย (ไม่มี fetch handler) หน้าร้านและการจ่ายเงินทำงานเหมือนเปิดในเบราว์เซอร์ทุกอย่าง
export const PWA_MANIFEST = {
  name: 'SheetLab ฝึกข้อสอบภาษาอังกฤษ', short_name: 'SheetLab', description: 'ข้อสอบ TOEIC IELTS TGAT ก.พ. พร้อมเฉลย ข้อสอบเสมือนจริงจับเวลา และสมุดจุดพลาด',
  id: '/app', start_url: '/app?src=pwa', scope: '/', display: 'standalone', orientation: 'portrait', lang: 'th', dir: 'ltr',
  background_color: '#EDF1F7', theme_color: '#2440E8',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'ข้อสอบเสมือนจริง', url: '/vip/mock', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    { name: 'สมุดจุดพลาด', url: '/vip/review', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    { name: 'ข้อสอบวันนี้', url: '/quiz/daily', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
  ],
};
export const SW_JS = `// SheetLab service worker: ไม่ดักคำขอใดๆ (ไม่มี fetch handler) มีไว้ให้ติดตั้งลงหน้าจอได้ และรองรับแจ้งเตือนในอนาคต
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
`;
// แท็กใน <head> ของทุกหน้า (หน้าร้านในแอปใส่ชุดเดียวกันใน src/index.html)
export const PWA_HEAD = '<link rel="manifest" href="/manifest.webmanifest"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="SheetLab"><meta name="apple-mobile-web-app-status-bar-style" content="default">';
