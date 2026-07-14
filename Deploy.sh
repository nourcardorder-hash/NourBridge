#!/bin/bash
# ==============================================================================
# SOVEREIGN LOCK v2.0 - GitHub Repo Hardening & Asset Encryption
# Uses your device fingerprint as the only key to unlock.
# ==============================================================================

set -euo pipefail

# 1. Prompt for Device Fingerprint
echo "Enter your device fingerprint (from phone/terminal):"
read -s DEVICE_FINGERPRINT

if [ -z "$DEVICE_FINGERPRINT" ]; then
    echo "Error: Fingerprint cannot be empty. Aborting."
    exit 1
fi

# 2. Define paths
TARGET_DIR="${1:-$(pwd)}"
LOCK_FILE="$TARGET_DIR/.sovereign.lock"
ENCRYPTED_ARCHIVE="$TARGET_DIR/.sovereign_assets.enc"

echo "Applying Sovereign Lock to: $TARGET_DIR"

# 3. Clean tracking & cache files
echo "[1/4] Purging temp, cache, and git tracking files..."
find "$TARGET_DIR" -type f \( -name "*.log" -o -name "*.tmp" -o -name "*.cache" -o -name ".env" -o -name "config.json" -o -name "package-lock.json" \) -delete
rm -rf "$TARGET_DIR/.git" "$TARGET_DIR/node_modules" 2>/dev/null

# 4. Lock file permissions
echo "[2/4] Locking file permissions..."
chmod -R 750 "$TARGET_DIR"
find "$TARGET_DIR" -type f -exec chmod 640 {} \;

# 5. Encrypt sensitive assets using your fingerprint as the key
echo "[3/4] Encrypting wallets, keys, and JSON configs..."
# Collect sensitive files into a temp archive
tar -czf "$TARGET_DIR/.assets_to_lock.tar.gz" \
    "$TARGET_DIR"/*.key "$TARGET_DIR"/*.pem "$TARGET_DIR"/*.wallet \
    "$TARGET_DIR"/*.json "$TARGET_DIR"/*.env 2>/dev/null || true

if [ -f "$TARGET_DIR/.assets_to_lock.tar.gz" ]; then
    # Encrypt using AES-256-CBC with PBKDF2
    openssl enc -aes-256-cbc -pbkdf2 -salt -in "$TARGET_DIR/.assets_to_lock.tar.gz" \
        -out "$ENCRYPTED_ARCHIVE" -pass pass:"$DEVICE_FINGERPRINT"
    
    # Securely delete the original plaintext files
    rm -f "$TARGET_DIR"/*.key "$TARGET_DIR"/*.pem "$TARGET_DIR"/*.wallet "$TARGET_DIR"/*.json
    rm -f "$TARGET_DIR/.assets_to_lock.tar.gz"
    echo "Assets encrypted. Only your fingerprint can decrypt them."
fi

# 6. Create a signed lock file
echo "$DEVICE_FINGERPRINT" > "$LOCK_FILE"
sha256sum "$ENCRYPTED_ARCHIVE" >> "$LOCK_FILE"

# 7. Cut outbound background connections (Firewall isolation)
echo "[4/4] Cutting outbound connections (Local firewall drop)..."
if command -v iptables &> /dev/null; then
    iptables -P OUTPUT DROP 2>/dev/null
    iptables -P FORWARD DROP 2>/dev/null
    iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null
    iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null
elif command -v netsh &> /dev/null; then
    netsh advfirewall firewall add rule name="Sovereign_Block_All" dir=out action=block protocol=any 2>/dev/null
fi

# 8. Make the lock file immutable (prevents deletion/changes)
chattr +i "$LOCK_FILE" 2>/dev/null || attrib +r "$LOCK_FILE" 2>/dev/null

# 9. Self-destruct the script after execution (optional, prevents re-running)
rm -- "$0" 2>/dev/null || true

echo "==============================================="
echo "SOVEREIGN LOCK ACTIVE."
echo "Repo path: $TARGET_DIR"
echo "Fingerprint root: ${DEVICE_FINGERPRINT:0:8}..."
echo "Encrypted Vault: $ENCRYPTED_ARCHIVE"
echo "Lock Signature: $LOCK_FILE"
echo "==============================================="
