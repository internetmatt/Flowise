#!/usr/bin/env node
// No mocked APIs: run against a production IdeaFlow build and disposable workspace.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const { chromium } = require(process.env.IDEAFLOW_PLAYWRIGHT_MODULE ||
    require.resolve('playwright', { paths: [resolve(root, 'packages/components')] }))
const origin = (process.env.IDEAFLOW_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const variant = process.env.IDEAFLOW_STUDIO_VARIANT === 'internetmatt'
const headers = { 'x-request-from': 'internal' }
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.IDEAFLOW_BROWSER_PATH || undefined,
    args: process.env.IDEAFLOW_BROWSER_ARGS ? JSON.parse(process.env.IDEAFLOW_BROWSER_ARGS) : undefined
})
const context = await browser.newContext({
    storageState: process.env.IDEAFLOW_STORAGE_STATE || undefined,
    colorScheme: 'light',
    viewport: { width: 1440, height: 1000 }
})
const captureDir = process.env.IDEAFLOW_CAPTURE_DIR
let captureIndex = 0
async function capture(label) {
    if (!captureDir) return
    await mkdir(captureDir, { recursive: true })
    await page.screenshot({ path: resolve(captureDir, `${String(++captureIndex).padStart(2, '0')}-${label}.png`) })
}
const page = await context.newPage()
page.on('pageerror', (error) => console.error('Browser script error:', error.message))

const ids = []
const dsl = 'flowchart TD\n  A[Persisted start] --> B[Persisted end]'
const name = `${captureDir ? 'IdeaFlow save and reload' : `Diagram regression ${Date.now()}`}`

async function record(id) {
    const response = await context.request.get(`${origin}/api/v1/chatflows/${id}`, { headers })
    assert.equal(response.status(), 200)
    return response.json()
}
async function rename(label, nextName) {
    await page.getByLabel(label, { exact: true }).fill(nextName)
    const saved = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/chatflows/'))
    await page.getByLabel(label, { exact: true }).press('Tab')
    assert.equal((await saved).status(), 200)
}
async function save() {
    const saved = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/chatflows/'))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    assert.equal((await saved).status(), 200)
    await page.locator('.ideaflow-note').filter({ hasText: 'Saved' }).waitFor()
}

try {
    if (['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
        const response = await context.request.post(`${origin}/api/v1/account/register`, {
            data: { user: { name: 'Diagram Regression', email: 'diagram-regression@example.test', credential: 'LocalRegressionTest42!' } }
        })
        if (response.status() !== 201) assert.match(await response.text(), /one organization/)
    }
    await page.goto(`${origin}/diagram`)
    await page.waitForURL(/\/diagram\/[^/]+$/)
    const id = new URL(page.url()).pathname.split('/').pop()
    ids.push(id)
    await rename('Diagram name', name)
    if (variant) await page.getByLabel('Canvas variant', { exact: true }).selectOption('internetmatt')
    await capture('diagram-created')
    await page.getByLabel('DSL').fill(dsl)
    await page.waitForFunction(() => document.querySelectorAll('pf-flow pf-node, .react-flow__node').length === 2)
    if (variant) await page.locator('pf-controls').getByRole('button', { name: 'Fit view', exact: true }).click()
    else await page.locator('.react-flow__controls-fitview').click()
    await capture('diagram-edited')
    if (variant) {
        const node = page.locator('pf-node').first()
        const box = await node.boundingBox()
        assert.ok(box)
        const originalPosition = await node.evaluate(el => el.style.transform)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 5 })
        await page.mouse.up()
        assert.notEqual(await node.evaluate(el => el.style.transform), originalPosition)
        await page.getByLabel('DSL').press('End')
        await page.getByLabel('DSL').press('Backspace')
        assert.equal(await page.locator('pf-node').count(), 2)
        await page.getByLabel('DSL').fill(dsl)
        await page.waitForTimeout(600)
        await page.locator('pf-controls').getByRole('button', { name: 'Zoom in', exact: true }).click()
    } else {
        await page.locator('.react-flow__controls-zoomout').click()
        await page.locator('.react-flow__controls-zoomin').click()
    }
    await page.waitForFunction(() => {
        const style = document.querySelector('.pf-flow__viewport, .react-flow__viewport')?.getAttribute('style') || ''
        return Number(style.match(/scale\(([^)]+)\)/)?.[1]) > 1
    })
    await save()
    await capture('diagram-saved')
    const before = await record(id)
    const graph = JSON.parse(before.flowData)
    assert.equal(before.name, name)
    assert.equal(before.type, 'DIAGRAM')
    assert.equal(graph.dsl, dsl)
    assert.deepEqual(
        graph.nodes.map((node) => node.id),
        ['A', 'B']
    )
    assert.equal(graph.edges.length, 1)
    assert.ok(graph.viewport.zoom > 1)
    await page.reload()
    await page.getByLabel('DSL').waitFor()
    assert.equal(await page.getByLabel('Diagram name', { exact: true }).inputValue(), name)
    assert.equal(await page.getByLabel('DSL').inputValue(), dsl)
    await page.waitForFunction(() => document.querySelectorAll('pf-flow pf-node, .react-flow__node').length === 2)
    assert.equal((await record(id)).flowData, before.flowData)
    await capture('diagram-reloaded')
    if (variant) {
        assert.equal(await page.getByLabel('Canvas variant', { exact: true }).inputValue(), 'internetmatt')
        await page.getByRole('button', { name: 'Dark theme', exact: true }).click()
        await capture('diagram-dark')
        await page.getByRole('button', { name: 'Light theme', exact: true }).click()
        await page.getByLabel('Canvas variant', { exact: true }).selectOption('reactflow')
        await page.locator('.react-flow__node').first().waitFor()
        assert.equal((await record(id)).flowData, before.flowData)
        console.info('PASS Internet Matt variant: drag, text-input shortcuts, themes, reload and renderer fallback')
    }
    console.info('PASS /diagram/:id: name, DSL, nodes, edges and changed viewport survive production save/reload')

    await page.goto(`${origin}/v2/agentcanvas`)
    await page.waitForURL(/\/v2\/agentcanvas\/[^/]+$/)
    const agentId = new URL(page.url()).pathname.split('/').pop()
    ids.push(agentId)
    await rename('Agent name', `${name} agent`)
    await save()
    await capture('agent-studio')
    const agent = await record(agentId)
    assert.equal(agent.type, 'AGENTFLOW')
    assert.equal(JSON.parse(agent.flowData).family, 'agent')
    await page.getByRole('link', { name: 'Agents', exact: true }).click()
    await page.waitForURL(/\/agentflows$/)
    await page.getByText(`${name} agent`, { exact: true }).first().waitFor()
    await capture('agents-list')
    const listing = await context.request.get(`${origin}/api/v1/chatflows?type=AGENTFLOW`, { headers })
    const rows = await listing.json()
    assert.ok((Array.isArray(rows) ? rows : rows.data).some((row) => row.id === agentId))
    console.info('PASS /v2/agentcanvas: new agent persists as AGENTFLOW and remains visible in Agents')

    // A pre-studio AGENTFLOW has the original React Flow shape, without a
    // diagram schema/family. Validate its actual Live button and room as well.
    const createdLegacy = await context.request.post(`${origin}/api/v1/chatflows`, {
        headers,
        data: {
            name: `${name} legacy`,
            type: 'AGENTFLOW',
            deployed: false,
            isPublic: false,
            flowData: JSON.stringify({ nodes: JSON.parse(agent.flowData).nodes, edges: [], viewport: { x: 0, y: 0, zoom: 1 } })
        }
    })
    assert.equal(createdLegacy.status(), 200)
    const legacyId = (await createdLegacy.json()).id
    ids.push(legacyId)
    await page.goto(`${origin}/v2/agentcanvas/${legacyId}`)
    const live = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/join'))
    await page.getByRole('button', { name: 'Live', exact: true }).click()
    assert.equal((await live).status(), 200)
    await page.getByRole('button', { name: 'Stop live', exact: true }).click()

    const signaling = `${origin}/api/v1/diagram-signaling/${legacyId}`
    for (const peerId of ['regression-a', 'regression-b']) {
        const joined = await context.request.post(`${signaling}/join`, { headers, data: { peerId } })
        assert.equal(joined.status(), 200)
    }
    const rejected = await context.request.post(`${signaling}/signal`, {
        headers,
        data: { from: 'regression-a', to: 'nonexistent', payload: {} }
    })
    assert.equal(rejected.status(), 404)
    const delivered = await context.request.post(`${signaling}/signal`, {
        headers,
        data: { from: 'regression-a', to: 'regression-b', payload: { kind: 'offer' } }
    })
    assert.equal(delivered.status(), 204)
    const polled = await context.request.get(`${signaling}/poll?peerId=regression-b`, { headers })
    assert.equal(polled.status(), 200)
    assert.equal((await polled.json()).messages.length, 1)
    for (const peerId of ['regression-a', 'regression-b']) await context.request.post(`${signaling}/leave`, { headers, data: { peerId } })
    console.info('PASS existing AGENTFLOW room: authenticated join/delivery succeeds; nonexistent destination returns 404')
} finally {
    for (const id of ids) {
        const deleted = await context.request.delete(`${origin}/api/v1/chatflows/${id}`, { headers })
        assert.equal(deleted.status(), 200, 'Regression fixture cleanup failed')
    }
    await browser.close()
}
