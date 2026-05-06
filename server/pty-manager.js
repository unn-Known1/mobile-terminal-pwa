import * as pty from 'node-pty'
import os from 'os'
import fs from 'fs'
import path from 'path'

const shells = process.platform === 'win32' ? 'powershell.exe' : (os.userInfo().shell || '/bin/bash')
const sessions = new Map()
const HEARTBEAT_INTERVAL = 30000 // 30 seconds heartbeat to detect stale connections

// Critical Fix #2: Session Reaper - Kill orphaned PTY processes after socket disconnection
const SESSION_REAP_INTERVAL = 60000 // Check every 60 seconds
const SESSION_ORPHAN_TIMEOUT = 60000 // Consider session orphaned after 60 seconds of socket disconnect

// Track when socket disconnected for each session
const socketDisconnectTime = new Map()

let reaperInterval = null

function startSessionReaper() {
  if (reaperInterval) return

  reaperInterval = setInterval(() => {
    const now = Date.now()
    const toDelete = []

    sessions.forEach((session, sessionId) => {
      // Skip if session already has a connected socket
      if (session.socket?.connected) {
        socketDisconnectTime.delete(sessionId)
        return
      }

      // Check if we recorded a disconnect time
      const disconnectTime = socketDisconnectTime.get(sessionId)
      if (!disconnectTime) {
        // First time we see this session without a connected socket
        socketDisconnectTime.set(sessionId, now)
        return
      }

      // If orphaned for too long, mark for deletion
      if (now - disconnectTime > SESSION_ORPHAN_TIMEOUT) {
        console.log(`[Reaper] Session ${sessionId} orphaned for ${now - disconnectTime}ms, killing...`)
        toDelete.push(sessionId)
      }
    })

    // Clean up orphaned sessions
    toDelete.forEach(sessionId => {
      socketDisconnectTime.delete(sessionId)
      deleteSession(sessionId)
    })

    if (toDelete.length > 0) {
      console.log(`[Reaper] Cleaned up ${toDelete.length} orphaned sessions`)
    }
  }, SESSION_REAP_INTERVAL)

  console.log('[Reaper] Session reaper started')
}

function stopSessionReaper() {
  if (reaperInterval) {
    clearInterval(reaperInterval)
    reaperInterval = null
    console.log('[Reaper] Session reaper stopped')
  }
}

export function recordSocketDisconnect(sessionId) {
  socketDisconnectTime.set(sessionId, Date.now())
}

export function clearSocketDisconnect(sessionId) {
  socketDisconnectTime.delete(sessionId)
}

export function createSession(sessionId, socket, cwd = null) {
  // Kill existing session with same id
  if (sessions.has(sessionId)) deleteSession(sessionId)

  // Start session reaper if not already running
  startSessionReaper()

  // Clear any disconnect tracking for this session
  clearSocketDisconnect(sessionId)

  const workingDir = cwd || process.env.HOME || os.homedir()

  let ptyProcess
  try {
    ptyProcess = pty.spawn(shells, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: workingDir,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    })
  } catch (err) {
    console.error('PTY spawn failed:', err)
    socket?.emit('error', { sessionId, error: err.message })
    return null
  }

// Handle PTY errors
  ptyProcess.on('error', (err) => {
    console.error(`PTY error for session ${sessionId}:`, err.message);
    socket?.emit('error', { sessionId, error: err.message });
  });

  // Heartbeat to detect if socket connection is stale
  const heartbeat = setInterval(() => {
    // Check if socket is still connected - only log warnings, don't auto-delete
    // Session cleanup is handled by server.js's disconnect event
    if (socket && !socket.connected) {
      console.log(`Heartbeat: socket for session ${sessionId} is disconnected (will be cleaned by disconnect handler)`)
    }
  }, HEARTBEAT_INTERVAL)

  const session = {
    pty: ptyProcess,
    cwd: workingDir,
    socket,
    socketId: socket?.id,  // Track which socket owns this session
    lastSeq: -1,
    heartbeat
  }
  sessions.set(sessionId, session)

  ptyProcess.onData(data => {
    // Always emit with sessionId so client can route correctly
    session.socket?.emit('data', { sessionId, data })
  })

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`PTY exited for session ${sessionId}: code=${exitCode}, signal=${signal}`);
    // Clean up heartbeat on PTY exit
    if (session.heartbeat) clearInterval(session.heartbeat);
    // Notify all connected clients about the exit
    session.socket?.emit('exit', { sessionId, exitCode, signal });
    // Remove from sessions
    sessions.delete(sessionId);
  });

  return session
}

export function getSession(sessionId) {
  return sessions.get(sessionId)
}

export function deleteSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    // Clean up heartbeat interval if it exists
    if (session.heartbeat) clearInterval(session.heartbeat);
    // NOTE: Do NOT disconnect the socket here - each socket can have multiple sessions
    // Socket disconnection is handled by Socket.IO's disconnect event in server.js
    try {
      session.pty.kill();
    } catch (e) {
      // PTY might already be dead
    }
    sessions.delete(sessionId);
    console.log(`Session ${sessionId} cleaned up`);
  }
  // Clear disconnect tracking
  socketDisconnectTime.delete(sessionId)
}

export function getAllSessions() {
  return Array.from(sessions.keys())
}

export function reconnectSession(sessionId, socket, cwd = null) {
  const existingSession = sessions.get(sessionId)
  // Fix B13: Use public exitCode property instead of private _exited
  let isExited = true
  try {
    isExited = existingSession?.pty?.exitCode !== null
  } catch {}

  if (existingSession && existingSession.pty && !isExited) {
    // Session still alive, just reconnect the socket
    existingSession.socket = socket
    existingSession.socketId = socket?.id
    // Emit current PTY state
    socket?.emit('data', { sessionId, data: '' }) // Signal reconnection complete
    return existingSession
  }

  // Session dead or doesn't exist, create new one
  return createSession(sessionId, socket, cwd)
}

export function listDirectory(dirPath) {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    return items
      .map(item => ({
        name: item.name,
        isDirectory: item.isDirectory(),
        path: path.join(dirPath, item.name),
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  } catch (err) {
    return { error: err.message }
  }
}
