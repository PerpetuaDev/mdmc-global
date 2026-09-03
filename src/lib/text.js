// Pure text helpers. Kept out of content.js, which is about fetching and
// normalizing Strapi payloads.

// CJK ranges wide enough for the copy this site carries: hiragana, katakana,
// CJK unified ideographs, and full-width punctuation.
const CJK = /[　-〿぀-ゟ゠-ヿ一-鿿＀-￯]/

/**
 * Collapse authored single newlines into spaces, preserving paragraph breaks.
 *
 * The home manifesto carries line breaks sized for the desktop measure. At a
 * narrow measure each authored line wraps again and orphans its last word
 * ("people", "honest", "noise."), so below 1024px the copy is rendered as
 * flowing paragraphs instead.
 *
 * Japanese does not put spaces between characters, so a break between two CJK
 * characters joins with nothing rather than a space.
 */
export function unwrapAuthoredBreaks(text) {
  if (!text) return ''
  return String(text)
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((para) =>
      para
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .reduce((acc, line) => {
          if (!acc) return line
          const joiner = CJK.test(acc.slice(-1)) && CJK.test(line[0]) ? '' : ' '
          return acc + joiner + line
        }, '')
        .replace(/[ \t]{2,}/g, ' ')
    )
    .filter(Boolean)
    .join('\n\n')
}
