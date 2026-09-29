# SheetLab reel builder
`python3 tools/reel/build.py spec.json out.mp4` — สร้างคลิปแนวตั้ง 1080x1920 (รูปของใกล้ตัว + คำถาม + เฉลย + มาสคอตน้องคลิป + เสียงไทย ElevenLabs ผ่าน `action=tts`)
- ต้องมี `CONTENT_KEY` ใน env, `pip install pillow`, และ ffmpeg (`cd tools/reel && npm i ffmpeg-static`)
- รูปค้นจาก Openverse (เฉพาะสัญญาอนุญาตเชิงพาณิชย์) ถ้าหาไม่ได้ใช้การ์ดตัวหนังสือแทน
- ฟอนต์ Kanit (OFL) อยู่ใน fonts/
- สเปกตัวอย่าง: spec.example.json


## ตรวจรูปก่อนสร้างจริง (ไม่เสียเครดิตเสียง)

```bash
DRY=1 CONTENT_KEY=... python3 tools/reel/build.py spec.json reel.mp4   # วาดสไลด์ใน .reel_work/ อย่างเดียว เปิดดู s01q.png..s04q.png
python3 tools/reel/build.py candidates "spoon rest ceramic" sheet.png   # แผ่นรวมรูปตัวเลือก 8 รูป (เลข 1-8) + JSON image_id
```

ถ้ารูปที่ค้นอัตโนมัติผิด ให้ใส่ `"image_id": "<id จาก candidates>"` ในข้อนั้นของ spec.json แทนการเดา query ใหม่
เสียงพากย์ถูกแคชตามข้อความ+เสียงใน `.cache/` รันซ้ำด้วยข้อความเดิมไม่เรียก ElevenLabs อีก

## แก้คลิปที่อัปโหลดไปแล้ว (ลิงก์เดิม)

`POST ?action=upload_sign` ใส่ `{"name":"x.mp4","type":"video/mp4","overwrite":"reels/<path เดิม>.mp4"}` จะได้ upload_url ที่เขียนทับไฟล์เดิม ร่างที่ส่งเข้าคิวแล้วจึงไม่ต้องสร้างใหม่


## สองรูปแบบคลิป (สลับกันไม่ให้ซ้ำ)

- `"style": "photo"` (ค่าเริ่มต้น) รูปนิ่งซูมช้า + เสียงพากย์ เบา เร็ว
- ทุกคลิปมีเพลงประกอบที่ build.py แต่งขึ้นเองด้วยโค้ด (คีย์บอร์ด เบส กลอง ทำนองกระดิ่ง คีย์/จังหวะ/ทำนองสุ่มตามเนื้อหาคลิป แต่ละคลิปไม่ซ้ำกัน) ไม่มีลิขสิทธิ์คนอื่น ไม่ต้องให้เครดิต ไม่ต้องโหลดจากเน็ต เพลงเบาลงเองตอนมีเสียงพากย์ ตั้ง `"music_mood": "chill"` ให้ช้าลง นุ่มลง (ค่าเริ่ม `"upbeat"`) หรือ `"music": false` ปิดเพลง ห้ามใส่เพลงดังที่มีลิขสิทธิ์ (Facebook ปิดเสียงหรือบล็อกคลิป)
- `"style": "motion"` การ์ดคำถาม/เฉลยเลื่อนเข้ามาจากล่างพร้อมเสียงวูช เฉลยมีเสียงติ๊ง ซูมแรงขึ้น
