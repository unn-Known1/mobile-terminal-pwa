import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { X, Save, File } from 'lucide-react'

const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  md: 'markdown', sh: 'shell', bash: 'shell', sql: 'sql',
  txt: 'plaintext', text: 'plaintext'
}

export default function CodeEditor({ filePath, onClose }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modified, setModified] = useState(false)

  const ext = filePath?.split('.').pop()?.toLowerCase() || 'txt'
  const lang = LANG_MAP[ext] || 'plaintext'

  useEffect(() => {
    if (!filePath) return
    setLoading(true)
    fetch(`/api/file/read?path=${encodeURIComponent(filePath)}`)
      .then(res => res.json())
      .then(data => {
        setContent(data.content || '')
        setLoading(false)
        setModified(false)
      })
      .catch(() => setLoading(false))
  }, [filePath])

  const handleSave = async () => {
    if (!filePath) return
    setSaving(true)
    try {
      await fetch('/api/file/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content })
      })
      setModified(false)
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [content])

  if (!filePath) return null

  return (
    <div className="code-editor-overlay">
      <div className="code-editor">
        <div className="editor-header">
          <div className="editor-title">
            <File size={16} />
            <span>{filePath.split('/').pop()}</span>
            {modified && <span className="modified">●</span>}
          </div>
          <div className="editor-actions">
            <button onClick={handleSave} disabled={saving || !modified} title="Save (Ctrl+S)">
              <Save size={16} /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="editor-body">
          {loading ? (
            <div className="editor-loading">Loading...</div>
          ) : (
            <Editor
              height="100%"
              language={lang}
              value={content}
              onChange={(val) => { setContent(val); setModified(true); }}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'Fira Code', monospace",
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
