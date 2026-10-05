import { NextFunction, Request, Response } from 'express'
import { checkAnyPermission } from '../../enterprise/rbac/PermissionCheck'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'

/** Signaling room IDs are diagram IDs; authenticate their workspace before use. */
export const authorizeDiagramRoom = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) return res.status(403).json({ message: 'Workspace required' })

        const diagram = await getRunningExpressApp().AppDataSource.getRepository(ChatFlow).findOneBy({
            id: req.params.roomId,
            workspaceId
        })
        if (!diagram || !['DIAGRAM', 'AGENTFLOW'].includes(diagram.type || ''))
            return res.status(404).json({ message: 'Diagram not found' })
        const family = diagram.type === 'AGENTFLOW' ? 'agentflows' : 'chatflows'
        const permissions =
            req.method === 'POST' && /\/(signal|chat\/completions)\/?$/i.test(req.path)
                ? `${family}:update`
                : `${family}:view,${family}:update`
        return checkAnyPermission(permissions)(req, res, next)
    } catch (error) {
        return next(error)
    }
}
