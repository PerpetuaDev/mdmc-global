import { describe, it, expect } from 'vitest'
import { unwrapAuthoredBreaks } from '../src/lib/text.js'

describe('unwrapAuthoredBreaks', () => {
  it('joins single newlines with a space', () => {
    expect(unwrapAuthoredBreaks("We help great products find the people\nwho'll love them"))
      .toBe("We help great products find the people who'll love them")
  })

  it('preserves paragraph breaks', () => {
    expect(unwrapAuthoredBreaks('one\ntwo\n\nthree')).toBe('one two\n\nthree')
  })

  it('collapses runs of whitespace introduced by the join', () => {
    expect(unwrapAuthoredBreaks('a  \n  b')).toBe('a b')
  })

  it('trims each resulting paragraph', () => {
    expect(unwrapAuthoredBreaks('  a\nb  ')).toBe('a b')
  })

  it('is a no-op on text with no newlines', () => {
    expect(unwrapAuthoredBreaks('nothing to do')).toBe('nothing to do')
  })

  it('handles CRLF', () => {
    expect(unwrapAuthoredBreaks('a\r\nb')).toBe('a b')
  })

  it('returns empty string for empty or nullish input', () => {
    expect(unwrapAuthoredBreaks('')).toBe('')
    expect(unwrapAuthoredBreaks(undefined)).toBe('')
    expect(unwrapAuthoredBreaks(null)).toBe('')
  })

  // Japanese does not space between characters, so joining two CJK lines with
  // a Latin space would insert a visible gap that is wrong in JA typesetting.
  it('does not merge Japanese lines with a space', () => {
    expect(unwrapAuthoredBreaks('私たちは\nデザイン')).toBe('私たちはデザイン')
  })

  it('still spaces a break between a CJK line and a Latin one', () => {
    expect(unwrapAuthoredBreaks('デザイン\nMDMC')).toBe('デザイン MDMC')
    expect(unwrapAuthoredBreaks('MDMC\nデザイン')).toBe('MDMC デザイン')
  })

  it('handles the real home manifesto shape', () => {
    const src = "We help great products find the people\nwho'll love them, and help good, honest\nbusinesses stand out from the noise."
    expect(unwrapAuthoredBreaks(src))
      .toBe("We help great products find the people who'll love them, and help good, honest businesses stand out from the noise.")
  })
})
