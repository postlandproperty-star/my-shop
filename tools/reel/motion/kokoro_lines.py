# 🔊 Kokoro (ฟรี รันในเครื่อง · Apache-2.0 ใช้ขายได้) ทำเสียงอังกฤษทีละบรรทัดให้ voice.py · รันด้วย python ของ venv Kokoro
#   ~/Documents/Academic/_kit/kokoro/venv/bin/python kokoro_lines.py jobs.json   (jobs = [{"out": ".../e1.raw.wav", "voice": "bm_george", "text": "...", "speed": 1}])
import sys, json
import numpy as np, soundfile as sf
from kokoro import KPipeline
P = {}
for j in json.load(open(sys.argv[1])):
    lang = j['voice'][0]; p = P.get(lang) or P.setdefault(lang, KPipeline(lang_code=lang))
    a = [np.asarray(x, dtype=np.float32) for _, _, x in p(j['text'], voice=j['voice'], speed=float(j.get('speed', 1)))]
    sf.write(j['out'], np.concatenate(a), 24000); print('ok', j['out'])
