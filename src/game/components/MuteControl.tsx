'use client'

import { useSyncExternalStore } from 'react'

import { audioEngine } from '../audio/engine'

/**
 * The visible sound toggle — rendered by Stage so it sits on every scene of every route,
 * including the results permalink that never passes through the game shell. It is a real
 * button: keyboard-reachable, named by its aria-label, state exposed via aria-pressed, and the
 * state persists across reloads and runs through the engine's localStorage contract.
 *
 * The state is read through useSyncExternalStore so the server render (always "Sound on") and
 * the hydrated client render never fight: the real persisted state arrives with the first
 * client snapshot, and every toggle re-renders the control from the engine.
 */
export function MuteControl() {
  const muted = useSyncExternalStore(
    audioEngine.subscribe,
    () => audioEngine.isMuted(),
    () => false,
  )

  return (
    <button
      type="button"
      className="ark-btn ark-btn--compact ark-mute"
      aria-pressed={muted}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      onClick={() => {
        // Unmuting is itself the gesture that may unlock audio.
        audioEngine.unlock()
        audioEngine.toggleMuted()
      }}
    >
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  )
}
