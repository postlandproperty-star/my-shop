# วิจัยคู่แข่ง: Amazon KDP (ตลาด US, หนังสือภาษาอังกฤษ)

วันที่เก็บข้อมูล: 2026-10-12 · ไฟล์ข้อมูลดิบ: `us-amazon-kdp.csv` (40 แถว)

> **ข้อจำกัดของวิธีเก็บข้อมูล:** ในเซสชันนี้ proxy บล็อกการเปิดหน้าเว็บโดยตรง ทั้ง amazon.com, kdp.amazon.com และเว็บอื่นๆ (WebFetch/curl ได้ `ENOTFOUND` / `403 connect_rejected`) ข้อมูลทั้งหมดจึงมาจาก **ผลค้นหา (WebSearch snippets)** ของหน้า KDP Help, หน้าสินค้า Amazon ที่ถูก cache ไว้ และเว็บมิเรอร์ (desertcart, Self Publishing Titans, Goodreads, AbeBooks, Walmart) ไม่ได้เปิดดูหน้าจริงด้วยตัวเอง
> - คะแนน/จำนวนรีวิวที่ระบุ "(Goodreads)" **ไม่ใช่** ตัวเลขของ Amazon
> - ตัวเลขจาก desertcart/Self Publishing Titans เป็นการคัดลอกข้อมูล Amazon ต่อมาอีกทอดหนึ่ง และอาจไม่ใช่ข้อมูลล่าสุด
> - ช่องที่หาไม่เจอใส่ "-" ไม่มีการเดาตัวเลข
> - ก่อนตัดสินใจลงทุน ควรเปิด Amazon/KDP เองเพื่อเช็กซ้ำ (หรือใช้ Publisher Rocket / Helium 10)

---

## 1) สรุปสั้น

| อันดับ | Niche | โอกาสชนะสำหรับ indie หน้าใหม่ | เหตุผลหลัก |
|---|---|---|---|
| 1 (ชนะง่ายสุด) | **(b) ESL/คำศัพท์สำหรับผู้ใหญ่ เจาะผู้เรียนไทย/เอเชีย** | ปานกลาง-สูง (ใน sub-niche) | คู่แข่งที่ตรงกลุ่มคนไทยบน Amazon มีน้อยและแทบไม่มีรีวิว (Preston Lee 800 Words for Thai Speakers มี 0 rating บน Walmart) ไม่พบ Oxford Picture Dictionary ฉบับ English/Thai ในผลค้น และ SheetLab มีความรู้เรื่องปัญหาของผู้เรียนไทยอยู่แล้ว **ข้อเสีย:** ดีมานด์ของ "ฉบับคนไทย" ใน US น่าจะเล็ก ควรวางตำแหน่งเป็น "for Asian / Thai learners" แล้วใช้เล่มเดียวกันขายในไทยด้วย ส่วน ESL ทั่วไปมีเจ้าใหญ่ครองอยู่ (Cambridge, DK, Barron's) |
| 2 | **(a) แบบฝึกเด็ก K–3** | ปานกลาง (ดีมานด์สูงสุด แต่หัวตารางแน่น) | ผู้นำมีรีวิวระดับหมื่น (School Zone 4.8★/~16k, Modern Kid Press 4.7★/~15.8k) แต่ Modern Kid Press ก็พิสูจน์แล้วว่า small press ชนะได้ ทางที่ควรไปคือ sub-niche ที่แคบลง เช่น sight words ที่จำนวนคำตรงกับปก, phonics + คัดลายมือ หรือคณิตแบบ step เล็กสไตล์ Kumon แต่มีสี |
| 3 | **(d) แบบฝึกตามเทศกาล** | ต่ำ-ปานกลาง (ลงทุนทดลองได้ถูก แต่ขายได้แค่ช่วงสั้น) | Halloween math ที่เจอส่วนใหญ่เป็น indie ที่มี BSR หลักล้าน (#3.8M–#6.5M) และ 1 รีวิว 3.0★ แปลว่าแข่งไม่ยาก **แต่ขนาดตลาดก็เล็กด้วย** และวันนี้ (12 ต.ค.) ช่วงขาย Halloween 2026 เกือบปิดแล้ว ส่วน Christmas ก็สายไปสำหรับรอบ 8–12 สัปดาห์ จึงควรวางแผนไว้สำหรับปี 2027 |
| 4 (ยากสุด) | **(c) TOEIC/IELTS prep** | ต่ำ | ผู้ครองตลาดคือหนังสือทางการ/แบรนด์ใหญ่ (Cambridge IELTS 19, Official Cambridge Guide, Barron's) และ indie ที่เจอไม่มีรีวิวเลย ผู้สอบ TOEIC ราว 80% อยู่ที่ญี่ปุ่นและเกาหลี (ef.com) ดีมานด์บน Amazon US จึงเล็ก Barron's TOEIC Premium ขายแค่ #1,528 ในหมวด ควรขาย TOEIC ในไทยผ่าน sheetlabth.com แทน |

**ข้อเสนอ:** เริ่มจาก (b) 1–2 เล่ม ควบคู่กับ (a) อีก 1–2 เล่มใน sub-niche ที่ชัด ทำเป็นปกอ่อนขาวดำ 8.5×11 แล้วตั้งราคา **≥ $9.99** เพื่อให้ได้ royalty 60% เก็บ (d) ไว้ทำแพ็ก Halloween/Christmas 2027 โดยอัปโหลดภายใน ก.ค.–ส.ค. 2027

---

## 2) ข้อเท็จจริง KDP (พร้อมแหล่ง)

> เปิดหน้า kdp.amazon.com ตรงๆ ไม่ได้ ข้อมูลด้านล่างมาจากผลค้นหาที่ดึงข้อความจากหน้า KDP Help ข้อที่มีเครื่องหมาย ⚠️ คือข้อมูลที่แหล่งขัดกันหรือยังยืนยันไม่ได้

### eBook royalty
- มีสองแบบให้เลือก คือ **35%** และ **70%** ([eBook Royalties](https://kdp.amazon.com/en_US/help/topic/G200644210), [eBook List Price Requirements](https://kdp.amazon.com/en_US/help/topic/G200634560))
- แบบ 70% ต้องตั้งราคาใน price band ของ Amazon.com ซึ่งเริ่มที่ $2.99 ⚠️ ผลค้นหาสรุปว่า **ตั้งแต่ 7 ก.ค. 2026 ขยายเพดานจาก $9.99 เป็น $12.99** ข้อมูลนี้ใหม่กว่าความรู้เดิมของผู้วิจัย และยังไม่ได้เปิดหน้าเพื่อยืนยัน ควรเช็กหน้า G200634560 อีกครั้ง
- แบบ 70% จะถูกหัก**ค่าส่งไฟล์ $0.15/MB** บน Amazon.com (ขั้นต่ำ $0.01) ส่วนแบบ 35% ไม่มีค่านี้ **ข้อนี้สำคัญกับ workbook ที่มีรูปเยอะ** เพราะไฟล์ 10 MB จะเสีย $1.50 ต่อเล่ม
- งานที่เป็น public domain ได้แค่ 35% และใน BR/JP/MX/IN ต้องเข้า KDP Select ถึงจะได้ 70%
- หมายเหตุ: workbook ที่ต้องเขียนลงหน้ากระดาษขายเป็น eBook ได้ไม่ดี รายได้หลักจะมาจากปกอ่อน

### Paperback royalty และค่าพิมพ์
- สูตรคือ **royalty = อัตรา × ราคาขาย − ค่าพิมพ์** ([Paperback Royalty](https://kdp.amazon.com/en_US/help/topic/G201834330))
- **ตั้งแต่ 10 มิ.ย. 2025** บน Amazon.com ราคา **≤ $9.98 ได้ 50%** และราคา **≥ $9.99 ได้ 60%** (ช่องทาง Expanded Distribution ได้ 40%) ([G201834330](https://kdp.amazon.com/help/topic/G201834330), [Writing Forums: อีเมลประกาศจาก KDP](https://www.writingforums.com/threads/fyi-changes-to-kdp-royalty-rates-and-printing-costs.214165/))
- ค่าพิมพ์บน Amazon.com คิดเป็น fixed + ต่อหน้า ([Paperback Printing Cost](https://kdp.amazon.com/en_US/help/topic/G201834340)):
  - ขาวดำ กระดาษขาว/ครีม: $1.00 + $0.012/หน้า (regular trim) หรือ **$0.017/หน้า (large trim เช่น 8.5×11)**
  - สีมาตรฐาน: $1.00 + $0.0255/หน้า (regular) หรือ $0.0402/หน้า (large) ขั้นต่ำ 72 หน้า
  - สีพรีเมียม: $1.00 + $0.065/หน้า (regular) หรือ $0.080/หน้า (large)
  - ⚠️ เล่มบาง (ประมาณ 24–108/110 หน้า) คิดราคาเหมาขั้นต่ำ แหล่งรองให้ตัวเลขไม่ตรงกัน ($2.15 / $2.30) ควรเช็กด้วย [KDP calculator](https://kdp.amazon.com/en_US/help/topic/G201834340)
- **ตัวอย่างคำนวณ** (ผู้วิจัยคำนวณเองจากอัตราข้างบน ควรเช็กกับ calculator): workbook ขาวดำ 8.5×11 จำนวน 120 หน้า มีค่าพิมพ์ ≈ $1.00 + 120×0.017 = **$3.04**
  - ขาย $9.99 → 0.60×9.99 − 3.04 ≈ **$2.95/เล่ม**
  - ขาย $8.99 → 0.50×8.99 − 3.04 ≈ **$1.46/เล่ม** (ได้น้อยกว่าครึ่งหนึ่ง)
  - ถ้าเป็นสีพรีเมียม 120 หน้า ค่าพิมพ์ ≈ $10.60 → ขายที่ราคาตลาด $9–13 ไม่ได้ ถ้าต้องการสีให้ใช้ standard color (≈ $5.82) และตั้งราคาประมาณ $12.99 ขึ้นไป

### เนื้อหา AI
- ต้อง**แจ้ง KDP** เมื่อข้อความ รูป (รวมปกและภาพใน) หรือคำแปลถูก **AI-generated** แม้จะแก้ไขเยอะในภายหลังก็นับ ส่วนงาน **AI-assisted** (ใช้ AI ช่วยแก้ ตรวจ หรือระดมไอเดีย แต่เนื้อหาเขียนเอง) ไม่ต้องแจ้ง ([Content Guidelines](https://kdp.amazon.com/help?topicId=G200672390))
- คำแปลต้องมีคุณภาพและไม่ใช่การแปลด้วยเครื่อง ([Bonus Content](https://kdp.amazon.com/en_US/help/topic/G202018960))
- ตามแหล่งรอง ข้อมูลที่แจ้งเรื่อง AI จะไม่แสดงบนหน้าสินค้า ([ScribeCount](https://scribecount.com/author-resource/protecting-books/kdp-ai-content-policy-the-compliance-guide)) ⚠️ ยังไม่ได้ยืนยันกับ KDP

### จำกัดจำนวนเล่ม
- ตั้งแต่ปี 2023 KDP จำกัดการสร้าง**เล่มใหม่ไว้ที่ 3 เล่ม/วัน/บัญชี** และอาจปรับตัวเลขได้ ผู้ที่ชนลิมิตสามารถขอยกเว้นได้ ([Authors Guild](https://authorsguild.org/news/amazon-adds-to-kdp-generative-ai-policy-caps-daily-self-publishing-uploads/), [ALLi](https://selfpublishingadvice.org/kdp-limits-titles/)) ⚠️ แหล่งรองบางแห่งบอกว่าลิมิตนี้ใช้กับเนื้อหา AI เท่านั้น แหล่งขัดกัน

### ภาษา (ภาษาไทยรองรับหรือไม่)
- ⚠️ **ไม่พบ "Thai" ในตาราง Book Supported Languages** ([G200673300](https://kdp.amazon.com/en_US/help/topic/G200673300)) ผลค้นหาครอบคลุม A–Y แต่ยังยืนยันว่าครบทั้งตารางไม่ได้ จึงถือว่า**ภาษาไทยน่าจะไม่รองรับเป็นภาษาหลักของหนังสือ**
- การอัปโหลด PDF ทำได้เฉพาะ EN/FR/DE/IT/PT/ES/CA/GL/EU เท่านั้น ([G200673300](https://kdp.amazon.com/en_US/help/topic/G200673300))
- สำหรับ SheetLab ให้ตั้งภาษาของหนังสือเป็น **English** ถ้ามีคำแปลไทยแทรกในเล่ม ต้อง embed ฟอนต์ไทยใน PDF ⚠️ ยังไม่ได้ยืนยันว่า KDP ยอมรับเล่มสองภาษาที่ตั้งเป็น English แล้วมีภาษาไทยปนอยู่ ควรทดสอบด้วย proof copy ก่อน

### ภาษีและการรับเงิน (ผู้จัดพิมพ์ในไทย)
- KDP มีตัวเลือก **โอนเข้าบัญชีธนาคารไทยเป็นเงินบาท (EFT/direct deposit)** ซึ่ง**ไม่มีขั้นต่ำ** ส่วน wire บน Amazon.com มีขั้นต่ำ $100 ([Payment Options](https://kdp.amazon.com/en_US/help/topic/GJD7DFFX6X88AK46), [Payment Thresholds](https://kdp.amazon.com/en_US/help/topic/G201207800))
- จ่ายเงินประมาณ **60 วันหลังสิ้นเดือน**ที่มียอดขาย ([When will I get paid?](https://kdp.amazon.com/en_US/help/topic/GK2MKZUL6U3SFBPZ))
- ต้องทำ tax interview (W-8BEN สำหรับบุคคล) ถ้าไม่ทำจะถูกหัก **30%** ของ royalty ที่มาจาก US ([Vappingo](https://www.vappingo.com/word-blog/kdp-taxes-for-authors/))
- ⚠️ อนุสัญญาภาษี US–Thailand: เอกสารสรุปของ US Treasury ระบุว่า **royalty จากลิขสิทธิ์ถูกหักที่แหล่ง 5%** ([US Treasury rr1386](https://home.treasury.gov/news/press-releases/rr1386)) ยังไม่ได้ยืนยันกับตัวบทอนุสัญญาหรือหน้า KDP โปรดปรึกษานักบัญชี ถ้าเป็นนิติบุคคลต้องใช้ W-8BEN-E
- ยอดขายจาก marketplace นอก US ไม่ถูกหักภาษี US ([Vappingo](https://www.vappingo.com/word-blog/kdp-for-non-us-authors/))

---

## 3) ตารางคู่แข่งรายกลุ่ม

ตัวย่อ: Big = สำนักพิมพ์ใหญ่ · Indie = อิสระหรือ small press · BSR = Best Sellers Rank · (GR) = ตัวเลขจาก Goodreads · (M) = ตัวเลข Amazon ที่ได้จากเว็บมิเรอร์ · URL เต็มอยู่ใน CSV

### (a) แบบฝึกเด็ก K–3 (คณิต คัดลายมือ phonics sight words)

| Title | ผู้จัดพิมพ์ | ราคา USD | หน้า | Rating / รีวิว | BSR / อันดับ | จุดขาย | คำบ่น | ช่องว่างสำหรับ SheetLab |
|---|---|---|---|---|---|---|---|---|
| [School Zone Big Kindergarten Workbook](https://www.desertcart.co/products/1274556) | Big | 9.85 | 320 | 4.8 / 16,198 (M) | #2,073 Books (M) | หนา ถูก ครบทุกวิชา | - | อย่าแข่งแบบ all-in-one |
| [Kindergarten Math Workbook (Age 5-7)](https://www.amazon.com/Kindergarten-Math-Workbook-Kindergarteners-Homeschooling/dp/1948209934) | Indie (Modern Kid Press) | 6.99 | 95 | 4.7 / ~15,800 (M) | #1 Best Seller ใน Counting & Numeration | ถูก ภาพสวย หลายหัวข้อ | - | ราคาถูกมาก แข่งราคาไม่ได้ |
| [Complete Kindergarten Math Workbook](https://www.amazon.com/Complete-Kindergarten-Math-Workbook-Activities/dp/0593435494) | Big (PRH) | 12.99 | 208 | - | Best Seller badge | 4 ระดับ ผู้เขียนมี MEd | - | - |
| [Sight Words Kindergarten Workbook (Scholastic)](https://www.amazon.com/Kindergarten-Skills-Workbook-Scholastic-Learners/dp/1338305018) | Big | - | 24 | - | #5,162,611 overall | แบรนด์ | บางมาก | แบรนด์ใหญ่ก็ขายไม่ดีได้ |
| [Sight Words Top 150](https://www.amazon.com/Sight-Words-High-frequency-Kindergarten-Grade/dp/1953149294) | Indie (Panda Education) | 12.87 | 106 | - | #1 Best Seller badge; #191,153 overall | รายการคำชัด | คำอธิบายบอก 100+ คำ ไม่ตรงกับชื่อเล่ม | ทำจำนวนคำให้ตรงปก + มี checklist |
| [Spectrum Phonics Grade K](https://www.carsondellosa.com/704603--spectrum-phonics-workbook-grade-k-paperback-704603) | Big (Carson Dellosa) | 12.99 | 144 | - | - | ซีรีส์ตามเกรด | - | - |
| [Kumon My Book of Simple Addition](https://www.desertcart.uy/products/52233811) | Big | 7.95 | 80 | 4.6 / 1,133 (M) | - | ไล่ step เล็ก | ไม่มีสี ไม่มีคำอธิบาย เด็กไม่อยากทำเอง | step เล็กแบบ Kumon + สี/เกม |
| [Letters and Numbers for Me](https://www.desertcart.com.sa/products/514203062-letters-and-numbers-for-me) | Big (Learning Without Tears) | - | 94 | 4.8 / 395 (M) | #10 Early Childhood Ed. Materials (M) | ใช้ในโรงเรียน | - | - |
| [Magic grooved reusable copybooks](https://www.amazon.com/Best-Sellers-Reading-Writing-Materials/zgbs/office-products/6650988011) | Generic (ไม่ใช่หนังสือ) | - | - | 4.3 / 178 (listing หนึ่ง) | #1 Reading & Writing Materials; 1K+ bought/เดือน | ใช้ซ้ำได้ | ไส้ปากกาหมดเร็ว | ดีมานด์คัดลายมือสูงมาก |
| [The Big Fun Kindergarten Workbook](https://www.ebay.com/p/227692992) | Big (Highlights) | 12.99 (list) | 256 | - | - | หลากหลาย ได้รางวัล | สันหลุด หน้าหลุด | - |
| [Print Handwriting Workbook (Leslie Mars)](https://www.selfpublishingtitans.com/books/detail/2351) | Indie | 9.95 | - | 4.7 / 502 (M) | - | indie ที่ไปได้ดี | - | - |

### (b) ESL และคำศัพท์สำหรับผู้ใหญ่ (รวมผู้เรียนไทย/เอเชีย)

| Title | ผู้จัดพิมพ์ | ราคา USD | หน้า | Rating / รีวิว | BSR / อันดับ | จุดขาย | คำบ่น | ช่องว่าง |
|---|---|---|---|---|---|---|---|---|
| [English Grammar in Use 5th ed. with Answers](https://www.goodreads.com/book/show/51349579) | Big (Cambridge) | 12.83 (AbeBooks) | 390 | 4.31 / 1,956 (GR) | #9 ESL Instruction (ไม่ทราบวันที่) | มาตรฐานโลก มีเฉลย | ภาษาไวยากรณ์ยาก (รีวิวเล่ม Advanced) | อธิบายง่าย + ไทย |
| [Word Power Made Easy](https://www.goodreads.com/work/editions/9886-word-power-made-easy-the-complete-handbook-for-building-a-superior-voca) | Big (Anchor/PRH) | - | 528 | 4.42 / 9,195 (GR) | #12 ESL Instruction | รากศัพท์ คลาสสิก | ยาว ยาก | รากศัพท์ระดับเริ่มต้น เล่มบาง |
| [The Vocabulary Builder Workbook (Chris Lele)](https://www.desertcart.co.za/products/186632347-vocabulary-builder-workbk) | Big (Callisto) | 6.69 (Kindle 5.24) | 254 | 4.5 / 6,437 (M) | - | ถูก หน้าเรียบง่าย | กิจกรรมสั้นไป | แบบฝึกยาวขึ้น + ทบทวน |
| [English for Everyone Course Book L1](https://thirdplacebooks.com/book/9780744098563) | Big (DK) | 17.99 | 184–200 | - | อยู่ใน ESL best sellers | ภาพเยอะ | - | - |
| [Practice Makes Perfect: English Vocabulary for Beginning ESL Learners](https://www.ebay.ch/p/Practice-Makes-Perfect-English-Vocabulary-for-Beginning-ESL-Learners-Premium-Fourth-Edition-by-Jean/19050097275) | Big (McGraw Hill) | 16.68 (eBay) | 256 | - | - | 200+ แบบฝึก มี audio | - | - |
| [1100 Words You Need to Know](https://www.abebooks.com/9781438010427/1100-Words-Need-Know-Murray-1438010427/plp) | Big (Barron's) | 21.99 (6th ed., ร้านต่างประเทศ) | 360–432 | 4.12 / 495 (GR) | - | แผนรายวัน | - | - |
| [Oxford Picture Dictionary 3rd ed.](https://www.abebooks.com/Oxford-Picture-Dictionary-Third-Edition-Monolingual/31858388482/bd) | Big (OUP) | 36.29 (Eng/Arabic) | 292 | 4.50 / 20 (GR) | - | 4,000 คำ ภาพ หลายคู่ภาษา | ราคาสูง | **ไม่พบฉบับ Eng/Thai** |
| [Preston Lee's Beginner English 800 Words for Thai Speakers](https://www.walmart.com/ip/164020719) | Indie | 10.63 | - | 0 รีวิว (Walmart) | - | ตรงกลุ่มคนไทย | ไม่มีรีวิวเลย | ทำให้เจาะกว่า |
| [Teacher King's English Beginner Course: Thai Edition](https://www.overdrive.com/media/5838929/teacher-kings-english-beginner-course-book-2-thai-editio) | Indie | - | - | - | - | 30 บท ~300 คำ | - | - |
| [English Made Easy Volume One](https://www.amazon.com/Best-Sellers-English-as-a-Second-Language-Instruction/zgbs/books/11823) | Big (Tuttle) | - | - | - | อยู่ใน ESL best sellers | ภาพ | - | - |

### (c) TOEIC / IELTS prep

| Title | ผู้จัดพิมพ์ | ราคา | หน้า | Rating / รีวิว | BSR / อันดับ | หมายเหตุ |
|---|---|---|---|---|---|---|
| [Barron's TOEIC Premium 10th ed.](https://www.amazon.com/TOEIC-online-audio-Barrons-Test/dp/1506273424) | Big | $27.87 | - | 4.0 / 61 | #1,528 ใน TOEFL & TOEIC Tests | ขายช้า |
| [Barron's TOEIC 9th ed. (online audio)](https://www.amazon.com/TOEIC-online-audio-Barrons-Test/dp/1506273424) | Big | - | - | - | #66 ใน TOEFL & TOEIC Tests | ดีที่สุดในผลค้น |
| [Barron's TOEIC with MP3 CD 6th ed.](https://www.amazon.com/Barrons-TOEIC-MP3-CD-6th/dp/1438073321) | Big | - | - | 4.3 / 96 | - | ใช้ CD ซึ่งล้าสมัย |
| [TOEIC Essential Words / 600 Essential Words (Lougheed)](https://www.amazon.com/TOEIC-Essential-Words-online-Barrons/dp/1506273440) | Big | - | 408 (5th ed.) | 4.09 / 53 (GR) | - | คำศัพท์ธุรกิจ + audio |
| [公式TOEIC L&R 問題集 11 (ETS/IIBC)](https://iibc-global.org/english/publication.html?hsLang=ja) | Official (JP) | ¥3,300 | - | - | - | ตลาดหลักอยู่ญี่ปุ่น |
| [Barron's IELTS Superpack 5th ed.](https://www.amazon.com/IELTS-Superpack-Barrons-Test-Prep/dp/1506268706) | Big | $39–69.99 | 1,368 | 4.12 / 17 (GR) | #1,695,578 Books; #340 TOEFL & TOEIC | แพงและขายช้า |
| [Cambridge IELTS 19 Academic](https://99learners.in/best-ielts-books-2026-comparison/) | Official | ~$35 | - | 4.7 (ไม่ระบุแหล่ง) | - | ข้อสอบจริง |
| [The Official Cambridge Guide to IELTS](https://applystart.com/blogs/best-ielts-books) | Official | $33.00 | - | 4.6 (ไม่ระบุแหล่ง) | - | - |
| [Cambridge Vocabulary for IELTS](https://www.desertcart.co.th/products/52636699) | Official | - | - | 4.3 / 411 (M) | - | - |
| [IELTS Vocabulary 3200 words with answer key](https://www.betterread.com.au/book/ielts-vocabulary-3200-words-with-answer-key.do) | Indie (self-pub, คาดว่าเป็น KDP) | AUD 58.05 | 394 | ไม่มีรีวิว | - | indie ในหมวดนี้แทบไม่มีแรงขาย |

### (d) แบบฝึกตามเทศกาล (Halloween/Christmas math)

| Title | ผู้จัดพิมพ์ | ราคา USD | หน้า | Rating / รีวิว | BSR | หมายเหตุ |
|---|---|---|---|---|---|---|
| [Halloween Kindergarten Math Workbook](https://www.amazon.com/Halloween-Kindergarten-Math-Workbook-Activity/dp/1728906008) | Indie (Rocket Publishing) | - | 55 | - | ~#6.5M | ขายน้อยมาก |
| [Halloween Math Activity Book Kids Grade K-1](https://www.amazon.com/Halloween-Math-Activity-Book-Grade/dp/B0BBPZY7TW) | Indie (Bebe Works) | - | 75 (สี) | - | ~#3.8M | มีเฉลย |
| [Halloween Math Book – Spooky Addition](https://www.amazon.com/Halloween-Math-Book-Kindergarten-Mathematics/dp/B0BCSFF67W) | Indie (Forty Two Publishing) | 8.99 | 147 | 3.0 / 1 | - | - |
| [Halloween Math Activity Book for Grade 1](https://www.amazon.com/Halloween-Math-Activity-Book-Grade/dp/B0CCCMZYB7) | Indie (Lily Sally) | - | - | 3.0 / 1 | - | - |
| [Spooky Halloween Math Adventures](https://www.amazon.com/Spooky-Halloween-Math-Adventures-Kindergarteners/dp/B0DHQK8RLD) | Indie | - | 110 | - | - | - |
| [Christmas Activity Book For Kids Ages 8-10](https://www.amazon.com/Christmas-Activity-Book-Kids-Ages/dp/1956397906) | Indie (KC Press) | - | 70+ | 4.7 / 29 | #6,650,214 Books | ขายน้อยเมื่อพ้นฤดู |
| [The Christmas Activity Book for Kids – Ages 4-6](https://www.amazon.com/Christmas-Activity-Book-Kids-Activities/dp/1951025342) | Indie (Peanut Prodigy) | - | - | - | - | - |
| [Christmas Activity Book for Kids Ages 6-8](https://www.amazon.com/Christmas-Activity-Book-Kids-Ages/dp/1990864538) | Indie (Young Dreamers) | - | - | - | - | - |
| [Christmas Activity Book for Kids Ages 4 to 8](https://www.barnesandnoble.com/w/christmas-activity-book-for-kids-ages-4-to-8-a-fun-and-creative-workbook-for-the-holidays-funkey-books/1138241928) | Indie (Funkey Books) | 14.99 (B&N) | - | - | - | - |

ข้อสังเกต: เล่ม Christmas ที่เจอเกือบทั้งหมดเป็นหนังสือกิจกรรมทั่วไป (เขาวงกต ระบายสี) ใน**ผลค้นหาไม่พบเล่ม Christmas ที่เน้นคณิตจริงจังและมีแรงขาย** ราคาส่วนใหญ่อยู่ราว $6–10 ([ผลค้น](https://www.amazon.com/Christmas-Activity-Book-Kids-Ages/dp/1990864538)) แหล่งรองบอกว่ายอดขายราว 70–80% เกิดในช่วง 6 สัปดาห์ และควรอัปโหลดล่วงหน้า 8–12 สัปดาห์ ([kdpbuilder](https://kdpbuilder.com/blog/seasonal-kdp-niches)) ตัวเลขนี้ไม่ได้อ้างข้อมูลดิบ

---

## 4) คำบ่นลูกค้าที่เจอบ่อย

(จากรีวิวที่ค้นเจอ ซึ่งมีจำนวนน้อยเพราะเปิดหน้ารีวิว Amazon ไม่ได้)

1. **กระดาษบาง หมึก/ดินสอทะลุ หรือติดไปอีกหน้า** เป็นคำบ่นที่เจอใน workbook เด็ก ([desertcart review](https://www.desertcart.co.th/products/20383596)) และ KDP มีแค่กระดาษขาว/ครีม จึงควรออกแบบให้ใช้ดินสอหรือสีไม้ และไม่ให้ระบายสีเต็มหน้าทั้งสองด้าน
2. **สันกาวหลุด หน้าหลุด** พบใน Highlights Big Fun ([ShopSavvy](https://shopsavvy.com/reviews-tldr/%22the-big-fun-kindergarten-workbook%22.md)) และ workbook homeschool ([HipHomeschoolMoms](https://hiphomeschoolmoms.com/handwriting-without-tears/discussions/1749/)) เล่มหนา 300 หน้าขึ้นไปมีความเสี่ยงสูงกว่า
3. **ไม่มีสี ไม่มีคำอธิบาย เด็กไม่อยากทำเอง** พบใน Kumon ([desertcart](https://www.desertcart.co.za/products/1187914-kumon-my-book-of-simple-addition.md))
4. **ระดับไม่ตรงกับที่โฆษณา** เช่นยากเกินไปสำหรับผู้เริ่มจริงใน ESL beginner series ([desertcart](https://www.desertcart.co/products/8002095)) หรือง่ายเกินไปใน Kumon tracing ([ThriftBooks](https://www.thriftbooks.com/w/my-first-book-of-tracing/275032/item/))
5. **ไม่มีเฉลยหรือเฉลยน้อย** สำคัญมากสำหรับคนที่เรียนเอง (รีวิวหนังสือ grammar ใน [allbookstores](https://www.allbookstores.com/Advanced-Grammar-Use-With-Answers/9783125341340))
6. **คำอธิบายใช้ศัพท์ไวยากรณ์ยาก** ครู ESL ต้องแปลเองหรือข้ามไป ([allbookstores](https://www.allbookstores.com/Advanced-Grammar-Use-With-Answers/9783125341340))
7. **กิจกรรมสั้นเกินไปหรือฝึกไม่พอ** พบใน Vocabulary Builder Workbook ([Goodreads](https://www.goodreads.com/book/show/38889176))
8. **ชื่อหรือปกไม่ตรงกับเนื้อหา** เช่น "Top 150" แต่คำอธิบายบอก 100+ คำ ([Alibris](https://origin-www.alibris.com/Sight-Words-Top-150-Must-Know-High-frequency-Kindergarten-1st-Grade-Fun-Reading-Writing-Activity-Workbook-Spelling-Focus-Words-Word-Problems-Scholastic-Panda-Education/book/47895096?qsort=p&svs=1))
9. **สื่อเสริมล้าสมัย** เช่น CD/CD-ROM ใช้ไม่ได้ ([allbookstores](https://www.allbookstores.com/Advanced-Grammar-Use-With-Answers/9783125341340))

---

## 5) โอกาสสำหรับ SheetLab

1. **"English Vocabulary for Thai/Asian Learners" (b)**: คำศัพท์ตามหัวข้อชีวิตจริง (งาน เดินทาง ทำงานบริษัทต่างชาติ) พร้อมคำแปลไทย IPA และคำอ่านแบบไทย เน้นเสียงที่คนไทยพลาด (th, r/l, ตัวสะกดท้าย -s/-ed) มี**เฉลยครบ** และ audio ผ่าน QR ที่ลิงก์ไปยัง sheetlabth.com คู่แข่งตรงกลุ่ม (Preston Lee, Teacher King) แทบไม่มีรีวิว ⚠️ ต้องทดสอบก่อนว่า KDP รับเล่มที่ตั้งเป็น English แต่มีภาษาไทยในเล่ม
2. **Picture vocabulary English–Thai (b)**: ในผลค้นไม่พบ Oxford Picture Dictionary ฉบับ Eng/Thai และ Oxford ราคา $36 SheetLab ทำเล่ม 120 หน้าขาวดำราคา $12.99 ได้
3. **Sub-niche เด็ก (a)**: (i) sight words ที่จำนวนคำตรงปก มี checklist และ assessment (ii) คณิต K–1 แบบ step เล็กสไตล์ Kumon แต่มีภาพหรือเกมและคำอธิบายสำหรับพ่อแม่ ซึ่งตอบคำบ่นข้อ 3 ทำเป็นเล่มบาง 80–120 หน้า เพื่อลดปัญหาสันหลุด
4. **ราคาและรูปแบบ**: ปกอ่อนขาวดำ 8.5×11 ตั้งราคา **$9.99 ขึ้นไป** (royalty 60%) ไม่แข่งราคากับ Modern Kid Press ($6.99) แต่ชูจุดต่างเรื่องเฉลย คำอธิบาย และระดับที่ชัด
5. **Seasonal (d) สำหรับปี 2027**: ใช้ layout ของเล่มคณิตเด็กข้อ 3 แล้วเปลี่ยนธีม (Halloween/Christmas math K–2 พร้อมเฉลย) อัปโหลดภายใน ก.ค.–ส.ค. 2027 คู่แข่งอ่อน (BSR หลักล้าน 1 รีวิว) แต่ตลาดก็เล็ก จึงควรถือเป็นรายได้เสริม
6. **TOEIC (c)**: ไม่แนะนำให้ทำสำหรับ Amazon US ควรขายในไทยหรือเอเชียผ่านช่องทางของ SheetLab เอง
7. **ใช้ AI อย่างระวัง**: ถ้าใช้ AI สร้างรูปหรือข้อความต้องแจ้ง KDP ทุกครั้ง และ KDP จำกัด 3 เล่ม/วัน จึงควรเน้นคุณภาพมากกว่าจำนวน

---

## 6) แหล่งอ้างอิง

**KDP (ทางการ, อ้างผ่านผลค้นหา):**
- eBook Royalties: https://kdp.amazon.com/en_US/help/topic/G200644210
- eBook List Price Requirements: https://kdp.amazon.com/en_US/help/topic/G200634560
- Paperback Royalty: https://kdp.amazon.com/en_US/help/topic/G201834330
- Paperback Printing Cost: https://kdp.amazon.com/en_US/help/topic/G201834340
- Content Guidelines (AI): https://kdp.amazon.com/help?topicId=G200672390
- Bonus Content (คำแปล): https://kdp.amazon.com/en_US/help/topic/G202018960
- Book Supported Languages: https://kdp.amazon.com/en_US/help/topic/G200673300
- Payment Options: https://kdp.amazon.com/en_US/help/topic/GJD7DFFX6X88AK46
- Payment Thresholds: https://kdp.amazon.com/en_US/help/topic/G201207800
- When will I get paid?: https://kdp.amazon.com/en_US/help/topic/GK2MKZUL6U3SFBPZ

**นโยบายและภาษี (แหล่งรอง):**
- Authors Guild (3 เล่ม/วัน): https://authorsguild.org/news/amazon-adds-to-kdp-generative-ai-policy-caps-daily-self-publishing-uploads/
- ALLi: https://selfpublishingadvice.org/kdp-limits-titles/
- ScribeCount AI policy: https://scribecount.com/author-resource/protecting-books/kdp-ai-content-policy-the-compliance-guide
- Writing Forums (ประกาศ royalty 2025): https://www.writingforums.com/threads/fyi-changes-to-kdp-royalty-rates-and-printing-costs.214165/
- Vappingo ภาษี/ต่างชาติ: https://www.vappingo.com/word-blog/kdp-taxes-for-authors/ , https://www.vappingo.com/word-blog/kdp-for-non-us-authors/
- US Treasury (อนุสัญญา US–Thailand): https://home.treasury.gov/news/press-releases/rr1386
- ส่วนแบ่งผู้สอบ TOEIC: https://www.ef.com/ca/english-tests/toeic/ets/
- Seasonal timing: https://kdpbuilder.com/blog/seasonal-kdp-niches , https://www.kdpeasy.com/blog/seasonal-activity-books-kdp

**ข้อมูลสินค้าและรีวิว:** ดู URL ในตารางข้อ 3 และใน `us-amazon-kdp.csv` (Amazon cached listings, desertcart, Self Publishing Titans, Goodreads, AbeBooks, Walmart, Barnes & Noble, Carson Dellosa, IIBC)
