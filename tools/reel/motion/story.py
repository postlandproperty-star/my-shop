# 🎭 คลิปเรื่องสั้นมีตัวละคร (มิว · ป้าแจ่ม · ต้น ...) ด้วยคำสั่งเดียว · แม่แบบ story.html (คุณแดน 24 ต.ค. 69 "วันละ 5 คลิป")
#   1) เขียน tools/reel/motion/story/<slug>/spec.json (ดูตัวอย่าง story/mew-ep5-zoom/spec.json)
#      pill · scene (office | zoom | lunch | stall | airport) · chars {id: {look, voice, x, side, screen?}} · title [เล็ก, ใหญ่]
#      lines [[k, 'narr'|charId, ข้อความ, คำแปล?, {ตัวเลือก}]] · pop [[k, ท่อน, en, ไทย]] · props [{html, in, out, x, y, w}] · end [2 บรรทัด]
#   2) python3 tools/reel/motion/story.py <slug> [--out คลิป.mp4] [--preview]
#   เสียง: พากย์ไทย = ElevenLabs Aria (voice.py ค่าเริ่ม) · อังกฤษ = Kokoro ตาม voice ของตัวละคร (men / fen / v:<ชื่อเสียง>)
import os, sys, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
args = sys.argv[1:]; slug = args[0]; preview = '--preview' in args
out = args[args.index('--out') + 1] if '--out' in args else os.path.join(HERE, '.work', f'story-{slug}.mp4')
if preview: os.environ['VOICE_PREVIEW'] = '1'
sys.argv = sys.argv[:1]; sys.path.insert(0, HERE); import voice
D = os.path.join(HERE, 'story', slug); S = json.load(open(os.path.join(D, 'spec.json'), encoding='utf-8'))
LINES = []
for ln in S['lines']:
    k, who, text = ln[0], ln[1], ln[2]
    LINES.append((k, 'narr', text) if who == 'narr' else (k, S['chars'][who]['voice'], text, ln[3]))
voice.build(D, LINES)
open(os.path.join(D, 'spec.js'), 'w', encoding='utf-8').write('window.SPEC = ' + json.dumps(S, ensure_ascii=False) + ';\n')
html = os.path.join(HERE, f'story-{slug}.html')
open(html, 'w', encoding='utf-8').write(open(os.path.join(HERE, 'story.html'), encoding='utf-8').read().replace('__EP__', slug))
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
subprocess.run(['node', os.path.join(HERE, 'render.mjs'), html, out], check=True, cwd=ROOT)
FF = os.path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg')
subprocess.run([FF, '-v', 'error', '-y', '-ss', str(S.get('cover_at', 1.4)), '-i', out, '-frames:v', '1', '-q:v', '3', out.replace('.mp4', '-cover.jpg')], check=True)
voice.cost_line(D)
print('✅' if not preview else '👀 (ตัวอย่าง พากย์ไทยยังเงียบ ห้ามโพสต์)', out)
