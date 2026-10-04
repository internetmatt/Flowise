import type { CollabProvider, CollabUpdate, SignalingMessage } from './types'

export type SignalingClientOptions = {
    /** Base like `/api/v1/diagram-signaling` or absolute URL. */
    baseUrl: string
    roomId: string
    peerId?: string
    fetchImpl?: typeof fetch
    pollMs?: number
}

/**
 * HTTP long-poll signaling client for WebRTC offer/answer/ICE.
 * IdeaFlow server owns the room; no vendor signaling.
 */
export function createSignalingClient(options: SignalingClientOptions) {
    const peerId = options.peerId || `peer-${Math.random().toString(36).slice(2, 10)}`
    const fetchImpl = options.fetchImpl || fetch
    const base = options.baseUrl.replace(/\/$/, '')
    const room = encodeURIComponent(options.roomId)
    let stopped = false
    const signalHandlers = new Set<(message: SignalingMessage) => void>()

    const join = async () => {
        const response = await fetchImpl(`${base}/${room}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ peerId })
        })
        if (!response.ok) throw new Error(`Signaling join failed (${response.status})`)
        return (await response.json()) as { peerIds: string[] }
    }

    const postSignal = async (to: string, payload: unknown) => {
        await fetchImpl(`${base}/${room}/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: peerId, to, payload })
        })
    }

    const poll = async () => {
        while (!stopped) {
            try {
                const response = await fetchImpl(`${base}/${room}/poll?peerId=${encodeURIComponent(peerId)}`)
                if (response.ok) {
                    const body = (await response.json()) as { messages?: SignalingMessage[] }
                    for (const message of body.messages ?? []) {
                        for (const handler of signalHandlers) handler(message)
                    }
                }
            } catch {
                // Peer failures must not block save; keep polling.
            }
            await sleep(options.pollMs ?? 500)
        }
    }

    return {
        peerId,
        join,
        postSignal,
        onMessage(handler: (message: SignalingMessage) => void) {
            signalHandlers.add(handler)
            return () => signalHandlers.delete(handler)
        },
        startPolling() {
            void poll()
        },
        async leave() {
            stopped = true
            try {
                await fetchImpl(`${base}/${room}/leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ peerId })
                })
            } catch {
                // ignore
            }
        }
    }
}

export type WebrtcProviderOptions = {
    signaling: ReturnType<typeof createSignalingClient>
    /** Injected for tests / non-browser. */
    rtcPeerConnection?: new (config?: RTCConfiguration) => RTCPeerConnection
    iceServers?: RTCIceServer[]
}

/**
 * Syncs CollabUpdate bytes over RTCDataChannel. Signaling stays on the IdeaFlow server.
 * Off until start() is called.
 */
export function createWebrtcProvider(options: WebrtcProviderOptions): CollabProvider & { start: () => Promise<void> } {
    const RTCPeer = options.rtcPeerConnection || (globalThis as { RTCPeerConnection?: typeof RTCPeerConnection }).RTCPeerConnection
    const peers = new Map<string, { pc: RTCPeerConnection; channel?: RTCDataChannel }>()
    const remoteHandlers = new Set<(update: CollabUpdate, origin?: string) => void>()
    let started = false

    const emitRemote = (update: CollabUpdate, origin?: string) => {
        for (const handler of remoteHandlers) handler(update, origin)
    }

    const ensurePeer = async (remoteId: string, polite: boolean) => {
        if (!RTCPeer) throw new Error('RTCPeerConnection is not available')
        if (peers.has(remoteId)) return peers.get(remoteId)!
        const pc = new RTCPeer({ iceServers: options.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }] })
        const entry: { pc: RTCPeerConnection; channel?: RTCDataChannel } = { pc }
        peers.set(remoteId, entry)

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                void options.signaling.postSignal(remoteId, { kind: 'ice', candidate: event.candidate.toJSON() })
            }
        }

        pc.ondatachannel = (event) => {
            entry.channel = event.channel
            wireChannel(event.channel, remoteId)
        }

        if (polite) {
            const channel = pc.createDataChannel('ideaflow-diagram')
            entry.channel = channel
            wireChannel(channel, remoteId)
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            await options.signaling.postSignal(remoteId, { kind: 'offer', sdp: offer })
        }

        return entry
    }

    const wireChannel = (channel: RTCDataChannel, remoteId: string) => {
        channel.binaryType = 'arraybuffer'
        channel.onmessage = (event) => {
            const data = event.data
            const update =
                data instanceof ArrayBuffer
                    ? new Uint8Array(data)
                    : data instanceof Uint8Array
                    ? data
                    : new TextEncoder().encode(String(data))
            emitRemote(update, remoteId)
        }
    }

    options.signaling.onMessage(async (message) => {
        if (message.type === 'peers') {
            for (const id of message.peerIds) {
                if (id === options.signaling.peerId) continue
                const polite = options.signaling.peerId < id
                await ensurePeer(id, polite)
            }
            return
        }
        if (message.type === 'signal' && message.to === options.signaling.peerId) {
            const payload = message.payload as { kind?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
            const entry = await ensurePeer(message.from, false)
            if (payload.kind === 'offer' && payload.sdp) {
                await entry.pc.setRemoteDescription(payload.sdp)
                const answer = await entry.pc.createAnswer()
                await entry.pc.setLocalDescription(answer)
                await options.signaling.postSignal(message.from, { kind: 'answer', sdp: answer })
            } else if (payload.kind === 'answer' && payload.sdp) {
                await entry.pc.setRemoteDescription(payload.sdp)
            } else if (payload.kind === 'ice' && payload.candidate) {
                try {
                    await entry.pc.addIceCandidate(payload.candidate)
                } catch {
                    // ignore late ICE
                }
            }
        }
    })

    return {
        async start() {
            if (started) return
            started = true
            const joined = await options.signaling.join()
            options.signaling.startPolling()
            for (const id of joined.peerIds) {
                if (id === options.signaling.peerId) continue
                const polite = options.signaling.peerId < id
                await ensurePeer(id, polite)
            }
        },
        broadcast(update) {
            for (const [, entry] of peers) {
                if (entry.channel && entry.channel.readyState === 'open') {
                    entry.channel.send(update)
                }
            }
        },
        onRemote(handler) {
            remoteHandlers.add(handler)
            return () => remoteHandlers.delete(handler)
        },
        destroy() {
            for (const [, entry] of peers) {
                try {
                    entry.channel?.close()
                    entry.pc.close()
                } catch {
                    // ignore
                }
            }
            peers.clear()
            void options.signaling.leave()
            remoteHandlers.clear()
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
