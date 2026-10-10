# หน้าภาพรวมโรงงาน: รวมทุกเล่มที่ผลิตแล้ว (SSD + โฟลเดอร์เดิมบน Mac) เป็นตารางพร้อมปก เปิดดูใน Chrome
#   python3 tools/factory/catalog.py            สร้าง /Volumes/PortableSSD/Sheetlab/โรงงาน.html แล้วจบ
#   python3 tools/factory/catalog.py --open     สร้างแล้วเปิดใน Chrome
#   python3 tools/factory/catalog.py --json     พิมพ์รายการเล่มเป็น JSON (ใช้ในแอปโรงงานบน Mac)
#   python3 tools/factory/catalog.py --sync     ส่งรายการเล่ม + ปกย่อ + สถานะ SSD/กำลังผลิต ขึ้นหน้าโรงงานบนเว็บ (worker.py queue เรียกให้ทุกชั่วโมง)
# ไม่ใช้ AI ไม่ใช้อินเทอร์เน็ต อ่านอย่างเดียว (ไม่แก้/ไม่ย้ายไฟล์หนังสือ) · ปกย่อเก็บใน _factory/thumbs (สร้างใหม่เฉพาะไฟล์ที่เปลี่ยน)
# เล่มที่นับ = ไฟล์ชื่อ NNN_YYYY-MM-DD_ชื่อ.pdf (เลขลำดับการผลิต) · ชุดขายแสดงแยกเป็นกลุ่ม
import html, json, os, re, subprocess, sys, time, urllib.request
from datetime import datetime
from pathlib import Path

SSD = Path('/Volumes/PortableSSD/Sheetlab')
OLD = Path.home() / 'Documents' / 'Academic'
OUT = SSD / 'โรงงาน.html'
THUMBS = SSD / '_factory' / 'thumbs'
SKIP = {'_factory', '_เก่า', '_kit', '_audio_test', '_image_test'}
NUM = re.compile(r'^(\d{3})_(\d{4}-\d{2}-\d{2})_(.+)\.pdf$')
POPPLER = '/opt/homebrew/bin'
# ไฟล์เสียงขึ้น Google Drive ผ่านแอป Drive ในเครื่อง · ที่ใหม่ = บัญชี postland (Sheetlab/Academic Audio) · ที่เก่า = บัญชี dksim.store
DRIVES = [Path.home() / 'Library/CloudStorage/GoogleDrive-postland.property@gmail.com/My Drive/Sheetlab/Academic Audio',
          Path.home() / 'Library/CloudStorage/GoogleDrive-dksim.store@gmail.com/My Drive/Academic Audio']
AUDIO_TARGET = 'https://drive.google.com/drive/folders/1BJ5RIbcK2-lmRj1_8EQB5Z8b64RYu5_f'  # Sheetlab/Academic Audio (postland)


def drive_id(p):
    try:
        v = subprocess.run(['/usr/bin/xattr', '-p', 'com.google.drivefs.item-id#S', str(p)], capture_output=True, text=True, timeout=10).stdout.strip()
        return v if v and not v.startswith('local') else ''
    except Exception: return ''


def drive_folders():
    out = []
    for d in DRIVES:
        try: out += [x for x in d.iterdir() if x.is_dir()]
        except Exception: pass
    return out


def audio_drive(title, folders):
    t = re.sub(r'\s+', ' ', title.upper()).strip()
    for f in folders:
        n = re.sub(r'\s+', ' ', f.name.upper()).strip()
        if n and (t.startswith(n) or n.startswith(t[:40])):
            if not any(x.suffix.lower() in ('.mp3', '.m4a', '.wav') for x in f.rglob('*')):
                continue  # โฟลเดอร์ว่าง (ยังไม่มีไฟล์เสียง) ไม่ใช้ · ลองโฟลเดอร์ถัดไป เช่น Drive เดิม (10 ต.ค. 69)
            i = drive_id(f)
            if i: return f'https://drive.google.com/drive/folders/{i}'
    return ''


def walk(root):
    if not root.exists(): return
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP and not d.startswith('.')]
        for f in files:
            if f.lower().endswith('.pdf') and not f.startswith('._'): yield Path(dirpath) / f


def pages(pdf):
    try:
        out = subprocess.run([f'{POPPLER}/pdfinfo', str(pdf)], capture_output=True, text=True, timeout=30).stdout
        m = re.search(r'^Pages:\s+(\d+)', out, re.M); return int(m.group(1)) if m else 0
    except Exception: return 0


def thumb(pdf, key):
    THUMBS.mkdir(parents=True, exist_ok=True)
    t = THUMBS / f'{key}.jpg'
    if t.exists() and t.stat().st_mtime >= pdf.stat().st_mtime: return t
    try:
        subprocess.run([f'{POPPLER}/pdftoppm', '-f', '1', '-l', '1', '-scale-to', '360', '-jpeg', '-jpegopt', 'quality=78', '-singlefile', str(pdf), str(t.with_suffix(''))], capture_output=True, timeout=60)
    except Exception: pass
    return t if t.exists() else None


def title_of(pdf, slug):
    # เล่มที่มีโฟลเดอร์ของตัวเอง ใช้ชื่อโฟลเดอร์ (ชื่อเต็มภาษาไทย) · ไม่มี ใช้ชื่อในไฟล์
    parent = pdf.parent.name
    if parent and not parent.startswith(('ชุดขาย',)) and pdf.parent.parent.name not in ('', 'Academic', 'Sheetlab') and parent not in SKIP:
        return parent
    return slug.replace('-', ' ').title()


API = 'https://sheetlabth.com/api/content?action=factory_library'


def key():
    try: m = re.search(r'[0-9a-f]{48}', (Path.home() / '.config' / 'sheetlab' / 'content-key').read_text()); return m.group(0) if m else ''
    except Exception: return os.environ.get('CONTENT_KEY', '')


def post(body, k):
    req = urllib.request.Request(API, data=json.dumps(body).encode(), headers={'x-content-key': k, 'Content-Type': 'application/json'}, method='POST')
    return json.load(urllib.request.urlopen(req, timeout=60))


def sync(books, sets):
    # อัปปกย่อเฉพาะเล่มที่ยังไม่เคยส่งหรือไฟล์เปลี่ยน แล้วส่งรายการทั้งหมด (ข้อมูลไม่มีที่อยู่ไฟล์ในเครื่อง)
    k = key()
    if not k: print(json.dumps({'ok': False, 'error': 'ไม่มีคีย์ร้าน'})); return
    done_f = THUMBS / '.synced.json'
    try: done = json.loads(done_f.read_text())
    except Exception: done = {}
    out = []
    for b in books:
        t = THUMBS / f"{b['no']}.jpg"; url = ''
        if t.exists():
            stamp = str(int(t.stat().st_mtime))
            if done.get(b['no'], {}).get('m') == stamp: url = done[b['no']]['u']
            else:
                try:
                    j = post({'thumb': b['no']}, k)
                    urllib.request.urlopen(urllib.request.Request(j['upload_url'], data=t.read_bytes(), method='PUT', headers={'Content-Type': 'image/jpeg', 'x-upsert': 'true'}), timeout=60).read()
                    url = j['file_url'] + f'?v={stamp}'; done[b['no']] = {'m': stamp, 'u': url}
                except Exception as e: print('thumb', b['no'], e, file=sys.stderr)
        out.append({k2: b[k2] for k2 in ('no', 'sku', 'day', 'title', 'cat', 'pages', 'mb', 'where', 'audio', 'audio_path', 'audio_drive', 'audio_target')} | {'thumb': url})
    try: done_f.write_text(json.dumps(done))
    except Exception: pass
    running = None
    lock = SSD / '_factory' / '.running'
    if lock.exists() and time.time() - lock.stat().st_mtime < 4 * 3600:
        running = {'note': lock.read_text(errors='ignore')[:300], 'since': datetime.fromtimestamp(lock.stat().st_mtime).astimezone().isoformat()}
    r = post({'ssd': SSD.exists(), 'running': running, 'books': out, 'sets': [{'name': s['name'], 'n': len(s['books']), 'where': s['where']} for s in sets.values()]}, k)
    print(json.dumps(r, ensure_ascii=False))


def main():
    books, sets, seen, dfold = [], {}, set(), drive_folders()
    for root, where in ((SSD, 'SSD'), (OLD, 'Mac')):
        for pdf in walk(root):
            rel = pdf.relative_to(root)
            if rel.parts[0] == 'ชุดขาย':
                if len(rel.parts) >= 3:
                    s = sets.setdefault(rel.parts[1], {'name': rel.parts[1], 'where': where, 'books': set(), 'path': str(root / 'ชุดขาย' / rel.parts[1])})
                    if not re.search(r'-mobile\.pdf$|flashcards', pdf.name, re.I): s['books'].add(rel.parts[2])
                continue
            m = NUM.match(pdf.name)
            if not m or m.group(1) in seen: continue
            seen.add(m.group(1))
            no, day, slug = m.groups()
            cat = rel.parts[0] if len(rel.parts) > 1 else '-'
            t = thumb(pdf, no)
            audio = (pdf.parent / 'audio').is_dir()
            title = title_of(pdf, slug)
            books.append({'no': no, 'sku': f'SL-{no}', 'audio_path': str(pdf.parent / 'audio') if audio else '', 'audio_drive': audio_drive(title, dfold) if audio else '', 'audio_target': AUDIO_TARGET if audio else '',
                          'day': day, 'title': title, 'cat': cat, 'pages': pages(pdf), 'mb': round(pdf.stat().st_size / 1e6, 1),
                          'where': where, 'path': str(pdf), 'pdf': pdf.as_uri(), 'folder': pdf.parent.as_uri(), 'thumb': t.as_uri() if t else '', 'audio': audio})
    books.sort(key=lambda b: b['no'], reverse=True)
    if '--sync' in sys.argv:
        if not SSD.exists():  # SSD หลุด: บอกเว็บว่าหา SSD ไม่เจอ (เว็บแจ้งคุณแดนถ้ามีเล่มรอผลิต) โดยไม่ทับรายการเดิมด้วยรายการว่าง
            k = key()
            if k: print(json.dumps(post({'ssd': False, 'running': None, 'books': books, 'sets': []}, k), ensure_ascii=False))
            return
        return sync(books, sets)
    if '--json' in sys.argv:  # แอปโรงงานบน Mac อ่านรายการนี้ (tools/factory/app/server.mjs)
        print(json.dumps({'ok': True, 'ssd': SSD.exists(), 'books': books, 'sets': [{'name': s['name'], 'n': len(s['books']), 'where': s['where'], 'path': s['path']} for s in sets.values()]}, ensure_ascii=False)); return
    cats = sorted({b['cat'] for b in books})
    e = html.escape
    row = lambda b: f'''<a class="bk" href="{e(b['pdf'])}" data-cat="{e(b['cat'])}" data-q="{e((b['title'] + ' ' + b['no']).lower())}" target="_blank">
<span class="cv">{f'<img src="{e(b["thumb"])}" alt="" loading="lazy">' if b['thumb'] else '<span class="nocv">ไม่มีปก</span>'}<em>#{e(b['no'])}</em>{'<i title="มีไฟล์เสียง">🎧</i>' if b['audio'] else ''}</span>
<b>{e(b['title'])}</b><span class="mt">{e(b['cat'])}</span><span class="mt">{b['pages']} หน้า · {b['mb']} MB · {datetime.strptime(b['day'], '%Y-%m-%d').strftime('%d/%m')} · {'💾 SSD' if b['where'] == 'SSD' else '💻 Mac'}</span></a>'''
    setrow = lambda s: f'<a class="st" href="{e(Path(s["path"]).as_uri())}" target="_blank"><b>📦 {e(s["name"])}</b><span class="mt">{len(s["books"])} เล่ม · {"💾 SSD" if s["where"] == "SSD" else "💻 Mac"}</span></a>'
    week = sum(1 for b in books if (datetime.now() - datetime.strptime(b['day'], '%Y-%m-%d')).days < 7)
    page = f'''<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>โรงงาน SheetLab</title>
<style>:root{{--bg:#EDF1F7;--card:#fff;--ink:#0F1B33;--mut:#56637D;--line:#D9E0EC;--brand:#2440E8;--gold:#f0b400}}
@media(prefers-color-scheme:dark){{:root{{--bg:#0d1220;--card:#161d30;--ink:#e8ecf5;--mut:#9aa6bf;--line:#2a3350}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,'Sarabun','IBM Plex Sans Thai',sans-serif}}
.w{{max-width:1180px;margin:0 auto;padding:20px 16px 60px}}h1{{margin:0;font-size:26px}}h2{{margin:28px 0 10px;font-size:19px}}.sub{{color:var(--mut);margin:4px 0 16px}}
.stats{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}}.stats div{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}}.stats b{{display:block;font-size:26px;color:var(--brand)}}.stats span{{color:var(--mut);font-size:13px}}
.bar{{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:18px 0 12px;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}}
.bar input{{flex:1;min-width:200px;font:inherit;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink)}}
.bar button{{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;cursor:pointer}}.bar button[aria-pressed=true]{{background:var(--ink);color:var(--bg)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}}
.bk{{display:flex;flex-direction:column;gap:3px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px;text-decoration:none;color:inherit}}.bk:hover{{border-color:var(--brand)}}
.cv{{position:relative;display:block;aspect-ratio:210/297;border-radius:8px;overflow:hidden;background:var(--bg);margin-bottom:6px}}.cv img{{width:100%;height:100%;object-fit:cover}}.nocv{{display:grid;place-items:center;height:100%;color:var(--mut);font-size:13px}}
.cv em{{position:absolute;left:6px;top:6px;background:var(--ink);color:var(--bg);font-style:normal;font-size:12px;font-weight:700;border-radius:6px;padding:1px 7px}}.cv i{{position:absolute;right:6px;top:6px;font-style:normal}}
.bk b{{font-size:14px;line-height:1.35}}.mt{{color:var(--mut);font-size:12.5px}}
.sets{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}}.st{{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;text-decoration:none;color:inherit}}
@media(max-width:640px){{.stats{{grid-template-columns:repeat(2,minmax(0,1fr))}}.grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}</style></head><body><div class="w">
<h1>🏭 โรงงาน SheetLab</h1><p class="sub">ทุกเล่มที่ผลิตแล้วบน SSD และในเครื่อง · อัปเดต {datetime.now().strftime('%d/%m/%Y %H:%M')} (โรงงานอัปเดตหน้านี้เองทุกรอบที่ผลิต) · กดที่เล่มเพื่อเปิด PDF</p>
<div class="stats"><div><b>{len(books)}</b><span>เล่มทั้งหมด</span></div><div><b>{week}</b><span>ผลิตใน 7 วันล่าสุด</span></div><div><b>{sum(b['pages'] for b in books):,}</b><span>หน้ารวม</span></div><div><b>{len(sets)}</b><span>ชุดขาย</span></div></div>
{f'<h2>📦 ชุดขาย</h2><div class="sets">{"".join(setrow(s) for s in sets.values())}</div>' if sets else ''}
<h2>📚 หนังสือทุกเล่ม</h2>
<div class="bar"><input id="q" placeholder="ค้นหาชื่อเล่มหรือเลขที่" aria-label="ค้นหา"><button data-c="" aria-pressed="true">ทั้งหมด</button>{"".join(f'<button data-c="{e(c)}" aria-pressed="false">{e(c)}</button>' for c in cats)}</div>
<div class="grid" id="g">{"".join(row(b) for b in books)}</div></div>
<script>var c='',q=document.getElementById('q'),bs=document.querySelectorAll('.bar button');function f(){{var s=q.value.trim().toLowerCase();document.querySelectorAll('.bk').forEach(function(a){{a.hidden=!((!c||a.dataset.cat===c)&&(!s||a.dataset.q.indexOf(s)>=0));}});}}
q.oninput=f;bs.forEach(function(b){{b.onclick=function(){{c=b.dataset.c;bs.forEach(function(x){{x.setAttribute('aria-pressed',x===b);}});f();}};}});</script></body></html>'''
    if not SSD.exists(): sys.exit('SSD ไม่ได้เสียบ (/Volumes/PortableSSD/Sheetlab) ไม่ได้สร้างหน้าภาพรวม')
    OUT.write_text(page, encoding='utf-8')
    print(json.dumps({'ok': True, 'books': len(books), 'sets': len(sets), 'page': str(OUT)}, ensure_ascii=False))
    if '--open' in sys.argv: subprocess.run(['open', '-a', 'Google Chrome', str(OUT)])


if __name__ == '__main__':
    main()
