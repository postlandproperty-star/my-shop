# 🎙 เสียงบทคลิปแอนิเมชัน (ใช้ร่วมทุกตอน): ElevenLabs v3 ผ่าน fal ทั้งพากย์ไทยและบทอังกฤษ · ทุกท่อนถอดเสียงกลับมาเทียบบท ไม่ตรง = ทำใหม่
# build(dir, LINES) → <dir>/<k>.wav + <dir>/data.js (window.EP = [{k, kind, text, dur, th?, chunks?}])
#   kind: narr = พากย์ไทย (ท่อนซับคั่นด้วย | · *คำ* = ตัวแดง) · fen = ผู้ชายอังกฤษ · men = ผู้หญิงอังกฤษ
import os, re, sys, json, difflib, subprocess, wave
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..')); sys.argv = sys.argv[:1]
import vocab as V
FF = os.path.join(HERE, '../../../node_modules/ffmpeg-static/ffmpeg')
NARR = os.environ.get('NARR', 'Aria')


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


def build(d, LINES):
    out = []
    for row in LINES:
        k, kind, text = row[:3]; dur = _tts(d, k, kind, text)
        item = {'k': k, 'kind': kind, 'text': text, 'dur': dur}
        if len(row) > 3: item['th'] = row[3]
        if kind == 'narr':  # ซับทีละท่อน: แบ่งเวลาตามจำนวนตัวอักษร
            parts = text.split('|'); n = sum(len(p.replace('*', '')) for p in parts); at = 0; item['chunks'] = []
            for p in parts: L = len(p.replace('*', '')) / n * dur; item['chunks'].append([round(at, 2), round(at + L, 2), p]); at += L
        out.append(item); print(k, dur)
    open(os.path.join(d, 'data.js'), 'w', encoding='utf-8').write('window.EP = ' + json.dumps(out, ensure_ascii=False) + ';\n')
