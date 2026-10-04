import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const require = createRequire(import.meta.url)
const elkPath = require.resolve('elkjs/lib/elk.bundled.js')

mkdirSync(dist, { recursive: true })
copyFileSync(elkPath, resolve(dist, 'elk-bundled.js'))
writeFileSync(
    resolve(dist, 'elk.worker.js'),
    `/* ELK layout worker. Loaded by the diagram bundle; not part of the Flowise UI graph. */
importScripts(new URL('./elk-bundled.js', self.location.href).href)
const elk = new ELK()
self.onmessage = async (event) => {
  try {
    const result = await elk.layout(event.data)
    self.postMessage({ ok: true, result })
  } catch (error) {
    self.postMessage({ ok: false, error: error && error.message ? error.message : String(error) })
  }
}
`
)
