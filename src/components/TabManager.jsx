import { useState } from 'react'
import { X, Plus, Terminal } from 'lucide-react'

const TAB_COLORS = [
  { name: 'Default', value: null },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Pink', value: '#EC4899' },
]

export default function TabManager({ tabs, activeTab, onSwitchTab, onNewTab, onCloseTab, onRenameTab, connected, tabStatuses = {} }) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(null)

  const startRename = (tab, e) => {
    e.stopPropagation()
    setEditingId(tab.id)
    setEditValue(tab.name)
    setShowColorPicker(null)
  }

  const commitRename = () => {
    if (editValue.trim() && onRenameTab) {
      const tab = tabs.find(t => t.id === editingId)
      onRenameTab(editingId, { name: editValue.trim(), color: tab?.color })
    }
    setEditingId(null)
    setShowColorPicker(null)
  }

  const handleColorChange = (tabId, color) => {
    if (onRenameTab) {
      const tab = tabs.find(t => t.id === tabId)
      onRenameTab(tabId, { name: tab?.name, color })
    }
    setShowColorPicker(null)
  }

  return (
    <>
      <div className={`connection-dot ${connected ? 'online' : 'offline'}`} title={connected ? 'Connected' : 'Disconnected'} />
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab ${tab.id === activeTab ? 'active' : ''}`}
          style={tab.color ? { borderColor: tab.color } : {}}
          onClick={() => onSwitchTab(tab.id)}
          onDoubleClick={e => startRename(tab, e)}
        >
          {editingId === tab.id ? (
            <div className="tab-edit-container">
              <input
                className="tab-rename-input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') { setEditingId(null); setShowColorPicker(null) }
                  e.stopPropagation()
                }}
                autoFocus
                onClick={e => e.stopPropagation()}
              />
              <div className="tab-color-picker">
                {TAB_COLORS.map(c => (
                  <button
                    key={c.value || 'default'}
                    className={`color-btn ${tab.color === c.value ? 'active' : ''}`}
                    style={c.value ? { backgroundColor: c.value } : {}}
                    title={c.name}
                    onClick={e => { e.stopPropagation(); handleColorChange(tab.id, c.value) }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {tab.color && <span className="tab-color-dot" style={{ backgroundColor: tab.color }} />}
              <span className="tab-icon"><Terminal size={14} /></span>
              <span>{tab.name}</span>
              {tab.id !== activeTab && tabStatuses[tab.id] && (
                <span className={`status-bubble ${tabStatuses[tab.id]}`} title={tabStatuses[tab.id]} />
              )}
            </>
          )}
          {tabs.length > 1 && (
            <span
              className="tab-close"
              onClick={e => { e.stopPropagation(); onCloseTab(tab.id) }}
            >
              <X size={12} />
            </span>
          )}
        </button>
      ))}
      <button className="tab new-tab" onClick={onNewTab} title="New terminal">
        <Plus size={18} />
      </button>
    </>
  )
}