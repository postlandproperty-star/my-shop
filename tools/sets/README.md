# ส่งชุดขายจากคอมขึ้นหลังบ้าน

หลังคิวหนังสือ (Cowork) ผลิตชุดเสร็จในโฟลเดอร์ `/Volumes/PortableSSD/Sheetlab/ชุดขาย/<ชื่อชุด>/` ให้เขียน `set.json` ไว้ในโฟลเดอร์ชุด แล้วรัน

```
CONTENT_KEY=<คีย์ร้าน> python3 ~/Projects/my-shop/tools/sets/upload_set.py "/Volumes/PortableSSD/Sheetlab/ชุดขาย/<ชื่อชุด>"
```

สคริปต์อัป PDF + ปก (cover.png) + หน้าตัวอย่างหน้า 3-6 (ใส่ลายน้ำ) ขึ้นคลังร้าน แล้วสร้างการ์ด "📦 ชุดพร้อมลงขาย" ในแท็บสินค้าและเซลเพจ คุณแดนตรวจราคาแล้วกด "ลงขายทั้งชุด" เอง

ไฟล์เสียง (โฟลเดอร์ audio) ไม่อัปขึ้นคลังร้าน ลูกค้าฟังผ่าน QR ในเล่มที่ชี้ไป Google Drive

## set.json

ดูตัวอย่างเต็มที่ `set.example.json` (ชุด TOEIC 750+)

- `id` ภาษาอังกฤษตัวเล็ก/ตัวเลข/ขีด ไม่ซ้ำชุดอื่น เช่น `ielts65`
- `name`, `headline`, `desc`, `features` (บรรทัดละข้อ), `price` (ราคาชุดที่เสนอ คุณแดนแก้ได้ตอนลงขาย), `note`, `notion` (ลิงก์การ์ด Notion)
- `books[]` แต่ละเล่ม
  - เล่มที่ร้านมีอยู่แล้ว: `{"key":"01","match":"<คำในชื่อสินค้าที่ร้านมี ตัวพิมพ์เล็ก>","title":"...","name":"...","price":129}`
  - เล่มใหม่: `{"key":"04","dir":"04 ","slug":"toeic-listening-...","cat":"listening","price":199,"title":"...","name":"ชื่อขาย","desc":"...","features":"บรรทัดละข้อ","forwho":"บรรทัดละข้อ","audio":true,"drive":"https://drive.google.com/..."}`
  - `dir` = คำขึ้นต้นชื่อโฟลเดอร์เล่ม (เช่น `"04 "`) · `cat` = notion, grammar, vocab, listening, reading, mock, ielts, tgat, kp, speak, work, general
  - ห้ามใช้คำว่า "เจ้าของภาษา" กับเล่มที่เสียงเป็น AI
