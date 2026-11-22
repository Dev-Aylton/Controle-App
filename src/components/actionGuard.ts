export function createActionGuard() {
  let locked = false
  return {
    async run(action: () => void | Promise<void>) {
      if (locked) return false
      locked = true
      try {
        await action()
        return true
      } finally {
        locked = false
      }
    },
  }
}
