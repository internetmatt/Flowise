import test from 'node:test'
import assert from 'node:assert/strict'
import { createManagementDraft } from './draft.mjs'
const input = { flowId: 'f1', revisionId: 'r1', presetName: 'Internal', modelRef: 'local-model', scopes: ['project'] }
test('schedule draft pins revision and cannot enable dispatch', () => {
    const result = createManagementDraft({ ...input, schedule: { prompt: 'Draft card', time: '09:00', timezone: 'America/New_York', overlap: 'skip', enabled: true } })
    assert.equal(result.workflow.revisionId, 'r1')
    assert.equal(result.schedule.enabled, false)
    assert.equal(result.schedule.catchup, 'skip')
})
test('memory scopes reject unrecognized authority and deduplicate selections', () => {
    assert.throws(() => createManagementDraft({ ...input, scopes: ['all-tenants'] }), /Unsupported/)
    assert.deepEqual(createManagementDraft({ ...input, scopes: ['project', 'project'] }).preset.memoryScopes, ['project'])
})
test('unbound revision and invalid schedule cannot export', () => {
    assert.throws(() => createManagementDraft({ ...input, revisionId: '' }), /revision/)
    for (const change of [{ time: '25:00' }, { timezone: 'invalid' }, { prompt: '' }, { overlap: 'parallel' }]) {
        assert.throws(() => createManagementDraft({ ...input, schedule: { prompt: 'Draft', time: '09:00', timezone: 'UTC', overlap: 'skip', ...change } }))
    }
})
