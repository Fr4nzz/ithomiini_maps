import { describe, expect, it } from 'vitest'
import { clusterComposition, clusterMemberColor, clusterCircleRadius } from '../clusterComposition'

const colors = {
  colorBy: 'subspecies', colorAttribute: 'subspecies',
  activeColorMap: { casabranca: '#111111', travella: '#222222', derasa: '#333333' },
  speciesColorMap: { 'Mechanitis polymnia': '#aaaaaa' },
  collapsedSpecies: ['Mechanitis polymnia'],
  shownLabels: new Set(['travella', 'derasa']),
}

describe('cluster composition', () => {
  it('counts exact member records with map color and grey overflow semantics', () => {
    const members = [
      { properties: { scientific_name: 'Mechanitis polymnia', subspecies: 'casabranca' } },
      { properties: { scientific_name: 'Mechanitis polymnia', subspecies: 'Unknown' } },
      { properties: { scientific_name: 'Ithomia salapia', subspecies: 'travella' } },
      { properties: { scientific_name: 'Ithomia salapia', subspecies: 'derasa' } },
      { properties: { scientific_name: 'Other species', subspecies: 'casabranca' } },
    ]
    const result = clusterComposition(members, colors)
    expect(result.total).toBe(5)
    expect(result.segments).toEqual([
      { color: '#222222', count: 1, fraction: 0.2 },
      { color: '#333333', count: 1, fraction: 0.2 },
      { color: '#6b7280', count: 1, fraction: 0.2 },
      { color: '#aaaaaa', count: 2, fraction: 0.4 },
    ])
    expect(result.segments.reduce((sum, segment) => sum + segment.fraction, 0)).toBe(1)
  })

  it('uses active palette directly for expanded species and other color modes', () => {
    expect(clusterMemberColor({ scientific_name: 'Mechanitis polymnia', subspecies: 'casabranca' }, {
      ...colors, collapsedSpecies: [], shownLabels: new Set(),
    })).toBe('#111111')
    expect(clusterMemberColor({ sequencing_status: 'Sequenced' }, {
      ...colors, colorBy: 'status', colorAttribute: 'sequencing_status',
      activeColorMap: { Sequenced: '#00ff00' },
      shownLabels: new Set(['Sequenced']),
    })).toBe('#00ff00')
  })

  it('keeps deterministic radius thresholds without a minimum segment size', () => {
    expect([2, 20, 50, 100, 500].map(clusterCircleRadius)).toEqual([12, 16, 20, 25, 32])
    const result = clusterComposition([
      ...Array.from({ length: 99 }, () => ({ subspecies: 'travella' })),
      { subspecies: 'derasa' },
    ], colors)
    expect(result.segments.find(segment => segment.color === '#333333').fraction).toBe(0.01)
  })
})
