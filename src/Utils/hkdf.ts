/**
 * HKDF-SHA256 (RFC 5869) dan MD5 berbasis `node:crypto`.
 * Implementasi internal KEY BAILEYS; menggantikan impor `hkdf` / `md5` dari `whatsapp-rust-bridge`.
 * Tanpa dependensi pihak ketiga; diverifikasi dengan vektor uji RFC 5869 dan RFC 1321.
 */
import { createHash, hkdfSync } from 'crypto'

type Bytes = Uint8Array | Buffer | string

export type HKDFInfo = {
	/** salt opsional; default string kosong (setara HashLen byte nol menurut RFC 5869) */
	salt?: Bytes
	/** konteks opsional; string di-encode UTF-8 */
	info?: Bytes
}

const toBuffer = (value: Bytes | undefined): Buffer => {
	if (value === undefined) {
		return Buffer.alloc(0)
	}

	return typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value)
}

/** HKDF (extract + expand) dengan SHA-256. Mengembalikan `expandedLength` byte. */
export const hkdf = (buffer: Bytes, expandedLength: number, { salt, info }: HKDFInfo = {}): Buffer => {
	if (!Number.isInteger(expandedLength) || expandedLength < 0 || expandedLength > 255 * 32) {
		throw new RangeError(`expandedLength tidak valid: ${expandedLength} (0..8160)`)
	}

	return Buffer.from(hkdfSync('sha256', toBuffer(buffer), toBuffer(salt), toBuffer(info), expandedLength))
}

/** MD5 digest (dipakai untuk kompatibilitas protokol, bukan untuk keamanan). */
export const md5 = (buffer: Bytes): Buffer => createHash('md5').update(toBuffer(buffer)).digest()
