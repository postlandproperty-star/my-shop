#!/usr/bin/env python3
"""คลิปคำศัพท์ AI (แนวที่คุณแดนส่งมา 12 ต.ค. 69): ตัวละครประจำเพจในฉากเดียว พูดคำอังกฤษทีละคำ + ตัวหนังสือ คำ / คำอ่าน / ความหมาย
  python3 tools/reel/vocab.py spec.json out.mp4     ทำคลิปจาก spec
  python3 tools/reel/vocab.py daily [--dry]          วันละ 1 คลิป: หัวข้อถัดไปจาก vocab/bank.json (หมด = AI คิดหัวข้อใหม่) → ทำคลิป → อัปโหลด → เข้าคิวโพสต์ 19:00 น.
spec: {"id", "host": "f"|"m", "title": "หัวคลิปไทยบนจอ", "intro": "ประโยคเปิดเสียงไทย (hook)", "question": "คำถามชวนคอมเมนต์",
       "scene": "ฉาก ภาษาอังกฤษ", "words": [["Sweet", "สวีท", "หวาน", "she smiles happily"], ...6 คำ]}
ลำดับคลิป (~25 วิ): เปิดด้วยคำถามเสียงไทย (ภาพนิ่ง) → ตัวละครพูดคำอังกฤษ 12 วิ + เสียงไทย "แปลว่า …" ต่อท้ายทุกคำ → ทวนทุกคำ → ชวนคอมเมนต์/ติดตาม
เสียงผู้บรรยายตรงเพศตัวละคร (คุณแดน 12 ต.ค. 69): ครูผู้หญิง = เสียงผู้หญิง "ค่ะ" · ครูผู้ชาย = เสียงผู้ชาย "ครับ"
ต้นทุนต่อคลิป ~15 บาท: ฉาก nano-banana edit ~$0.04 · Seedance 1.5 Pro 12 วิ 720p มีเสียงพูด ~$0.31 · เสียงไทย/ถอดเสียง ไม่ถึง 1 บาท
คีย์ fal อยู่ที่ ~/.config/sheetlab/fal-key (ไม่อยู่ในโค้ด) · ไฟล์งานอยู่ใน tools/reel/.vocab_work/<id>/ รันซ้ำไม่เสียเงินซ้ำ
"""
import sys, os, json, re, time, base64, subprocess, urllib.request, urllib.error, datetime
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import sound  # เพลงประกอบที่แต่งเองด้วยโค้ด (ไม่มีลิขสิทธิ์คนอื่น)

FF = os.path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg')
KEY = open(os.path.expanduser('~/.config/sheetlab/fal-key')).read().strip()
W, H = 1080, 1920
BLUE = (43, 71, 240); INK = (26, 26, 26); RED = (239, 91, 76); WHITE = (255, 255, 255); YEL = (245, 197, 24)
BANK = os.path.join(HERE, 'vocab', 'bank.json'); STATE = os.path.join(HERE, 'vocab', 'state.json')
CAST = {
    'f': {'img': os.path.join(HERE, 'cast', 'host.png'), 'noun': 'woman', 'pro': 'she', 'voice': 'Kore', 'end': 'ค่ะ', 'outfit': 'royal blue t-shirt',
          'prompt': 'Photorealistic vertical portrait of a friendly Thai woman English teacher in her late 20s, shoulder-length black hair, round thin-frame glasses, '
                    'warm natural smile, wearing a plain royal blue t-shirt, standing, upper body, soft natural light, plain light background, high detail, no text, no logo'},
    'm': {'img': os.path.join(HERE, 'cast', 'host-m.png'), 'noun': 'man', 'pro': 'he', 'voice': 'Puck', 'end': 'ครับ', 'outfit': 'royal blue t-shirt',
          'prompt': 'Photorealistic vertical portrait of a friendly Thai man English teacher around 30, short neat black hair, clean-shaven, black rectangular glasses, '
                    'warm natural smile, wearing a plain royal blue t-shirt, standing, upper body, soft natural light, plain light background, high detail, no text, no logo'},
}


def font(kind, sz):
    return ImageFont.truetype(os.path.join(HERE, 'fonts', {'xb': 'Kanit-ExtraBold.ttf', 'sb': 'Kanit-SemiBold.ttf', 'md': 'Kanit-Medium.ttf'}[kind]), sz)


def req(url, body=None, method=None, timeout=120, headers=None):
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method or ('POST' if body is not None else 'GET'),
                               headers=headers or {'Authorization': 'Key ' + KEY, 'Content-Type': 'application/json'})
    try: return json.loads(urllib.request.urlopen(r, timeout=timeout).read())
    except urllib.error.HTTPError as e: raise SystemExit(f'fal {e.code} {url.split("/requests/")[0]}: {e.read()[:400].decode("utf-8", "replace")}')


def fal(endpoint, body, wait=900):
    """ส่งงานเข้าคิว fal แล้วรอผล"""
    q = req('https://queue.fal.run/' + endpoint, body)
    t0 = time.time()
    while time.time() - t0 < wait:
        s = req(q['status_url'])
        if s.get('status') == 'COMPLETED': return req(q['response_url'])
        if s.get('status') not in ('IN_QUEUE', 'IN_PROGRESS'): raise SystemExit('fal: ' + json.dumps(s)[:300])
        time.sleep(5)
    raise SystemExit('fal: timeout')


def download(url, fn):
    data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=300).read()
    open(fn, 'wb').write(data); return fn


def data_uri(fn, mime='image/png'):
    return f'data:{mime};base64,' + base64.b64encode(open(fn, 'rb').read()).decode()


def host(g):
    c = CAST[g]
    if not os.path.exists(c['img']):
        os.makedirs(os.path.dirname(c['img']), exist_ok=True)
        j = fal('fal-ai/nano-banana', {'prompt': c['prompt'], 'aspect_ratio': '9:16', 'output_format': 'png'})
        download(j['images'][0]['url'], c['img'])
    return c['img']


# ---------- เสียง ----------
def thai_tts(text, fn, voice):
    """เสียงผู้บรรยายไทยนอกจอ (Gemini TTS บน fal ~2 บาท/1,000 ตัวอักษร) · ข้อความสั้นมากบางคำ Gemini TTS ไม่ยอมอ่าน → ลองประโยคถัดไป"""
    if os.path.exists(fn): return fn
    last = None
    for t in ([text] if isinstance(text, str) else text):
        try:
            j = fal('fal-ai/gemini-3.1-flash-tts', {'prompt': t, 'voice': voice, 'language_code': 'Thai (Thailand)', 'output_format': 'mp3',
                                                   'style_instructions': 'Speak Thai naturally like a friendly young teacher, bright, clear and fairly quick. No pause before or after.'})
            download(j['audio']['url'], fn); return fn
        except SystemExit as e: last = e
    raise last


def trim(fn):
    """ตัดช่วงเงียบหัว-ท้าย จะได้ไม่ต้องเร่งเสียงให้เข้าช่องว่างระหว่างคำ"""
    out = fn.replace('.mp3', '-trim.mp3')
    if not os.path.exists(out):
        cut = 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03'
        subprocess.run([FF, '-y', '-loglevel', 'error', '-i', fn, '-af', f'{cut},areverse,{cut},areverse', out], check=True)
    return out


def dur(fn):
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', subprocess.run([FF, '-i', fn], capture_output=True, text=True).stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0


def word_times(video, words):
    """เวลาที่พูดแต่ละคำ: ถอดเสียงด้วย ElevenLabs Scribe บน fal (~0.3 บาท) ได้เวลาเป็นรายคำ · ไม่ครบ = None"""
    mp3 = video + '.mp3'
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', mp3], check=True)
    try: j = req('https://fal.run/fal-ai/elevenlabs/speech-to-text/scribe-v2', {'audio_url': data_uri(mp3, 'audio/mpeg'), 'language_code': 'eng', 'keyterms': [w[0] for w in words]}, timeout=180)
    except SystemExit as e: print('scribe:', e, file=sys.stderr); return None
    got = [w for w in j.get('words', []) if w.get('type', 'word') == 'word']
    print('ได้ยิน:', j.get('text', ''), file=sys.stderr)
    return [[float(w['start']), float(w['end'])] for w in got] if len(got) == len(words) else None


def speech_spans(video, n, total):
    """สำรอง: ช่วงที่พูดจาก silencedetect → n ช่วง · จับไม่ได้ = แบ่งเท่าๆ กัน"""
    out = subprocess.run([FF, '-i', video, '-af', 'silencedetect=noise=-25dB:d=0.2', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    talk, cur = [], 0.0
    for a, b in zip(st, en + [total] * (len(st) - len(en))):
        if a - cur > 0.15: talk.append([cur, a])
        cur = b
    if total - cur > 0.15: talk.append([cur, total])
    while len(talk) > n:
        i = min(range(len(talk) - 1), key=lambda k: talk[k + 1][0] - talk[k][1]); talk[i] = [talk[i][0], talk[i + 1][1]]; del talk[i + 1]
    return talk if len(talk) == n else [[total * i / n, total * (i + 1) / n] for i in range(n)]


# ---------- ภาพ ----------
def card(word, pron, mean, fn):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f1, f2, f3 = font('xb', 112), font('sb', 64), font('sb', 56)
    w1 = d.textlength(word, font=f1); w2 = d.textlength(pron, font=f2); w3 = d.textlength(f'({mean})', font=f3)
    cw = int(max(w1, w2, w3) + 110); x0 = (W - cw) // 2; y0 = 1180
    d.rounded_rectangle([x0 + 8, y0 + 12, x0 + cw + 8, y0 + 372], 44, fill=(0, 0, 0, 90))
    d.rounded_rectangle([x0, y0, x0 + cw, y0 + 360], 44, fill=WHITE + (245,))
    d.text((W / 2, y0 + 92), word, font=f1, fill=INK, anchor='mm')
    d.text((W / 2, y0 + 200), pron, font=f2, fill=BLUE, anchor='mm')
    pw = w3 + 60; d.rounded_rectangle([(W - pw) / 2, y0 + 250, (W + pw) / 2, y0 + 330], 40, fill=RED)
    d.text((W / 2, y0 + 289), f'({mean})', font=f3, fill=WHITE, anchor='mm')
    im.save(fn); return fn


def title(text, fn):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); f = font('xb', 70)
    tw = d.textlength(text, font=f); pw = tw + 90
    d.rounded_rectangle([(W - pw) / 2, 150, (W + pw) / 2, 270], 60, fill=BLUE)
    d.text((W / 2, 208), text, font=f, fill=WHITE, anchor='mm')
    f2 = font('sb', 38); t2 = 'SheetLab'; w2 = d.textlength(t2, font=f2)
    d.rounded_rectangle([W - w2 - 100, H - 170, W - 50, H - 100], 35, fill=WHITE, outline=INK, width=4)
    d.text((W - 75 - w2 / 2, H - 135), t2, font=f2, fill=INK, anchor='mm')
    im.save(fn); return fn


def hook_card(text, fn):
    """ช่วงเปิด: คำถามตัวใหญ่กลางจอ (คนเลื่อนผ่านอ่านทันในวินาทีแรก)"""
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); f = font('xb', 84)
    lines, cur = [], ''
    for ch in re.findall(r'\S+\s*', text):
        if d.textlength(cur + ch, font=f) > W - 200 and cur: lines.append(cur.strip()); cur = ch
        else: cur += ch
    lines.append(cur.strip()); lh = 112; top = 1120
    bw = max(d.textlength(l, font=f) for l in lines) + 100
    d.rounded_rectangle([(W - bw) / 2, top - 40, (W + bw) / 2, top + lh * len(lines) + 30], 48, fill=YEL)
    for i, l in enumerate(lines): d.text((W / 2, top + lh * i + lh / 2), l, font=f, fill=INK, anchor='mm')
    im.save(fn); return fn


def recap_card(words, fn, head='ทวนอีกรอบ'):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 120)); d = ImageDraw.Draw(im)
    f0, f1, f2 = font('xb', 76), font('xb', 66), font('sb', 56)
    top, rh = 520, 128; x0, x1 = 110, W - 110
    d.rounded_rectangle([x0, top - 170, x1, top + rh * len(words) + 50], 48, fill=WHITE)
    d.text((W / 2, top - 90), head, font=f0, fill=BLUE, anchor='mm')
    for i, w in enumerate(words):
        y = top + rh * i + rh / 2
        d.text((x0 + 60, y), w[0], font=f1, fill=INK, anchor='lm')
        tw = d.textlength(w[2], font=f2) + 50
        d.rounded_rectangle([x1 - 60 - tw, y - 40, x1 - 60, y + 40], 40, fill=RED)
        d.text((x1 - 60 - tw / 2, y), w[2], font=f2, fill=WHITE, anchor='mm')
    im.save(fn); return fn


def cta_card(question, fn):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 120)); d = ImageDraw.Draw(im)
    f1 = font('xb', 72)
    d.rounded_rectangle([110, 640, W - 110, 1180], 48, fill=WHITE)
    lines, cur = [], ''
    for ch in re.findall(r'\S+\s*', question):
        if d.textlength(cur + ch, font=f1) > W - 320 and cur: lines.append(cur.strip()); cur = ch
        else: cur += ch
    lines.append(cur.strip())
    for i, l in enumerate(lines[:3]): d.text((W / 2, 760 + 100 * i), l, font=f1, fill=INK, anchor='mm')
    t2 = 'กดติดตาม มีศัพท์ใหม่ทุกวัน'; f2 = font('xb', 54); bw = d.textlength(t2, font=f2) + 90
    d.rounded_rectangle([(W - bw) / 2, 1040, (W + bw) / 2, 1140], 50, fill=BLUE)
    d.text((W / 2, 1090), t2, font=f2, fill=WHITE, anchor='mm')
    im.save(fn); return fn


def cover(spec, scene, fn):
    """ปกคลิป 1080×1920 (คุณแดน 12 ต.ค. 69: ดูย้อนหลังง่าย) · ข้อความอยู่กลางกรอบ 3:4 ที่ Instagram/Facebook ตัดโชว์ในหน้าโปรไฟล์"""
    bg = Image.open(scene).convert('RGB').resize((W, H))
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(shade)
    for y in range(H): sd.line([(0, y), (W, y)], fill=(10, 20, 60, int(40 + 150 * max(0, (y - 700) / (H - 700)))))
    im = Image.alpha_composite(bg.convert('RGBA'), shade); d = ImageDraw.Draw(im)
    t = spec['title']; f = font('xb', 104); lines, cur = [], ''
    for ch in re.findall(r'\S+\s*', t):
        if d.textlength(cur + ch, font=f) > W - 160 and cur: lines.append(cur.strip()); cur = ch
        else: cur += ch
    lines.append(cur.strip()); top = 1080
    for i, l in enumerate(lines[:3]): d.text((W / 2, top + 130 * i), l, font=f, fill=WHITE, anchor='mm', stroke_width=8, stroke_fill=INK)
    fb = font('xb', 56); b = f'{len(spec["words"])} คำ ใช้บ่อย'; bw = d.textlength(b, font=fb) + 70; by = top - 150
    d.rounded_rectangle([(W - bw) / 2, by - 48, (W + bw) / 2, by + 48], 48, fill=YEL); d.text((W / 2, by), b, font=fb, fill=INK, anchor='mm')
    ex = ' · '.join(w[0] for w in spec['words'][:3]) + ' …'; fe = font('sb', 50)
    d.text((W / 2, top + 130 * min(len(lines), 3) + 40), ex, font=fe, fill=WHITE, anchor='mm', stroke_width=4, stroke_fill=INK)
    f2 = font('sb', 40); t2 = 'SheetLab'; w2 = d.textlength(t2, font=f2)
    d.rounded_rectangle([W - w2 - 110, 260, W - 60, 335], 38, fill=WHITE, outline=INK, width=4); d.text((W - 85 - w2 / 2, 297), t2, font=f2, fill=INK, anchor='mm')
    im.convert('RGB').save(fn, 'JPEG', quality=90); return fn


# ---------- ทำคลิป ----------
def build(spec, out):
    work = os.path.join(HERE, '.vocab_work', spec['id']); os.makedirs(work, exist_ok=True)
    words = spec['words']; secs = int(spec.get('seconds', 12)); n = len(words)
    g = spec.get('host', 'f') if spec.get('host') in CAST else 'f'; c = CAST[g]; voice = spec.get('thai_voice_name') or c['voice']; p = c['end']
    scene = os.path.join(work, 'scene.png')
    if not os.path.exists(scene):
        j = fal('fal-ai/nano-banana/edit', {'image_urls': [data_uri(host(g))], 'aspect_ratio': '9:16', 'output_format': 'png',
                                            'prompt': f'Keep this exact same {c["noun"]} (same face, hair, glasses, {c["outfit"]}). Place {c["pro"] == "she" and "her" or "him"} in this scene: {spec["scene"]}. '
                                                      f'Photorealistic, vertical 9:16, {c["pro"]} faces the camera at medium shot, face clearly visible in the upper half, space in the lower third. No text, no logos.'})
        download(j['images'][0]['url'], scene)
    raw = os.path.join(work, 'raw.mp4')
    if not os.path.exists(raw):
        said = ' '.join(f'Then {c["pro"]} clearly says "{w[0]}." ({w[3]}), and pauses.' for w in words)
        prompt = (f'{spec["scene"]}. The {c["noun"]} speaks to the camera in clear, slow American English, one word at a time with a short pause between words. '
                  f'{said} Natural lip sync, natural gestures, gentle handheld camera. No music, no subtitles, no on-screen text.')
        j = fal('fal-ai/bytedance/seedance/v1.5/pro/image-to-video', {'image_url': data_uri(scene), 'prompt': prompt, 'duration': str(secs),
                                                                       'resolution': '720p', 'aspect_ratio': '9:16', 'generate_audio': True})
        download(j['video']['url'], raw)
    spans = word_times(raw, words); timed = bool(spans)
    if not spans: spans = speech_spans(raw, n, secs)

    # เสียงไทย: คำถามเปิด (ภาพนิ่งเฟรมแรก) → "แปลว่า …" ต่อท้ายคำอังกฤษ (ช่องว่างไม่พอ = ภาพหยุดรอสั้นๆ) → ทวน → ชวนคอมเมนต์
    intro = trim(thai_tts(spec.get('intro') or spec['title'].replace('?', ''), os.path.join(work, f'th-intro-{g}.mp3'), voice))
    pre = round(dur(intro) + 0.35, 2)
    cuts = [min(secs, spans[i][1] + 0.08) for i in range(n)]; extra = [0.0] * n; sp = [1.0] * n; means = []
    for i, w in enumerate(words):
        f = trim(thai_tts([f'แปลว่า {w[2]}', f'คำนี้แปลว่า {w[2]}', f'{w[2]} {p}', f'ก็คือ {w[2]}'], os.path.join(work, f'th-{i}-{g}.mp3'), voice)); d = dur(f)
        room = (spans[i + 1][0] - 0.08 - cuts[i]) if i + 1 < n else (secs - cuts[i] - 0.3)
        sp[i] = min(1.15, max(1.0, d / max(room, 0.01))); extra[i] = round(max(0.0, d / sp[i] - room), 2); means.append(f)
    recap = trim(thai_tts(f'ทวนอีกรอบนะ{p} ' + ', '.join(w[0] for w in words), os.path.join(work, f'th-recap2-{g}.mp3'), voice))
    cta = trim(thai_tts(f'{spec.get("question") or "คำไหนใช้บ่อยที่สุด คอมเมนต์บอกหน่อย"}{p} กดติดตามไว้ มีศัพท์ใหม่ทุกวัน{p}', os.path.join(work, f'th-cta-{g}.mp3'), voice))
    main_len = secs + sum(extra); rec_len = round(dur(recap) + 0.5, 2); cta_len = round(dur(cta) + 0.8, 2)
    total = pre + main_len + rec_len + cta_len
    shift = lambda t: pre + t + sum(extra[j] for j in range(n) if cuts[j] <= t - 1e-6)
    starts = [shift(max(0.0, s[0] - 0.15)) for s in spans]; ends = starts[1:] + [pre + main_len]

    ov = [title(spec['title'], os.path.join(work, 'title.png')), hook_card(spec.get('hook') or spec['title'], os.path.join(work, 'hook.png'))] \
        + [card(w[0], w[1], w[2], os.path.join(work, f'c{i}.png')) for i, w in enumerate(words)] \
        + [recap_card(words, os.path.join(work, 'recap.png')), cta_card(spec.get('question') or 'คำไหนใช้บ่อยที่สุด คอมเมนต์บอกหน่อย', os.path.join(work, 'cta.png'))]
    music = os.path.join(work, 'music.wav')
    if not os.path.exists(music): sound.make_music(music, spec.get('music_mood', 'auto'), sum(map(ord, spec['id'])))
    th = [(intro, 0.1, 1.0)] + [(means[i], pre + cuts[i] + sum(extra[j] for j in range(i)), sp[i]) for i in range(n)] \
        + [(recap, pre + main_len + 0.25, 1.0), (cta, pre + main_len + rec_len + 0.3, 1.0)]
    args = [FF, '-y', '-i', raw] + sum((['-i', x] for x in ov), []) + sum((['-i', x[0]] for x in th), []) + ['-stream_loop', '-1', '-i', music]
    # ตัดวิดีโอเป็นช่วงละคำ หยุดภาพท้ายช่วงตามเวลาที่เสียงไทยต้องใช้ แล้วต่อกลับ · ช่วงทวน/ชวนติดตาม = ภาพนิ่งเฟรมสุดท้าย
    bounds = [0.0] + cuts + [float(secs)]; segs = []; fc = ''
    for j in range(n + 1):
        a0, a1 = bounds[j], bounds[j + 1]
        if a1 - a0 < 0.02: continue
        ex = extra[j] if j < n else rec_len + cta_len; st = pre if j == 0 else 0.0
        fc += (f'[0:v]trim=start={a0:.3f}:end={a1:.3f},setpts=PTS-STARTPTS,scale={W}:{H}:flags=lanczos,setsar=1,fps=24,'
               f'tpad=start_duration={st}:start_mode=clone:stop_duration={ex:.2f}:stop_mode=clone[sv{j}];'
               f'[0:a]atrim=start={a0:.3f}:end={a1:.3f},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,adelay={int(st * 1000)}|{int(st * 1000)},apad=pad_dur={ex:.2f}[sa{j}];')
        segs.append(j)
    fc += ''.join(f'[sv{j}][sa{j}]' for j in segs) + f'concat=n={len(segs)}:v=1:a=1[cv][ca]'
    lay = [(1, 0, pre + main_len), (2, 0, pre)] + [(3 + i, starts[i], ends[i]) for i in range(n)] + [(3 + n, pre + main_len, pre + main_len + rec_len), (4 + n, pre + main_len + rec_len, total)]
    prev = 'cv'
    for k, (idx, a, b) in enumerate(lay):
        fc += f';[{prev}][{idx}:v]overlay=0:0:enable=\'between(t,{a:.2f},{b:.2f})\'[o{k}]'; prev = f'o{k}'
    base = 1 + len(ov); mix = ['[ca]']
    for k, (f, at, s) in enumerate(th):
        d = int(at * 1000); fc += f';[{base + k}:a]aformat=sample_rates=44100:channel_layouts=stereo,atempo={s:.3f},adelay={d}|{d},volume=1.5[t{k}]'; mix.append(f'[t{k}]')
    fc += f';[{base + len(th)}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.10,afade=t=out:st={total - 1:.2f}:d=1[mu]'; mix.append('[mu]')
    fc += ';' + ''.join(mix) + f'amix=inputs={len(mix)}:normalize=0:duration=first[aout]'
    args += ['-filter_complex', fc, '-map', f'[{prev}]', '-map', '[aout]', '-t', f'{total:.2f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
             '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr[-1500:])
    cover(spec, scene, out.replace('.mp4', '-cover.jpg'))
    return {'out': out, 'cover': out.replace('.mp4', '-cover.jpg'), 'seconds': round(total, 1), 'spans': [[round(a, 2), round(b, 2)] for a, b in spans], 'timed_by_voice': timed}


# ---------- วันละคลิป ----------
def shop(action, body=None, method=None):
    ck = os.environ.get('CONTENT_KEY') or open(os.path.expanduser('~/.config/sheetlab/content-key')).read()[:48].strip()
    return req(f'https://sheetlabth.com/api/content?action={action}', body, method, timeout=120, headers={'x-content-key': ck, 'Content-Type': 'application/json'})


def new_topic(used, g):
    """หัวข้อในคลังหมด: ให้ AI (ผ่าน fal) คิดหัวข้อใหม่ที่ไม่ซ้ำ"""
    c = CAST[g]
    prompt = ('Create ONE new topic for a 25-second Thai Facebook Reel teaching 6 everyday English words to Thai learners (TOEIC-friendly). '
              f'Topics already used (do not repeat): {", ".join(used)}. The on-screen teacher is a Thai {c["noun"]} ({c["pro"]}). '
              'Return JSON only: {"id": "kebab-case-english-slug", "title": "short Thai title ending with ?", "hook": "short Thai hook question for the opening, max 40 chars", '
              '"intro": "Thai sentence the narrator says at the start, max 60 chars", "question": "Thai question inviting comments, max 45 chars", '
              f'"scene": "one English sentence: where the {c["noun"]} is and what {c["pro"]} holds or does", '
              '"words": [["English word", "Thai pronunciation written in Thai script with hyphens between syllables", "short Thai meaning (1-3 words)", '
              f'"English stage direction for {c["pro"]} while saying it"] x6], "caption": "Thai Facebook caption 1-2 lines with a question + 4 Thai/English hashtags"}}')
    j = req('https://fal.run/openrouter/router/openai/v1/chat/completions', {'model': 'google/gemini-2.5-flash', 'messages': [{'role': 'user', 'content': prompt}],
                                                                             'response_format': {'type': 'json_object'}}, timeout=180)
    t = json.loads(re.sub(r'^```(json)?|```$', '', j['choices'][0]['message']['content'].strip()))
    if len(t.get('words', [])) != 6: raise SystemExit('AI ให้คำไม่ครบ 6 คำ')
    t['host'] = g; t['id'] = re.sub(r'[^a-z0-9-]', '', t['id'].lower())[:40] or f'topic-{int(time.time())}'
    return t


def threads_text(cap):
    """Threads รับแท็กหัวข้อได้โพสต์ละ 1 แท็ก และไม่เกิน 500 ตัวอักษร: เก็บแฮชแท็กแรกไว้อันเดียว"""
    tags = re.findall(r'#\S+', cap); body = re.sub(r'\s*#\S+', '', cap).strip()
    return (body + (' ' + tags[0] if tags else ''))[:490]


# รันได้ทีละรอบ (14 ต.ค. 69: เครื่องเรียก daily ซ้อน 3 รอบพร้อมกัน → ทำคลิปเดียวกัน เขียนทับไฟล์จนพัง จอดำ/ไม่มีเสียง และโพสต์ซ้ำ 3 ครั้ง)
_LOCKS = []
def single_run(name):
    import fcntl
    f = open(os.path.join('/tmp', f'sheetlab-{name}.lock'), 'w')
    try: fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError: print(json.dumps({'skip': f'{name} กำลังทำงานอยู่อีกรอบ'})); sys.exit(0)
    _LOCKS.append(f)


def video_ok(path):
    """ถอดรหัสคลิปทั้งไฟล์ ต้องไม่มี error (กันไฟล์พังหลุดขึ้นเพจ)"""
    r = subprocess.run([FF, '-v', 'error', '-i', path, '-f', 'null', '-'], capture_output=True, text=True)
    bad = [l for l in r.stderr.splitlines() if l.strip()]
    if r.returncode != 0 or bad: raise SystemExit(f'คลิปเสีย ไม่อัปโหลด: {path} ({len(bad)} errors) {bad[:1]}')


def daily(dry=False):
    single_run('vocab')
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=7); today = now.strftime('%Y-%m-%d')
    st = json.load(open(STATE)) if os.path.exists(STATE) else {'done': [], 'last': ''}
    if st.get('last') == today: print(json.dumps({'skip': 'วันนี้ทำคลิปคำศัพท์แล้ว'})); return
    bank = json.load(open(BANK, encoding='utf-8'))
    g = 'm' if len(st['done']) % 2 else 'f'  # สลับครูผู้หญิง/ผู้ชายทุกวัน
    spec = next((t for t in bank if t['id'] not in st['done'] and t.get('host', g) == g), None) or next((t for t in bank if t['id'] not in st['done']), None)
    if not spec:
        spec = new_topic([t['id'] for t in bank] + st['done'], g); bank.append(spec)
        json.dump(bank, open(BANK, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    out = os.path.join(HERE, '.vocab_work', spec['id'] + '.mp4')
    try: info = build(spec, out)
    except SystemExit as e:
        msg = str(e)
        if 'Exhausted balance' in msg or 'locked' in msg.lower():
            try: shop('note', {'text': '⚠️ คลิปคำศัพท์ AI หยุด: เงินใน fal.ai หมด เติมที่ fal.ai/dashboard/billing แล้วระบบทำต่อเอง', 'kind': 'report', 'source': 'clip'})
            except SystemExit: pass
        raise
    if dry: print(json.dumps(info, ensure_ascii=False)); return
    video_ok(out)
    # คลิป+ปกขึ้น Cloudflare R2 ตรง (ส่งออกฟรี · Supabase เกินโควต้าจนเว็บล่ม 14 ต.ค. 69) · ปกอยู่คู่คลิป <คลิป>-cover.jpg
    sys.path.insert(0, os.path.join(ROOT, 'tools', 'r2')); import r2
    rkey = f"reels/{int(time.time() * 1000)}-{spec['id']}.mp4"
    up = {'public_url': r2.put_file(out, rkey, 'video/mp4')}
    r2.put_file(info['cover'], rkey.replace('.mp4', '-cover.jpg'), 'image/jpeg')
    at = (now.replace(hour=19, minute=0, second=0, microsecond=0) if now.hour < 18 else (now + datetime.timedelta(days=1)).replace(hour=19, minute=0, second=0, microsecond=0)) - datetime.timedelta(hours=7)
    cap = spec.get('caption') or f'{spec["title"]} 🗣️\n{spec.get("question") or "คำไหนใช้บ่อยที่สุด คอมเมนต์บอกหน่อย"} 👇\n🤖 คลิปนี้สร้างด้วย AI\n#คำศัพท์ภาษาอังกฤษ #เรียนภาษาอังกฤษ #TOEIC #SheetLab'
    # ลงทุกช่องทาง (คุณแดน 12 ต.ค. 69): เพจ Facebook (ระบบส่งต่อ Instagram Reels เอง) + Threads
    note = f'คลิป Reels คำศัพท์ AI | {spec["id"]} | ครู{"ผู้ชาย" if spec.get("host") == "m" else "ผู้หญิง"} | {info["seconds"]} วิ | fal ~15 บาท'
    row = {'text': cap, 'video_url': up['public_url'], 'kind': 'reel', 'source': 'clip', 'scheduled_at': at.strftime('%Y-%m-%dT%H:%M:%SZ'), 'notes': note}
    r = shop('drafts', {'posts': [row, {**row, 'channel': 'threads', 'text': threads_text(cap)}]})
    st['done'].append(spec['id']); st['last'] = today; json.dump(st, open(STATE, 'w'), ensure_ascii=False)
    print(json.dumps({'ok': r.get('ok'), 'id': spec['id'], 'at': at.isoformat(), 'seconds': info['seconds']}, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'daily': daily('--dry' in sys.argv)
    elif len(sys.argv) == 3: print(json.dumps(build(json.load(open(sys.argv[1], encoding='utf-8')), sys.argv[2]), ensure_ascii=False))
    else: raise SystemExit(__doc__)
