import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/mount.tsx'),
            name: 'OpenIdeasDiagram',
            formats: ['iife'],
            fileName: () => 'diagram.js'
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
                assetFileNames: (info) => (info.name?.endsWith('.css') ? 'diagram.css' : 'assets/[name][extname]')
            }
        },
        cssCodeSplit: false,
        emptyOutDir: true
    }
})
