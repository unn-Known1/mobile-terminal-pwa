import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

// Shared singleton — all Terminal instances share one connection
let _socket = null
let _refCount = 0

function getSharedSocket(url) {
  if (!_socket) {
    _socket = io(url, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    })
  }
  return _socket
}

export function useSocket(url) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    socketRef.current = getSharedSocket(url)
    _refCount++

    const onConnect = () => { setConnected(true); setTick(n => n + 1) }
    const onDisconnect = () => setConnected(false)

    socketRef.current.on('connect', onConnect)
    socketRef.current.on('disconnect', onDisconnect)

    if (socketRef.current.connected) setConnected(true)

    return () => {
      socketRef.current?.off('connect', onConnect)
      socketRef.current?.off('disconnect', onDisconnect)
      _refCount--
      if (_refCount === 0 && _socket) {
        _socket.disconnect()
        _socket = null
      }
    }
  }, [url])

  return { socket: socketRef.current, connected }
}
