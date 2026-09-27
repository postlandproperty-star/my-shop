#!/usr/bin/env python3
"""SheetLab reel builder: spec.json -> vertical mp4 1080x1920 (photo + question + answer + mascot + Thai voice-over)
usage: python3 tools/reel/build.py spec.json out.mp4
env: CONTENT_KEY (required, x-content-key of the shop API), API_BASE, FF (ffmpeg path), VOICE (ElevenLabs voice id), SPEED
needs: pip install pillow ; npm i ffmpeg-static (inside tools/reel) or ffmpeg on PATH
"""
import sys, os, json, re, subprocess, urllib.request, urllib.parse, hashlib
from PIL import Image, ImageDraw, ImageFont, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__))
API = os.environ.get('API_BASE', 'https://my-shop-lake-ten.vercel.app/api/content')
KEY = os.environ.get('CONTENT_KEY', '')
VOICE = os.environ.get('VOICE', 'J5M1BLQpOJ3qx2FU6EG0')  # เสียงประจำที่คุณแดนเลือก (ElevenLabs)
SPEED = float(os.environ.get('SPEED', '1.0'))
W, H = 1080, 1920
BG = (43, 71, 240); WHITE = (255, 255, 255); INK = (26, 26, 26); RED = (239, 91, 76); YEL = (245, 197, 24); GREEN = (22, 163, 74); BLUE = (43, 71, 240)
UA = {'User-Agent': 'Mozilla/5.0 (SheetLab reel builder)'}

def find_ff():
    for c in [os.environ.get('FF'), os.path.join(HERE, 'node_modules/ffmpeg-static/ffmpeg'), 'ffmpeg']:
        if not c: continue
        try: subprocess.run([c, '-version'], capture_output=True, check=True); return c
        except Exception: pass
    raise SystemExit('ffmpeg not found: run `npm i ffmpeg-static` inside tools/reel or install ffmpeg')

def font(kind, sz):
    p = {'xb': 'Kanit-ExtraBold.ttf', 'sb': 'Kanit-SemiBold.ttf', 'md': 'Kanit-Medium.ttf'}[kind]
    return ImageFont.truetype(os.path.join(HERE, 'fonts', p), sz)

def http(url, data=None, headers=None, timeout=60):
    req = urllib.request.Request(url, data=data, headers={**UA, **(headers or {})}, method='POST' if data else 'GET')
    return urllib.request.urlopen(req, timeout=timeout).read()

CACHE = os.path.join(HERE, '.cache'); os.makedirs(CACHE, exist_ok=True)
def cached(url, ext):
    fn = os.path.join(CACHE, hashlib.md5(url.encode()).hexdigest() + ext)
    if not os.path.exists(fn): open(fn, 'wb').write(http(url))
    return fn

def mascot(expr):
    base = 'https://api.dicebear.com/9.x/avataaars/png?size=700&facialHairProbability=0&accessoriesProbability=0&seed=pen&top=straight01&hairColor=4a312c&clothing=hoodie&clothesColor=3c4f5c&skinColor=ffdbb4&backgroundColor=transparent&'
    q = 'eyes=happy&eyebrows=defaultNatural&mouth=smile' if expr == 'happy' else 'eyes=default&eyebrows=raisedExcited&mouth=serious'
    return Image.open(cached(base + q, '.png')).convert('RGBA').resize((420, 420))

def find_image(query, avoid=()):
    """Openverse search, commercial licenses only. Returns (path, credit) or (None, None)."""
    for src in ['wikimedia', '']:
        url = 'https://api.openverse.org/v1/images/?q=' + urllib.parse.quote(query) + '&license_type=commercial&page_size=8' + ('&source=' + src if src else '')
        try: res = json.loads(http(url, timeout=30)).get('results', [])
        except Exception: res = []
        for r in res:
            title = (r.get('title') or '').lower()
            if any(a in title for a in avoid): continue
            try:
                data = http(r['url'], timeout=40)
                if len(data) < 15000: continue
                fn = os.path.join(CACHE, hashlib.md5(r['url'].encode()).hexdigest() + '.img'); open(fn, 'wb').write(data)
                Image.open(fn).verify()
                return fn, f"{r.get('title', '')} | {r.get('creator', '')} | {r.get('license', '')} | {r.get('foreign_landing_url', '')}"
            except Exception: continue
    return None, None

def placeholder(word):
    im = Image.new('RGB', (880, 880), (240, 244, 255)); d = ImageDraw.Draw(im); f = font('xb', 140)
    while d.textlength(word, font=f) > 800: f = font('xb', f.size - 8)
    d.text((440, 440), word, font=f, fill=BLUE, anchor='mm'); return im

def base():
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    d.rounded_rectangle((60, 70, 400, 160), radius=45, fill=WHITE, outline=INK, width=4)
    d.text((230, 115), 'SheetLab', font=font('xb', 44), fill=INK, anchor='mm')
    return im, d

def center_text(d, y, text, f, fill=INK, spacing=14):
    for i, l in enumerate(text.split('\n')): d.text((W // 2, y + i * (f.size + spacing)), l, font=f, fill=fill, anchor='ma')

def photo_card(im, src, top=260, size=880):
    ph = src if isinstance(src, Image.Image) else Image.open(src).convert('RGB')
    ph = ImageOps.fit(ph.convert('RGB'), (size, size), method=Image.LANCZOS)
    mask = Image.new('L', (size, size), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=48, fill=255)
    fm = Image.new('L', (size + 24, size + 24), 0); ImageDraw.Draw(fm).rounded_rectangle((0, 0, size + 24, size + 24), radius=56, fill=255)
    x = (W - size) // 2
    im.paste(Image.new('RGB', (size + 24, size + 24), WHITE), (x - 12, top - 12), fm); im.paste(ph, (x, top), mask)

def counter(d, i, n):
    d.rounded_rectangle((W - 300, 70, W - 60, 160), radius=45, fill=YEL); d.text((W - 180, 115), f'{i}/{n}', font=font('xb', 44), fill=INK, anchor='mm')

def fit_font(d, text, kind, start, maxw):
    f = font(kind, start)
    while d.textlength(text, font=f) > maxw and f.size > 40: f = font(kind, f.size - 6)
    return f

def main():
    if len(sys.argv) < 3: raise SystemExit(__doc__)
    spec = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]
    global OUTDIR; OUTDIR = os.path.join(os.path.dirname(os.path.abspath(out)) or '.', '.reel_work'); os.makedirs(OUTDIR, exist_ok=True)
    FF = find_ff(); m_happy, m_think = mascot('happy'), mascot('think')
    items = spec['items']; n = len(items); slides = []; credits = []
    hook = spec.get('hook', {})
    im, d = base(); d.rounded_rectangle((90, 520, W - 90, 1240), radius=60, fill=WHITE)
    center_text(d, 590, hook.get('top', 'ของใกล้ตัว'), fit_font(d, hook.get('top', ''), 'xb', 120, 860))
    center_text(d, 760, hook.get('big', f'{n} อย่าง'), font('xb', 150), fill=RED)
    center_text(d, 960, hook.get('sub', 'ที่คุณเรียก\nภาษาอังกฤษไม่ถูก'), font('sb', 84), spacing=20)
    im.paste(m_think, (W // 2 - 210, 1300), m_think); center_text(d, 1740, hook.get('foot', 'ลองทายดู'), font('md', 64), fill=WHITE)
    p = os.path.join(OUTDIR, 's00.png'); im.save(p); slides.append((p, hook.get('tts', f"ของใกล้ตัว {n} อย่าง ที่คุณเรียกภาษาอังกฤษไม่ถูก ลองทายดู"), 3.0))
    qtext = spec.get('question', 'อันนี้ภาษาอังกฤษ\nเรียกว่าอะไร?')
    for i, it in enumerate(items, 1):
        path, credit = (None, None) if it.get('image') is None and not it.get('query') else (find_image(it.get('query') or it['en']) if not it.get('image') else (it['image'], 'provided'))
        src = path or placeholder(it['en']); credits.append(credit or 'placeholder')
        im, d = base(); counter(d, i, n); photo_card(im, src)
        d.rounded_rectangle((90, 1210, W - 90, 1440), radius=48, fill=WHITE); center_text(d, 1250, it.get('question', qtext), font('xb', 70), spacing=10)
        im.paste(m_think, (W - 460, 1470), m_think)
        d.rounded_rectangle((90, 1560, 600, 1680), radius=40, fill=YEL); d.text((345, 1620), it.get('nudge', 'คิดออกไหม?'), font=font('xb', 52), fill=INK, anchor='mm')
        p = os.path.join(OUTDIR, f's{i:02d}q.png'); im.save(p); slides.append((p, it.get('q_tts', 'อันนี้ภาษาอังกฤษเรียกว่าอะไร' if i == 1 else 'แล้วอันนี้ล่ะ'), 2.6))
        im, d = base(); counter(d, i, n); photo_card(im, src)
        d.rounded_rectangle((90, 1210, W - 90, 1480), radius=48, fill=WHITE)
        d.rounded_rectangle((W // 2 - 110, 1180, W // 2 + 110, 1250), radius=35, fill=RED); d.text((W // 2, 1215), 'เฉลย', font=font('xb', 40), fill=WHITE, anchor='mm')
        d.text((W // 2, 1268), it['en'], font=fit_font(d, it['en'], 'xb', 110, W - 220), fill=BLUE, anchor='ma')
        center_text(d, 1412, it['th'], fit_font(d, it['th'], 'sb', 54, W - 220))
        im.paste(m_happy, (W - 460, 1500), m_happy)
        d.rounded_rectangle((90, 1600, 640, 1720), radius=40, fill=GREEN); d.text((365, 1660), it.get('after', 'จำไว้นะ'), font=font('xb', 52), fill=WHITE, anchor='mm')
        p = os.path.join(OUTDIR, f's{i:02d}a.png'); im.save(p); slides.append((p, it.get('a_tts', f"{it['en']} {it['th']}"), 3.0))
    end = spec.get('end', {})
    im, d = base(); d.rounded_rectangle((90, 480, W - 90, 1180), radius=60, fill=WHITE)
    center_text(d, 560, end.get('line1', 'ทายถูกกี่ข้อ?'), font('xb', 110)); center_text(d, 720, end.get('line2', 'คอมเมนต์บอกหน่อย'), font('sb', 70))
    d.rounded_rectangle((200, 900, W - 200, 1060), radius=60, fill=RED); d.text((W // 2, 980), end.get('cta', 'กดติดตาม มีทุกวัน'), font=font('xb', 62), fill=WHITE, anchor='mm')
    im.paste(m_happy, (W // 2 - 210, 1240), m_happy); center_text(d, 1700, end.get('foot', 'SheetLab · ภาษาอังกฤษแบบคนจริงใช้'), font('md', 50), fill=WHITE)
    p = os.path.join(OUTDIR, 's99.png'); im.save(p); slides.append((p, end.get('tts', 'ทายถูกกี่ข้อ คอมเมนต์บอกหน่อย กดติดตามไว้ มีทุกวันนะ'), 3.2))
    if not KEY: raise SystemExit('CONTENT_KEY missing')
    def tts(text, k):
        j = json.loads(http(API + '?action=tts', data=json.dumps({'text': text, 'voice': VOICE, 'speed': SPEED}).encode(), headers={'Content-Type': 'application/json', 'x-content-key': KEY}, timeout=120))
        if not j.get('ok'): raise SystemExit('tts failed: ' + str(j))
        fn = os.path.join(OUTDIR, f't{k:02d}.mp3'); open(fn, 'wb').write(http(j['url'])); return fn
    def dur(path):
        r = subprocess.run([FF, '-i', path], capture_output=True, text=True); m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr); return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
    segs = []; chars = 0
    for k, (png, text, mind) in enumerate(slides):
        a = tts(text, k); chars += len(text); D = max(mind, dur(a) + 0.7); seg = os.path.join(OUTDIR, f'seg{k:02d}.mp4')
        subprocess.run([FF, '-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', png, '-i', a, '-filter_complex',
                        "[1:a]apad[a];[0:v]scale=1296:2304,zoompan=z='min(zoom+0.0004,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,fade=t=in:st=0:d=0.25,format=yuv420p[v]",
                        '-map', '[v]', '-map', '[a]', '-t', f'{D:.2f}', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', seg], check=True)
        segs.append(seg)
    lst = os.path.join(OUTDIR, 'list.txt'); open(lst, 'w').write(''.join(f"file '{os.path.abspath(s)}'\n" for s in segs))
    subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', out], check=True)
    print(json.dumps({'ok': True, 'out': out, 'duration': round(dur(out), 1), 'bytes': os.path.getsize(out), 'items': n, 'tts_chars': chars, 'image_credits': credits}, ensure_ascii=False))

if __name__ == '__main__': main()
