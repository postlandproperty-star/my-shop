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
MODEL = os.environ.get('MODEL', 'eleven_v3')  # โมเดลเสียง ElevenLabs (eleven_v3 / eleven_turbo_v2_5 / eleven_flash_v2_5)
DRY = os.environ.get('DRY') == '1'  # DRY=1: เลือกรูป+วาดสไลด์อย่างเดียว ไม่สร้างเสียง ไม่ตัดต่อ (ไว้ตรวจรูปก่อน)
W, H = 1080, 1920
BG = (43, 71, 240); WHITE = (255, 255, 255); INK = (26, 26, 26); RED = (239, 91, 76); YEL = (245, 197, 24); GREEN = (22, 163, 74); BLUE = (43, 71, 240)
UA = {'User-Agent': 'Mozilla/5.0 (SheetLab reel builder)'}

def find_ff():
    for c in [os.environ.get('FF'), os.path.join(HERE, 'node_modules/ffmpeg-static/ffmpeg'), os.path.join(HERE, '..', '..', 'node_modules/ffmpeg-static/ffmpeg'), 'ffmpeg']:
        if not c: continue
        try: subprocess.run([c, '-version'], capture_output=True, check=True); return c
        except Exception: pass
    raise SystemExit('ffmpeg not found: run `npm i ffmpeg-static` inside tools/reel or install ffmpeg')

def font(kind, sz):
    p = {'xb': 'Kanit-ExtraBold.ttf', 'sb': 'Kanit-SemiBold.ttf', 'md': 'Kanit-Medium.ttf'}[kind]
    return ImageFont.truetype(os.path.join(HERE, 'fonts', p), sz)

def http(url, data=None, headers=None, timeout=60, tries=3):
    import time
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={**UA, **(headers or {})}, method='POST' if data else 'GET')
            return urllib.request.urlopen(req, timeout=timeout).read()
        except Exception as e:
            last = e; time.sleep(2 + i * 3)
    raise last

CACHE = os.path.join(HERE, '.cache'); os.makedirs(CACHE, exist_ok=True)
def cached(url, ext):
    fn = os.path.join(CACHE, hashlib.md5(url.encode()).hexdigest() + ext)
    if not os.path.exists(fn) or os.path.getsize(fn) < 500:
        data = http(url)
        if len(data) < 500: raise SystemExit('download too small: ' + url)
        open(fn, 'wb').write(data)
    return fn

def mascot(expr):
    base = 'https://api.dicebear.com/9.x/avataaars/png?size=700&facialHairProbability=0&accessoriesProbability=100&accessories=wayfarers&accessoriesColor=262e33&seed=clip&top=shortWaved&hairColor=2c1b18&clothing=shirtVNeck&clothesColor=25557c&skinColor=edb98a&backgroundColor=transparent&'  # มาสคอต = น้องคลิป (ผู้ชาย ให้ตรงกับเสียงพากย์)
    q = 'eyes=happy&eyebrows=defaultNatural&mouth=smile' if expr == 'happy' else 'eyes=default&eyebrows=raisedExcited&mouth=serious'
    return Image.open(cached(base + q, '.png')).convert('RGBA').resize((420, 420))

def find_image(query, avoid=()):
    """Openverse search, commercial licenses only. Returns (path, credit) or (None, None)."""
    for src in ['wikimedia', '']:
        url = 'https://api.openverse.org/v1/images/?q=' + urllib.parse.quote(query) + '&license_type=commercial&page_size=8' + ('&source=' + src if src else '')
        try: res = json.loads(http(url, timeout=30)).get('results', [])
        except Exception: res = []
        toks = [t for t in re.split(r'\W+', query.lower()) if len(t) > 2]
        scored = []
        for r in res:
            title = (r.get('title') or '').lower() + ' ' + ' '.join(t.get('name', '') if isinstance(t, dict) else str(t) for t in (r.get('tags') or [])[:15]).lower()
            if any(a in title for a in avoid): continue
            hit = sum(1 for t in toks if t in title)
            if hit: scored.append((-hit, r))
        scored.sort(key=lambda x: x[0])
        for _, r in scored:
            title = (r.get('title') or '').lower()
            try:
                data = http(r['url'], timeout=40)
                if len(data) < 15000: continue
                fn = os.path.join(CACHE, hashlib.md5(r['url'].encode()).hexdigest() + '.img'); open(fn, 'wb').write(data)
                Image.open(fn).verify()
                return fn, f"{r.get('title', '')} | {r.get('creator', '')} | {r.get('license', '')} | {r.get('foreign_landing_url', '')}"
            except Exception: continue
    return None, None

def fetch_image_id(oid):
    """รูปที่เลือกเองจาก Openverse ด้วย id (ใช้เมื่อค้นอัตโนมัติได้รูปผิด) -> (path, credit)"""
    r = json.loads(http('https://api.openverse.org/v1/images/' + oid + '/', timeout=30))
    data = http(r['url'], timeout=40)
    fn = os.path.join(CACHE, hashlib.md5(r['url'].encode()).hexdigest() + '.img'); open(fn, 'wb').write(data); Image.open(fn).verify()
    return fn, f"{r.get('title', '')} | {r.get('creator', '')} | {r.get('license', '')} | {r.get('foreign_landing_url', '')}"

def candidates(query, out):
    """python3 build.py candidates "spoon rest" sheet.png -> แผ่นรวมรูปตัวเลือก 8 รูป (มีเลข 1-8) + JSON รายการ id ให้เลือกใส่ image_id ใน spec"""
    url = 'https://api.openverse.org/v1/images/?q=' + urllib.parse.quote(query) + '&license_type=commercial&page_size=8'
    res = json.loads(http(url, timeout=30)).get('results', [])
    sheet = Image.new('RGB', (4 * 300, 2 * 330), (255, 255, 255)); d = ImageDraw.Draw(sheet); f = font('xb', 40); rows = []
    for i, r in enumerate(res[:8]):
        x, y = (i % 4) * 300, (i // 4) * 330
        try:
            im = Image.open(__import__('io').BytesIO(http(r.get('thumbnail') or r['url'], timeout=30))).convert('RGB')
            sheet.paste(ImageOps.fit(im, (280, 280)), (x + 10, y + 40))
        except Exception: d.text((x + 150, y + 180), 'โหลดไม่ได้', font=font('md', 30), fill=RED, anchor='mm')
        d.text((x + 10, y + 2), str(i + 1), font=f, fill=RED)
        rows.append({'n': i + 1, 'image_id': r['id'], 'title': (r.get('title') or '')[:80], 'source': r.get('source'), 'license': r.get('license')})
    sheet.save(out); print(json.dumps({'ok': True, 'sheet': out, 'candidates': rows, 'how': 'ดูรูปใน sheet แล้วใส่ image_id ของรูปที่ถูกต้องในข้อนั้นของ spec.json'}, ensure_ascii=False))

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

def make_music(path, mood='upbeat', seed=0):
    """เพลงประกอบที่แต่งขึ้นเองด้วยโค้ด (คีย์/ทำนองสุ่มตาม seed) ไม่มีลิขสิทธิ์คนอื่น ไม่ต้องให้เครดิต ไม่ต้องโหลดจากเน็ต
    ยาว 8 ห้อง แล้วให้ ffmpeg วนเล่น: คีย์บอร์ด + เบส + กลอง + ทำนองกระดิ่งห้อง 5-8  mood: upbeat | chill"""
    import math, random, wave, array
    rnd = random.Random(seed); sr = 22050
    chill = mood == 'chill'
    bpm = rnd.choice([80, 84, 88]) if chill else rnd.choice([100, 104, 108])
    beat = 60.0 / bpm; bars = 8; total = int(sr * beat * 4 * bars) + sr
    buf = array.array('f', bytes(4 * total))
    root = rnd.choice([261.63, 293.66, 329.63, 349.23, 392.00])  # C D E F G
    hz = lambda semi, octv=0: root * (2 ** (semi / 12.0 + octv))
    prog = [(9, 'm'), (5, ''), (0, ''), (7, '')] if chill else rnd.choice([[(0, ''), (7, ''), (9, 'm'), (5, '')], [(0, ''), (5, ''), (9, 'm'), (7, '')]])
    def add(t0, dur, fn, amp):
        i0 = int(t0 * sr); n = min(int(dur * sr), total - i0)
        for i in range(max(0, n)):
            buf[i0 + i] += amp * fn(i / sr)
    def keys(f):
        return lambda t: (math.sin(2 * math.pi * f * t) + 0.3 * math.sin(4 * math.pi * f * t)) * math.exp(-2.4 * t) * min(1, t * 200)
    def bass(f):
        return lambda t: (math.sin(2 * math.pi * f * t) + 0.25 * math.sin(4 * math.pi * f * t)) * math.exp(-3.0 * t) * min(1, t * 300)
    def kick(t):
        return math.sin(2 * math.pi * (45 * t + 2.2 * (1 - math.exp(-28 * t)))) * math.exp(-9 * t)
    def noise(decay):
        last = [0.0]
        def f(t):
            x = rnd.uniform(-1, 1); y = x - last[0]; last[0] = x  # high-pass อย่างง่าย ให้เสียงแหลมแบบฉาบ
            return y * math.exp(-decay * t)
        return f
    def bell(f):
        return lambda t: (math.sin(2 * math.pi * f * t) + 0.2 * math.sin(6 * math.pi * f * t)) * math.exp(-4.5 * t) * min(1, t * 400)
    penta = [0, 2, 4, 7, 9]
    for b in range(bars):
        t = b * 4 * beat; semi, q = prog[b % 4]; tri = [0, 3, 7] if q == 'm' else [0, 4, 7]
        for hit in ([0, 2.5] if not chill else [0]):
            for x in tri: add(t + hit * beat, 1.6, keys(hz(semi + x)), 0.10 if not chill else 0.12)
        for hit in ([0, 2, 3.5] if not chill else [0, 2]): add(t + hit * beat, 0.9, bass(hz(semi, -2)), 0.32)
        for hit in ([0, 2] if chill else [0, 1.5, 2]): add(t + hit * beat, 0.45, kick, 0.55 if not chill else 0.4)
        for hit in (1, 3): add(t + hit * beat, 0.25, noise(16), 0.10 if not chill else 0.06)
        for e in range(8):
            if chill and e % 2 == 0: continue
            add(t + e * beat / 2, 0.08, noise(70), 0.05)
        if b >= 4:  # ทำนองช่วงหลัง
            pos = 0.0
            while pos < 4:
                step = rnd.choice([0.5, 1, 1, 1.5]) if not chill else rnd.choice([1, 1.5, 2])
                if rnd.random() < 0.8: add(t + pos * beat, 1.2, bell(hz(rnd.choice(penta) + 12)), 0.09)
                pos += step
    peak = max(1e-6, max(abs(v) for v in buf)); g = 0.9 / peak
    pcm = array.array('h', (int(max(-1, min(1, v * g)) * 32767) for v in buf))
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
    return path

def main():
    if len(sys.argv) < 3: raise SystemExit(__doc__)
    spec = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]
    global OUTDIR; OUTDIR = os.path.join(os.path.dirname(os.path.abspath(out)) or '.', '.reel_work'); os.makedirs(OUTDIR, exist_ok=True)
    STYLE = spec.get('style', 'photo')  # photo = สไลด์รูปนิ่งซูมช้า | motion = การ์ดเลื่อนเข้า + เสียงเอฟเฟกต์ + เพลงประกอบ
    MOTION = STYLE == 'motion'
    FF = None if DRY else find_ff(); m_happy, m_think = mascot('happy'), mascot('think')
    items = spec['items']; n = len(items); slides = []; credits = []
    def layers():
        # photo: วาดทุกอย่างบนภาพเดียว | motion: bg (พื้น+รูป) แยกจาก fg (การ์ด+มาสคอต โปร่งใส) เพื่อให้ ffmpeg เลื่อน fg เข้ามาได้
        im, d = base()
        if not MOTION: return im, d, im, d
        fg = Image.new('RGBA', (W, H), (0, 0, 0, 0)); return im, d, fg, ImageDraw.Draw(fg)
    def save(tag, im, fg, text, mind, kind):
        p = os.path.join(OUTDIR, f'{tag}.png')
        if MOTION:
            comp = im.copy(); comp.paste(fg, (0, 0), fg); comp.save(p)
            pb, pf = os.path.join(OUTDIR, f'{tag}_bg.png'), os.path.join(OUTDIR, f'{tag}_fg.png'); im.save(pb); fg.save(pf)
            slides.append((p, text, mind, kind, pb, pf))
        else:
            im.save(p); slides.append((p, text, mind, kind, p, None))
    hook = spec.get('hook', {})
    im, d, fg, fd = layers(); fd.rounded_rectangle((90, 520, W - 90, 1240), radius=60, fill=WHITE)
    center_text(fd, 590, hook.get('top', 'ของใกล้ตัว'), fit_font(fd, hook.get('top', ''), 'xb', 120, 860))
    center_text(fd, 760, hook.get('big', f'{n} อย่าง'), font('xb', 150), fill=RED)
    center_text(fd, 960, hook.get('sub', 'ที่คุณเรียก\nภาษาอังกฤษไม่ถูก'), font('sb', 84), spacing=20)
    fg.paste(m_think, (W // 2 - 210, 1300), m_think); center_text(d, 1740, hook.get('foot', 'ลองทายดู'), font('md', 64), fill=WHITE)
    save('s00', im, fg, hook.get('tts', f"ของใกล้ตัว {n} อย่าง ที่คุณเรียกภาษาอังกฤษไม่ถูก ลองทายดู"), 3.0, 'hook')
    qtext = spec.get('question', 'อันนี้ภาษาอังกฤษ\nเรียกว่าอะไร?')
    for i, it in enumerate(items, 1):
        if it.get('image'): path, credit = it['image'], 'provided'
        elif it.get('image_id'): path, credit = fetch_image_id(it['image_id'])
        elif it.get('query') or it.get('en'): path, credit = find_image(it.get('query') or it['en'])
        else: path, credit = None, None
        src = path or placeholder(it['en']); credits.append(credit or 'placeholder')
        im, d, fg, fd = layers(); counter(d, i, n); photo_card(im, src)
        fd.rounded_rectangle((90, 1210, W - 90, 1440), radius=48, fill=WHITE); center_text(fd, 1250, it.get('question', qtext), font('xb', 70), spacing=10)
        fg.paste(m_think, (W - 460, 1470), m_think)
        fd.rounded_rectangle((90, 1560, 600, 1680), radius=40, fill=YEL); fd.text((345, 1620), it.get('nudge', 'คิดออกไหม?'), font=font('xb', 52), fill=INK, anchor='mm')
        save(f's{i:02d}q', im, fg, it.get('q_tts', 'อันนี้ภาษาอังกฤษเรียกว่าอะไร' if i == 1 else 'แล้วอันนี้ล่ะ'), 2.6, 'q')
        im, d, fg, fd = layers(); counter(d, i, n); photo_card(im, src)
        fd.rounded_rectangle((90, 1210, W - 90, 1480), radius=48, fill=WHITE)
        fd.rounded_rectangle((W // 2 - 110, 1180, W // 2 + 110, 1250), radius=35, fill=RED); fd.text((W // 2, 1215), 'เฉลย', font=font('xb', 40), fill=WHITE, anchor='mm')
        fd.text((W // 2, 1268), it['en'], font=fit_font(fd, it['en'], 'xb', 110, W - 220), fill=BLUE, anchor='ma')
        center_text(fd, 1412, it['th'], fit_font(fd, it['th'], 'sb', 54, W - 220))
        fg.paste(m_happy, (W - 460, 1500), m_happy)
        fd.rounded_rectangle((90, 1600, 640, 1720), radius=40, fill=GREEN); fd.text((365, 1660), it.get('after', 'จำไว้นะ'), font=font('xb', 52), fill=WHITE, anchor='mm')
        save(f's{i:02d}a', im, fg, it.get('a_tts', f"{it['en']} {it['th']}"), 3.0, 'a')
    end = spec.get('end', {})
    im, d, fg, fd = layers(); fd.rounded_rectangle((90, 480, W - 90, 1180), radius=60, fill=WHITE)
    center_text(fd, 560, end.get('line1', 'ทายถูกกี่ข้อ?'), font('xb', 110)); center_text(fd, 720, end.get('line2', 'คอมเมนต์บอกหน่อย'), font('sb', 70))
    fd.rounded_rectangle((200, 900, W - 200, 1060), radius=60, fill=RED); fd.text((W // 2, 980), end.get('cta', 'กดติดตาม มีทุกวัน'), font=font('xb', 62), fill=WHITE, anchor='mm')
    fg.paste(m_happy, (W // 2 - 210, 1240), m_happy); center_text(d, 1700, end.get('foot', 'SheetLab · ภาษาอังกฤษแบบคนจริงใช้'), font('md', 50), fill=WHITE)
    save('s99', im, fg, end.get('tts', 'ทายถูกกี่ข้อ คอมเมนต์บอกหน่อย กดติดตามไว้ มีทุกวันนะ'), 3.2, 'end')
    if DRY:
        print(json.dumps({'ok': True, 'dry': True, 'style': STYLE, 'slides': [sl[0] for sl in slides], 'image_credits': credits, 'check': 'เปิดดูสไลด์ที่ลงท้าย q.png ทุกใบว่ารูปตรงกับของจริงไหม แล้วค่อยรันเต็ม'}, ensure_ascii=False)); return
    if not KEY: raise SystemExit('CONTENT_KEY missing')
    def tts(text, k):
        # เสียงเก็บแคชตามข้อความ+เสียง ถ้าสร้างซ้ำด้วยข้อความเดิมจะไม่เสียเครดิตอีก
        cfn = os.path.join(CACHE, 'tts-' + hashlib.md5(f'{VOICE}|{SPEED}|{MODEL}|{text}'.encode()).hexdigest() + '.mp3')
        if not os.path.exists(cfn) or os.path.getsize(cfn) < 1000:
            j = json.loads(http(API + '?action=tts', data=json.dumps({'text': text, 'voice': VOICE, 'speed': SPEED, 'model': MODEL}).encode(), headers={'Content-Type': 'application/json', 'x-content-key': KEY}, timeout=120))
            if not j.get('ok'): raise SystemExit('tts failed: ' + str(j))
            open(cfn, 'wb').write(http(j['url']))
        fn = os.path.join(OUTDIR, f't{k:02d}.mp3'); open(fn, 'wb').write(open(cfn, 'rb').read()); return fn
    def dur(path):
        r = subprocess.run([FF, '-i', path], capture_output=True, text=True); m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr); return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
    sfx = {}
    if MOTION:
        # เสียงเอฟเฟกต์สังเคราะห์เอง (ไม่ต้องดาวน์โหลด): วูช ตอนการ์ดเลื่อนเข้า / ติ๊ง ตอนเฉลย
        sfx['whoosh'] = os.path.join(OUTDIR, 'whoosh.wav'); sfx['ding'] = os.path.join(OUTDIR, 'ding.wav')
        subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=0.4:c=pink:r=44100', '-af', 'lowpass=f=1800,afade=t=in:st=0:d=0.12,afade=t=out:st=0.18:d=0.22,volume=0.5', sfx['whoosh']], check=True)
        subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=1318:duration=0.5:sample_rate=44100', '-f', 'lavfi', '-i', 'sine=frequency=1975:duration=0.5:sample_rate=44100', '-filter_complex', '[0:a][1:a]amix=inputs=2:normalize=0,afade=t=out:st=0.05:d=0.45,volume=0.6[a]', '-map', '[a]', sfx['ding']], check=True)
    segs = []; chars = 0
    for k, (png, text, mind, kind, pb, pf) in enumerate(slides):
        a = tts(text, k); chars += len(text); D = max(mind, dur(a) + (1.0 if MOTION else 0.7)); seg = os.path.join(OUTDIR, f'seg{k:02d}.mp4')
        if not MOTION:
            subprocess.run([FF, '-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', png, '-i', a, '-filter_complex',
                            "[1:a]apad[a];[0:v]scale=1296:2304,zoompan=z='min(zoom+0.0004,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,fade=t=in:st=0:d=0.25,format=yuv420p[v]",
                            '-map', '[v]', '-map', '[a]', '-t', f'{D:.2f}', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', seg], check=True)
        else:
            fx = sfx['ding'] if kind == 'a' else sfx['whoosh']
            # bg ซูมช้า, fg เลื่อนขึ้นจากล่าง 260px ด้วย ease-out ใน 0.45 วิ + จางเข้า, มาสคอตอยู่ใน fg เดียวกัน, เสียงพากย์เริ่มหลังเอฟเฟกต์ 0.35 วิ
            filt = ("[0:v]scale=1296:2304,zoompan=z='min(zoom+0.0007,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30[bg];"
                    "[1:v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1[fg];"
                    "[bg][fg]overlay=x=0:y='pow(1-min(1,t/0.45),2)*260':format=auto,fade=t=in:st=0:d=0.2,format=yuv420p[v];"
                    "[2:a]adelay=350|350[vo];[3:a]volume=0.8[fx];[vo][fx]amix=inputs=2:duration=longest:normalize=0,apad[a]")
            subprocess.run([FF, '-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', pb, '-loop', '1', '-framerate', '30', '-i', pf, '-i', a, '-i', fx, '-filter_complex', filt,
                            '-map', '[v]', '-map', '[a]', '-t', f'{D:.2f}', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', seg], check=True)
        segs.append(seg)
    lst = os.path.join(OUTDIR, 'list.txt'); open(lst, 'w').write(''.join(f"file '{os.path.abspath(s)}'\n" for s in segs))
    music_credit = None
    want_music = spec.get('music', True)  # ทุกคลิปมีเพลงประกอบ (ปิดได้ด้วย "music": false)
    if want_music:
        mood = spec.get('music_mood', 'upbeat')
        mpath = make_music(os.path.join(OUTDIR, 'music.wav'), mood, int(hashlib.md5(json.dumps(items, ensure_ascii=False).encode()).hexdigest()[:8], 16))
        music_credit = f'เพลง: แต่งขึ้นเองอัตโนมัติ ({mood}) ไม่มีลิขสิทธิ์ผู้อื่น'
        tmp = os.path.join(OUTDIR, 'novideo_music.mp4')
        subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', tmp], check=True)
        D = dur(tmp)
        # เพลงเบาลงเองตอนมีเสียงพากย์ (sidechain) แล้วดังขึ้นช่วงเงียบ จางเข้า/ออกหัวท้าย
        subprocess.run([FF, '-y', '-loglevel', 'error', '-i', tmp, '-stream_loop', '-1', '-i', mpath, '-filter_complex',
                        f"[0:a]asplit=2[vo][key];[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.6,atrim=0:{D:.2f},afade=t=in:st=0:d=1.0,afade=t=out:st={max(0, D - 2.0):.2f}:d=2.0[m];"
                        "[m][key]sidechaincompress=threshold=0.05:ratio=4:attack=20:release=400[md];[vo][md]amix=inputs=2:duration=first:normalize=0[a]",
                        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], check=True)
    if not want_music:
        subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', out], check=True)
    print(json.dumps({'ok': True, 'out': out, 'style': STYLE, 'duration': round(dur(out), 1), 'bytes': os.path.getsize(out), 'items': n, 'tts_chars': chars, 'image_credits': credits + ([music_credit] if music_credit else [])}, ensure_ascii=False))

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'candidates':
        os.makedirs(CACHE, exist_ok=True); candidates(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'candidates.png'); sys.exit(0)
    main()
