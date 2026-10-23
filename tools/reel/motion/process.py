# 📈 ทำคลิป "IELTS Process 60 วิ" ตอนใหม่ด้วยคำสั่งเดียว (คุณแดน 23 ต.ค. 69 คลิปแนวนี้เป็นหลัก · เสียงฟรีเท่านั้น)
#   1) เขียน tools/reel/motion/process/<slug>/spec.json (ดูตัวอย่าง process/water/spec.json)
#   2) python3 tools/reel/motion/process.py <slug> [--out คลิป.mp4] [--preview]
#      → เสียงฟรี (voice.py: อังกฤษ Kokoro · ไทย Google โควตาฟรี) → process-<slug>.html จากแม่แบบ process.html → อัดคลิป + ปก (-cover.jpg)
#      --preview = พากย์ไทยเป็นช่วงเงียบ ไว้ดูเลย์เอาต์ตอนโควตา Google หมด (ห้ามโพสต์)
import os, sys, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
args = sys.argv[1:]; slug = args[0]; preview = '--preview' in args
out = args[args.index('--out') + 1] if '--out' in args else os.path.join(HERE, '.work', f'process-{slug}.mp4')
if preview: os.environ['VOICE_PREVIEW'] = '1'
sys.argv = sys.argv[:1]; sys.path.insert(0, HERE); import voice
D = os.path.join(HERE, 'process', slug); S = json.load(open(os.path.join(D, 'spec.json'), encoding='utf-8'))
LINES = [('n1', 'narr', S['n1']), ('n2', 'narr', S['n2'])]
for i, st in enumerate(S['stages'], 1):
    LINES += [(f's{i}', 'narr', st['th']), (f'e{i}', st.get('voice') or ('fen' if i % 2 else 'men'), st['en'], st['en_th'])]
LINES += [('r', 'narr', S['recap']['text']), ('z', 'narr', S['end'])]
voice.build(D, LINES)
open(os.path.join(D, 'spec.js'), 'w', encoding='utf-8').write('window.SPEC = ' + json.dumps(S, ensure_ascii=False) + ';\n')
html = os.path.join(HERE, f'process-{slug}.html')
open(html, 'w', encoding='utf-8').write(open(os.path.join(HERE, 'process.html'), encoding='utf-8').read().replace('__EP__', slug))
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
subprocess.run(['node', os.path.join(HERE, 'render.mjs'), html, out], check=True, cwd=ROOT)
FF = os.path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg')
subprocess.run([FF, '-v', 'error', '-y', '-ss', str(S.get('cover_at', 1.2)), '-i', out, '-frames:v', '1', '-q:v', '3', out.replace('.mp4', '-cover.jpg')], check=True)
print('✅' if not preview else '👀 (ตัวอย่าง พากย์ไทยยังเงียบ ห้ามโพสต์)', out)
