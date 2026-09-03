import { describe, it, expect } from 'vitest'
import { evaluateGates } from '../scripts/audit-responsive.mjs'

describe('evaluateGates', () => {
  const clean = { path: '/', overflowPx: 0, tinyText: [], smallTaps: [] }

  it('passes a clean page', () => {
    expect(evaluateGates(clean)).toEqual([])
  })

  it('ignores negative overflow (reserved scrollbar gutter)', () => {
    expect(evaluateGates({ ...clean, overflowPx: -15 })).toEqual([])
  })

  it('fails on positive overflow', () => {
    const v = evaluateGates({ ...clean, overflowPx: 3 })
    expect(v).toHaveLength(1)
    expect(v[0].gate).toBe('overflow')
  })

  it('fails on text below 12px', () => {
    const v = evaluateGates({ ...clean, tinyText: [{ fs: 10, cls: 'locale-code' }] })
    expect(v[0].gate).toBe('type-floor')
  })

  it('fails on an interactive box below 44px', () => {
    const v = evaluateGates({ ...clean, smallTaps: [{ w: 25, h: 30, cls: 'studio-plus' }] })
    expect(v[0].gate).toBe('tap-floor')
  })

  // The width rule is asymmetric on purpose — see the comment in MEASURE.
  // These document the contract the in-page measurement implements: the page
  // decides what counts as undersized, evaluateGates only counts what it is
  // handed, so these assert the intent rather than re-deriving it.
  it('counts a symbolic control that is tall enough but too narrow', () => {
    // '+' at 25x44 — a glyph button must be graspable in both axes.
    const v = evaluateGates({ ...clean, smallTaps: [{ w: 25, h: 44, cls: 'studio-plus', txt: '+', need: '44x44' }] })
    expect(v[0].gate).toBe('tap-floor')
    expect(v[0].offenders[0].need).toBe('44x44')
  })

  it('reports the relaxed width requirement for text links', () => {
    // A text link only needs 24px of width, so 40x44 ("Work") is NOT handed
    // to the gate at all; when something IS handed over it carries its need.
    const v = evaluateGates({ ...clean, smallTaps: [{ w: 20, h: 44, cls: 'nav-link', txt: 'Work', need: '24x44' }] })
    expect(v[0].offenders[0].need).toBe('24x44')
  })

  it('reports every violated gate at once', () => {
    const v = evaluateGates({
      path: '/x', overflowPx: 5,
      tinyText: [{ fs: 11, cls: 'a' }],
      smallTaps: [{ w: 20, h: 20, cls: 'b' }],
    })
    expect(v.map((x) => x.gate).sort()).toEqual(['overflow', 'tap-floor', 'type-floor'])
  })
})
