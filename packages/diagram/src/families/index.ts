import type { DiagramFamily } from '../schema'
import { agentFamily } from './agent'
import { architectureFamily } from './architecture'
import { classFamily } from './class'
import { flowchartFamily } from './flowchart'
import { erFamily } from './er'
import { journeyFamily } from './journey'
import { mindmapFamily } from './mindmap'
import { schematicFamily } from './schematic'
import { sequenceFamily } from './sequence'
import { stateFamily } from './state'
import type { DiagramFamilyModule } from './types'

const MODULES: Record<DiagramFamily, DiagramFamilyModule> = {
    flowchart: flowchartFamily,
    architecture: architectureFamily,
    er: erFamily,
    class: classFamily,
    state: stateFamily,
    sequence: sequenceFamily,
    mindmap: mindmapFamily,
    journey: journeyFamily,
    schematic: schematicFamily,
    agent: agentFamily
}

export function getFamily(family: DiagramFamily): DiagramFamilyModule {
    return MODULES[family]
}

export function pictureFamilies(): DiagramFamilyModule[] {
    return Object.values(MODULES).filter((module) => module.id !== 'agent')
}

export type { DiagramFamilyModule, FamilyGraph } from './types'
