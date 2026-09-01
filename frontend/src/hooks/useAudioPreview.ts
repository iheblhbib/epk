import { useRef, useState } from 'react'

/**
 * Drives a single shared <audio> element so at most one preview plays at a
 * time across a list of items — playing a second item automatically stops
 * whichever one was already playing, rather than letting previews stack up.
 * Shared between the media picker dialog and the Media Library list, which
 * both need exactly this "preview before you commit to it" behavior.
 */
export function useAudioPreview() {
  const [playingId, setPlayingId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  function toggle(id: number, url: string) {
    const audio = audioRef.current
    if (!audio) return

    if (playingId === id) {
      audio.pause()
      setPlayingId(null)
      return
    }

    audio.src = url
    audio.play()
    setPlayingId(id)
  }

  function stop() {
    audioRef.current?.pause()
    setPlayingId(null)
  }

  return { playingId, audioRef, toggle, stop }
}
