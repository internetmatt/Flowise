#!/usr/bin/env node
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { bindGraphSkill, canonicalJson } from './graph-skills/package.mjs'
import { repositoryExecutors, executorSources } from './graph-skills/executors.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

export async function exportGraphSkill({ graph: graphPath, binding: bindingPath, out }) {
    const graphFile = resolve(root, graphPath)
    const sourcePath = relative(root, graphFile).split('\\').join('/')
    if (sourcePath.startsWith('../') || isAbsolute(sourcePath)) throw new Error('Graph must be a tracked repository file')
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    // Provenance must describe the exact tracked bytes, not a dirty draft attributed to HEAD.
    const files = [sourcePath, ...Object.values(executorSources).map((policy) => policy.source)]
    for (const file of files) {
        const current = await readFile(resolve(root, file))
        const pinned = execFileSync('git', ['show', `${revision}:${file}`], { cwd: root, maxBuffer: 10 * 1024 * 1024 })
        if (!current.equals(pinned)) throw new Error('Graph or executor source differs from the pinned repository revision')
    }
    const graph = JSON.parse(await readFile(graphFile, 'utf8'))
    const binding = JSON.parse(await readFile(resolve(root, bindingPath), 'utf8'))
    const bundle = bindGraphSkill({
        graph,
        binding,
        executors: repositoryExecutors(root),
        source: { repository: 'internetmatt/IdeaFlow', revision, path: sourcePath }
    })
    const destination = resolve(out)
    // Reserve a fresh directory only after all validation succeeds; never overwrite a release.
    await mkdir(destination, { recursive: false })
    try {
        for (const [name, value] of Object.entries({
            'manifest.json': bundle.manifest,
            'graph.json': bundle.graph,
            'SKILL.md': bundle.skillMd,
            'fixtures.json': bundle.fixtures
        })) {
            await writeFile(resolve(destination, name), typeof value === 'string' ? value : `${canonicalJson(value)}\n`, { flag: 'wx' })
        }
    } catch (error) {
        await rm(destination, { recursive: true, force: true })
        throw error
    }
    return bundle.manifest
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const { values } = parseArgs({
            options: {
                graph: { type: 'string', default: 'packages/server/marketplaces/agentflowsv2/Translator.json' },
                binding: { type: 'string', default: 'scripts/graph-skills/translator.binding.json' },
                out: { type: 'string' }
            }
        })
        if (!values.out)
            throw new Error('Usage: pnpm skills:export --out <new-directory> [--graph <tracked-file>] [--binding <binding.json>]')
        const manifest = await exportGraphSkill(values)
        console.log(
            JSON.stringify({ name: manifest.name, version: manifest.version, graphRevision: manifest.graph.revision, liveRun: 'pending' })
        )
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
