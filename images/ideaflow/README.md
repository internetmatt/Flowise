# IdeaFlow browser-test visuals

Captured October 5, 2026 UTC (October 4 in America/New_York) from the real production browser regression, using a disposable SQLite workspace. Baseline: IdeaFlow `d23f5e92`; experimental visuals include the changes on `experiment/internetmatt-studio-variant`.

- `diagram-studio.png`: original React Flow renderer, saved/reloaded diagram.
- `agents-list.png`: new agent present in the Agents view.
- `internetmatt-light.png` / `internetmatt-dark.png`: experimental flow-canvas renderer and shared token themes.
- `internetmatt-save-reload.gif`: a loop of four captured test checkpoints (created → edited → saved → reloaded), not a continuous interaction recording. Frames are resized and palette-optimized; no UI elements are fabricated or removed.

The browser tests use real registration, tenant API requests, persistence and signaling, with no mocked APIs. Fixture records are deleted afterward. No live inference gateway is running in this environment; screenshots retain its unavailable status. These captures do not demonstrate AI generation or agent execution.

## Reproduce

Build and start IdeaFlow in a disposable local database, then run:

```bash
IDEAFLOW_URL=http://127.0.0.1:3000 \
IDEAFLOW_CAPTURE_DIR=/tmp/ideaflow-captures \
node scripts/validate-diagram-live.mjs

IDEAFLOW_URL=http://127.0.0.1:3000 \
IDEAFLOW_STUDIO_VARIANT=internetmatt \
IDEAFLOW_CAPTURE_DIR=/tmp/ideaflow-variant-captures \
node scripts/validate-diagram-live.mjs
```

For a browser already installed elsewhere, set `IDEAFLOW_BROWSER_PATH`. For an authenticated instance use `IDEAFLOW_STORAGE_STATE`; local account registration expects an empty disposable organization. Capture uses a light browser color scheme; the variant also explicitly tests its dark theme.

PNG files are resized to 1080×750. GIF frames are resized to 864×600 and held for 1.2, 1.6, 1.4 and 2.4 seconds. Keep both default-renderer and experimental evidence when refreshing this gallery.
