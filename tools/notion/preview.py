#!/usr/bin/env python3
"""รูปปก + รูปตัวอย่างของ Notion template สำหรับหน้าขาย (โรงงานพี่เหล็กใช้ ไม่ต้องล็อกอิน Notion ไม่ต้องใช้เบราว์เซอร์)

python3 tools/notion/preview.py spec.json outdir/
spec: {
  "title": "TOEIC Study Planner", "subtitle": "แผนเตรียมสอบ 8 สัปดาห์", "icon": "📘" (ไม่บังคับ แสดงเป็นป้ายตัวอักษร),
  "bullets": ["แผนอ่าน 32 งาน", "คลังคำศัพท์ + ทวน 3 รอบ", "สมุดจดจุดผิด", "บันทึกคะแนน Mock Test"],
  "sections": [{"name": "แผนอ่าน 8 สัปดาห์", "columns": ["งาน","สัปดาห์","ส่วน","สถานะ"], "rows": [["Tense พื้นฐาน","สัปดาห์ 1","Grammar","ยังไม่เริ่ม"], ...]}, ...]
}
  "lang": "en" (ไม่บังคับ: ป้ายบนรูปเป็นภาษาอังกฤษ สำหรับขายต่างประเทศ),
  "pins": [{"headline": "How I planned IELTS Band 7 in 12 weeks", "sub": "Notion template · free Lite version"}, ...] (ไม่บังคับ: รูป Pinterest 1000x1500)
ได้ไฟล์: cover.png (1200x1200), preview-1.png ... (1200x900 ต่อ section สูงสุด 4), pin-1.png ... (1000x1500 ต่อ pin สูงสุด 6) ใช้ข้อมูลจริงจากเทมเพลตเท่านั้น
ต้องมี: pip install pillow
"""
import sys, os, json
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, '..', 'reel', 'fonts')
INK, MUTED, LINE, BG, BRAND, ACC = (25, 25, 25), (120, 120, 120), (233, 233, 231), (255, 255, 255), (36, 64, 232), (255, 210, 63)
LANG = {'th': 'Notion Template · กด Duplicate ใช้ได้ทันที', 'en': 'Notion Template · Duplicate and start in seconds'}
TAGS = [(227, 237, 252), (219, 240, 227), (253, 236, 200), (240, 228, 250), (252, 228, 228), (238, 238, 238)]

def font(kind, sz):
    return ImageFont.truetype(os.path.join(FONTS, {'xb': 'Kanit-ExtraBold.ttf', 'sb': 'Kanit-SemiBold.ttf', 'md': 'Kanit-Medium.ttf'}[kind]), sz)

def fit(d, text, f, maxw):
    t = str(text)
    if d.textlength(t, font=f) <= maxw: return t
    while t and d.textlength(t + '…', font=f) > maxw: t = t[:-1]
    return t + '…'

def cover(spec, out):
    W = H = 1200
    im = Image.new('RGB', (W, H), BRAND); d = ImageDraw.Draw(im)
    # หน้าต่างแบบ Notion เอียงนิดๆ ด้านล่าง
    card = Image.new('RGB', (1000, 640), BG); cd = ImageDraw.Draw(card)
    cd.rectangle([0, 0, 1000, 46], fill=(247, 247, 245))
    for i, c in enumerate([(255, 95, 87), (255, 189, 46), (40, 200, 64)]): cd.ellipse([20 + i * 26, 16, 34 + i * 26, 30], fill=c)
    sec = (spec.get('sections') or [{}])[0]
    cd.text((40, 70), fit(cd, spec.get('title', ''), font('sb', 40), 920), font=font('sb', 40), fill=INK)
    cols = (sec.get('columns') or [])[:4]; rows = (sec.get('rows') or [])[:7]
    if cols:
        cw = 920 // len(cols); y = 150
        for j, c in enumerate(cols): cd.text((40 + j * cw, y), fit(cd, c, font('md', 24), cw - 16), font=font('md', 24), fill=MUTED)
        y += 44
        for r in rows:
            cd.line([40, y - 8, 960, y - 8], fill=LINE, width=2)
            for j, v in enumerate(r[:len(cols)]):
                f = font('md', 24)
                if j == 0: cd.text((40, y), fit(cd, v, f, cw - 16), font=f, fill=INK)
                else:
                    t = fit(cd, v, f, cw - 40); w = cd.textlength(t, font=f)
                    cd.rounded_rectangle([40 + j * cw, y - 2, 40 + j * cw + w + 20, y + 34], radius=8, fill=TAGS[(j + hash(str(v))) % len(TAGS)])
                    cd.text((50 + j * cw, y), t, font=f, fill=INK)
            y += 58
    card = card.rotate(-3, expand=True, fillcolor=BRAND, resample=Image.BICUBIC)
    im.paste(card, (70, 520))
    f1 = font('xb', 84); lines = []
    t = str(spec.get('title', ''))
    while t:
        cut = len(t)
        while d.textlength(t[:cut], font=f1) > 1060 and cut > 1: cut = t.rfind(' ', 0, cut) if ' ' in t[:cut] else cut - 1
        lines.append(t[:cut].strip()); t = t[cut:].strip()
    y = 90
    d.rounded_rectangle([70, y, 70 + d.textlength('NOTION TEMPLATE', font=font('sb', 30)) + 40, y + 50], radius=25, fill=ACC)
    d.text((90, y + 6), 'NOTION TEMPLATE', font=font('sb', 30), fill=INK); y += 80
    for l in lines[:2]: d.text((70, y), l, font=f1, fill=(255, 255, 255)); y += 100
    if spec.get('subtitle'): d.text((70, y + 6), fit(d, spec['subtitle'], font('md', 42), 1060), font=font('md', 42), fill=(214, 224, 255)); y += 70
    bl = spec.get('bullets') or []
    if bl: d.text((70, y + 10), fit(d, '  ·  '.join(bl[:3]), font('md', 30), 1060), font=font('md', 30), fill=(255, 255, 255))
    d.text((W - 250, 96), 'SheetLab', font=font('xb', 40), fill=(255, 255, 255))
    im.save(out)

def check(d, x, y, on=True):  # ช่องติ๊กแบบ Notion (ฟอนต์ไทยไม่มีตัว ✓ จึงวาดเอง)
    if on:
        d.rounded_rectangle([x, y + 2, x + 30, y + 32], radius=6, fill=BRAND)
        d.line([(x + 7, y + 17), (x + 13, y + 24), (x + 24, y + 10)], fill=(255, 255, 255), width=4, joint='curve')
    else:
        d.rounded_rectangle([x, y + 2, x + 30, y + 32], radius=6, outline=(200, 200, 200), width=2)

def section(spec, sec, out, idx, n):
    W, H = 1200, 900
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 70], fill=(247, 247, 245))
    d.text((40, 18), fit(d, f"{spec.get('title', '')}  /  {sec.get('name', '')}", font('md', 26), 1000), font=font('md', 26), fill=MUTED)
    d.text((W - 150, 18), f'{idx}/{n}', font=font('md', 26), fill=MUTED)
    d.text((60, 110), fit(d, sec.get('name', ''), font('xb', 60), 1080), font=font('xb', 60), fill=INK)
    cols = (sec.get('columns') or [])[:5]; rows = (sec.get('rows') or [])[:9]
    if not cols: im.save(out); return
    first = 380 if len(cols) > 2 else 540
    rest = (1080 - first) // max(1, len(cols) - 1)
    xs = [60] + [60 + first + rest * k for k in range(len(cols) - 1)]; ws = [first] + [rest] * (len(cols) - 1)
    y = 230
    for j, c in enumerate(cols): d.text((xs[j], y), fit(d, c, font('md', 26), ws[j] - 16), font=font('md', 26), fill=MUTED)
    y += 50
    # คอลัมน์ที่ค่าซ้ำกัน = แบบ select แสดงเป็นป้ายสี ส่วนคอลัมน์ข้อความอิสระแสดงเป็นตัวหนังสือธรรมดา
    CHK = ('✓', 'true', '__YES__', '☑')
    kind = []
    for j in range(len(cols)):
        vals = [str(r[j]) for r in rows if j < len(r) and r[j] not in (None, '')]
        if vals and all(v in CHK for v in vals) or (j < len(cols) and any(v in CHK for v in vals)): kind.append('check')
        elif j > 0 and vals and len(set(vals)) < len(vals): kind.append('tag')
        else: kind.append('text')
    for r in rows:
        d.line([60, y - 10, 1140, y - 10], fill=LINE, width=2)
        for j, v in enumerate(r[:len(cols)]):
            f = font('md', 26); v = '' if v is None else str(v)
            if kind[j] == 'check': check(d, xs[j], y, v in CHK); continue
            if kind[j] == 'text': d.text((xs[j], y), fit(d, v, f, ws[j] - 20), font=f, fill=INK)
            elif v:
                t = fit(d, v, f, ws[j] - 44); w = d.textlength(t, font=f)
                d.rounded_rectangle([xs[j], y - 2, xs[j] + w + 22, y + 36], radius=8, fill=TAGS[(j + sum(map(ord, v))) % len(TAGS)])
                d.text((xs[j] + 11, y), t, font=f, fill=INK)
        y += 64
    d.rectangle([0, H - 64, W, H], fill=BRAND)
    d.text((40, H - 54), LANG.get(spec.get('lang'), LANG['th']), font=font('md', 28), fill=(255, 255, 255))
    d.text((W - 200, H - 56), 'SheetLab', font=font('xb', 32), fill=(255, 255, 255))
    im.save(out)

def wrap_lines(d, text, f, maxw, maxn=4):
    words, lines, cur = str(text).split(' '), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= maxw: cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines[:maxn]

def pin(spec, pn, out, idx):
    W, H = 1000, 1500
    bgs = [BRAND, (17, 24, 39), (250, 246, 238)]
    bg = bgs[idx % len(bgs)]; light = bg != (250, 246, 238); fg = (255, 255, 255) if light else INK
    im = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(im)
    d.rounded_rectangle([60, 70, 60 + d.textlength('NOTION TEMPLATE', font=font('sb', 30)) + 40, 120], radius=25, fill=ACC)
    d.text((80, 76), 'NOTION TEMPLATE', font=font('sb', 30), fill=INK)
    f = font('xb', 78); y = 160
    for l in wrap_lines(d, pn.get('headline', spec.get('title', '')), f, 880, 4): d.text((60, y), l, font=f, fill=fg); y += 92
    if pn.get('sub'): d.text((60, y + 10), fit(d, pn['sub'], font('md', 36), 880), font=font('md', 36), fill=(214, 224, 255) if bg == BRAND else MUTED if not light else (200, 200, 200)); y += 70
    sec = (spec.get('sections') or [{}])[idx % max(1, len(spec.get('sections') or [1]))] if spec.get('sections') else {}
    top = y + 50; ch = H - 130 - top
    card = Image.new('RGB', (880, ch), BG); cd = ImageDraw.Draw(card)
    cd.rectangle([0, 0, 880, 44], fill=(247, 247, 245))
    for i, c in enumerate([(255, 95, 87), (255, 189, 46), (40, 200, 64)]): cd.ellipse([18 + i * 24, 15, 31 + i * 24, 28], fill=c)
    cd.text((30, 64), fit(cd, sec.get('name', spec.get('title', '')), font('sb', 44), 820), font=font('sb', 44), fill=INK)
    cols = (sec.get('columns') or [])[:3]; rows = (sec.get('rows') or [])[:9]
    if cols:
        cw = 820 // len(cols); yy = 140; fs = 28
        for j, c in enumerate(cols): cd.text((30 + j * cw, yy), fit(cd, c, font('md', fs - 2), cw - 14), font=font('md', fs - 2), fill=MUTED)
        yy += 50
        for r in rows:
            if yy > ch - 60: break
            cd.line([30, yy - 8, 850, yy - 8], fill=LINE, width=2)
            for j, v in enumerate(r[:len(cols)]):
                t = fit(cd, '' if v is None else v, font('md', fs), cw - 30)
                if j and t: w = cd.textlength(t, font=font('md', fs)); cd.rounded_rectangle([30 + j * cw, yy - 2, 30 + j * cw + w + 18, yy + 38], radius=8, fill=TAGS[(j + sum(map(ord, t))) % len(TAGS)]); cd.text((39 + j * cw, yy), t, font=font('md', fs), fill=INK)
                else: cd.text((30, yy), t, font=font('md', fs), fill=INK)
            yy += 76
    im.paste(card, (60, top))
    d.text((60, H - 90), 'SheetLab', font=font('xb', 44), fill=fg)
    d.text((W - 60 - d.textlength('Duplicate → start today', font=font('md', 30)), H - 80), 'Duplicate → start today', font=font('md', 30), fill=fg)
    im.save(out)

if __name__ == '__main__':
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    spec = json.load(open(sys.argv[1], encoding='utf-8')); outd = sys.argv[2]; os.makedirs(outd, exist_ok=True)
    files = [os.path.join(outd, 'cover.png')]; cover(spec, files[0])
    secs = (spec.get('sections') or [])[:4]
    for i, sc in enumerate(secs, 1):
        p = os.path.join(outd, f'preview-{i}.png'); section(spec, sc, p, i, len(secs)); files.append(p)
    pins = []
    for i, pn in enumerate((spec.get('pins') or [])[:6], 1):
        pp = os.path.join(outd, f'pin-{i}.png'); pin(spec, pn, pp, i - 1); pins.append(pp)
    print(json.dumps({'ok': True, 'files': files, 'pins': pins}, ensure_ascii=False))
