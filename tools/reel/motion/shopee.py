# -*- coding: utf-8 -*-
# 🛒 วิดีโอสินค้า Shopee ของชุด "IELTS Academic Practice Tests" (คุณแดน 24 ต.ค. 69) · ฟรี (ไม่มีเสียงพากย์ ใช้เพลงที่สร้างเอง)
#   python3 tools/reel/motion/shopee.py <เล่ม> [--ar 1x1|9x16|both] [--out โฟลเดอร์]
# ดึงปก A + หน้าจริงจาก PDF ฉบับเต็ม (ตำแหน่งหน้าจาก toc.json ในโฟลเดอร์ผลิต IELTSPT-0N) → shopee/ptN/ → shopee-ptN-<ar>.html → render.mjs → mp4 + ภาพปกวิดีโอ
import os, sys, json, glob, shutil, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
FF = os.path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg'); PDFTOPPM = '/opt/homebrew/bin/pdftoppm'
SSD = '/Volumes/PortableSSD/Sheetlab'
args = sys.argv[1:]; vol = int(args[0])
ar = args[args.index('--ar') + 1] if '--ar' in args else 'both'
out_dir = args[args.index('--out') + 1] if '--out' in args else os.path.join(HERE, 'shopee', 'out')
book = f'{SSD}/เตรียมสอบ IELTS/IELTS Academic Practice Tests {vol}'
full = [f for f in glob.glob(book + '/*.pdf') if f.endswith(f'IELTS-ACADEMIC-PRACTICE-TESTS-{vol}.pdf')][0]
toc = json.load(open(f'{SSD}/_factory/work/IELTSPT-{vol:02d}/toc.json'))
# หน้าที่โชว์ (ตรงกับฉบับพิมพ์ Shopee: ข้อสอบอยู่ในเล่ม · เฉลยละเอียดและตัวอย่าง Writing อยู่หลัง QR)
PAGES = [('L1', 'L.jpg', '🎧 สแกน QR ฟังเสียง Listening', 'ฟังจากมือถือได้ทันที'),
         ('R1', 'R.jpg', '📖 Reading 3 บทความต่อชุด', 'รูปแบบเหมือนวันสอบจริง'),
         ('W1', 'W.jpg', '📊 Writing Task 1 + Task 2', 'กราฟ ตาราง แผนภาพขั้นตอน'),
         ('AL1', 'K.jpg', '✅ เฉลยละเอียดภาษาไทยทุกข้อ', 'สแกน QR ดูคำอธิบายทุกข้อ'),
         ('AW1', 'M.jpg', '✍️ ตัวอย่าง Writing Band 7+', 'สแกน QR ดูตัวอย่างคำตอบ')]
media = os.path.join(HERE, 'shopee', f'pt{vol}'); os.makedirs(media, exist_ok=True); os.makedirs(out_dir, exist_ok=True)
for key, fn, _, _ in PAGES:
    pg = toc[key] + 1; base = os.path.join(media, fn[:-4])
    subprocess.run([PDFTOPPM, '-r', '150', '-jpeg', '-jpegopt', 'quality=88', '-singlefile', '-f', str(pg), '-l', str(pg), full, base], check=True)
subprocess.run([FF, '-v', 'error', '-y', '-i', f'{book}/cover_A.png', '-q:v', '3', os.path.join(media, 'cover.jpg')], check=True)
tpl = open(os.path.join(HERE, 'shopee.html'), encoding='utf-8').read()
res = []
for a in (['1x1', '9x16'] if ar == 'both' else [ar]):
    cfg = {'vol': vol, 'size': [1080, 1080] if a == '1x1' else [1080, 1920], 'base': f'shopee/pt{vol}/', 'cover': 'cover.jpg',
           'pages': [{'img': fn, 'cap': cap, 'sub': sub} for _, fn, cap, sub in PAGES]}
    html = os.path.join(HERE, f'shopee-pt{vol}-{a}.html')
    open(html, 'w', encoding='utf-8').write(tpl.replace('/*CFG*/', 'window.CFG = ' + json.dumps(cfg, ensure_ascii=False) + ';'))
    mp4 = os.path.join(out_dir, f'ielts-pt{vol}-{a}.mp4')
    subprocess.run(['node', os.path.join(HERE, 'render.mjs'), html, mp4, '--mood', 'upbeat'], check=True)
    # ภาพปกวิดีโอ = ฉากจบ (ปก + ปุ่มสั่งซื้อ)
    dur = float(subprocess.run([FF, '-i', mp4], capture_output=True, text=True).stderr.split('Duration: ')[1].split(',')[0].split(':')[-1])
    subprocess.run([FF, '-v', 'error', '-y', '-ss', str(max(0, dur - 1.0)), '-i', mp4, '-frames:v', '1', '-q:v', '2', mp4.replace('.mp4', '-cover.jpg')], check=True)
    res.append({'out': mp4, 'sec': round(dur, 1), 'mb': round(os.path.getsize(mp4) / 1e6, 1)})
print(json.dumps(res, ensure_ascii=False))
