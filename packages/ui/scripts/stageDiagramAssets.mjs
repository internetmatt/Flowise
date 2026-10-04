import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export function stageDiagramAssets(dist, target) {
    if (!existsSync(resolve(dist, 'diagram.js'))) throw new Error('Missing diagram bundle; build @openideas/diagram before flowise-ui')
    cpSync(dist, target, { recursive: true })
}
