import type { BaseMessage } from '@langchain/core/messages'

/** Reasoning and SSE text fields cannot contain multimodal content blocks. */
export function messageContentText(content: BaseMessage['content']): string {
    if (typeof content === 'string') return content
    return content.map((block) => (block.type === 'text' && typeof block.text === 'string' ? block.text : '')).join('')
}
