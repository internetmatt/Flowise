import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stageDiagramAssets } from './stageDiagramAssets.mjs'

test('UI declares the diagram workspace dependency used by Turbo ^build', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
    assert.equal(pkg.devDependencies['@openideas/diagram'], 'workspace:*')
    const turbo = JSON.parse(readFileSync(new URL('../../../turbo.json', import.meta.url)))
    assert.ok(turbo.pipeline['flowise-ui#build'].dependsOn.includes('^build'))
    assert.deepEqual(turbo.pipeline['flowise-ui#build'].outputs, ['build/**'])
})

test('staging fails on missing output and copies diagram assets after build', () => {
    const root = mkdtempSync(join(tmpdir(), 'diagram-assets-'))
    try {
        const dist = join(root, 'dist'),
            target = join(root, 'ui/diagram-studio')
        assert.throws(() => stageDiagramAssets(dist, target), /Missing diagram bundle/)
        mkdirSync(dist)
        for (const file of ['diagram.js', 'diagram.css', 'mp4-worker.js']) writeFileSync(join(dist, file), file)
        stageDiagramAssets(dist, target)
        for (const file of ['diagram.js', 'diagram.css', 'mp4-worker.js']) assert.equal(readFileSync(join(target, file), 'utf8'), file)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})
