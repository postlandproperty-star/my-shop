"""รูปสินค้าขนาดมือถือ (คุณแดน 17 ต.ค. 69 "เปิดหน้า salepage ช้ามาก"): ปกเดิม 1200px JPEG 100–240 KB → WebP กว้าง 800px ราว 30–70 KB
  python3 tools/r2/imgsm.py [--all]   ย่อเฉพาะรูปที่ยังไม่เคยย่อ (--all = ทำใหม่ทุกรูป) · worker.py start เรียกทุกชั่วโมง
- อ่านรายการสินค้าที่ขายอยู่จากร้าน (action=shop) · รูปต้นฉบับไม่แตะ (หลังบ้าน/ซูมยังใช้รูปเดิม)
- เก็บที่ R2 sm/<sha1 ของลิงก์>.webp + sm/manifest.json {ลิงก์เดิม: ลิงก์ย่อ} → api/page.js ใส่ให้หน้าลูกค้า
"""
import sys, os, io, json, hashlib, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import r2

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
KEY = open(os.path.expanduser('~/.config/sheetlab/content-key')).read().strip()[:48]
MAN = 'sm/manifest.json'
W = 800


def get(url, headers=None):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (SheetLab imgsm)', **(headers or {})}), timeout=60).read()


def main(all_=False):
    shop = json.loads(get('https://sheetlabth.com/api/content?action=shop', {'x-content-key': KEY}))
    P = (shop.get('shop') or shop).get('products') or []
    urls = []
    for p in P:
        if p.get('status', 'published') != 'published': continue
        for u in [*(p.get('images') or []), p.get('cover') or '']:
            if isinstance(u, str) and u.startswith('https://') and u not in urls: urls.append(u)
    try: man = {} if all_ else json.loads(get(r2.public_url(MAN) + f'?t={os.getpid()}'))
    except Exception: man = {}
    made, skip, fail = 0, 0, []
    for u in urls:
        if u in man: skip += 1; continue
        try:
            im = Image.open(io.BytesIO(get(u))); im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
            if im.width > W: im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
            b = io.BytesIO(); im.save(b, 'WEBP', quality=74, method=6)
            man[u] = r2.put_bytes(b.getvalue(), f'sm/{hashlib.sha1(u.encode()).hexdigest()[:20]}.webp', 'image/webp'); made += 1
        except Exception as e: fail.append(f'{u[-50:]}: {str(e)[:80]}')
    if made or all_:
        r2.S3.put_object(Bucket=r2.CFG['bucket'], Key=MAN, Body=json.dumps(man).encode(), ContentType='application/json', CacheControl='public, max-age=300')
    print(json.dumps({'images': len(urls), 'made': made, 'had': skip, 'fail': fail[:5]}, ensure_ascii=False))


if __name__ == '__main__':
    main('--all' in sys.argv)
