#!/usr/bin/env python3
"""ReadLab media maker (ทีม ReadLab: น้องพิกเซล ทำการ์ด, น้องรีล ทำคลิป)

การ์ดโพสต์ 4:5 (1080x1350):
  python3 tools/readlab/make.py card spec.json out.png
  spec: {"text": "บรรทัดแรก\\nบรรทัดสอง", "sub": "ชื่อหนังสือ · ผู้เขียน (ไม่บังคับ)", "bg": "ภาพประกอบจาก Canva.jpg (ไม่บังคับ)", "theme": "cream|green|terra"}

คลิป Reels แนวตั้ง (1080x1920) ตัวหนังสือ + ภาพประกอบ + เพลงแต่งเอง ไม่มีเสียงพากย์:
  python3 tools/readlab/make.py reel spec.json out.mp4
  spec: {"slides": [{"text": "...", "sub": "..."}, ...], "bg": ["canva1.jpg", ...], "theme": "cream", "music_mood": "lofi|chill|ukulele"}
  สไลด์แรก = ประโยคหยุดนิ้ว, สไลด์สุดท้ายระบบใส่ "ติดตาม ReadLab" ให้เอง

ข้อความภาษาไทยตัดบรรทัดเองไม่ได้ (ไม่มีเว้นวรรค) ให้ใส่ \\n ตรงที่อยากขึ้นบรรทัดใหม่ บรรทัดละไม่เกินประมาณ 16 ตัวอักษรไทย
ต้องมี: pip install pillow และ ffmpeg (npm i ffmpeg-static ที่รากโปรเจกต์ มีอยู่แล้วใน package.json)
"""
import sys, os, json, subprocess, hashlib, unicodedata
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, '..', 'reel', 'fonts')
sys.path.insert(0, os.path.join(HERE, '..', 'reel'))
THEMES = {  # พื้น, หมึก, สีเน้น
    'cream': ((255, 248, 238), (43, 33, 24), (217, 101, 59)),
    'green': ((47, 93, 80), (255, 248, 238), (242, 196, 120)),
    'terra': ((217, 101, 59), (255, 248, 238), (255, 232, 200)),
}

def font(kind, sz):
    return ImageFont.truetype(os.path.join(FONTS, {'xb': 'Kanit-ExtraBold.ttf', 'sb': 'Kanit-SemiBold.ttf', 'md': 'Kanit-Medium.ttf'}[kind]), sz)

def clusters(s):  # แยกตัวอักษรพร้อมสระบน/ล่างและวรรณยุกต์ ไม่ให้ตัดกลางพยางค์ย่อย
    out = []
    for ch in s:
        if out and (unicodedata.combining(ch) or ch in 'ัิีึืฺุู็่้๊๋์ํ๎ำ'):
            out[-1] += ch
        else:
            out.append(ch)
    return out

def wrap(d, text, f, maxw):
    lines = []
    for para in str(text).split('\n'):
        words, cur = para.split(' '), ''
        for w in words:
            t = (cur + ' ' + w).strip() if cur else w
            if d.textlength(t, font=f) <= maxw: cur = t; continue
            if cur: lines.append(cur); cur = ''
            if d.textlength(w, font=f) <= maxw: cur = w; continue
            for c in clusters(w):  # คำยาวเกินบรรทัด: ตัดตามตัวอักษร
                if d.textlength(cur + c, font=f) > maxw and cur: lines.append(cur); cur = c
                else: cur += c
        lines.append(cur)
    return [l for l in lines if l is not None]

def fit(d, text, kind, start, maxw, maxh, spacing=1.35, minsz=36):
    sz = start
    while sz >= minsz:
        f = font(kind, sz); ls = wrap(d, text, f, maxw)
        if len(ls) * sz * spacing <= maxh: return f, ls, sz
        sz -= 4
    f = font(kind, minsz); return f, wrap(d, text, f, maxw), minsz

def draw_block(d, lines, f, sz, cx, top, fill, spacing=1.35):
    y = top
    for l in lines:
        w = d.textlength(l, font=f); d.text((cx - w / 2, y), l, font=f, fill=fill); y += sz * spacing
    return y

def cover(im, w, h):
    return ImageOps.fit(im.convert('RGB'), (w, h), Image.LANCZOS)

def wordmark(d, x, y, ink, acc, sz=40, anchor='l'):
    f = font('xb', sz); t1, t2 = 'Read', 'Lab'
    w = d.textlength(t1, font=f) + d.textlength(t2, font=f)
    x0 = x - w / 2 if anchor == 'c' else x
    d.text((x0, y), t1, font=f, fill=ink); d.text((x0 + d.textlength(t1, font=f), y), t2, font=f, fill=acc)

def card(spec, out):
    W, H = 1080, 1350
    bgc, ink, acc = THEMES.get(spec.get('theme'), THEMES['cream'])
    im = Image.new('RGB', (W, H), bgc); d = ImageDraw.Draw(im)
    text, sub = str(spec.get('text', '')).strip(), str(spec.get('sub', '') or '').strip()
    if spec.get('bg') and os.path.exists(spec['bg']):
        ih = 640; im.paste(cover(Image.open(spec['bg']), W, ih), (0, 0))
        d.rectangle([0, ih, W, H], fill=bgc)
        d.rounded_rectangle([90, ih - 14, 190, ih + 14], radius=14, fill=acc)
        f, ls, sz = fit(d, text, 'sb', 76, W - 180, H - ih - 250)
        total = len(ls) * sz * 1.35; top = ih + 60 + max(0, (H - ih - 250 - total) / 2)
        y = draw_block(d, ls, f, sz, W / 2, top, ink)
    else:
        d.text((90, 150), '“', font=font('xb', 220), fill=acc)
        f, ls, sz = fit(d, text, 'sb', 88, W - 200, H - 560)
        total = len(ls) * sz * 1.35; top = 380 + max(0, (H - 560 - total) / 2) - 60
        y = draw_block(d, ls, f, sz, W / 2, top, ink)
    if sub:
        fs = font('md', 36); sl = wrap(d, sub, fs, W - 220)[:2]
        draw_block(d, sl, fs, 36, W / 2, min(y + 26, H - 230), acc if spec.get('theme') in (None, 'cream') else ink)
    d.line([90, H - 130, W - 90, H - 130], fill=acc, width=3)
    wordmark(d, W / 2, H - 110, ink, acc, 44, 'c')
    im.save(out, quality=92)
    print(json.dumps({'ok': True, 'out': out, 'lines': len(ls), 'font': sz}, ensure_ascii=False))

def find_ff():
    for c in [os.environ.get('FF'), os.path.join(HERE, '..', '..', 'node_modules/ffmpeg-static/ffmpeg'), 'ffmpeg']:
        if not c: continue
        try: subprocess.run([c, '-version'], capture_output=True, check=True); return c
        except Exception: pass
    raise SystemExit('ffmpeg not found: run `npm i` at repo root (ffmpeg-static) or install ffmpeg')

def slide_png(spec, i, s, bgpath, path, last=False):
    W, H = 1080, 1920
    bgc, ink, acc = THEMES.get(spec.get('theme'), THEMES['cream'])
    if bgpath and os.path.exists(bgpath):
        im = cover(Image.open(bgpath), W, H).filter(ImageFilter.GaussianBlur(3))
        veil = Image.new('RGB', (W, H), bgc); im = Image.blend(im, veil, 0.55)
    else:
        im = Image.new('RGB', (W, H), bgc)
    d = ImageDraw.Draw(im)
    box = [80, 520, W - 80, 1400]
    d.rounded_rectangle(box, radius=48, fill=bgc, outline=acc, width=4)
    text = s.get('text', '')
    f, ls, sz = fit(d, text, 'xb' if i == 0 or last else 'sb', 96 if i == 0 else 80, box[2] - box[0] - 120, box[3] - box[1] - 200)
    total = len(ls) * sz * 1.35; top = box[1] + (box[3] - box[1] - total) / 2 - (30 if s.get('sub') else 0)
    y = draw_block(d, ls, f, sz, W / 2, top, ink)
    if s.get('sub'):
        fs = font('md', 44); draw_block(d, wrap(d, s['sub'], fs, box[2] - box[0] - 140)[:2], fs, 44, W / 2, y + 20, acc)
    wordmark(d, W / 2, 1560, ink if not bgpath else ink, acc, 64, 'c')
    if not last and spec.get('count', True):
        n = len(spec['slides']); d.text((W / 2 - 40, 400), f'{i + 1}/{n}', font=font('md', 44), fill=acc)
    im.save(path)

def reel(spec, out):
    FF = find_ff(); work = os.path.join(os.path.dirname(os.path.abspath(out)) or '.', '.readlab_work'); os.makedirs(work, exist_ok=True)
    slides = list(spec.get('slides') or [])[:8]
    if not slides: raise SystemExit('ต้องมี slides อย่างน้อย 1 สไลด์')
    slides.append({'text': spec.get('outro', 'ติดตาม ReadLab\nอ่านวันละนิด ชีวิตเปลี่ยนเยอะ'), 'sub': spec.get('outro_sub', 'กดติดตามไว้ อ่านไปด้วยกัน')})
    bgs = spec.get('bg') or []; segs = []
    for i, s in enumerate(slides):
        png = os.path.join(work, f's{i:02d}.png'); last = i == len(slides) - 1
        slide_png(spec, i, s, bgs[i % len(bgs)] if bgs else None, png, last)
        dur = max(2.6, min(6.0, 1.4 + len(str(s.get('text', ''))) * 0.075)) if not last else 3.0
        seg = os.path.join(work, f's{i:02d}.mp4')
        vf = (f"scale=1188:2112,zoompan=z='min(zoom+0.0006,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,"
              f"fade=t=in:st=0:d=0.35,fade=t=out:st={dur - 0.35:.2f}:d=0.35,format=yuv420p")
        subprocess.run([FF, '-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', png, '-t', f'{dur:.2f}', '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', '30', seg], check=True)
        segs.append((seg, dur))
    lst = os.path.join(work, 'list.txt'); open(lst, 'w').write(''.join(f"file '{os.path.abspath(s)}'\n" for s, _ in segs))
    vid = os.path.join(work, 'video.mp4'); subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', vid], check=True)
    D = sum(d for _, d in segs)
    import sound
    mpath = os.path.join(work, 'music.wav'); seed = int(hashlib.md5(json.dumps(slides, ensure_ascii=False).encode()).hexdigest()[:8], 16)
    mood = sound.make_music(mpath, spec.get('music_mood', 'lofi'), seed)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', vid, '-stream_loop', '-1', '-i', mpath, '-filter_complex',
                    f"[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.7,atrim=0:{D:.2f},afade=t=in:st=0:d=1.0,afade=t=out:st={max(0, D - 2):.2f}:d=2.0[a]",
                    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', f'{D:.2f}', '-movflags', '+faststart', out], check=True)
    print(json.dumps({'ok': True, 'out': out, 'slides': len(slides), 'duration': round(D, 1), 'bytes': os.path.getsize(out), 'music': f'แต่งขึ้นเองอัตโนมัติ แนว {mood} ไม่มีลิขสิทธิ์ผู้อื่น'}, ensure_ascii=False))

if __name__ == '__main__':
    if len(sys.argv) != 4 or sys.argv[1] not in ('card', 'reel'): raise SystemExit(__doc__)
    spec = json.load(open(sys.argv[2], encoding='utf-8'))
    (card if sys.argv[1] == 'card' else reel)(spec, sys.argv[3])
