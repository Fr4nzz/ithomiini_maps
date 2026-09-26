import { describe, expect, it } from 'vitest'
import { buildClusterOutlineExpression, buildPointCirclePaint, buildPointColorExpression, buildPointSortKeyExpression, buildRangePointCirclePaint, pointMarkerAppearance, visiblePointRadius } from '../useDataLayer'
import { getColoredShapeImageName } from '../../utils/shapes'

describe('point color expressions', () => {
  const colorMap = { casabranca: '#111111', travella: '#222222' }
  const speciesColorMap = { 'Mechanitis polymnia': '#aabbcc' }
  const collapsedSpecies = ['Mechanitis polymnia']

  it('colors every record of a collapsed species before checking subspecies', () => {
    const expression = buildPointColorExpression({
      colorMap,
      colorAttribute: 'subspecies',
      speciesColorMap,
      collapsedSpecies,
      shownLabels: new Set(['travella']),
    })
    expect(expression).toEqual([
      'case',
      ['==', ['get', 'scientific_name'], 'Mechanitis polymnia'], '#aabbcc',
      ['match', ['get', 'subspecies'], 'casabranca', '#6b7280', 'travella', '#222222', '#6b7280'],
    ])
  })

  it('keeps range point colors when no legend overflow set is supplied', () => {
    expect(buildPointColorExpression({
      colorMap,
      colorAttribute: 'subspecies',
      speciesColorMap,
      collapsedSpecies,
    })).toEqual([
      'case',
      ['==', ['get', 'scientific_name'], 'Mechanitis polymnia'], '#aabbcc',
      ['match', ['get', 'subspecies'], 'casabranca', '#111111', 'travella', '#222222', '#6b7280'],
    ])
  })

  it('sorts collapsed species with the colored points even for unknown subspecies', () => {
    expect(buildPointSortKeyExpression('subspecies', new Set(['travella']), collapsedSpecies)).toEqual([
      'case',
      ['any',
        ['in', ['get', 'scientific_name'], ['literal', collapsedSpecies]],
        ['in', ['get', 'subspecies'], ['literal', ['travella']]],
      ],
      1, 0,
    ])
  })
})

describe('native marker appearance', () => {
  const settings = {
    colorBy: 'subspecies', colorAttribute: 'subspecies',
    colorMap: { casabranca: '#111111', travella: '#222222' },
    speciesColorMap: { 'Mechanitis polymnia': '#aabbcc' },
    collapsedSpecies: ['Mechanitis polymnia'], shownLabels: new Set(['travella']),
    speciesBorderColors: { 'Mechanitis polymnia': '#ffcc00' },
    speciesBordersEnabled: true, shapesEnabled: false,
    getGroupShape: () => 'square',
    style: { borderColor: '#ffffff', borderWidth: 2, fillOpacity: 0.4, borderOpacity: 0.8 },
  }

  it('keeps collapsed species color and independent fill/border opacities', () => {
    expect(pointMarkerAppearance({ scientific_name: 'Mechanitis polymnia', subspecies: 'unknown' }, settings)).toEqual({
      shape: 'circle', fill: '#aabbcc', stroke: '#ffcc00', width: 2,
      fillOpacity: 0.4, strokeOpacity: 0.8,
    })
    expect(pointMarkerAppearance({ scientific_name: 'Ithomia salapia', subspecies: 'casabranca' }, settings).fill).toBe('#6b7280')
  })

  it('restores default circle size, collapsed color, and species borders', () => {
    const paint = buildPointCirclePaint({
      style: { ...settings.style, pointSize: 10 }, colorMap: settings.colorMap,
      colorAttribute: settings.colorAttribute, speciesColorMap: settings.speciesColorMap,
      collapsedSpecies: settings.collapsedSpecies, shownLabels: settings.shownLabels,
      speciesBordersEnabled: true, speciesBorderColors: settings.speciesBorderColors,
    })
    expect(paint['circle-radius']).toEqual(['interpolate', ['linear'], ['zoom'],
      3, 3.375, 6, 5.625, 10, 9, 14, 13.5])
    expect(paint['circle-color'][0]).toBe('case')
    expect(paint['circle-color'][2]).toBe('#aabbcc')
    expect(paint['circle-stroke-color']).toEqual(['match', ['get', 'scientific_name'],
      'Mechanitis polymnia', '#ffcc00', '#ffffff'])
    expect(paint['circle-opacity']).toBe(0.4)
    expect(paint['circle-stroke-opacity']).toBe(0.8)
  })

  it('restores range point radii and retains collapsed color without overflow greying', () => {
    const paint = buildRangePointCirclePaint({
      radii: [[3, 1.5], [6, 2.5], [10, 4], [14, 6]],
      colorMap: settings.colorMap, colorAttribute: settings.colorAttribute,
      speciesColorMap: settings.speciesColorMap, collapsedSpecies: settings.collapsedSpecies,
      opacity: 0.5, strokeWidth: 0.5, strokeOpacity: 0.3,
    })
    expect(paint['circle-radius']).toEqual(['interpolate', ['linear'], ['zoom'],
      3, 1.5, 6, 2.5, 10, 4, 14, 6])
    expect(paint['circle-color'][2]).toBe('#aabbcc')
    expect(paint['circle-color'][3]).toContain('casabranca')
    expect(paint['circle-opacity']).toBe(0.5)
    expect(paint['circle-stroke-width']).toBe(0.5)
    expect(paint['circle-stroke-opacity']).toBe(0.3)
  })

  it('keeps the selected alternate shape with the same color rules', () => {
    expect(pointMarkerAppearance({ scientific_name: 'Mechanitis polymnia', subspecies: 'unknown' }, {
      ...settings, shapesEnabled: true,
    }).shape).toBe('square')
  })

  it('uses distinct image signatures for independent opacity changes', () => {
    const original = getColoredShapeImageName('circle', '#aabbcc', '#ffffff', 2, 0.4, 0.8)
    expect(getColoredShapeImageName('circle', '#aabbcc', '#ffffff', 2, 0.5, 0.8)).not.toBe(original)
    expect(getColoredShapeImageName('circle', '#aabbcc', '#ffffff', 2, 0.4, 0.7)).not.toBe(original)
  })

  it('uses visible outline images at the five cluster radius thresholds', () => {
    expect(buildClusterOutlineExpression()).toEqual([
      'step', ['get', 'point_count'], 'cluster-outline-12',
      20, 'cluster-outline-16', 50, 'cluster-outline-20',
      100, 'cluster-outline-25', 500, 'cluster-outline-32',
    ])
  })

  it('reports the native circle outer radius or custom-shape half-box', () => {
    const style = { pointSize: 10, borderWidth: 2 }
    expect(visiblePointRadius(style, 3)).toBeCloseTo(3.705)
    expect(visiblePointRadius(style, 10)).toBeCloseTo(10)
    expect(visiblePointRadius(style, 14)).toBeCloseTo(14.5)
    expect(visiblePointRadius(style, 10, true)).toBeCloseTo(11.52)
    expect(visiblePointRadius(style, 18, true)).toBeCloseTo(17.28)
  })
})
