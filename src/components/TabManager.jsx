import { useState, useMemo, useCallback, memo } from 'react'
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

// Memoized tab button to prevent re-renders when other tabs change
const TabButton = memo(function TabButton({ 
  tab, 
  isActive, 
  isEditing, 
  editValue, 
  showColorPicker,
  tabsLength,
  tabStatuses,
  onSwitchTab, 
  onCloseTab, 
  onStartRename,
  onEditValueChange,
  onCommitRename,
  onColorChange,
  onCancelEdit
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onCommitRename()
    if (e.key === 'Escape') onCancelEdit()
    e.stopPropagation()
  }

  return (
    <button
      className={`tab ${isActive ? 'active' : ''}`}
      style={tab.color ? { borderColor: tab.color } : {}}
      onClick={() => onSwitchTab(tab.id)}
      onDoubleClick={e => onStartRename(tab, e)}
    >
      {isEditing ? (
        <div className="tab-edit-container">
          <label htmlFor={`rename-tab-${tab.id}`} className="sr-only">Tab name</label>
          <input
            id={`rename-tab-${tab.id}`}
            name={`rename-tab-${tab.id}`}
            className="tab-rename-input"
            value={editValue}
            onChange={e => onEditValueChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={handleKeyDown}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
          {showColorPicker && (
            <div className="tab-color-picker">
              {TAB_COLORS.map(c => (
                <button
                  key={c.value || 'default'}
                  className={`color-btn ${tab.color === c.value ? 'active' : ''}`}
                  style={c.value ? { backgroundColor: c.value } : {}}
                  title={c.name}
                  onClick={e => { e.stopPropagation(); onColorChange(tab.id, c.value) }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {tab.color && <span className="tab-color-dot" style={{ backgroundColor: tab.color }} />}
          <span className="tab-icon"><Terminal size={14} /></span>
          <span>{tab.name}</span>
          {/* Fix B07: status bubble should NOT show on active tab */}
          {!isActive && tabStatuses[tab.id] && (
            <span className={`status-bubble ${tabStatuses[tab.id]}`} title={tabStatuses[tab.id]} />
          )}
        </>
      )}
      {tabsLength > 1 && !isEditing && (
        <span
          className="tab-close"
          onClick={e => { e.stopPropagation(); onCloseTab(tab.id) }}
        >
          <X size={12} />
        </span>
      )}
    </button>
  )
})

export default function TabManager({ tabs, activeTab, onSwitchTab, onNewTab, onCloseTab, onRenameTab, connected, tabStatuses = {} }) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(null)

  const startRename = useCallback((tab, e) => {
    e.stopPropagation()
    setEditingId(tab.id)
    setEditValue(tab.name)
    setShowColorPicker(null)
  }, [])

  const commitRename = useCallback(() => {
    if (editValue.trim() && onRenameTab) {
      const tab = tabs.find(t => t.id === editingId)
      onRenameTab(editingId, { name: editValue.trim(), color: tab?.color })
    }
    setEditingId(null)
    setShowColorPicker(null)
  }, [editValue, onRenameTab, editingId, tabs])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setShowColorPicker(null)
  }, [])

  const handleColorChange = useCallback((tabId, color) => {
    if (onRenameTab) {
      const tab = tabs.find(t => t.id === tabId)
      onRenameTab(tabId, { name: tab?.name, color })
    }
    setShowColorPicker(null)
    setEditingId(null)
  }, [onRenameTab, tabs])

  const editValueChange = useCallback((value) => {
    setEditValue(value)
  }, [])

  // Memoize tab buttons to prevent unnecessary re-renders
  const tabButtons = useMemo(() => tabs.map(tab => (
    <TabButton
      key={tab.id}
      tab={tab}
      isActive={tab.id === activeTab}
      isEditing={editingId === tab.id}
      editValue={editingId === tab.id ? editValue : ''}
      showColorPicker={editingId === tab.id && showColorPicker}
      tabsLength={tabs.length}
      tabStatuses={tabStatuses}
      onSwitchTab={onSwitchTab}
      onCloseTab={onCloseTab}
      onStartRename={startRename}
      onEditValueChange={editValueChange}
      onCommitRename={commitRename}
      onColorChange={handleColorChange}
      onCancelEdit={cancelEdit}
    />
  )), [tabs, activeTab, editingId, editValue, showColorPicker, tabStatuses, onSwitchTab, onCloseTab, startRename, editValueChange, commitRename, handleColorChange, cancelEdit])

  return (
    <>
      <div className={`connection-dot ${connected ? 'online' : 'offline'}`} title={connected ? 'Connected' : 'Disconnected'} />
      {tabButtons}
      <button className="tab new-tab" onClick={onNewTab} title="New terminal">
        <Plus size={18} />
      </button>
    </>
  )
}
