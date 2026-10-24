import { describe, expect, it } from '@jest/globals'
import { hkdf, md5 } from '../../Utils/hkdf'

const hex = (h: string) => Buffer.from(h.replace(/\s/g, ''), 'hex')

describe('hkdf (RFC 5869, SHA-256)', () => {
	it('Test Case 1', () => {
		const out = hkdf(hex('0b'.repeat(22)), 42, { salt: hex('000102030405060708090a0b0c'), info: hex('f0f1f2f3f4f5f6f7f8f9') })
		expect(out.toString('hex')).toBe(
			'3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865'
		)
	})
	it('Test Case 3 (tanpa salt dan info)', () => {
		const out = hkdf(hex('0b'.repeat(22)), 42)
		expect(out.toString('hex')).toBe(
			'8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8'
		)
	})
	it('info string di-encode UTF-8 dan sama dengan Buffer', () => {
		expect(hkdf(Buffer.from('k'), 32, { info: 'adv_secret' }).toString('hex')).toBe(
			hkdf(Buffer.from('k'), 32, { info: Buffer.from('adv_secret') }).toString('hex')
		)
	})
	it('menolak panjang tidak valid', () => {
		expect(() => hkdf(Buffer.from('k'), 8161)).toThrow(RangeError)
		expect(() => hkdf(Buffer.from('k'), -1)).toThrow(RangeError)
	})
})

describe('md5 (RFC 1321)', () => {
	it('vektor uji', () => {
		expect(md5('').toString('hex')).toBe('d41d8cd98f00b204e9800998ecf8427e')
		expect(md5('abc').toString('hex')).toBe('900150983cd24fb0d6963f7d28e17f72')
		expect(md5(Buffer.from('message digest')).toString('hex')).toBe('f96b697d7cb7938d525a2f31aaf161d0')
	})
})
