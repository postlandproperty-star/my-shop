# 🎙 เสียงบทคลิปแอนิเมชัน (ใช้ร่วมทุกตอน) · 2 แบบ:
#   free (ค่าเริ่มต้น · คุณแดน 23 ต.ค. 69 "โพสบ่อยๆ ได้เลย ถ้าไม่มีเสียเงินค่าเสียง"): อังกฤษ = Kokoro ในเครื่อง · พากย์ไทย = Google Chirp 3 HD ในโควตาฟรีเดือนละ 1 ล้านตัวอักษร
#     (ใช้โควตาร่วมกับหนังสือ /Volumes/PortableSSD/Sheetlab/_factory/tts_usage.json · ถึง 900,000 = หยุดทันที ไม่ใช้เสียงที่ต้องจ่าย) · ไม่ถอดเสียงกลับ (อ่านตามบทเป๊ะ) แต่เช็กความยาวต่อตัวอักษร
#     VOICE_PREVIEW=1 = พากย์ไทยเป็นช่วงเงียบตามความยาวประมาณ (ดูเลย์เอาต์ก่อนมีโควตา) ห้ามเอาไปโพสต์
#   paid (VOICE_ENGINE=paid): ElevenLabs v3 ผ่าน fal ทั้งพากย์ไทยและบทอังกฤษ · ทุกท่อนถอดเสียงกลับมาเทียบบท ไม่ตรง = ทำใหม่
# build(dir, LINES) → <dir>/<k>.wav + <dir>/data.js (window.EP = [{k, kind, text, dur, th?, chunks?}])
#   kind: narr = พากย์ไทย (ท่อนซับคั่นด้วย | · *คำ* = ตัวแดง) · fen = ผู้ชายอังกฤษ · men = ผู้หญิงอังกฤษ
import os, re, sys, json, difflib, subprocess, wave
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..')); sys.argv = sys.argv[:1]
import vocab as V
FF = os.path.join(HERE, '../../../node_modules/ffmpeg-static/ffmpeg')
NARR = os.environ.get('NARR', 'Aria')
ENGINE = os.environ.get('VOICE_ENGINE', 'free')
TH_VOICE = os.environ.get('TH_VOICE', 'th-TH-Chirp3-HD-Kore')  # เปลี่ยนได้: Achernar Aoede Kore Leda Zephyr (ผู้หญิง)
EN_VOICE = {'fen': os.environ.get('EN_MALE', 'bm_george'), 'men': os.environ.get('EN_FEMALE', 'bf_emma')}  # Kokoro อังกฤษสำเนียงบริติช
KOKORO = os.path.expanduser('~/Documents/Academic/_kit/kokoro/venv/bin/python')
GKEY = os.path.expanduser('~/Documents/Academic/.google_tts_key')
USAGE = '/Volumes/PortableSSD/Sheetlab/_factory/tts_usage.json'; CAP = min(990_000, int(os.environ.get('TTS_CAP', 900_000)))  # TTS_CAP ยกเพดานได้ชั่วคราว แต่ไม่เกิน 990,000 (ฟรี 1 ล้าน)


def _norm(x): return re.sub(r'[^0-9a-z\u0E00-\u0E7F]', '', x.lower())


def heard(mp3, lang):
    """ถอดเสียงกลับเป็นข้อความ (ElevenLabs Scribe) ไว้ตรวจว่าเสียงพูดตรงบท"""
    r = V.req('https://fal.run/fal-ai/elevenlabs/speech-to-text/scribe-v2', {'audio_url': V.data_uri(mp3, 'audio/mpeg'), 'language_code': lang}, timeout=180)
    return re.sub(r'\[[^\]]*\]', '', r.get('text') or '')


def _gen(kind, text, mp3):
    # อังกฤษใช้ ElevenLabs (22 ต.ค. 69: Gemini TTS อ่านคำสั่ง style ออกเสียงเป็นบทพูด เช่น "Friendly tourist, natural pace." และปัดประโยคสั้นๆ)
    voice = NARR if kind == 'narr' else 'Brian' if kind == 'fen' else 'Sarah'
    j = V.fal('fal-ai/elevenlabs/tts/eleven-v3', {'text': text.replace('|', ' ').replace('*', ''), 'voice': voice}, wait=300)
    V.download(j['audio']['url'], mp3)


def _tts(d, k, kind, text):
    mp3 = os.path.join(d, k + '.mp3'); wav = os.path.join(d, k + '.wav')
    want = _norm(text.replace('|', '').replace('*', ''))
    for attempt in range(3):
        if not os.path.exists(mp3): _gen(kind, text, mp3)
        got = _norm(heard(mp3, 'tha' if kind == 'narr' else 'eng'))
        ok = difflib.SequenceMatcher(None, want, got).ratio() >= 0.8
        if ok: break
        print(f'เสียง {k} ไม่ตรงบท ({got[:60]}) ทำใหม่')
        for f in (mp3, wav, mp3.replace('.mp3', '-trim.mp3')):
            if os.path.exists(f): os.remove(f)
    else: raise SystemExit(f'เสียง {k} ไม่ตรงบทหลังลอง 3 รอบ')
    if not os.path.exists(wav): subprocess.run([FF, '-v', 'error', '-y', '-i', V.trim(mp3), '-ar', '44100', '-ac', '2', wav], check=True)
    with wave.open(wav) as w: return round(w.getnframes() / w.getframerate(), 2)


def _usage():
    import datetime
    m = datetime.datetime.now().strftime('%Y-%m')
    try: u = json.load(open(USAGE))
    except FileNotFoundError: u = {}
    return m, (u.get('chars', 0) if u.get('month') == m else 0)


def _google_th(text, mp3):
    """พากย์ไทยด้วย Google Chirp 3 HD (โควตาฟรี) · เกินเพดาน CAP (ค่าเริ่ม 900,000) ในเดือนนี้ = หยุด"""
    import urllib.request, base64
    m, used = _usage(); n = len(text)
    if used + n > CAP: raise SystemExit(f'โควตาเสียงฟรี Google เดือน {m} ใช้ไป {used:,} ตัวอักษร (เพดาน {CAP:,}) · ไม่ทำเสียงที่ต้องจ่าย รอต้นเดือนหน้า หรือรันด้วย VOICE_PREVIEW=1 เพื่อดูเลย์เอาต์')
    key = open(GKEY).read().strip()
    body = json.dumps({'input': {'text': text}, 'voice': {'languageCode': 'th-TH', 'name': TH_VOICE}, 'audioConfig': {'audioEncoding': 'MP3'}}).encode()
    req = urllib.request.Request(f'https://texttospeech.googleapis.com/v1/text:synthesize?key={key}', body, {'Content-Type': 'application/json'})
    open(mp3, 'wb').write(base64.b64decode(json.load(urllib.request.urlopen(req, timeout=60))['audioContent']))
    m2, used2 = _usage(); json.dump({'month': m2, 'chars': used2 + n}, open(USAGE, 'w'))
    return n


def _free(d, LINES):
    """ทำเสียงทั้งตอนแบบฟรี → <k>.wav (44.1k สเตอริโอ ตัดเงียบหัวท้าย) · คืน {k: วินาที}"""
    cut = 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03'
    lvl = 'loudnorm=I=-19:TP=-2:LRA=11'  # ดังเท่าเสียงชุดเดิม (Kokoro ออกมาเบากว่า ~5 dB)
    prev = os.environ.get('VOICE_PREVIEW') == '1'; jobs = []; th = 0
    for row in LINES:
        k, kind, text = row[:3]; wav = os.path.join(d, k + '.wav'); clean = text.replace('|', ' ').replace('*', '')
        if os.path.exists(wav) and not os.path.exists(wav + '.preview'): continue
        if kind == 'narr':
            if prev:  # ช่วงเงียบยาวตามจำนวนตัวอักษร (ไทยราว 0.085 วิ/ตัว)
                subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', f'{max(1.2, len(clean) * 0.085):.2f}', wav], check=True); open(wav + '.preview', 'w').write('1'); continue
            mp3 = os.path.join(d, k + '.mp3'); th += _google_th(clean, mp3)
            subprocess.run([FF, '-v', 'error', '-y', '-i', mp3, '-af', f'{cut},areverse,{cut},areverse,{lvl}', '-ar', '44100', '-ac', '2', wav], check=True)
            if os.path.exists(wav + '.preview'): os.remove(wav + '.preview')
        else: jobs.append({'out': os.path.join(d, k + '.raw.wav'), 'voice': EN_VOICE.get(kind, 'bf_emma'), 'text': clean, 'k': k})
    if jobs:
        jf = os.path.join(d, '.kokoro-jobs.json'); json.dump(jobs, open(jf, 'w'))
        subprocess.run([KOKORO, os.path.join(HERE, 'kokoro_lines.py'), jf], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); os.remove(jf)
        for j in jobs:
            subprocess.run([FF, '-v', 'error', '-y', '-i', j['out'], '-af', f'{cut},areverse,{cut},areverse,{lvl}', '-ar', '44100', '-ac', '2', os.path.join(d, j['k'] + '.wav')], check=True); os.remove(j['out'])
    durs = {}
    for row in LINES:
        k, kind, text = row[:3]
        with wave.open(os.path.join(d, k + '.wav')) as w: durs[k] = round(w.getnframes() / w.getframerate(), 2)
        spc = durs[k] / max(1, len(text.replace('|', '').replace('*', '')))
        if not os.path.exists(os.path.join(d, k + '.wav.preview')) and not (0.03 <= spc <= 0.2): print(f'⚠️ เสียง {k} ยาวผิดปกติ ({durs[k]} วิ สำหรับ {len(text)} ตัวอักษร) ฟังเช็กก่อนโพสต์')
    if th: print(f'โควตาเสียงฟรี Google: ใช้รอบนี้ {th:,} ตัวอักษร · เดือนนี้รวม {_usage()[1]:,} / 1,000,000')
    if prev: print('⚠️ VOICE_PREVIEW: พากย์ไทยยังเป็นช่วงเงียบ ห้ามโพสต์ · รันใหม่ไม่ใส่ VOICE_PREVIEW เมื่อมีโควตา')
    return durs


def build(d, LINES):
    out = []; free = _free(d, LINES) if ENGINE == 'free' else None
    for row in LINES:
        k, kind, text = row[:3]; dur = free[k] if free else _tts(d, k, kind, text)
        item = {'k': k, 'kind': kind, 'text': text, 'dur': dur}
        if len(row) > 3: item['th'] = row[3]
        if kind == 'narr':  # ซับทีละท่อน: แบ่งเวลาตามจำนวนตัวอักษร
            parts = text.split('|'); n = sum(len(p.replace('*', '')) for p in parts); at = 0; item['chunks'] = []
            for p in parts: L = len(p.replace('*', '')) / n * dur; item['chunks'].append([round(at, 2), round(at + L, 2), p]); at += L
        out.append(item); print(k, dur)
    open(os.path.join(d, 'data.js'), 'w', encoding='utf-8').write('window.EP = ' + json.dumps(out, ensure_ascii=False) + ';\n')
