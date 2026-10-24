// @ts-nocheck
/* eslint-disable */
import { buildInteractiveButtonsContent, hasInteractiveButtons, normalizeInteractiveButtons, withInteractiveNodes } from '../../Utils/interactive'

const prep = async () => ({ imageMessage: { url: 'u', mimetype: 'image/jpeg' } })
const wrapped = {
	viewOnceMessage: { message: { interactiveMessage: { nativeFlowMessage: { buttons: [{ name: 'quick_reply' }, { name: 'cta_url' }] } } } }
}

describe('interactive buttons', () => {
	it('membangun interactiveMessage berfoto dari interactiveButtons', async () => {
		const c = await buildInteractiveButtonsContent(
			{
				image: Buffer.from('x'),
				caption: 'Halo',
				footer: 'KEY MD',
				interactiveButtons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Menu', id: '.menu' }) }],
				mentions: ['1@s.whatsapp.net'],
				contextInfo: { isForwarded: true }
			},
			{},
			prep
		)
		const im = c.viewOnceMessage.message.interactiveMessage
		expect(im.body.text).toBe('Halo')
		expect(im.footer.text).toBe('KEY MD')
		expect(im.nativeFlowMessage.buttons).toHaveLength(1)
		expect(im.header.hasMediaAttachment).toBe(true)
		expect(im.header.imageMessage).toBeTruthy()
		expect(im.contextInfo).toEqual({ isForwarded: true, mentionedJid: ['1@s.whatsapp.net'] })
	})

	it('tanpa media tidak membuat header dan JSON-kan parameter objek', async () => {
		const c = await buildInteractiveButtonsContent(
			{ text: 'Pilih', interactiveButtons: [{ name: 'single_select', buttonParamsJson: { title: 'Menu', sections: [] } }] },
			{},
			prep
		)
		const im = c.viewOnceMessage.message.interactiveMessage
		expect(im.header).toBeUndefined()
		expect(typeof im.nativeFlowMessage.buttons[0].buttonParamsJson).toBe('string')
	})

	it('mengonversi format tombol lama dan menolak tombol kosong', async () => {
		const b = normalizeInteractiveButtons([{ buttonId: 'a', buttonText: { displayText: 'Ya' } }, { rusak: true }, null])
		expect(b).toHaveLength(1)
		expect(b[0].name).toBe('quick_reply')
		await expect(buildInteractiveButtonsContent({ interactiveButtons: [{ x: 1 }] }, {}, prep)).rejects.toThrow(/kosong atau formatnya salah/)
		expect(hasInteractiveButtons({ interactiveButtons: [] })).toBe(false)
	})

	it('menambah node biz (+bot di chat pribadi) hanya bila perlu', () => {
		expect(withInteractiveNodes(wrapped, [], { isGroup: false }).map((n) => n.tag)).toEqual(['biz', 'bot'])
		expect(withInteractiveNodes(wrapped, undefined, { isGroup: true }).map((n) => n.tag)).toEqual(['biz'])
		expect(withInteractiveNodes({ listMessage: {} }, [], { isGroup: true })[0].content[0].tag).toBe('list')
		expect(withInteractiveNodes({ conversation: 'hi' }, [], {})).toEqual([])
		expect(withInteractiveNodes(wrapped, [], { isStatus: true })).toEqual([])
		expect(withInteractiveNodes(wrapped, [], { isNewsletter: true })).toEqual([])
		expect(withInteractiveNodes(wrapped, [{ tag: 'biz', attrs: {} }], {})).toHaveLength(1)
	})
})
