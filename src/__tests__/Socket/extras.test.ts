// @ts-nocheck
/* eslint-disable */
import { attachBotExtras, renderMonoTable } from '../../Socket/extras'

const makeSock = () => {
	const sent: any[] = []
	const sock: any = {
		sendMessage: async (jid, c, o) => (sent.push({ jid, c, o }), { key: { id: 'ID1' } }),
		newsletterMetadata: async (t, k) => ({ id: '120@newsletter', name: 'Kanal', description: 'D', subscribers: 42, _q: [t, k] })
	}
	attachBotExtras(sock)
	return { sock, sent }
}

describe('fungsi bantu bot (extras)', () => {
	it('tidak menimpa fungsi yang sudah ada', () => {
		const s: any = { sendTable: () => 'asli', sendMessage() {} }
		attachBotExtras(s)
		expect(s.sendTable()).toBe('asli')
	})

	it('sendTable & sendTableV2 menghasilkan tabel monospace', async () => {
		const { sock, sent } = makeSock()
		await sock.sendTable('g', 'Aturan', ['No', 'Rule'], [['1', 'Jangan spam']], { key: 1 }, { footer: 'Patuhi!' })
		expect(sent.at(-1).c.text).toMatch(/Jangan spam/)
		expect(sent.at(-1).c.text).toMatch(/_Patuhi!_/)
		expect(sent.at(-1).o.quoted.key).toBe(1)
		await sock.sendTableV2('g', ['Platform | linux;;Node | v22'], null, { title: 'Stat' })
		expect(sent.at(-1).c.text).toMatch(/Node\s+│ v22/)
		await sock.sendTableV2('g', ['Harga', 'Item | Rp', 'Kopi | 10rb'], null, {})
		expect(sent.at(-1).c.text).toMatch(/\*Harga\*/)
		expect(renderMonoTable([])).toBe('')
	})

	it('sendCodeBlock, sendList, sendLinkV2, sendPreview', async () => {
		const { sock, sent } = makeSock()
		await sock.sendCodeBlock('g', 'const a=1', null)
		expect(sent.at(-1).c.text).toMatch(/```\nconst a=1\n```/)
		await sock.sendList('g', 'Daftar', [['Satu', 'a'], ['Dua']], null, {})
		expect(sent.at(-1).c.text).toMatch(/1\. Satu — a\n2\. Dua/)
		await sock.sendLinkV2('g', 'Baca', [{ url: 'https://a.id', displayName: 'A' }], null, {})
		expect(sent.at(-1).c.text).toMatch(/A: https:\/\/a\.id/)
		const id = await sock.sendPreview('g', { caption: 'c', url: 'https://k.id', title: 'T', description: 'D' }, { contextInfo: { isForwarded: true } })
		expect(id).toBe('ID1')
		expect(sent.at(-1).c.contextInfo.externalAdReply.sourceUrl).toBe('https://k.id')
		expect(sent.at(-1).c.contextInfo.isForwarded).toBe(true)
	})

	it('newsletterMsg memilih jid / invite dan memakai bentuk thread_metadata', async () => {
		const { sock } = makeSock()
		const r = await sock.newsletterMsg('120@newsletter')
		expect(r._q).toEqual(['jid', '120@newsletter'])
		expect(r.thread_metadata.name.text).toBe('Kanal')
		expect((await sock.newsletterMsg('AbC123'))._q).toEqual(['invite', 'AbC123'])
	})
})
