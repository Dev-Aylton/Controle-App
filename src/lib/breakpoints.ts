export const BREAKPOINTS = {
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1199,
  notebookMin: 1200,
} as const

export type BreakpointLayout = 'mobile' | 'tablet' | 'notebook'
