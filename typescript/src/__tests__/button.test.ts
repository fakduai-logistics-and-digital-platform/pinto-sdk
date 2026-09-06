import { describe, expect, it } from 'vitest'
import { PINTO_LOGO_DATA_URL } from '../assets/logo.js'
import {
  createPintoButton,
  getPintoButtonHtml,
  renderPintoButton,
} from '../button.js'

describe('Pinto Button Component', () => {
  it('exports valid Pinto logo data url', () => {
    expect(PINTO_LOGO_DATA_URL).toMatch(/^data:image\/png;base64,/)
  })

  it('generates raw HTML button string with default options', () => {
    const html = getPintoButtonHtml()
    expect(html).toContain('<button')
    expect(html).toContain('เข้าสู่ระบบด้วย Pinto')
    expect(html).toContain('data:image/png;base64,')
  })

  it('customizes text, theme, and shape in HTML output', () => {
    const html = getPintoButtonHtml({
      text: 'Sign in with Pinto',
      theme: 'light',
      shape: 'pill',
      size: 'large',
      fullWidth: true,
    })

    expect(html).toContain('Sign in with Pinto')
    expect(html).toContain('border-radius: 9999px')
    expect(html).toContain('width: 100%')
    expect(html).toContain('background: #2ecc71')
  })

  it('supports iconOnly mode', () => {
    const html = getPintoButtonHtml({
      iconOnly: true,
      size: 'small',
    })

    expect(html).not.toContain('<span>')
    expect(html).toContain('<img')
  })

  it('creates DOM element in browser-like environment (jsdom/happy-dom or node mock)', () => {
    // Setup minimal DOM mock if in Node
    if (typeof document === 'undefined') {
      const mockElement = {
        style: {},
        setAttribute: () => {},
        appendChild: () => {},
        addEventListener: () => {},
      }
      global.document = {
        createElement: () => mockElement,
        querySelector: () => mockElement,
      } as any
    }

    const btn = createPintoButton({
      text: 'Custom Text',
      theme: 'brand',
    })

    expect(btn).toBeDefined()
  })
})
