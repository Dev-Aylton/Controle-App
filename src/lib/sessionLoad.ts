export class SessionLoadDeduper {
  private loadedUserId: string | null = null
  private loading = false

  shouldLoad(userId: string | null, force = false) {
    if (!userId || this.loading) return false
    if (!force && this.loadedUserId === userId) return false
    this.loading = true
    return true
  }

  finish(userId: string | null) {
    this.loadedUserId = userId
    this.loading = false
  }

  clear() {
    this.loadedUserId = null
    this.loading = false
  }
}
