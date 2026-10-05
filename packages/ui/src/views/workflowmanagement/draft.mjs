export function createManagementDraft({ flowId, revisionId, presetName, modelRef, scopes, schedule }) {
    if (!flowId?.trim() || !revisionId?.trim()) throw new Error('Flow and pinned revision are required.')
    if (!presetName?.trim() || !modelRef?.trim()) throw new Error('Preset name and registered model reference are required.')
    const allowed = ['user-agent', 'project', 'workspace']
    if (!Array.isArray(scopes) || scopes.some((scope) => !allowed.includes(scope))) throw new Error('Unsupported memory scope.')
    if (schedule) {
        if (!schedule.prompt?.trim()) throw new Error('A scheduled session needs a task brief.')
        if (!/^\d{2}:\d{2}$/.test(schedule.time) || Number(schedule.time.slice(0, 2)) > 23 || Number(schedule.time.slice(3)) > 59)
            throw new Error('Choose a valid daily time.')
        try { new Intl.DateTimeFormat('en', { timeZone: schedule.timezone }).format() } catch { throw new Error('Choose a valid timezone.') }
        if (!['skip', 'queue'].includes(schedule.overlap)) throw new Error('Choose an overlap policy.')
    }
    return {
        schemaVersion: 'ideaflow-management-draft/v1',
        status: 'draft',
        workflow: { flowId: flowId.trim(), revisionId: revisionId.trim() },
        preset: { name: presetName.trim(), modelRef: modelRef.trim(), memoryScopes: [...new Set(scopes)] },
        schedule: schedule ? { ...schedule, enabled: false, cadence: 'daily', catchup: 'skip' } : null
    }
}
