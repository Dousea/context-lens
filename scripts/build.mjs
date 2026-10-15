import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { build } from 'esbuild'

// Claude Code before 2.1.299 follows `$` only into functions of the module's own file, so the mod ships as one file.
const OUT = 'hooks/dist/register.tsx'

const result = await build({
  entryPoints: ['hooks/register.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['claude-code'],
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  charset: 'utf8',
  banner: {
    js: '// @ts-nocheck\n// Built by `npm run build` from hooks/register.tsx and what it imports. Do not edit.',
  },
  write: false,
})
const built = result.outputFiles[0].text

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {}
  if (current !== built) {
    console.error(`${OUT} is out of date: run npm run build`)
    process.exit(1)
  }
} else {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, built)
}
