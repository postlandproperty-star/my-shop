"""รูปประกอบคำศัพท์ /vocab (คุณแดน 14 ต.ค. 69: "เอารูปภาพมาใส่ด้วยก็ดี มันจืดชืดไป")
รูปวาดแบบ flat ด้วย fal flux/schnell → JPEG 320px ขึ้น R2 (ไม่ใช้ Supabase)
  คำ:  vocab/w/<slug>.jpg  (เฉพาะคำนาม กริยา คุณศัพท์)  ·  ปกบท: vocab/u/<level>-<id>.jpg
แล้วติดธง img=1 ใน src/vocab/<level>.json · รันซ้ำได้ (ข้ามรูปที่มีบน R2 แล้ว)
ใช้: python3 tools/vocab/images.py [a1 a2 b1 b2] [--limit N]"""
import io, json, re, sys, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'r2'))
import r2

ROOT = Path(__file__).resolve().parents[2]
KEY = (Path.home() / '.config/sheetlab/fal-key').read_text().strip()
# ห้ามใส่คำศัพท์ในเครื่องหมายคำพูดหรือคำว่า flashcard/word ใน prompt (ทดลองแล้ว flux เขียนคำนั้นลงรูป = เฉลยโหมดเดาคำ)
STYLE = 'Flat vector illustration, friendly modern style, soft pastel colors, clean simple shapes, plain light cream background, wordless picture without any writing or lettering.'
PICT = ('noun', 'verb', 'adjective')
slug = lambda w: re.sub(r'[^a-z0-9]+', '-', w.lower()).strip('-')
lock = threading.Lock()


def fal(prompt):
    req = urllib.request.Request('https://fal.run/fal-ai/flux/schnell', data=json.dumps({'prompt': prompt, 'image_size': 'square', 'num_inference_steps': 4, 'enable_safety_checker': True}).encode(),
                                 headers={'Authorization': f'Key {KEY}', 'Content-Type': 'application/json'})
    url = json.load(urllib.request.urlopen(req, timeout=120))['images'][0]['url']
    raw = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
    im = Image.open(io.BytesIO(raw)).convert('RGB').resize((320, 320), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=80, optimize=True); return b.getvalue()


def job(key, prompt, mark):
    try:
        if not r2.exists(key):
            for i in range(2):
                try: r2.put_bytes(fal(prompt), key, 'image/jpeg'); break
                except Exception as e:
                    if i: raise
        with lock: mark()
        return 1
    except Exception as e:
        print('fail', key, str(e)[:120]); return 0


def run(levels, limit):
    for lv in levels:
        p = ROOT / 'src' / 'vocab' / f'{lv}.json'; d = json.loads(p.read_text()); tasks = []
        for u in d['units']:
            if not u.get('img'):
                tasks.append((f'vocab/u/{lv}-{u["id"]}.jpg', f'{STYLE} Scene: {u["t"].lower()}, several related everyday things arranged neatly.', (lambda u=u: u.__setitem__('img', 1))))
            for x in u['words']:
                if x.get('img') or (x.get('pos') or '').split(' ')[0].lower() not in PICT: continue
                tasks.append((f'vocab/w/{slug(x["w"])}.jpg', f'{STYLE} Scene: {x["ex"].rstrip(".")}. ({x["def"].rstrip(".")})', (lambda x=x: x.__setitem__('img', 1))))
        tasks = tasks[:limit] if limit else tasks
        print(lv, len(tasks), 'images', flush=True); n = 0
        with ThreadPoolExecutor(16) as ex:
            for i, ok in enumerate(ex.map(lambda t: job(*t), tasks)):
                n += ok
                if i % 50 == 49:
                    with lock: p.write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
                    print(lv, i + 1, flush=True)
        p.write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':'))); print(lv, 'done', n, flush=True)


if __name__ == '__main__':
    a = sys.argv[1:]; lim = int(a[a.index('--limit') + 1]) if '--limit' in a else 0
    run([x for x in a if x in ('a1', 'a2', 'b1', 'b2')] or ['a1', 'a2', 'b1', 'b2'], lim)
