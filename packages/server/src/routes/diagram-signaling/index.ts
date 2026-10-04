import express from 'express'
import diagramSignalingController from '../../controllers/diagram-signaling'
import { checkAnyPermission } from '../../enterprise/rbac/PermissionCheck'
import { authorizeDiagramRoom } from './authorizeRoom'

const router = express.Router()

// Opt-in diagram WebRTC signaling only. Not used for chatflow or agent execution.
router.use('/:roomId', authorizeDiagramRoom)
router.post('/:roomId/join', checkAnyPermission('chatflows:view,chatflows:update'), diagramSignalingController.join)
router.post('/:roomId/leave', checkAnyPermission('chatflows:view,chatflows:update'), diagramSignalingController.leave)
router.post('/:roomId/signal', checkAnyPermission('chatflows:update'), diagramSignalingController.signal)
router.get('/:roomId/poll', checkAnyPermission('chatflows:view,chatflows:update'), diagramSignalingController.poll)

export default router
