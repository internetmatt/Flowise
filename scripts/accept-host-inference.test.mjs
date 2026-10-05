import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

for (const scenario of ['missing-token', 'invalid-base']) {
    test(`preflight ${scenario} exits nonzero and emits only redacted failure evidence`, async () => {
        const dir = await mkdtemp(resolve(tmpdir(), 'inference-report-test-'))
        const path = resolve(dir, 'report.json')
        const sentinel = 'never-serialize-this-bearer'
        try {
            const env = { ...process.env, IDEAFLOW_ACCEPTANCE_REPORT: path, PROJECTO_OPERATOR_API_KEY: sentinel }
            delete env.IDEAFLOW_HOST_INFERENCE_TOKEN
            env.IDEAFLOW_HOST_INFERENCE_BASE = 'http://127.0.0.1:4716/v1'
            if (scenario === 'invalid-base') {
                env.IDEAFLOW_HOST_INFERENCE_TOKEN = sentinel
                env.IDEAFLOW_HOST_INFERENCE_BASE = `https://user:${sentinel}@example.test/v1`
            }
            const child = spawnSync(process.execPath, ['scripts/accept-host-inference.mjs'], { env, encoding: 'utf8' })
            assert.equal(child.status, 1)
            const raw = await readFile(path, 'utf8')
            assert.ok(!`${raw}${child.stdout}${child.stderr}`.includes(sentinel))
            const report = JSON.parse(raw)
            assert.equal(report.status, 'fail')
            assert.equal(report.liveGatewayAccepted, false)
            assert.deepEqual(report.checks, [{ name: 'configuration', status: 'fail' }])
        } finally { await rm(dir, { recursive: true, force: true }) }
    })
}
