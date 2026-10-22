# EP.3 "ฝรั่งถามทาง" แนวเรื่องเล่ามีเสียงพากย์ไทย (คุณแดน 22 ต.ค. 69 ส่งตัวอย่าง ZIAK Story: พากย์ไทย + ซับคำต่อคำ คำสำคัญสีแดง + การ์ดกฎข้อ)
# เสียงทั้งหมดผ่าน voice.py (ElevenLabs + ตรวจเสียงตรงบท) · เขียน data.js: บท ความยาว และช่วงซับแต่ละท่อน
#   ท่อนซับคั่นด้วย | · *คำ* = ตัวแดง
import os, sys, json, subprocess, wave
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../..')); sys.argv = sys.argv[:1]
import vocab as V
FF = os.path.join(HERE, '../../../../node_modules/ffmpeg-static/ffmpeg')
NARR = 'Aria'
LINES = [
  ('n1', 'narr', 'ถ้าวันหนึ่ง|มี*ฝรั่ง*เดินมาถามทางคุณ|สิ่งที่น่ากลัวที่สุด|ไม่ใช่*ฟังไม่ออก*'),
  ('n2', 'narr', 'แต่คือ|ตอบว่า *Yes*|ทั้งที่*ไม่รู้เรื่อง*'),
  ('f1', 'fen', 'Excuse me, how do I get to the Grand Palace?', 'ขอโทษครับ ไปพระบรมมหาราชวังยังไงครับ?'),
  ('m1', 'men', 'Yes! Yes!', 'เยส! เยส!'),
  ('f2', 'fen', 'Um... okay?', 'เอ่อ... โอเค?'),
  ('n3', 'narr', 'มิวก็เหมือน*คนไทยหลายคน*|ตกใจจนตอบ Yes ไปก่อน|วันนี้*พี่ชีท*|มีกฎ 3 ข้อมาฝาก'),
  ('n4', 'narr', '*กฎข้อ 1*|ฟังไม่ทัน อย่าเดา|ให้ขอเขา*พูดซ้ำ*'),
  ('m2', 'men', 'Sorry, could you say that again?', 'ขอโทษค่ะ พูดอีกครั้งได้ไหมคะ?'),
  ('f3', 'fen', 'How do I get to the Grand Palace?', 'ไปพระบรมมหาราชวังยังไงครับ?'),
  ('n5', 'narr', '*กฎข้อ 2*|ไม่ต้องฟังทุกคำ|จับแค่*คำสำคัญ*|Grand Palace|ก็คือ*พระบรมมหาราชวัง*'),
  ('n6', 'narr', '*กฎข้อ 3*|ตอบเป็น*ประโยคสั้นๆ*|ทีละขั้น'),
  ('m3', 'men', 'Take the BTS to Saphan Taksin. Then take the boat.', 'นั่ง BTS ไปสะพานตากสิน แล้วต่อเรือค่ะ'),
  ('f4', 'fen', 'Thank you so much!', 'ขอบคุณมากครับ!'),
  ('n7', 'narr', 'รอดไปหนึ่งด่าน|แต่ถ้าฝรั่ง*ชวนคุยต่อ*ล่ะ?|มิวจะ*รอด*ไหม|ติดตามตอนต่อไป'),
]


sys.path.insert(0, os.path.join(HERE, '..')); import voice
voice.build(HERE, LINES)
