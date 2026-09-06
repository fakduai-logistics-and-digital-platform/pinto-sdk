import type { PintoAuth } from './auth.js'
import { PINTO_LOGO_DATA_URL } from './assets/logo.js'

export type PintoButtonTheme = 'dark' | 'light' | 'brand' | 'outline'
export type PintoButtonSize = 'small' | 'medium' | 'large'
export type PintoButtonShape = 'rounded' | 'pill' | 'square'

export interface PintoButtonOptions {
  /**
   * Text to display inside the button
   * @default 'เข้าสู่ระบบด้วย Pinto'
   */
  text?: string

  /**
   * Visual theme:
   * - 'dark': Black background, crisp white logo & text (Default)
   * - 'light': Clean white background with dark border and text
   * - 'brand': Pinto signature brand purple/blue accent (#696CFF)
   * - 'outline': Transparent background with outline border
   * @default 'dark'
   */
  theme?: PintoButtonTheme

  /**
   * Size of the button
   * - 'small': 36px height
   * - 'medium': 44px height (Standard touch target)
   * - 'large': 52px height
   * @default 'medium'
   */
  size?: PintoButtonSize

  /**
   * Corner radius shape:
   * - 'rounded': 8px border radius
   * - 'pill': Full pill radius (9999px)
   * - 'square': 0px border radius
   * @default 'rounded'
   */
  shape?: PintoButtonShape

  /**
   * Only show the Pinto logo icon without text
   * @default false
   */
  iconOnly?: boolean

  /**
   * Expand button to 100% width of parent container
   * @default false
   */
  fullWidth?: boolean

  /**
   * Position of the Pinto logo
   * @default 'left'
   */
  logoPosition?: 'left' | 'right'

  /**
   * Custom logo image URL (overrides default embedded logo)
   */
  customLogoUrl?: string

  /**
   * Loading state (disables click and dims button)
   * @default false
   */
  loading?: boolean

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean

  /**
   * PintoAuth instance. If provided, clicking automatically invokes `auth.loginWithRedirect()`.
   */
  auth?: PintoAuth

  /**
   * Custom click handler
   */
  onClick?: (event: MouseEvent) => void | Promise<void>

  /**
   * Additional CSS class names
   */
  className?: string

  /**
   * Custom inline styles
   */
  style?: Partial<CSSStyleDeclaration> | Record<string, string>
}

interface ThemeStyles {
  background: string
  color: string
  border: string
  hoverBackground: string
  activeBackground: string
  logoFilter?: string
}

const THEME_MAP: Record<PintoButtonTheme, ThemeStyles> = {
  dark: {
    background: '#111827',
    color: '#ffffff',
    border: '1px solid #1f2937',
    hoverBackground: '#1f2937',
    activeBackground: '#030712',
  },
  light: {
    background: '#ffffff',
    color: '#111827',
    border: '1px solid #e5e7eb',
    hoverBackground: '#f9fafb',
    activeBackground: '#f3f4f6',
    logoFilter: 'invert(1) brightness(0.2)', // Inverts white logo to dark for light theme
  },
  brand: {
    background: '#696cff',
    color: '#ffffff',
    border: '1px solid #5f61e6',
    hoverBackground: '#5f61e6',
    activeBackground: '#5052cc',
  },
  outline: {
    background: 'transparent',
    color: 'inherit',
    border: '1.5px solid currentColor',
    hoverBackground: 'rgba(105, 108, 255, 0.08)',
    activeBackground: 'rgba(105, 108, 255, 0.16)',
  },
}

const SIZE_MAP: Record<PintoButtonSize, { height: string; padding: string; fontSize: string; iconSize: string; gap: string }> = {
  small: {
    height: '36px',
    padding: '0 14px',
    fontSize: '13px',
    iconSize: '20px',
    gap: '8px',
  },
  medium: {
    height: '44px',
    padding: '0 20px',
    fontSize: '15px',
    iconSize: '24px',
    gap: '10px',
  },
  large: {
    height: '52px',
    padding: '0 24px',
    fontSize: '16px',
    iconSize: '28px',
    gap: '12px',
  },
}

const SHAPE_MAP: Record<PintoButtonShape, string> = {
  rounded: '8px',
  pill: '9999px',
  square: '0px',
}

/**
 * Generate raw HTML string for the Pinto Login Button (suitable for SSR or static HTML)
 */
export function getPintoButtonHtml(options: PintoButtonOptions = {}): string {
  const theme = THEME_MAP[options.theme || 'dark']
  const size = SIZE_MAP[options.size || 'medium']
  const borderRadius = SHAPE_MAP[options.shape || 'rounded']
  const logoUrl = options.customLogoUrl || PINTO_LOGO_DATA_URL
  const text = options.text ?? 'เข้าสู่ระบบด้วย Pinto'
  const isIconOnly = Boolean(options.iconOnly)

  const imgStyle = `width: ${size.iconSize}; height: ${size.iconSize}; object-fit: contain; display: inline-block; flex-shrink: 0; border-radius: 4px; ${theme.logoFilter ? `filter: ${theme.logoFilter};` : ''}`
  const imgTag = `<img src="${logoUrl}" alt="Pinto" style="${imgStyle}" />`

  const content = isIconOnly
    ? imgTag
    : options.logoPosition === 'right'
      ? `<span>${text}</span>${imgTag}`
      : `${imgTag}<span>${text}</span>`

  const widthStyle = options.fullWidth ? 'width: 100%;' : 'width: auto;'
  const padding = isIconOnly ? '0' : size.padding
  const iconOnlyWidth = isIconOnly ? `width: ${size.height};` : ''

  return `
    <button
      type="button"
      class="pinto-login-btn ${options.className || ''}"
      style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: ${size.gap};
        height: ${size.height};
        ${iconOnlyWidth || widthStyle}
        padding: ${padding};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif;
        font-size: ${size.fontSize};
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        background: ${theme.background};
        color: ${theme.color};
        border: ${theme.border};
        border-radius: ${borderRadius};
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        outline: none;
        box-sizing: border-box;
      "
    >
      ${content}
    </button>
  `.trim()
}

/**
 * Create a live DOM HTMLButtonElement configured with Pinto Login styles and event listeners
 */
export function createPintoButton(options: PintoButtonOptions = {}): HTMLButtonElement {
  if (typeof document === 'undefined') {
    throw new Error('createPintoButton requires a DOM browser environment')
  }

  const theme = THEME_MAP[options.theme || 'dark']
  const size = SIZE_MAP[options.size || 'medium']
  const borderRadius = SHAPE_MAP[options.shape || 'rounded']
  const logoUrl = options.customLogoUrl || PINTO_LOGO_DATA_URL
  const isIconOnly = Boolean(options.iconOnly)

  const button = document.createElement('button')
  button.type = 'button'
  button.className = `pinto-login-btn ${options.className || ''}`.trim()

  // Base styles
  Object.assign(button.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: size.gap,
    height: size.height,
    width: isIconOnly ? size.height : options.fullWidth ? '100%' : 'auto',
    padding: isIconOnly ? '0' : size.padding,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif",
    fontSize: size.fontSize,
    fontWeight: '600',
    lineHeight: '1',
    cursor: options.disabled || options.loading ? 'not-allowed' : 'pointer',
    userSelect: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    background: theme.background,
    color: theme.color,
    border: theme.border,
    borderRadius,
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    outline: 'none',
    boxSizing: 'border-box',
    opacity: options.disabled ? '0.5' : options.loading ? '0.7' : '1',
  })

  // Apply custom style overrides if provided
  if (options.style) {
    Object.assign(button.style, options.style)
  }

  // Hover and Active interactions
  if (!options.disabled && !options.loading) {
    button.addEventListener('mouseenter', () => {
      button.style.background = theme.hoverBackground
      button.style.transform = 'translateY(-1px)'
      button.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    })
    button.addEventListener('mouseleave', () => {
      button.style.background = theme.background
      button.style.transform = 'translateY(0)'
      button.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
    })
    button.addEventListener('mousedown', () => {
      button.style.background = theme.activeBackground
      button.style.transform = 'translateY(0)'
    })
  }

  // Logo Image Element
  const img = document.createElement('img')
  img.src = logoUrl
  img.alt = 'Pinto'
  Object.assign(img.style, {
    width: size.iconSize,
    height: size.iconSize,
    objectFit: 'contain',
    display: 'inline-block',
    flexShrink: '0',
    borderRadius: '4px',
    filter: theme.logoFilter || 'none',
  })

  // Render children
  if (isIconOnly) {
    button.appendChild(img)
    button.setAttribute('aria-label', options.text || 'Log in with Pinto')
  } else {
    const textSpan = document.createElement('span')
    textSpan.textContent = options.text ?? 'เข้าสู่ระบบด้วย Pinto'

    if (options.logoPosition === 'right') {
      button.appendChild(textSpan)
      button.appendChild(img)
    } else {
      button.appendChild(img)
      button.appendChild(textSpan)
    }
  }

  // Click Handler
  button.addEventListener('click', async (e) => {
    if (options.disabled || options.loading) return

    if (options.onClick) {
      await options.onClick(e)
    } else if (options.auth) {
      await options.auth.loginWithRedirect()
    }
  })

  return button
}

/**
 * Render a Pinto Login Button directly into a DOM container element or CSS selector
 */
export function renderPintoButton(
  target: HTMLElement | string,
  options: PintoButtonOptions = {},
): HTMLButtonElement {
  if (typeof document === 'undefined') {
    throw new Error('renderPintoButton requires a DOM browser environment')
  }

  const container = typeof target === 'string' ? document.querySelector(target) : target
  if (!container) {
    throw new Error(`Target container not found: ${target}`)
  }

  const button = createPintoButton(options)
  container.innerHTML = ''
  container.appendChild(button)
  return button
}
