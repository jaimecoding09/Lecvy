import { describe, expect, it } from 'vitest'

import {
  validateDisplayName,
  validateEmail,
  validateNewPassword,
  validateUsername,
} from './validation'

describe('validateEmail', () => {
  it('rejects an empty value', () => {
    expect(validateEmail('   ')).toEqual({
      ok: false,
      message: 'Enter your email address.',
    })
  })

  it('rejects malformed addresses', () => {
    expect(validateEmail('ada').ok).toBe(false)
    expect(validateEmail('ada@localhost').ok).toBe(false)
    expect(validateEmail('ada@exam ple.com').ok).toBe(false)
  })

  it('trims and accepts a valid address', () => {
    expect(validateEmail('  ada@example.com ')).toEqual({
      ok: true,
      value: 'ada@example.com',
    })
  })
})

describe('validatePassword', () => {
  it('requires a password', () => {
    expect(validateNewPassword('')).toEqual({ ok: false, message: 'Choose a password.' })
  })

  it('enforces the six character minimum', () => {
    expect(validateNewPassword('abcde').ok).toBe(false)
    expect(validateNewPassword('abcdef').ok).toBe(true)
  })
})

describe('validateDisplayName', () => {
  it('rejects blank and single character names', () => {
    expect(validateDisplayName('  ').ok).toBe(false)
    expect(validateDisplayName('A').ok).toBe(false)
  })

  it('accepts a normal display name and trims it', () => {
    expect(validateDisplayName('  Ada Lovelace  ')).toEqual({
      ok: true,
      value: 'Ada Lovelace',
    })
  })

  it('caps the length at 30 characters', () => {
    expect(validateDisplayName('a'.repeat(31)).ok).toBe(false)
  })
})

describe('validateUsername', () => {
  it('rejects spaces', () => {
    expect(validateUsername('ada lovelace')).toEqual({
      ok: false,
      message: 'Usernames cannot contain spaces.',
    })
    expect(validateUsername('ada  lovelace').ok).toBe(false)
  })

  it('rejects unsupported characters', () => {
    expect(validateUsername('ada!').ok).toBe(false)
    expect(validateUsername('ada-1').ok).toBe(false)
  })

  it('requires at least three characters and at most twenty', () => {
    expect(validateUsername('ad').ok).toBe(false)
    expect(validateUsername('a'.repeat(21)).ok).toBe(false)
  })

  it('rejects names that start with a dot or underscore', () => {
    expect(validateUsername('.ada').ok).toBe(false)
    expect(validateUsername('_ada').ok).toBe(false)
  })

  it('lowercases and trims valid usernames', () => {
    expect(validateUsername('  Ada.Lovelace  ')).toEqual({
      ok: true,
      value: 'ada.lovelace',
    })
    expect(validateUsername('ada_01').ok).toBe(true)
  })
})
