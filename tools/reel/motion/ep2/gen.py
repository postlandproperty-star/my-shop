# เสียงบทพูด EP.2 (สัมภาษณ์งาน) + เขียน data.js ให้หน้าแอนิเมชันรู้ความยาวแต่ละประโยค
# ตอนนี้ใช้เสียงใน Mac (say) เพราะเครดิต fal หมด 22 ต.ค. 69 · ผู้สัมภาษณ์ = Daniel (UK) · มิว = Samantha (US)
import os, json, subprocess, wave
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
for k, (v, t) in LINES.items():
    wav = os.path.join(HERE, k + '.wav')
    if not os.path.exists(wav):
        aiff = wav[:-4] + '.aiff'
        subprocess.run(['say', '-v', v, '-r', '168', '-o', aiff, t], check=True)
        subprocess.run([FF, '-v', 'error', '-y', '-i', aiff, '-ar', '44100', '-ac', '2', wav], check=True); os.remove(aiff)
    with wave.open(wav) as w: dur[k] = round(w.getnframes() / w.getframerate(), 2)
open(os.path.join(HERE, 'data.js'), 'w', encoding='utf-8').write('window.EP = ' + json.dumps({'rounds': ROUNDS, 'lines': {k: v[1] for k, v in LINES.items()}, 'dur': dur}, ensure_ascii=False) + ';\n')
print(json.dumps(dur))
