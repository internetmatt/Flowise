import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    root: 'preview',
    plugins: [react()],
    resolve: {
        alias: {
            yjs: resolve(__dirname, 'preview/yjs-stub.ts')
        }
    },
    server: {
        host: '127.0.0.1',
        port: 8092,
        strictPort: true
    }
})
