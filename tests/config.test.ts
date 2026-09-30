import { describe, it, expect } from 'vitest'
import { thresholdError } from '../src/config.js'

describe('thresholdError', () => {
  const one = [{ weight: 1 }]
  const three = [{ weight: 1 }, { weight: 1 }, { weight: 1 }]

  it('accepts a threshold within the total server weight', () => {
    expect(thresholdError(1, one)).toBeNull()
    expect(thresholdError(2, three)).toBeNull()
  })

  it('rejects the old mainnet default of 5 against a single committee', () => {
    expect(thresholdError(5, one)).toMatch(/\[1, 1\]/)
  })

  it('rejects zero, fractions and NaN', () => {
    expect(thresholdError(0, three)).not.toBeNull()
    expect(thresholdError(1.5, three)).not.toBeNull()
    expect(thresholdError(Number.NaN, three)).not.toBeNull()
  })
})
