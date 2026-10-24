# Laporan Perubahan Internal & Dependensi

## Fakta dasar hasil audit
- KEY BAILEYS adalah **fork penuh** Baileys (protokol WA, noise, signal, WABinary, event, pesan, media, auth state ada di `src/`). Tidak ada import/require/export-from ke `@whiskeysockets/baileys` di `src/`, `Example/`, `WAProto/`, `scripts/`, `proto-extract/`. Dibuktikan oleh `npm run check:independence` (termasuk uji negatif: import palsu terdeteksi).
- Nama paket `@whiskeysockets/baileys` dipertahankan di `package.json` hanya agar `import ... from '@whiskeysockets/baileys'` milik pengguna tetap jalan. Itu nama, bukan dependensi. Mengganti nama = breaking change; keputusan ada padamu.
- `@whiskeysockets/eslint-config` ada di devDependencies (lint saja, tidak masuk runtime).

## Perubahan internal (nyata)
| Perubahan | Berkas | Bukti |
|---|---|---|
| `hkdf` & `md5` kini implementasi internal (`node:crypto`), tidak lagi dari `whatsapp-rust-bridge` | `src/Utils/hkdf.ts`, re-export di `src/Utils/crypto.ts` | 5 tes: vektor RFC 5869 (case 1 & 3), RFC 1321 |
| Login QR/pairing code, auto-join channel, event `auth.status` & `channel.autojoin` | lihat `docs/LOGIN-DAN-AUTO-JOIN.md` | 17 tes unit |
| Pemeriksa kemandirian dependensi | `scripts/check-independence.mjs` (`npm run check:independence`) | dijalankan, lulus statis |

Seluruh API publik tidak diubah (hanya penambahan).

## Dependensi pihak ketiga yang MASIH dipakai runtime
| Paket | Dipakai untuk | Status |
|---|---|---|
| `whatsapp-rust-bridge` | `LTHashAntiTampering` (`lt-hash.ts`), `expandAppStateKeys` (`chat-utils.ts`) | **Belum diganti.** `hkdf`/`md5` sudah lepas. LT-hash bisa ditulis ulang di JS, tetapi tanpa paket terpasang saya tidak bisa membuktikan hasilnya identik, dan selisih sekecil apa pun merusak sinkronisasi app-state. |
| `libsignal` | enkripsi Signal (sesi, kurva, grup) | Belum diganti; menulis ulang kripto E2E tanpa uji interoperabilitas ke server berisiko merusak keamanan. |
| `protobufjs`, `ws`, `pino`, `@hapi/boom`, `async-mutex`, `p-queue`, `lru-cache`, `@cacheable/node-cache`, `music-metadata` | util umum | Dependensi biasa, bukan mesin Baileys. |

## Yang sengaja TIDAK dilakukan, dan alasannya
Permintaan "rombak total struktur folder/modul" tidak saya kerjakan. Tanpa `node_modules` dan jaringan saya tidak bisa mengompilasi atau menjalankan proyek ini, jadi memindahkan/menulis ulang ribuan baris (`socket.ts` 1200+ baris, `messages-*.ts` 3500+ baris) akan menghasilkan kode yang tidak terbukti jalan dan berpotensi mematahkan API yang dipakai penggunamu. Perubahan dibatasi pada hal yang bisa dibuktikan.

## Lisensi & atribusi
`LICENSE` (MIT) memuat hak cipta Rajeh Taher/WhiskeySockets dan KEYYANGEE. Atribusi upstream harus tetap dipertahankan; `UPSTREAM-README.md` dipertahankan.
