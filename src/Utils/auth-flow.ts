/**
 * Helper murni (tanpa dependensi runtime) untuk alur login: QR Code dan pairing code.
 * Dipisah dari socket agar mudah diuji dan dipakai ulang.
 */

/** Panjang pairing code WhatsApp */
export const PAIRING_CODE_LENGTH = 8

/**
 * Alfabet Crockford yang dipakai saat Baileys membuat kode acak sendiri
 * (tanpa 0, I, O, U). Kode custom di luar alfabet ini masih diterima,
 * tetapi memicu peringatan karena belum terbukti bisa diketik di aplikasi WhatsApp.
 */
export const PAIRING_CODE_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTVWXYZ'

/** Batas nomor internasional (E.164): maksimal 15 digit */
const PHONE_MIN_DIGITS = 8
const PHONE_MAX_DIGITS = 15

export type PairingInputErrorCode = 'PHONE_EMPTY' | 'PHONE_LOCAL_FORMAT' | 'PHONE_LENGTH' | 'CODE_LENGTH' | 'CODE_CHARS'

export class PairingInputError extends Error {
	readonly code: PairingInputErrorCode

	constructor(code: PairingInputErrorCode, message: string) {
		super(message)
		this.name = 'PairingInputError'
		this.code = code
	}
}

/**
 * Normalisasi nomor telepon ke format internasional tanpa "+" (contoh: 6281234567890).
 * Menolak format lokal yang diawali 0 karena WhatsApp membutuhkan kode negara.
 */
export const normalizePairingPhone = (input: unknown): string => {
	const raw = String(input ?? '').trim()
	if (!raw) {
		throw new PairingInputError('PHONE_EMPTY', 'Nomor telepon kosong')
	}

	const digits = raw.replace(/[^0-9]/g, '')
	if (digits.startsWith('0')) {
		throw new PairingInputError(
			'PHONE_LOCAL_FORMAT',
			`Nomor "${raw}" memakai format lokal (diawali 0). Gunakan format internasional dengan kode negara, contoh 62812xxxxxxxx`
		)
	}

	if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
		throw new PairingInputError(
			'PHONE_LENGTH',
			`Nomor tidak valid: ${digits.length} digit (harus ${PHONE_MIN_DIGITS}-${PHONE_MAX_DIGITS} digit, format internasional tanpa +)`
		)
	}

	return digits
}

export type NormalizedCustomCode = {
	code: string
	/** karakter yang tidak ada di alfabet Crockford (mungkin tidak bisa diketik di aplikasi) */
	nonStandardChars: string[]
}

/**
 * Normalisasi custom pairing code: huruf di-uppercase, wajib tepat 8 karakter A-Z/0-9.
 * Karakter lain (spasi, tanda hubung) ditolak, bukan dibuang diam-diam,
 * supaya kode yang ditampilkan ke pengguna sama dengan kode yang dikirim.
 */
export const normalizeCustomPairingCode = (input: unknown): NormalizedCustomCode => {
	const code = String(input ?? '')
		.trim()
		.toUpperCase()

	if (!/^[A-Z0-9]+$/.test(code)) {
		throw new PairingInputError('CODE_CHARS', `Custom pairing code hanya boleh berisi A-Z dan 0-9 (diterima: "${input}")`)
	}

	if (code.length !== PAIRING_CODE_LENGTH) {
		throw new PairingInputError(
			'CODE_LENGTH',
			`Custom pairing code harus tepat ${PAIRING_CODE_LENGTH} karakter (diterima: "${code}", panjang ${code.length})`
		)
	}

	const nonStandardChars = [...new Set([...code].filter(ch => !PAIRING_CODE_ALPHABET.includes(ch)))]
	return { code, nonStandardChars }
}
