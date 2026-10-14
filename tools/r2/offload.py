#!/usr/bin/env python3
"""ย้ายไฟล์จาก Supabase Storage (product-images/<โฟลเดอร์>) ขึ้น Cloudflare R2 ที่ path เดียวกัน แล้วเปลี่ยนลิงก์ทั้งระบบ (ตาราง posts + ทุกแถว shop_state)
  python3 tools/r2/offload.py reels [print files products ...] [--dry]
ไฟล์ใน Supabase ไม่ลบ (ลิงก์เก่าในอีเมลลูกค้ายังใช้ได้) · รันซ้ำได้ ข้ามไฟล์ที่ขึ้น R2 แล้ว · ใช้คีย์ร้าน ~/.config/sheetlab/content-key"""
import sys, os, json, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import r2

KEY = os.environ.get('CONTENT_KEY') or open(os.path.expanduser('~/.config/sheetlab/content-key')).read()[:48].strip()
API = 'https://sheetlabth.com/api/content?action='


def api(action, body=None, q=''):
    r = urllib.request.Request(API + action + q, data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET', headers={'x-content-key': KEY, 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(r, timeout=300).read())


def offload(folder, dry=False):
    L = api('r2_list', q='&folder=' + folder)
    files, sbp = L['files'], L['sb_prefix']
    done, moved, failed = [], 0, []
    for f in files:
        p = f['path']
        if r2.exists(p, f['size'] or None): done.append(p); continue
        if dry: moved += 1; continue
        try:
            data = urllib.request.urlopen(urllib.request.Request(sbp + urllib.parse.quote(p), headers={'User-Agent': 'sheetlab-offload'}), timeout=300).read()
            r2.put_bytes(data, p, f['type']); done.append(p); moved += 1
        except Exception as e: failed.append(f'{p}: {e}')
    out = {'folder': folder, 'files': len(files), 'copied_now': moved, 'on_r2': len(done), 'failed': failed[:5]}
    if done and not dry:
        rw = {'posts': 0, 'rows': []}
        for i in range(0, len(done), 500):
            j = api('r2_rewrite', {'paths': done[i:i + 500]}); rw['posts'] += j.get('posts', 0); rw['rows'] += j.get('rows', [])
        out['rewrite'] = rw
    return out


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    for f in args or ['reels']: print(json.dumps(offload(f, '--dry' in sys.argv), ensure_ascii=False), flush=True)
