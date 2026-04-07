import * as pty from 'node-pty'
import os from 'os'
import fs from 'fs'
import path from 'path'

const shells = process.platform === 'win32' ? 'powershell.exe' : (os.userInfo().shell || '/bin/bash')
const sessions = new Map()

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
    socket?.emit('exit', { sessionId, error: err.message })
    return null
  }

  const session = { pty: ptyProcess, cwd: workingDir, socket }
  sessions.set(sessionId, session)

  ptyProcess.onData(data => {
    // Always emit with sessionId so client can route correctly
    session.socket?.emit('data', { sessionId, data })
  })

  ptyProcess.onExit(({ exitCode, signal }) => {
    session.socket?.emit('exit', { sessionId, exitCode, signal })
    sessions.delete(sessionId)
  })

  return session
}

export function getSession(sessionId) {
  return sessions.get(sessionId)
}

export function deleteSession(sessionId) {
  const session = sessions.get(sessionId)
  if (session) {
    try { session.pty.kill() } catch {}
    sessions.delete(sessionId)
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
