import { useEffect, useRef, useCallback } from 'react'

export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  interval: number,
  enabled: boolean = true
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)
  
  // Update callback ref to avoid stale closures
  useEffect(() => {
    callbackRef.current = callback
  })

  const startPolling = useCallback(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    if (!enabled) return
    
    // Call immediately
    callbackRef.current()
    
    // Set up interval
    intervalRef.current = setInterval(() => {
      // Only poll if document is visible
      if (document.visibilityState === 'visible') {
        callbackRef.current()
      }
    }, interval)
  }, [interval, enabled])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      stopPolling()
      return
    }

    startPolling()

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Call immediately when becoming visible
        callbackRef.current()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, interval, startPolling, stopPolling])

  return { stopPolling, startPolling }
}