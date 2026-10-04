import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dotenv from 'dotenv'
import { createReadStream, existsSync, cpSync, statSync } from 'fs'

function diagramStudioPlugin() {
    const dist = resolve(__dirname, '../diagram/dist')
    const serveDist = (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/diagram-studio/')) return next()
        const rel = decodeURIComponent(url.slice('/diagram-studio/'.length).split('?')[0])
        if (!rel || rel.includes('..')) {
            res.statusCode = 400
            res.end('bad path')
            return
        }
        const target = resolve(dist, rel)
        if (!target.startsWith(dist) || !existsSync(target) || !statSync(target).isFile()) {
            res.statusCode = 404
            res.end('diagram bundle missing — build @openideas/diagram')
            return
        }
        const type = target.endsWith('.css') ? 'text/css' : 'text/javascript'
        res.setHeader('Content-Type', type)
        createReadStream(target).pipe(res)
    }
    return {
        name: 'openideas-diagram-studio',
        configureServer(server) {
            server.middlewares.use(serveDist)
        },
        configurePreviewServer(server) {
            server.middlewares.use(serveDist)
        },
        closeBundle() {
            if (!existsSync(dist)) return
            cpSync(dist, resolve(__dirname, 'build/diagram-studio'), { recursive: true })
        }
    }
}

export default defineConfig(async ({ mode }) => {
    let proxy = undefined
    if (mode === 'development') {
        const serverEnv = dotenv.config({ processEnv: {}, path: '../server/.env' }).parsed
        const serverHost = serverEnv?.['HOST'] ?? 'localhost'
        const serverPort = parseInt(serverEnv?.['PORT'] ?? 3000)
        if (!Number.isNaN(serverPort) && serverPort > 0 && serverPort < 65535) {
            proxy = {
                '^/api(/|$).*': {
                    target: `http://${serverHost}:${serverPort}`,
                    changeOrigin: true
                }
            }
        }
    }

    dotenv.config()
    return {
        plugins: [react(), diagramStudioPlugin()],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src'),
                '@codemirror/state': resolve(__dirname, '../../node_modules/@codemirror/state'),
                '@codemirror/view': resolve(__dirname, '../../node_modules/@codemirror/view'),
                '@codemirror/language': resolve(__dirname, '../../node_modules/@codemirror/language'),
                '@codemirror/lang-javascript': resolve(__dirname, '../../node_modules/@codemirror/lang-javascript'),
                '@codemirror/lang-json': resolve(__dirname, '../../node_modules/@codemirror/lang-json'),
                '@uiw/react-codemirror': resolve(__dirname, '../../node_modules/@uiw/react-codemirror'),
                '@uiw/codemirror-theme-vscode': resolve(__dirname, '../../node_modules/@uiw/codemirror-theme-vscode'),
                '@uiw/codemirror-theme-sublime': resolve(__dirname, '../../node_modules/@uiw/codemirror-theme-sublime'),
                '@lezer/common': resolve(__dirname, '../../node_modules/@lezer/common'),
                '@lezer/highlight': resolve(__dirname, '../../node_modules/@lezer/highlight')
            }
        },
        root: resolve(__dirname),
        build: {
            outDir: './build'
        },
        server: {
            open: true,
            proxy,
            port: process.env.VITE_PORT ?? 8080,
            host: process.env.VITE_HOST
        }
    }
})
