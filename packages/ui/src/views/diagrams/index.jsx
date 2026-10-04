import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material'
import chatflowsApi from '@/api/chatflows'
import useApi from '@/hooks/useApi'
import MainCard from '@/ui-component/cards/MainCard'

const Diagrams = () => {
    const navigate = useNavigate()
    const listApi = useApi(chatflowsApi.getAllDiagrams)

    useEffect(() => {
        listApi.request({ page: 1, limit: 50 })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const rows = Array.isArray(listApi.data) ? listApi.data : listApi.data?.data || []

    return (
        <MainCard>
            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 2 }}>
                <Typography variant='h3'>Diagrams</Typography>
                <Button variant='contained' onClick={() => navigate('/diagram')}>
                    New flowchart
                </Button>
            </Stack>
            {listApi.loading ? <Typography>Loading diagrams…</Typography> : null}
            {!listApi.loading && rows.length === 0 ? <Typography>No diagrams yet.</Typography> : null}
            <Box>
                <List>
                    {rows.map((diagram) => (
                        <ListItemButton key={diagram.id} onClick={() => navigate(`/diagram/${diagram.id}`)}>
                            <ListItemText primary={diagram.name} secondary={diagram.type} />
                        </ListItemButton>
                    ))}
                </List>
            </Box>
        </MainCard>
    )
}

export default Diagrams
