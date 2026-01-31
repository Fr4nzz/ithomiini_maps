/**
 * Smart abbreviation utilities for scientific names
 */

// Vowels for syllable detection
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y'])

/**
 * Get the first syllable of a word (smart syllable detection)
 * Rules:
 * - Find first vowel cluster
 * - Include consonants after the vowel up to the next vowel
 * - Minimum 3 characters for readability
 *
 * Examples:
 * - Mechanitis → Mec.
 * - Heliconius → Hel.
 * - Archonias → Arch.
 * - polymnia → pol.
 * - numata → num.
 * - aoede → ao.
 *
 * @param {string} word - The word to abbreviate
 * @returns {string} The first syllable with period
 */
export function getFirstSyllable(word) {
  if (!word || word.length <= 3) return word

  const lower = word.toLowerCase()
  let result = ''
  let foundVowel = false
  let vowelEnded = false

  for (let i = 0; i < lower.length; i++) {
    const char = lower[i]
    const isVowel = VOWELS.has(char)

    if (!foundVowel) {
      // Collecting initial consonants
      result += char
      if (isVowel) {
        foundVowel = true
      }
    } else if (!vowelEnded) {
      // Collecting vowels after first consonant cluster
      if (isVowel) {
        result += char
      } else {
        vowelEnded = true
        result += char
        // Check if we have enough characters (minimum 3)
        if (result.length >= 3) {
          break
        }
      }
    } else {
      // After vowel ended, check if we hit another vowel
      if (isVowel) {
        break
      }
      result += char
      if (result.length >= 4) {
        break
      }
    }
  }

  // Ensure minimum length of 2-3 for very short results
  if (result.length < 2) {
    result = lower.slice(0, Math.min(3, lower.length))
  }

  // Capitalize first letter and add period
  return result.charAt(0).toUpperCase() + result.slice(1) + '.'
}

/**
 * Generate all abbreviation options for a species name
 * @param {string} speciesName - Full species name (e.g., "Mechanitis polymnia")
 * @returns {Object} Object with different abbreviation formats
 */
export function generateAbbreviationOptions(speciesName) {
  if (!speciesName) return {}

  const parts = speciesName.trim().split(/\s+/)
  if (parts.length < 2) {
    return {
      full: speciesName,
      firstLetter: speciesName,
      syllable: speciesName
    }
  }

  const genus = parts[0]
  const epithet = parts.slice(1).join(' ')
  const firstEpithet = parts[1]

  // First letter abbreviations
  const genusFirstLetter = genus[0].toUpperCase() + '.'
  const epithetFirstLetter = firstEpithet[0].toLowerCase() + '.'

  // Syllable abbreviations
  const genusSyllable = getFirstSyllable(genus)
  const epithetSyllable = getFirstSyllable(firstEpithet).toLowerCase()

  return {
    // Full name
    full: speciesName,

    // Full species name (for use as prefix before subspecies)
    fullSpecies: speciesName,

    // First letter of genus + full epithet (M. polymnia)
    firstLetterGenus: `${genusFirstLetter} ${epithet}`,

    // First letter of each (M. p.)
    firstLetterBoth: `${genusFirstLetter} ${epithetFirstLetter}`,

    // Syllable of genus + full epithet (Mec. polymnia)
    syllableGenus: `${genusSyllable} ${epithet}`,

    // Syllable of each (Mec. pol.)
    syllableBoth: `${genusSyllable} ${epithetSyllable}`,

    // Just the raw parts for custom formatting
    parts: {
      genus,
      epithet,
      genusFirstLetter,
      epithetFirstLetter,
      genusSyllable,
      epithetSyllable
    }
  }
}

/**
 * Apply abbreviation format to a species name
 * @param {string} speciesName - Full species name
 * @param {string} format - Format key
 * @param {string} customValue - Custom value if format is 'custom'
 * @returns {string} Formatted name
 */
export function applyAbbreviationFormat(speciesName, format, customValue = '') {
  if (format === 'custom') {
    return customValue
  }

  if (format === 'none') {
    return ''
  }

  const options = generateAbbreviationOptions(speciesName)
  return options[format] || speciesName
}
