import { describe, expect, it } from '@jest/globals'
import { attachAutoJoinChannel } from '../../Socket/auto-join'

const JID = '120363111111111111@newsletter'
const logger = { info: () => {}, warn: () => {} }

const makeSock = (follow = async (_: string): Promise<unknown> => ({})) => {
	const listeners: Array<(u: any) => void> = []
	const emitted: Array<[string, any]> = []
	const creds: any = { me: { id: '1@s.whatsapp.net' } }
	const sock = {
		ev: { on: (_: string, l: (u: any) => void) => void listeners.push(l), emit: (e: string, d: any) => void emitted.push([e, d]) },
		authState: { creds },
		newsletterFollow: follow,
		newsletterMetadata: async () => ({ id: JID })
	}
	const fire = (u: any) => listeners.forEach(l => l(u))
	return { sock, fire, emitted, creds }
}
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms))

describe('attachAutoJoinChannel', () => {
	it('nonaktif secara default: tidak memasang listener', () => {
		const { sock, fire, emitted } = makeSock()
		attachAutoJoinChannel(sock, { channels: [JID] }, logger)
		fire({ connection: 'open', receivedPendingNotifications: true })
		expect(emitted).toHaveLength(0)
	})

	it('berjalan sekali per socket walau connection.update open berulang', async () => {
		let calls = 0
		const { sock, fire, emitted, creds } = makeSock(async () => void calls++)
		attachAutoJoinChannel(sock, { enabled: true, channels: [JID], delayMs: 0 }, logger)
		fire({ receivedPendingNotifications: true })
		fire({ connection: 'open' })
		fire({ connection: 'open' })
		await tick()
		expect(calls).toBe(1)
		expect(creds.autoJoinState[JID]).toBe('joined')
		expect(emitted.some(([e, d]) => e === 'channel.autojoin' && d.status === 'completed')).toBe(true)
	})

	it('tidak berjalan tanpa identitas login (creds.me)', async () => {
		let calls = 0
		const { sock, fire, creds } = makeSock(async () => void calls++)
		creds.me = undefined
		attachAutoJoinChannel(sock, { enabled: true, channels: [JID], delayMs: 0 }, logger)
		fire({ receivedPendingNotifications: true, connection: 'open' })
		await tick()
		expect(calls).toBe(0)
	})

	it('follow gagal tidak melempar dan tidak mencatat joined', async () => {
		const { sock, fire, emitted, creds } = makeSock(async () => {
			throw new Error('ditolak')
		})
		attachAutoJoinChannel(sock, { enabled: true, channels: [JID], delayMs: 0, maxAttempts: 1 }, logger)
		fire({ receivedPendingNotifications: true, connection: 'open' })
		await tick()
		expect(creds.autoJoinState[JID]).toBe('gave_up')
		expect(emitted.some(([, d]) => d.status === 'joined')).toBe(false)
	})
})
