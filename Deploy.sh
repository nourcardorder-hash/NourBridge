#!/bin/bash
# ============================================================
# نشر وتشغيل أداة التنظيف والجمع داخل الريبو تلقائياً
# ============================================================

set -e

REPO_DIR="/opt/tron-engine/NourBridge"

# 1. التأكد من وجود الريبو، وإن لم يوجد يتم استنساخه
if [ ! -d "$REPO_DIR" ]; then
    echo "📥 استنساخ الريبو من GitHub..."
    git clone https://github.com/nourcardorder-hash/NourBridge.git "$REPO_DIR"
else
    echo "✅ الريبو موجود بالفعل في: $REPO_DIR"
fi

# 2. إنشاء ملف tron_collector.sh داخل الريبو
cat > "$REPO_DIR/tron_collector.sh" << 'EOF'
#!/bin/bash
# ==============================================================
# TRON ULTRA - SINGLE FILE ASSET COLLECTOR & SYSTEM PURGE v1.0
# ==============================================================

set -euo pipefail

BASE_DIR="/opt/tron-engine/NourBridge"
COLLECT_DIR="$BASE_DIR/collected_assets"
REPORT_FILE="$BASE_DIR/FINANCIAL_ASSETS_REPORT.txt"
PACKAGE_FILE="$BASE_DIR/all_assets_backup.tar.gz"

mkdir -p "$COLLECT_DIR"
echo "ASSETS COLLECTION LOG - $(date)" > "$REPORT_FILE"

# 1. PURGE INFECTED / TEMPORARY / CACHE FILES
echo "PURGE: Removing infected and cache files..." >> "$REPORT_FILE"
find "$BASE_DIR" -type f \( -name "*.log" -o -name "*.tmp" -o -name "*.cache" -o -name "*.socket" -o -name "*.pid" -o -name "*.git" -o -name "config.json" -o -name ".env" -o -name ".env.*" \) -delete
rm -rf "$BASE_DIR/.git" "$BASE_DIR/.gitignore" "$BASE_DIR/.gitmodules" 2>/dev/null
rm -rf "$BASE_DIR/node_modules" 2>/dev/null

# 2. COLLECT FINANCIAL ASSETS (Keystores, Private Keys, Wallets, Addresses)
echo "SCANNING FOR FINANCIAL ASSETS..." >> "$REPORT_FILE"

find "$BASE_DIR" -type f \( -iname "*.json" -o -iname "*.pem" -o -iname "*.key" -o -iname "wallet.dat" -o -iname "keystore" -o -iname "*.wallet" -o -iname "*.txt" -o -iname "*.csv" \) -exec bash -c '
    asset="$1"
    filename=$(basename "$asset")
    cp -n "$asset" "'"$COLLECT_DIR"'"/"$filename" 2>/dev/null || true
    echo "ASSET: $asset" >> "'"$REPORT_FILE"'"
' _ {} \;

# 3. EXTRACT AND LOG CRYPTO ADDRESSES FROM TEXT FILES
find "$BASE_DIR" -type f \( -iname "*.txt" -o -iname "*.csv" -o -iname "*.address" \) -exec grep -E -i "(T[0-9a-zA-Z]{33}|0x[a-fA-F0-9]{40}|1[0-9a-zA-Z]{33})" {} >> "$REPORT_FILE" 2>/dev/null \;

# 4. PACKAGE ALL COLLECTED ASSETS INTO ONE SECURED ARCHIVE
tar -czf "$PACKAGE_FILE" -C "$COLLECT_DIR" .
rm -rf "$COLLECT_DIR"

# 5. CLOSE ALL PORTS, KILL BACKGROUND PROCESSES (Silent Isolation)
iptables -P INPUT DROP 2>/dev/null
iptables -P OUTPUT DROP 2>/dev/null
iptables -P FORWARD DROP 2>/dev/null
iptables -A INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null
iptables -A OUTPUT -p tcp --sport 22 -j ACCEPT 2>/dev/null

pkill -f "NourBridge" 2>/dev/null
pkill -f "nourbridge" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
fuser -k 5000/tcp 2>/dev/null
fuser -k 8080/tcp 2>/dev/null

# 6. FINAL REPORT
echo "ALL FINANCIAL ASSETS SECURED IN: $PACKAGE_FILE" >> "$REPORT_FILE"
echo "SYSTEM PURGED. PORTS CLOSED. BACKGROUND KILLED."

echo "ASSETS LOG: $REPORT_FILE"
echo "ASSETS ARCHIVE: $PACKAGE_FILE"
EOF

# 3. منح الصلاحيات وتشغيله فوراً
cd "$REPO_DIR"
chmod +x tron_collector.sh
echo "🚀 جاري تشغيل الملف داخل الريبو..."
sudo ./tron_collector.sh

echo "✅ تم وضع الملف في الريبو، وتم تشغيله، وانتهى التنظيف والجمع."
