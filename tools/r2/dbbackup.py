#!/usr/bin/env python3
"""💾 สำรองฐานข้อมูลร้าน (ออเดอร์ สินค้า โพสต์ สมาชิก) ลง Cloudflare R2 วันละครั้ง (เก็บ 60 วัน)
(คุณแดน 21 ต.ค. 69: เตรียมย้ายไป Cloudflare · ข้อมูลเป็นของร้านเอง ไม่ฝากไว้เจ้าเดียว)
  python3 tools/r2/dbbackup.py                 → สำรองวันนี้
  python3 tools/r2/dbbackup.py --restore DAY   → ถอดรหัสไฟล์วันนั้นเป็น JSON (ไว้ย้ายเข้าฐานข้อมูลใหม่)
มีอีเมลลูกค้า → เข้ารหัส AES-256 ด้วยกุญแจ ~/.config/sheetlab/backup-key (อยู่บน Mac เท่านั้น) และเก็บใต้ path สุ่ม
เพราะกุญแจ R2 ที่มีเข้าได้แค่ bucket สาธารณะ sheetlab-audio (bucket ส่วนตัว sheetlab-backup รอกุญแจใหม่)"""
import sys, os, json, gzip, time, hashlib, subprocess, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import r2

BUCKET = r2.CFG['bucket']
PASS = os.path.expanduser('~/.config/sheetlab/backup-key')
PRE = 'bk-' + hashlib.sha256(open(PASS, 'rb').read()).hexdigest()[:24] + '/db/'  # path เดาไม่ได้
KEY = os.environ.get('CONTENT_KEY') or open(os.path.expanduser('~/.config/sheetlab/content-key')).read()[:48].strip()


def main():
    req = urllib.request.Request('https://sheetlabth.com/api/content?action=backup_dump', headers={'x-content-key': KEY, 'User-Agent': 'sheetlab-backup'})
    raw = urllib.request.urlopen(req, timeout=280).read()
    j = json.loads(raw)
    if not j.get('ok') or not j.get('tables', {}).get('orders'): sys.exit(f'สำรองไม่สำเร็จ: {str(j)[:200]}')
    day = time.strftime('%Y-%m-%d')
    enc = subprocess.run(['openssl', 'enc', '-aes-256-cbc', '-pbkdf2', '-salt', '-pass', 'file:' + PASS], input=gzip.compress(raw), capture_output=True, check=True).stdout
    r2.S3.put_object(Bucket=BUCKET, Key=f'{PRE}{day}.json.gz.enc', Body=enc, ContentType='application/octet-stream', CacheControl='no-store')
    old = time.strftime('%Y-%m-%d', time.localtime(time.time() - 60 * 86400))  # เก็บ 60 วัน
    for o in r2.S3.list_objects_v2(Bucket=BUCKET, Prefix=PRE).get('Contents', []):
        if o['Key'][len(PRE):][:10] < old: r2.S3.delete_object(Bucket=BUCKET, Key=o['Key'])
    print(json.dumps({'ok': True, 'day': day, 'bytes': len(raw), 'enc': len(enc), 'counts': j.get('counts')}, ensure_ascii=False))


def restore(day):
    enc = r2.S3.get_object(Bucket=BUCKET, Key=f'{PRE}{day}.json.gz.enc')['Body'].read()
    sys.stdout.buffer.write(gzip.decompress(subprocess.run(['openssl', 'enc', '-d', '-aes-256-cbc', '-pbkdf2', '-pass', 'file:' + PASS], input=enc, capture_output=True, check=True).stdout))


if __name__ == '__main__':
    restore(sys.argv[2]) if sys.argv[1:2] == ['--restore'] else main()
