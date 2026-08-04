// uno.config.ts
import { defineConfig } from 'unocss'
import presetWebFonts from '@unocss/preset-web-fonts'
import presetIcons from '@unocss/preset-icons'
import presetUno from '@unocss/preset-uno'

// Material 3 semantic color roles, each bound to a CSS variable defined in
// src/styles/tokens.css. The variables hold space-separated RGB channels
// (e.g. `--md-on-surface: 26 27 34`), wrapped here in `rgb(...)` so the
// default value renders correctly AND UnoCSS can inject the `/N` opacity
// modifier as `rgb(var(--md-on-surface) / N%)`. Binding to a var (not a fixed
// hex) is what makes a future dark scheme a pure token-file swap — no
// component restyle. Names mirror M3 docs 1:1: bg-primary, text-on-surface.
//
// Shape tokens are exposed as border-radius utilities (rounded-md, etc.) and
// motion as transition utilities below.
const mdColorRoles = {
  primary: 'rgb(var(--md-primary))',
  'on-primary': 'rgb(var(--md-on-primary))',
  'primary-container': 'rgb(var(--md-primary-container))',
  'on-primary-container': 'rgb(var(--md-on-primary-container))',
  secondary: 'rgb(var(--md-secondary))',
  'on-secondary': 'rgb(var(--md-on-secondary))',
  'secondary-container': 'rgb(var(--md-secondary-container))',
  'on-secondary-container': 'rgb(var(--md-on-secondary-container))',
  tertiary: 'rgb(var(--md-tertiary))',
  'on-tertiary': 'rgb(var(--md-on-tertiary))',
  'tertiary-container': 'rgb(var(--md-tertiary-container))',
  'on-tertiary-container': 'rgb(var(--md-on-tertiary-container))',
  error: 'rgb(var(--md-error))',
  'on-error': 'rgb(var(--md-on-error))',
  'error-container': 'rgb(var(--md-error-container))',
  'on-error-container': 'rgb(var(--md-on-error-container))',
  background: 'rgb(var(--md-background))',
  'on-background': 'rgb(var(--md-on-background))',
  surface: 'rgb(var(--md-surface))',
  'on-surface': 'rgb(var(--md-on-surface))',
  'surface-variant': 'rgb(var(--md-surface-variant))',
  'on-surface-variant': 'rgb(var(--md-on-surface-variant))',
  'surface-container-lowest': 'rgb(var(--md-surface-container-lowest))',
  'surface-container-low': 'rgb(var(--md-surface-container-low))',
  'surface-container': 'rgb(var(--md-surface-container))',
  'surface-container-high': 'rgb(var(--md-surface-container-high))',
  'surface-container-highest': 'rgb(var(--md-surface-container-highest))',
  outline: 'rgb(var(--md-outline))',
  'outline-variant': 'rgb(var(--md-outline-variant))',
  'inverse-surface': 'rgb(var(--md-inverse-surface))',
  'inverse-on-surface': 'rgb(var(--md-inverse-on-surface))',
  'inverse-primary': 'rgb(var(--md-inverse-primary))'
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
