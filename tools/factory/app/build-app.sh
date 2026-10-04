#!/bin/bash
# สร้างแอป "โรงงาน SheetLab.app" ใน ~/Applications (กดเปิดได้จาก Launchpad / Spotlight / ลากไว้ที่ Dock)
# แอปเปิดเซิร์ฟเวอร์ในเครื่อง (tools/factory/app/server.mjs) แล้วเปิดหน้าต่างแอปด้วย Chrome แบบไม่มีแถบเบราว์เซอร์
#   bash tools/factory/app/build-app.sh
set -e
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
APP="$HOME/Applications/โรงงาน SheetLab.app"
rm -rf "$APP" && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>โรงงาน SheetLab</string>
<key>CFBundleDisplayName</key><string>โรงงาน SheetLab</string>
<key>CFBundleIdentifier</key><string>com.sheetlab.factory</string>
<key>CFBundleVersion</key><string>1.0</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleExecutable</key><string>launcher</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
</dict></plist>
PLIST
cat > "$APP/Contents/MacOS/launcher" <<LAUNCH
#!/bin/bash
URL="http://127.0.0.1:7788"
if ! /usr/bin/curl -s -o /dev/null --max-time 1 "\$URL/"; then
  nohup /opt/homebrew/bin/node "$REPO/tools/factory/app/server.mjs" >> "\$HOME/Library/Logs/sheetlab-factory-app.log" 2>&1 &
  for i in 1 2 3 4 5 6 7 8 9 10; do /usr/bin/curl -s -o /dev/null --max-time 1 "\$URL/" && break; sleep 0.5; done
fi
open -na "Google Chrome" --args --app="\$URL" --user-data-dir="\$HOME/Library/Application Support/SheetLab Factory App" --window-size=1240,880
LAUNCH
chmod +x "$APP/Contents/MacOS/launcher"
ICON="$(mktemp -d)/AppIcon.iconset"; mkdir -p "$ICON"
for s in 16 32 64 128 256 512; do
  sips -z $s $s "$REPO/src/brand/icon-512.png" --out "$ICON/icon_${s}x${s}.png" >/dev/null
  d=$((s*2)); [ $d -le 512 ] && sips -z $d $d "$REPO/src/brand/icon-512.png" --out "$ICON/icon_${s}x${s}@2x.png" >/dev/null
done
cp "$REPO/src/brand/icon-512.png" "$ICON/icon_256x256@2x.png"
iconutil -c icns "$ICON" -o "$APP/Contents/Resources/AppIcon.icns"
touch "$APP"
echo "สร้างแล้ว: $APP"
