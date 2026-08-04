// uno.config.ts
import { defineConfig } from 'unocss'
import presetWebFonts from '@unocss/preset-web-fonts'
import presetIcons from '@unocss/preset-icons'
import presetUno from '@unocss/preset-uno'

// Material 3 semantic color roles, each bound to a CSS variable defined in
// src/styles/tokens.css. Binding to a var (not a fixed hex) is what makes a
// future dark scheme a pure token-file swap — no component restyle. Names
// mirror M3 docs 1:1: bg-primary, text-on-surface-variant, etc.
//
// Shape tokens are exposed as border-radius utilities (rounded-md, etc.) and
// motion as transition utilities below.
const mdColorRoles = {
  primary: 'var(--md-primary)',
  'on-primary': 'var(--md-on-primary)',
  'primary-container': 'var(--md-primary-container)',
  'on-primary-container': 'var(--md-on-primary-container)',
  secondary: 'var(--md-secondary)',
  'on-secondary': 'var(--md-on-secondary)',
  'secondary-container': 'var(--md-secondary-container)',
  'on-secondary-container': 'var(--md-on-secondary-container)',
  tertiary: 'var(--md-tertiary)',
  'on-tertiary': 'var(--md-on-tertiary)',
  'tertiary-container': 'var(--md-tertiary-container)',
  'on-tertiary-container': 'var(--md-on-tertiary-container)',
  error: 'var(--md-error)',
  'on-error': 'var(--md-on-error)',
  'error-container': 'var(--md-error-container)',
  'on-error-container': 'var(--md-on-error-container)',
  background: 'var(--md-background)',
  'on-background': 'var(--md-on-background)',
  surface: 'var(--md-surface)',
  'on-surface': 'var(--md-on-surface)',
  'surface-variant': 'var(--md-surface-variant)',
  'on-surface-variant': 'var(--md-on-surface-variant)',
  'surface-container-lowest': 'var(--md-surface-container-lowest)',
  'surface-container-low': 'var(--md-surface-container-low)',
  'surface-container': 'var(--md-surface-container)',
  'surface-container-high': 'var(--md-surface-container-high)',
  'surface-container-highest': 'var(--md-surface-container-highest)',
  outline: 'var(--md-outline)',
  'outline-variant': 'var(--md-outline-variant)',
  'inverse-surface': 'var(--md-inverse-surface)',
  'inverse-on-surface': 'var(--md-inverse-on-surface)',
  'inverse-primary': 'var(--md-inverse-primary)'
}

export default defineConfig({
  theme: {
    colors: mdColorRoles,
    borderRadius: {
      none: 'var(--md-shape-none)',
      xs: 'var(--md-shape-xs)',
      sm: 'var(--md-shape-sm)',
      md: 'var(--md-shape-md)',
      lg: 'var(--md-shape-lg)',
      xl: 'var(--md-shape-xl)',
      full: 'var(--md-shape-full)'
    },
    transitionTimingFunction: {
      standard: 'var(--md-easing-standard)',
      emphasized: 'var(--md-easing-emphasized)',
      decelerated: 'var(--md-easing-decelerated)'
    },
    transitionDuration: {
      short: 'var(--md-duration-short)',
      medium: 'var(--md-duration-medium)',
      long: 'var(--md-duration-long)'
    }
  },
  presets: [
    presetUno(),
    presetIcons({}),
    presetWebFonts({
      provider: 'google', // default provider
      fonts: {
        // these will extend the default theme
        sans: 'Roboto',
        mono: ['Fira Code', 'Fira Mono:400,700'],
        // custom ones
        lobster: 'Lobster',
        lato: [
          {
            name: 'Lato',
            weights: ['400', '700'],
            italic: true
          },
          {
            name: 'sans-serif',
            provider: 'none'
          }
        ]
      }
    })
  ]
})
