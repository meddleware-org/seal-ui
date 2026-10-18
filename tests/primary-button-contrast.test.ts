import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// F10: the label on a primary button must use the design-tokens role for text on the accent colour.
// A hard-coded #fff is 2.4-3.0:1 on the dark theme's light accent stops. The browser-level check of
// every theme and season is design-tokens' own `check:contrast`, which measures this exact pairing
// (--accent-contrast on --accent); this test pins that the app uses the role and that the role exists.
const view = readFileSync(resolve(process.cwd(), 'src/components/SealView.vue'), 'utf8')
const tokens = readFileSync(resolve(process.cwd(), 'node_modules/@meddleware/design-tokens/src/tokens.css'), 'utf8')

function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `${selector} rule`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('}', start))
}

describe('button.primary', () => {
  it('draws its label in --accent-contrast on the --accent background', () => {
    const r = rule(view, 'button.primary')
    expect(r).toMatch(/background:\s*var\(--accent[,)]/)
    expect(r).toMatch(/color:\s*var\(--accent-contrast[,)]/)
    expect(r).not.toMatch(/color:\s*#fff\b/)
  })

  it('has no other hard-coded white text on the accent', () => {
    expect(view).not.toMatch(/color:\s*#fff\s*;/i)
  })

  it('relies on a role design-tokens defines for both themes', () => {
    expect(tokens.match(/--accent-contrast:/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
