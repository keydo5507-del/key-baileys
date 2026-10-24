/**
 * Logika auto-join channel (newsletter) setelah login berhasil.
 *
 * Modul ini sengaja tidak punya dependensi runtime: semua aksi jaringan disuntik lewat `AutoJoinDeps`,
 * sehingga mudah diuji tanpa koneksi WhatsApp. Pemasangan ke socket ada di `src/Socket/auto-join.ts`.
 *
 * Jaminan:
 * - tidak pernah melempar error ke pemanggil (kegagalan hanya dicatat sebagai hasil/event)
 * - tidak pernah mengklaim "joined" kecuali `follow` selesai tanpa error dari server
 * - jumlah percobaan dibatasi, dan channel yang sudah joined / menyerah tidak diulang
 */

export type AutoJoinChannelConfig = {
	/** aktifkan auto-join; default false */
	enabled?: boolean
	/**
	 * Daftar channel tujuan. Format yang diterima:
	 * - JID channel: `120363xxxxxxxxxxxx@newsletter`
	 * - link: `https://whatsapp.com/channel/<kode>`
	 * - kode undangan saja: `<kode>`
	 */
	channels?: string[]
	/** jeda sebelum mulai setelah koneksi siap (ms); default 3000 */
	delayMs?: number
	/** maksimal percobaan per channel dalam satu sesi; default 3 */
	maxAttempts?: number
	/** jeda dasar antar percobaan (ms), dikali nomor percobaan; default 5000 */
	retryDelayMs?: number
	/** coba lagi channel yang sebelumnya menyerah (gave_up) saat restart; default false */
	retryGivenUpOnRestart?: boolean
}

export type AutoJoinStatus = 'started' | 'joined' | 'failed' | 'skipped' | 'completed'

export type AutoJoinResult = {
	/** referensi persis seperti yang dikonfigurasi */
	channel: string
	/** JID channel jika berhasil di-resolve */
	jid?: string
	status: 'joined' | 'failed' | 'skipped'
	attempts: number
	/** alasan skip atau pesan error terakhir */
	reason?: string
}

export type AutoJoinEvent = {
	status: AutoJoinStatus
	channel?: string
	jid?: string
	attempts?: number
	reason?: string
	/** hanya ada pada status 'completed' */
	results?: AutoJoinResult[]
}

/** state yang disimpan di creds agar tidak diulang setelah restart */
export type AutoJoinState = Record<string, 'joined' | 'gave_up'>

export type AutoJoinDeps = {
	/** ikuti channel; harus reject jika server menolak */
	follow: (jid: string) => Promise<unknown>
	/** ubah kode undangan menjadi metadata channel (berisi id) */
	resolveInvite: (code: string) => Promise<{ id?: string } | null | undefined>
	getState: () => AutoJoinState | undefined
	saveState: (state: AutoJoinState) => void
	emit: (event: AutoJoinEvent) => void
	/** false jika koneksi sudah tertutup; menghentikan proses tanpa error */
	isActive: () => boolean
	logger?: {
		info: (obj: unknown, msg?: string) => void
		warn: (obj: unknown, msg?: string) => void
	}
	/** untuk pengujian */
	sleep?: (ms: number) => Promise<void>
}

export type ChannelRef = { type: 'jid'; jid: string } | { type: 'invite'; code: string }

const NEWSLETTER_JID = /^\d+@newsletter$/
const INVITE_CODE = /^[A-Za-z0-9_-]{10,}$/
const CHANNEL_URL = /^(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/i

/** Mengenali referensi channel; mengembalikan null jika formatnya tidak valid. */
export const parseChannelRef = (ref: unknown): ChannelRef | null => {
	const value = String(ref ?? '').trim()
	if (!value) {
		return null
	}

	if (NEWSLETTER_JID.test(value)) {
		return { type: 'jid', jid: value }
	}

	const url = CHANNEL_URL.exec(value)
	if (url?.[1]) {
		return { type: 'invite', code: url[1] }
	}

	if (INVITE_CODE.test(value)) {
		return { type: 'invite', code: value }
	}

	return null
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const errMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

/**
 * Menjalankan auto-join untuk seluruh channel pada konfigurasi.
 * Tidak pernah melempar error.
 */
export const runAutoJoin = async (config: AutoJoinChannelConfig, deps: AutoJoinDeps): Promise<AutoJoinResult[]> => {
	const results: AutoJoinResult[] = []
	const maxAttempts = Math.max(1, config.maxAttempts ?? 3)
	const retryDelayMs = Math.max(0, config.retryDelayMs ?? 5000)
	const sleep = deps.sleep ?? defaultSleep
	const channels = [...new Set((config.channels ?? []).map(c => String(c).trim()).filter(Boolean))]

	try {
		deps.emit({ status: 'started' })
	} catch {}

	// salinan lokal agar update state tidak memodifikasi objek milik creds secara langsung
	const state: AutoJoinState = { ...(deps.getState() ?? {}) }

	const safeEmit = (event: AutoJoinEvent) => {
		try {
			deps.emit(event)
		} catch (err) {
			deps.logger?.warn({ err }, 'listener auto-join melempar error')
		}
	}

	for (const channel of channels) {
		if (!deps.isActive()) {
			results.push({ channel, status: 'skipped', attempts: 0, reason: 'koneksi tertutup sebelum proses selesai' })
			continue
		}

		const ref = parseChannelRef(channel)
		if (!ref) {
			const result: AutoJoinResult = {
				channel,
				status: 'failed',
				attempts: 0,
				reason: 'format channel tidak valid (gunakan JID @newsletter, link channel, atau kode undangan)'
			}
			results.push(result)
			safeEmit({ status: 'failed', channel, attempts: 0, reason: result.reason })
			continue
		}

		const stateKey = ref.type === 'jid' ? ref.jid : `invite:${ref.code}`
		const previous = state[stateKey]
		if (previous === 'joined') {
			results.push({ channel, jid: ref.type === 'jid' ? ref.jid : undefined, status: 'skipped', attempts: 0, reason: 'sudah pernah bergabung (tersimpan di sesi)' })
			safeEmit({ status: 'skipped', channel, reason: 'sudah pernah bergabung (tersimpan di sesi)' })
			continue
		}

		if (previous === 'gave_up' && !config.retryGivenUpOnRestart) {
			results.push({ channel, status: 'skipped', attempts: 0, reason: 'percobaan sebelumnya gagal berulang; set retryGivenUpOnRestart untuk mencoba lagi' })
			safeEmit({ status: 'skipped', channel, reason: 'percobaan sebelumnya gagal berulang' })
			continue
		}

		let attempts = 0
		let lastError = ''
		let jid = ref.type === 'jid' ? ref.jid : undefined
		let joined = false

		while (attempts < maxAttempts && deps.isActive()) {
			attempts++
			try {
				if (!jid && ref.type === 'invite') {
					const meta = await deps.resolveInvite(ref.code)
					if (!meta?.id) {
						throw new Error('channel tidak ditemukan dari kode undangan')
					}

					jid = meta.id
				}

				await deps.follow(jid!)
				joined = true
				break
			} catch (err) {
				lastError = errMessage(err)
				deps.logger?.warn({ channel, attempt: attempts, err: lastError }, 'auto-join channel gagal')
				if (attempts < maxAttempts && deps.isActive()) {
					await sleep(retryDelayMs * attempts)
				}
			}
		}

		if (joined) {
			state[stateKey] = 'joined'
			if (jid) {
				state[jid] = 'joined'
			}

			deps.saveState({ ...state })
			results.push({ channel, jid, status: 'joined', attempts })
			safeEmit({ status: 'joined', channel, jid, attempts })
			continue
		}

		if (!deps.isActive()) {
			results.push({ channel, jid, status: 'skipped', attempts, reason: 'koneksi tertutup sebelum proses selesai' })
			continue
		}

		state[stateKey] = 'gave_up'
		deps.saveState({ ...state })
		results.push({ channel, jid, status: 'failed', attempts, reason: lastError })
		safeEmit({ status: 'failed', channel, jid, attempts, reason: lastError })
	}

	safeEmit({ status: 'completed', results })
	deps.logger?.info({ results }, 'auto-join channel selesai')
	return results
}
