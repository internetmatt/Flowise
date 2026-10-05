import express from 'express'
import { authorizeDiagramRoom } from '../diagram-signaling/authorizeRoom'
import { hostInferenceRequest } from '../../services/host-platform/inference'

const router = express.Router()

// The parent API middleware verifies the session. Require the internal session path,
// a workspace-owned record, and its normal view/update permission as well.
router.use('/:roomId', (req, res, next) => {
    if (req.headers['x-request-from'] !== 'internal' || !req.user?.activeWorkspaceId) {
        return res.status(403).json({ message: 'Authenticated workspace session required' })
    }
    return authorizeDiagramRoom(req, res, next)
})

router.get('/:roomId/models', async (_req, res) => {
    try {
        const upstream = await hostInferenceRequest('/models')
        if (!upstream.ok) return res.status(502).json({ message: 'Host inference gateway refused the request' })
        const body = (await upstream.json()) as { data?: Array<{ id?: string }> }
        return res.json({ data: (body.data || []).filter((model) => typeof model.id === 'string').map((model) => ({ id: model.id })) })
    } catch {
        // Never expose upstream errors, headers, or configuration secrets.
        return res.status(502).json({ message: 'Host inference gateway unavailable' })
    }
})

router.post('/:roomId/chat/completions', async (req, res) => {
    const { model, messages } = req.body || {}
    const prompt = Array.isArray(messages) && messages.length === 2 && messages[1]?.role === 'user' ? messages[1].content : undefined
    if (
        typeof model !== 'string' ||
        !model ||
        model.length > 256 ||
        typeof prompt !== 'string' ||
        !prompt.trim() ||
        prompt.length > 16_000
    ) {
        return res.status(400).json({ message: 'A model and bounded diagram prompt are required' })
    }
    try {
        const upstream = await hostInferenceRequest('/chat/completions', {
            model,
            temperature: 0,
            stream: false,
            max_tokens: 4096,
            messages: [
                { role: 'system', content: 'Return only a Mermaid flowchart. No prose. Use a flowchart TD (or LR) header and node edges.' },
                { role: 'user', content: prompt }
            ]
        })
        if (!upstream.ok) return res.status(502).json({ message: 'Host inference gateway refused the request' })
        const body = (await upstream.json()) as { choices?: Array<{ message?: { content?: string } }> }
        const content = body.choices?.[0]?.message?.content
        if (typeof content !== 'string') return res.status(502).json({ message: 'Invalid gateway completion' })
        return res.json({ choices: [{ message: { content } }] })
    } catch {
        return res.status(502).json({ message: 'Host inference gateway unavailable' })
    }
})

export default router
