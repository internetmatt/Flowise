import { useState } from 'react'
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { createManagementDraft } from './draft.mjs'

export default function WorkflowManagement() {
    const [form, setForm] = useState({ flowId: '', revisionId: '', presetName: '', modelRef: '', prompt: '', time: '09:00', timezone: 'America/New_York', overlap: 'skip' })
    const [scopes, setScopes] = useState([])
    const [scheduled, setScheduled] = useState(false)
    const [revisions, setRevisions] = useState([])
    const [error, setError] = useState('')
    const [brief, setBrief] = useState('')
    const [requests, setRequests] = useState([])
    const field = (name, label, props = {}) => <TextField label={label} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} {...props} />
    const snapshot = () => createManagementDraft({ ...form, scopes, schedule: scheduled ? { prompt: form.prompt, time: form.time, timezone: form.timezone, overlap: form.overlap } : null })
    const checkpoint = () => {
        try { const draft = snapshot(); setRevisions([...revisions, draft]); setError('') } catch (err) { setError(err.message) }
    }
    const download = () => {
        try {
            const draft = snapshot()
            const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }))
            const link = document.createElement('a'); link.href = url; link.download = 'workflow-management-draft.json'; link.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000); setError('')
        } catch (err) { setError(err.message) }
    }
    const prepareSession = () => {
        try {
            if (!brief.trim()) throw new Error('Enter a task brief.')
            setRequests([...requests, { brief: brief.trim(), binding: snapshot() }]); setBrief(''); setError('')
        } catch (err) { setError(err.message) }
    }
    return <Stack spacing={3} sx={{ p: 3 }}>
        <Typography variant='h3'>Workflow management drafts</Typography>
        <Alert severity='info'>Prepare version, memory and scheduled-session settings. Drafts stay in this tab until exported. Activation and memory access require host integration.</Alert>
        {error && <Alert severity='error'>{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px 1fr' }, gap: 3 }}>
            <Paper sx={{ p: 2 }}><Stack spacing={2}>
                <Typography variant='h5'>Versions rail</Typography>
                {revisions.length === 0 && <Typography>No draft checkpoints yet.</Typography>}
                {revisions.map((draft, index) => <Button key={index} variant='outlined' onClick={() => {
                    setForm({ flowId: draft.workflow.flowId, revisionId: draft.workflow.revisionId, presetName: draft.preset.name, modelRef: draft.preset.modelRef, prompt: draft.schedule?.prompt || '', time: draft.schedule?.time || '09:00', timezone: draft.schedule?.timezone || 'America/New_York', overlap: draft.schedule?.overlap || 'skip' })
                    setScopes(draft.preset.memoryScopes); setScheduled(Boolean(draft.schedule)); setError('')
                }}>Draft {index + 1}: {draft.workflow.revisionId}</Button>)}
                <Button onClick={checkpoint}>Add draft checkpoint</Button>
            </Stack></Paper>
            <Stack spacing={3}>
                <Paper sx={{ p: 2 }}><Stack spacing={2}>
                    <Typography variant='h5'>Internet Matt chat loop — session drafts</Typography>
                    <Typography variant='body2'>Prepare a task against the selected version and memory preset. These requests have not been dispatched.</Typography>
                    {requests.map((request, index) => <Box key={index} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography>{request.brief}</Typography>
                        <Typography variant='caption'>Pinned {request.binding.workflow.revisionId} · {request.binding.preset.name} · {request.binding.preset.memoryScopes.join(', ') || 'No memory scopes'}</Typography>
                    </Box>)}
                    <TextField label='Task for the agent' multiline minRows={3} value={brief} onChange={(event) => setBrief(event.target.value)} />
                    <Button onClick={prepareSession}>Prepare session request</Button>
                </Stack></Paper>
                <Paper sx={{ p: 2 }}><Stack spacing={2}>
                    <Typography variant='h5'>Workflow and memory preset</Typography>
                    {field('flowId', 'Flow ID')}{field('revisionId', 'Pinned revision reference')}
                    {field('presetName', 'Preset name')}{field('modelRef', 'Registered local inference model reference')}
                    {['user-agent', 'project', 'workspace'].map((scope) => <FormControlLabel key={scope} label={`${scope} memory`} control={<Checkbox checked={scopes.includes(scope)} onChange={(event) => setScopes(event.target.checked ? [...scopes, scope] : scopes.filter((item) => item !== scope))} />} />)}
                    <Typography variant='body2'>Selections request scopes; they do not grant access.</Typography>
                </Stack></Paper>
                <Paper sx={{ p: 2 }}><Stack spacing={2}>
                    <Typography variant='h5'>Scheduled chat session</Typography>
                    <FormControlLabel label='Include a daily schedule draft' control={<Checkbox checked={scheduled} onChange={(event) => setScheduled(event.target.checked)} />} />
                    {scheduled && <>{field('prompt', 'Task brief', { multiline: true, minRows: 3 })}{field('time', 'Local time', { type: 'time', InputLabelProps: { shrink: true } })}{field('timezone', 'IANA timezone')}
                    {field('overlap', 'When the previous run is active', { select: true, children: [<MenuItem key='skip' value='skip'>Skip occurrence</MenuItem>, <MenuItem key='queue' value='queue'>Queue occurrence</MenuItem>] })}
                    <Typography variant='body2'>Missed occurrences are skipped. Exported schedules are disabled pending server validation.</Typography></>}
                </Stack></Paper>
                <Button variant='contained' onClick={download}>Export management draft</Button>
            </Stack>
        </Box>
    </Stack>
}
