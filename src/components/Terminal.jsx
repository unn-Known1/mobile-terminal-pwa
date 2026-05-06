import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useSocket } from '../hooks/useSocket'
import { useCommandHistory } from '../hooks/useCommandHistory'
import MobileKeyboard from './MobileKeyboard'
import ContextMenu from './ContextMenu'

export default function Terminal({ sessionId, cwd = null, fontSize = 14, theme, onStatusChange, onCwdChange }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitAddonRef = useRef(null)
  const searchAddonRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const clipboardRef = useRef(null)
  const searchInputRef = useRef(null)

  const [connected, setConnected] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState({ index: -1, count: 0 })
  const [cursorStyle, setCursorStyle] = useState('block')
  const [showTerminalSettings, setShowTerminalSettings] = useState(false)

  const isAtBottomRef = useRef(true)
  const searchVisibleRef = useRef(false)
  const searchMatchesRef = useRef([])

  // Refs to avoid stale closures
  const socketRef = useRef(null)
  const sessionIdRef = useRef(sessionId)
  const addToHistoryRef = useRef(null)

  const { socket } = useSocket('/')
  const { addToHistory } = useCommandHistory(sessionId)
  const seqRef = useRef(0)
  const [contextMenu, setContextMenu] = useState(null)
  const lastClickRef = useRef({ time: 0, y: 0 })

  // Update refs when props change
  useEffect(() => { socketRef.current = socket }, [socket])
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])
  useEffect(() => { addToHistoryRef.current = addToHistory }, [addToHistory])

  // Critical Fix #4: Handle paste event from top-bar paste button
  useEffect(() => {
    const handlePasteEvent = (e) => {
      const text = e.detail?.text
      if (text && socket) {
        socket.emit('data', { sessionId, data: text, seq: seqRef.current++ })
      }
    }
    window.addEventListener('terminal-paste', handlePasteEvent)
    return () => window.removeEventListener('terminal-paste', handlePasteEvent)
  }, [socket, sessionId])

  // Scroll handler defined at component level
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 50
    isAtBottomRef.current = atBottom
    setIsAtBottom(atBottom)
    setShowScrollHint(scrollTop > 100)
  }, [])

  // Build theme
  const terminalTheme = useMemo(() => buildTheme(theme, cursorStyle), [theme, cursorStyle])

  // Initialize terminal with all features
  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      theme: terminalTheme,
      fontSize,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Hack', 'Consolas', monospace",
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorBlink: true,
      cursorInactiveStyle: 'outline',
      allowTransparency: true,
      scrollback: 50000,
      macOptionIsMeta: true,
      disableStdin: false,
      cursorStyle: cursorStyle,
      convertEol: false,
      termName: 'xterm-256color',
      allowProposedApi: true,
    })

    // Load addons
    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(webLinksAddon)

    term.open(containerRef.current)

    // Store refs
    termRef.current = term
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    // Clear any existing terminal content when sessionId changes
    // This prevents content leakage between sessions in split mode (Critical #3 fix)
    term.clear()

    // Fit terminal
    const doFit = () => {
      if (containerRef.current?.offsetWidth > 0 && containerRef.current?.offsetHeight > 0) {
        try {
          fitAddon.fit()
          // Send initial size
          socketRef.current?.emit('resize', {
            sessionId: sessionIdRef.current,
            cols: term.cols,
            rows: term.rows,
          })
        } catch {}
      }
    }
    setTimeout(doFit, 50)
    setTimeout(doFit, 200)
    setTimeout(doFit, 500)

    // Store container reference for cleanup
    const container = containerRef.current

    // Resize observer
    const ro = new ResizeObserver(() => {
      try { fitAddon.fit() } catch {}
    })
    ro.observe(container)

    // Window resize
    const handleResize = () => {
      try { fitAddon.fit() } catch {}
    }
    window.addEventListener('resize', handleResize)

    // Context menu
    const handleContextMenu = (e) => {
      e.preventDefault()
      const selection = term.getSelection()
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        selection: selection,
        hasSelection: selection.length > 0,
        isLink: false,
      })
    }
    container.addEventListener('contextmenu', handleContextMenu)

    // Mouse events for improved selection
    const handleMouseDown = (e) => {
      // Double click - select word (improved behavior)
      const now = Date.now()
      if (now - lastClickRef.current.time < 400) {
        const deltaY = Math.abs(e.clientY - lastClickRef.current.y)
        if (deltaY < 10) {
          // Let xterm handle selection naturally
          lastClickRef.current = { time: 0, y: 0 }
          return
        }
      }
      lastClickRef.current = { time: now, y: e.clientY }
    }
    container.addEventListener('mousedown', handleMouseDown)

    // Bell handling - visual flash
    const bellDisposable = term.onBell(() => {
      container.classList.add('bell-flash')
      setTimeout(() => container.classList.remove('bell-flash'), 150)
    })

    // Keyboard shortcuts handler
    const keyHandlerDisposable = term.attachCustomKeyEventHandler(e => {
      const key = e.key.toLowerCase()

      // Ctrl+L - send clear to PTY instead of just clearing terminal
      if (e.type === 'keydown' && e.ctrlKey && key === 'l') {
        socketRef.current?.emit('data', {
          sessionId: sessionIdRef.current,
          data: '\x0c',  // Ctrl+L character
          seq: seqRef.current++,
        })
        return false
      }

      // Ctrl+F - open search (case insensitive)
      if (e.type === 'keydown' && e.ctrlKey && key === 'f') {
        setIsSearchOpen(true)
        searchVisibleRef.current = true
        setTimeout(() => searchInputRef.current?.focus(), 50)
        return false
      }

      // Ctrl+Shift+C / Ctrl+Shift+V - native copy/paste (case insensitive)
      if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && key === 'c') {
        const selection = term.getSelection()
        if (selection) {
          navigator.clipboard.writeText(selection).catch(() => {})
        }
        return false
      }

      if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && key === 'v') {
        navigator.clipboard.readText().then(text => {
          if (text && socketRef.current) {
            socketRef.current.emit('data', {
              sessionId: sessionIdRef.current,
              data: text,
              seq: seqRef.current++
            })
          }
        }).catch(() => {})
        return false
      }

      // Escape - close search
      if (e.type === 'keydown' && e.key === 'Escape' && searchVisibleRef.current) {
        setIsSearchOpen(false)
        searchVisibleRef.current = false
        searchAddon.clearDecorations()
        return false
      }

      return true
    })

    // Track command input for history and send to PTY
    let inputBuffer = ''
    let inputPosition = 0

    const dataDisposable = term.onData(data => {
      // Send to PTY - this is critical!
      socketRef.current?.emit('data', {
        sessionId: sessionIdRef.current,
        data,
        seq: seqRef.current++,
      })

      // Track input for history
      if (data === '\r' || data === '\n') {
        const cmd = inputBuffer.trim()
        if (cmd) {
          addToHistoryRef.current?.(cmd)
        }
        inputBuffer = ''
        inputPosition = 0
      } else if (data === '\x7f' || data === '\x08') {
        if (inputPosition > 0) {
          inputBuffer = inputBuffer.slice(0, -1)
          inputPosition--
        }
      } else if (data.length === 1 && data >= ' ' && data <= '~') {
        inputBuffer += data
        inputPosition++
      }
    })

    // Cleanup
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('contextmenu', handleContextMenu)
      container.removeEventListener('mousedown', handleMouseDown)
      // Fix: Check if disposables exist before calling dispose()
      bellDisposable?.dispose()
      keyHandlerDisposable?.dispose()
      dataDisposable?.dispose()
      try {
        term.dispose()
      } catch {}
      termRef.current = null
      fitAddonRef.current = null
      searchAddonRef.current = null
    }
  }, [sessionId]) // Critical Fix #3: Added sessionId to dependencies to remount terminal when session changes

  // Search functions
  const updateSearchResults = useCallback((addon, query) => {
    if (!addon || !query) {
      setSearchResults({ index: -1, count: 0 })
      return
    }
    try {
      const found = addon.findNext(query, { decorations: true })
      setSearchResults({
        index: found ? 0 : -1,
        count: found ? 1 : 0,
      })
    } catch {}
  }, [])

  const handleSearch = useCallback((query) => {
    setSearchQuery(query)
    const searchAddon = searchAddonRef.current
    if (searchAddon && query) {
      updateSearchResults(searchAddon, query)
    } else {
      setSearchResults({ index: -1, count: 0 })
    }
  }, [updateSearchResults])

  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      const searchAddon = searchAddonRef.current
      if (searchAddon && searchQuery) {
        searchAddon.findPrevious(searchQuery, { decorations: true })
        updateSearchResults(searchAddon, searchQuery)
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false)
      searchVisibleRef.current = false
      searchAddonRef.current?.clearDecorations()
    }
  }, [searchQuery, updateSearchResults])

  // Socket connection
  useEffect(() => {
    if (!socket || !termRef.current) return

    const term = termRef.current

    // Connection handlers
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    if (socket.connected) setConnected(true)

    // Create PTY session
    socket.emit('create-tab', { sessionId, cwd })

    // Data from PTY
    const onData = ({ sessionId: sid, data }) => {
      if (sid === sessionId) {
        term.write(data)
        onStatusChange?.(sessionId, 'notification')

        // Auto-scroll to bottom
        if (isAtBottomRef.current) {
          requestAnimationFrame(() => {
            scrollContainerRef.current?.scrollTo({
              top: scrollContainerRef.current.scrollHeight,
              behavior: 'auto'
            })
          })
        }
      }
    }

    // Session exit
    const onExit = ({ sessionId: sid, exitCode, signal }) => {
      if (sid === sessionId) {
        const exitMsg = signal
          ? `\r\n\x1b[33m[Process exited with signal ${signal}]\x1b[0m`
          : `\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`
        term.writeln(exitMsg)
        onStatusChange?.(sessionId, 'idle')
      }
    }

    // Session ready - notify parent of actual cwd
    const onSessionReady = ({ sessionId: sid, cwd: sessionCwd }) => {
      if (sid === sessionId) {
        try { fitAddonRef.current?.fit() } catch {}
        socket.emit('resize', {
          sessionId,
          cols: term.cols,
          rows: term.rows,
        })
        // Notify parent of the cwd so it can be saved for persistence
        if (sessionCwd && onCwdChange) {
          onCwdChange(sessionId, sessionCwd)
        }
      }
    }

    socket.on('data', onData)
    socket.on('exit', onExit)
    socket.on('session-ready', onSessionReady)

    // Resize handler
    const resizeDispose = term.onResize(({ cols, rows }) => {
      socket.emit('resize', { sessionId, cols, rows })
    })

    // Track if this is a reconnection (session already exists)
    let isReconnect = false
    const onConnectCheck = () => {
      // Check if session already existed by checking if session-ready was already received
      isReconnect = true
    }
    socket.on('connect', onConnectCheck)
    if (socket.connected) isReconnect = true

    // Cleanup - DON'T close session on unmount to preserve it for reconnection
    // Sessions are now managed server-side and persist across reconnections
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('data', onData)
      socket.off('exit', onExit)
      socket.off('session-ready', onSessionReady)
      socket.off('connect', onConnectCheck)
      // Fix: Check if resizeDispose exists before disposing
      resizeDispose?.dispose()
      // NOTE: We intentionally do NOT emit 'close-session' here anymore
      // Sessions are now persistent and will be cleaned up by the session reaper
      // or when explicitly requested via the close-tab button
    }
  }, [socket, sessionId, cwd, onStatusChange])

  // Font size update
  useEffect(() => {
    if (!termRef.current) return
    termRef.current.options.fontSize = fontSize
    try { fitAddonRef.current?.fit() } catch {}
  }, [fontSize])

  // Theme update
  useEffect(() => {
    if (!termRef.current) return
    termRef.current.options.theme = terminalTheme
  }, [terminalTheme])

  // Cursor style update
  useEffect(() => {
    if (!termRef.current) return
    termRef.current.options.cursorStyle = cursorStyle
  }, [cursorStyle])

  // Mobile keyboard handler
  const handleMobileKey = useCallback((value) => {
    if (socket) socket.emit('data', { sessionId, data: value, seq: seqRef.current++ })
  }, [socket, sessionId])

  // Context menu handlers
  const handleCopy = useCallback(() => {
    const selection = termRef.current?.getSelection()
    if (selection) {
      navigator.clipboard.writeText(selection).catch(() => {})
      termRef.current?.clearSelection()
    }
    setContextMenu(null)
  }, [])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (socket && text) {
        socket.emit('data', { sessionId, data: text, seq: seqRef.current++ })
      }
    } catch {}
    setContextMenu(null)
  }, [socket, sessionId])

  const handleSelectAll = useCallback(() => {
    termRef.current?.selectAll()
    setContextMenu(null)
  }, [])

  const scrollToBottom = useCallback(() => {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }, [])

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div className="terminal-wrapper">
      {/* Connection overlay */}
      {!connected && (
        <div className="terminal-overlay">
          <div className="reconnecting-spinner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
              </path>
            </svg>
          </div>
          <span>Reconnecting…</span>
        </div>
      )}

      {/* Search bar */}
      {isSearchOpen && (
        <div className="terminal-search-bar">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {searchResults.count > 0 && (
            <span className="search-count">
              {searchResults.index + 1}/{searchResults.count}
            </span>
          )}
          <button
            className="search-close"
            onClick={() => {
              setIsSearchOpen(false)
              searchAddonRef.current?.clearDecorations()
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Terminal container with custom scrollbar */}
      <div
        ref={scrollContainerRef}
        className="terminal-scroll-container"
        onScroll={handleScroll}
      >
        <div ref={containerRef} className="terminal-container" />
      </div>

      {/* Scroll position indicators */}
      {showScrollHint && isAtBottom && (
        <button
          className="scroll-to-top"
          onClick={scrollToTop}
          title="Scroll to top"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      )}

      {!isAtBottom && (
        <button
          className="scroll-to-bottom"
          onClick={scrollToBottom}
          title="Scroll to bottom"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      )}

      {/* Terminal settings panel */}
      {showTerminalSettings && (
        <div className="terminal-settings-panel">
          <div className="settings-section">
            <label>Cursor Style</label>
            <div className="cursor-styles">
              <button
                className={cursorStyle === 'block' ? 'active' : ''}
                onClick={() => setCursorStyle('block')}
              >
                <span className="cursor-preview block" />
                Block
              </button>
              <button
                className={cursorStyle === 'underline' ? 'active' : ''}
                onClick={() => setCursorStyle('underline')}
              >
                <span className="cursor-preview underline" />
                Underline
              </button>
              <button
                className={cursorStyle === 'bar' ? 'active' : ''}
                onClick={() => setCursorStyle('bar')}
              >
                <span className="cursor-preview bar" />
                Bar
              </button>
            </div>
          </div>
          <button
            className="settings-close"
            onClick={() => setShowTerminalSettings(false)}
          >
            Close
          </button>
        </div>
      )}

      {/* Mobile keyboard */}
      <MobileKeyboard onKey={handleMobileKey} />

      {/* Context menu */}
      <ContextMenu
        x={contextMenu?.x}
        y={contextMenu?.y}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onSelectAll={handleSelectAll}
        onClose={() => setContextMenu(null)}
        hasSelection={contextMenu?.hasSelection}
      />
    </div>
  )
}

function buildTheme(theme, cursorStyle = 'block') {
  const bg = theme?.background || '#0F172A'
  const fg = theme?.foreground || '#F8FAFC'
  return {
    background: bg,
    foreground: fg,
    cursor: theme?.cursor || '#22C55E',
    cursorAccent: bg,
    selectionBackground: 'rgba(34, 197, 94, 0.3)',
    selectionForeground: fg,
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