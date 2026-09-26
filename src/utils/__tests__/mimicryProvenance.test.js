import { describe, expect, it } from 'vitest'
import { mimicryAssignmentLabel } from '../mimicryProvenance'

describe('mimicry assignment provenance', () => {
  it('distinguishes inferred assignments from subspecies matches and reported records', () => {
    expect(mimicryAssignmentLabel({ mimicry_assignment_level: 'species_unambiguous_subspecies' })).toContain('Inferred')
    expect(mimicryAssignmentLabel({ mimicry_assignment_level: 'exact_subspecies' })).toBe('Matched to subspecies')
    expect(mimicryAssignmentLabel({ mimicry_assignment_level: 'dore_record' })).toBe('Reported by Doré et al.')
  })
  it('does not infer confidence for legacy records lacking provenance', () => {
    expect(mimicryAssignmentLabel({ mimicry_ring: 'clearwing' })).toBe('Assignment not recorded')
    expect(mimicryAssignmentLabel({ mimicry_assignment_level: 'unassigned' })).toBe('Unassigned')
  })
})
