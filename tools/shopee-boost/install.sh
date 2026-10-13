#!/bin/bash
# ตั้งให้ Mac รัน boost.mjs เองทุก 4 ชม. 5 นาที (launchd ของ macOS ไม่ต้องลงแอปเพิ่ม)
#   bash install.sh      ติดตั้ง/อัปเดต
#   bash install.sh off  เลิกใช้
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL=com.sheetlab.shopee-boost
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ "$1" = off ]; then rm -f "$PLIST"; echo "เลิกตั้งเวลาแล้ว"; exit 0; fi
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "ยังไม่มี Node.js: โหลดตัวติดตั้ง LTS จาก https://nodejs.org แล้วรันใหม่"; exit 1; }
[ -d "/Applications/Google Chrome.app" ] || echo "เตือน: ไม่เจอ Google Chrome ใน /Applications (ต้องมี Chrome)"
(cd "$DIR" && npm install --silent)
mkdir -p "$HOME/.shopee-boost" "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$DIR/boost.mjs</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>StartInterval</key><integer>14700</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/.shopee-boost/launchd.log</string>
  <key>StandardErrorPath</key><string>$HOME/.shopee-boost/launchd.log</string>
</dict></plist>
PL
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "ตั้งเวลาแล้ว: ดันทุก 4 ชม. 5 นาที (รอบแรกเริ่มตอนนี้) · ดูผลที่ ~/.shopee-boost/log.txt"
