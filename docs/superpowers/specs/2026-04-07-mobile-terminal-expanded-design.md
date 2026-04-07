# Mobile Terminal Expanded - Design Specification

## Overview

Extended mobile terminal with multi-tab support and file explorer panel.

## Architecture

```
+-------------------------------------------------------------+
| [Tab 1: bash] [Tab 2] [Tab 3] [+]              [Tunnel] [=] |
+----------------------------+----------------------------------+
|                            |                                  |
|   File Explorer            |        Terminal Area            |
|   (collapsible sidebar)     |      (xterm.js instance)        |
|                            |                                  |
|   /                        |   $ pwd                          |
|   |-- home/                 |   /home/user                    |
|   |   |-- Documents/        |   $                             |
|   |   |-- Downloads/        |                                  |
|   |   |-- Desktop/          |                                  |
|   |-- var/                  |                                  |
|                            |                                  |
+----------------------------+----------------------------------+
```

## Components

### 1. TabManager (Top Bar)

- Horizontal scrollable tabs
- Each tab represents a terminal session
- [+] button to create new tab
- Long-press to close tab
- Shows session name or working directory
- Max 10 tabs

### 2. FileExplorer (Side Panel)

- Collapsible via menu button [=]
- Shows file/folder tree
- Tap folder to navigate into explorer
- Tap terminal icon next to folder to open new terminal in that folder
- Shows current path at top
- Back button to go up a level

### 3. TerminalSession

- Each tab runs independent PTY
- Sends CWD updates to frontend
- Handles tab-specific state

### 4. Settings Panel

- Tunnel controls
- Connection status
- Open folder in new terminal

## Data Flow

1. Client connects via Socket.io
2. Each tab gets unique session ID
3. Server spawns PTY with requested CWD
4. File explorer fetches directory listing via API endpoint

## API Endpoints

- `GET /api/ls/:path` - List directory contents
- `GET /api/pwd` - Get current working directory

## Socket Events

- `create-tab` - Create new terminal session
- `close-tab` - Close terminal session
- `switch-tab` - Switch to specific tab
- `cwd-changed` - Working directory changed