# File Explorer Operations Design

**Date:** 2026-04-07  
**Feature:** File Explorer - Download, Copy, Cut, Paste, Rename, Create New File

## Overview

Add file operations to the sidebar file explorer: download (as zip), copy, cut, paste, rename, create new file. Available via sidebar buttons and right-click context menu.

## UI Specification

### Sidebar Header
Location: Top of file explorer panel

**Buttons:**
- Download (dropdown with options: "Selected items" / "Current folder")
- Copy (icon only)
- Cut (icon only)
- Paste (icon only, disabled when clipboard empty)
- Rename (icon only, disabled when nothing selected)
- New File (+ icon)

### Context Menu
Trigger: Right-click on file/folder item

**Options:**
- Download
- Copy
- Cut
- Rename
- Delete

### Multi-select
- Checkbox column in file list (optional enhancement)
- For now: use single selection, action applies to one item

### Modal Dialogs

**Rename Modal:**
- Title: "Rename [filename]"
- Input field with current name pre-filled
- OK / Cancel buttons

**New File Modal:**
- Title: "Create New File"
- Input field for filename
- OK / Cancel buttons

**Download:**
- Single file: direct download
- Folder/multiple: server creates zip and streams download

## API Specification

### POST /api/file/download
Request:
```json
{ "paths": ["/path/to/file"] }
```
- Single path to file: stream file directly with Content-Disposition
- Path to folder or multiple paths: create zip, stream as download

### POST /api/file/rename
Request:
```json
{ "oldPath": "/path/to/file", "newName": "newname" }
```
Response: `{ "ok": true }` or `{ "error": "message" }`

### POST /api/file/create
Request:
```json
{ "path": "/path/to/newfile" }
```
Creates empty file at specified path

### POST /api/file/delete
Request:
```json
{ "paths": ["/path/to/file"] }
```
Delete files/folders

### POST /api/file/copy
Request:
```json
{ "paths": ["/path/to/file"], "destination": "/target/dir" }
```
Copy files/folders to destination

### POST /api/file/move
Request:
```json
{ "paths": ["/path/to/file"], "destination": "/target/dir" }
```
Move files/folders to destination (used for paste after cut)

## Clipboard State

Storage: localStorage key `file-clipboard`

```json
{
  "action": "copy" | "cut",
  "paths": ["/path/to/file1", "/path/to/file2"],
  "sourcePath": "/source/directory"
}
```

Persistence:
- Persists across folder navigation
- Clears on page refresh (or can persist if needed)

Validation:
- Prevent paste if target is within source (for cut operation)
- Prevent paste to same location as source

## Component Changes

### FileExplorer.jsx
- Add state for clipboard (localStorage sync)
- Add state for selected item(s)
- Add context menu visibility and position
- Add modal state (rename, create)
- Add sidebar buttons
- Handle all operations with API calls
- Refresh directory after operations

### Server (server.js)
- Add file operation endpoints
- Use archiver for zip creation
- Validate paths (prevent directory traversal)

## Security Considerations

- Validate all paths to prevent directory traversal (`../../../etc`)
- Check file existence before operations
- Handle permission errors gracefully
- Sanitize filenames for download Content-Disposition

## Testing Scenarios

1. Download single file → direct download
2. Download folder → zip file created and downloaded
3. Copy file → file duplicated in target
4. Cut file → file moved to target, source removed
5. Rename file → file renamed
6. Create new file → empty file created
7. Delete file → file removed
8. Paste to same location → error shown
9. Navigate folders with clipboard → paste still works