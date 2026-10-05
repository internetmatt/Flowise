import { definePfControls } from './pf-controls.ts';
import { definePfFlow } from './pf-flow.ts';
import { definePfHandle } from './pf-handle.ts';
import { definePfMinimap } from './pf-minimap.ts';
import { definePfNode } from './pf-node.ts';

/** Register all `<pf-*>` custom elements (idempotent). */
export function registerFlowCanvas(): void {
  definePfHandle();
  definePfNode();
  definePfControls();
  definePfMinimap();
  definePfFlow();
}
