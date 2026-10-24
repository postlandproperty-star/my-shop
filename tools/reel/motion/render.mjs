// 🎬 อัดคลิปแอนิเมชันจากหน้าเว็บทีละเฟรม (คุณแดน 22 ต.ค. 69 อยากได้คลิปการ์ตูนแบน + ตัวหนังสือไทยใหญ่ แบบโค้ดวาดภาพ ไม่ใช้รูป AI)
//   node tools/reel/motion/render.mjs tools/reel/motion/<ฉาก>.html out.mp4 [--mood upbeat]
// หน้าเว็บต้องมี window.DURATION, window.seek(t), window.SFX = [[วินาที, 'pop'|'ding'|'boing'|'tada'|'whoosh'|'chime'|'tick' หรือไฟล์เสียง 'ep1/q.wav' (ทางจากหน้าเว็บ)]]
// วิดีโอ 1080×1920 30fps · เพลงและเสียงประกอบสร้างเอง (tools/reel/sound.py) ไม่มีลิขสิทธิ์ · ไม่มีเสียงพากย์ไทย AI
import fs from 'node:fs'; import path from 'node:path'; import { spawn, spawnSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
const FF = path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg');
const CHROME = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const [src, out] = process.argv.slice(2).filter((a) => !a.startsWith('--')); const mood = (process.argv.join(' ').match(/--mood (\w+)/) || [])[1] || 'upbeat';
if (!src || !out) { console.log('ใช้: node render.mjs <ฉาก.html> <out.mp4> [--mood upbeat]'); process.exit(1); }
const FPS = 30, work = path.join(HERE, '.work', path.basename(src, '.html')); fs.mkdirSync(work, { recursive: true });

const b = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve(src)).href); await page.evaluate(() => document.fonts.ready);
// ขนาดอื่นนอกจาก 9:16 (เช่นวิดีโอสินค้า Shopee 1:1): หน้าเว็บกำหนด window.SIZE = [กว้าง, สูง]
const size = await page.evaluate(() => window.SIZE || null); if (size) await page.setViewportSize({ width: size[0], height: size[1] });
const { dur, sfx } = await page.evaluate(() => ({ dur: window.DURATION, sfx: window.SFX || [] }));
const silent = path.join(work, 'silent.mp4'), n = Math.round(dur * FPS);
const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20', '-r', String(FPS), silent], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  await page.evaluate((t) => window.seek(t), i / FPS);
  const img = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(img)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 150 === 0) process.stdout.write(`เฟรม ${i}/${n}\n`);
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();

// เสียง: เพลงพื้นหลัง + เสียงประกอบตามจังหวะ
const py = (code) => spawnSync('python3', ['-c', `import sys; sys.path.insert(0, ${JSON.stringify(path.join(HERE, '..'))}); import sound; ${code}`], { stdio: 'inherit' });
const music = path.join(work, `music-${mood}.wav`); if (!fs.existsSync(music)) py(`sound.make_music(${JSON.stringify(music)}, ${JSON.stringify(mood)}, 7)`);
const isFile = (nm) => /\.(wav|mp3)$/.test(nm), sfxPath = (nm) => isFile(nm) ? path.resolve(path.dirname(src), nm) : path.join(work, `${nm}.wav`);
const names = [...new Set(sfx.map((x) => x[1]).filter((nm) => !isFile(nm)))];
for (const nm of names) { const f = path.join(work, `${nm}.wav`); if (!fs.existsSync(f)) py(`sound.make_sfx(${JSON.stringify(nm)}, ${JSON.stringify(f)})`); }
const args = ['-y', '-loglevel', 'error', '-i', silent, ...sfx.flatMap((x) => ['-i', sfxPath(x[1])]), '-stream_loop', '-1', '-t', (dur + 1).toFixed(2), '-i', music];
let fc = ''; const mix = [];
sfx.forEach(([at, nm], k) => { const ms = Math.round(at * 1000); fc += `[${k + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=${ms}|${ms},volume=${isFile(nm) ? 1.4 : 0.7}[s${k}];`; mix.push(`[s${k}]`); });
fc += `[${sfx.length + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.32,afade=t=out:st=${(dur - 1.2).toFixed(2)}:d=1.2[mu];`; mix.push('[mu]');
fc += `${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=longest[a]`;
const r = spawnSync(FF, [...args, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-t', dur.toFixed(2), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { stdio: 'inherit', timeout: 600e3 });
if (r.status) { console.error('รวมเสียงไม่สำเร็จ'); process.exit(1); }
console.log(JSON.stringify({ ok: true, out, sec: dur, frames: n, took: Math.round((Date.now() - t0) / 1000) + 's' }));
