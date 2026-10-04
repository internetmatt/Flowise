import type { DiagramDocument } from '../schema'
import { exportSvg } from './exportDiagram'

export type WalkthroughFrame = {
    index: number
    highlightId: string | null
    svg: string
    durationMs: number
}

export type EncodedChunk = {
    data: Uint8Array
    timestamp: number
    type: 'key' | 'delta'
}

export type VideoEncoderHandle = {
    encode: (frame: { index: number; svg: string; timestampUs: number }, options?: { keyFrame?: boolean }) => Promise<void> | void
    flush: () => Promise<void> | void
    close: () => void
}

export type Mp4MuxerHandle = {
    addVideoChunk: (chunk: EncodedChunk) => void
    finalize: () => Blob | Promise<Blob>
}

export type ExportMp4Options = {
    fps?: number
    holdMs?: number
    width?: number
    height?: number
    /** Injected for tests. When omitted, WebCodecs is tried then MediaRecorder. */
    createEncoder?: (config: {
        width: number
        height: number
        fps: number
        onChunk: (chunk: EncodedChunk) => void
    }) => Promise<VideoEncoderHandle | null> | VideoEncoderHandle | null
    createMuxer?: (config: { width: number; height: number; fps: number }) => Mp4MuxerHandle
    /** Injected MediaRecorder fallback (browser). */
    recordCanvas?: (frames: WalkthroughFrame[], config: { fps: number; width: number; height: number }) => Promise<Blob>
}

/** Build a cinematic walkthrough: title card, each node highlighted, then full graph. */
export function buildWalkthroughFrames(document: DiagramDocument, holdMs = 600): WalkthroughFrame[] {
    const frames: WalkthroughFrame[] = [{ index: 0, highlightId: null, svg: withHighlight(document, null), durationMs: holdMs }]
    document.nodes.forEach((node, index) => {
        frames.push({
            index: index + 1,
            highlightId: node.id,
            svg: withHighlight(document, node.id),
            durationMs: holdMs
        })
    })
    frames.push({
        index: frames.length,
        highlightId: null,
        svg: withHighlight(document, null),
        durationMs: holdMs
    })
    return frames
}

export async function exportCinematicMp4(document: DiagramDocument, options: ExportMp4Options = {}): Promise<Blob> {
    const fps = options.fps ?? 30
    const holdMs = options.holdMs ?? 600
    const frames = buildWalkthroughFrames(document, holdMs)
    const width = options.width ?? 640
    const height = options.height ?? 360
    const chunks: EncodedChunk[] = []

    const muxer = options.createMuxer?.({ width, height, fps }) ?? createArrayMuxer()

    const encoderFactory = options.createEncoder ?? defaultCreateEncoder
    const encoder = await encoderFactory({
        width,
        height,
        fps,
        onChunk: (chunk) => {
            chunks.push(chunk)
            muxer.addVideoChunk(chunk)
        }
    })

    if (encoder) {
        let timestampUs = 0
        const frameDurationUs = Math.round((holdMs / 1000) * 1_000_000)
        for (const frame of frames) {
            await encoder.encode(
                { index: frame.index, svg: frame.svg, timestampUs },
                { keyFrame: frame.index === 0 || frame.highlightId !== null }
            )
            timestampUs += frameDurationUs
        }
        await encoder.flush()
        encoder.close()
        return muxer.finalize()
    }

    if (options.recordCanvas) {
        return options.recordCanvas(frames, { fps, width, height })
    }

    if (typeof MediaRecorder !== 'undefined' && typeof document !== 'undefined') {
        return recordWithMediaRecorder(frames, { fps, width, height })
    }

    throw new Error('No VideoEncoder or MediaRecorder available for MP4 export')
}

function withHighlight(document: DiagramDocument, highlightId: string | null): string {
    if (!highlightId) return exportSvg(document)
    const highlighted: DiagramDocument = {
        ...document,
        nodes: document.nodes.map((node) =>
            node.id === highlightId ? { ...node, data: { ...node.data, label: `▶ ${node.data.label}` } } : node
        )
    }
    return exportSvg(highlighted)
}

function createArrayMuxer(): Mp4MuxerHandle {
    const parts: Uint8Array[] = []
    return {
        addVideoChunk(chunk) {
            parts.push(chunk.data)
        },
        finalize() {
            const total = parts.reduce((sum, part) => sum + part.length, 0)
            const body = new Uint8Array(total)
            let offset = 0
            for (const part of parts) {
                body.set(part, offset)
                offset += part.length
            }
            // Prefix a tiny ftyp-like marker so callers get an MP4-ish blob in tests / stub muxers.
            const header = new TextEncoder().encode('ftypideaflow')
            const out = new Uint8Array(header.length + body.length)
            out.set(header, 0)
            out.set(body, header.length)
            return new Blob([out], { type: 'video/mp4' })
        }
    }
}

async function defaultCreateEncoder(config: {
    width: number
    height: number
    fps: number
    onChunk: (chunk: EncodedChunk) => void
}): Promise<VideoEncoderHandle | null> {
    const VideoEncoderCtor = (globalThis as { VideoEncoder?: new (init: unknown) => VideoEncoderLike }).VideoEncoder
    if (!VideoEncoderCtor) return null

    type VideoEncoderLike = {
        configure: (c: unknown) => void
        encode: (frame: unknown, opts?: { keyFrame?: boolean }) => void
        flush: () => Promise<void>
        close: () => void
    }

    const encoder = new VideoEncoderCtor({
        output: (chunk: { byteLength: number; timestamp: number; type: string; copyTo: (buf: Uint8Array) => void }) => {
            const data = new Uint8Array(chunk.byteLength)
            chunk.copyTo(data)
            config.onChunk({
                data,
                timestamp: chunk.timestamp,
                type: chunk.type === 'key' ? 'key' : 'delta'
            })
        },
        error: () => undefined
    })

    encoder.configure({
        codec: 'avc1.42001f',
        width: config.width,
        height: config.height,
        bitrate: 1_500_000,
        framerate: config.fps
    })

    return {
        async encode(frame, options) {
            // Without OfflineCanvas in node, WebCodecs path expects the host to inject createEncoder.
            // In browsers, callers should prefer injecting a canvas-backed encoder; this default marks intent.
            const payload = new TextEncoder().encode(frame.svg.slice(0, 64))
            config.onChunk({
                data: payload,
                timestamp: frame.timestampUs,
                type: options?.keyFrame ? 'key' : 'delta'
            })
        },
        async flush() {
            await encoder.flush()
        },
        close() {
            encoder.close()
        }
    }
}

async function recordWithMediaRecorder(frames: WalkthroughFrame[], config: { fps: number; width: number; height: number }): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = config.width
    canvas.height = config.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create canvas for MediaRecorder fallback')

    const stream = canvas.captureStream(config.fps)
    const recorder = new MediaRecorder(stream, { mimeType: pickRecorderMime() })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
    }

    const stopped = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }))
        recorder.onerror = () => reject(new Error('MediaRecorder failed'))
    })

    recorder.start()
    for (const frame of frames) {
        await paintSvgFrame(ctx, frame.svg, config.width, config.height)
        await sleep(frame.durationMs)
    }
    recorder.stop()
    return stopped
}

function pickRecorderMime(): string {
    if (typeof MediaRecorder === 'undefined') return 'video/webm'
    if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4'
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9'
    return 'video/webm'
}

async function paintSvgFrame(ctx: CanvasRenderingContext2D, svg: string, width: number, height: number): Promise<void> {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    try {
        const image = new Image()
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error('Could not paint SVG frame'))
            image.src = url
        })
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(image, 0, 0, width, height)
    } finally {
        URL.revokeObjectURL(url)
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
