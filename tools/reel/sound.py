"""เพลงประกอบและเสียงเอฟเฟกต์ของคลิป Reels: แต่ง/สังเคราะห์เองด้วยโค้ดทั้งหมด (Python ล้วน ไม่ต้องติดตั้งอะไรเพิ่ม)
ไม่มีลิขสิทธิ์ของคนอื่น ไม่ต้องให้เครดิต ไม่ต้องโหลดจากเน็ต

make_music(path, mood, seed)  -> wav วน 8 ห้อง  mood: auto | upbeat | chill | ukulele | lofi | funky | game | quirky | tropical
make_sfx(name, path, length)  -> wav  name: whoosh | pop | tick | ding | chime | tada | boing
"""
import math, random, wave, array

SR = 22050
MOODS = ['upbeat', 'chill', 'ukulele', 'lofi', 'funky', 'game', 'quirky', 'tropical']
TH_MOOD = {'upbeat': 'ป๊อปสนุก', 'chill': 'ชิลนุ่ม', 'ukulele': 'อูคูเลเล่สดใส', 'lofi': 'โลไฟ', 'funky': 'ฟังกี้', 'game': 'เกม 8 บิต', 'quirky': 'ตลกขี้เล่น', 'tropical': 'ทรอปิคอล'}


def _write(path, buf, sr=SR, peak_to=0.9):
    peak = max(1e-6, max(abs(v) for v in buf)); g = peak_to / peak
    pcm = array.array('h', (int(max(-1.0, min(1.0, v * g)) * 32767) for v in buf))
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
    return path


class _Mix:
    def __init__(self, seconds, rnd):
        self.n = int(SR * seconds) + SR; self.buf = array.array('f', bytes(4 * self.n)); self.rnd = rnd

    def add(self, t0, dur, fn, amp):
        i0 = int(t0 * SR); n = min(int(dur * SR), self.n - i0); b = self.buf
        for i in range(max(0, n)):
            b[i0 + i] += amp * fn(i / SR)

    def add_samples(self, t0, samples, amp):
        i0 = int(t0 * SR); b = self.buf
        for i, v in enumerate(samples):
            if i0 + i >= self.n: break
            b[i0 + i] += amp * v


# ---------- เครื่องดนตรี (คืนฟังก์ชันของเวลา t วินาที) ----------
def _env(t, a, d):
    return min(1.0, t * a) * math.exp(-d * t)

def keys(f, d=2.4):
    return lambda t: (math.sin(6.2832 * f * t) + 0.3 * math.sin(12.566 * f * t)) * _env(t, 200, d)

def soft_keys(f):  # โลไฟ: นุ่ม อุ่น ฮาร์มอนิกน้อย
    return lambda t: (math.sin(6.2832 * f * t) + 0.12 * math.sin(12.566 * f * t)) * _env(t, 60, 1.6) * (1 + 0.004 * math.sin(6.2832 * 4 * t))

def bass(f, d=3.0):
    return lambda t: (math.sin(6.2832 * f * t) + 0.25 * math.sin(12.566 * f * t)) * _env(t, 300, d)

def slap(f):
    return lambda t: (math.sin(6.2832 * f * t) + 0.5 * math.sin(12.566 * f * t) * math.exp(-20 * t) + 0.2 * math.sin(18.85 * f * t) * math.exp(-30 * t)) * _env(t, 500, 5)

def square(f, duty=0.5, d=3.0):
    return lambda t: (1.0 if (f * t) % 1 < duty else -1.0) * _env(t, 800, d) * 0.5

def triangle(f, d=2.0):
    return lambda t: (2 * abs(2 * ((f * t) % 1) - 1) - 1) * _env(t, 400, d)

def marimba(f):
    return lambda t: (math.sin(6.2832 * f * t) + 0.35 * math.sin(6.2832 * 4 * f * t) * math.exp(-12 * t)) * _env(t, 600, 6)

def bell(f):
    return lambda t: (math.sin(6.2832 * f * t) + 0.2 * math.sin(18.85 * f * t)) * _env(t, 400, 4.5)

def reed(f):  # เสียงแบบบาสซูนตลกๆ: สี่เหลี่ยมนุ่ม สั้น
    return lambda t: (math.sin(6.2832 * f * t) + 0.45 * math.sin(18.85 * f * t) + 0.25 * math.sin(31.4 * f * t)) * _env(t, 150, 7)

def pluck(f, dur, rnd, damp=0.996, bright=1.0):
    """Karplus-Strong: เสียงดีดสาย (อูคูเลเล่ / พิซซิคาโต)"""
    n = max(2, int(SR / f)); line = [rnd.uniform(-1, 1) * bright for _ in range(n)]
    out = []; i = 0
    for _ in range(int(dur * SR)):
        a = line[i % n]; b = line[(i + 1) % n]; v = damp * 0.5 * (a + b); line[i % n] = v; out.append(a); i += 1
    return out

def kick(t):
    return math.sin(6.2832 * (45 * t + 2.2 * (1 - math.exp(-28 * t)))) * math.exp(-9 * t)

def chip_kick(t):
    f = 150 * math.exp(-18 * t) + 40
    return (1.0 if (f * t) % 1 < 0.5 else -1.0) * math.exp(-14 * t) * 0.6

def noise(rnd, decay, hp=True):
    last = [0.0]
    def f(t):
        x = rnd.uniform(-1, 1)
        if hp: y = x - last[0]; last[0] = x
        else: y = x
        return y * math.exp(-decay * t)
    return f

def clap(rnd):
    n = noise(rnd, 1.0)
    return lambda t: n(t) * (math.exp(-60 * t) + 0.6 * math.exp(-60 * max(0, t - 0.012)) * (t > 0.012) + 0.8 * math.exp(-22 * max(0, t - 0.024)) * (t > 0.024))


# ---------- เพลง ----------
def make_music(path, mood='auto', seed=0):
    rnd = random.Random(seed)
    if mood not in MOODS: mood = MOODS[seed % len(MOODS)]  # auto: หมุนแนวตามเนื้อหาคลิป
    tempo = {'upbeat': (100, 108), 'chill': (80, 88), 'ukulele': (104, 112), 'lofi': (72, 80), 'funky': (98, 106),
             'game': (120, 132), 'quirky': (96, 104), 'tropical': (96, 104)}[mood]
    bpm = rnd.randint(*tempo); beat = 60.0 / bpm; bars = 8
    mx = _Mix(beat * 4 * bars, rnd)
    root = rnd.choice([261.63, 293.66, 329.63, 349.23, 392.00])
    hz = lambda semi, octv=0: root * (2 ** (semi / 12.0 + octv))
    minor = mood in ('lofi', 'chill')
    prog = rnd.choice([[(9, 'm'), (5, ''), (0, ''), (7, '')], [(2, 'm'), (7, ''), (0, ''), (9, 'm')]]) if minor else \
        rnd.choice([[(0, ''), (7, ''), (9, 'm'), (5, '')], [(0, ''), (5, ''), (9, 'm'), (7, '')], [(0, ''), (9, 'm'), (5, ''), (7, '')]])
    penta = [0, 2, 4, 7, 9]
    swing = beat * 0.17 if mood == 'lofi' else 0.0
    e8 = lambda e: e * beat / 2 + (swing if e % 2 else 0)  # ตำแหน่งโน้ตเขบ็ต 1 ชั้นที่ e (มีสวิงเฉพาะโลไฟ)

    def melody(t, inst, octv=1, amp=0.09, steps=(0.5, 1, 1, 1.5)):
        pos = 0.0
        while pos < 4:
            if rnd.random() < 0.8: mx.add(t + pos * beat, 1.0, inst(hz(rnd.choice(penta) + 12 * octv)), amp)
            pos += rnd.choice(steps)

    for b in range(bars):
        t = b * 4 * beat; semi, q = prog[b % 4]; tri = [0, 3, 7] if q == 'm' else [0, 4, 7]
        late = b >= 4  # ครึ่งหลังเพิ่มทำนอง
        if mood == 'upbeat':
            for hit in (0, 2.5):
                for x in tri: mx.add(t + hit * beat, 1.6, keys(hz(semi + x)), 0.10)
            for hit in (0, 2, 3.5): mx.add(t + hit * beat, 0.9, bass(hz(semi, -2)), 0.32)
            for hit in (0, 1.5, 2): mx.add(t + hit * beat, 0.45, kick, 0.55)
            for hit in (1, 3): mx.add(t + hit * beat, 0.25, clap(rnd), 0.12)
            for e in range(8): mx.add(t + e8(e), 0.08, noise(rnd, 70), 0.05)
            if late: melody(t, bell)
        elif mood == 'chill':
            for x in tri: mx.add(t, 3.0, keys(hz(semi + x), 1.2), 0.11)
            for hit in (0, 2): mx.add(t + hit * beat, 1.2, bass(hz(semi, -2), 2.0), 0.3)
            for hit in (0, 2): mx.add(t + hit * beat, 0.45, kick, 0.35)
            for e in (1, 3, 5, 7): mx.add(t + e8(e), 0.08, noise(rnd, 70), 0.04)
            if late: melody(t, bell, amp=0.07, steps=(1, 1.5, 2))
        elif mood == 'ukulele':
            strum = [0, 1, 1.5, 2.5, 3, 3.5]  # จังหวะตีคอร์ดแบบ ลง ลง-ขึ้น ขึ้น-ลง-ขึ้น
            for hit in strum:
                for j, x in enumerate(tri + [12]):
                    mx.add_samples(t + hit * beat + j * 0.012, pluck(hz(semi + x), 0.7, rnd, 0.994), 0.11)
            for hit in (0, 2): mx.add(t + hit * beat, 0.8, bass(hz(semi, -2)), 0.25)
            for e in range(8): mx.add(t + e8(e), 0.12, noise(rnd, 35), 0.035)  # เชคเกอร์
            for hit in (1, 3): mx.add(t + hit * beat, 0.2, clap(rnd), 0.08)
            if late: melody(t, bell, amp=0.07)
        elif mood == 'lofi':
            for x in tri + [10 if q == 'm' else 11]: mx.add(t, 3.4, soft_keys(hz(semi + x)), 0.09)  # คอร์ด 7
            for hit in (0, 2.5): mx.add(t + hit * beat, 1.2, bass(hz(semi, -2), 2.2), 0.3)
            for hit in (0, 2.5): mx.add(t + hit * beat, 0.45, kick, 0.45)
            for hit in (1, 3): mx.add(t + hit * beat, 0.3, noise(rnd, 14), 0.07)
            for e in range(8): mx.add(t + e8(e), 0.07, noise(rnd, 80), 0.035)
            for _ in range(30): mx.add(t + rnd.uniform(0, 4 * beat), 0.004, noise(rnd, 900), 0.12)  # เสียงแผ่นเสียงแตก
            if late: melody(t, soft_keys, amp=0.06, steps=(1, 1.5, 2))
        elif mood == 'funky':
            for hit in (0, 0.75, 1.5, 2.5, 3.25):
                mx.add(t + hit * beat, 0.35, slap(hz(semi + rnd.choice([0, 0, 12, 7]), -2)), 0.3)
            for hit in (0.5, 1.5, 2.5, 3.5):
                for x in tri: mx.add(t + hit * beat, 0.18, keys(hz(semi + x), 12), 0.09)  # คอร์ดกระแทกสั้นๆ
            for hit in (0, 2, 2.75): mx.add(t + hit * beat, 0.45, kick, 0.5)
            for hit in (1, 3): mx.add(t + hit * beat, 0.25, clap(rnd), 0.14)
            for s in range(16): mx.add(t + s * beat / 4, 0.05, noise(rnd, 90), 0.03 + 0.02 * (s % 2 == 0))
            if late: melody(t, square, amp=0.05, steps=(0.5, 0.5, 1))
        elif mood == 'game':
            arp = tri + [12]
            for s in range(16): mx.add(t + s * beat / 4, beat / 4, square(hz(semi + arp[s % 4], 1), 0.25, 6), 0.09)
            for hit in (0, 1, 2, 3): mx.add(t + hit * beat, beat * 0.9, triangle(hz(semi, -1), 3), 0.28)
            for hit in (0, 2): mx.add(t + hit * beat, 0.3, chip_kick, 0.5)
            for hit in (1, 3): mx.add(t + hit * beat, 0.15, noise(rnd, 30, False), 0.12)
            if late: melody(t, lambda f: square(f, 0.5, 2.5), octv=1, amp=0.07, steps=(0.5, 0.5, 1))
        elif mood == 'quirky':
            for hit in (0, 1, 2, 3):  # เบสเดินแบบการ์ตูน
                step = [0, 7, 12, 7][hit]
                mx.add(t + hit * beat, 0.3, reed(hz(semi + step, -1)), 0.22)
            for hit in (0.5, 1.5, 2.5, 3.5):
                for x in tri: mx.add_samples(t + hit * beat, pluck(hz(semi + x, 1), 0.25, rnd, 0.97), 0.09)  # พิซซิคาโต
            for hit in (0, 2): mx.add(t + hit * beat, 0.35, kick, 0.35)
            for hit in (1, 3): mx.add(t + hit * beat, 0.1, noise(rnd, 60), 0.08)
            if late: melody(t, marimba, amp=0.1, steps=(0.5, 0.5, 1, 1.5))
        else:  # tropical
            for hit in (0, 0.75, 1.5, 2, 2.75, 3.5):
                for x in tri: mx.add(t + hit * beat, 0.5, marimba(hz(semi + x, 1)), 0.07)
            for hit in (0, 1.5, 2, 3.5): mx.add(t + hit * beat, 0.6, bass(hz(semi, -2), 4), 0.3)
            for hit in (0, 1, 2, 3): mx.add(t + hit * beat, 0.4, kick, 0.45)
            for hit in (0.75, 1.5, 2.75, 3.5): mx.add(t + hit * beat, 0.1, noise(rnd, 50), 0.07)  # ริมช็อตแบบเดมโบว์
            for e in range(8): mx.add(t + e8(e), 0.15, noise(rnd, 30), 0.03)
            if late: melody(t, bell, amp=0.07)
    _write(path, mx.buf)
    return mood


# ---------- เสียงเอฟเฟกต์ ----------
def make_sfx(name, path, length=1.5, seed=1):
    rnd = random.Random(seed)
    if name == 'tick':  # ติ๊ก-ต็อก นาฬิกา ช่วงให้คนดูคิด
        mx = _Mix(length, rnd); k = 0; t = 0.0
        while t < length:
            f = 2400 if k % 2 == 0 else 1800
            mx.add(t, 0.05, lambda x, f=f: math.sin(6.2832 * f * x) * math.exp(-90 * x), 0.5); k += 1; t += 0.5
        return _write(path, mx.buf[:int(SR * length)], peak_to=0.5)
    mx = _Mix(1.2, rnd)
    if name == 'whoosh':
        n = noise(rnd, 0.0, False); lp = [0.0]
        def f(t):
            a = 0.08 + 0.5 * min(1, t / 0.25); lp[0] += a * (n(t) - lp[0])  # กรองเปิดกว้างขึ้นเรื่อยๆ = เสียงวูช
            return lp[0] * math.sin(math.pi * min(1, t / 0.45))
        mx.add(0, 0.45, f, 1.0)
    elif name == 'pop':
        mx.add(0, 0.14, lambda t: math.sin(6.2832 * (300 * t + 600 * (1 - math.exp(-25 * t)) / 25)) * math.exp(-30 * t), 1.0)  # ป๊อป: เสียงสูงตกลงเร็ว
    elif name == 'ding':
        for f in (1318.5, 1975.5): mx.add(0, 0.9, lambda t, f=f: math.sin(6.2832 * f * t) * math.exp(-5 * t), 0.5)
    elif name == 'chime':  # ถูกต้อง! สองโน้ตขึ้น
        for i, f in enumerate((1046.5, 1568.0)): mx.add(i * 0.09, 0.7, lambda t, f=f: (math.sin(6.2832 * f * t) + 0.3 * math.sin(12.566 * f * t)) * math.exp(-6 * t), 0.5)
    elif name == 'tada':  # อาร์เปจจิโอขึ้น + ประกาย
        for i, f in enumerate((523.25, 659.25, 783.99, 1046.5)): mx.add(i * 0.08, 0.9, lambda t, f=f: (math.sin(6.2832 * f * t) + 0.25 * math.sin(18.85 * f * t)) * math.exp(-3.5 * t), 0.35)
        for _ in range(10):
            f = rnd.uniform(2500, 4500); mx.add(0.3 + rnd.uniform(0, 0.5), 0.15, lambda t, f=f: math.sin(6.2832 * f * t) * math.exp(-30 * t), 0.12)
    elif name == 'boing':
        mx.add(0, 0.5, lambda t: math.sin(6.2832 * (180 * t + 60 * math.sin(6.2832 * 9 * t) / 9)) * math.exp(-6 * t), 0.8)
    return _write(path, mx.buf[:int(SR * 1.1)], peak_to=0.7)
