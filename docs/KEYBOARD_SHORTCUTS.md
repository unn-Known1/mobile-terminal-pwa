# Keyboard Shortcuts Reference

This document provides a complete reference for all keyboard shortcuts available in Mobile Terminal.

## Desktop Shortcuts

### Terminal Actions

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+C` / `Cmd+C` | Copy / Cancel | Copy selected text; if no selection, send SIGINT (cancel current command) |
| `Ctrl+D` / `Cmd+D` | EOF / Exit | Send EOF; closes shell if no process running |
| `Ctrl+L` / `Cmd+L` | Clear | Clear terminal screen |
| `Ctrl+Z` / `Cmd+Z` | Suspend | Suspend current process (send SIGTSTP) |
| `Ctrl+A` / `Cmd+A` | Beginning | Move cursor to beginning of line |
| `Ctrl+E` / `Cmd+E` | End | Move cursor to end of line |
| `Ctrl+U` / `Cmd+U` | Clear Line | Clear from cursor to beginning |
| `Ctrl+K` / `Cmd+K` | Clear End | Clear from cursor to end |
| `Ctrl+W` / `Cmd+W` | Delete Word | Delete word before cursor |

### Search & Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+F` / `Cmd+F` | Search | Open terminal search |
| `Ctrl+G` / `Cmd+G` | Next Match | Jump to next search result |
| `Shift+Ctrl+G` / `Shift+Cmd+G` | Previous Match | Jump to previous search result |
| `Escape` | Close Search | Close search bar |

### Terminal Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Tab` | Autocomplete | Complete command/filename |
| `Shift+Tab` | Reverse Autocomplete | Previous autocomplete suggestion |
| `↑` / `↓` | History | Navigate command history |
| `Ctrl+↑` / `Cmd+↑` | History Search | Search command history |
| `Page Up` / `Page Down` | Scroll | Scroll through terminal output |

### Special Keys

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+H` / `Cmd+H` | Backspace | Delete character before cursor |
| `Enter` / `Return` | Execute | Run current command |
| `Ctrl+I` / `Cmd+I` | Tab | Same as Tab key |

## Mobile Shortcuts

### On-Screen Keyboard Toolbar

The mobile UI includes an on-screen keyboard toolbar with these buttons:

| Button | Action | Description |
|--------|--------|-------------|
| `ESC` | Escape | Send escape character |
| `TAB` | Tab | Send tab character |
| `^C` | Interrupt | Send Ctrl+C (SIGINT) |
| `^D` | EOF | Send Ctrl+D (EOF) |
| `^Z` | Suspend | Send Ctrl+Z (SIGTSTP) |
| `↑` | Up Arrow | Send up arrow |
| `↓` | Down Arrow | Send down arrow |
| `←` | Left Arrow | Send left arrow |
| `→` | Right Arrow | Send right arrow |
| `[]` | Brackets | Toggle bracket symbols |
| `{}` | Braces | Toggle brace symbols |
| `""` | Quotes | Toggle quote symbols |

### Touch Gestures

| Gesture | Action | Description |
|---------|--------|-------------|
| Long press | Context menu | Copy/paste options |
| Pinch | Zoom | Zoom terminal text |
| Swipe down | Scroll | Scroll through history |

## Custom Key Bindings

You can customize key bindings in Settings → Keyboard Shortcuts.

### Configuration File Format

Create a `keybindings.json` file in your settings directory:

```json
{
  "customBindings": {
    "Ctrl+Shift+T": "openNewTab",
    "Ctrl+Shift+W": "closeTab",
    "Ctrl+Shift+N": "newWindow",
    "Alt+1": "switchToTab1",
    "Alt+2": "switchToTab2",
    "Alt+3": "switchToTab3"
  }
}
```

### Default Bindings

```javascript
const DEFAULT_SHORTCUTS = {
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
  clear: 'Ctrl+L',
  search: 'Ctrl+F',
  interrupt: 'Ctrl+C',
  eof: 'Ctrl+D',
  suspend: 'Ctrl+Z',
  tab: 'Tab',
  up: 'ArrowUp',
  down: 'ArrowDown'
}
```

### Adding Custom Bindings

Edit `src/components/SettingsPanel.jsx` to add custom key bindings:

```javascript
// Add to SHORTCUTS object
const SHORTCUTS = {
  // ... existing shortcuts
  customAction: {
    key: 'Ctrl+Shift+T',
    action: 'openNewTab',
    description: 'Open new terminal tab'
  }
}
```

### Custom Binding Examples

#### Terminal Productivity

```json
{
  "customBindings": {
    "Ctrl+Shift+L": "clearTerminal",
    "Ctrl+Shift+K": "clearScrollback",
    "Ctrl+R": "searchHistory"
  }
}
```

#### Multi-Tab Management

```json
{
  "customBindings": {
    "Ctrl+T": "newTab",
    "Ctrl+W": "closeTab",
    "Ctrl+Tab": "nextTab",
    "Ctrl+Shift+Tab": "prevTab",
    "Ctrl+1": "switchToTab1",
    "Ctrl+2": "switchToTab2",
    "Ctrl+3": "switchToTab3"
  }
}
```

#### Quick Commands

```json
{
  "customBindings": {
    "Ctrl+Shift+C": "copySelection",
    "Ctrl+Shift+V": "pasteAndExecute",
    "Ctrl+Alt+F": "toggleFullscreen"
  }
}
```

### Platform-Specific Notes

#### macOS

- Use `Cmd` instead of `Ctrl` in custom bindings
- `Cmd+K` clears scrollback (not just current line)
- `Cmd+T` opens new tab (if implemented)

#### Linux

- Standard Ctrl combinations as listed
- Some terminals may have additional shortcuts
- X11 key symbols may differ

#### Windows

- `Ctrl+Break` sends SIGINT on Windows
- `Win+Up/Down` for window management (not terminal)
- Some key combinations reserved by OS

## Platform-Specific Notes

### macOS

- Use `Cmd` instead of `Ctrl`
- `Cmd+K` clears scrollback (not just current line)
- `Cmd+T` opens new tab (if implemented)

### Linux

- Standard Ctrl combinations as listed
- Some terminals may have additional shortcuts

### Windows

- `Ctrl+Break` sends SIGINT on Windows
- `Win+Up/Down` for window management (not terminal)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Shortcuts not working | Ensure terminal has focus |
| Ctrl+C copies instead of cancels | Check if text is selected |
| Tab not completing | Check shell configuration |

---

For more help, see [DEVELOPMENT.md](DEVELOPMENT.md) or open an issue.