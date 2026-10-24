import { describe, expect, it } from '@jest/globals'
import { parseChannelRef, runAutoJoin } from '../../Utils/auto-join-channel'
import type { AutoJoinDeps, AutoJoinEvent, AutoJoinState } from '../../Utils/auto-join-channel'

const JID = '120363111111111111@newsletter'

const makeDeps = (over: Partial<AutoJoinDeps> = {}) => {
	const events: AutoJoinEvent[] = []
	let state: AutoJoinState | undefined
	const deps: AutoJoinDeps = {
		follow: async () => ({}),
		resolveInvite: async () => ({ id: JID }),
		getState: () => state,
		saveState: s => {
			state = s
		},
		emit: e => events.push(e),
		isActive: () => true,
		sleep: async () => {},
		...over
	}
	return { deps, events, getState: () => state }
}

describe('parseChannelRef', () => {
	it('mengenali jid, link, dan kode; menolak sampah', () => {
		expect(parseChannelRef(JID)).toEqual({ type: 'jid', jid: JID })
		expect(parseChannelRef('https://whatsapp.com/channel/0029VaAbCdEfGh')).toEqual({ type: 'invite', code: '0029VaAbCdEfGh' })
		expect(parseChannelRef('0029VaAbCdEfGh')).toEqual({ type: 'invite', code: '0029VaAbCdEfGh' })
		expect(parseChannelRef('https://whatsapp.com/channel/0029Vb9Sx5lEVccMBs0lFb2i')).toEqual({ type: 'invite', code: '0029Vb9Sx5lEVccMBs0lFb2i' })
		expect(parseChannelRef('abc')).toBeNull()
		expect(parseChannelRef('')).toBeNull()
	})
})

describe('runAutoJoin', () => {
	it('berhasil: joined + state tersimpan + event completed', async () => {
		const { deps, events, getState } = makeDeps()
		const res = await runAutoJoin({ channels: [JID] }, deps)
		expect(res[0]).toMatchObject({ status: 'joined', attempts: 1 })
		expect(getState()?.[JID]).toBe('joined')
		expect(events.map(e => e.status)).toEqual(['started', 'joined', 'completed'])
	})

	it('kode undangan di-resolve ke jid sebelum follow', async () => {
		let followed = ''
		const { deps } = makeDeps({ follow: async j => void (followed = j) })
		const res = await runAutoJoin({ channels: ['0029VaAbCdEfGh'] }, deps)
		expect(followed).toBe(JID)
		expect(res[0]?.status).toBe('joined')
	})

	it('gagal berulang: tidak melempar, tidak mengklaim joined, berhenti di maxAttempts, lalu tidak diulang', async () => {
		let calls = 0
		const { deps, events, getState } = makeDeps({
			follow: async () => {
				calls++
				throw new Error('server menolak')
			}
		})
		const res = await runAutoJoin({ channels: [JID], maxAttempts: 3 }, deps)
		expect(calls).toBe(3)
		expect(res[0]).toMatchObject({ status: 'failed', attempts: 3, reason: 'server menolak' })
		expect(events.some(e => e.status === 'joined')).toBe(false)
		expect(getState()?.[JID]).toBe('gave_up')

		// restart: tidak diulang
		const again = await runAutoJoin({ channels: [JID], maxAttempts: 3 }, { ...deps, follow: async () => { calls++ } })
		expect(again[0]?.status).toBe('skipped')
		expect(calls).toBe(3)
	})

	it('channel yang sudah joined dilewati', async () => {
		let calls = 0
		const { deps } = makeDeps({ getState: () => ({ [JID]: 'joined' }), follow: async () => void calls++ })
		const res = await runAutoJoin({ channels: [JID] }, deps)
		expect(res[0]?.status).toBe('skipped')
		expect(calls).toBe(0)
	})

	it('koneksi tertutup di tengah proses: berhenti tanpa error dan tanpa klaim joined', async () => {
		let active = true
		const { deps } = makeDeps({
			follow: async () => {
				active = false
				throw new Error('Connection Closed')
			},
			isActive: () => active
		})
		const res = await runAutoJoin({ channels: [JID, JID.replace('1111', '2222')], maxAttempts: 3 }, deps)
		expect(res.every(r => r.status === 'skipped')).toBe(true)
	})

	it('listener event yang melempar tidak merusak proses', async () => {
		const { deps } = makeDeps({
			emit: e => {
				if (e.status !== 'started') throw new Error('listener rusak')
			}
		})
		const res = await runAutoJoin({ channels: [JID] }, deps)
		expect(res[0]?.status).toBe('joined')
	})

	it('format channel tidak valid dilaporkan failed tanpa panggilan jaringan', async () => {
		let calls = 0
		const { deps } = makeDeps({ follow: async () => void calls++ })
		const res = await runAutoJoin({ channels: ['bukan channel'] }, deps)
		expect(res[0]?.status).toBe('failed')
		expect(calls).toBe(0)
	})
})
