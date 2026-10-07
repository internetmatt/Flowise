import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const require = createRequire(import.meta.url)
// The API lives in the diagram bundle. Its worker must be ELK's raw worker,
// not another bundled client (which cannot construct its fake Worker here).
const elkPath = require.resolve('elkjs/lib/elk-worker.min.js')

mkdirSync(dist, { recursive: true })
copyFileSync(elkPath, resolve(dist, 'elk.worker.js'))
