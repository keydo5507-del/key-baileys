<div align="center">

# 🔑 KEY BAILEYS

**Fork Baileys (WhiskeySockets) untuk bot WhatsApp: tombol interaktif, fungsi bantu siap pakai, dan bisa dipasang langsung dari GitHub.**

`WebSocket` · `Pairing Code` · `Multi-Device` · `TypeScript` · `ESM`

</div>

---

> ⚠️ **Bukan produk resmi WhatsApp / Meta.** Gunakan hanya untuk akun yang Anda miliki atau yang penggunaannya sudah diizinkan. Tidak ada jaminan akun terbebas dari pembatasan. Hindari spam dan otomasi yang melanggar ketentuan layanan WhatsApp.

## 📦 Instalasi

Tambahkan ke `package.json` proyek Anda:

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "github:keydo5507-del/key-baileys"
  }
}
```

atau lewat terminal:

```bash
npm install @whiskeysockets/baileys@github:keydo5507-del/key-baileys
# versi tertentu (tag / branch / commit):
npm install @whiskeysockets/baileys@github:keydo5507-del/key-baileys#master
```

Saat instalasi, `npm` akan meng-clone repo ini lalu menjalankan skrip `prepare` (`npm run build`) sehingga folder `lib/` dibuat otomatis. Syarat: **Node.js ≥ 20** dan `git` terpasang.

> Nama dependency (`@whiskeysockets/baileys`) sengaja dipertahankan agar kompatibel dengan kode/plugin yang sudah meng-import nama tersebut. Sumbernya adalah repositori KEYYANGEE.

## ✨ Tambahan KEY BAILEYS (untuk bot)

Dibanding upstream, fork ini menambahkan:

| Tambahan | Berkas | Keterangan |
|----------|--------|------------|
| Tombol WA (multi-format) | `src/Utils/interactive.ts` | `interactiveButtons`, `buttons` lama, `templateButtons`, dan `sections` (list) → native flow |
| Node `biz` + `bot` otomatis | `src/Utils/interactive.ts` | Tombol/list tampil di **akun WhatsApp biasa** (bukan hanya Business) |
| **Custom pairing** | `src/Socket/socket.ts` | `requestPairingCode(phone, 'KEYGTNMD')` — tepat 8 karakter A-Z/0-9 |
| Fungsi bantu di socket | `src/Socket/extras.ts` | `sendPreview`, `sendTable`, `sendTableV2`, `sendCodeBlock(V2)`, `sendList`, `sendLinkV2`, `newsletterMsg` |

Fungsi bantu hanya dipasang jika belum ada di socket, jadi tidak menimpa kode milik proyekmu.

#### Tombol — format native (disarankan)

```js
await sock.sendMessage(jid, {
  image: { url: 'https://contoh.id/banner.jpg' },
  caption: 'Pilih menu',
  footer: 'KEY GANTENG MD',
  interactiveButtons: [
    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Menu', id: '.menu' }) },
    { name: 'cta_url',     buttonParamsJson: JSON.stringify({ display_text: 'Website', url: 'https://contoh.id', merchant_url: 'https://contoh.id' }) },
    { name: 'cta_copy',    buttonParamsJson: JSON.stringify({ display_text: 'Salin kode', copy_code: 'KEYGTNMD' }) }
  ]
}, { quoted: m })
```

#### Tombol — format lama SC (otomatis dikonversi)

```js
await sock.sendMessage(jid, {
  text: 'Pilih menu',
  footer: 'KEY MD',
  buttons: [
    { buttonId: '.menu', buttonText: { displayText: 'Menu' }, type: 1 },
    { buttonId: '.owner', buttonText: { displayText: 'Owner' }, type: 1 }
  ]
})
```

#### List / sections

```js
await sock.sendMessage(jid, {
  text: 'Kategori',
  footer: 'KEY MD',
  title: 'Menu',
  buttonText: 'Buka',
  sections: [
    {
      title: 'Utama',
      rows: [
        { title: 'Menu', rowId: '.menu', description: 'Semua fitur' },
        { title: 'Owner', rowId: '.owner' }
      ]
    }
  ]
})
```

> 📘 Panduan lengkap QR, pairing code, `auth.status`, dan auto-join channel: [`docs/LOGIN-DAN-AUTO-JOIN.md`](docs/LOGIN-DAN-AUTO-JOIN.md)

> 📢 Secara default, setelah login berhasil akun otomatis mengikuti channel **INFORMASI BOT**. Matikan dengan `autoJoinChannel: { enabled: false }` (lihat docs).

#### Custom pairing

```js
const code = await sock.requestPairingCode('62812xxxxxxxx', 'KEYGTNMD')
// User input KEYGTNMD di WhatsApp → Perangkat tertaut
```

> ℹ️ Tampilan tombol di WhatsApp ditentukan oleh server dan versi aplikasi. Update WhatsApp di HP jika muncul "pesan tidak didukung". Uji dulu di nomor cadangan.

### Memasang di bot yang memakai nama `ourin`

Bot yang meng-import `from 'ourin'` tidak perlu diubah kodenya. Cukup ganti sumber dependency di `package.json` bot:

```json
{
  "dependencies": {
    "ourin": "github:keydo5507-del/key-baileys"
  }
}
```

lalu jalankan `npm install`. Library lain yang meng-import `@whiskeysockets/baileys` bisa memakai alias yang sama: `"@whiskeysockets/baileys": "github:keydo5507-del/key-baileys"`.

## 🚀 Penggunaan

Package ini adalah **ESM** (`"type": "module"`).

```js
// ESM (disarankan)
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
```

```js
// CommonJS: gunakan import() dinamis
async function main () {
  const baileys = await import('@whiskeysockets/baileys')
  const makeWASocket = baileys.default
  const { useMultiFileAuthState } = baileys
}
main()
```

> `require('@whiskeysockets/baileys')` langsung hanya bekerja pada Node.js yang mendukung `require(esm)` dan **belum diuji** di repo ini. Jika ragu, pakai `import` / `import()`.

### Koneksi + Pairing Code (termasuk **custom pairing**)

```js
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'

const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
const sock = makeWASocket({ auth: state })

sock.ev.on('creds.update', saveCreds)

if (!sock.authState.creds.registered) {
  // Random 8 karakter:
  // const code = await sock.requestPairingCode('62812xxxxxxxx')

  // Custom pairing (wajib tepat 8 karakter A-Z/0-9) — KEY GANTENG MD:
  const code = await sock.requestPairingCode('62812xxxxxxxx', 'KEYGTNMD')
  console.log('Kode pairing:', code) // → KEYGTNMD
}

sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
  if (connection === 'close') {
    const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut
    if (!loggedOut) console.log('Terputus — sambungkan ulang sesuai kebijakan Anda')
  }
})

sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const m of messages) {
    if (!m.key.fromMe) await sock.sendMessage(m.key.remoteJid, { text: 'Halo dari KEY BAILEYS' })
  }
})
```

> Pada Baileys 7.x opsi `printQRInTerminal` sudah deprecated; tangani `qr` dari event `connection.update` sendiri bila ingin memakai QR.

## ✅ Fitur (diwarisi dari source Baileys)

Semua fitur berikut berasal dari source upstream yang disertakan di repo ini (lihat `src/`):

| Area | Lokasi source |
|------|---------------|
| Koneksi WebSocket & Noise handshake | `src/Socket/socket.ts`, `src/Socket/Client`, `src/Utils/noise-handler.ts` |
| Pairing code & autentikasi | `requestPairingCode` di `src/Socket/socket.ts` |
| Penyimpanan/pemulihan sesi | `useMultiFileAuthState` — `src/Utils/use-multi-file-auth-state.ts` |
| Kirim/terima pesan, event pesan | `src/Socket/messages-send.ts`, `messages-recv.ts` |
| Media (upload/download, thumbnail) | `src/Utils/messages-media.ts` |
| Grup | `src/Socket/groups.ts` |
| Komunitas | `src/Socket/communities.ts` |
| Newsletter / Channel | `src/Socket/newsletter.ts` |
| Chat, presence, app-state sync | `src/Socket/chats.ts`, `src/Utils/chat-utils.ts` |
| Akun bisnis & produk | `src/Socket/business.ts` |
| Signal / enkripsi, LID mapping | `src/Signal` |
| Tipe TypeScript & protobuf WhatsApp | `src/Types`, `WAProto` |

Dokumentasi API lengkap upstream: [`UPSTREAM-README.md`](./UPSTREAM-README.md) dan <https://baileys.wiki>.

Fitur seperti "anti-ban", "anti-limit" atau "bypass" **tidak** disediakan oleh source Baileys dan tidak diklaim di sini.

## 🛠️ Pengembangan lokal

```bash
git clone https://github.com/keydo5507-del/key-baileys.git
cd key-baileys
npm install        # otomatis menjalankan build (prepare)
npm run build      # tsc + tsc-esm-fix  -> lib/
npm test           # unit test (jest)
npm run lint       # type-check + eslint
npm run example    # Example/example.ts (butuh akun WhatsApp)
```

Skrip `scripts/verify-install.sh` memverifikasi bahwa dependency GitHub bisa dipasang dan di-import oleh proyek lain.

## 📁 Struktur

```
key-baileys/
├── src/                 # source TypeScript Baileys
├── WAProto/             # protobuf WhatsApp (proto, index.js, index.d.ts)
├── Example/             # contoh upstream
├── scripts/             # update-version.ts + verify-install.sh
├── tsconfig.json
├── tsconfig.build.json  # konfigurasi build -> lib/
├── package.json
├── LICENSE              # MIT (upstream + fork)
└── UPSTREAM-README.md   # README asli Baileys
```

## 📜 Lisensi & Atribusi

MIT. Proyek ini adalah **fork** dari [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) © Rajeh Taher/WhiskeySockets. Pemberitahuan hak cipta upstream dipertahankan di [`LICENSE`](./LICENSE). Perubahan fork dijelaskan di bagian **Tambahan KEY BAILEYS** di atas; selebihnya source upstream tidak diubah.
