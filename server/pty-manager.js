import * as pty from 'node-pty'
import os from 'os'
import fs from 'fs'
import path from 'path'

const shells = process.platform === 'win32' ? 'powershell.exe' : (os.userInfo().shell || '/bin/bash')
const sessions = new Map()
const HEARTBEAT_INTERVAL = 30000 // 30 seconds heartbeat to detect stale connections

export function createSession(sessionId, socket, cwd = null) {
  // Kill existing session with same id
  if (sessions.has(sessionId)) deleteSession(sessionId)

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
    if (socket && !socket.connected) {
      console.log(`Heartbeat detected stale socket for session ${sessionId}, cleaning up`)
      deleteSession(sessionId)
    }
  }, HEARTBEAT_INTERVAL)

  const session = { pty: ptyProcess, cwd: workingDir, socket, lastSeq: -1, heartbeat }
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
    // Clean up socket connection if it exists
    if (session.socket) {
      try {
        session.socket.disconnect();
      } catch (e) {
        // Socket might already be disconnected
      }
    }
    try {
      session.pty.kill();
    } catch (e) {
      // PTY might already be dead
    }
    sessions.delete(sessionId);
    console.log(`Session ${sessionId} cleaned up`);
  }
}

export function getAllSessions() {
  return Array.from(sessions.keys())
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
