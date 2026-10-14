"""Cloudflare R2 (ส่งข้อมูลออกฟรี) สำหรับไฟล์ใหญ่ของร้าน: คลิป reels, PDF, รูป · คีย์อยู่ที่ ~/.config/sheetlab/r2.json (ไม่อยู่ในโค้ด)
14 ต.ค. 69: Supabase เกินโควต้าส่งข้อมูลจนเว็บล่ม → ไฟล์ใหม่ขึ้น R2 ตรง ไฟล์เก่าย้ายด้วย offload.py"""
import json, os
from pathlib import Path
import boto3

CFG = json.load(open(Path.home() / '.config/sheetlab/r2.json'))
S3 = boto3.client('s3', endpoint_url=CFG['endpoint'], aws_access_key_id=CFG['access_key_id'], aws_secret_access_key=CFG['secret_access_key'], region_name='auto')
PUB = CFG['public'].rstrip('/') + '/'


def public_url(key): return PUB + key


def exists(key, size=None):
    try: h = S3.head_object(Bucket=CFG['bucket'], Key=key)
    except Exception: return False
    return size is None or h['ContentLength'] == size


def put_bytes(data, key, ctype):
    S3.put_object(Bucket=CFG['bucket'], Key=key, Body=data, ContentType=ctype or 'application/octet-stream', CacheControl='public, max-age=31536000')
    return public_url(key)


def put_file(path, key, ctype):
    return put_bytes(open(path, 'rb').read(), key, ctype)
