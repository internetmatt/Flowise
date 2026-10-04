import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [react()],
    // Vite library mode leaves NODE_ENV for a consuming bundler by default.
    // This IIFE is loaded directly by a browser, with no Node process global.
    // Define this one non-secret constant; never serialize process.env.
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
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
