import { useState, useEffect, useCallback } from 'react'
import Terminal from './Terminal'
import { X, Plus, ChevronDown, Split, Columns2, Rows2 } from 'lucide-react'

export default function SplitTerminal({ tabs = [], activeTab, fontSize, theme, tabStatuses, onStatusChange, orientation, onOrientationChange, onCwdChange }) {
  const [splits, setSplits] = useState([{ id: 'main', tabId: activeTab }])
  const [dropdownOpen, setDropdownOpen] = useState(null)

  // Sync first split with activeTab when it changes
  useEffect(() => {
    if (!tabs || tabs.length === 0) return
    setSplits(prev => {
      if (prev.length === 0) return prev
      const firstTabStillExists = tabs.some(t => t.id === prev[0].tabId)
      if (!firstTabStillExists && tabs.length > 0) {
        return [{ id: 'main', tabId: activeTab || tabs[0].id }]
      }
      return prev
    })
  }, [activeTab, tabs])

  // Close dropdown on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && dropdownOpen) {
        setDropdownOpen(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dropdownOpen])

  const addSplit = useCallback(() => {
    const newId = 'split-' + Date.now()
    const availableTabs = tabs.filter(t => !splits.some(s => s.tabId === t.id))
    if (availableTabs.length === 0) return
    setSplits(prev => [...prev, { id: newId, tabId: availableTabs[0].id }])
  }, [tabs, splits])

  const removeSplit = useCallback((splitId) => {
    setSplits(prev => prev.filter(s => s.id !== splitId))
  }, [])

  const assignTabToSplit = useCallback((splitId, tabId) => {
    setSplits(prev => prev.map(s => s.id === splitId ? { ...s, tabId } : s))
    setDropdownOpen(null)
  }, [])

  const maxSplits = 4
  const canAddSplit = splits.length < maxSplits && tabs.length > splits.length

  return (
    <div className={`split-container ${orientation}`}>
      {/* Split Panes */}
      <div className="split-panes">
        {splits.map((split, index) => {
          const tab = tabs.find(t => t.id === split.tabId)
          if (!tab) return null
          
          return (
            <div key={split.id} className="split-pane">
              {/* Split Header with Tab Selector */}
              <div className="split-header">
                <button
                  className="tab-selector-btn"
                  onClick={() => setDropdownOpen(dropdownOpen === split.id ? null : split.id)}
                  disabled={tabs.length <= 1}
                >
                  <span className="split-index">{index + 1}</span>
                  <span className="tab-name">{tab?.name || 'Terminal'}</span>
                  {tabs.length > 1 && <ChevronDown size={12} className={`chevron ${dropdownOpen === split.id ? 'open' : ''}`} />}
                </button>
                
                <div className="split-controls">
                  <button 
                    className="split-ctrl-btn" 
                    onClick={() => onOrientationChange?.(orientation === 'horizontal' ? 'vertical' : 'horizontal')} 
                    title="Toggle orientation"
                  >
                    {orientation === 'horizontal' ? <Rows2 size={12} /> : <Columns2 size={12} />}
                  </button>
                  {canAddSplit && (
                    <button className="split-ctrl-btn add" onClick={addSplit} title="Add split">
                      <Plus size={12} />
                    </button>
                  )}
                  {splits.length > 1 && (
                    <button className="split-ctrl-btn close" onClick={() => removeSplit(split.id)} title="Close">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Dropdown */}
              {dropdownOpen === split.id && (
                <div className="tab-dropdown">
                  <div className="dropdown-header">Select Tab</div>
                  <div className="dropdown-list">
                    {tabs.map(t => (
                      <button
                        key={t.id}
                        className={`dropdown-item ${t.id === split.tabId ? 'active' : ''}`}
                        onClick={() => assignTabToSplit(split.id, t.id)}
                      >
                        <span className="tab-color" style={{ background: t.color || 'var(--accent)' }} />
                        <span className="tab-label">{t.name || 'Terminal'}</span>
                        {t.id === split.tabId && <span className="check-mark">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Terminal */}
              <Terminal
                sessionId={tab.id}
                cwd={tab.cwd}
                fontSize={fontSize}
                theme={theme}
                onStatusChange={onStatusChange}
                onCwdChange={onCwdChange}
              />
            </div>
          )
        })}
      </div>

      {/* Empty State Hint */}
      {splits.length === 0 && (
        <div className="split-empty">
          <Split size={32} />
          <p>No splits available</p>
          <button onClick={addSplit} className="empty-add-btn">
            <Plus size={16} /> Create Split
          </button>
        </div>
      )}
    </div>
  )
}
