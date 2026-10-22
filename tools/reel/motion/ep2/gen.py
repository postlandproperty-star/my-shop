# เสียงบทพูด EP.2 (สัมภาษณ์งาน) + เขียน data.js ให้หน้าแอนิเมชันรู้ความยาวแต่ละประโยค
# เสียง: voice.py (Gemini TTS ผ่าน fal) · Daniel = ผู้สัมภาษณ์ · Samantha = มิว (ชื่อเดิมจากตอนใช้เสียง Mac)
import os, sys, json, subprocess, wave
HERE = os.path.dirname(os.path.abspath(__file__)); FF = os.path.join(HERE, '../../../../node_modules/ffmpeg-static/ffmpeg')
ROUNDS = [
  {'q': 'So, why do you want this job?', 'w': 'I very like this job.', 'r': 'I really like this job.',
   'th': ['very ใช้ขยายกริยาไม่ได้', 'ชอบมาก = really like / like ... very much']},
  {'q': 'How much experience do you have?', 'w': 'I have experience three years.', 'r': 'I have three years of experience.',
   'th': ['ตัวเลขขึ้นก่อน', 'three years of experience']},
  {'q': 'Why did you leave your last job?', 'w': "I'm boring with my old job.", 'r': "I was bored with my old job.",
   'th': ['boring = ตัวเราน่าเบื่อ 😱', 'รู้สึกเบื่อ = bored']},
  {'q': 'We need someone who can work under pressure.', 'w': 'Can you speak again?', 'r': 'Sorry, could you say that again?',
   'th': ['speak again = ฟังแข็ง ไม่สุภาพ', 'ขอให้พูดซ้ำ = could you say that again?']},
  {'q': 'Do you have any questions for us?', 'w': 'No.', 'r': 'Yes. What does a typical day look like?',
   'th': ['ตอบ No = ดูไม่สนใจงาน', 'ถามกลับ 1 ข้อ ได้คะแนนเพิ่ม']},
]
LINES = {'hook': ('Samantha', "I'm boring with my old job."), 'bye': ('Daniel', "Thank you, Mew. We'll be in touch.")}
for i, r in enumerate(ROUNDS, 1):
    LINES[f'q{i}'] = ('Daniel', r['q']); LINES[f'w{i}'] = ('Samantha', r['w']); LINES[f'r{i}'] = ('Samantha', r['r'])
dur = {}
sys.path.insert(0, os.path.join(HERE, '..')); import voice  # 22 ต.ค. 69: เครดิต fal กลับมา → เสียง Gemini (ผู้สัมภาษณ์ Puck · มิว Kore) แทนเสียง Mac
for k, (v, t) in LINES.items(): dur[k] = voice._tts(HERE, k, 'fen' if v == 'Daniel' else 'men', t)
open(os.path.join(HERE, 'data.js'), 'w', encoding='utf-8').write('window.EP = ' + json.dumps({'rounds': ROUNDS, 'lines': {k: v[1] for k, v in LINES.items()}, 'dur': dur}, ensure_ascii=False) + ';\n')
print(json.dumps(dur))
