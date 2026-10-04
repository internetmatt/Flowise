/** Preview-only stand-in. The real `yjs` package is declared but not installed in this tree. */
export class Doc {
    private texts = new Map<string, Text>()
    getText(name: string) {
        let text = this.texts.get(name)
        if (!text) {
            text = new Text()
            this.texts.set(name, text)
        }
        return text
    }
    on() {
        return
    }
    off() {
        return
    }
    transact(fn: () => void) {
        fn()
    }
}

export class Text {
    private value = ''
    private handlers: Array<() => void> = []
    insert(index: number, value: string) {
        this.value = this.value.slice(0, index) + value + this.value.slice(index)
        this.handlers.forEach((handler) => handler())
    }
    delete(index: number, length: number) {
        this.value = this.value.slice(0, index) + this.value.slice(index + length)
        this.handlers.forEach((handler) => handler())
    }
    toString() {
        return this.value
    }
    observe(handler: () => void) {
        this.handlers.push(handler)
    }
}
