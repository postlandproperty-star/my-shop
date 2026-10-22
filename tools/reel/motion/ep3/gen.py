# EP.3 "ฝรั่งถามทาง" แนวเรื่องเล่ามีเสียงพากย์ไทย (คุณแดน 22 ต.ค. 69 ส่งตัวอย่าง ZIAK Story: พากย์ไทย + ซับคำต่อคำ คำสำคัญสีแดง + การ์ดกฎข้อ)
# พากย์ไทย = ElevenLabs v3 ผ่าน fal (เสียง Aria) · บทอังกฤษ = Gemini TTS (ฝรั่ง Puck · มิว Kore) · เขียน data.js: บท ความยาว และช่วงซับแต่ละท่อน
#   ท่อนซับคั่นด้วย | · *คำ* = ตัวแดง
import os, sys, json, subprocess, wave
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../..')); sys.argv = sys.argv[:1]
import vocab as V
FF = os.path.join(HERE, '../../../../node_modules/ffmpeg-static/ffmpeg')
NARR = 'Aria'
LINES = [
  ('n1', 'narr', 'ถ้าวันหนึ่ง|มี*ฝรั่ง*เดินมาถามทางคุณ|สิ่งที่น่ากลัวที่สุด|ไม่ใช่*ฟังไม่ออก*'),
  ('n2', 'narr', 'แต่คือ|ตอบว่า *Yes*|ทั้งที่*ไม่รู้เรื่อง*'),
  ('f1', 'fen', 'Excuse me, how do I get to the Grand Palace?', 'ขอโทษครับ ไปพระบรมมหาราชวังยังไงครับ?'),
  ('m1', 'men', 'Yes! Yes!', 'เยส! เยส!'),
  ('f2', 'fen', 'Um... okay?', 'เอ่อ... โอเค?'),
  ('n3', 'narr', 'มิวก็เหมือน*คนไทยหลายคน*|ตกใจจนตอบ Yes ไปก่อน|วันนี้*พี่ชีท*|มีกฎ 3 ข้อมาฝาก'),
  ('n4', 'narr', '*กฎข้อ 1*|ฟังไม่ทัน อย่าเดา|ให้ขอเขา*พูดซ้ำ*'),
  ('m2', 'men', 'Sorry, could you say that again?', 'ขอโทษค่ะ พูดอีกครั้งได้ไหมคะ?'),
  ('f3', 'fen', 'How do I get to the Grand Palace?', 'ไปพระบรมมหาราชวังยังไงครับ?'),
  ('n5', 'narr', '*กฎข้อ 2*|ไม่ต้องฟังทุกคำ|จับแค่*คำสำคัญ*|Grand Palace|ก็คือ*พระบรมมหาราชวัง*'),
  ('n6', 'narr', '*กฎข้อ 3*|ตอบเป็น*ประโยคสั้นๆ*|ทีละขั้น'),
  ('m3', 'men', 'Take the BTS to Saphan Taksin. Then take the boat.', 'นั่ง BTS ไปสะพานตากสิน แล้วต่อเรือค่ะ'),
  ('f4', 'fen', 'Thank you so much!', 'ขอบคุณมากครับ!'),
  ('n7', 'narr', 'รอดไปหนึ่งด่าน|แต่ถ้าฝรั่ง*ชวนคุยต่อ*ล่ะ?|มิวจะ*รอด*ไหม|ติดตามตอนต่อไป'),
]


def tts(k, kind, text):
    mp3 = os.path.join(HERE, k + '.mp3'); wav = os.path.join(HERE, k + '.wav')
    if not os.path.exists(mp3):
        if kind == 'narr':
            j = V.fal('fal-ai/elevenlabs/tts/eleven-v3', {'text': text.replace('|', ' ').replace('*', ''), 'voice': NARR}, wait=300)
        else:
            j = V.fal('fal-ai/gemini-3.1-flash-tts', {'prompt': text, 'voice': 'Puck' if kind == 'fen' else 'Kore', 'language_code': 'English (US)', 'output_format': 'mp3',
                                                     'style_instructions': 'Friendly tourist, natural pace.' if kind == 'fen' else 'Nervous young Thai woman speaking English, natural.'}, wait=300)
        V.download(j['audio']['url'], mp3)
    if not os.path.exists(wav):
        subprocess.run([FF, '-v', 'error', '-y', '-i', V.trim(mp3), '-ar', '44100', '-ac', '2', wav], check=True)
    with wave.open(wav) as w: return round(w.getnframes() / w.getframerate(), 2)


out = []
for row in LINES:
    k, kind, text = row[:3]
    try: d = tts(k, kind, text)
    except SystemExit as e: print('ข้าม', k, str(e)[:120]); d = None  # ยังไม่มีเสียง (เช่นเครดิต fal หมด) → หน้าแอนิเมชันใช้เวลาประมาณจากความยาวข้อความ
    if d is None: d = round(len(text.replace('|', '').replace('*', '')) * (0.11 if kind == 'narr' else 0.07) + 0.6, 2); item_missing = True
    else: item_missing = False
    item = {'k': k, 'kind': kind, 'text': text, 'dur': d, **({'missing': True} if item_missing else {})}
    if len(row) > 3: item['th'] = row[3]
    if kind == 'narr':  # ซับทีละท่อน: แบ่งเวลาตามจำนวนตัวอักษร
        parts = text.split('|'); n = sum(len(p.replace('*', '')) for p in parts); at = 0; item['chunks'] = []
        for p in parts: L = len(p.replace('*', '')) / n * d; item['chunks'].append([round(at, 2), round(at + L, 2), p]); at += L
    out.append(item); print(k, d)
open(os.path.join(HERE, 'data.js'), 'w', encoding='utf-8').write('window.EP = ' + json.dumps(out, ensure_ascii=False) + ';\n')
