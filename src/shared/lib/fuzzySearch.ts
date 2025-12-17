import uFuzzy from '@leeoniya/ufuzzy'

// Create a single uFuzzy instance with good defaults for taxonomy search
const uf = new uFuzzy({
  intraMode: 1, // Allow gaps between characters
  intraIns: 1, // Allow 1 insertion within terms
  interIns: 3, // Allow 3 insertions between terms
})

export interface FuzzySearchResult<T> {
  item: T
  index: number
  highlight?: string
}

/**
 * Perform fuzzy search on a list of strings
 * @param query The search query
 * @param items The list of strings to search
 * @param limit Maximum number of results (default: 50)
 * @returns Filtered and sorted items based on fuzzy match
 */
export function fuzzySearch(
  query: string,
  items: string[],
  limit = 50
): string[] {
  if (!query || query.trim() === '') {
    return items.slice(0, limit)
  }

  const [idxs, _info, order] = uf.search(items, query)

  if (!idxs || idxs.length === 0) {
    return []
  }

  // If we have order info, use it for sorting by relevance
  const orderedIdxs = order ? order.map((i) => idxs[i]) : idxs

  return orderedIdxs.slice(0, limit).map((idx) => items[idx])
}

/**
 * Highlight matching portions of a string
 * @param text The text to highlight
 * @param query The search query
 * @returns HTML string with <mark> tags around matches, or original text if no match
 */
export function fuzzyHighlight(text: string, query: string): string {
  if (!query || query.trim() === '') {
    return text
  }

  const [idxs, info] = uf.search([text], query)

  if (!idxs || idxs.length === 0 || !info) {
    return text
  }

  return uFuzzy.highlight(text, info.ranges[0])
}
