import json, re, html, subprocess, sys, os
from playwright.sync_api import sync_playwright

D = "/home/claude/toeic"
F = D + "/node_modules/@fontsource"
BOOK = "TOEIC GRAMMAR"
units = [json.load(open(f"{D}/units/u{i:02d}.json")) for i in range(1, 16)]
mock = json.load(open(f"{D}/units/mock.json"))
toc_pages = json.load(open(f"{D}/toc.json")) if os.path.exists(f"{D}/toc.json") else {}

def e(s): return html.escape(str(s))
def md(s):
    s = e(s)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
def blank(q): return md(q).replace("-------", '<span class="blank">&nbsp;</span>')

def fontface():
    out = []
    for fam, dn, ws in (("Kanit", "kanit", (500, 600, 700)), ("NotoThai", "noto-sans-thai", (400, 600, 700))):
        for w in ws:
            for sub, rng in (("thai", "U+0E01-0E5B, U+200C-200D, U+25CC"), ("latin", "U+0000-00FF, U+2000-206F, U+2190-21FF, U+2212, U+2713, U+2717, U+2192")):
                out.append(f"@font-face{{font-family:'{fam}';font-weight:{w};src:url('file://{F}/{dn}/files/{dn}-{sub}-{w}-normal.woff2') format('woff2');unicode-range:{rng}}}")
    return "\n".join(out)

CSS = fontface() + """
@page{size:A4;margin:20mm 17mm 18mm}
:root{--navy:#1e2b53;--gold:#f0b400;--ink:#1f2433;--muted:#6b7285;--line:#d9dde6;--soft:#f3f5f9;--red:#c0392b;--green:#1f8a4c}
*{box-sizing:border-box}
body{margin:0;font-family:'NotoThai',sans-serif;font-size:11pt;line-height:1.55;color:var(--ink)}
h1,h2,h3,h4,.k{font-family:'Kanit',sans-serif;color:var(--navy);font-weight:600;line-height:1.3}
.pb{break-before:page}
b{color:var(--navy);font-weight:600}
/* unit opener */
.uhead{display:flex;gap:14px;align-items:stretch;margin-bottom:10px}
.unum{background:var(--navy);color:#fff;font-family:'Kanit';font-weight:700;font-size:30pt;padding:6px 16px;border-radius:6px;line-height:1.1;text-align:center}
.unum small{display:block;font-size:9pt;font-weight:500;color:var(--gold);letter-spacing:.08em}
.uhead h1{margin:2px 0 0;font-size:24pt;font-weight:700}
.uhead .th{font-family:'Kanit';font-weight:500;font-size:13pt;color:var(--muted)}
.why{background:var(--soft);border-left:4px solid var(--gold);padding:8px 12px;margin:8px 0 14px;border-radius:0 6px 6px 0}
.rule{margin:0 0 12px;break-inside:avoid}
.rule h3{font-size:13pt;margin:0 0 3px}
.rule h3 .rn{display:inline-block;background:var(--gold);color:var(--navy);border-radius:4px;padding:0 7px;margin-right:6px;font-size:10.5pt}
.rule p{margin:0 0 4px}
.formula{font-family:'Kanit';font-weight:500;font-size:10.5pt;background:#fff7dc;border:1px dashed #e0b43a;border-radius:5px;padding:3px 10px;display:inline-block;margin:2px 0 5px;color:#6b4e00}
.ex{margin:2px 0 0 10px;padding-left:10px;border-left:2px solid var(--line)}
.ex div{margin:1px 0}
.ex .en{font-weight:600}
.ex .tt{color:var(--muted);font-size:10pt}
table.ref{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:10pt;break-inside:avoid}
table.ref th{background:var(--navy);color:#fff;font-family:'Kanit';font-weight:500;text-align:left;padding:5px 8px}
table.ref td{border-bottom:1px solid var(--line);padding:4px 8px;vertical-align:top}
table.ref tr:nth-child(even) td{background:var(--soft)}
.tabt{font-family:'Kanit';font-weight:600;color:var(--navy);font-size:12pt;margin-top:4px}
.box{border-radius:6px;padding:9px 13px;margin:0 0 12px;break-inside:avoid}
.box h4{margin:0 0 4px;font-size:12pt}
.traps{background:#fdf1ef;border:1px solid #f1c7c1}
.traps h4{color:var(--red)}
.traps ul{margin:0;padding-left:18px}.traps li{margin:2px 0}
.tip{background:#eaf6ef;border:1px solid #bfe3cc}
.tip h4{color:var(--green)}
/* exercises */
.sech{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--navy);margin:0 0 10px;padding-bottom:3px}
.sech h2{margin:0;font-size:17pt}
.sech span{font-family:'Kanit';color:var(--muted);font-size:10pt}
.q{display:grid;grid-template-columns:30px 1fr;margin:0 0 9px;break-inside:avoid}
.q .no{font-family:'Kanit';font-weight:600;color:var(--navy)}
.q .opts{display:grid;grid-template-columns:repeat(4,1fr);gap:2px 10px;margin-top:2px;font-size:10.5pt}
.q .opts span b{font-family:'Kanit';font-weight:500;margin-right:3px}
.blank{display:inline-block;min-width:62px;border-bottom:1.3px solid var(--ink);margin:0 2px}
h2+.lvl,.sech+.lvl{break-before:avoid}
.lvl{break-after:avoid;font-family:'Kanit';font-size:9.5pt;color:var(--muted);margin:8px 0 6px;letter-spacing:.03em}
.score{margin-top:8px;font-family:'Kanit';font-size:10.5pt;color:var(--navy);border:1px solid var(--line);border-radius:6px;padding:6px 12px;display:inline-block}
/* answers */
.ans{display:grid;grid-template-columns:30px 26px 1fr;gap:0 6px;padding:4px 0;border-bottom:1px dotted var(--line);font-size:10pt;break-inside:avoid}
.ans .no{font-family:'Kanit';color:var(--muted)}
.ans .key{font-family:'Kanit';font-weight:700;color:#fff;background:var(--green);border-radius:4px;text-align:center;height:19px;line-height:19px;font-size:9.5pt}
.ans .word{font-weight:600;color:var(--navy)}
.keygrid{display:grid;grid-template-columns:repeat(10,1fr);gap:3px;margin:0 0 12px;font-family:'Kanit';font-size:9.5pt}
.keygrid div{border:1px solid var(--line);border-radius:4px;text-align:center;padding:1px 0}
.keygrid b{color:var(--green)}
/* front matter */
.cover{height:257mm;margin:-20mm -17mm -18mm;height:297mm;width:210mm;background:var(--navy);position:relative;color:#fff;padding:36mm 30mm 0 22mm}
.cover .band{position:absolute;right:0;top:0;bottom:0;width:18mm;background:var(--gold)}
.cover .kick{font-family:'Kanit';font-weight:500;color:var(--gold);font-size:12pt}
.cover h1{color:#fff;font-size:54pt;font-weight:700;line-height:1.02;margin:14px 0 4px}
.cover .big{font-family:'Kanit';font-weight:700;color:var(--gold);font-size:34pt;line-height:1.15}
.cover .sub{font-family:'Kanit';font-weight:500;font-size:16pt;margin:18px 0 26px;line-height:1.4}
.cover ul{list-style:none;padding:0;margin:0;font-size:13pt}
.cover li{margin:6px 0}.cover li:before{content:'✓ ';color:var(--gold)}
.cover .foot{position:absolute;left:22mm;right:30mm;bottom:22mm;border-top:1px solid #3c4a78;padding-top:10px;color:#c9cfe2;font-size:11pt}
.cover .lv{display:inline-block;border:1.5px solid var(--gold);color:var(--gold);border-radius:999px;padding:2px 14px;font-family:'Kanit';font-size:11pt;margin-top:4px}
.toc{width:100%;border-collapse:collapse}
.toc td{padding:6px 4px;border-bottom:1px dotted var(--line)}
.toc td.n{font-family:'Kanit';font-weight:600;color:var(--gold);width:38px;font-size:13pt}
.toc td.p{text-align:right;font-family:'Kanit';color:var(--muted);width:40px}
.toc .en{font-family:'Kanit';font-weight:500;color:var(--navy)}
.toc .th{color:var(--muted);font-size:10pt}
.intro p{margin:0 0 8px}
.steps{counter-reset:s;list-style:none;padding:0}
.steps li{counter-increment:s;margin:0 0 9px;padding-left:36px;position:relative}
.steps li:before{content:counter(s);position:absolute;left:0;top:0;width:25px;height:25px;border-radius:50%;background:var(--navy);color:#fff;font-family:'Kanit';text-align:center;line-height:25px}
table.track{width:100%;border-collapse:collapse;font-size:10pt}
table.track th{background:var(--navy);color:#fff;font-family:'Kanit';font-weight:500;padding:5px 6px}
table.track td{border:1px solid var(--line);padding:5px 6px;height:26px}
table.track td:first-child{font-family:'Kanit';color:var(--navy);text-align:center;width:32px}
/* mock */
.passage{border:1px solid var(--line);border-radius:6px;padding:10px 14px;background:var(--soft);margin:0 0 10px;break-inside:avoid;font-size:10.5pt}
.passage .pt{font-family:'Kanit';font-weight:600;color:var(--navy);margin-bottom:4px}
.pb6{font-family:'Kanit';font-weight:600;background:var(--navy);color:#fff;border-radius:3px;padding:0 6px;font-size:9.5pt}
.sheet{display:grid;grid-template-columns:repeat(5,1fr);gap:9px 14px;font-family:'Kanit';font-size:10pt}
.sheet div{white-space:nowrap}
.sheet i{font-style:normal;display:inline-block;width:17px;height:17px;border:1.2px solid var(--muted);border-radius:50%;text-align:center;line-height:15px;font-size:8.5pt;margin-left:3px;color:var(--muted)}
.sheet .n{display:inline-block;width:22px;color:var(--navy);font-weight:600}
.band{background:var(--soft);border-radius:6px;padding:8px 12px;margin:10px 0}
.marker{font-size:5pt;color:#fff;position:absolute}
"""

def unit_html(u):
    n = u["no"]
    h = [f'<section class="pb"><span class="marker">@@U{n}@@</span>']
    h.append(f'<div class="uhead"><div class="unum"><small>UNIT</small>{n:02d}</div><div><h1>{e(u["title_en"])}</h1><div class="th">{e(u["title_th"])}</div></div></div>')
    h.append(f'<div class="why"><b>ทำไมออกบ่อย:</b> {md(u["why"])}</div>')
    for i, r in enumerate(u["rules"], 1):
        h.append(f'<div class="rule"><h3><span class="rn">{i}</span>{md(r["head"])}</h3><p>{md(r["body"])}</p>')
        if r.get("formula"): h.append(f'<div class="formula">{e(r["formula"])}</div>')
        h.append('<div class="ex">' + "".join(f'<div class="en">{md(x["en"])}</div><div class="tt">{md(x["th"])}</div>' for x in r["examples"]) + '</div></div>')
    t = u.get("table")
    if t:
        h.append(f'<div style="break-inside:avoid"><div class="tabt">{e(t["title"])}</div><table class="ref"><tr>' + "".join(f"<th>{e(c)}</th>" for c in t["cols"]) + "</tr>")
        h.append("".join("<tr>" + "".join(f"<td>{md(c)}</td>" for c in row) + "</tr>" for row in t["rows"]) + "</table></div>")
    h.append('<div class="box traps"><h4>⚠ คนไทยพลาดบ่อย</h4><ul>' + "".join(f"<li>{md(x)}</li>" for x in u["traps"]) + "</ul></div>")
    h.append(f'<div class="box tip"><h4>เทคนิคทำข้อสอบเร็ว</h4>{md(u["tip"])}</div></section>')
    # exercises
    h.append(f'<section style="margin-top:22px"><div class="sech" style="break-after:avoid"><h2>แบบฝึกหัด Unit {n}: {e(u["title_en"])}</h2><span>30 ข้อ · Part 5</span></div>')
    for i, q in enumerate(u["exercises"], 1):
        if i == 1: h.append('<div class="lvl">ข้อ 1–10 · ระดับพื้นฐาน</div>')
        if i == 11: h.append('<div class="lvl">ข้อ 11–25 · ระดับกลาง</div>')
        if i == 26: h.append('<div class="lvl">ข้อ 26–30 · ระดับยาก (ท้าทาย)</div>')
        h.append(qhtml(i, q))
    h.append('<div class="score">คะแนนที่ได้ ______ / 30 &nbsp;&nbsp; ถ้าได้ 24 ขึ้นไป ไปบทถัดไปได้เลย</div></section>')
    h.append(answers_html(f"เฉลยละเอียด Unit {n}", u["exercises"], 1))
    return "".join(h)

def qhtml(i, q):
    return (f'<div class="q"><span class="no">{i}.</span><div><div>{blank(q["q"])}</div><div class="opts">' +
            "".join(f'<span><b>({"ABCD"[k]})</b>{e(o)}</span>' for k, o in enumerate(q["options"])) + "</div></div></div>")

def answers_html(title, items, start, nums=None):
    h = [f'<section class="pb"><div class="sech"><h2>{e(title)}</h2><span>ตรวจคำตอบ แล้วอ่านเหตุผลทุกข้อที่ผิด</span></div><div class="keygrid">']
    for k, q in enumerate(items):
        no = nums[k] if nums else start + k
        h.append(f'<div>{no}. <b>{q["answer"]}</b></div>')
    h.append("</div>")
    for k, q in enumerate(items):
        no = nums[k] if nums else start + k
        word = q["options"]["ABCD".index(q["answer"])]
        h.append(f'<div class="ans"><span class="no">{no}.</span><span class="key">{q["answer"]}</span><div><span class="word">{e(word)}</span> — {md(q["explain"])}</div></div>')
    h.append("</section>")
    return "".join(h)

def front():
    h = []
    h.append('<section><span class="marker">@@INTRO@@</span><h1 style="font-size:22pt;margin:0 0 8px">วิธีใช้หนังสือเล่มนี้</h1><div class="intro">')
    h.append('<p>TOEIC Part 5 (Incomplete Sentences) และ Part 6 (Text Completion) รวมกันมี <b>46 ข้อ</b> จาก Reading 100 ข้อ และโจทย์ส่วนใหญ่วัด <b>ไวยากรณ์ชุดเดิมซ้ำทุกปี</b> หนังสือเล่มนี้คัด 15 จุดที่ออกบ่อยที่สุดมาอธิบายเป็นภาษาไทยแบบสั้น ใช้ทำข้อสอบได้ทันที พร้อมแบบฝึกหัดที่แต่งใหม่ทั้งหมดตามรูปแบบข้อสอบจริง <b>500 ข้อ</b> และเฉลยละเอียดทุกข้อ</p>')
    h.append('<ol class="steps"><li><b>อ่านสรุปกฎ</b> ของแต่ละ Unit (2–3 หน้า) ดูสูตร ตัวอย่างประโยค ตาราง และกล่อง “คนไทยพลาดบ่อย”</li>'
             '<li><b>ทำแบบฝึกหัด 30 ข้อ</b> จับเวลา ข้อละไม่เกิน 30 วินาที (ข้อสอบจริงมีเวลาเฉลี่ยประมาณ 30 วินาทีต่อข้อใน Part 5)</li>'
             '<li><b>ตรวจเฉลยและอ่านเหตุผล</b> ทุกข้อที่ผิดหรือเดาถูก จดจุดที่พลาดลงตารางติดตามผลหน้าถัดไป</li>'
             '<li><b>ทำข้อสอบเสมือนจริง 50 ข้อ</b> ท้ายเล่มเมื่อเรียนครบ แล้วใช้ตาราง “ผิดข้อไหน กลับไปทบทวน Unit ไหน” ในเฉลย</li></ol>')
    h.append('<div class="box tip"><h4>สูตรเร็ว 3 ขั้นสำหรับ Part 5</h4>1) ดูตัวเลือกก่อน ว่าเป็นโจทย์ “รูปคำ” (รากเดียวกัน) “ไวยากรณ์” หรือ “คำศัพท์” &nbsp;2) ดูคำหน้าและหลังช่องว่าง &nbsp;3) แปลทั้งประโยคเฉพาะเมื่อจำเป็น — ข้อไวยากรณ์ส่วนใหญ่ตอบได้โดยไม่ต้องแปลทั้งประโยค</div>')
    h.append('<div class="band"><b>หมายเหตุ:</b> แบบฝึกหัดและข้อสอบในเล่มนี้เขียนขึ้นใหม่ทั้งหมดเพื่อการฝึกฝน ไม่ใช่ข้อสอบจริงของ ETS; TOEIC เป็นเครื่องหมายการค้าของ ETS ซึ่งไม่ได้เกี่ยวข้องกับหนังสือเล่มนี้</div></div></section>')
    # TOC
    h.append('<section class="pb"><h1 style="font-size:22pt;margin:0 0 8px">สารบัญ</h1><table class="toc">')
    for u in units:
        p = toc_pages.get(f"U{u['no']}", "")
        h.append(f'<tr><td class="n">{u["no"]:02d}</td><td><div class="en">{e(u["title_en"])}</div><div class="th">{e(u["title_th"])}</div></td><td class="p">{p}</td></tr>')
    h.append(f'<tr><td class="n">★</td><td><div class="en">Mock Test 50 ข้อ (Part 5 + Part 6)</div><div class="th">ข้อสอบเสมือนจริง พร้อมกระดาษคำตอบและเฉลย</div></td><td class="p">{toc_pages.get("MOCK","")}</td></tr></table></section>')
    # tracker
    h.append('<section class="pb"><h1 style="font-size:22pt;margin:0 0 4px">ตารางติดตามผล</h1><p style="color:var(--muted);margin:0 0 10px">กรอกคะแนนหลังทำแต่ละ Unit เป้าหมายคือ 24/30 (80%) ขึ้นไป ถ้ายังไม่ถึง ให้ทบทวนกฎแล้วทำข้อที่ผิดซ้ำอีกรอบ</p>')
    h.append('<table class="track"><tr><th>#</th><th>หัวข้อ</th><th>รอบ 1</th><th>รอบ 2</th><th>จุดที่ยังพลาด</th></tr>')
    for u in units:
        h.append(f'<tr><td>{u["no"]}</td><td>{e(u["title_en"])}</td><td>&nbsp;/30</td><td>&nbsp;/30</td><td></td></tr>')
    h.append('<tr><td>★</td><td>Mock Test</td><td>&nbsp;/50</td><td>&nbsp;/50</td><td></td></tr></table></section>')
    return "".join(h)

def mock_html():
    p5, p6 = mock["part5"], mock["part6"]
    h = ['<section class="pb"><span class="marker">@@MOCK@@</span><div class="uhead"><div class="unum"><small>TEST</small>★</div><div><h1>Mock Test 50 ข้อ</h1><div class="th">ข้อสอบเสมือนจริง Part 5 (42 ข้อ) + Part 6 (8 ข้อ) · เวลา 25 นาที</div></div></div>']
    h.append('<div class="why">ทำรวดเดียวโดยไม่เปิดเฉลย จับเวลา 25 นาที ฝนคำตอบในกระดาษคำตอบหน้าสุดท้ายของข้อสอบ แล้วตรวจกับเฉลยพร้อมดูว่าข้อที่ผิดมาจาก Unit ไหน</div>')
    h.append('<div class="sech"><h2>Part 5 · Incomplete Sentences</h2><span>ข้อ 1–42</span></div>')
    for i, q in enumerate(p5, 1): h.append(qhtml(i, q))
    h.append('</section><section class="pb"><div class="sech"><h2>Part 6 · Text Completion</h2><span>ข้อ 43–50</span></div>')
    no = 43; nums6 = []
    for p in p6:
        txt = md(p["text"]).replace("\n", "<br>")
        for j in range(1, 5):
            txt = txt.replace(f"[{j}]", f'<span class="pb6">{no + j - 1}</span><span class="blank">&nbsp;</span>')
        h.append(f'<div class="passage"><div class="pt">Questions {no}–{no+3} refer to the following {e(p["title"]).lower()}.</div>{txt}</div>')
        for j, it in enumerate(p["items"]):
            h.append(f'<div class="q"><span class="no">{no+j}.</span><div><div class="opts">' + "".join(f'<span><b>({"ABCD"[k]})</b>{e(o)}</span>' for k, o in enumerate(it["options"])) + "</div></div></div>")
            nums6.append(no + j)
        no += 4
    h.append('<div class="sech pb"><h2>กระดาษคำตอบ</h2><span>ระบายวงกลม</span></div><div class="sheet">')
    for i in range(1, 51): h.append(f'<div><span class="n">{i}</span>' + "".join(f"<i>{c}</i>" for c in "ABCD") + "</div>")
    h.append('</div><div class="score" style="margin-top:12px">คะแนนรวม ______ / 50</div></section>')
    allq = p5 + [it for p in p6 for it in p["items"]]
    h.append(answers_html("เฉลย Mock Test", allq, 1))
    # diagnosis
    h.append('<section class="pb"><div class="sech"><h2>ผิดข้อไหน กลับไปทบทวน Unit ไหน</h2><span>วงข้อที่ผิด แล้วดูว่าต้องกลับไปอ่าน Unit ใด</span></div><table class="track"><tr><th>Unit</th><th>หัวข้อ</th><th>ข้อใน Mock Test</th><th>ผิดกี่ข้อ</th></tr>')
    for u in units:
        qs = [str(i) for i, q in enumerate(allq, 1) if q.get("unit") == u["no"]]
        h.append(f'<tr><td>{u["no"]}</td><td>{e(u["title_en"])}</td><td>{", ".join(qs)}</td><td></td></tr>')
    h.append('</table><div class="box tip" style="margin-top:14px"><h4>ผลคะแนนบอกอะไร</h4><b>45–50</b> พร้อมมาก ไปเน้น Part 7 และคำศัพท์ต่อได้ · <b>35–44</b> ดีแล้ว ทบทวนเฉพาะ Unit ที่ผิดเกิน 1 ข้อ · <b>ต่ำกว่า 35</b> ทำแบบฝึกหัดใน Unit ที่พลาดซ้ำอีกรอบ แล้วทำ Mock Test ใหม่หลัง 1 สัปดาห์</div>')
    h.append('<div style="margin-top:30px;text-align:center;color:var(--muted)"><div class="k" style="font-size:16pt;color:var(--navy)">ขอให้ได้คะแนนตามเป้า!</div>หนังสือชุดเรียนภาษาอังกฤษสำหรับคนไทย · SheetLab</div></section>')
    return "".join(h)

def cover():
    return f"""<div class="cover"><div class="band"></div>
<div class="kick">หนังสือเตรียมสอบ TOEIC สำหรับคนไทย · Part 5–6</div>
<h1>TOEIC<br>GRAMMAR</h1><div class="big">15 จุดออกสอบบ่อยที่สุด</div>
<div class="sub">+ แบบฝึกหัด 500 ข้อ<br>พร้อมเฉลยละเอียดเป็นภาษาไทยทุกข้อ</div>
<ul><li>สรุปกฎสั้น เข้าใจง่าย พร้อมสูตรและตัวอย่างประโยค</li><li>กล่อง “คนไทยพลาดบ่อย” + เทคนิคทำข้อสอบเร็ว</li><li>แบบฝึกหัด Unit ละ 30 ข้อ ไล่จากง่ายไปยาก</li><li>Mock Test 50 ข้อ (Part 5 + Part 6) พร้อมกระดาษคำตอบ</li></ul>
<div class="foot"><span class="lv">ระดับกลาง-สูง (B2)</span>&nbsp;&nbsp; แบบฝึกหัดแต่งใหม่ทั้งหมดตามรูปแบบข้อสอบ</div></div>"""

def page(body): return f'<!doctype html><html lang="th"><head><meta charset="utf-8"><style>{CSS}</style></head><body>{body}</body></html>'

open(f"{D}/cover.html", "w").write(page(cover()))
open(f"{D}/body.html", "w").write(page(front() + "".join(unit_html(u) for u in units) + mock_html()))

HDR = f'<div style="width:100%;font-family:Kanit,sans-serif;font-size:7.5pt;color:#8a90a2;padding:0 17mm;display:flex;justify-content:space-between"><span>{BOOK} · 15 จุดออกสอบบ่อยที่สุด</span><span>SheetLab</span></div>'
FTR = '<div style="width:100%;text-align:center;font-size:8pt;color:#8a90a2;font-family:sans-serif"><span class="pageNumber"></span></div>'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto(f"file://{D}/cover.html"); pg.wait_for_timeout(400)
    pg.pdf(path=f"{D}/cover.pdf", format="A4", print_background=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"}, prefer_css_page_size=False)
    pg.goto(f"file://{D}/body.html"); pg.wait_for_timeout(600)
    pg.pdf(path=f"{D}/body.pdf", format="A4", print_background=True, display_header_footer=True, header_template=HDR, footer_template=FTR,
           margin={"top": "20mm", "bottom": "18mm", "left": "17mm", "right": "17mm"})
    b.close()
subprocess.run(["pdfunite", f"{D}/cover.pdf", f"{D}/body.pdf", f"{D}/out.pdf"], check=True)
# find markers -> toc pages (body page numbers)
toc = {}
n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", f"{D}/body.pdf"], capture_output=True, text=True).stdout).group(1))
for i in range(1, n + 1):
    t = subprocess.run(["pdftotext", "-f", str(i), "-l", str(i), f"{D}/body.pdf", "-"], capture_output=True, text=True).stdout
    for m in re.findall(r"@@(U\d+|MOCK|INTRO)@@", t): toc[m] = i
json.dump(toc, open(f"{D}/toc.json", "w"))
print("pages", n + 1, toc)
