import { events, type RootStore } from '@react-three/fiber'

// Canvas initialization can finish after navigation has removed its DOM node.
// Preserve the normal event manager, but do not connect to a detached ref.
export function canvasEvents(store: RootStore) {
  const manager = events(store)
  const connect = manager.connect
  return { ...manager, connect(target: HTMLElement) { if (target) connect?.(target) } }
}
