# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClankerContext is a Chrome Extension (Manifest V3) that generates LLM-optimized context for agentic coding tools (Claude Code, Cursor, OpenCode). Users can log enhancement requests or bug reports by selecting page elements, and the extension exports markdown files containing all the context an AI coding agent needs to understand and fix the issue.

## Build Commands

```bash
npm run build      # TypeScript check + Vite build to dist/
npm run dev        # Watch mode build
npm run typecheck  # TypeScript only (no emit)
npm run lint       # ESLint
```

After building, load `dist/` as an unpacked extension in Chrome.

## Architecture

### Extension Components (MV3)

```
Background Service Worker (src/background/)
├── SessionStateMachine.ts  - Session state: idle → monitoring → selecting_element
├── MessageRouter.ts        - Chrome message handling between all components
├── CDPController.ts        - Chrome DevTools Protocol for console/network error capture
└── StorageManager.ts       - IndexedDB for issues, errors, sessions

Note: Extension has zero background footprint until user clicks "Start listening".
Pausing detaches CDP and stops all monitoring.

Content Script (src/content/)
├── index.ts               - Element picker overlay and message handling
└── SelectorGenerator.ts   - CSS selector generation (data-testid, id, ARIA, path-based)

Popup UI (src/popup/)
└── Popup.tsx              - React UI for logging issues and exporting

Exporter (src/exporter/)
└── MarkdownExporter.ts    - Generates LLM-optimized markdown reports
```

### User Flow

1. User opens extension popup
2. Clicks "Start listening" to begin monitoring (extension does nothing until this step)
3. Clicks "Modify with AI" or "Fix with AI"
4. Enters description of what they want
5. Clicks "Select Element" → element picker overlay appears on page
6. User clicks the relevant element
7. Issue is logged with element HTML, selector, console errors, and failed network requests
8. Popup automatically reopens showing logged issues
9. User can export individual issues or all issues as markdown (download or clipboard)
10. User can pause/resume monitoring via header button (paused = no background activity)

### Data Flow

1. **START_LISTENING** → Creates session, attaches CDP for error capture
2. **PAUSE_LISTENING** → Detaches CDP, stops all monitoring
3. **RESUME_LISTENING** → Re-attaches CDP, resumes monitoring
4. **START_ISSUE** → Injects content script, shows element picker overlay
5. **ELEMENT_SELECTED** → Captures element HTML + selector, creates Issue in IndexedDB, reopens popup
6. **EXPORT_ISSUE** → MarkdownExporter generates LLM-optimized markdown

### Tab Switching

When the user switches tabs (and not paused):
- CDP detaches from old tab
- Error logs are cleared (issues preserved)
- Session switches to new tab
- CDP attaches to new tab

## Markdown Output Format

Each issue exports as a markdown file containing:
- Task description (enhancement vs bug fix)
- User's description/prompt
- Target element HTML and CSS selector
- Console errors with stack traces (captured during session)
- Failed network requests (non-2XX status codes)
- Suggested approach for the AI agent

## Key Implementation Details

### Service Worker Constraints (MV3)
- No `URL.createObjectURL` - use data URLs for downloads
- Can be terminated - use IndexedDB for persistence
- Session state survives via `chrome.storage.session`
- Pause state stored in `chrome.storage.session` (isPaused flag)

### Content Script Injection
Content scripts are explicitly injected via `chrome.scripting.executeScript` when starting an issue, since the manifest's `content_scripts` only runs on page load.

### CDP Error Capture
The extension uses Chrome DevTools Protocol to capture:
- Console errors (level: 'error')
- Runtime exceptions with stack traces
- Failed network requests (status < 200 or >= 300)

### Storage

IndexedDB database: `ClankerContextDB`

Stores:
- `sessions` - Monitoring session metadata
- `issues` - Logged issues (enhancement/fix requests)
- `consoleErrors` - Captured console errors per session
- `networkErrors` - Captured failed network requests per session

## TypeScript Path Alias

Use `@/` for imports from `src/`:
```typescript
import { storageManager } from '@/background/StorageManager';
```
