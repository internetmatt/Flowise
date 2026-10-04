import { describe, expect, it } from 'vitest'
import { emptyFlowchartDocument } from '../schema'
import { buildWalkthroughFrames, exportCinematicMp4, type EncodedChunk, type VideoEncoderHandle } from './mp4'

describe('cinematic MP4 helper', () => {
    it('encodes a walkthrough with a stubbed encoder and muxer', async () => {
        const document = {
            ...emptyFlowchartDocument(),
            nodes: [
                { id: 'A', type: 'flowchart', position: { x: 10, y: 10 }, data: { label: 'Start', shape: 'rect' } },
                { id: 'B', type: 'flowchart', position: { x: 10, y: 120 }, data: { label: 'End', shape: 'rect' } }
            ],
            edges: [{ id: 'e-A-B', source: 'A', target: 'B' }]
        }

        const frames = buildWalkthroughFrames(document, 100)
        expect(frames.length).toBe(4) // title + A + B + finale
        expect(frames.some((frame) => frame.highlightId === 'A')).toBe(true)

        const encoded: EncodedChunk[] = []
        const blob = await exportCinematicMp4(document, {
            holdMs: 100,
            createEncoder: ({ onChunk }) => {
                const handle: VideoEncoderHandle = {
                    encode(frame, options) {
                        const chunk: EncodedChunk = {
                            data: new TextEncoder().encode(`frame-${frame.index}`),
                            timestamp: frame.timestampUs,
                            type: options?.keyFrame ? 'key' : 'delta'
                        }
                        encoded.push(chunk)
                        onChunk(chunk)
                    },
                    flush: async () => undefined,
                    close: () => undefined
                }
                return handle
            },
            createMuxer: () => {
                const parts: Uint8Array[] = []
                return {
                    addVideoChunk(chunk) {
                        parts.push(chunk.data)
                    },
                    finalize() {
                        return new Blob(parts, { type: 'video/mp4' })
                    }
                }
            }
        })

        expect(blob.type).toBe('video/mp4')
        expect(blob.size).toBeGreaterThan(0)
        expect(encoded.length).toBe(frames.length)
        expect(encoded[0]?.type).toBe('key')
    })
})
