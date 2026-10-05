#!/usr/bin/env node
// Real production server + browser; no request interception or upstream stubs.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { mkdtemp, rm, mkdir, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { randomUUID, createHash } from 'node:crypto'
import { once } from 'node:events'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const report = { schemaVersion: 1, startedAt: new Date().toISOString(), liveGatewayAccepted: false, checks: [] }
const output = resolve(process.env.IDEAFLOW_ACCEPTANCE_REPORT || 'artifacts/host-inference-acceptance.json')
let stage = 'configuration'
let browser
let scratch
function check(condition) { if (!condition) throw new Error('Acceptance check failed') }
function pass(name, detail = {}) { report.checks.push({ name, status: 'pass', ...detail }) }

async function freePort() {
    const server = createServer()
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const port = server.address().port
    await new Promise((done) => server.close(done))
    return port
}

async function runCase(name, gateway) {
    stage = `${name}:server-start`
    const dir = resolve(scratch, name)
    await mkdir(dir)
    const port = await freePort()
    const origin = `http://127.0.0.1:${port}`
    // Allowlist avoids inherited aliases, cloud settings, telemetry and credentials.
    const env = Object.fromEntries(['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'TEMP', 'TMP'].flatMap((key) =>
        process.env[key] ? [[key, process.env[key]]] : []))
    Object.assign(env, {
        NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), DATABASE_TYPE: 'sqlite', DATABASE_PATH: dir,
        LOG_PATH: dir, BLOB_STORAGE_PATH: dir, SECRETKEY_PATH: dir, DISABLE_FLOWISE_TELEMETRY: 'true', ...gateway
    })
    // Use the production entry points directly: CLI BaseCommand loads .env with override=true.
    const child = spawn(process.execPath, ['-e',
        "require('./dist/DataSource').init().then(() => require('./dist/index').start()).catch(() => process.exit(1))"],
        { cwd: resolve(root, 'packages/server'), env, stdio: 'ignore' })
    let exited = false
    child.on('exit', () => { exited = true })
    const childError = new Promise((_, reject) => child.once('error', () => reject(new Error('Server spawn failed'))))
    // Attach a handler immediately; errors are reported through readiness below.
    childError.catch(() => { exited = true })
    let context
    let id
    try {
        await Promise.race([childError, (async () => {
            const deadline = Date.now() + 90_000
            while (Date.now() < deadline) {
                check(!exited)
                try {
                    const response = await fetch(`${origin}/api/v1/ping`, { signal: AbortSignal.timeout(1000) })
                    if (response.ok) return
                } catch { /* Not ready yet. */ }
                await new Promise((done) => setTimeout(done, 250))
            }
            check(false)
        })()])
        context = await browser.newContext()
        context.setDefaultTimeout(75_000)
        const headers = { 'x-request-from': 'internal' }
        stage = `${name}:workspace-session`
        const email = `acceptance-${randomUUID()}@example.test`
        const password = `Acceptance-${randomUUID()}!`
        const registered = await context.request.post(`${origin}/api/v1/account/register`, {
            data: { user: { name: 'Disposable inference acceptance', email, credential: password } }
        })
        check(registered.status() === 201)
        const login = await context.request.post(`${origin}/api/v1/auth/login`, { data: { email, password } })
        check(login.ok())
        check((await context.cookies()).some((cookie) => cookie.name === 'token'))
        pass(`${name}:workspace-session`)
        const page = await context.newPage()
        stage = `${name}:diagram-models`
        const modelsPromise = page.waitForResponse((response) => /\/api\/v1\/diagram-inference\/[^/]+\/models$/.test(response.url()))
        await page.goto(`${origin}/diagram`)
        await page.waitForURL(/\/diagram\/[^/]+$/)
        id = new URL(page.url()).pathname.split('/').pop()
        const models = await modelsPromise
        check(models.url() === `${origin}/api/v1/diagram-inference/${id}/models`)
        check(!models.request().headers().authorization)
        if (name === 'missing-token') {
            check(models.status() === 502)
            check(JSON.stringify(await models.json()) === JSON.stringify({ message: 'Host inference gateway unavailable' }))
            // Also exercise the POST with a valid bounded body in this authenticated browser session.
            const result = await page.evaluate(async ({ id }) => {
                const response = await fetch(`/api/v1/diagram-inference/${id}/chat/completions`, {
                    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-request-from': 'internal' },
                    body: JSON.stringify({ model: 'acceptance', messages: [{ role: 'system', content: '' }, { role: 'user', content: 'Start then finish' }] })
                })
                return { status: response.status, body: await response.json() }
            }, { id })
            check(result.status === 502 && result.body.message === 'Host inference gateway unavailable')
            pass('missing-token:models-and-generation-fail-closed', { statusCode: 502 })
        } else {
            check(models.status() === 200)
            const rows = (await models.json()).data
            check(Array.isArray(rows) && rows.length > 0)
            const model = process.env.IDEAFLOW_ACCEPTANCE_MODEL || rows[0].id
            check(rows.some((row) => row.id === model))
            await page.getByLabel('Model', { exact: true }).selectOption(model)
            pass('configured:models', { count: rows.length })
            stage = 'configured:generate-mermaid'
            await page.getByLabel('Generate', { exact: true }).fill('Create a flowchart TD with A[Acceptance start] --> B[Acceptance finish]. Return only Mermaid.')
            const completionPromise = page.waitForResponse((response) => response.url() === `${origin}/api/v1/diagram-inference/${id}/chat/completions`)
            await page.getByRole('button', { name: 'Generate', exact: true }).click()
            const completion = await completionPromise
            check(completion.status() === 200 && !completion.request().headers().authorization)
            await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Generate' && !button.disabled))
            await page.waitForFunction(() => document.querySelectorAll('pf-flow pf-node, .react-flow__node').length >= 2)
            const content = (await completion.json()).choices?.[0]?.message?.content
            check(typeof content === 'string')
            const expectedDsl = (content.match(/```(?:mermaid)?\s*([\s\S]*?)```/i)?.[1] || content).trim()
            const dsl = await page.getByLabel('DSL', { exact: true }).inputValue()
            check(dsl.trim() === expectedDsl)
            check(/^flowchart\s+(TD|LR)\b/.test(dsl.trim()) && dsl.includes('-->'))
            check(await page.locator('.ideaflow-error').count() === 0)
            pass('configured:generate-mermaid', { dslSha256: createHash('sha256').update(dsl).digest('hex') })
        }
    } finally {
        try {
            if (id && context) {
                const deleted = await context.request.delete(`${origin}/api/v1/chatflows/${id}`, { headers: { 'x-request-from': 'internal' } })
                if (deleted.status() !== 200) { stage = `${name}:diagram-cleanup`; check(false) }
                pass(`${name}:diagram-cleanup`)
            }
        } finally {
            try { await context?.close() } finally {
            if (!exited) {
                const stopped = once(child, 'exit')
                child.kill('SIGTERM')
                const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
                await stopped
                clearTimeout(timer)
            }
            }
        }
    }
}

try {
    check(!!process.env.IDEAFLOW_HOST_INFERENCE_TOKEN && !!process.env.IDEAFLOW_HOST_INFERENCE_BASE)
    const base = new URL(process.env.IDEAFLOW_HOST_INFERENCE_BASE)
    check(['http:', 'https:'].includes(base.protocol) && !base.username && !base.password && !base.search && !base.hash)
    await access(resolve(root, 'packages/server/dist/index.js'))
    await access(resolve(root, 'packages/ui/build/index.html'))
    const { chromium } = require(process.env.IDEAFLOW_PLAYWRIGHT_MODULE || require.resolve('playwright', { paths: [resolve(root, 'packages/components')] }))
    scratch = await mkdtemp(resolve(tmpdir(), 'ideaflow-inference-'))
    const browserEnv = { ...process.env }
    for (const key of Object.keys(browserEnv)) if (/TOKEN|KEY|SECRET|PASSWORD/i.test(key)) delete browserEnv[key]
    browser = await chromium.launch({ headless: true, env: browserEnv, executablePath: process.env.IDEAFLOW_BROWSER_PATH || undefined })
    await runCase('missing-token', {})
    await runCase('configured', {
        IDEAFLOW_HOST_INFERENCE_BASE: base.href,
        IDEAFLOW_HOST_INFERENCE_TOKEN: process.env.IDEAFLOW_HOST_INFERENCE_TOKEN
    })
    report.liveGatewayAccepted = true
    report.status = 'pass'
} catch {
    // Never serialize exception messages, response bodies, URLs, cookies, tokens, or model output.
    report.status = 'fail'
    report.checks.push({ name: stage, status: 'fail' })
    process.exitCode = 1
} finally {
    try {
        await browser?.close()
        if (scratch) await rm(scratch, { recursive: true, force: true })
    } catch {
        report.status = 'fail'
        report.liveGatewayAccepted = false
        report.checks.push({ name: 'runtime-cleanup', status: 'fail' })
        process.exitCode = 1
    }
    report.finishedAt = new Date().toISOString()
    await mkdir(resolve(output, '..'), { recursive: true })
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
    console.info(`Host inference acceptance: ${report.status}`)
}
