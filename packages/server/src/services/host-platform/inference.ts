export type HostInferenceConfig = {
    baseUrl: URL
    authorization: string
}

/**
 * Resolve IdeaFlow's host inference boundary without coupling the product to a
 * particular host implementation. Projecto variables are temporary server-only
 * aliases for existing deployments and must not escape into browser contracts.
 */
export function resolveHostInferenceConfig(env: NodeJS.ProcessEnv = process.env): HostInferenceConfig {
    const token = env.IDEAFLOW_HOST_INFERENCE_TOKEN || env.PROJECTO_OPERATOR_API_KEY
    if (!token) throw new Error('Host inference is not configured')

    const rawBase = env.IDEAFLOW_HOST_INFERENCE_BASE || env.PROJECTO_INFERENCE_BASE || 'http://127.0.0.1:4716/v1'
    const baseUrl = new URL(rawBase)
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
        throw new Error('Invalid host inference configuration')
    }
    return { baseUrl, authorization: `Bearer ${token}` }
}

export async function hostInferenceRequest(
    path: '/models' | '/chat/completions',
    body?: unknown,
    env: NodeJS.ProcessEnv = process.env
) {
    const config = resolveHostInferenceConfig(env)
    return fetch(`${config.baseUrl.href.replace(/\/+$/, '')}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: config.authorization },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
        redirect: 'error'
    })
}
