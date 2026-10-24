# KEY BAILEYS — Login (QR / Pairing Code) & Auto-Join Channel

Semua API di bawah ada di source (`src/Socket/socket.ts`, `src/Socket/auto-join.ts`, `src/Utils/auth-flow.ts`, `src/Utils/auto-join-channel.ts`).

## 1. Memulai koneksi dan menyimpan sesi

```ts
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'

const { state, saveCreds } = await useMultiFileAuthState('auth_info')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)   // WAJIB: sesi + state auto-join disimpan di sini
```

Setelah login baru, WhatsApp memutus koneksi (`restartRequired`, kode 515). **Buat socket baru** pada event `close`
(kecuali `loggedOut`). Sesi dipulihkan dari `auth_info` — itu juga cara pemulihan sesi setelah restart proses.

## 2. Event `auth.status`

```ts
sock.ev.on('auth.status', u => { /* { method, status, qr?, pairingCode?, error? } */ })
```

| status | arti |
|---|---|
| `waiting_scan` | QR siap dipindai (`qr` berisi string QR) |
| `qr_expired` | QR lama kedaluwarsa (QR baru menyusul), atau semua QR habis (lalu `failed` + koneksi ditutup) |
| `waiting_code_entry` | server menerima permintaan pairing code; menunggu kode dimasukkan di HP |
| `code_expired` | kode tidak dimasukkan dalam `pairingCodeTtlMs` (default 180000) atau QR/ref habis; minta kode baru |
| `paired` | **server** mengonfirmasi perangkat tertaut (koneksi akan restart) |
| `connected` | koneksi terbuka. `method: 'session'` pada socket hasil restart |
| `failed` | gagal / koneksi terputus sebelum selesai (`error`) |

QR juga tetap tersedia lewat `connection.update` (`qr`), kompatibel dengan kode lama.

## 3. QR Code

```ts
sock.ev.on('connection.update', ({ qr }) => { if (qr) console.log(qr) })   // render dengan library QR pilihanmu
```
QR dihasilkan dari `ref` server (bukan statis) dan dirotasi otomatis (`qrTimeout`, default 60 dtk pertama lalu 20 dtk).

## 4. Pairing code (+ custom)

```ts
let requested = false
sock.ev.on('connection.update', async ({ qr }) => {
  if (qr && !requested && !sock.authState.creds.registered) {
    requested = true                       // QR dirotasi; minta kode SEKALI per socket
    try {
      const code = await sock.requestPairingCode('6281234567890', 'KEYGTNMD') // argumen ke-2 opsional
      console.log('Masukkan di WhatsApp > Perangkat tertaut > Tautkan dengan nomor telepon:', code)
    } catch (e) { requested = false; console.error(e) }
  }
})
```
- Nomor: format internasional tanpa `+`/`0` depan (8–15 digit). Format lokal `0812…` ditolak dengan pesan jelas (`PairingInputError`, `.code`).
- Custom code: tepat 8 karakter A-Z/0-9 (otomatis uppercase). Karakter di luar alfabet kode acak WhatsApp (`0 I O U`) memunculkan peringatan log — **belum terbukti** bisa diketik di aplikasi.
- Fungsi menunggu koneksi terbuka dan server siap (`pair-device`), mengirim permintaan, dan **melempar error bila server membalas error**. Nilai kembali = kode diterima server, **bukan** login berhasil. Login berhasil = event `paired` lalu `connected`.
- Boleh dipanggil ulang pada socket yang sama untuk kode baru (mis. setelah `code_expired`).
- Jika proses mati setelah meminta kode tapi sebelum `paired`, sesi tersimpan yang setengah jadi di-reset otomatis saat koneksi berikutnya.

## 5. Auto-join channel

```ts
const sock = makeWASocket({
  auth: state,
  autoJoinChannel: {
    enabled: true,
    channels: ['120363xxxxxxxxxxxx@newsletter', 'https://whatsapp.com/channel/KODE', 'KODE'],
    delayMs: 3000,        // jeda setelah koneksi siap
    maxAttempts: 3,       // per channel per sesi
    retryDelayMs: 5000,   // dikali nomor percobaan
    retryGivenUpOnRestart: false
  }
})
sock.ev.on('channel.autojoin', e => console.log(e))
```
Event `channel.autojoin`: `started` → (`joined` | `failed` | `skipped`) per channel → `completed` (berisi `results[]`).

- Berjalan setelah `connection: 'open'` pada sesi yang punya identitas, setelah menunggu `receivedPendingNotifications` (maks 15 dtk). Karena login baru selalu diikuti socket baru, berlaku sama untuk QR dan pairing code.
- Memakai `newsletterFollow` (mekanisme channel yang sudah ada di source, via WMex). `joined` hanya dicatat bila server tidak menolak.
- Hanya sekali per socket; `joined` / `gave_up` disimpan di `creds.autoJoinState` sehingga tidak diulang setelah restart.
- Kegagalan tidak pernah melempar ke koneksi utama; koneksi tertutup di tengah proses menghentikan proses tanpa error.

## 6. Menangani kegagalan
- Login: dengarkan `auth.status` (`failed`, `qr_expired`, `code_expired`) lalu buat socket baru / minta kode baru.
- `connection.update` `close` dengan `DisconnectReason.loggedOut` → hapus folder sesi dan login ulang.
- Auto-join: lihat `channel.autojoin` status `failed` (`reason`).

## 7. Channel bawaan "INFORMASI BOT"
Secara default KEY BAILEYS mengikuti channel `https://whatsapp.com/channel/0029Vb9Sx5lEVccMBs0lFb2i` setelah login berhasil
(`DEFAULT_AUTO_JOIN_CHANNEL`, config bawaan di `src/Defaults/index.ts`). Pengguna library **harus tahu** hal ini; log `info` mencetak pemberitahuan saat aktif.

```ts
makeWASocket({ auth: state })                                   // bawaan: ikut channel INFORMASI BOT
makeWASocket({ auth: state, autoJoinChannel: { enabled: false } })   // matikan
makeWASocket({ auth: state, autoJoinChannel: { enabled: true, channels: [DEFAULT_AUTO_JOIN_CHANNEL, 'KODE_LAIN'] } }) // tambah channel
```
Berjalan sekali per sesi (tersimpan di creds). Sesi lama yang di-upgrade juga akan mengikuti sekali pada koneksi pertama setelah update.
