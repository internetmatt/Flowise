import { defineConfig } from 'cypress'

export default defineConfig({
    video: true,
    viewportWidth: 1440,
    viewportHeight: 1000,
    e2e: {
        setupNodeEvents() {
            // implement node event listeners here
        }
    }
})
