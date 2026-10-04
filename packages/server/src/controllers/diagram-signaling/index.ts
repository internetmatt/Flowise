import { Request, Response, NextFunction } from 'express'
import diagramSignalingService from '../../services/diagram-signaling'

const join = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const roomId = String(req.params.roomId || '')
        const peerId = String(req.body?.peerId || '')
        if (!roomId || !peerId) return res.status(400).json({ message: 'roomId and peerId are required' })
        const result = diagramSignalingService.joinRoom(roomId, peerId)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

const leave = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const roomId = String(req.params.roomId || '')
        const peerId = String(req.body?.peerId || '')
        if (!roomId || !peerId) return res.status(400).json({ message: 'roomId and peerId are required' })
        diagramSignalingService.leaveRoom(roomId, peerId)
        return res.status(204).send()
    } catch (error) {
        next(error)
    }
}

const signal = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const roomId = String(req.params.roomId || '')
        const from = String(req.body?.from || '')
        const to = String(req.body?.to || '')
        if (!roomId || !from || !to) return res.status(400).json({ message: 'roomId, from, and to are required' })
        diagramSignalingService.postSignal(roomId, { from, to, payload: req.body?.payload })
        return res.status(204).send()
    } catch (error) {
        next(error)
    }
}

const poll = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const roomId = String(req.params.roomId || '')
        const peerId = String(req.query.peerId || '')
        if (!roomId || !peerId) return res.status(400).json({ message: 'roomId and peerId are required' })
        const messages = diagramSignalingService.pollSignals(roomId, peerId)
        return res.json({ messages })
    } catch (error) {
        next(error)
    }
}

export default {
    join,
    leave,
    signal,
    poll
}
