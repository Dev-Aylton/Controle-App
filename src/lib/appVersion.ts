declare const __APP_VERSION__: string
declare const __APP_BUILD__: string

export function getAppVersion() {
  return {
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
    build: typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'local',
  }
}

export function formatAppVersion() {
  const { version } = getAppVersion()
  const compactVersion = /^(\d+\.\d+)\.0$/.test(version)
    ? version.replace(/\.0$/, '')
    : version
  return `v${compactVersion}`
}
