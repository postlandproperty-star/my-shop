# 💡 ทำคลิป "เทคนิคสอบ" ตอนใหม่ด้วยคำสั่งเดียว (แม่แบบ tips.html · ต่อยอดคลิป TOEIC Listening ที่คนดู 4.8K · เสียงฟรีเท่านั้น)
#   1) เขียน tools/reel/motion/tips/<slug>/spec.json (ดูตัวอย่าง tips/part2-traps/spec.json)
#      pill · hook [3 บรรทัด] · n1 (พากย์เปิด) · tips [{title [2 บรรทัด], th (พากย์ คั่นท่อนด้วย |), en [[fen|men, ประโยค, คำแปล]], en_mood {xNa: bad|ok}, board (HTML · data-c="ท่อน" โผล่ตามพากย์ · data-x="xNa" โผล่ตอนประโยคอังกฤษ), pop [en, ไทย], pop_at}] · z (พากย์ปิด) · end_lines [3]
#   2) python3 tools/reel/motion/tips.py <slug> [--out คลิป.mp4] [--preview]
import os, sys, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
args = sys.argv[1:]; slug = args[0]; preview = '--preview' in args
out = args[args.index('--out') + 1] if '--out' in args else os.path.join(HERE, '.work', f'tips-{slug}.mp4')
if preview: os.environ['VOICE_PREVIEW'] = '1'
sys.argv = sys.argv[:1]; sys.path.insert(0, HERE); import voice
D = os.path.join(HERE, 'tips', slug); S = json.load(open(os.path.join(D, 'spec.json'), encoding='utf-8'))
LINES = [('n1', 'narr', S['n1'])]
for i, tp in enumerate(S['tips'], 1):
    LINES.append((f't{i}', 'narr', tp['th']))
    for j, (kind, en, th) in enumerate(tp.get('en', [])): LINES.append((f'x{i}{"abcdef"[j]}', kind, en, th))
LINES.append(('z', 'narr', S['z']))
voice.build(D, LINES)
open(os.path.join(D, 'spec.js'), 'w', encoding='utf-8').write('window.SPEC = ' + json.dumps(S, ensure_ascii=False) + ';\n')
html = os.path.join(HERE, f'tips-{slug}.html')
open(html, 'w', encoding='utf-8').write(open(os.path.join(HERE, 'tips.html'), encoding='utf-8').read().replace('__EP__', slug))
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
subprocess.run(['node', os.path.join(HERE, 'render.mjs'), html, out], check=True, cwd=ROOT)
FF = os.path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg')
subprocess.run([FF, '-v', 'error', '-y', '-ss', str(S.get('cover_at', 1.6)), '-i', out, '-frames:v', '1', '-q:v', '3', out.replace('.mp4', '-cover.jpg')], check=True)
print('✅' if not preview else '👀 (ตัวอย่าง พากย์ไทยยังเงียบ ห้ามโพสต์)', out)
