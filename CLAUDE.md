# SheetLab (sheetlabth.com)

## ⚠️ Top priority: customers can always pay and check out
คุณแดน (8 Oct 2026): this comes before every feature, speed fix or redesign.

- Any change that touches checkout must test the edge cases before pushing: empty or invalid email, cart, bundle plan, course, Android FB in-app and iPhone. Checkout code includes `qrInner`/`qrMake`/cart in `src/index.html`, `api/checkout.js`, `lib/fulfill.js`, and `lib/split.js` KEEP.
- After every deploy, check the live product page: type an email and press "ชำระเงิน", and confirm a QR request goes out. Intercept `/api/checkout?m=qr` in Playwright so no real payment is created.
- The payment watchdog (`payWatch` in `api/content.js`) emails the owner when customers tap pay but no QR is created. Keep it working. Status: `/api/content?action=paywatch&h=3` with the shop key.
- If orders look low, check checkout first: Stripe PaymentIntents vs `qrMake` clicks in `?action=insights&days=1`.
- `npm test` must pass before pushing (pre-push hook).

## ⚡ Second priority: sale-page speed
คุณแดน (18 Oct 2026): right after checkout, speed matters most. Customers come from FB ads on mobile 4G.

- Keep the customer page light:
  - Unit test "งบความเร็วหน้าลูกค้า": customer JS ≤ 95 KB and CSS ≤ 40 KB gzipped.
  - Admin code and data go to `/adm.js` via `lib/split.js`. Customer pages must never call admin functions, including from timers or listeners.
- The server renders the top of `/p/<slug>` (`ssrShell` in `api/page.js`). Product images use the mobile WebP copies (`smi()`, `tools/r2/imgsm.py`).
- After changes that touch customer pages, measure with `node tools/speed.mjs https://sheetlabth.com/p/ielts-9 --real [--slow]` and compare with the baseline: price seen ≈1.6 s on 4G and ≈2.0 s on weak 4G.
