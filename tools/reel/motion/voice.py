# 🎙 เสียงบทคลิปแอนิเมชัน (ใช้ร่วมทุกตอนตั้งแต่ "ทำไมถึงเป็นแบบนั้น?" EP.1): พากย์ไทย ElevenLabs v3 ผ่าน fal · บทอังกฤษ Gemini TTS
# build(dir, LINES) → <dir>/<k>.wav + <dir>/data.js (window.EP = [{k, kind, text, dur, th?, chunks?}])
#   kind: narr = พากย์ไทย (ท่อนซับคั่นด้วย | · *คำ* = ตัวแดง) · fen = ผู้ชายอังกฤษ · men = ผู้หญิงอังกฤษ
import os, sys, json, subprocess, wave
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..')); sys.argv = sys.argv[:1]
import vocab as V
FF = os.path.join(HERE, '../../../node_modules/ffmpeg-static/ffmpeg')
NARR = os.environ.get('NARR', 'Aria')


def _tts(d, k, kind, text):
    mp3 = os.path.join(d, k + '.mp3'); wav = os.path.join(d, k + '.wav')
    if not os.path.exists(mp3):
        if kind == 'narr':
            j = V.fal('fal-ai/elevenlabs/tts/eleven-v3', {'text': text.replace('|', ' ').replace('*', ''), 'voice': NARR}, wait=300)
        else:
            j = V.fal('fal-ai/gemini-3.1-flash-tts', {'prompt': text, 'voice': 'Puck' if kind == 'fen' else 'Kore', 'language_code': 'English (US)', 'output_format': 'mp3',
                                                     'style_instructions': 'Clear, friendly English teacher, natural pace.'}, wait=300)
        V.download(j['audio']['url'], mp3)
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
