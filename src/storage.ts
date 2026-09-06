import type { StorageAdapter } from './types.js'

/**
 * In-memory fallback storage
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }
}

/**
 * Browser sessionStorage adapter
 */
export class SessionStorageAdapter implements StorageAdapter {
  private memory = new MemoryStorageAdapter()

  private isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
    } catch {
      return false
    }
  }

  getItem(key: string): string | null {
    if (this.isAvailable()) {
      try {
        return window.sessionStorage.getItem(key)
      } catch {
        return this.memory.getItem(key)
      }
    }
    return this.memory.getItem(key)
  }

  setItem(key: string, value: string): void {
    if (this.isAvailable()) {
      try {
        window.sessionStorage.setItem(key, value)
        return
      } catch {
        this.memory.setItem(key, value)
        return
      }
    }
    this.memory.setItem(key, value)
  }

  removeItem(key: string): void {
    if (this.isAvailable()) {
      try {
        window.sessionStorage.removeItem(key)
        return
      } catch {
        this.memory.removeItem(key)
        return
      }
    }
    this.memory.removeItem(key)
  }
}

/**
 * Browser localStorage adapter
 */
export class LocalStorageAdapter implements StorageAdapter {
  private memory = new MemoryStorageAdapter()

  private isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
    } catch {
      return false
    }
  }

  getItem(key: string): string | null {
    if (this.isAvailable()) {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return this.memory.getItem(key)
      }
    }
    return this.memory.getItem(key)
  }

  setItem(key: string, value: string): void {
    if (this.isAvailable()) {
      try {
        window.localStorage.setItem(key, value)
        return
      } catch {
        this.memory.setItem(key, value)
        return
      }
    }
    this.memory.setItem(key, value)
  }

  removeItem(key: string): void {
    if (this.isAvailable()) {
      try {
        window.localStorage.removeItem(key)
        return
      } catch {
        this.memory.removeItem(key)
        return
      }
    }
    this.memory.removeItem(key)
  }
}

/**
 * Create default storage adapter (prefers sessionStorage in browser)
 */
export function createDefaultStorage(): StorageAdapter {
  return new SessionStorageAdapter()
}
