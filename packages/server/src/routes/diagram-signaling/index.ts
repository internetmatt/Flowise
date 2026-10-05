import express from 'express'
import diagramSignalingController from '../../controllers/diagram-signaling'
import { authorizeDiagramRoom } from './authorizeRoom'

const router = express.Router()

// Opt-in diagram WebRTC signaling only. Not used for chatflow or agent execution.
router.use('/:roomId', authorizeDiagramRoom)
router.post('/:roomId/join', diagramSignalingController.join)
router.post('/:roomId/leave', diagramSignalingController.leave)
router.post('/:roomId/signal', diagramSignalingController.signal)
router.get('/:roomId/poll', diagramSignalingController.poll)

export default router
