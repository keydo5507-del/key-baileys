/* eslint-disable */
// @ts-nocheck
/**
 * KEY BAILEYS — dukungan tombol WhatsApp + kompatibilitas SC
 *
 * Format yang didukung di sendMessage:
 *  1. interactiveButtons  → native flow (quick_reply, cta_url, cta_copy, cta_call, single_select)
 *  2. buttons             → format lama { buttonId, buttonText: { displayText } }
 *  3. templateButtons     → quickReplyButton / urlButton / callButton / copyButton
 *  4. sections + buttonText → list / single_select
 *
 * Node `biz` (+ `bot` di chat pribadi) ditambahkan otomatis di relayMessage
 * agar tombol tampil di akun WhatsApp biasa (bukan hanya Business).
 */

const WRAPPERS = [
	'viewOnceMessage',
	'viewOnceMessageV2',
	'viewOnceMessageV2Extension',
	'ephemeralMessage',
	'documentWithCaptionMessage',
	'editedMessage'
]

const PAYMENT_BUTTONS = new Set([
	'review_and_pay',
	'review_order',
	'payment_info',
	'payment_status',
	'payment_method',
	'wa_payment_learn_more'
])

/** Buka lapisan pembungkus sampai isi pesan yang sebenarnya */
export const unwrapMessageContent = (message: any) => {
	let m = message
	for (let i = 0; i < 6 && m; i++) {
		const k = WRAPPERS.find(w => m[w]?.message)
		if (!k) break
		m = m[k].message
	}
	return m
}

const asJson = (v: any) => (typeof v === 'string' ? v : JSON.stringify(v ?? {}))

/**
 * Samakan segala format tombol SC → { name, buttonParamsJson }
 * - interactiveButtons native
 * - buttons lama (buttonId + buttonText)
 * - templateButtons (quickReply / url / call / copy)
 * - object sederhana { id, text } / { display_text, id }
 */
export const normalizeInteractiveButtons = (buttons: any[]) =>
	(Array.isArray(buttons) ? buttons : [])
		.map(b => {
			if (!b || typeof b !== 'object') return null

			// Native flow sudah benar
			if (typeof b.name === 'string') {
				return { name: b.name, buttonParamsJson: asJson(b.buttonParamsJson) }
			}

			// Format lama Baileys / SC: { buttonId, buttonText: { displayText } }
			if (b.buttonId != null && (b.buttonText?.displayText || b.buttonText?.display_text || b.displayText)) {
				const text = b.buttonText?.displayText || b.buttonText?.display_text || b.displayText
				return {
					name: 'quick_reply',
					buttonParamsJson: JSON.stringify({ display_text: String(text), id: String(b.buttonId) })
				}
			}

			// { id, text } / { display_text, id }
			if ((b.id || b.buttonId) && (b.text || b.display_text || b.displayText)) {
				return {
					name: 'quick_reply',
					buttonParamsJson: JSON.stringify({
						display_text: String(b.text || b.display_text || b.displayText),
						id: String(b.id || b.buttonId)
					})
				}
			}

			// templateButtons style
			if (b.quickReplyButton) {
				const q = b.quickReplyButton
				return {
					name: 'quick_reply',
					buttonParamsJson: JSON.stringify({
						display_text: String(q.displayText || q.display_text || ''),
						id: String(q.id || '')
					})
				}
			}
			if (b.urlButton) {
				const u = b.urlButton
				return {
					name: 'cta_url',
					buttonParamsJson: JSON.stringify({
						display_text: String(u.displayText || u.display_text || 'Buka'),
						url: String(u.url || ''),
						merchant_url: String(u.url || '')
					})
				}
			}
			if (b.callButton) {
				const c = b.callButton
				return {
					name: 'cta_call',
					buttonParamsJson: JSON.stringify({
						display_text: String(c.displayText || c.display_text || 'Panggil'),
						phone_number: String(c.phoneNumber || c.phone_number || '')
					})
				}
			}
			if (b.copyButton) {
				const c = b.copyButton
				return {
					name: 'cta_copy',
					buttonParamsJson: JSON.stringify({
						display_text: String(c.displayText || c.display_text || 'Salin'),
						copy_code: String(c.copyCode || c.copy_code || c.code || '')
					})
				}
			}

			return null
		})
		.filter(Boolean)

/** Apakah content punya tombol / list yang perlu diubah ke interactive? */
export const hasInteractiveButtons = (message: any) => {
	if (!message || typeof message !== 'object') return false
	if (Array.isArray(message.interactiveButtons) && message.interactiveButtons.length > 0) return true
	if (Array.isArray(message.buttons) && message.buttons.length > 0) return true
	if (Array.isArray(message.templateButtons) && message.templateButtons.length > 0) return true
	// list sections (banyak SC pakai ini)
	if (Array.isArray(message.sections) && message.sections.length > 0) return true
	return false
}

/** Kumpulkan tombol dari semua field yang dikenal SC */
const collectButtons = (message: any) => {
	const out: any[] = []
	if (Array.isArray(message.interactiveButtons)) out.push(...message.interactiveButtons)
	if (Array.isArray(message.buttons)) out.push(...message.buttons)
	if (Array.isArray(message.templateButtons)) out.push(...message.templateButtons)
	return normalizeInteractiveButtons(out)
}

/** Bangun single_select dari sections (list message gaya SC) */
const buildSingleSelectFromSections = (message: any) => {
	const sections = (message.sections || []).map((sec: any) => ({
		title: String(sec.title || ''),
		rows: (sec.rows || []).map((r: any) => ({
			header: r.header ? String(r.header) : undefined,
			title: String(r.title || r.rowId || ''),
			description: r.description ? String(r.description) : undefined,
			id: String(r.rowId || r.id || r.title || '')
		}))
	}))
	return {
		name: 'single_select',
		buttonParamsJson: JSON.stringify({
			title: String(message.buttonText || message.title || 'Pilih'),
			sections
		})
	}
}

/**
 * Bangun isi pesan interaktif dari interactiveButtons / buttons / templateButtons / sections.
 * prepareMedia = prepareWAMessageMedia
 */
export const buildInteractiveButtonsContent = async (message: any, options: any, prepareMedia: any) => {
	let buttons = collectButtons(message)

	// List sections → single_select native flow
	if (Array.isArray(message.sections) && message.sections.length > 0) {
		buttons = [...buttons, buildSingleSelectFromSections(message)]
	}

	if (!buttons.length) throw new Error('Tidak ada tombol / sections yang valid')

	const header: any = {}
	if (typeof message.header === 'string') header.title = message.header
	else if (message.header && typeof message.header === 'object') Object.assign(header, message.header)
	if (message.title) header.title = message.title
	if (message.subtitle) header.subtitle = message.subtitle

	const mediaKey = ['image', 'video', 'document'].find(k => message[k])
	if (mediaKey) {
		const media = await prepareMedia(
			{
				[mediaKey]: message[mediaKey],
				mimetype: message.mimetype,
				fileName: message.fileName,
				jpegThumbnail: message.jpegThumbnail
			},
			options
		)
		Object.assign(header, media)
		header.hasMediaAttachment = true
	} else {
		header.hasMediaAttachment = false
	}

	const bodyText = String(
		message.caption ?? message.text ?? message.contentText ?? message.body ?? ''
	)

	const interactiveMessage: any = {
		body: { text: bodyText },
		nativeFlowMessage: {
			buttons,
			messageParamsJson: message.messageParamsJson ?? JSON.stringify({ from: 'key-baileys' })
		}
	}
	if (message.footer || message.footerText) {
		interactiveMessage.footer = { text: String(message.footer || message.footerText) }
	}
	if (header.title || header.subtitle || mediaKey) interactiveMessage.header = header

	let contextInfo = message.contextInfo ? { ...message.contextInfo } : undefined
	if (message.mentions?.length) contextInfo = { ...contextInfo, mentionedJid: message.mentions }
	if (contextInfo) interactiveMessage.contextInfo = contextInfo

	// Bungkus viewOnce agar native flow lebih stabil di banyak klien WA
	return {
		viewOnceMessage: {
			message: {
				messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
				interactiveMessage
			}
		}
	}
}

/**
 * Tambah node `biz` (+ `bot` di chat pribadi) agar tombol/list tampil di akun biasa.
 * Tanpa node ini, banyak klien WA menampilkan "pesan tidak didukung".
 */
export const withInteractiveNodes = (
	message: any,
	existing: any[] | undefined,
	ctx: { isGroup?: boolean; isStatus?: boolean; isNewsletter?: boolean } = {}
) => {
	const nodes = existing ? [...existing] : []
	if (ctx.isNewsletter || ctx.isStatus) return nodes
	if (nodes.some(n => n?.tag === 'biz')) return nodes

	const inner = unwrapMessageContent(message) || {}
	let biz: any = null

	if (inner.interactiveMessage) {
		const flow = inner.interactiveMessage.nativeFlowMessage?.buttons || []
		const names = flow.map((b: any) => b?.name).filter(Boolean)
		const single = flow.length === 1 ? names[0] : ''
		const flowName = PAYMENT_BUTTONS.has(single) ? single : names.includes('single_select') ? 'single_select' : 'mixed'

		biz = {
			tag: 'biz',
			attrs: { interactive: 'native_flow' },
			content: [
				{
					tag: 'interactive',
					attrs: { type: 'native_flow', v: '1' },
					content: [
						{
							tag: 'native_flow',
							attrs: { v: '9', name: flowName }
						}
					]
				}
			]
		}
	} else if (inner.listMessage) {
		biz = {
			tag: 'biz',
			attrs: {},
			content: [{ tag: 'list', attrs: { v: '2', type: 'product_list' } }]
		}
	} else if (inner.buttonsMessage) {
		// Legacy buttons — tetap inject biz biar lebih sering tampil
		biz = {
			tag: 'biz',
			attrs: {},
			content: [
				{
					tag: 'interactive',
					attrs: { type: 'native_flow', v: '1' },
					content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
				}
			]
		}
	}

	if (!biz) return nodes

	nodes.push(biz)
	// Chat pribadi: node bot membantu tombol tampil di akun non-Business
	if (!ctx.isGroup && !nodes.some(n => n?.tag === 'bot')) {
		nodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })
	}
	return nodes
}
