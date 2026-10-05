import express from 'express'
import request from 'supertest'

const findOneBy = jest.fn()
jest.mock('../../utils/getRunningExpressApp', () => ({
    getRunningExpressApp: () => ({ AppDataSource: { getRepository: () => ({ findOneBy }) } })
}))
jest.mock('../../database/entities/ChatFlow', () => ({ ChatFlow: class ChatFlow {} }))
import router from './index'

const fetchMock = jest.fn()
const user = { activeWorkspaceId: 'workspace-1', permissions: ['chatflows:view', 'chatflows:update'] }
function app(identity: any = user) {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
        req.user = identity
        next()
    })
    app.use('/api/v1/diagram-inference', router)
    return app
}
const base = '/api/v1/diagram-inference/diagram-1'
const body = {
    model: 'projecto/local',
    messages: [
        { role: 'system', content: 'ignored' },
        { role: 'user', content: 'draw a flow' }
    ]
}

describe('authenticated diagram inference proxy', () => {
    beforeEach(() => {
        findOneBy.mockReset().mockResolvedValue({ type: 'DIAGRAM' })
        fetchMock.mockReset()
        jest.spyOn(global, 'fetch').mockImplementation(fetchMock)
        process.env.IDEAFLOW_HOST_INFERENCE_TOKEN = 'test-server-only-secret'
    })
    afterEach(() => {
        jest.restoreAllMocks()
        delete process.env.IDEAFLOW_HOST_INFERENCE_TOKEN
    })

    it('requires a session workspace, internal header, owned record and update permission', async () => {
        expect((await request(app(null)).get(`${base}/models`).set('x-request-from', 'internal')).status).toBe(403)
        expect((await request(app()).get(`${base}/models`)).status).toBe(403)
        findOneBy.mockResolvedValue(null)
        expect((await request(app()).get(`${base}/models`).set('x-request-from', 'internal')).status).toBe(404)
        expect(findOneBy).toHaveBeenCalledWith({ id: 'diagram-1', workspaceId: 'workspace-1' })
        findOneBy.mockResolvedValue({ type: 'DIAGRAM' })
        expect(
            (
                await request(app({ ...user, permissions: ['chatflows:view'] }))
                    .post(`${base}/chat/completions`)
                    .set('x-request-from', 'internal')
                    .send(body)
            ).status
        ).toBe(403)
        expect(
            (
                await request(app({ ...user, permissions: ['chatflows:view'] }))
                    .post(`${base}/chat/completions/`)
                    .set('x-request-from', 'internal')
                    .send(body)
            ).status
        ).toBe(403)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('keeps the operator bearer server-side and only forwards diagram generation fields', async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ choices: [{ message: { content: 'flowchart TD\n A-->B' } }], secret: 'test-server-only-secret' }))
        )
        const response = await request(app())
            .post(`${base}/chat/completions`)
            .set('x-request-from', 'internal')
            .set('Authorization', 'Bearer attacker')
            .send({ ...body, baseUrl: 'https://attacker.test', tools: [{}], stream: true })
        expect(response.status).toBe(200)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('http://127.0.0.1:4716/v1/chat/completions')
        expect(init.headers.Authorization).toBe('Bearer test-server-only-secret')
        expect(init.redirect).toBe('error')
        const forwarded = JSON.parse(init.body)
        expect(forwarded.tools).toBeUndefined()
        expect(forwarded.stream).toBe(false)
        expect(forwarded.messages[0].content).toMatch(/^Return only a Mermaid/)
        expect(JSON.stringify(response.body)).not.toContain('secret')
    })

    it('sanitizes model responses and upstream errors', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'model', credential: 'secret' }] })))
        expect((await request(app()).get(`${base}/models`).set('x-request-from', 'internal')).body).toEqual({ data: [{ id: 'model' }] })
        fetchMock.mockResolvedValueOnce(new Response('test-server-only-secret', { status: 401 }))
        const response = await request(app()).get(`${base}/models`).set('x-request-from', 'internal')
        expect(response.status).toBe(502)
        expect(JSON.stringify(response.body)).not.toContain('test-server-only-secret')
    })

    it('prefers the host-neutral configuration over the legacy Projecto alias', async () => {
        process.env.IDEAFLOW_HOST_INFERENCE_BASE = 'http://127.0.0.1:4999/v1'
        process.env.PROJECTO_INFERENCE_BASE = 'http://127.0.0.1:4888/v1'
        process.env.PROJECTO_OPERATOR_API_KEY = 'legacy-secret'
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
        const response = await request(app()).get(`${base}/models`).set('x-request-from', 'internal')
        expect(response.status).toBe(200)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('http://127.0.0.1:4999/v1/models')
        expect(init.headers.Authorization).toBe('Bearer test-server-only-secret')
        delete process.env.IDEAFLOW_HOST_INFERENCE_BASE
        delete process.env.PROJECTO_INFERENCE_BASE
        delete process.env.PROJECTO_OPERATOR_API_KEY
    })

    it('fails closed without host inference configuration and rejects oversized prompts', async () => {
        delete process.env.IDEAFLOW_HOST_INFERENCE_TOKEN
        delete process.env.PROJECTO_OPERATOR_API_KEY
        expect((await request(app()).get(`${base}/models`).set('x-request-from', 'internal')).status).toBe(502)
        expect(
            (
                await request(app())
                    .post(`${base}/chat/completions`)
                    .set('x-request-from', 'internal')
                    .send({ ...body, messages: [body.messages[0], { role: 'user', content: 'x'.repeat(16001) }] })
            ).status
        ).toBe(400)
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
