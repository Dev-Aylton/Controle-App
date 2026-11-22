export type ThemeMode = 'light' | 'dark'

export function resolveTheme(mode: ThemeMode) {
  return mode
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = resolveTheme(mode)
  localStorage.setItem('controle-app-theme', mode)
}

export function getSavedTheme(): ThemeMode {
  const saved = localStorage.getItem('controle-app-theme')
  return saved === 'light' || saved === 'dark' ? saved : 'light'
}
