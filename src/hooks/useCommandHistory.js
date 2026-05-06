import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'terminal-command-history'
const MAX_HISTORY = 1000

export function useCommandHistory(sessionId) {
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Low Fix #26: Use ref to avoid stale closure in getPrevious/getNext
  const historyRef = useRef(history)
  useEffect(() => {
    historyRef.current = history
  }, [history])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    } catch (e) {
      console.warn('Failed to save command history:', e)
    }
  }, [history])

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        try {
          const newHistory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
          setHistory(newHistory)
        } catch {
          setHistory([])
        }
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const addToHistory = useCallback((command) => {
    if (!command || !command.trim()) return
    const trimmed = command.trim()
    setHistory(prev => {
      const filtered = prev.filter(c => c !== trimmed)
      const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY)
      return updated
    })
    setHistoryIndex(-1)
  }, [])

  const getPrevious = useCallback(() => {
    const currentHistory = historyRef.current
    if (currentHistory.length === 0) return null
    if (historyIndex >= currentHistory.length - 1) return null
    const newIndex = historyIndex + 1
    setHistoryIndex(newIndex)
    return currentHistory[newIndex]
  }, [historyIndex]) // Only depend on index, use ref for history

  const getNext = useCallback(() => {
    const currentHistory = historyRef.current
    if (historyIndex <= -1) return null
    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    if (newIndex >= 0) {
      return currentHistory[newIndex]
    }
    return null
  }, [historyIndex]) // Only depend on index, use ref for history

  const clearHistory = useCallback(() => {
    setHistory([])
    setHistoryIndex(-1)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('Failed to clear command history:', e)
    }
  }, [])

  return { history, addToHistory, getPrevious, getNext, clearHistory }
}

export function useAllCommandHistory() {
  const [allHistory, setAllHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch { return [] }
  })

  useEffect(() => {
    const handleStorage = () => {
      try {
        setAllHistory(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
      } catch {
        setAllHistory([])
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return allHistory
}
