# SheetLab reel builder
`python3 tools/reel/build.py spec.json out.mp4` — สร้างคลิปแนวตั้ง 1080x1920 (รูปของใกล้ตัว + คำถาม + เฉลย + มาสคอตน้องปากกา + เสียงไทย ElevenLabs ผ่าน `action=tts`)
- ต้องมี `CONTENT_KEY` ใน env, `pip install pillow`, และ ffmpeg (`cd tools/reel && npm i ffmpeg-static`)
- รูปค้นจาก Openverse (เฉพาะสัญญาอนุญาตเชิงพาณิชย์) ถ้าหาไม่ได้ใช้การ์ดตัวหนังสือแทน
- ฟอนต์ Kanit (OFL) อยู่ใน fonts/
- สเปกตัวอย่าง: spec.example.json
