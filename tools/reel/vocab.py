#!/usr/bin/env python3
"""คลิปคำศัพท์ AI (แนวที่คุณแดนส่งมา 12 ต.ค. 69): ตัวละครประจำเพจในฉากเดียว พูดคำอังกฤษทีละคำ + ตัวหนังสือ คำ / คำอ่าน / ความหมาย
usage: python3 tools/reel/vocab.py spec.json out.mp4
spec: {"id", "title": "หัวคลิปไทยบนจอ (สั้น)", "scene": "ฉาก/ท่าทาง ภาษาอังกฤษ",
       "words": [["Sweet", "สวีท", "หวาน", "smiles happily"], ...6 คำ], "seconds": 12}
ขั้นตอน: ตัวละครประจำ (tools/reel/cast/host.png สร้างครั้งแรกครั้งเดียว) → วางในฉาก (nano-banana edit ~$0.04)
→ Seedance 1.5 Pro ทำวิดีโอมีเสียงพูด 720p 9:16 (~$0.3 ต่อ 12 วิ) → จับช่วงที่พูดจากเสียง → ใส่ตัวหนังสือ Kanit
คีย์ fal อยู่ที่ ~/.config/sheetlab/fal-key (ไม่อยู่ในโค้ด) · ไฟล์งานอยู่ใน tools/reel/.vocab_work/<id>/ รันซ้ำไม่เสียเงินซ้ำ
"""
import sys, os, json, re, time, base64, subprocess, urllib.request
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FF = os.path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg')
KEY = open(os.path.expanduser('~/.config/sheetlab/fal-key')).read().strip()
W, H = 1080, 1920
BLUE = (43, 71, 240); INK = (26, 26, 26); RED = (239, 91, 76); WHITE = (255, 255, 255); YEL = (245, 197, 24)
HOST = os.path.join(HERE, 'cast', 'host.png')
HOST_PROMPT = ('Photorealistic vertical portrait of a friendly Thai woman English teacher in her late 20s, shoulder-length black hair, '
               'round thin-frame glasses, warm natural smile, wearing a plain royal blue t-shirt, standing, upper body, soft natural light, '
               'plain light background, high detail, no text, no logo')


def font(kind, sz):
    return ImageFont.truetype(os.path.join(HERE, 'fonts', {'xb': 'Kanit-ExtraBold.ttf', 'sb': 'Kanit-SemiBold.ttf', 'md': 'Kanit-Medium.ttf'}[kind]), sz)


def req(url, body=None, method=None, timeout=120):
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method or ('POST' if body is not None else 'GET'),
                               headers={'Authorization': 'Key ' + KEY, 'Content-Type': 'application/json'})
    try: return json.loads(urllib.request.urlopen(r, timeout=timeout).read())
    except urllib.error.HTTPError as e: raise SystemExit(f'fal {e.code} {url.split("/requests/")[0]}: {e.read()[:400]}')


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


def data_uri(fn):
    return 'data:image/png;base64,' + base64.b64encode(open(fn, 'rb').read()).decode()


def host():
    if not os.path.exists(HOST):
        os.makedirs(os.path.dirname(HOST), exist_ok=True)
        j = fal('fal-ai/nano-banana', {'prompt': HOST_PROMPT, 'aspect_ratio': '9:16', 'output_format': 'png'})
        download(j['images'][0]['url'], HOST)
    return HOST


def word_times(video, words):
    """เวลาที่พูดแต่ละคำ: ถอดเสียงด้วย ElevenLabs Scribe บน fal (~0.3 บาท) ได้เวลาเป็นรายคำ · ไม่ครบ = None"""
    mp3 = video + '.mp3'
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', mp3], check=True)
    try:
        r = urllib.request.Request('https://fal.run/fal-ai/elevenlabs/speech-to-text/scribe-v2', method='POST', headers={'Authorization': 'Key ' + KEY, 'Content-Type': 'application/json'},
                                   data=json.dumps({'audio_url': 'data:audio/mpeg;base64,' + base64.b64encode(open(mp3, 'rb').read()).decode(), 'language_code': 'eng', 'keyterms': [w[0] for w in words]}).encode())
        j = json.loads(urllib.request.urlopen(r, timeout=180).read())
    except Exception as e:
        print('scribe:', e, file=sys.stderr); return None
    got = [w for w in j.get('words', []) if w.get('type', 'word') == 'word']
    print('ได้ยิน:', j.get('text', ''), file=sys.stderr)
    return [[float(w['start']), float(w['end'])] for w in got] if len(got) == len(words) else None


def speech_spans(video, n, total):
    """ช่วงที่พูดจากเสียงในคลิป (silencedetect) → n ช่วง · จับไม่ได้ = แบ่งเท่าๆ กัน"""
    out = subprocess.run([FF, '-i', video, '-af', 'silencedetect=noise=-32dB:d=0.25', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    sil = list(zip(st, en + [total] * (len(st) - len(en))))
    talk, cur = [], 0.0
    for a, b in sil:
        if a - cur > 0.15: talk.append([cur, a])
        cur = b
    if total - cur > 0.15: talk.append([cur, total])
    while len(talk) > n:  # รวมช่วงที่ห่างกันน้อยสุด
        i = min(range(len(talk) - 1), key=lambda k: talk[k + 1][0] - talk[k][1]); talk[i] = [talk[i][0], talk[i + 1][1]]; del talk[i + 1]
    if len(talk) != n: return [[total * i / n, total * (i + 1) / n] for i in range(n)], False
    return talk, True


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


def thai_tts(text, fn, voice='Kore'):
    """เสียงผู้บรรยายไทยนอกจอ (Gemini TTS บน fal ~2 บาท/1,000 ตัวอักษร) · คุณแดน 12 ต.ค. 69 อยากให้มีเสียงไทย"""
    if os.path.exists(fn): return fn
    last = None
    for t in ([text] if isinstance(text, str) else text):  # ข้อความสั้นมากบางคำ Gemini TTS ไม่ยอมอ่าน → ลองประโยคถัดไป
        try:
            j = fal('fal-ai/gemini-3.1-flash-tts', {'prompt': t, 'voice': voice, 'language_code': 'Thai (Thailand)', 'output_format': 'mp3',
                                                   'style_instructions': 'Speak Thai naturally like a friendly young teacher, bright, clear and fairly quick. No pause before or after.'})
            download(j['audio']['url'], fn); return fn
        except SystemExit as e: last = e
    raise last


def trim(fn):
    """ตัดช่วงเงียบหัว-ท้ายของเสียงไทย จะได้ไม่ต้องเร่งเสียงให้เข้าช่องว่างระหว่างคำ"""
    out = fn.replace('.mp3', '-trim.mp3')
    if not os.path.exists(out):
        cut = 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03'
        subprocess.run([FF, '-y', '-loglevel', 'error', '-i', fn, '-af', f'{cut},areverse,{cut},areverse', out], check=True)
    return out


def dur(fn):
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', subprocess.run([FF, '-i', fn], capture_output=True, text=True).stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0


def main():
    spec = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]
    work = os.path.join(HERE, '.vocab_work', spec['id']); os.makedirs(work, exist_ok=True)
    words = spec['words']; secs = int(spec.get('seconds', 12))
    scene = os.path.join(work, 'scene.png')
    if not os.path.exists(scene):
        j = fal('fal-ai/nano-banana/edit', {'image_urls': [data_uri(host())], 'aspect_ratio': '9:16', 'output_format': 'png',
                                            'prompt': f'Keep this exact same woman (same face, hair, glasses, royal blue t-shirt). Place her in this scene: {spec["scene"]}. '
                                                      'Photorealistic, vertical 9:16, she faces the camera at medium shot, her face clearly visible in the upper half, space in the lower third. No text, no logos.'})
        download(j['images'][0]['url'], scene)
    raw = os.path.join(work, 'raw.mp4')
    if not os.path.exists(raw):
        said = ' '.join(f'Then she clearly says "{w[0]}." ({w[3]}), and pauses.' for w in words)
        prompt = (f'{spec["scene"]}. The woman speaks to the camera in clear, slow American English, one word at a time with a short pause between words. '
                  f'{said} Natural lip sync, natural gestures, gentle handheld camera. No music, no subtitles, no on-screen text.')
        j = fal('fal-ai/bytedance/seedance/v1.5/pro/image-to-video', {'image_url': data_uri(scene), 'prompt': prompt, 'duration': str(secs),
                                                                       'resolution': '720p', 'aspect_ratio': '9:16', 'generate_audio': True})
        download(j['video']['url'], raw)
    spans = word_times(raw, words); ok = bool(spans)
    if not spans: spans, ok = speech_spans(raw, len(words), secs)
    ov = [title(spec['title'], os.path.join(work, 'title.png'))] + [card(w[0], w[1], w[2], os.path.join(work, f'c{i}.png')) for i, w in enumerate(words)]
    # เสียงไทย: เปิดคลิปด้วยหัวข้อ (ภาพนิ่งเฟรมแรกระหว่างพูด) แล้วพูด "แปลว่า …" ต่อท้ายคำอังกฤษทุกคำ · ช่องว่างไม่พอ = ภาพหยุดรอสั้นๆ (ไม่เร่งเสียงจนทับคำถัดไป)
    # "thai_voice": false = ไม่ใส่เสียงไทย
    th = spec.get('thai_voice', True); voice = spec.get('thai_voice_name', 'Kore'); n = len(words)
    cuts = [min(secs, spans[i][1] + 0.08) for i in range(n)]
    pre, extra, th_clips, sp = 0.0, [0.0] * n, [], [1.0] * n
    if th:
        intro = trim(thai_tts(spec.get('intro') or spec['title'].replace('?', ''), os.path.join(work, 'th-intro.mp3'), voice))
        pre = round(dur(intro) + 0.3, 2); th_clips.append((intro, 0.1, 1.0))
        for i, w in enumerate(words):
            f = trim(thai_tts([f'แปลว่า {w[2]}', f'คำนี้แปลว่า {w[2]}', f'{w[2]} ค่ะ', f'ก็คือ {w[2]}'], os.path.join(work, f'th-{i}.mp3'), voice)); d = dur(f)  # คำเดียวโดดๆ ติดตัวกรองของ Gemini TTS
            room = (spans[i + 1][0] - 0.08 - cuts[i]) if i + 1 < n else (secs - cuts[i] - 0.3)
            sp[i] = min(1.15, max(1.0, d / max(room, 0.01))); extra[i] = round(max(0.0, d / sp[i] - room), 2)
            th_clips.append((f, None, sp[i], i))
    shift = lambda t: pre + t + sum(extra[j] for j in range(n) if cuts[j] <= t - 1e-6)
    total = pre + secs + sum(extra)
    starts = [shift(max(0.0, s[0] - 0.15)) for s in spans]; ends = starts[1:] + [total]
    args = [FF, '-y', '-i', raw] + sum((['-i', p] for p in ov), []) + sum((['-i', c[0]] for c in th_clips), [])
    # ตัดวิดีโอเป็นช่วงละคำ หยุดภาพท้ายช่วงตามเวลาที่เสียงไทยต้องใช้ แล้วต่อกลับ
    bounds = [0.0] + cuts + [float(secs)]; segs = []
    fc = ''
    for j in range(n + 1):
        a0, a1 = bounds[j], bounds[j + 1]
        if a1 - a0 < 0.02: continue
        ex = extra[j] if j < n else 0.0; st = pre if j == 0 else 0.0
        fc += (f'[0:v]trim=start={a0:.3f}:end={a1:.3f},setpts=PTS-STARTPTS,scale={W}:{H}:flags=lanczos,setsar=1,fps=24,'
               f'tpad=start_duration={st}:start_mode=clone:stop_duration={ex}:stop_mode=clone[sv{j}];'
               f'[0:a]atrim=start={a0:.3f}:end={a1:.3f},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,adelay={int(st * 1000)}|{int(st * 1000)},apad=pad_dur={ex}[sa{j}];')
        segs.append(j)
    fc += ''.join(f'[sv{j}][sa{j}]' for j in segs) + f'concat=n={len(segs)}:v=1:a=1[cv][ca];[cv][1:v]overlay=0:0[v1]'
    for i in range(n):
        fc += f';[v{i + 1}][{i + 2}:v]overlay=0:0:enable=\'between(t,{starts[i]:.2f},{ends[i]:.2f})\'[v{i + 2}]'
    base = 1 + len(ov); mix = ['[ca]']
    for k, c in enumerate(th_clips):
        at = c[1] if c[1] is not None else pre + cuts[c[3]] + sum(extra[j] for j in range(c[3]))  # ทันทีหลังคำอังกฤษ (ช่วงภาพหยุดรอ)
        d = int(at * 1000); fc += f';[{base + k}:a]aformat=sample_rates=44100:channel_layouts=stereo,atempo={c[2]:.3f},adelay={d}|{d},volume=1.5[t{k}]'; mix.append(f'[t{k}]')
    fc += ';' + ''.join(mix) + f'amix=inputs={len(mix)}:normalize=0:duration=longest[aout]'
    args += ['-filter_complex', fc, '-map', f'[v{n + 1}]', '-map', '[aout]', '-t', f'{total:.2f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
             '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr[-1500:])
    print(json.dumps({'out': out, 'spans': [[round(a, 2), round(b, 2)] for a, b in spans], 'timed_by_voice': ok}))


if __name__ == '__main__':
    main()
