# โรงงานบนคอมคุณแดน (Cowork): ดึงใบสั่งจากหน้าโรงงานบนเว็บ → ผลิตในคอม → ส่งไฟล์ขึ้นร้าน → แจ้งเสร็จ
# เว็บเป็นแผงควบคุม (คิว/สถานะ/อนุมัติ) คอมเป็นที่ผลิตที่เดียว (โรงงานบนคลาวด์หยุดไว้ 2 ต.ค. 69 กันผลิตซ้ำ)
#
#   CONTENT_KEY=... python3 tools/factory/worker.py queue                 ใบสั่งที่รอผลิต (ตามลำดับที่คุณแดนจัดบนเว็บ บนสุดก่อน) + บันทึกว่าคอมมาเช็คแล้ว
#   CONTENT_KEY=... python3 tools/factory/worker.py claim <job_id>        จองงานก่อนเริ่มผลิต (ok=false = มีคนทำแล้ว ข้าม)
#   CONTENT_KEY=... python3 tools/factory/worker.py done <job_id> <ไฟล์.pdf> [--cover cover.png] [--listing listing.json] [--summary "..."]
#        อัป PDF + ปก แล้วแจ้งเสร็จ (หน้าตัวอย่าง 3-6 เว็บทำเองตอนคุณแดนกดอนุมัติ) → เว็บขึ้นการ์ด "จากโรงงาน รออนุมัติ" ให้คุณแดน
#   CONTENT_KEY=... python3 tools/factory/worker.py done-notion <job_id> <notion_url> [--cover cover.png] [--images a.png b.png] [--listing listing.json]
#   CONTENT_KEY=... python3 tools/factory/worker.py fail <job_id> "เหตุผลสั้นๆ"
#
# listing.json = ข้อความหน้าขาย {name, headline, desc, features, forwho, notfor, faq, specs, toc} (ห้ามใส่ราคา)
# ไฟล์เสียงไม่อัปขึ้นร้าน (อยู่ Google Drive ตาม QR ในเล่ม)
import json, os, io, sys, argparse, subprocess, urllib.request

KEY = os.environ.get('CONTENT_KEY', '')
BASE = 'https://sheetlabth.com/api/content'
LOCK = '/Volumes/PortableSSD/Sheetlab/_factory/.running'  # กำลังผลิต (แอป Mac / หน้าโรงงานบนเว็บแสดงสถานะ) · รอบถัดไปไม่ผลิตซ้อน


def sync():
    # ส่งคลังหนังสือ + สถานะ SSD/กำลังผลิต ขึ้นหน้าโรงงานบนเว็บ (ไม่สำเร็จก็ไม่เป็นไร รอบหน้าส่งใหม่)
    try: subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'catalog.py'), '--sync'], capture_output=True, timeout=240)
    except Exception: pass


def page_count(pdf):
    try:
        out = subprocess.run(['/opt/homebrew/bin/pdfinfo', pdf], capture_output=True, text=True, timeout=30).stdout
        return int(next(l.split()[-1] for l in out.splitlines() if l.startswith('Pages:')))
    except Exception:
        import fitz; return fitz.open(pdf).page_count


def api(action, body=None, query=''):
    url = f'{BASE}?action={action}{query}'
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={'x-content-key': KEY, 'Content-Type': 'application/json'}, method='POST' if data else 'GET')
    return json.load(urllib.request.urlopen(req, timeout=60))


def upload(job, path, filename, ctype):
    j = api('factory_uploadurl', {'id': job, 'filename': filename})
    if not j.get('ok'): sys.exit(f'ขอที่อัปโหลดไม่ได้: {j}')
    data = open(path, 'rb').read() if isinstance(path, str) else path
    urllib.request.urlopen(urllib.request.Request(j['upload_url'], data=data, method='PUT', headers={'Content-Type': ctype, 'x-upsert': 'true'}), timeout=600).read()
    return j['file_url']


def previews(job, pdf):
    # หน้าตัวอย่าง 3-6 มีลายน้ำ (ใช้ pdftoppm ของ poppler ไม่ต้องมี pymupdf) → ขึ้นเป็นหน้าตัวอย่างในเซลเพจ
    import tempfile, glob
    from PIL import Image, ImageDraw, ImageFont
    def font(sz):
        for f in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf']:
            if os.path.exists(f): return ImageFont.truetype(f, sz)
        return ImageFont.load_default()
    n = page_count(pdf)
    pages = [p for p in [3, 4, 5, 6] if p <= n] or list(range(1, min(4, n) + 1))
    out = []; tmp = tempfile.mkdtemp()
    for p in pages:
        base = os.path.join(tmp, f'p{p}')
        subprocess.run(['/opt/homebrew/bin/pdftoppm', '-f', str(p), '-l', str(p), '-scale-to-x', '1100', '-scale-to-y', '-1', '-png', '-singlefile', pdf, base], capture_output=True, timeout=120)
        if not os.path.exists(base + '.png'): continue
        im = Image.open(base + '.png').convert('RGB'); W, H = im.size
        layer = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
        for yy in range(0, H * 2, 220):
            for xx in range(0, W * 2, 620): d.text((xx, yy), 'SheetLab · PREVIEW', font=font(54), fill=(36, 64, 232, 26))
        layer = layer.rotate(30, resample=Image.BICUBIC).crop((W // 2, H // 2, W // 2 + W, H // 2 + H))
        im = Image.alpha_composite(im.convert('RGBA'), layer).convert('RGB'); d = ImageDraw.Draw(im)
        d.rectangle([0, H - 56, W, H], fill=(15, 27, 51)); t = f'Preview page {p} of {n} · SheetLab'
        d.text(((W - d.textlength(t, font=font(26))) / 2, H - 44), t, font=font(26), fill=(255, 255, 255))
        b = io.BytesIO(); im.save(b, 'JPEG', quality=82)
        out.append(upload(job, b.getvalue(), f'pv-{p}.jpg', 'image/jpeg'))
    return out, n


def cover(job, png):
    from PIL import Image
    im = Image.open(png).convert('RGB'); s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width - s) // 2 + s, (im.height - s) // 2 + s)).resize((1200, 1200), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=88)
    return upload(job, b.getvalue(), 'cover.jpg', 'image/jpeg')


def unlock():
    try: os.remove(LOCK)
    except Exception: pass
    sync()


def main():
    if not KEY: sys.exit('ต้องใส่ CONTENT_KEY')
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('args', nargs='*')
    ap.add_argument('--cover'); ap.add_argument('--listing'); ap.add_argument('--sku', default=''); ap.add_argument('--audio-path', default=''); ap.add_argument('--audio-drive', default=''); ap.add_argument('--summary', default=''); ap.add_argument('--images', nargs='*', default=[])
    a = ap.parse_args()
    if a.cmd == 'queue':
        j = api('factory', query='&status=queued&by=mac')
        sync()
        if j.get('paused'): print('[] # คุณแดนกดหยุดโรงงานไว้บนเว็บ ยังไม่ต้องผลิต'); return
        jobs = j.get('jobs', [])  # เรียงตามที่คุณแดนจัดบนเว็บแล้ว (บนสุด = ผลิตก่อน) ไม่รวมเล่มที่พักไว้
        print(json.dumps([{k: x.get(k) for k in ['id', 'kind', 'lang', 'title', 'category', 'level', 'format', 'amount', 'audience', 'pages', 'price', 'purpose', 'notes', 'ordered_by', 'set_name', 'set_no', 'rush', 'export_no', 'sku']} for x in jobs], ensure_ascii=False, indent=1))
    elif a.cmd == 'claim':
        r = api('factory_claim', {'id': a.args[0], 'by': 'mac'}); print(json.dumps(r, ensure_ascii=False)[:300])
        if r.get('ok'):
            try: open(LOCK, 'w').write(f"{(r.get('job') or {}).get('title', a.args[0])}\n{a.args[0]}")
            except Exception: pass
            sync()
    elif a.cmd == 'done':
        job, pdf = a.args[0], os.path.expanduser(a.args[1])
        body = {'id': job, 'by': 'mac', 'file_url': upload(job, pdf, os.path.basename(pdf).replace(' ', '-'), 'application/pdf'), 'size': os.path.getsize(pdf), 'summary': a.summary, 'sku': a.sku, 'audio_path': a.audio_path, 'audio_drive': a.audio_drive}
        body['images'] = [cover(job, os.path.expanduser(a.cover))] if a.cover else []
        try: body['previews'] = previews(job, pdf)[0]  # หน้าตัวอย่าง 3-6 สำหรับเซลเพจ
        except Exception as e: print('previews', e, file=sys.stderr)
        body['pages'] = page_count(pdf)
        if a.listing: body['listing'] = json.load(open(os.path.expanduser(a.listing), encoding='utf-8'))
        r = api('factory_done', body); print(json.dumps({'ok': r.get('ok'), 'pages': body['pages'], 'file_url': body['file_url']}, ensure_ascii=False))
        if not r.get('ok'): sys.exit(f"แจ้งเสร็จไม่สำเร็จ: {r.get('error')}")
        unlock()
    elif a.cmd == 'done-notion':
        job, url = a.args[0], a.args[1]
        imgs = ([cover(job, os.path.expanduser(a.cover))] if a.cover else []) + [upload(job, os.path.expanduser(p), os.path.basename(p), 'image/png') for p in a.images]
        body = {'id': job, 'by': 'mac', 'notion_url': url, 'images': imgs, 'summary': a.summary}
        if a.listing: body['listing'] = json.load(open(os.path.expanduser(a.listing), encoding='utf-8'))
        r = api('factory_done', body); print(json.dumps({'ok': r.get('ok')}, ensure_ascii=False))
        if not r.get('ok'): sys.exit(f"แจ้งเสร็จไม่สำเร็จ: {r.get('error')}")
    elif a.cmd == 'fail':
        print(json.dumps(api('factory_fail', {'id': a.args[0], 'error': ' '.join(a.args[1:])[:400]}), ensure_ascii=False)[:300])
        unlock()
    else:
        sys.exit('คำสั่ง: queue | claim | done | done-notion | fail')


if __name__ == '__main__':
    main()
