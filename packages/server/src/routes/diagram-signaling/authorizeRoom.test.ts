const findOneBy = jest.fn()

jest.mock('../../utils/getRunningExpressApp', () => ({
    getRunningExpressApp: () => ({ AppDataSource: { getRepository: () => ({ findOneBy }) } })
}))
jest.mock('../../database/entities/ChatFlow', () => ({ ChatFlow: class ChatFlow {} }))

import { authorizeDiagramRoom } from './authorizeRoom'

const next = jest.fn()
const status = jest.fn()
const json = jest.fn()
const response = { status, json } as any

describe('diagram signaling room authorization', () => {
    beforeEach(() => {
        findOneBy.mockReset()
        next.mockReset()
        json.mockReset()
        status.mockReset().mockReturnValue({ json })
    })

    it('rejects a caller with no workspace', async () => {
        await authorizeDiagramRoom({ params: { roomId: 'diagram-1' } } as any, response, next)
        expect(status).toHaveBeenCalledWith(403)
        expect(findOneBy).not.toHaveBeenCalled()
    })

    it('cannot join a diagram belonging to another workspace', async () => {
        findOneBy.mockResolvedValue(null)
        await authorizeDiagramRoom({ params: { roomId: 'diagram-1' }, user: { activeWorkspaceId: 'workspace-2' } } as any, response, next)
        expect(findOneBy).toHaveBeenCalledWith({ id: 'diagram-1', workspaceId: 'workspace-2', type: 'DIAGRAM' })
        expect(status).toHaveBeenCalledWith(404)
        expect(next).not.toHaveBeenCalled()
    })

    it('allows an owned diagram room', async () => {
        findOneBy.mockResolvedValue({ id: 'diagram-1' })
        await authorizeDiagramRoom({ params: { roomId: 'diagram-1' }, user: { activeWorkspaceId: 'workspace-1' } } as any, response, next)
        expect(next).toHaveBeenCalledWith()
    })
})
