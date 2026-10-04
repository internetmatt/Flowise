import { NextFunction, Request, Response } from 'express'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'

/** Signaling room IDs are diagram IDs; authenticate their workspace before use. */
export const authorizeDiagramRoom = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) return res.status(403).json({ message: 'Workspace required' })

        const diagram = await getRunningExpressApp().AppDataSource.getRepository(ChatFlow).findOneBy({
            id: req.params.roomId,
            workspaceId,
            type: 'DIAGRAM'
        })
        if (!diagram) return res.status(404).json({ message: 'Diagram not found' })
        return next()
    } catch (error) {
        return next(error)
    }
}
