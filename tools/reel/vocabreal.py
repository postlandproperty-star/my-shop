#!/usr/bin/env python3
"""คลิปคำศัพท์แบบใหม่ (คุณแดน 16 ต.ค. 69 "มั่วมาก" กับคลิป AI เดิม → 17 ต.ค. "อยากได้ ai 100% มากกว่า มันจะตรงกว่า")
  python3 tools/reel/vocabreal.py make [lv] [unitId] [--post]   ทำ 1 คลิป (ไม่ใส่ = บทถัดไปที่ยังไม่เคยทำ) · --post = ส่งเข้าคิวโพสต์ (รอคุณแดนอนุมัติ)
  python3 tools/reel/vocabreal.py daily [--dry]                วันละ 1 คลิป (19:00 น.) แทนคลิปคำศัพท์ AI เดิม
- คำศัพท์จากแอป /vocab (src/vocab/a1–b2.json ตรวจแล้ว) เฉพาะคำที่มีรูปได้ (img) · ไม่มีคำอ่านไทย (เคยเพี้ยน "มี-ทิง")
- ภาพ AI ต่อคำ วาดจากประโยคตัวอย่าง (nano-banana) + AI ตรวจว่าเห็นคำนั้นชัด · ไม่มีพิธีกร AI
- เสียง: อังกฤษอ่านคำ + ประโยคตัวอย่าง · ไทยอ่านความหมาย (Gemini TTS บน fal)
  ทุกไฟล์เสียง AI ฟังถอดความแล้วเทียบกับตัวหนังสือบนจอ ไม่ตรง = ทำใหม่ (คุณแดน 17 ต.ค. "เสียงไม่ตรงกับตัวอักษร")
  ไฟล์เสียงตั้งชื่อตามข้อความ (เคยตั้งตามลำดับข้อ แล้วเสียงคำเก่าค้างมาใส่คำใหม่)
- ท้ายคลิปชวนฝึกต่อฟรีที่ sheetlabth.com/vocab
"""
import sys, os, re, json, time, base64, hashlib, difflib, subprocess, datetime
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import vocab as V
import called as C
import sound

FF, W, H = V.FF, V.W, V.H
BLUE, INK, RED, WHITE, YEL = V.BLUE, V.INK, V.RED, V.WHITE, V.YEL
ROOT = V.ROOT; LEVELS = ['a1', 'a2', 'b1', 'b2']
STATE = os.path.join(HERE, 'called', 'vocabreal-state.json')
N_WORDS = 6


def load_unit(lv, uid):
    d = json.load(open(os.path.join(ROOT, 'src', 'vocab', lv + '.json'), encoding='utf-8'))
    return next((u for u in d['units'] if str(u['id']) == str(uid)), None)


def next_unit(st):
    for lv in LEVELS:
        d = json.load(open(os.path.join(ROOT, 'src', 'vocab', lv + '.json'), encoding='utf-8'))
        for u in d['units']:
            key = f'{lv}.{u["id"]}'
            if key in st['done']: continue
            if sum(1 for w in u['words'] if w.get('img') and w.get('pos') in ('noun', 'verb')) >= N_WORDS + 2: return lv, u
    return None, None


def vbase(i, n, unit, fn):
    """พื้นหลัง: ไล่สีฟ้า + หัวข้อบท (อังกฤษ/ไทย) + กรอบวิดีโอ + ลำดับคำ"""
    im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H; d.line([(0, y), (W, y)], fill=(int(140 - 97 * t), int(190 - 119 * t), int(255 - 15 * t)))
    d.rounded_rectangle([90, 120, W - 90, 290], 50, fill=INK)
    d.text((W / 2, 180), unit['t'], font=C.fit(d, [unit['t']], 'xb', 74, W - 260), fill=WHITE, anchor='mm')
    d.text((W / 2, 250), f'ศัพท์{unit["th"]}', font=V.font('sb', 46), fill=YEL, anchor='mm')
    d.rounded_rectangle([30, C.VY - 10, 40 + C.VS + 10, C.VY + C.VS + 10], 36, fill=WHITE)
    if i >= 0:
        c = f'{i + 1}/{n}'; fc = V.font('xb', 44); cw = d.textlength(c, font=fc) + 50
        d.rounded_rectangle([60, H - 132, 60 + cw, H - 62], 35, fill=YEL); d.text((60 + cw / 2, H - 97), c, font=fc, fill=INK, anchor='mm')
    fs = V.font('sb', 38); t = 'SheetLab'; tw = d.textlength(t, font=fs)
    d.rounded_rectangle([W - tw - 110, H - 130, W - 60, H - 62], 34, fill=WHITE, outline=INK, width=4); d.text((W - 85 - tw / 2, H - 96), t, font=fs, fill=INK, anchor='mm')
    im.save(fn); return fn


def vcover(unit, n, frame, fn):
    """ปกคลิป: เฟรมแรกเต็มจอ + หัวข้อ (อยู่ในกรอบ 3:4 ที่หน้าโปรไฟล์ตัดโชว์)"""
    src = Image.open(frame).convert('RGB'); sc = max(W / src.width, H / src.height); src = src.resize((int(src.width * sc) + 1, int(src.height * sc) + 1))
    im = src.crop(((src.width - W) // 2, (src.height - H) // 2, (src.width - W) // 2 + W, (src.height - H) // 2 + H))
    im = Image.alpha_composite(im.convert('RGBA'), Image.new('RGBA', (W, H), (10, 20, 60, 120))); d = ImageDraw.Draw(im)
    ls = [f'ศัพท์{unit["th"]}']; f = C.fit(d, ls, 'xb', 110, W - 160)
    d.rounded_rectangle([170, 640, W - 170, 750], 55, fill=INK); d.text((W / 2, 695), unit['t'], font=C.fit(d, [unit['t']], 'xb', 58, W - 400), fill=WHITE, anchor='mm')
    d.text((W / 2, 880), ls[0], font=f, fill=WHITE, anchor='mm', stroke_width=8, stroke_fill=INK)
    b = f'{n} คำ · ฟังแล้วพูดตาม'; fb = V.font('xb', 60); bw = d.textlength(b, font=fb) + 80
    d.rounded_rectangle([(W - bw) / 2, 1000, (W + bw) / 2, 1100], 50, fill=YEL); d.text((W / 2, 1050), b, font=fb, fill=INK, anchor='mm')
    im.convert('RGB').save(fn, 'JPEG', quality=90); return fn


def hear(fn):
    """AI ฟังไฟล์เสียงแล้วถอดความ (Gemini บน fal)"""
    b = base64.b64encode(open(fn, 'rb').read()).decode()
    j = V.req('https://fal.run/openrouter/router/openai/v1/chat/completions', {'model': 'google/gemini-2.5-flash', 'max_tokens': 120, 'temperature': 0, 'messages': [{'role': 'user', 'content': [
        {'type': 'text', 'text': 'Transcribe this audio exactly as spoken, in its original language. Output only the transcription.'},
        {'type': 'input_audio', 'input_audio': {'data': b, 'format': 'mp3'}}]}]}, timeout=90)
    return str(j['choices'][0]['message']['content'] or '')


def norm(t): return re.sub(r'[\s\W_]+', '', str(t).lower())


def voice(lang, options, want, work):
    """เสียงที่ AI ฟังแล้วตรงกับข้อความ · want = [ข้อความที่ต้องได้ยิน] (คำ/ความหมาย ต้องมีครบ) หรือ str (ทั้งประโยค ตรง ≥85%)"""
    for opt in options:
        for k in range(2):
            fn = os.path.join(work, f'{lang}-{hashlib.md5((opt + str(k)).encode()).hexdigest()[:12]}.mp3')
            try: t = C.en_tts(opt, fn) if lang == 'en' else V.trim(V.thai_tts(opt, fn, C.VOICE_TH))
            except SystemExit as e: print('tts:', str(e)[:120], file=sys.stderr); continue
            got = norm(hear(t))
            ok = all(norm(x) in got for x in want) if isinstance(want, list) else difflib.SequenceMatcher(None, norm(want), got).ratio() >= 0.85
            if ok: return t
            print(f'เสียงไม่ตรง ทำใหม่: อยากได้ {want} ได้ยิน {got}', file=sys.stderr)
    return None


def ai_pic(w, unit, fn):
    """ภาพ AI ของคำนี้ วาดตามประโยคตัวอย่าง + AI ตรวจว่าเห็นคำนั้นชัดเป็นหลัก (2 รอบ ไม่ผ่าน = ข้ามคำ)"""
    if os.path.exists(fn): return fn
    word, hint = w['w'], f'{w["th"]} · {w.get("def", "")}'
    prompt = (f'A realistic, natural-looking photo for an English vocabulary lesson about "{word}" ({w.get("def", "")}). Scene: {w["ex"]} '
              f'The {word} must be the large, sharp, obvious main subject in the center, well lit, everyday setting. Square framing. No text, no letters, no watermark.')
    for _ in range(2):
        u = V.fal('fal-ai/nano-banana', {'prompt': prompt, 'aspect_ratio': '1:1', 'output_format': 'jpeg'})['images'][0]['url']
        try:
            j = V.req('https://fal.run/openrouter/router/openai/v1/chat/completions', {'model': 'google/gemini-2.5-flash', 'max_tokens': 5, 'messages': [{'role': 'user', 'content': [
                {'type': 'text', 'text': f'Does this image clearly show a {word} ({hint}) as the main subject, so a learner can tell what "{word}" means from the image alone, with no visible text or distorted objects? Answer only YES or NO.'},
                {'type': 'image_url', 'image_url': {'url': u}}]}]}, timeout=60)
            if 'YES' in str(j['choices'][0]['message']['content']).upper(): V.download(u, fn); return fn
        except SystemExit as e: print('vision:', e, file=sys.stderr)
    return None


def card(w, fn):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    word = w['w']; fw = V.font('xb', 128 if len(word) <= 10 else 100)
    d.text((W / 2, 1410), word, font=fw, fill=RED, anchor='mm', stroke_width=10, stroke_fill=WHITE)
    fp = V.font('sb', 56); t = w['th']; tw = d.textlength(t, font=fp) + 80
    d.rounded_rectangle([(W - tw) / 2, 1495, (W + tw) / 2, 1585], 45, fill=WHITE); d.text((W / 2, 1540), t, font=fp, fill=BLUE, anchor='mm')
    fe, ft = V.font('sb', 46), V.font('md', 42); y = 1650
    for l in C.wrap(d, w['ex'], fe, W - 140)[:2]: d.text((W / 2, y), l, font=fe, fill=WHITE, anchor='mm', stroke_width=3, stroke_fill=INK); y += 58
    for l in C.wrap(d, w.get('exth', ''), ft, W - 140)[:2]: d.text((W / 2, y + 6), l, font=ft, fill=YEL, anchor='mm', stroke_width=3, stroke_fill=INK); y += 54
    im.save(fn); return fn


def build(lv, unit, out):
    work = os.path.join(HERE, '.called_work', f'vrai-{lv}-{unit["id"]}'); os.makedirs(work, exist_ok=True)
    pool = [w for w in unit['words'] if w.get('img') and w.get('pos') in ('noun', 'verb')]
    items = []
    for w in pool:
        if len(items) >= N_WORDS: break
        th1 = re.split(r'[,/]', w['th'])[0].strip()
        pic = ai_pic(w, unit, os.path.join(work, f'pic-{re.sub(r"[^a-z0-9]+", "_", w["w"].lower())}.jpg'))
        en_w = pic and voice('en', [f'{w["w"]}.', f'The word is {w["w"]}.'], [w['w']], work)
        th_m = en_w and voice('th', [f'แปลว่า {w["th"]}', f'คำนี้แปลว่า {w["th"]} ค่ะ'], [th1], work)
        en_s = th_m and voice('en', [w['ex']], w['ex'], work)
        if en_s: items.append((w, pic, en_w, th_m, en_s))  # ภาพ/เสียงไม่ผ่านการตรวจ = ข้ามคำ
    if len(items) < 4: raise SystemExit(f'คำที่ผ่านการตรวจไม่พอ ({len(items)} คำ) บท {lv}.{unit["id"]}')
    n = len(items); title = f'ศัพท์{unit["th"]} ที่ต้องรู้'
    intro = voice('th', [f'ศัพท์{unit["th"]} {n} คำ ที่ใช้บ่อย'], [unit['th']], work)
    cta = voice('th', ['ฝึกครบทั้งบทฟรี ที่ชีทแล็บ คำศัพท์สามพันคำ'], ['ฝึกครบทั้งบทฟรี'], work)
    if not intro or not cta: raise SystemExit('เสียงเปิด/ปิดคลิปไม่ผ่านการตรวจ')
    fr = lambda x: round(x * 24) / 24  # ปัดเป็นเฟรมพอดี เสียงจะได้ไม่เลื่อนสะสม
    intro_len = fr(V.dur(intro) + 0.5); cta_len = fr(V.dur(cta) + 1.2)
    segs, sounds, t = [], [(intro, 0.15)], 0.0
    segs.append(C.segment(items[0][1], False, 0, intro_len, vbase(-1, n, unit, os.path.join(work, 'b-intro.png')),
                          [(C.big_card([title], f'{n} คำ · ฟังแล้วพูดตาม', os.path.join(work, 'intro.png')), 0, intro_len)], os.path.join(work, 's-intro.mp4')))
    t += intro_len
    for i, (w, v, en_w, th_m, en_s) in enumerate(items):
        a = V.dur(en_w); b = V.dur(th_m); c = V.dur(en_s); d = fr(0.25 + a + 0.35 + b + 0.35 + c + 0.7)
        segs.append(C.segment(v, False, 0, d, vbase(i, n, unit, os.path.join(work, f'b{i}.png')), [(card(w, os.path.join(work, f'a{i}.png')), 0, d)], os.path.join(work, f's{i}.mp4')))
        sounds += [(en_w, t + 0.25), (th_m, t + 0.25 + a + 0.35), (en_s, t + 0.25 + a + 0.35 + b + 0.35)]; t += d
    segs.append(C.segment(items[-1][1], False, 0, cta_len, vbase(-1, n, unit, os.path.join(work, 'b-end.png')),
                          [(C.big_card(['ฝึกครบทั้งบทฟรี'], 'sheetlabth.com/vocab', os.path.join(work, 'end.png')), 0, cta_len)], os.path.join(work, 's-end.mp4')))
    sounds.append((cta, t + 0.2)); total = t + cta_len
    lst = os.path.join(work, 'list.txt'); open(lst, 'w').write(''.join(f"file '{s}'\n" for s in segs))
    silent = os.path.join(work, 'silent.mp4'); subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', silent], check=True)
    music = os.path.join(work, 'music.wav')
    if not os.path.exists(music): sound.make_music(music, 'auto', sum(map(ord, unit['t'])))
    args = [FF, '-y', '-loglevel', 'error', '-i', silent] + sum((['-i', c[0]] for c in sounds), []) + ['-stream_loop', '-1', '-i', music]
    fc, mix = '', []
    for k, (f, at) in enumerate(sounds):
        ms = int(at * 1000); fc += f'[{k + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay={ms}|{ms},volume=1.6[s{k}];'; mix.append(f'[s{k}]')
    fc += f'[{len(sounds) + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.10,afade=t=out:st={total - 1:.2f}:d=1[mu];'; mix.append('[mu]')
    fc += ''.join(mix) + f'amix=inputs={len(mix)}:normalize=0:duration=longest[a]'
    args += ['-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-t', f'{total:.2f}', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr[-800:])
    cv = vcover(unit, n, items[0][1], out.replace('.mp4', '-cover.jpg'))
    return {'out': out, 'cover': cv, 'seconds': round(total, 1), 'words': [it[0]['w'] for it in items], 'lv': lv, 'unit': unit['id'], 'title': title}


def post(info, at_iso=None):
    sys.path.insert(0, os.path.join(ROOT, 'tools', 'r2')); import r2
    rkey = f"reels/{int(time.time() * 1000)}-vocab-{info['lv']}-{info['unit']}.mp4"
    url = r2.put_file(info['out'], rkey, 'video/mp4'); r2.put_file(info['cover'], rkey.replace('.mp4', '-cover.jpg'), 'image/jpeg')
    cap = (f'{info["title"]} 🎧\n{" · ".join(info["words"])}\nคำไหนใช้บ่อยสุด คอมเมนต์เลย 👇\n'
           f'ฝึกครบทั้งบทฟรี 👉 sheetlabth.com/vocab/{info["lv"]}/{info["unit"]}\n#คำศัพท์ภาษาอังกฤษ #เรียนภาษาอังกฤษ #TOEIC #IELTS')
    row = {'text': cap, 'video_url': url, 'kind': 'reel', 'source': 'clip', **({'scheduled_at': at_iso} if at_iso else {}),
           'notes': f'คลิปคำศัพท์ AI (ตรวจเสียงแล้ว) | {info["lv"]}.{info["unit"]} | {len(info["words"])} คำ | {info["seconds"]} วิ'}
    return V.shop('drafts', {'posts': [row, {**row, 'channel': 'threads', 'text': V.threads_text(cap)}]})


def daily(dry=False):
    V.single_run('vocabreal')
    if V.fal_broke(): print(json.dumps({'skip': 'เครดิต fal หมด (เติมที่ fal.ai/dashboard/billing)'}, ensure_ascii=False)); return
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=7)
    st = json.load(open(STATE)) if os.path.exists(STATE) else {'done': [], 'days': []}
    day = (now if now.hour < 18 else now + datetime.timedelta(days=1)).strftime('%Y-%m-%d')
    if day in st['days']: print(json.dumps({'skip': 'วันนี้ทำแล้ว'})); return
    lv, unit = next_unit(st)
    if not unit: print(json.dumps({'skip': 'ทำครบทุกบทแล้ว'})); return
    try: info = build(lv, unit, os.path.join(HERE, '.called_work', f'vrai-{lv}-{unit["id"]}.mp4'))
    except SystemExit as e: st['done'].append(f'{lv}.{unit["id"]}'); json.dump(st, open(STATE, 'w')); print(json.dumps({'skip': str(e)}, ensure_ascii=False)); return
    if dry: print(json.dumps(info, ensure_ascii=False)); return
    V.video_ok(info['out'])
    at = datetime.datetime.strptime(day, '%Y-%m-%d').replace(hour=19) - datetime.timedelta(hours=7)
    r = post(info, at.strftime('%Y-%m-%dT%H:%M:%SZ'))
    st['done'].append(f'{lv}.{unit["id"]}'); st['days'] = (st['days'] + [day])[-30:]; json.dump(st, open(STATE, 'w'))
    print(json.dumps({'ok': r.get('ok'), 'error': r.get('error'), 'unit': f'{lv}.{unit["id"]}', 'words': info['words'], 'seconds': info['seconds']}, ensure_ascii=False))


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'daily': daily('--dry' in a)
    elif a and a[0] == 'make':
        st = json.load(open(STATE)) if os.path.exists(STATE) else {'done': [], 'days': []}
        rest = [x for x in a[1:] if not x.startswith('--')]
        lv, unit = (rest[0], load_unit(rest[0], rest[1])) if len(rest) >= 2 else next_unit(st)
        info = build(lv, unit, os.path.join(HERE, '.called_work', f'vrai-{lv}-{unit["id"]}.mp4'))
        if '--post' in a: info['post'] = post(info)
        print(json.dumps(info, ensure_ascii=False))
    else: raise SystemExit(__doc__)
