#!/usr/bin/env bash
# Verifikasi bahwa dependency GitHub bisa dipasang & di-import oleh proyek Node.js lain.
# Butuh internet, git, Node >= 20.
# Pemakaian: ./scripts/verify-install.sh [spec]
#   spec default: github:keydo5507-del/key-baileys
set -euo pipefail
SPEC="${1:-github:keydo5507-del/key-baileys}"
DIR="$(mktemp -d)"
cd "$DIR"
npm init -y >/dev/null
npm pkg set type=module >/dev/null
npm install "@whiskeysockets/baileys@${SPEC}"
cat > check.mjs <<'JS'
import makeWASocket, * as b from '@whiskeysockets/baileys'
const need = ['useMultiFileAuthState','DisconnectReason','fetchLatestBaileysVersion','makeWASocket','proto']
const missing = need.filter(k => !(k in b))
if (typeof makeWASocket !== 'function' || missing.length) { console.error('GAGAL, hilang:', missing); process.exit(1) }
console.log('OK: ESM import berhasil, ekspor utama tersedia')
JS
node check.mjs
cat > check.cjs <<'JS'
import('@whiskeysockets/baileys').then(m => { if (typeof m.default !== 'function') throw new Error('default bukan fungsi'); console.log('OK: import() dinamis dari CommonJS berhasil') })
JS
node check.cjs
echo "Direktori uji: $DIR"
