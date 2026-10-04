# ส่งชุดขายที่ผลิตเสร็จบนคอม (คิวหนังสือ / Cowork) ขึ้นหลังบ้าน SheetLab → การ์ด "📦 ชุดพร้อมลงขาย" ในแท็บสินค้า
# ใช้: CONTENT_KEY=... python3 tools/sets/upload_set.py "/Volumes/PortableSSD/Sheetlab/ชุดขาย/<ชื่อชุด>"
# ในโฟลเดอร์ชุดต้องมี set.json (ดู tools/sets/README.md) · เล่มที่ร้านมีอยู่แล้วใส่ "match" ไม่ต้องมีไฟล์
# อัปเฉพาะ PDF + ปก + หน้าตัวอย่าง (ไฟล์เสียงอยู่ใน Google Drive ตาม QR ในเล่ม ไม่อัปขึ้นคลังร้าน ประหยัดพื้นที่)
import json, os, io, sys, glob, urllib.request
import fitz  # pip install pymupdf pillow
from PIL import Image, ImageDraw, ImageFont

KEY = os.environ.get('CONTENT_KEY', '')
BASE = 'https://sheetlabth.com/api/content'
if len(sys.argv) < 2 or not KEY: sys.exit('ใช้: CONTENT_KEY=... python3 tools/sets/upload_set.py "<โฟลเดอร์ชุด>"')
ROOT = os.path.expanduser(sys.argv[1])
CFG = json.load(open(os.path.join(ROOT, 'set.json'), encoding='utf-8'))
SET = CFG['id']

def api(action, body):
    req = urllib.request.Request(f'{BASE}?action={action}', data=json.dumps(body).encode(), headers={'x-content-key': KEY, 'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=60))

def put(filename, data, ctype):
    j = api('set_uploadurl', {'set': SET, 'filename': filename})
    req = urllib.request.Request(j['upload_url'], data=data, method='PUT', headers={'Content-Type': ctype, 'x-upsert': 'true'})
    urllib.request.urlopen(req, timeout=600).read()
    return j['file_url']

def font(sz):
    for f in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()

def previews(pdf, slug):
    doc = fitz.open(pdf); n = doc.page_count
    pages = [p for p in [3, 4, 5, 6] if p <= n] or list(range(1, min(4, n) + 1))
    out = []
    for p in pages:
        pg = doc[p - 1]; z = 1100 / pg.rect.width
        pix = pg.get_pixmap(matrix=fitz.Matrix(z, z))
        im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
        W, H = im.size
        layer = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(layer); f = font(54)
        for yy in range(0, H * 2, 220):
            for xx in range(0, W * 2, 620): d.text((xx, yy), 'SheetLab · PREVIEW', font=f, fill=(36, 64, 232, 26))
        layer = layer.rotate(30, resample=Image.BICUBIC).crop((W // 2, H // 2, W // 2 + W, H // 2 + H))
        im = Image.alpha_composite(im.convert('RGBA'), layer).convert('RGB')
        d = ImageDraw.Draw(im); d.rectangle([0, H - 56, W, H], fill=(15, 27, 51))
        t = f'Preview page {p} of {n} · SheetLab'; f2 = font(26); w = d.textlength(t, font=f2); d.text(((W - w) / 2, H - 44), t, font=f2, fill=(255, 255, 255))
        b = io.BytesIO(); im.save(b, 'JPEG', quality=82)
        out.append(put(f'{slug}/pv-{p}.jpg', b.getvalue(), 'image/jpeg'))
    return out, n

def cover(png, slug):
    im = Image.open(png).convert('RGB'); s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width - s) // 2 + s, (im.height - s) // 2 + s)).resize((1200, 1200), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=88)
    return put(f'{slug}/cover.jpg', b.getvalue(), 'image/jpeg')

BOOKS = CFG
out = []
for b in BOOKS['books']:
    if b.get('match'): out.append(b); print('match', b['match']); continue
    folder = [d for d in glob.glob(os.path.join(ROOT, b['dir'] + '*')) if glob.glob(os.path.join(d, '*.pdf'))][0]
    pdf = glob.glob(os.path.join(folder, '*.pdf'))[0]; slug = b['slug']
    print('upload', slug, os.path.getsize(pdf) // 1024, 'KB')
    b['file_url'] = put(f'{slug}/{slug}.pdf', open(pdf, 'rb').read(), 'application/pdf')
    if os.path.exists(os.path.join(folder, 'cover.png')): b['cover'] = cover(os.path.join(folder, 'cover.png'), slug)
    b['previews'], b['pages'] = previews(pdf, slug)
    b['specs'] = f"รูปแบบ | ไฟล์ PDF ขนาด A4\nจำนวนหน้า | {b['pages']} หน้า" + ("\nไฟล์เสียง | MP3 สแกน QR ในเล่ม" if b.get('audio') else '')
    out.append(b)
BOOKS['books'] = out
r = api('set_import', BOOKS)
print(json.dumps({'ok': r.get('ok'), 'books': [(x['name'][:30], bool(x.get('file_url')), x.get('pages')) for x in r['item']['books']]}, ensure_ascii=False))
