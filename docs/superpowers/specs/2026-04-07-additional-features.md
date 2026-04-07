# Additional Features Design

**Date:** 2026-04-07  
**Features:** Bookmarks, File Upload, Session Restore, Command Shortcuts, Terminal Themes, Export/Import, Tab Notifications

## Overview

Add 8 new features to the mobile terminal: directory bookmarks, file upload, session restore, command shortcuts/aliases, additional terminal themes, export/import settings, tab notification bubbles, and desktop notifications.

---

## 1. Directory Bookmarks

**UI:**
- Add star icon button in file explorer header
- Click star to toggle bookmark for current directory
- Bookmarked directories show filled star
- Bookmarks panel accessible via sidebar or keyboard shortcut

**Storage:** localStorage key `terminal-bookmarks`

```json
[
  { "path": "/home/user/projects", "name": "Projects" },
  { "path": "/home/user/Downloads", "name": "Downloads" }
]
```

**API:** None required - client-side only

---

## 2. File Upload

**UI:**
- Drag & drop zone in file explorer (or entire app)
- Upload button in file explorer header
- Progress indicator during upload
- Upload to current directory

**Server API:**
- `POST /api/file/upload` - multipart form with file and destination path
- Returns `{ ok: true }` or `{ error: "message" }`

**Storage:** Server filesystem at destination path

---

## 3. Session Restore

**Storage:** localStorage key `terminal-session`

```json
{
  "tabs": [
    { "id": "tab-main", "name": "Terminal 1", "cwd": "/home/user", "color": "#EF4444" }
  ],
  "activeTab": "tab-main",
  "explorerOpen": true,
  "currentPath": "/home/user",
  "settings": { "fontSize": 14, "theme": "dark" }
}
```

**Behavior:**
- On page load, check for saved session
- Restore all tabs with their working directories
- Restore file explorer state
- Restore settings

---

## 4. Command Shortcuts

**UI:**
- Settings panel section for managing shortcuts
- Add new shortcut: name, key combination, command
- Shortcut list with edit/delete options

**Storage:** localStorage key `terminal-shortcuts`

```json
[
  { "id": "1", "name": "Git Status", "keys": "Ctrl+Shift+G", "command": "git status" },
  { "id": "2", "name": "Clear", "keys": "Ctrl+L", "command": "clear" }
]
```

**Implementation:**
- Keyboard listener for global shortcuts
- When triggered, inject command into active terminal
- Shell aliases stored and expanded in bashrc via API (optional)

**Server API (optional):**
- `POST /api/alias` - create shell alias for user

---

## 5. Additional Terminal Themes

**Existing themes:** dark, light, highContrast, dracula, solarized

**New themes to add:**
- **Ocean** - deep blue (#0A192F background, #64FFDA cyan accent)
- **Midnight** - purple (#1A1A2E, #E94560 pink accent)  
- **Forest** - green (#1E3A2F, #4ADE80 green accent)
- **Monokai** - classic (#272822, #F92672 pink accent)
- **Nord** - arctic blue (#2E3440, #88C0D0 cyan accent)

**Storage:** localStorage key `terminal-settings`

**UI:** Dropdown in Settings panel with all theme options

---

## 6. Export/Import

**UI:**
- Settings panel: "Export Settings" and "Import Settings" buttons
- Export downloads JSON file with all settings
- Import opens file picker, validates JSON, applies settings

**Export format (JSON):**

```json
{
  "version": "2.0",
  "exportedAt": "2026-04-07T12:00:00Z",
  "bookmarks": [...],
  "shortcuts": [...],
  "settings": { "fontSize": 14, "theme": "dark" }
}
```

**Validation:** Check for required fields and version compatibility

---

## 7. Tab Status Bubbles

**UI:**
- Small status indicator next to tab name
- **Idle** - gray bubble (no activity for 30s)
- **Running** - green pulsing bubble (command executing)
- **Notification** - orange bubble (unread output in background)
- Click bubble to see status details

**States:**
- `idle` - no recent terminal activity
- `running` - PTY has active child process
- `notification` - unread output while tab inactive

**Implementation:**
- Track last output timestamp per session
- Detect running processes via PTY events
- Update bubble on state change

---

## 8. Desktop Notifications

**Triggers:**
- Long-running command completed (when tab was idle)
- Tab became idle (no activity for configurable time, default 60s)
- Background tab received output
- Command exited with non-zero code

**UI:**
- Browser Notification API
- Permission request on first use
- Notification shows: app name, tab name, message summary

**Settings:**
- Enable/disable per event type in Settings
- Default: all enabled

**Storage:** localStorage key `terminal-settings` → `notifications: { longRunning: true, idle: true, background: true, failed: true }`

---

## Component Changes

### App.jsx
- Load session from localStorage on mount
- Save session on tab changes, navigation
- Manage notification state per tab
- Handle keyboard shortcuts

### SettingsPanel.jsx
- Add Bookmarks section (list, add, remove)
- Add Shortcuts section (list, add, edit, delete)
- Add Themes dropdown
- Add Notifications toggles
- Add Export/Import buttons

### FileExplorer.jsx
- Add upload button and handlers
- Add bookmark toggle

### Terminal.jsx
- Track idle/running state
- Emit state changes to parent
- Handle shortcut injection

### TabManager.jsx
- Display status bubbles
- Show notification indicator

### server.js
- Add file upload endpoint
- Add alias creation endpoint (optional)

## Testing Scenarios

1. Bookmark directory → appears in bookmarks list → clicking navigates to it
2. Upload file → file appears in current directory
3. Refresh page → tabs and directories restored
4. Add shortcut → pressing keys executes command
5. Change theme → terminal updates immediately
6. Export settings → JSON downloads → import in new browser works
7. Start long command → tab shows "running" → completes → notification
8. Switch tabs → original tab becomes idle → idle bubble appears