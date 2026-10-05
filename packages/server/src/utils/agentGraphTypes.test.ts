import { messageContentText } from './agentGraphTypes'

describe('agent graph reasoning content', () => {
    it('preserves ordinary text', () => {
        expect(messageContentText('worker result')).toBe('worker result')
    })

    it('projects text blocks without exposing images as reasoning text', () => {
        expect(
            messageContentText([
                { type: 'text', text: 'first' },
                { type: 'image_url', image_url: { url: 'https://example.test/image.png' } },
                { type: 'text', text: 'second' }
            ])
        ).toBe('firstsecond')
        expect(messageContentText([])).toBe('')
    })
})
