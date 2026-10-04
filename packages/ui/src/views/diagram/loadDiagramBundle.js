const STYLE_ID = 'openideas-diagram-studio-css'

export function diagramAssetBase() {
    const base = import.meta.env.BASE_URL || '/'
    return `${base.endsWith('/') ? base : `${base}/`}diagram-studio`
}

export function loadDiagramStudio() {
    if (window.OpenIdeasDiagram?.mount) return Promise.resolve(window.OpenIdeasDiagram)
    const assetBase = diagramAssetBase()
    return new Promise((resolve, reject) => {
        if (!document.getElementById(STYLE_ID)) {
            const css = document.createElement('link')
            css.id = STYLE_ID
            css.rel = 'stylesheet'
            css.href = `${assetBase}/diagram.css`
            document.head.appendChild(css)
        }
        const script = document.createElement('script')
        script.src = `${assetBase}/diagram.js`
        script.async = true
        script.onload = () => {
            if (window.OpenIdeasDiagram?.mount) resolve(window.OpenIdeasDiagram)
            else reject(new Error('Diagram bundle did not register OpenIdeasDiagram'))
        }
        script.onerror = () => reject(new Error('Failed to load the diagram bundle. Build @openideas/diagram first.'))
        document.body.appendChild(script)
    })
}
