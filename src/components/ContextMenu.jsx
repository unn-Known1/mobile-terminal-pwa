import { useEffect, useRef } from 'react'
import { Copy, Clipboard, CheckSquare } from 'lucide-react'

export default function ContextMenu({ x, y, onCopy, onPaste, onSelectAll, onClose, hasSelection }) {
  const menuRef = useRef(null)

  useEffect(() => {
    if (!x || !y) return

    // Adjust position if menu would go off-screen
    const menu = menuRef.current
    if (menu) {
      const rect = menu.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = x
      let adjustedY = y

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10
      }
      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10
      }

      menu.style.left = `${adjustedX}px`
      menu.style.top = `${adjustedY}px`
    }

    // Close menu on click outside
    const handleClickOutside = (e) => {
      if (menu && !menu.contains(e.target)) {
        onClose()
      }
    }

    // Close menu on scroll
    const handleScroll = () => onClose()

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [x, y, onClose])

  if (x === undefined || y === undefined) return null

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9999,
      }}
    >
      <button className="context-menu-item" onClick={onPaste}>
        <Clipboard size={14} />
        <span>Paste</span>
      </button>
      {hasSelection && (
        <button className="context-menu-item" onClick={onCopy}>
          <Copy size={14} />
          <span>Copy</span>
        </button>
      )}
      <button className="context-menu-item" onClick={onSelectAll}>
        <CheckSquare size={14} />
        <span>Select All</span>
      </button>
    </div>
  )
}
