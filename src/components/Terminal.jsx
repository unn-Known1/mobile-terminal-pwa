import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { SearchAddon } from 'xterm-addon-search'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { useSocket } from '../hooks/useSocket'
import { useCommandHistory } from '../hooks/useCommandHistory'
import MobileKeyboard from './MobileKeyboard'
import ContextMenu from './ContextMenu'

export default function Terminal({ sessionId, cwd = null, fontSize = 14, theme, onStatusChange }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitAddonRef = useRef(null)
  const [lastActivity, setLastActivity] = useState(Date.now())
  const { socket, connected } = useSocket('/')
  const { addToHistory, getPrevious, getNext } = useCommandHistory(sessionId)
  const commandBufferRef = useRef('')
  const seqRef = useRef(0) // monotonically increasing sequence number per terminal
  const [contextMenu, setContextMenu] = useState(null) // { x, y, selection }

  // Initial terminal setup
  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      theme: buildTheme(theme),
      fontSize,
      fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
      cursorBlink: true,
      allowTransparency: true,
      scrollback: 5000,
      macOptionIsMeta: true,
      disableStdin: false,
      cursorStyle: 'block',
      overviewRulerWidth: 0,
    })

    // Prevent viewport issues by setting the scrollbar strategy
    term.options.scrollbarWidth = 0

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    // Add id and name to xterm's hidden textarea to satisfy autofill/accessibility checks
    // The textarea is used for mobile input capture and is created by xterm.js
    const textarea = containerRef.current.querySelector('textarea')
    if (textarea && !textarea.id) {
      const taId = `xterm-textarea-${sessionId || Math.random().toString(36).substr(2, 9)}`
      textarea.id = taId
      textarea.name = taId
    }
    
    // Delay fit to ensure viewport is ready
    const doFit = () => {
      if (containerRef.current?.offsetWidth > 0 && containerRef.current?.offsetHeight > 0) {
        try { fitAddon.fit() } catch {}
      }
    }
    setTimeout(doFit, 100)
     setTimeout(doFit, 300)

      termRef.current = term
      fitAddonRef.current = fitAddon

     const onResize = () => {
      if (containerRef.current?.offsetWidth > 0) {
        try { fitAddon.fit() } catch {}
      }
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(containerRef.current)
    window.addEventListener('resize', onResize)

    // Handle right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault()
      const selection = term.getSelection()
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        selection: selection,
        hasSelection: selection.length > 0
      })
    }

    containerRef.current.addEventListener('contextmenu', handleContextMenu)

     // Ctrl+F → search
     term.attachCustomKeyEventHandler(e => {
       if (e.type === 'keydown') {
         // Search: Ctrl+F
         if (e.ctrlKey && e.key === 'f') {
           const query = window.prompt('Search:')
           if (query) searchAddon.findNext(query)
           return false
         }

         // Enter key: submit command
         if (e.key === 'Enter') {
           if (commandBufferRef.current.trim()) {
             addToHistory(commandBufferRef.current)
           }
           commandBufferRef.current = ''
           return true // allow newline to be sent to pty
         }

         // Arrow Up: previous command in history
         if (e.key === 'ArrowUp') {
           e.preventDefault()
           const prev = getPrevious()
           if (prev) {
             term.write('\r\x1b[K' + prev)
             commandBufferRef.current = prev
           }
           return false
         }

         // Arrow Down: next command in history
         if (e.key === 'ArrowDown') {
           e.preventDefault()
           const next = getNext()
           if (next) {
             term.write('\r\x1b[K' + next)
             commandBufferRef.current = next
           } else {
             term.write('\r\x1b[K')
             commandBufferRef.current = ''
           }
           return false
         }
       }
       return true
     })

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
      containerRef.current?.removeEventListener('contextmenu', handleContextMenu)
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Connect terminal to socket session
  useEffect(() => {
    if (!socket || !termRef.current) return

    const term = termRef.current

    // Create PTY session for this tab
    socket.emit('create-tab', { sessionId, cwd })

    const onData = ({ sessionId: sid, data }) => {
      if (sid === sessionId) {
        term.write(data)
        setLastActivity(Date.now())
        onStatusChange?.(sessionId, 'notification')
      }
    }
    const onExit = ({ sessionId: sid }) => {
      if (sid === sessionId) {
        term.writeln('\r\n\x1b[33m[Process exited]\x1b[0m')
        onStatusChange?.(sessionId, 'idle')
      }
    }
    const onSessionReady = ({ sessionId: sid }) => {
      if (sid === sessionId) {
        try { fitAddonRef.current?.fit() } catch {}
        socket.emit('resize', {
          sessionId,
          cols: term.cols,
          rows: term.rows,
        })
      }
    }

    socket.on('data', onData)
    socket.on('exit', onExit)
    socket.on('session-ready', onSessionReady)

     const dataDispose = term.onData(data => {
       const seq = seqRef.current++
       socket.emit('data', { sessionId, data, seq })
       // Update commandBufferRef based on data
       for (let i = 0; i < data.length; i++) {
         const char = data[i]
         if (char === '\r' || char === '\n') {
           commandBufferRef.current = ''
         } else if (char === '\x7f' || char === '\x08') {
           commandBufferRef.current = commandBufferRef.current.slice(0, -1)
         } else if (char >= ' ' && char <= '~') {
           commandBufferRef.current += char
         }
         // Ignore other control characters (escape sequences etc.)
       }

       // Add to history on Enter
       if (data.includes('\r') || data.includes('\n')) {
         const cmd = commandBufferRef.current.trim()
         if (cmd) {
           addToHistory(cmd)
         }
         commandBufferRef.current = ''
       }
     })

    const resizeDispose = term.onResize(({ cols, rows }) => {
      socket.emit('resize', { sessionId, cols, rows })
    })

    return () => {
      socket.off('data', onData)
      socket.off('exit', onExit)
      socket.off('session-ready', onSessionReady)
      dataDispose.dispose()
      resizeDispose.dispose()
      socket.emit('close-session', { sessionId })
    }
  }, [socket, sessionId, cwd])

  // Live-update fontSize without recreating terminal
  useEffect(() => {
    if (!termRef.current) return
    termRef.current.options.fontSize = fontSize
    try { fitAddonRef.current?.fit() } catch {}
  }, [fontSize])

  // Live-update theme without recreating terminal
  useEffect(() => {
    if (!termRef.current) return
    termRef.current.options.theme = buildTheme(theme)
  }, [theme])

  // Idle status check
  useEffect(() => {
    const idleCheck = setInterval(() => {
      if (Date.now() - lastActivity > 30000) {
        onStatusChange?.(sessionId, 'idle')
      }
    }, 30000)
    return () => clearInterval(idleCheck)
  }, [sessionId, lastActivity])

  const handleMobileKey = (value) => {
    if (socket) socket.emit('data', { sessionId, data: value, seq: seqRef.current++ })
  }

  // Clipboard operations for context menu
  const handleCopy = useCallback(() => {
    if (contextMenu?.selection) {
      navigator.clipboard.writeText(contextMenu.selection)
      termRef.current?.clearSelection()
    }
    setContextMenu(null)
  }, [contextMenu])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (socket && text) {
        socket.emit('data', { sessionId, data: text, seq: seqRef.current++ })
      }
    } catch (err) {
      console.error('Failed to paste:', err)
    }
    setContextMenu(null)
  }, [socket, sessionId])

  const handleSelectAll = useCallback(() => {
    if (termRef.current) {
      // Select all content in terminal
      const term = termRef.current
      term.selectAll()
    }
    setContextMenu(null)
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  return (
    <div className="terminal-wrapper">
      {!connected && (
        <div className="terminal-overlay">
          <span className="reconnecting">Reconnecting…</span>
        </div>
      )}
      <div ref={containerRef} className="terminal-container" />
      <MobileKeyboard onKey={handleMobileKey} />
      <ContextMenu
        x={contextMenu?.x}
        y={contextMenu?.y}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onSelectAll={handleSelectAll}
        onClose={closeContextMenu}
        hasSelection={contextMenu?.hasSelection}
      />
    </div>
  )
}

function buildTheme(theme) {
  return {
    background: theme?.background || '#0F172A',
    foreground: theme?.foreground || '#F8FAFC',
    cursor: theme?.cursor || '#22C55E',
    cursorAccent: theme?.background || '#0F172A',
    selection: 'rgba(34, 197, 94, 0.25)',
    black: '#1E293B',
    red: '#EF4444',
    green: '#22C55E',
    yellow: '#EAB308',
    blue: '#3B82F6',
    magenta: '#A855F7',
    cyan: '#06B6D4',
    white: '#F8FAFC',
    brightBlack: '#475569',
    brightRed: '#F87171',
    brightGreen: '#4ADE80',
    brightYellow: '#FDE047',
    brightBlue: '#60A5FA',
    brightMagenta: '#C084FC',
    brightCyan: '#22D3EE',
    brightWhite: '#FFFFFF',
  }
}
