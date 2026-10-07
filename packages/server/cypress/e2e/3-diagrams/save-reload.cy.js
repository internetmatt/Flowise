// Real app/database validation; no intercepted or stubbed API responses.
// Run against a disposable OSS loopback instance, or an authenticated test workspace.
describe('diagram live save/reload', () => {
    const origin = Cypress.env('IDEAFLOW_URL') || 'http://localhost:3000'
    const name = `Save reload regression ${Date.now()}`
    const dsl = 'flowchart TD\n  A[Persisted start] --> B[Persisted end]'
    let id

    before(() => {
        // CI starts a disposable OSS instance with an empty database. Create its
        // first workspace through the real registration API. Remote test instances
        // must supply their normal authenticated workspace instead.
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            cy.request({
                method: 'POST',
                url: `${origin}/api/v1/account/register`,
                failOnStatusCode: false,
                body: {
                    user: { name: 'Diagram Regression', email: 'diagram-regression@example.test', credential: 'LocalRegressionTest42!' }
                }
            }).then(({ status, body }) => {
                if (status !== 201) expect(String(body.message || body)).to.contain('one organization')
            })
        }
    })

    beforeEach(() => {
        id = undefined
    })

    afterEach(() => {
        if (id) cy.request({ method: 'DELETE', url: `${origin}/api/v1/chatflows/${id}`, headers: { 'x-request-from': 'internal' } })
    })

    it('persists the name, DSL, graph and viewport through /diagram/:id reload', () => {
        cy.visit(`${origin}/diagram`)
        cy.location('pathname')
            .should('match', /^\/diagram\/[^/]+$/)
            .then((path) => {
                id = path.split('/').pop()
            })
        cy.get('[aria-label="Diagram name"]').clear().type(name).blur()
        cy.contains('label', 'DSL').find('textarea').clear().type(dsl, { parseSpecialCharSequences: false })
        cy.get('.react-flow__node').should('have.length', 2)
        cy.contains('button', /^Save$/).click()
        cy.get('.ideaflow-note').should('contain', 'Saved')
        cy.then(() => cy.request({ url: `${origin}/api/v1/chatflows/${id}`, headers: { 'x-request-from': 'internal' } })).then(
            ({ body }) => {
                expect(body.name).to.equal(name)
                expect(body.type).to.equal('DIAGRAM')
                const document = JSON.parse(body.flowData)
                expect(document.dsl).to.equal(dsl)
                expect(document.nodes.map((node) => node.id)).to.deep.equal(['A', 'B'])
                expect(document.edges).to.have.length(1)
                // The fallback grid starts at (80, 0). Assert real ELK output so a
                // caught worker failure cannot quietly make this regression pass.
                expect(document.nodes[0].position.x).to.be.lessThan(80)
                expect(document.nodes[0].position.y).to.be.greaterThan(0)
                expect(document.nodes[1].position.y).to.be.greaterThan(document.nodes[0].position.y)
                expect(document.viewport).to.have.keys('x', 'y', 'zoom')
                cy.reload()
                cy.get('[aria-label="Diagram name"]').should('have.value', name)
                cy.contains('label', 'DSL').find('textarea').should('have.value', dsl)
                cy.get('.react-flow__node').should('have.length', 2)
                cy.then(() => cy.request({ url: `${origin}/api/v1/chatflows/${id}`, headers: { 'x-request-from': 'internal' } }))
                    .its('body.flowData')
                    .should('equal', body.flowData)
                cy.screenshot('diagram-saved-and-reloaded', { capture: 'viewport' })
            }
        )
        // A second layout after reload exercises a fresh worker and direction.
        const horizontalDsl = dsl.replace('flowchart TD', 'flowchart LR')
        cy.contains('label', 'DSL').find('textarea').clear().type(horizontalDsl, { parseSpecialCharSequences: false })
        cy.get('.react-flow__node[data-id="B"]').should(($node) => {
            const transform = new DOMMatrix($node[0].style.transform)
            expect(transform.m41).to.be.greaterThan(150)
        })
        cy.contains('button', /^Save$/).click()
        cy.get('.ideaflow-note').should('contain', 'Saved')
        cy.then(() => cy.request({ url: `${origin}/api/v1/chatflows/${id}`, headers: { 'x-request-from': 'internal' } })).then(
            ({ body }) => {
                const document = JSON.parse(body.flowData)
                expect(document.dsl).to.equal(horizontalDsl)
                expect(document.nodes[0].position.x).to.be.greaterThan(0)
                expect(document.nodes[1].position.x).to.be.greaterThan(document.nodes[0].position.x)
                expect(document.nodes[1].position.y).to.equal(document.nodes[0].position.y)
                cy.screenshot('diagram-relayout-after-reload', { capture: 'viewport' })
            }
        )
    })
    it('keeps a newly saved v2 agent visible in the Agents list', () => {
        id = undefined
        cy.visit(`${origin}/v2/agentcanvas`)
        cy.location('pathname')
            .should('match', /^\/v2\/agentcanvas\/[^/]+$/)
            .then((path) => {
                id = path.split('/').pop()
            })
        cy.get('[aria-label="Agent name"]').clear().type(name).blur()
        cy.contains('button', /^Save$/).click()
        cy.get('.ideaflow-note').should('contain', 'Saved')
        cy.then(() => cy.request({ url: `${origin}/api/v1/chatflows/${id}`, headers: { 'x-request-from': 'internal' } }))
            .its('body.type')
            .should('equal', 'AGENTFLOW')
        cy.contains('a', 'Agents').click()
        cy.location('pathname').should('equal', '/agentflows')
        cy.contains(name).should('be.visible')
        cy.screenshot('saved-agent-in-agents-list', { capture: 'viewport' })
        cy.then(() => cy.request({ url: `${origin}/api/v1/chatflows?type=AGENTFLOW`, headers: { 'x-request-from': 'internal' } })).then(
            ({ body }) => {
                expect((Array.isArray(body) ? body : body.data).some((record) => record.id === id)).to.equal(true)
            }
        )
    })
})
