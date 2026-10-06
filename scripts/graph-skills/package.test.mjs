import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { bindGraphSkill, canonicalJson, digest, pinSkillInvocation, validateSkillOutput, verifyGraphSkill } from './package.mjs'
import { repositoryExecutors } from './executors.mjs'
import { exportGraphSkill } from '../export-graph-skill.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const graphPath = 'packages/server/marketplaces/agentflowsv2/Translator.json'
const bindingPath = 'scripts/graph-skills/translator.binding.json'
const graph = JSON.parse(await readFile(resolve(root, graphPath), 'utf8'))
const binding = JSON.parse(await readFile(resolve(root, bindingPath), 'utf8'))
const preservation = JSON.parse(await readFile(new URL('./fixtures/preservation.json', import.meta.url), 'utf8'))
const unknownExecutors = JSON.parse(await readFile(new URL('./fixtures/unknown-executors.json', import.meta.url), 'utf8'))
const executors = repositoryExecutors(root)
const source = {
    repository: 'internetmatt/IdeaFlow',
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    path: graphPath
}
const copy = (value) => JSON.parse(JSON.stringify(value))
const bind = (overrides = {}) => bindGraphSkill({ graph: copy(graph), binding: copy(binding), source, executors, ...overrides })

test('binds the actual existing Translator and pins native graph, sources and instructions', () => {
    const bundle = bind()
    assert.deepEqual(bundle.graph, graph)
    assert.equal(bundle.manifest.schemaVersion, 1)
    assert.equal(bundle.manifest.version, '0.1.0')
    assert.equal(bundle.manifest.graph.digest, digest(canonicalJson(graph)))
    assert.equal(bundle.manifest.graph.revision, bundle.manifest.graph.digest)
    assert.deepEqual(bundle.manifest.graph.source, source)
    assert.deepEqual(
        bundle.manifest.executors.map((executor) => executor.name),
        ['chatGoogleGenerativeAI', 'llmAgentflow', 'startAgentflow']
    )
    assert.equal(bundle.manifest.skillMd.digest, digest(bundle.skillMd))
    assert.match(bundle.skillMd, /name: translate-english-to-japanese/)
    assert.ok(bundle.skillMd.includes(bundle.manifest.graph.revision))
    assert.deepEqual(verifyGraphSkill(bundle, executors), bundle)
    assert.equal(bundle.manifest.acceptance.liveRun, 'pending')
})

test('round trips all payloads, metadata, edge handles and nested credential references', () => {
    const native = copy(graph)
    native.nodes[1].data.fixturePayload = preservation.nativePayload
    native.nodes[1].data.credential = 'credential:tenant-fixture/node'
    native.nodes[1].data.inputs.llmModelConfig.FLOWISE_CREDENTIAL_ID = preservation.credentialReference
    Object.assign(native.edges[0].data, preservation.edgePayload)
    native.viewport = { x: 42, y: -30, zoom: 0.75 }
    const bundle = bind({ graph: native })
    const roundtrip = copy(bundle)
    assert.deepEqual(verifyGraphSkill(roundtrip, executors).graph, native)
    assert.equal(roundtrip.graph.edges[0].sourceHandle, graph.edges[0].sourceHandle)
    assert.equal(roundtrip.graph.edges[0].targetHandle, graph.edges[0].targetHandle)
    assert.deepEqual(roundtrip.manifest.credentialReferences, [
        { path: '/nodes/1/data/credential', reference: 'credential:tenant-fixture/node' },
        { path: '/nodes/1/data/inputs/llmModelConfig/FLOWISE_CREDENTIAL_ID', reference: preservation.credentialReference }
    ])
})

test('editing draft graph, binding, bundle or caller input cannot alter a pinned invocation', () => {
    const draft = copy(graph)
    const draftBinding = copy(binding)
    const exported = copy(bind({ graph: draft, binding: draftBinding }))
    const input = { question: 'Hello' }
    const invocation = pinSkillInvocation(exported, input, executors, binding.capabilities)
    const pinnedBytes = canonicalJson(invocation)
    draft.nodes[1].data.inputs.llmMessages[0].content = 'New draft instructions'
    draftBinding.version = '0.2.0'
    exported.graph.edges[0].sourceHandle = 'edited-handle'
    exported.manifest.inputSchema.properties.question.type = 'number'
    input.question = 'Edited input'
    assert.equal(canonicalJson(invocation), pinnedBytes)
    assert.throws(() => {
        invocation.graph.nodes[1].data.inputs.llmMessages[0].content = 'Attempt to mutate pinned graph'
    }, TypeError)
    const next = bind({ graph: draft, binding: draftBinding })
    assert.notEqual(next.manifest.graph.revision, invocation.manifest.graph.revision)
    assert.notEqual(next.manifest.version, invocation.manifest.version)
    assert.equal(validateSkillOutput(invocation, 'こんにちは'), 'こんにちは')
})

test('validates actual input/output values without coercion or mutation', () => {
    const bundle = bind()
    for (const input of [{}, { question: 42 }, { question: '' }, { question: 'Hello', unknown: true }]) {
        assert.throws(() => pinSkillInvocation(bundle, input, executors, binding.capabilities), /Invalid input/)
    }
    const invocation = pinSkillInvocation(bundle, { question: 'Hello' }, executors, binding.capabilities)
    for (const output of ['', 12, {}, null]) assert.throws(() => validateSkillOutput(invocation, output), /Invalid output/)
})

test('rejects invalid/unknown schema keywords, remote refs and incompatible native contracts', () => {
    for (const inputSchema of [
        { type: 'object', madeUpKeyword: true, required: ['question'], properties: { question: { type: 'string' } } },
        { type: 'object', required: ['question'], properties: { question: { type: 'string', $ref: 'https://example.test/schema' } } },
        { type: 'object', required: ['question'], properties: { question: { type: 'string', minLength: -1 } } }
    ])
        assert.throws(() => bind({ binding: { ...copy(binding), inputSchema } }), /Invalid input schema/)
    assert.throws(() => bind({ binding: { ...copy(binding), inputSchema: { type: 'number' } } }), /Native Translator input/)
    assert.throws(() => bind({ binding: { ...copy(binding), outputSchema: { type: 'object' } } }), /Native Translator output/)
    const invalidFixture = copy(binding)
    invalidFixture.fixtures[0].output = 42
    assert.throws(() => bind({ binding: invalidFixture }), /Invalid fixture output/)
})

test('fails closed on unknown, unavailable, inherited or changed executors, including nested models', () => {
    for (const name of unknownExecutors.nodes) {
        const unknown = copy(graph)
        unknown.nodes[1].data.name = name
        assert.throws(() => bind({ graph: unknown }), /Unknown executor/)
    }
    const missing = { ...executors }
    delete missing.llmAgentflow
    assert.throws(() => bind({ executors: missing }), /Missing executor: llmAgentflow/)
    assert.throws(() => bind({ executors: Object.create(executors) }), /Missing executor/)
    for (const name of unknownExecutors.models) {
        const nested = copy(graph)
        nested.nodes[1].data.inputs.llmModel = name
        assert.throws(() => bind({ graph: nested }), /Unknown model executor/)
    }
    const missingModel = { ...executors }
    delete missingModel.chatGoogleGenerativeAI
    assert.throws(() => bind({ executors: missingModel }), /Missing executor: chatGoogleGenerativeAI/)
    const changed = copy(executors)
    changed.llmAgentflow.digest = `sha256:${'a'.repeat(64)}`
    assert.throws(() => verifyGraphSkill(bind(), changed), /Executor binding mismatch/)
})

test('rejects unknown, undeclared and unauthorized capabilities', () => {
    assert.throws(
        () => bind({ binding: { ...copy(binding), capabilities: [...binding.capabilities, 'filesystem.write'] } }),
        /Unknown capability/
    )
    for (const capability of binding.capabilities) {
        assert.throws(
            () => bind({ binding: { ...copy(binding), capabilities: binding.capabilities.filter((item) => item !== capability) } }),
            /Undeclared capability/
        )
    }
    const custom = copy(graph)
    custom.nodes[1].data.requiredCapabilities = ['unreviewed.capability']
    assert.throws(() => bind({ graph: custom }), /Unknown capability/)
    assert.throws(() => pinSkillInvocation(bind(), { question: 'Hello' }, executors, []), /Unauthorized capability/)
})

test('rejects tampered graph, handles, instructions, fixtures and credential inventories', () => {
    for (const edit of [
        (bundle) => {
            bundle.graph.nodes[1].data.inputs.llmMessages[0].content = 'Changed prompt'
        },
        (bundle) => {
            bundle.graph.edges[0].targetHandle = 'wrong-handle'
        },
        (bundle) => {
            bundle.skillMd += '\nChanged instructions'
        },
        (bundle) => {
            bundle.fixtures[0].input.question = 'Changed fixture'
        },
        (bundle) => {
            bundle.manifest.credentialReferences.push({ path: '/invented', reference: 'credential:other' })
        }
    ]) {
        const tampered = copy(bind())
        edit(tampered)
        assert.throws(() => verifyGraphSkill(tampered, executors), /integrity mismatch|Credential reference mismatch/)
    }
})

test('rejects inline credentials and unsupported payload features without leaking values in errors', () => {
    const secret = 'DO-NOT-PRINT-THIS-KEY'
    const embedded = copy(graph)
    embedded.nodes[1].data.apiKey = secret
    assert.throws(
        () => bind({ graph: embedded }),
        (error) => /Inline secret/.test(error.message) && !error.message.includes(secret)
    )
    embedded.nodes[1].data.apiKey = ''
    embedded.nodes[1].data.credential = { apiKey: secret }
    assert.throws(() => bind({ graph: embedded }), /Credential must be a reference/)
    const feature = copy(graph)
    feature.nodes[1].data.inputs.llmEnableMemory = true
    assert.throws(() => bind({ graph: feature }), /Unsupported LLM feature/)
    feature.nodes[1].data.inputs.llmEnableMemory = false
    feature.nodes[1].data.inputs.llmModelConfig.baseUrl = 'https://example.test'
    assert.throws(() => bind({ graph: feature }), /Unsupported model feature/)
    feature.nodes[1].data.inputs.llmModelConfig.baseUrl = ''
    feature.nodes[1].data.version = 99
    assert.throws(() => bind({ graph: feature }), /Unsupported native executor payload version/)
})

test('canonical digest ignores object key insertion order and preserves array order; rejects lossy payloads', () => {
    assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }))
    assert.notEqual(digest(canonicalJson([1, 2])), digest(canonicalJson([2, 1])))
    for (const value of [{ invalid: undefined }, [Infinity], new Date(), new Array(2)]) assert.throws(() => canonicalJson(value), /JSON/)
})

test('CLI export creates a reloadable package and refuses to overwrite a version', async () => {
    const temp = await mkdtemp(resolve(tmpdir(), 'ideaflow-graph-skill-'))
    try {
        const out = resolve(temp, 'translator')
        const manifest = await exportGraphSkill({ graph: graphPath, binding: bindingPath, out })
        assert.deepEqual((await readdir(out)).sort(), ['SKILL.md', 'fixtures.json', 'graph.json', 'manifest.json'])
        const bundle = {
            manifest: JSON.parse(await readFile(resolve(out, 'manifest.json'), 'utf8')),
            graph: JSON.parse(await readFile(resolve(out, 'graph.json'), 'utf8')),
            fixtures: JSON.parse(await readFile(resolve(out, 'fixtures.json'), 'utf8')),
            skillMd: await readFile(resolve(out, 'SKILL.md'), 'utf8')
        }
        assert.deepEqual(verifyGraphSkill(bundle, executors).manifest, manifest)
        await assert.rejects(exportGraphSkill({ graph: graphPath, binding: bindingPath, out }), /EEXIST/)
        assert.deepEqual(JSON.parse(await readFile(resolve(out, 'graph.json'), 'utf8')), graph)
        const invalid = resolve(temp, 'invalid.binding.json')
        await writeFile(invalid, JSON.stringify({ ...binding, capabilities: [] }))
        const failedOut = resolve(temp, 'failed')
        await assert.rejects(exportGraphSkill({ graph: graphPath, binding: invalid, out: failedOut }), /Undeclared capability/)
        await assert.rejects(readdir(failedOut), /ENOENT/)
        const cli = spawnSync(process.execPath, ['scripts/export-graph-skill.mjs', '--out', resolve(temp, 'cli')], {
            cwd: root,
            encoding: 'utf8'
        })
        assert.equal(cli.status, 0, cli.stderr)
        assert.equal(JSON.parse(cli.stdout).liveRun, 'pending')
    } finally {
        await rm(temp, { recursive: true, force: true })
    }
})
