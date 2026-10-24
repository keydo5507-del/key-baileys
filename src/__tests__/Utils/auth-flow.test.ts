import { describe, expect, it } from '@jest/globals'
import { normalizeCustomPairingCode, normalizePairingPhone, PairingInputError } from '../../Utils/auth-flow'

describe('normalizePairingPhone', () => {
	it('menerima format internasional dan membuang simbol', () => {
		expect(normalizePairingPhone('+62 812-3456-7890')).toBe('6281234567890')
	})
	it('menolak kosong, format lokal, dan panjang salah', () => {
		expect(() => normalizePairingPhone('')).toThrow(PairingInputError)
		expect(() => normalizePairingPhone('081234567890')).toThrow(/format lokal/)
		expect(() => normalizePairingPhone('62123')).toThrow(/tidak valid/)
		expect(() => normalizePairingPhone('1'.repeat(16))).toThrow(PairingInputError)
	})
})

describe('normalizeCustomPairingCode', () => {
	it('uppercase dan menerima 8 karakter', () => {
		expect(normalizeCustomPairingCode('keygtnmd')).toEqual({ code: 'KEYGTNMD', nonStandardChars: [] })
	})
	it('menandai karakter di luar alfabet Crockford', () => {
		expect(normalizeCustomPairingCode('KEY0GTNM').nonStandardChars).toEqual(['0'])
	})
	it('menolak panjang salah dan karakter ilegal (tidak membuang diam-diam)', () => {
		expect(() => normalizeCustomPairingCode('KEY')).toThrow(/tepat 8/)
		expect(() => normalizeCustomPairingCode('KEY-GTNM')).toThrow(/A-Z dan 0-9/)
	})
})
