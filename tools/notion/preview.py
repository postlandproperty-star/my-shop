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
# ธีม "Broken White Notion" (คุณแดนเลือก ต.ค. 2569): พื้นขาวหม่น หมึกดำ กล่องขาวขอบดำหนา + เงาดำทึบ จุดฮาล์ฟโทน ไอคอนลายเส้น ขาวดำล้วน
INK, MUTED, LINE, BG, PAPER, SOFT = (17, 17, 17), (110, 110, 106), (214, 214, 210), (238, 237, 233), (255, 255, 255), (228, 227, 222)
BRAND = INK; ACC = PAPER
LANG = {'th': 'Notion Template · กด Duplicate ใช้ได้ทันที', 'en': 'Notion Template · Duplicate and start in seconds'}
TAGS = [PAPER, SOFT]

def box(d, rect, r=18, w=5, sh=12, fill=PAPER):  # กล่องขาวขอบดำหนา เงาดำทึบเยื้องขวาล่าง
    x0, y0, x1, y1 = rect
    if sh: d.rounded_rectangle([x0 + sh, y0 + sh, x1 + sh, y1 + sh], radius=r, fill=INK)
    d.rounded_rectangle(rect, radius=r, fill=fill, outline=INK, width=w)

def halftone(d, cx, cy, R, step=16, dot=6, col=INK):  # จุดฮาล์ฟโทนวงกลม จางออกขอบ
    for x in range(int(cx - R), int(cx + R) + 1, step):
        for y in range(int(cy - R), int(cy + R) + 1, step):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** .5
            if dist >= R: continue
            rr = dot * (1 - dist / R) ** 1.3
            if rr >= .8: d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=col)

def tag(d, x, y, t, f, h=36):  # ป้าย select แบบขาวดำ
    w = d.textlength(t, font=f)
    d.rounded_rectangle([x, y - 2, x + w + 22, y + h], radius=8, fill=PAPER, outline=INK, width=2)
    d.text((x + 11, y), t, font=f, fill=INK)

def doodle(d, kind, x, y, s=90, col=INK, w=5):  # ไอคอนลายเส้นเล็กๆ แบบภาพประกอบ Notion
    if kind == 'chart':
        d.rounded_rectangle([x, y, x + s, y + s], radius=10, outline=col, width=w)
        for i, hh in enumerate((.35, .6, .85)): bx = x + 14 + i * (s - 28) / 3; d.rectangle([bx, y + s - 12 - (s - 28) * hh, bx + (s - 28) / 3 - 8, y + s - 12], fill=col)
    elif kind == 'check':
        d.rounded_rectangle([x, y, x + s, y + s], radius=10, outline=col, width=w)
        for i in range(3):
            yy = y + 16 + i * (s - 24) / 3
            d.rectangle([x + 12, yy, x + 26, yy + 14], outline=col, width=3)
            d.line([x + 34, yy + 7, x + s - 12, yy + 7], fill=col, width=4)
        d.line([(x + 13, y + 22), (x + 18, y + 28), (x + 27, y + 15)], fill=col, width=4)
    elif kind == 'cal':
        d.rounded_rectangle([x, y + 8, x + s, y + s], radius=10, outline=col, width=w)
        d.line([x, y + 30, x + s, y + 30], fill=col, width=w)
        for i in (.3, .7): d.line([x + s * i, y, x + s * i, y + 16], fill=col, width=w)
        for i in range(3):
            for j in range(2): d.rectangle([x + 14 + i * (s - 28) / 3, y + 40 + j * 22, x + 26 + i * (s - 28) / 3, y + 52 + j * 22], fill=col)
    elif kind == 'page':
        d.polygon([(x, y), (x + s * .7, y), (x + s, y + s * .3), (x + s, y + s), (x, y + s)], outline=col, width=w)
        d.line([x + s * .7, y, x + s * .7, y + s * .3, x + s, y + s * .3], fill=col, width=w)
        for i in range(3): d.line([x + 14, y + s * .45 + i * 16, x + s - 14, y + s * .45 + i * 16], fill=col, width=4)

def dots3(d, x, y, col=INK):  # ปุ่มหน้าต่าง 3 จุด แบบโปร่ง
    for i in range(3): d.ellipse([x + i * 26, y, x + 14 + i * 26, y + 14], outline=col, width=3)

def font(kind, sz):
    return ImageFont.truetype(os.path.join(FONTS, {'xb': 'Kanit-ExtraBold.ttf', 'sb': 'Kanit-SemiBold.ttf', 'md': 'Kanit-Medium.ttf'}[kind]), sz)

def fit(d, text, f, maxw):
    t = str(text)
    if d.textlength(t, font=f) <= maxw: return t
    while t and d.textlength(t + '…', font=f) > maxw: t = t[:-1]
    return t + '…'

def cover(spec, out):
    W = H = 1200
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    halftone(d, 120, 110, 150); halftone(d, 1090, 640, 170)
    # หน้าต่าง Notion ขอบดำ เอียงนิดๆ ด้านล่าง
    cw_, ch_ = 1000, 600
    card = Image.new('RGBA', (cw_ + 24, ch_ + 24), (0, 0, 0, 0)); cd = ImageDraw.Draw(card)
    box(cd, [4, 4, cw_, ch_], r=20, w=6, sh=14)
    cd.line([4, 58, cw_, 58], fill=INK, width=5); dots3(cd, 26, 24)
    sec = (spec.get('sections') or [{}])[0]
    cd.text((40, 78), fit(cd, sec.get('name') or spec.get('title', ''), font('sb', 38), 900), font=font('sb', 38), fill=INK)
    cols = (sec.get('columns') or [])[:4]; rows = (sec.get('rows') or [])[:6]
    if cols:
        cw = 920 // len(cols); y = 150
        for j, c in enumerate(cols): cd.text((40 + j * cw, y), fit(cd, c, font('md', 24), cw - 16), font=font('md', 24), fill=MUTED)
        y += 44
        for r in rows:
            cd.line([40, y - 8, 960, y - 8], fill=LINE, width=2)
            for j, v in enumerate(r[:len(cols)]):
                f = font('md', 24); v = '' if v is None else str(v)
                if j == 0: cd.text((40, y), fit(cd, v, f, cw - 16), font=f, fill=INK)
                elif v in ('✓', 'true', '__YES__', '☑') or (v == '' and any(str(rr[j]) in ('✓', 'true', '__YES__', '☑') for rr in rows if j < len(rr))): check(cd, 40 + j * cw, y - 2, v != '')
                elif v: tag(cd, 40 + j * cw, y, fit(cd, v, f, cw - 44), f, 34)
            y += 60
    card = card.rotate(-3, expand=True, resample=Image.BICUBIC)
    im.paste(card, (70, 560), card)
    d = ImageDraw.Draw(im)
    doodle(d, 'chart', 1040, 470, 100); doodle(d, 'check', 60, 470, 90)
    # ป้าย + ชื่อในกล่องขาวขอบดำ (เหมือนหัวข้อในเทมเพลต)
    pf = font('sb', 28); pw = d.textlength('NOTION TEMPLATE', font=pf)
    d.rounded_rectangle([70, 70, 70 + pw + 40, 116], radius=23, fill=PAPER, outline=INK, width=3); d.text((90, 75), 'NOTION TEMPLATE', font=pf, fill=INK)
    d.text((W - 70 - d.textlength('SheetLab', font=font('xb', 40)), 70), 'SheetLab', font=font('xb', 40), fill=INK)
    f1 = font('xb', 80); lines = []
    t = str(spec.get('title', ''))
    while t and len(lines) < 2:
        cut = len(t)
        while d.textlength(t[:cut], font=f1) > 960 and cut > 1: cut = t.rfind(' ', 0, cut) if ' ' in t[:cut] else cut - 1
        lines.append(t[:cut].strip()); t = t[cut:].strip()
    tw = max(d.textlength(l, font=f1) for l in lines) if lines else 0
    y = 150; bh = 40 + 96 * len(lines)
    box(d, [70, y, 70 + tw + 70, y + bh], r=14, w=6, sh=12)
    for i, l in enumerate(lines): d.text((105, y + 14 + i * 96), l, font=f1, fill=INK)
    y += bh + 34
    if spec.get('subtitle'): d.text((74, y), fit(d, spec['subtitle'], font('md', 40), 1050), font=font('md', 40), fill=INK); y += 62
    bl = spec.get('bullets') or []
    if bl: d.text((74, y), fit(d, '  •  '.join(bl[:3]), font('md', 30), 1050), font=font('md', 30), fill=MUTED)
    im.save(out)

def check(d, x, y, on=True):  # ช่องติ๊กแบบ Notion (ฟอนต์ไทยไม่มีตัว ✓ จึงวาดเอง)
    if on:
        d.rounded_rectangle([x, y + 2, x + 30, y + 32], radius=6, fill=INK)
        d.line([(x + 7, y + 17), (x + 13, y + 24), (x + 24, y + 10)], fill=PAPER, width=4, joint='curve')
    else:
        d.rounded_rectangle([x, y + 2, x + 30, y + 32], radius=6, fill=PAPER, outline=INK, width=3)

def section(spec, sec, out, idx, n):
    W, H = 1200, 900
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    halftone(d, 1110, 120, 130, step=15, dot=5)
    d.text((44, 26), fit(d, f"{spec.get('title', '')}  /  {sec.get('name', '')}", font('md', 24), 900), font=font('md', 24), fill=MUTED)
    tf = font('xb', 54); tt = fit(d, sec.get('name', ''), tf, 1000)
    box(d, [44, 76, 44 + d.textlength(tt, font=tf) + 52, 168], r=12, w=5, sh=10)
    d.text((70, 86), tt, font=tf, fill=INK)
    box(d, [44, 200, 1146, 812], r=18, w=5, sh=12)
    cols = (sec.get('columns') or [])[:5]; rows = (sec.get('rows') or [])[:8]
    if cols:
        first = 380 if len(cols) > 2 else 520
        rest = (1040 - first) // max(1, len(cols) - 1)
        xs = [76] + [76 + first + rest * k for k in range(len(cols) - 1)]; ws = [first] + [rest] * (len(cols) - 1)
        y = 226
        for j, c in enumerate(cols): d.text((xs[j], y), fit(d, c, font('md', 25), ws[j] - 16), font=font('md', 25), fill=MUTED)
        y += 48
        # คอลัมน์ที่ค่าซ้ำกัน = แบบ select แสดงเป็นป้าย ส่วนคอลัมน์ข้อความอิสระแสดงเป็นตัวหนังสือธรรมดา
        CHK = ('✓', 'true', '__YES__', '☑')
        kind = []
        for j in range(len(cols)):
            vals = [str(r[j]) for r in rows if j < len(r) and r[j] not in (None, '')]
            if vals and any(v in CHK for v in vals): kind.append('check')
            elif j > 0 and vals and len(set(vals)) < len(vals): kind.append('tag')
            else: kind.append('text')
        for r in rows:
            d.line([76, y - 10, 1114, y - 10], fill=LINE, width=2)
            for j, v in enumerate(r[:len(cols)]):
                f = font('md', 25); v = '' if v is None else str(v)
                if kind[j] == 'check': check(d, xs[j], y, v in CHK); continue
                if kind[j] == 'text': d.text((xs[j], y), fit(d, v, f, ws[j] - 20), font=f, fill=INK)
                elif v: tag(d, xs[j], y, fit(d, v, f, ws[j] - 44), f)
            y += 64
    d.rectangle([0, H - 60, W, H], fill=INK)
    d.text((40, H - 50), LANG.get(spec.get('lang'), LANG['th']), font=font('md', 26), fill=PAPER)
    sl = d.textlength('SheetLab', font=font('xb', 30)); d.text((W - 40 - sl, H - 52), 'SheetLab', font=font('xb', 30), fill=PAPER)
    d.text((W - 70 - sl - d.textlength(f'{idx}/{n}', font=font('md', 26)), H - 50), f'{idx}/{n}', font=font('md', 26), fill=(170, 170, 166))
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
    dark = idx % 3 == 1  # สลับพื้นขาวหม่น / ดำ / ขาว
    bg = INK if dark else (BG if idx % 3 == 0 else PAPER); fg = PAPER if dark else INK
    im = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(im)
    halftone(d, 900, 110, 150, col=(70, 70, 70) if dark else INK)
    pf = font('sb', 28); pw = d.textlength('NOTION TEMPLATE', font=pf)
    d.rounded_rectangle([60, 70, 60 + pw + 40, 116], radius=23, fill=PAPER, outline=INK if not dark else PAPER, width=3); d.text((80, 75), 'NOTION TEMPLATE', font=pf, fill=INK)
    f = font('xb', 76); L = wrap_lines(d, pn.get('headline', spec.get('title', '')), f, 820, 4)
    y = 160
    if not dark:
        tw = max(d.textlength(l, font=f) for l in L) if L else 0
        box(d, [60, y, 60 + tw + 60, y + 30 + 90 * len(L)], r=14, w=6, sh=12)
        for i, l in enumerate(L): d.text((90, y + 10 + i * 90), l, font=f, fill=INK)
        y += 30 + 90 * len(L) + 26
    else:
        for l in L: d.text((60, y), l, font=f, fill=fg); y += 90
        y += 16
    if pn.get('sub'): d.text((64, y), fit(d, pn['sub'], font('md', 34), 880), font=font('md', 34), fill=(200, 200, 196) if dark else MUTED); y += 60
    sec = (spec.get('sections') or [{}])[idx % max(1, len(spec.get('sections') or [1]))] if spec.get('sections') else {}
    top = y + 34; ch = H - 150 - top
    box(d, [60, top, 940, top + ch], r=18, w=5, sh=0 if dark else 12)
    d.line([60, top + 52, 940, top + 52], fill=INK, width=4); dots3(d, 84, top + 19)
    d.text((90, top + 70), fit(d, sec.get('name', spec.get('title', '')), font('sb', 40), 800), font=font('sb', 40), fill=INK)
    cols = (sec.get('columns') or [])[:3]; rows = (sec.get('rows') or [])[:9]
    if cols:
        cw = 800 // len(cols); yy = top + 140; fs = 27
        for j, c in enumerate(cols): d.text((90 + j * cw, yy), fit(d, c, font('md', fs - 2), cw - 14), font=font('md', fs - 2), fill=MUTED)
        yy += 48
        for r in rows:
            if yy > top + ch - 60: break
            d.line([90, yy - 8, 910, yy - 8], fill=LINE, width=2)
            for j, v in enumerate(r[:len(cols)]):
                t = fit(d, '' if v is None else v, font('md', fs), cw - 34)
                if j and t: tag(d, 90 + j * cw, yy, t, font('md', fs), 38)
                elif t: d.text((90, yy), t, font=font('md', fs), fill=INK)
            yy += 72
    d.text((60, H - 96), 'SheetLab', font=font('xb', 44), fill=fg)
    d.text((W - 60 - d.textlength('Duplicate → start today', font=font('md', 30)), H - 86), 'Duplicate → start today', font=font('md', 30), fill=fg)
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
