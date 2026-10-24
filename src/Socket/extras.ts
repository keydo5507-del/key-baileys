/* eslint-disable */
// @ts-nocheck
/**
 * Fungsi tambahan di socket yang dipakai plugin bot (sendPreview, sendTable, dst).
 * Dibuat sebagai "fallback" teks yang aman: tidak pernah menimpa fungsi yang sudah ada,
 * dan tampil baik di semua versi WhatsApp.
 */

const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - [...s].length))

const toRows = (items: any[]) =>
	items.flatMap(it =>
		Array.isArray(it)
			? [it.map(String)]
			: String(it)
					.split(';;')
					.map(r => r.split('|').map(c => c.trim()))
					.filter(r => r.some(Boolean))
	)

export const renderMonoTable = (rows: string[][]) => {
	const cols = Math.max(0, ...rows.map(r => r.length))
	const w = Array.from({ length: cols }, (_, i) => Math.max(...rows.map(r => [...(r[i] ?? '')].length)))
	const line = (r: string[]) => w.map((x, i) => pad(r[i] ?? '', x)).join(' │ ')
	if (!rows.length) return ''
	const out = [line(rows[0]), w.map(x => '─'.repeat(x)).join('─┼─'), ...rows.slice(1).map(line)]
	return out.join('\n')
}

export const attachBotExtras = <T>(socket: T): T => {
	const sock: any = socket
	const define = (name: string, fn: any) => {
		if (typeof sock[name] !== 'function') sock[name] = fn
	}
	const send = (jid: string, text: string, quoted?: any, options: any = {}) => {
		const { contextInfo, mentions, ...rest } = options || {}
		return sock.sendMessage(jid, { text, linkPreview: null, ...(contextInfo && { contextInfo }), ...(mentions && { mentions }) }, { quoted, ...rest })
	}
	const foot = (f?: string) => (f ? `\n\n_${f}_` : '')

	// sendPreview(jid, {caption,url,title,description,jpegThumbnail,previewType}, options) → id pesan
	define('sendPreview', async (jid: string, info: any = {}, options: any = {}) => {
		const { caption = '', url, title, description, jpegThumbnail, previewType } = info
		const { contextInfo, ...rest } = options || {}
		const res = await sock.sendMessage(
			jid,
			{
				text: caption,
				linkPreview: null,
				contextInfo: {
					...contextInfo,
					externalAdReply: {
						...(contextInfo && contextInfo.externalAdReply),
						title,
						body: description,
						thumbnail: jpegThumbnail,
						sourceUrl: url,
						mediaType: 1,
						renderLargerThumbnail: previewType === 1
					}
				}
			},
			rest
		)
		return res?.key?.id
	})

	// sendTable(jid, title, headers[], rows[][], quoted, {headerText, footer})
	define('sendTable', async (jid: string, title: string, headers: string[], rows: any[][], quoted?: any, opts: any = {}) => {
		const table = renderMonoTable([headers.map(String), ...rows.map(r => r.map(String))])
		const head = opts.headerText ? `${opts.headerText}\n\n` : ''
		return send(jid, `${head}*${title}*\n\n\`\`\`\n${table}\n\`\`\`${foot(opts.footer)}`, quoted, opts.options)
	})

	// sendTableV2(jid, [judul?, header, "a | b;;c | d", ...], quoted, {title, footer})
	define('sendTableV2', async (jid: string, data: any[], quoted?: any, opts: any = {}) => {
		const items = [...(data || [])]
		let title = opts.title
		if (!title && items.length && !String(items[0]).includes('|')) title = String(items.shift())
		const table = renderMonoTable(toRows(items))
		return send(jid, `${title ? `*${title}*\n\n` : ''}\`\`\`\n${table}\n\`\`\`${foot(opts.footer)}`, quoted, opts.options)
	})

	// sendCodeBlock / sendCodeBlockV2(jid, kode, quoted, {title, footer})
	const codeBlock = async (jid: string, code: string, quoted?: any, opts: any = {}) =>
		send(jid, `${opts.title ? `*${opts.title}*\n\n` : ''}\`\`\`\n${String(code)}\n\`\`\`${foot(opts.footer)}`, quoted, opts.options)
	define('sendCodeBlock', codeBlock)
	define('sendCodeBlockV2', codeBlock)

	// sendList(jid, judul, [[kolom,...],...], quoted, {footer})
	define('sendList', async (jid: string, title: string, list: any[], quoted?: any, opts: any = {}) => {
		const lines = (list || []).map((r, i) => `${i + 1}. ${Array.isArray(r) ? r.filter(Boolean).join(' — ') : r}`)
		return send(jid, `*${title}*\n\n${lines.join('\n')}${foot(opts.footer)}`, quoted, opts.options)
	})

	// sendLinkV2(jid, teks, [{url, displayName}], quoted, {footer})
	define('sendLinkV2', async (jid: string, text: string, links: any[], quoted?: any, opts: any = {}) => {
		const lines = (links || []).map(l => `🔗 ${l.displayName || l.sourceDisplayName || 'Link'}: ${l.url}`)
		return send(jid, `${text}\n\n${lines.join('\n')}${foot(opts.footer)}`, quoted, opts.options)
	})

	// newsletterMsg(idAtauInvite) → info channel (bentuk lama: thread_metadata)
	define('newsletterMsg', async (key: string) => {
		const k = String(key)
		const meta = await sock.newsletterMetadata(k.endsWith('@newsletter') ? 'jid' : 'invite', k)
		return {
			...meta,
			state: meta?.state ?? { type: 'ACTIVE' },
			thread_metadata: {
				name: { text: meta?.name },
				description: { text: meta?.description },
				subscribers_count: String(meta?.subscribers ?? 0),
				creation_time: meta?.creation_time,
				verification: meta?.verification
			}
		}
	})

	return socket
}
