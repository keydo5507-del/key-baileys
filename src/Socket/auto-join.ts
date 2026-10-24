import type { AutoJoinChannelConfig, AutoJoinState } from '../Utils/auto-join-channel'
import { runAutoJoin } from '../Utils/auto-join-channel'

/** potongan socket yang dibutuhkan; dibuat longgar agar mudah diuji dengan objek tiruan */
export type AutoJoinSocket = {
	ev: {
		on: (event: 'connection.update', listener: (update: any) => void) => void
		emit: (event: any, data: any) => any
	}
	authState: { creds: { me?: unknown; autoJoinState?: AutoJoinState } }
	newsletterFollow: (jid: string) => Promise<unknown>
	newsletterMetadata: (type: 'invite' | 'jid', key: string) => Promise<{ id?: string } | null>
}

type Logger = { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void }

/** batas tunggu `receivedPendingNotifications` sebelum lanjut tetap (ms) */
const READY_WAIT_MS = 15_000

/**
 * Memasang auto-join channel ke socket.
 *
 * Dipicu saat koneksi 'open' pada sesi yang sudah punya identitas (creds.me). Setelah login baru lewat
 * QR / pairing code, WhatsApp memutus koneksi lalu socket baru dibuat (login ulang memakai sesi tersimpan);
 * auto-join berjalan pada socket baru itu, sehingga berlaku sama untuk kedua metode login.
 * Hanya berjalan sekali per instance socket. Tidak pernah melempar error ke koneksi utama.
 */
export const attachAutoJoinChannel = (sock: AutoJoinSocket, config: AutoJoinChannelConfig | undefined, logger: Logger) => {
	if (!config?.enabled) {
		return
	}

	if (!config.channels?.length) {
		logger.warn({}, 'autoJoinChannel aktif tetapi daftar channels kosong; diabaikan')
		return
	}

	logger.info({ channels: config.channels }, 'auto-join channel aktif: akun akan mengikuti channel ini setelah login (matikan dengan autoJoinChannel: { enabled: false })')

	let active = false
	let started = false
	let ready = false
	let readyWaiter: (() => void) | undefined

	sock.ev.on('connection.update', update => {
		try {
			if (update.receivedPendingNotifications) {
				ready = true
				readyWaiter?.()
			}

			if (update.connection === 'close') {
				active = false
				readyWaiter?.()
				return
			}

			if (update.connection !== 'open' || started || !sock.authState.creds.me) {
				return
			}

			started = true
			active = true
			void start()
		} catch (err) {
			logger.warn({ err }, 'auto-join: error pada handler connection.update')
		}
	})

	const start = async () => {
		try {
			if (!ready) {
				await new Promise<void>(resolve => {
					readyWaiter = resolve
					setTimeout(resolve, READY_WAIT_MS)
				})
			}

			await new Promise(resolve => setTimeout(resolve, Math.max(0, config.delayMs ?? 3000)))
			if (!active) {
				return
			}

			await runAutoJoin(config, {
				follow: jid => sock.newsletterFollow(jid),
				resolveInvite: code => sock.newsletterMetadata('invite', code),
				getState: () => sock.authState.creds.autoJoinState,
				saveState: state => {
					sock.authState.creds.autoJoinState = state
					sock.ev.emit('creds.update', { autoJoinState: state })
				},
				emit: event => {
					sock.ev.emit('channel.autojoin', event)
				},
				isActive: () => active,
				logger
			})
		} catch (err) {
			// runAutoJoin tidak melempar; ini hanya jaring pengaman agar koneksi utama tidak terganggu
			logger.warn({ err }, 'auto-join: error tak terduga')
		}
	}
}
