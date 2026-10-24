#!/usr/bin/env node
/**
 * Memeriksa bahwa KEY BAILEYS tidak bergantung pada "@whiskeysockets/baileys" saat runtime.
 *  1. Statis: tidak ada import/require/export-from ke paket itu di src, Example, WAProto, scripts (kecuali verify-install.sh).
 *  2. package.json: tidak ada di dependencies / optionalDependencies / peerDependencies.
 *  3. Transitif: jika node_modules ada, tidak ada paket terpasang yang mendeklarasikannya sebagai dependensi.
 *     Tanpa node_modules, langkah ini DILAPORKAN "tidak diverifikasi" (exit 2 jika --require-installed).
 * Daftar dependensi pihak ketiga yang masih dipakai runtime dicetak agar transparan.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const TARGET = '@whiskeysockets/baileys'
const requireInstalled = process.argv.includes('--require-installed')
const root = new URL('..', import.meta.url).pathname
let failed = false

const walk = (dir, out = []) => {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === 'lib' || name.startsWith('.')) continue
		const full = join(dir, name)
		statSync(full).isDirectory() ? walk(full, out) : out.push(full)
	}
	return out
}

// 1. statis
const importRe = new RegExp(`(?:from\\s+|import\\s*\\(\\s*|require\\s*\\(\\s*|import\\s+)['"]${TARGET.replace(/[/@]/g, c => '\\' + c)}(?:/[^'"]*)?['"]`)
const codeExt = new Set(['.ts', '.mts', '.js', '.mjs', '.cjs'])
const hits = []
for (const dir of ['src', 'Example', 'WAProto', 'scripts', 'proto-extract']) {
	const p = join(root, dir)
	if (!existsSync(p)) continue
	for (const f of walk(p)) {
		if (!codeExt.has(extname(f)) || f.endsWith('check-independence.mjs')) continue
		const lines = readFileSync(f, 'utf8').split('\n')
		lines.forEach((l, i) => importRe.test(l) && hits.push(`${f.replace(root, '')}:${i + 1}`))
	}
}
console.log(hits.length ? `GAGAL  import runtime ke ${TARGET}:\n  ${hits.join('\n  ')}` : `OK     tidak ada import/require ke ${TARGET} di source`)
failed ||= hits.length > 0

// 2. package.json
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const declared = ['dependencies', 'optionalDependencies', 'peerDependencies'].filter(k => pkg[k]?.[TARGET])
console.log(declared.length ? `GAGAL  ${TARGET} dideklarasikan di: ${declared.join(', ')}` : `OK     ${TARGET} tidak ada di dependencies/peer/optional`)
failed ||= declared.length > 0
console.log(`INFO   nama paket ini: ${pkg.name} (nama dipertahankan demi kompatibilitas import pengguna; ini BUKAN dependensi)`)

// 3. transitif
const nm = join(root, 'node_modules')
if (existsSync(nm)) {
	const offenders = []
	const scan = d => {
		for (const name of readdirSync(d)) {
			const dirs = name.startsWith('@') ? readdirSync(join(d, name)).map(n => join(d, name, n)) : [join(d, name)]
			for (const pd of dirs) {
				const pj = join(pd, 'package.json')
				if (!existsSync(pj)) continue
				try {
					const j = JSON.parse(readFileSync(pj, 'utf8'))
					for (const k of ['dependencies', 'optionalDependencies', 'peerDependencies'])
						if (j[k]?.[TARGET]) offenders.push(`${j.name} (${k})`)
				} catch {}
			}
		}
	}
	scan(nm)
	console.log(offenders.length ? `GAGAL  dependensi transitif memuat ${TARGET}: ${offenders.join(', ')}` : 'OK     tidak ada dependensi transitif ke ' + TARGET)
	failed ||= offenders.length > 0
} else {
	console.log('SKIP   node_modules tidak ada -> dependensi transitif TIDAK diverifikasi (jalankan npm install lalu ulangi)')
	if (requireInstalled) process.exit(2)
}

console.log('\nDependensi pihak ketiga runtime (dari package.json):')
for (const [n, v] of Object.entries(pkg.dependencies ?? {})) console.log(`  - ${n}@${v}`)
process.exit(failed ? 1 : 0)
