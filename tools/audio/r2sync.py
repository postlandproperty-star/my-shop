#!/usr/bin/env python3
"""ย้าย/อัปโหลดไฟล์เสียงหนังสือขึ้น Cloudflare R2 แล้วสร้างหน้าเล่นเสียง /audio/<SKU> (คุณแดน 12 ต.ค. 69: ลดค่า Google Drive + ลูกค้ากดฟังง่าย)
  python3 tools/audio/r2sync.py                       ทุกเล่มในร้านที่มีไฟล์เสียง (หาโฟลเดอร์เสียงในเครื่องเอง) · หรือระบุ books.json [{sku, name, drive, cover, toc}]
  python3 tools/audio/r2sync.py --sku SL-080 --dir <โฟลเดอร์ audio> --title "..." [--cover URL] [--toc file]   เล่มเดียว (ใช้ตอนโรงงานผลิตเสร็จ)
หาไฟล์เสียงจาก: โฟลเดอร์ audio ข้าง PDF ของโรงงาน (SSD/Mac ตามเลข SKU) → โฟลเดอร์ Drive ตาม id ลิงก์เดิม → โฟลเดอร์ Drive ที่ชื่อตรงกับชื่อเล่ม
คีย์ R2 ที่ ~/.config/sheetlab/r2.json (ไม่อยู่ในโค้ด) · ไฟล์ใน R2: <SKU>/<ชื่อไฟล์> (โฟลเดอร์ย่อยต่อชื่อด้วย __) · อัปซ้ำได้ ข้ามไฟล์ที่ขนาดเท่าเดิม
ไฟล์เดิมใน Google Drive ไม่ลบ (QR ในเล่มที่ขายไปแล้วยังชี้ไปที่ Drive)
"""
import sys, os, re, json, subprocess, argparse, urllib.request, warnings, hashlib
from pathlib import Path
warnings.filterwarnings('ignore')
import boto3

HERE = Path(__file__).resolve().parent; ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / 'tools' / 'factory'))
import catalog as C  # SSD, OLD, DRIVES, NUM, walk, drive_id

FF = str(ROOT / 'node_modules/ffmpeg-static/ffmpeg')
CFG = json.load(open(Path.home() / '.config/sheetlab/r2.json'))
S3 = boto3.client('s3', endpoint_url=CFG['endpoint'], aws_access_key_id=CFG['access_key_id'], aws_secret_access_key=CFG['secret_access_key'], region_name='auto')
EXT = ('.mp3', '.m4a', '.wav', '.ogg')


def ck():
    return os.environ.get('CONTENT_KEY') or open(Path.home() / '.config/sheetlab/content-key').read()[:48].strip()


def api(action, body):
    r = urllib.request.Request(f'https://sheetlabth.com/api/content?action={action}', data=json.dumps(body).encode(), method='POST', headers={'x-content-key': ck(), 'Content-Type': 'application/json'})
    try: return json.loads(urllib.request.urlopen(r, timeout=120).read())
    except urllib.error.HTTPError as e: return {'ok': False, 'error': f'{e.code} {e.read()[:200]}'}


_factory = None
def factory_dirs():
    """SKU → โฟลเดอร์ audio ข้าง PDF ของโรงงาน (ชื่อไฟล์ 044_วันที่_ชื่อ.pdf)"""
    global _factory
    if _factory is None:
        _factory = {}
        for root in (C.SSD, C.OLD):
            for pdf in C.walk(root):
                m = C.NUM.match(pdf.name)
                if m and (pdf.parent / 'audio').is_dir() and 'ชุดขาย' not in pdf.parts: _factory.setdefault(f'SL-{m.group(1)}', pdf.parent / 'audio')
    return _factory


def drive_dirs():
    out = []
    for d in C.DRIVES:
        try: out += [x for x in Path(d).iterdir() if x.is_dir()]
        except Exception: pass
    return out


def find_dir(b):
    if b['sku'] in factory_dirs(): return factory_dirs()[b['sku']]
    fid = (re.search(r'folders/([\w-]+)', b.get('drive') or '') or [None, None])[1]
    dd = drive_dirs()
    if fid:
        for d in dd:
            if C.drive_id(d) == fid: return d
    # ชื่อโฟลเดอร์ไม่ตรงชื่อเล่มเป๊ะ (IELTS LISTENING 10 TESTS ↔ IELTS LISTENING ข้อสอบ 10 ชุด) → นับคำอังกฤษ/ตัวเลขที่ตรงกัน มากสุดและ ≥3 คำ
    tok = lambda s: set(re.findall(r'[A-Z]{2,}|\d{2,}', str(s).upper()))
    t = tok(b.get('name', '')); best = (0, None)
    for d in dd:
        sc = len(t & tok(d.name))
        if sc > best[0] and any(f.suffix.lower() in EXT for f in d.rglob('*')): best = (sc, d)
    return best[1] if best[0] >= 3 else None


def secs(f):
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', subprocess.run([FF, '-i', str(f)], capture_output=True, text=True).stderr)
    return int(int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])) if m else 0


def chapters(toc):
    out = {}
    for l in str(toc or '').splitlines():
        m = re.match(r'^\s*(?:บทที่|Topic|Unit|Chapter|Full Mock Test|Test|ชุดที่)\s*(\d+)\s*[·:.\-]?\s*(.+?)\s*$', l, re.I)
        if m: out[str(int(m[1]))] = m[2][:110]
    return out


def sync(b, d):
    files = sorted(f for f in Path(d).rglob('*') if f.suffix.lower() in EXT and not f.name.startswith('.') and f.stat().st_size > 2000)
    if not files: return {'sku': b['sku'], 'error': 'ไม่มีไฟล์เสียงในโฟลเดอร์', 'dir': str(d)}
    up = skip = 0; listing = []
    for f in files:
        rel = str(f.relative_to(d)).replace(os.sep, '__'); key = f"{b['sku']}/{rel}"
        try: same = S3.head_object(Bucket=CFG['bucket'], Key=key)['ETag'].strip('"') == hashlib.md5(f.read_bytes()).hexdigest()  # เทียบเนื้อไฟล์ (เดิมเทียบแค่ขนาด เสียงที่ทำใหม่ยาวเท่าเดิมเลยไม่ถูกอัป 25 ต.ค. 69)
        except Exception: same = False
        if same: skip += 1
        else:
            S3.upload_file(str(f), CFG['bucket'], key, ExtraArgs={'ContentType': 'audio/mpeg' if f.suffix.lower() == '.mp3' else 'audio/' + f.suffix[1:].lower(), 'CacheControl': 'public, max-age=31536000'}); up += 1
        listing.append({'f': rel, 'sec': secs(f)})
    r = api('audio_lib', {'book': {'sku': b['sku'], 'title': b.get('name') or b['sku'], 'cover': b.get('cover') or '', 'base': f"{CFG['public'].rstrip('/')}/{b['sku']}", 'chapters': chapters(b.get('toc')), 'files': listing}})
    return {'sku': b['sku'], 'dir': str(d)[-60:], 'files': len(files), 'uploaded': up, 'skipped': skip, 'ok': r.get('ok'), 'url': r.get('url'), 'error': r.get('error')}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('books', nargs='?'); ap.add_argument('--sku'); ap.add_argument('--dir'); ap.add_argument('--title', default=''); ap.add_argument('--cover', default=''); ap.add_argument('--toc', default='')
    a = ap.parse_args()
    if a.sku:
        b = {'sku': a.sku.upper(), 'name': a.title, 'cover': a.cover, 'toc': open(a.toc, encoding='utf-8').read() if a.toc and os.path.exists(a.toc) else a.toc}
        print(json.dumps(sync(b, a.dir or find_dir(b)), ensure_ascii=False)); return
    if a.books: books = json.load(open(a.books, encoding='utf-8'))
    else:  # ไม่ระบุไฟล์ = ทุกเล่มในร้านที่มีไฟล์เสียง
        r = urllib.request.Request('https://sheetlabth.com/api/content?action=audio_lib&products=1', headers={'x-content-key': ck()})
        books = json.loads(urllib.request.urlopen(r, timeout=60).read())['products']
    for b in books:
        d = find_dir(b)
        print(json.dumps(sync(b, d) if d else {'sku': b['sku'], 'error': 'หาโฟลเดอร์เสียงในเครื่องไม่เจอ'}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
