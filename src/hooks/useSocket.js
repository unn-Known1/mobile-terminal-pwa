import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

// Shared singleton — all Terminal instances share one connection
let _socket = null
let _refCount = 0
let _latency = 0
let _reconnectCount = 0
let _reconnectAttempts = 0
let _latencyInterval = null

function getSharedSocket(url) {
  if (!_socket) {
    _socket = io(url, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000, // Increased from 5000
      reconnectionAttempts: Infinity,
      // Add exponential backoff factor
      randomizationFactor: 0.3,
    })

    // Listen for reconnection attempts
    _socket.on('reconnect_attempt', (attempt) => {
      _reconnectAttempts = attempt
    })

    _socket.on('reconnect', (attempt) => {
      _reconnectCount++
      _reconnectAttempts = 0 // Reset attempts on successful reconnect
    })

    _socket.on('disconnect', (reason) => {
      // Log disconnect reason for debugging
      console.log('[Socket] Disconnected:', reason)
    })

    _socket.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message)
    })

    // Periodic latency measurement with better handling
    _latencyInterval = setInterval(() => {
      if (_socket?.connected) {
        const start = Date.now()
        _socket.emit('ping', () => {
          _latency = Date.now() - start
        })
      }
    }, 5000)
  }
  return _socket
}

export function useSocket(url) {
  const [connected, setConnected] = useState(false)
  const [latency, setLatency] = useState(0)
  const [reconnectCount, setReconnectCount] = useState(0)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = getSharedSocket(url)
    socketRef.current = socket
    _refCount++

    // Sync global state to local state periodically
    const syncInterval = setInterval(() => {
      setLatency(_latency)
      setReconnectCount(_reconnectCount)
      setReconnectAttempts(_reconnectAttempts)
    }, 500)

    const onConnect = () => {
      setConnected(true)
    }
    const onDisconnect = () => {
      setConnected(false)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    // Set initial connection state
    if (socket.connected) {
      setConnected(true)
    }

    return () => {
      clearInterval(syncInterval)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      _refCount--
      // Note: We keep the socket alive as a singleton for all components
    }
  }, [url])

  return { socket: socketRef.current, connected, latency, reconnectCount, reconnectAttempts }
}

// Utility hook for socket operations
export function useSocketEmit() {
  const socketRef = useRef(null)

  useEffect(() => {
    socketRef.current = _socket
  }, [])

  const emit = useCallback((event, data) => {
    if (_socket?.connected) {
      _socket.emit(event, data)
      return true
    }
    return false
  }, [])

  return { emit }
}