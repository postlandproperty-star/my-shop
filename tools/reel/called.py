#!/usr/bin/env python3
"""คลิป "What is this called?" (แนวที่คุณแดนส่งมา 12 ต.ค. 69): วิดีโอจริงฟรีจาก Pixabay ข้อละ ~4 วิ ทาย → เฉลยคำ/คำอ่าน/ความหมาย/ประโยค + เสียงอ่านอังกฤษ
  python3 tools/reel/called.py spec.json out.mp4     ทำคลิปจาก spec
  python3 tools/reel/called.py daily [--dry]          วันละ 2 คลิป (12:00 / 21:00 น.) ทีละคลิปต่อรอบ: หัวข้อจาก called/bank.json (หมด = AI คิดใหม่) → อัปโหลด → คิวเพจ(+IG)/Threads
spec: {"id", "title": "หัวคลิปไทย", "intro": "เสียงไทยเปิดคลิป", "question": "คำถามชวนคอมเมนต์",
       "items": [["Whisk", "วิสค์", "ตะกร้อตีไข่", "Whisk the eggs until fluffy.", "ตีไข่จนฟู", "whisking eggs"], ...8 ข้อ]}
วิดีโอ: Pixabay (ฟรี ใช้เชิงพาณิชย์ได้ ไม่ต้องให้เครดิต) คีย์ที่ ~/.config/sheetlab/pixabay-key · ข้อที่หาคลิปไม่เจอ = รูป AI ราคาถูก (flux schnell ~0.1 บาท) ซูมช้า
ไม่มีคีย์ Pixabay = daily ไม่ทำ (คุณแดน: "มันเป็นวีดีโอนะไม่ใช่รูป") · ต้นทุนต่อคลิป ~1-2 บาท (เสียง)
"""
import sys, os, json, re, time, subprocess, urllib.request, urllib.parse, datetime
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import vocab as V  # fal, เสียงไทย, ฟอนต์, ร้าน (ใช้ร่วมกับคลิปคำศัพท์ AI)
import sound

FF, W, H = V.FF, V.W, V.H
BLUE, INK, RED, WHITE, YEL = V.BLUE, V.INK, V.RED, V.WHITE, V.YEL
BANK = os.path.join(HERE, 'called', 'bank.json'); STATE = os.path.join(HERE, 'called', 'state.json')
PXKEY = os.path.expanduser('~/.config/sheetlab/pixabay-key')
VY, VS = 330, 1000  # ตำแหน่ง/ขนาดกรอบวิดีโอ (สี่เหลี่ยมจัตุรัส)
Q_SEC = 1.6         # เวลาให้ทายก่อนเฉลย
R_SEC = 2.6         # เวลาเฉลย (เสียงอ่านแค่คำ ประโยคอ่านบนจอ · คลิปรวม ~40 วิ เท่าคลิปต้นแบบ)
VOICE_TH, VOICE_EN = 'Kore', 'Kore'


def pixabay_key():
    return open(PXKEY).read().strip() if os.path.exists(PXKEY) else os.environ.get('PIXABAY_KEY', '')


def looks_like(img_url, word, hint):
    """ให้ AI ดูภาพตัวอย่างของคลิป ว่าเห็น {word} ชัดจริงไหม (แท็ก Pixabay ไม่แม่น เช่น grater ได้คลิปเบคอน) · ~0.01 บาท/ภาพ"""
    try:
        j = V.req('https://fal.run/openrouter/router/openai/v1/chat/completions', {'model': 'google/gemini-2.5-flash', 'max_tokens': 5, 'messages': [{'role': 'user', 'content': [
            {'type': 'text', 'text': f'Does this image clearly and prominently show a {word} ({hint})? A viewer must be able to tell what a "{word}" is from this image alone. Answer only YES or NO.'},
            {'type': 'image_url', 'image_url': {'url': img_url}}]}]}, timeout=60)
        return 'YES' in str(j['choices'][0]['message']['content']).upper()
    except SystemExit as e: print('vision:', e, file=sys.stderr); return False


def find_video(q, fn, word='', hint=''):
    """คลิปจาก Pixabay ที่ AI ดูแล้วเห็น {word} ชัด (ลองคลิปที่แท็กตรงที่สุด 6 คลิป) · ไม่เจอ = None (ใช้รูป AI แทน)"""
    key = pixabay_key()
    if not key: return None
    if os.path.exists(fn): return fn
    if os.path.exists(fn + '.none'): return None
    url = f'https://pixabay.com/api/videos/?key={urllib.parse.quote(key)}&q={urllib.parse.quote(q)}&safesearch=true&per_page=30'
    try: hits = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (SheetLab reels)'}), timeout=60).read()).get('hits', [])  # ไม่ใส่ UA = Pixabay ตอบ 403
    except Exception as e: print('pixabay:', e, file=sys.stderr); return None
    words = set(re.findall(r'[a-z]+', (q + ' ' + word).lower()))
    def score(h):
        tags = set(re.findall(r'[a-z]+', h.get('tags', '').lower()))
        v = h['videos'].get('medium') or {}
        return (len(words & tags), 1 if v.get('height', 0) >= v.get('width', 1) else 0, -abs(h.get('duration', 0) - 12))
    ok = sorted([h for h in hits if h.get('duration', 0) >= 4 and (h['videos'].get('medium') or {}).get('url')], key=score, reverse=True)
    for h in ok[:6]:
        th = (h['videos'].get('medium') or {}).get('thumbnail') or h.get('picture_id') and f"https://i.vimeocdn.com/video/{h['picture_id']}_640x360.jpg"
        if th and looks_like(th, word or q, hint or q):
            V.download(h['videos']['medium']['url'], fn); return fn
    open(fn + '.none', 'w').write(q); return None


def ai_image(word, hint, fn):
    """ข้อที่หาคลิปจริงไม่เจอ: รูป AI ที่เห็น {word} ชัดกลางภาพ (flux schnell ~0.1 บาท) · AI ตรวจแล้วไม่ใช่ = ลองอีกครั้งด้วย nano-banana (~1.4 บาท)"""
    if os.path.exists(fn): return fn
    prompt = f'A realistic close-up photo of a {word} ({hint}). The {word} itself is large, sharp and clearly visible in the center, in a natural home or everyday setting, well lit. No text.'
    j = V.fal('fal-ai/flux/schnell', {'prompt': prompt, 'image_size': {'width': 1024, 'height': 1024}, 'num_inference_steps': 4})
    u = j['images'][0]['url']
    if not looks_like(u, word, hint):
        j = V.fal('fal-ai/nano-banana', {'prompt': prompt, 'aspect_ratio': '1:1', 'output_format': 'jpeg'}); u = j['images'][0]['url']
    V.download(u, fn); return fn


def en_tts(texts, fn):
    """เสียงอ่านอังกฤษ · คำเดียวโดดๆ Gemini TTS มักไม่ยอมอ่าน → ลองประโยคถัดไป"""
    if not os.path.exists(fn):
        last = None
        for t in ([texts] if isinstance(texts, str) else texts):
            try:
                j = V.fal('fal-ai/gemini-3.1-flash-tts', {'prompt': t, 'voice': VOICE_EN, 'language_code': 'English (US)', 'output_format': 'mp3',
                                                         'style_instructions': 'Clear, friendly American English teacher, natural pace.'})
                V.download(j['audio']['url'], fn); break
            except SystemExit as e: last = e
        else: raise last
    return V.trim(fn)


# ---------- ภาพ ----------
def fit(d, lines, kind, size, width):
    """ลดขนาดตัวอักษรจนทุกบรรทัดพอดีความกว้าง (ภาษาไทยไม่มีเว้นวรรคให้ตัดบรรทัด)"""
    while size > 40 and max(d.textlength(l, font=V.font(kind, size)) for l in lines) > width: size -= 4
    return V.font(kind, size)


def wrap(d, text, f, width):
    lines, cur = [], ''
    for ch in re.findall(r'\S+\s*', text):
        if d.textlength(cur + ch, font=f) > width and cur: lines.append(cur.strip()); cur = ch
        else: cur += ch
    return lines + [cur.strip()] if cur.strip() else lines


def base(i, n, fn):
    """พื้นหลังทุกข้อ: ไล่สีฟ้า + หัว What is this called? + ลำดับข้อ + กรอบวิดีโอ"""
    im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H; d.line([(0, y), (W, y)], fill=(int(140 - 97 * t), int(190 - 119 * t), int(255 - 15 * t)))
    f1, f2 = V.font('xb', 74), V.font('sb', 46)
    d.rounded_rectangle([90, 120, W - 90, 290], 50, fill=INK)
    d.text((W / 2, 180), 'What is this called?', font=f1, fill=WHITE, anchor='mm')
    d.text((W / 2, 250), 'สิ่งนี้เรียกว่าอะไร?', font=f2, fill=YEL, anchor='mm')
    d.rounded_rectangle([40 - 10, VY - 10, 40 + VS + 10, VY + VS + 10], 36, fill=WHITE)
    if i >= 0:
        c = f'{i + 1}/{n}'; fc = V.font('xb', 44); cw = d.textlength(c, font=fc) + 50
        d.rounded_rectangle([60, H - 132, 60 + cw, H - 62], 35, fill=YEL); d.text((60 + cw / 2, H - 97), c, font=fc, fill=INK, anchor='mm')
    fs = V.font('sb', 38); t = 'SheetLab'; tw = d.textlength(t, font=fs)
    d.rounded_rectangle([W - tw - 110, H - 130, W - 60, H - 62], 34, fill=WHITE, outline=INK, width=4); d.text((W - 85 - tw / 2, H - 96), t, font=fs, fill=INK, anchor='mm')
    im.save(fn); return fn


def q_card(fn):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((W / 2, 1480), '?', font=V.font('xb', 200), fill=YEL, anchor='mm', stroke_width=8, stroke_fill=INK)
    d.text((W / 2, 1660), 'ทายก่อนเฉลย!', font=V.font('xb', 70), fill=WHITE, anchor='mm', stroke_width=6, stroke_fill=INK)
    im.save(fn); return fn


def a_card(it, fn):
    word, pron, th, sen, sen_th = it[:5]
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fw = V.font('xb', 120 if len(word) <= 10 else 96)
    d.text((W / 2, 1420), word, font=fw, fill=RED, anchor='mm', stroke_width=10, stroke_fill=WHITE)
    fp = V.font('sb', 52); t = f'{pron}  ({th})'; tw = d.textlength(t, font=fp) + 70
    d.rounded_rectangle([(W - tw) / 2, 1500, (W + tw) / 2, 1580], 40, fill=WHITE); d.text((W / 2, 1540), t, font=fp, fill=BLUE, anchor='mm')
    fe, ft = V.font('sb', 46), V.font('md', 42); y = 1640
    for l in wrap(d, sen, fe, W - 140)[:2]: d.text((W / 2, y), l, font=fe, fill=WHITE, anchor='mm', stroke_width=3, stroke_fill=INK); y += 58
    for l in wrap(d, sen_th, ft, W - 140)[:2]: d.text((W / 2, y + 6), l, font=ft, fill=YEL, anchor='mm', stroke_width=3, stroke_fill=INK); y += 54
    im.save(fn); return fn


def big_card(lines, sub, fn, dark=True):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 150 if dark else 0)); d = ImageDraw.Draw(im)
    ls = sum((l.split(' ', 1) if len(l) > 16 and ' ' in l else [l] for l in lines), []); f = fit(d, ls, 'xb', 88, W - 220); top = 820 - 60 * len(ls)
    bw = max(d.textlength(l, font=f) for l in ls) + 110
    d.rounded_rectangle([(W - bw) / 2, top - 50, (W + bw) / 2, top + 120 * len(ls) + 20], 50, fill=YEL)
    for i, l in enumerate(ls): d.text((W / 2, top + 120 * i + 50), l, font=f, fill=INK, anchor='mm')
    if sub:
        fs = V.font('xb', 58); sw = d.textlength(sub, font=fs) + 90; y = top + 120 * len(ls) + 120
        d.rounded_rectangle([(W - sw) / 2, y - 50, (W + sw) / 2, y + 50], 50, fill=BLUE); d.text((W / 2, y), sub, font=fs, fill=WHITE, anchor='mm')
    im.save(fn); return fn


def cover(spec, frame, fn):
    """ปกคลิป: ภาพข้อแรก (ตัดเต็มจอ) + หัวข้อตัวใหญ่ (อยู่ในกรอบ 3:4 ที่หน้าโปรไฟล์ตัดโชว์)"""
    src = Image.open(frame).convert('RGB'); sc = max(W / src.width, H / src.height); src = src.resize((int(src.width * sc) + 1, int(src.height * sc) + 1))
    im = src.crop(((src.width - W) // 2, (src.height - H) // 2, (src.width - W) // 2 + W, (src.height - H) // 2 + H))
    ov = Image.new('RGBA', (W, H), (10, 20, 60, 120)); im = Image.alpha_composite(im.convert('RGBA'), ov)
    d = ImageDraw.Draw(im); t = spec['title']; ls = t.split(' ', 1) if ' ' in t else [t]; f = fit(d, ls, 'xb', 104, W - 140); top = 900 - 65 * len(ls)
    d.rounded_rectangle([170, top - 200, W - 170, top - 90], 55, fill=INK); d.text((W / 2, top - 145), 'What is this called?', font=V.font('xb', 58), fill=WHITE, anchor='mm')
    for i, l in enumerate(ls): d.text((W / 2, top + 130 * i), l, font=f, fill=WHITE, anchor='mm', stroke_width=8, stroke_fill=INK)
    b = f'ทาย {len(spec["items"])} ข้อ'; fb = V.font('xb', 60); bw = d.textlength(b, font=fb) + 80; by = top + 130 * len(ls) + 40
    d.rounded_rectangle([(W - bw) / 2, by - 50, (W + bw) / 2, by + 50], 50, fill=YEL); d.text((W / 2, by), b, font=fb, fill=INK, anchor='mm')
    im.convert('RGB').save(fn, 'JPEG', quality=90); return fn


# ---------- ทำคลิป ----------
def segment(src, is_video, start, dur, base_png, overlays, out):
    """1 ช่วง: พื้นหลัง + วิดีโอ/รูปในกรอบ + ป้ายข้อความตามเวลา · overlays = [(png, t0, t1)]"""
    args = [FF, '-y', '-loglevel', 'error', '-loop', '1', '-t', f'{dur:.2f}', '-i', base_png]
    if is_video: args += ['-ss', f'{start:.2f}', '-t', f'{dur:.2f}', '-i', src]
    else: args += ['-loop', '1', '-t', f'{dur:.2f}', '-i', src]
    for p, _, _ in overlays: args += ['-loop', '1', '-t', f'{dur:.2f}', '-i', p]
    if is_video: vf = f'[1:v]scale={VS}:{VS}:force_original_aspect_ratio=increase,crop={VS}:{VS},setsar=1,fps=24[m]'
    else: vf = f'[1:v]scale=1400:1400,zoompan=z=\'min(zoom+0.0012,1.25)\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d={int(dur * 24) + 1}:s={VS}x{VS}:fps=24,setsar=1[m]'
    fc = vf + f';[0:v]fps=24[b];[b][m]overlay=40:{VY}[v0]'
    for k, (_, a, b) in enumerate(overlays): fc += f';[v{k}][{k + 2}:v]overlay=0:0:enable=\'between(t,{a:.2f},{b:.2f})\'[v{k + 1}]'
    args += ['-filter_complex', fc, '-map', f'[v{len(overlays)}]', '-t', f'{dur:.2f}', '-r', '24', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-an', out]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr[-800:])
    return out


def build(spec, out):
    work = os.path.join(HERE, '.called_work', spec['id']); os.makedirs(work, exist_ok=True)
    items = spec['items']; n = len(items); media = []
    for i, it in enumerate(items):
        v = find_video(it[5], os.path.join(work, f'vv{i}.mp4'), it[0], f'{it[2]} · {it[3]}')
        media.append((v, True) if v else (ai_image(it[0], it[6] if len(it) > 6 else f'{it[2]} · {it[3]}', os.path.join(work, f'im{i}.jpg')), False))
    intro = V.trim(V.thai_tts(spec.get('intro') or spec['title'], os.path.join(work, 'th-intro.mp3'), VOICE_TH)); intro_len = V.dur(intro) + 0.6
    cta = V.trim(V.thai_tts(f'{spec.get("question") or "ทายถูกกี่ข้อ คอมเมนต์บอกหน่อย"}ค่ะ กดติดตามไว้ มีคลิปใหม่ทุกวันค่ะ', os.path.join(work, 'th-cta.mp3'), VOICE_TH)); cta_len = V.dur(cta) + 0.9
    qpng = q_card(os.path.join(work, 'q.png')); segs, sounds = [], [(intro, 0.15)]; t = 0.0
    # ช่วงเปิด: วิดีโอข้อแรก + หัวข้อตัวใหญ่ + เสียงไทยชวนทาย
    segs.append(segment(media[0][0], media[0][1], 0, intro_len, base(-1, n, os.path.join(work, 'b-intro.png')),
                        [(big_card([spec['title']], f'ทาย {n} ข้อ ทายถูกกี่ข้อ?', os.path.join(work, 'intro.png')), 0, intro_len)], os.path.join(work, 's-intro.mp4')))
    t += intro_len; ticks = []
    for i, it in enumerate(items):
        w0 = it[0]; art = 'an' if w0[0].lower() in 'aeiou' else 'a'; en = en_tts([f'It\'s called {art} {w0.lower()}.', f'This is {art} {w0.lower()}.', f'{w0}. {w0}.'], os.path.join(work, f'enw{i}.mp3')); r_len = max(R_SEC, V.dur(en) + 1.2); d = Q_SEC + r_len
        vlen = V.dur(media[i][0]) if media[i][1] else 0; st = max(0.0, min(1.0, vlen - d - 0.2)) if vlen else 0
        segs.append(segment(media[i][0], media[i][1], st, d, base(i, n, os.path.join(work, f'b{i}.png')),
                            [(qpng, 0, Q_SEC), (a_card(it, os.path.join(work, f'a{i}.png')), Q_SEC, d)], os.path.join(work, f's{i}.mp4')))
        ticks.append(t); sounds.append((en, t + Q_SEC + 0.15)); t += d
    last = media[-1]
    segs.append(segment(last[0], last[1], 0, cta_len, base(-1, n, os.path.join(work, 'b-end.png')),
                        [(big_card([spec.get('question') or 'ทายถูกกี่ข้อ? คอมเมนต์บอกหน่อย'], 'กดติดตาม มีคลิปใหม่ทุกวัน', os.path.join(work, 'end.png')), 0, cta_len)], os.path.join(work, 's-end.mp4')))
    sounds.append((cta, t + 0.2)); total = t + cta_len
    lst = os.path.join(work, 'list.txt'); open(lst, 'w').write(''.join(f"file '{s}'\n" for s in segs))
    silent = os.path.join(work, 'silent.mp4'); subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', silent], check=True)
    music = os.path.join(work, 'music.wav'); tick = os.path.join(work, 'tick.wav'); ding = os.path.join(work, 'ding.wav')
    if not os.path.exists(music): sound.make_music(music, spec.get('music_mood', 'auto'), sum(map(ord, spec['id'])))
    if not os.path.exists(tick): sound.make_sfx('tick', tick, Q_SEC - 0.2)
    if not os.path.exists(ding): sound.make_sfx('ding', ding)
    clips = sounds + [(tick, x + 0.1) for x in ticks] + [(ding, x + Q_SEC) for x in ticks]
    args = [FF, '-y', '-loglevel', 'error', '-i', silent] + sum((['-i', c[0]] for c in clips), []) + ['-stream_loop', '-1', '-i', music]
    fc = ''; mix = []
    for k, (f, at) in enumerate(clips):
        ms = int(at * 1000); vol = 1.6 if f.endswith('.mp3') else 0.5
        fc += f'[{k + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay={ms}|{ms},volume={vol}[s{k}];'; mix.append(f'[s{k}]')
    fc += f'[{len(clips) + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.12,afade=t=out:st={total - 1:.2f}:d=1[mu];'; mix.append('[mu]')
    fc += ''.join(mix) + f'amix=inputs={len(mix)}:normalize=0:duration=longest[a]'
    args += ['-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-t', f'{total:.2f}', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr[-800:])
    frame = os.path.join(work, 'cover-frame.jpg')
    if media[0][1]: subprocess.run([FF, '-y', '-loglevel', 'error', '-ss', '1', '-i', media[0][0], '-frames:v', '1', frame], check=True)
    else: frame = media[0][0]
    cv = cover(spec, frame, out.replace('.mp4', '-cover.jpg'))
    return {'out': out, 'cover': cv, 'seconds': round(total, 1), 'video_items': sum(1 for m in media if m[1]), 'image_items': sum(1 for m in media if not m[1])}


# ---------- วันละ 2 คลิป ----------
SLOTS = [12, 21]


def new_spec(used):
    prompt = ('Create ONE new set for a Thai Facebook Reel "What is this called?" teaching the English names of 8 everyday objects or actions '
              f'that can be found in free stock VIDEO footage. Sets already used (do not repeat): {", ".join(used)}. '
              'Return JSON only: {"id": "kebab-case-english-slug", "title": "short Thai title", "intro": "Thai sentence inviting viewers to guess, max 60 chars", '
              '"question": "Thai question inviting comments, max 40 chars", "items": [["English name", "Thai pronunciation in Thai script with hyphens", "short Thai meaning", '
              '"short natural English example sentence", "Thai translation of the sentence", "2-3 word English stock-video search query"] x8], '
              '"caption": "Thai Facebook caption 1-2 lines with a question + 4 hashtags"}')
    j = V.req('https://fal.run/openrouter/router/openai/v1/chat/completions', {'model': 'google/gemini-2.5-flash', 'messages': [{'role': 'user', 'content': prompt}], 'response_format': {'type': 'json_object'}}, timeout=180)
    s = json.loads(re.sub(r'^```(json)?|```$', '', j['choices'][0]['message']['content'].strip()))
    if len(s.get('items', [])) < 6: raise SystemExit('AI ให้ข้อไม่ครบ')
    s['id'] = re.sub(r'[^a-z0-9-]', '', s['id'].lower())[:40] or f'called-{int(time.time())}'; return s


def daily(dry=False):
    if not pixabay_key(): print(json.dumps({'skip': 'ยังไม่มีคีย์ Pixabay (~/.config/sheetlab/pixabay-key)'})); return
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=7)
    st = json.load(open(STATE)) if os.path.exists(STATE) else {'done': [], 'slots': []}
    nxt = None
    for dd in (0, 1):
        for h in SLOTS:
            at = (now + datetime.timedelta(days=dd)).replace(hour=h, minute=0, second=0, microsecond=0)
            if at > now + datetime.timedelta(minutes=40) and at.strftime('%Y-%m-%dT%H') not in st['slots']: nxt = nxt or at
    if not nxt or nxt - now > datetime.timedelta(hours=14): print(json.dumps({'skip': 'คิวรอบถัดไปมีแล้ว'})); return
    bank = json.load(open(BANK, encoding='utf-8'))
    spec = next((s for s in bank if s['id'] not in st['done']), None)
    if not spec: spec = new_spec([s['id'] for s in bank]); bank.append(spec); json.dump(bank, open(BANK, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    out = os.path.join(HERE, '.called_work', spec['id'] + '.mp4'); info = build(spec, out)
    if dry: print(json.dumps(info, ensure_ascii=False)); return
    up = V.shop('upload_sign', {'name': spec['id'] + '.mp4', 'type': 'video/mp4', 'folder': 'reels'})
    put = lambda url, fn, ct: urllib.request.urlopen(urllib.request.Request(url, data=open(fn, 'rb').read(), method='PUT', headers={'Content-Type': ct, 'x-upsert': 'true'}), timeout=300)
    put(up['upload_url'], out, 'video/mp4')
    cpath = up['public_url'].split('/product-images/')[1].replace('.mp4', '-cover.jpg')
    put(V.shop('upload_sign', {'name': 'cover.jpg', 'type': 'image/jpeg', 'overwrite': cpath})['upload_url'], info['cover'], 'image/jpeg')
    cap = spec.get('caption') or f'{spec["title"]} 🤔\n{spec.get("question") or "ทายถูกกี่ข้อ คอมเมนต์บอกหน่อย"} 👇\n#คำศัพท์ภาษาอังกฤษ #เรียนภาษาอังกฤษ #TOEIC #SheetLab'
    at = (nxt - datetime.timedelta(hours=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
    row = {'text': cap, 'video_url': up['public_url'], 'kind': 'reel', 'source': 'clip', 'scheduled_at': at,
           'notes': f'คลิป Reels What is this called? | {spec["id"]} | วิดีโอฟรี Pixabay {info["video_items"]} ข้อ · รูป {info["image_items"]} | {info["seconds"]} วิ'}
    r = V.shop('drafts', {'posts': [row, {**row, 'channel': 'threads', 'text': V.threads_text(cap)}]})
    st['done'].append(spec['id']); st['slots'].append(nxt.strftime('%Y-%m-%dT%H')); st['slots'] = st['slots'][-20:]
    json.dump(st, open(STATE, 'w'), ensure_ascii=False)
    print(json.dumps({'ok': r.get('ok'), 'error': r.get('error'), 'id': spec['id'], 'at_th': nxt.strftime('%Y-%m-%d %H:%M'), **{k: info[k] for k in ('seconds', 'video_items', 'image_items')}}, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'daily': daily('--dry' in sys.argv)
    elif len(sys.argv) == 3: print(json.dumps(build(json.load(open(sys.argv[1], encoding='utf-8')), sys.argv[2]), ensure_ascii=False))
    else: raise SystemExit(__doc__)
