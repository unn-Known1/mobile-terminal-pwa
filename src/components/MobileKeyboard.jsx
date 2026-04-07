import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

const ROW1 = [
  { label: 'ESC', value: '\x1b' },
  { label: 'TAB', value: '\t' },
  { label: '↑', value: '\x1b[A' },
  { label: '↓', value: '\x1b[B' },
  { label: '←', value: '\x1b[D' },
  { label: '→', value: '\x1b[C' },
  { label: '^C', value: '\x03', accent: true },
  { label: '^D', value: '\x04', accent: true },
]

const ROW2 = [
  { label: '|', value: '|' },
  { label: '~', value: '~' },
  { label: '/', value: '/' },
  { label: '\\', value: '\\' },
  { label: '-', value: '-' },
  { label: '_', value: '_' },
  { label: ':', value: ':' },
  { label: ';', value: ';' },
  { label: '^Z', value: '\x1a', accent: true },
  { label: '^L', value: '\x0c', accent: true },
  { label: 'PgUp', value: '\x1b[5~' },
  { label: 'PgDn', value: '\x1b[6~' },
]

export default function MobileKeyboard({ onKey }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mobile-keyboard">
      <div className="kb-row">
        {ROW1.map(k => (
          <button
            key={k.label}
            className={`kb-key${k.accent ? ' accent' : ''}`}
            onPointerDown={e => { e.preventDefault(); onKey(k.value) }}
          >
            {k.label}
          </button>
        ))}
        <button
          className="kb-key expand-btn"
          onPointerDown={e => { e.preventDefault(); setExpanded(v => !v) }}
          title={expanded ? 'Less keys' : 'More keys'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {expanded && (
        <div className="kb-row">
          {ROW2.map(k => (
            <button
              key={k.label}
              className={`kb-key${k.accent ? ' accent' : ''}`}
              onPointerDown={e => { e.preventDefault(); onKey(k.value) }}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
