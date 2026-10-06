import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Ajv from 'ajv'

const ajv = new Ajv({ allErrors: true, strict: true, validateFormats: true })
const contract = JSON.parse(readFileSync(new URL('./contract.schema.json', import.meta.url), 'utf8'))
ajv.addSchema(contract)
const bindingValidator = ajv.compile({ $ref: `${contract.$id}#/definitions/binding` })
const manifestValidator = ajv.compile({ $ref: `${contract.$id}#/definitions/manifest` })
const knownCapabilities = new Set(['model.generate', 'network.egress', 'credential.resolve'])
const credentialKeys = new Set(['credential', 'credentialId', 'FLOWISE_CREDENTIAL_ID'])

function check(condition, message) {
    if (!condition) throw new Error(message)
}

// Canonical JSON: sort object keys, retain array order and every native JSON field.
// Reject non-JSON values rather than silently dropping payload data.
export function canonicalJson(value, seen = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
    if (typeof value === 'number') {
        check(Number.isFinite(value), 'Non-JSON number')
        return JSON.stringify(value)
    }
    check(typeof value === 'object' && !seen.has(value), 'Non-JSON or cyclic payload')
    check(Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'Non-JSON object')
    seen.add(value)
    if (Array.isArray(value)) check(Object.keys(value).length === value.length, 'Sparse or decorated array is not JSON')
    const result = Array.isArray(value)
        ? `[${value.map((item) => canonicalJson(item, seen)).join(',')}]`
        : `{${Object.keys(value)
              .sort()
              .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key], seen)}`)
              .join(',')}}`
    seen.delete(value)
    return result
}

export const digest = (text) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
const jsonDigest = (value) => digest(canonicalJson(value))
const clone = (value) => JSON.parse(canonicalJson(value))
const nonempty = (value) => value !== undefined && value !== null && value !== '' && value !== false

function validate(validator, value, label) {
    check(validator(value), `Invalid ${label}: ${ajv.errorsText(validator.errors)}`)
}

function compile(schema, label) {
    try {
        return ajv.compile(schema)
    } catch {
        // Never include submitted schema contents (which could contain secrets) in errors.
        throw new Error(`Invalid ${label} schema (strict draft-07; no remote references)`)
    }
}

function declaredCapabilities(capabilities) {
    for (const capability of capabilities) check(knownCapabilities.has(capability), `Unknown capability: ${capability}`)
}

function portableValues(value, path = '', references = []) {
    if (typeof value === 'string') {
        check(
            !/\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/.test(value),
            'Inline secret is not portable'
        )
    } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            const pointer = `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`
            const normalized = key.replace(/[_-]/g, '').toLowerCase()
            if (credentialKeys.has(key) && nonempty(child)) {
                check(typeof child === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,255}$/.test(child), 'Credential must be a reference')
                references.push({ path: pointer, reference: child })
            } else if (/(apikey|password|secret|accesstoken|authtoken|authorization|bearertoken)$/.test(normalized)) {
                check(!nonempty(child), 'Inline secret field is not portable')
            }
            portableValues(child, pointer, references)
        }
    }
    return references.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

function onlyKeys(object, keys, label) {
    check(object && typeof object === 'object' && !Array.isArray(object), `Invalid ${label}`)
    for (const key of Object.keys(object)) check(keys.includes(key), `Unsupported ${label} field: ${key}`)
}

// Intentionally narrow: the current two-node, chat-input Translator graph.
// No arbitrary node is accepted merely because it happens to exist in the repo.
function analyzeGraph(graph, capabilities, executors) {
    check(
        Array.isArray(graph.nodes) && graph.nodes.length === 2 && Array.isArray(graph.edges) && graph.edges.length === 1,
        'Only a two-node Start → LLM agentflow is supported'
    )
    const references = portableValues(graph)
    const used = new Set()
    const requireExecutor = (name, entrypoint) => {
        check(
            Object.hasOwn(executors, name) && executors[name]?.name === name && executors[name]?.entrypoint === entrypoint,
            `Missing executor: ${name}`
        )
        used.add(name)
    }
    for (const node of graph.nodes) {
        check(['startAgentflow', 'llmAgentflow'].includes(node.data?.name), `Unknown executor: ${node.data?.name}`)
        check(
            typeof node.id === 'string' && node.id.length > 0 && node.type === 'agentFlow' && node.data.id === node.id,
            'Invalid native agentflow node'
        )
        const supportedVersion = node.data.name === 'startAgentflow' ? 1.1 : 1
        check(node.data.version === supportedVersion, 'Unsupported native executor payload version')
        requireExecutor(node.data.name, 'run')
    }
    const start = graph.nodes.find((node) => node.data.name === 'startAgentflow')
    const llm = graph.nodes.find((node) => node.data.name === 'llmAgentflow')
    check(start && llm && start.id !== llm.id, 'Graph requires one Start and one LLM')
    const edge = graph.edges[0]
    check(
        typeof edge.id === 'string' &&
            edge.id.length > 0 &&
            edge.type === 'agentFlow' &&
            edge.source === start.id &&
            edge.target === llm.id,
        'Invalid native edge'
    )
    check(edge.sourceHandle === `${start.id}-output-startAgentflow` && edge.targetHandle === llm.id, 'Invalid native edge handles')
    const startInputs = start.data.inputs
    onlyKeys(
        startInputs,
        ['startInputType', 'formTitle', 'formDescription', 'formInputTypes', 'startEphemeralMemory', 'startState', 'startPersistState'],
        'Start input'
    )
    check(startInputs.startInputType === 'chatInput', 'Only chatInput is supported')
    for (const key of ['startEphemeralMemory', 'startState', 'startPersistState'])
        check(!nonempty(startInputs[key]), `Unsupported Start feature: ${key}`)
    const inputs = llm.data.inputs
    onlyKeys(
        inputs,
        ['llmModel', 'llmMessages', 'llmEnableMemory', 'llmReturnResponseAs', 'llmStructuredOutput', 'llmUpdateState', 'llmModelConfig'],
        'LLM input'
    )
    check(inputs.llmModel === 'chatGoogleGenerativeAI', `Unknown model executor: ${inputs.llmModel}`)
    requireExecutor(inputs.llmModel, 'init')
    for (const key of ['llmEnableMemory', 'llmStructuredOutput', 'llmUpdateState'])
        check(!nonempty(inputs[key]), `Unsupported LLM feature: ${key}`)
    check(['userMessage', 'assistantMessage'].includes(inputs.llmReturnResponseAs), 'Invalid LLM response role')
    check(Array.isArray(inputs.llmMessages) && inputs.llmMessages.length > 0, 'LLM messages are required')
    for (const message of inputs.llmMessages) {
        check(
            ['system', 'assistant', 'developer', 'user'].includes(message.role) && typeof message.content === 'string',
            'Invalid native LLM message'
        )
    }
    const config = inputs.llmModelConfig
    onlyKeys(
        config,
        [
            'cache',
            'contextCache',
            'modelName',
            'customModelName',
            'temperature',
            'streaming',
            'maxOutputTokens',
            'topP',
            'topK',
            'harmCategory',
            'harmBlockThreshold',
            'baseUrl',
            'allowImageUploads',
            'llmModel',
            'FLOWISE_CREDENTIAL_ID'
        ],
        'model config'
    )
    check(
        typeof config.modelName === 'string' && config.modelName.length > 0 && config.llmModel === inputs.llmModel,
        'Invalid nested model binding'
    )
    for (const key of ['cache', 'contextCache', 'customModelName', 'baseUrl', 'allowImageUploads'])
        check(!nonempty(config[key]), `Unsupported model feature: ${key}`)
    const required = ['model.generate', 'network.egress', 'credential.resolve']
    for (const capability of required) check(capabilities.includes(capability), `Undeclared capability: ${capability}`)
    // Reject custom capability metadata too; it cannot override the trusted policy.
    for (const node of graph.nodes) {
        for (const key of ['capabilities', 'requiredCapabilities']) {
            if (node.data[key] !== undefined) {
                check(Array.isArray(node.data[key]), 'Invalid node capabilities')
                declaredCapabilities(node.data[key])
                for (const capability of node.data[key]) check(capabilities.includes(capability), `Undeclared capability: ${capability}`)
            }
        }
    }
    return { executors: [...used].sort().map((name) => clone(executors[name])), references }
}

function skillMarkdown(binding, revision) {
    return `---\nname: ${binding.name}\ndescription: ${JSON.stringify(binding.description)}\n---\n\n${
        binding.instructions
    }\n\nRead [manifest.json](manifest.json) for the input/output contract, capabilities and executor pins.\nUse only [graph.json](graph.json), revision \`${revision}\`, for skill version \`${
        binding.version
    }\`.\n`
}

function validateFixtures(fixtures, inputValidator, outputValidator) {
    check(Array.isArray(fixtures) && fixtures.length > 0, 'Contract fixtures are required')
    for (const fixture of fixtures) {
        check(
            fixture && typeof fixture.name === 'string' && Object.hasOwn(fixture, 'input') && Object.hasOwn(fixture, 'output'),
            'Invalid fixture'
        )
        validate(inputValidator, fixture.input, 'fixture input')
        validate(outputValidator, fixture.output, 'fixture output')
    }
}

function validateNativeContract(inputSchema, outputSchema) {
    check(
        inputSchema.type === 'object' && inputSchema.required?.includes('question') && inputSchema.properties?.question?.type === 'string',
        'Native Translator input must require a string question'
    )
    check(outputSchema.type === 'string', 'Native Translator output must be text')
}

export function bindGraphSkill({ graph, binding, source, executors }) {
    graph = clone(graph)
    binding = clone(binding)
    validate(bindingValidator, binding, 'skill binding')
    declaredCapabilities(binding.capabilities)
    portableValues(binding)
    validateNativeContract(binding.inputSchema, binding.outputSchema)
    const inputValidator = compile(binding.inputSchema, 'input')
    const outputValidator = compile(binding.outputSchema, 'output')
    validateFixtures(binding.fixtures, inputValidator, outputValidator)
    const analysis = analyzeGraph(graph, binding.capabilities, executors)
    const revision = jsonDigest(graph)
    const skillMd = skillMarkdown(binding, revision)
    const manifest = {
        schemaVersion: 1,
        kind: 'ideaflow.graph-skill',
        name: binding.name,
        version: binding.version,
        description: binding.description,
        inputSchema: binding.inputSchema,
        outputSchema: binding.outputSchema,
        capabilities: binding.capabilities,
        graph: {
            id: binding.graphId,
            format: 'ideaflow.agentflow.v2',
            file: 'graph.json',
            revision,
            digest: revision,
            source: clone(source)
        },
        executors: analysis.executors,
        credentialReferences: analysis.references,
        skillMd: { file: 'SKILL.md', digest: digest(skillMd) },
        fixtures: { file: 'fixtures.json', digest: jsonDigest(binding.fixtures) },
        acceptance: { liveRun: 'pending' }
    }
    validate(manifestValidator, manifest, 'skill manifest')
    return freeze({ manifest, graph, skillMd, fixtures: binding.fixtures })
}

function freeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze)
        Object.freeze(value)
    }
    return value
}

// Verify files against a trusted executor catalog before exposing any dispatch snapshot.
// The host must additionally authorize capabilities and validate its actual loaded executors.
export function verifyGraphSkill(bundle, executors) {
    bundle = clone(bundle)
    const { manifest, graph, skillMd, fixtures } = bundle
    validate(manifestValidator, manifest, 'skill manifest')
    declaredCapabilities(manifest.capabilities)
    check(manifest.graph.digest === jsonDigest(graph) && manifest.graph.revision === manifest.graph.digest, 'Graph integrity mismatch')
    check(
        manifest.skillMd.file === 'SKILL.md' && typeof skillMd === 'string' && manifest.skillMd.digest === digest(skillMd),
        'SKILL.md integrity mismatch'
    )
    check(manifest.fixtures.file === 'fixtures.json' && manifest.fixtures.digest === jsonDigest(fixtures), 'Fixture integrity mismatch')
    portableValues(manifest)
    portableValues(skillMd)
    portableValues(fixtures)
    validateNativeContract(manifest.inputSchema, manifest.outputSchema)
    const analysis = analyzeGraph(graph, manifest.capabilities, executors)
    check(canonicalJson(analysis.executors) === canonicalJson(manifest.executors), 'Executor binding mismatch')
    check(canonicalJson(analysis.references) === canonicalJson(manifest.credentialReferences), 'Credential reference mismatch')
    const inputValidator = compile(manifest.inputSchema, 'input')
    const outputValidator = compile(manifest.outputSchema, 'output')
    validateFixtures(fixtures, inputValidator, outputValidator)
    return freeze(bundle)
}

export function pinSkillInvocation(bundle, input, executors, authorizedCapabilities) {
    const snapshot = verifyGraphSkill(bundle, executors)
    check(Array.isArray(authorizedCapabilities), 'Authorized capabilities are required')
    for (const capability of snapshot.manifest.capabilities)
        check(authorizedCapabilities.includes(capability), `Unauthorized capability: ${capability}`)
    const pinnedInput = clone(input)
    validate(compile(snapshot.manifest.inputSchema, 'input'), pinnedInput, 'input')
    return freeze({ ...snapshot, packageDigest: jsonDigest(snapshot), input: pinnedInput })
}

export function validateSkillOutput(invocation, output) {
    validate(compile(invocation.manifest.outputSchema, 'output'), output, 'output')
    return output
}
