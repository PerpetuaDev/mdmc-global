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

  it('reports every violated gate at once', () => {
    const v = evaluateGates({
      path: '/x', overflowPx: 5,
      tinyText: [{ fs: 11, cls: 'a' }],
      smallTaps: [{ w: 20, h: 20, cls: 'b' }],
    })
    expect(v.map((x) => x.gate).sort()).toEqual(['overflow', 'tap-floor', 'type-floor'])
  })
})
