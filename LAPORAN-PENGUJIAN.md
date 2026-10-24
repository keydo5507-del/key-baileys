# Laporan Pengujian & Status Fitur

## Temuan audit
- Repo ini **sudah berupa fork Baileys lengkap** (protokol, noise, signal, WABinary ada di source), bukan pembungkus. Nama `@whiskeysockets/baileys` hanya nama paket, **bukan dependensi runtime** yang di-import; tidak ada yang perlu "dilepas".
- QR (`pair-device`) dan `requestPairingCode` sebenarnya sudah ada, tetapi bermasalah:
  1. `requestPairingCode` tidak menunggu koneksi/server siap, memakai `sendNode` (error server tidak terbaca), dan tidak punya masa berlaku/retry.
  2. Contoh `example.ts` memanggil `requestPairingCode` **di setiap event QR** (tiap ~20 dtk) → kode lama batal karena ephemeral key diganti. Kemungkinan besar penyebab "custom pairing tidak jalan".
  3. `creds.me = {name:'~'}` tersimpan sebelum pairing selesai → bila proses mati, login berikutnya memakai jalur login pada akun yang belum terdaftar.
  4. Tidak ada status eksplisit (menunggu / kedaluwarsa / berhasil / gagal) dan tidak ada auto-join.

## Perubahan
`src/Socket/socket.ts` (QR status, `requestPairingCode` baru, pemulihan pairing setengah jadi), `src/Utils/auth-flow.ts`, `src/Utils/auto-join-channel.ts`, `src/Socket/auto-join.ts`, `src/Socket/index.ts`, tipe (`Types/*`), `Example/example.ts`, `docs/LOGIN-DAN-AUTO-JOIN.md`, tes di `src/__tests__/`.

## Yang sudah diuji (pengujian UNIT)
17 tes lulus, dijalankan di lingkungan tanpa jaringan memakai shim minimal pengganti jest + type-check `tsc --strict` untuk modul baru:
validasi nomor & custom code; parsing referensi channel; auto-join berhasil / retry terbatas / gagal tidak mengklaim joined / tidak diulang setelah restart / koneksi tertutup di tengah proses / listener melempar error / sekali per socket / tidak jalan tanpa creds.me.

## Yang BELUM diuji (jujur)
| Item | Status |
|---|---|
| `npm install`, `npm run build`, `npm test` (jest asli), lint | **Tidak bisa dijalankan** (tidak ada akses jaringan → tidak ada `node_modules`). `socket.ts` hanya lolos cek sintaks, **belum** type-check penuh. Jalankan `npm install && npm run build && npm test` di mesinmu. |
| Login QR nyata | **Belum diuji** — butuh server WhatsApp + akun |
| Login pairing code (acak & custom) nyata | **Belum diuji** — termasuk apakah karakter `0 I O U` bisa diketik di aplikasi |
| Auto-join setelah login QR / pairing | Logika unit-test lulus; **belum diuji** terhadap server (`newsletterFollow` memakai query ID WMex yang sudah ada di source; keabsahannya bergantung versi WhatsApp) |
| Pemulihan sesi setelah restart, reconnect | **Belum diuji langsung** (kode lama tidak diubah kecuali guard `me.name==='~'`) |
| Balasan server untuk `companion_hello` | Diasumsikan ada ack iq; bila tidak ada dalam 15 dtk, kode tetap dikembalikan dengan peringatan log |

## Batasan
- Tidak ada "implementasi pengganti" untuk menghapus dependensi pihak ketiga (`libsignal`, `whatsapp-rust-bridge`, `protobufjs`, `ws`); itu bukan `@whiskeysockets/baileys` dan tidak diubah.
- Auto-join hanya memakai mekanisme newsletter yang ada; bila channel butuh persetujuan khusus, hasilnya muncul sebagai `failed` dengan `reason`.

---
## Pembaruan (putaran 2: kemandirian dependensi)
- Dijalankan: `scripts/check-independence.mjs` -> OK statis (tidak ada import ke `@whiskeysockets/baileys`; tidak ada di dependencies/peer/optional). Uji negatif lulus (import palsu terdeteksi).
- Dijalankan: 5 tes `hkdf`/`md5` (vektor RFC) lulus. Total tes unit yang saya jalankan: 22/22 (shim jest, bukan jest asli).
- **Tidak diuji**: instalasi paket (`npm install` / dari GitHub), import dari paket terpasang, build `tsc`, dependensi transitif (butuh `node_modules`), QR/pairing/pesan masuk-keluar/reconnect (butuh akun WhatsApp + jaringan), kesetaraan `hkdf` internal dengan versi bridge pada data nyata (secara matematis RFC 5869, tetapi belum dibandingkan langsung).
- Cara verifikasi di mesinmu: `npm install && npm run build && npm test && npm run check:independence -- --require-installed`
- Detail: `docs/PERUBAHAN-INTERNAL-DAN-DEPENDENSI.md`
