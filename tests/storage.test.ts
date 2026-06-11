import { describe, it, expect } from 'vitest'
import {
  fmtBytes, weightLevel, LARGE_RESUME_BYTES, RISK_RESUME_BYTES,
} from '../src/lib/storage'

describe('weightLevel', () => {
  it.each([
    [0, 'ok'],
    [LARGE_RESUME_BYTES - 1, 'ok'],
    [LARGE_RESUME_BYTES, 'large'],
    [RISK_RESUME_BYTES - 1, 'large'],
    [RISK_RESUME_BYTES, 'risk'],
    [10_000_000, 'risk'],
  ] as const)('%i bytes → %s', (bytes, expected) => {
    expect(weightLevel(bytes)).toBe(expected)
  })
})

describe('fmtBytes', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1_000, '1 kB'],
    [87_400, '87 kB'],
    [999_499, '999 kB'],
    [1_000_000, '1.0 MB'],
    [2_345_678, '2.3 MB'],
  ] as const)('%i → %s', (bytes, expected) => {
    expect(fmtBytes(bytes)).toBe(expected)
  })
})
