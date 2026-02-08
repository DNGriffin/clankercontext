# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClankerContext is a Chrome Extension (Manifest V3) that generates LLM-optimized context for AI coding tools. Users capture frontend bugs and enhancement requests by selecting page elements, and the extension exports markdown containing everything an AI assistant needs to understand and fix the issue. 100% client-side — no server communication.

## Build & Development Commands

```bash
npm run build         # TypeScript check + Vite production build → dist/
npm run dev           # Watch mode build (auto-rebuilds on changes)
npm run typecheck     # TypeScript type checking only (no emit)
npm run lint          # ESLint on src/**/*.ts,.tsx
npm run test          # Run Jest tests
npm run test:watch    # Run tests in watch mode
npx jest path/to/test # Run a single test file
```

After building, load `dist/` as an unpacked extension at `chrome://extensions/` (Developer mode).

## Architecture

### Build Pipeline (vite.config.ts)

Three separate build steps run in sequence:
1. **Main build** — popup HTML + background service worker (ES modules)
2. **Content script** — IIFE bundle (`content.js`, runs in ISOLATED world)
3. **React extractor** — IIFE bundle (`react-extractor.js`, runs in MAIN world to access React internals)

### Extension Components

**Background Service Worker (`src/background/`)**
- `index.ts` — Entry point, orchestrates all background logic
- `SessionStateMachine.ts` — Session lifecycle: `idle` → `monitoring` → `selecting_element`
- `CDPController.ts` — Chrome DevTools Protocol for console/network error capture (uses mutex for concurrent safety)
- `StorageManager.ts` — IndexedDB persistence (DB: `ClankerContextDB`, version 6). Stores: sessions, issues, console_errors, network_errors, connections, prompt_templates, custom_attributes
- `MessageRouter.ts` — Routes all Chrome message passing between popup, background, and content scripts. Tracks content script injection per tab
- `IconController.ts` — Extension icon states: active (cycling animation), paused (sleeping), inactive
- `OpenCodeClient.ts` — HTTP client for OpenCode integration
- `VSCodeClient.ts` — HTTP client for VSCode/Copilot integration

**Content Script (`src/content/`)**
- `index.ts` — Element picker overlay with multi-select (Ctrl/Cmd+click), toast notifications, numbered badges. Runs in ISOLATED world
- `SelectorGenerator.ts` — CSS selector generation. Priority: data-testid → ID → aria-label → CSS path
- `react-extractor.ts` — Extracts React component name, file path, line number, and component stack via `bippy`. Runs in MAIN world (accesses `__REACT_DEVTOOLS_GLOBAL_HOOK__`). Communicates with content script via `window.postMessage`

**Popup UI (`src/popup/`)** — React + Tailwind CSS
- `Popup.tsx` — Main view: session control, issue list, export
- `SettingsView.tsx` — Connections, custom attributes, auto-copy toggle
- `PromptEditView.tsx` — Custom prompt template editor

**Exporter (`src/exporter/`)**
- `MarkdownExporter.ts` — Generates LLM-optimized markdown from issue data
- `PromptTemplateRenderer.ts` — Handlebars-like template engine supporting `{{tokens}}`, `{{#conditional}}...{{/conditional}}`, and `{{#each array}}...{{/each}}`

**Shared (`src/shared/`)** — Types, message definitions, constants shared across all components

**Prompt Templates (`src/prompts/templates.ts`)** — Default templates for fix, enhancement, and quick select exports

### Message Flow

```
Popup (React) ←→ MessageRouter (background) ←→ Content Script (ISOLATED world)
                         ↕                              ↕ (postMessage)
                   StorageManager                React Extractor (MAIN world)
                   CDPController
                   OpenCodeClient / VSCodeClient
```

All inter-component communication uses typed messages defined in `src/shared/messages.ts`.

### Data Flow

1. **START_LISTENING** → Creates session, attaches CDP
2. **PAUSE_LISTENING** / **RESUME_LISTENING** → Detaches/re-attaches CDP
3. **START_ISSUE** → Injects content script, shows element picker overlay
4. **ELEMENT_SELECTED** → Captures element HTML + selector + React source + custom attributes → creates Issue in IndexedDB → reopens popup
5. **QUICK_SELECT** → Element picker without session; copies directly to clipboard
6. **EXPORT_ISSUE** → MarkdownExporter renders template → clipboard or download
7. **SEND_TO_OPENCODE** / **SEND_TO_VSCODE** → Exports and sends via HTTP client

### Tab Switching

When user switches tabs (and not paused): CDP detaches from old tab, error logs are cleared (issues preserved), CDP attaches to new tab.

## Key Implementation Details

- **Service worker (MV3)**: May be terminated when idle. Use IndexedDB (StorageManager) for persistence, `chrome.storage.session` for volatile state (session, pause flag). No `URL.createObjectURL` — use data URLs for downloads.
- **Content script injection**: Injected on-demand via `chrome.scripting.executeScript`, not declaratively in manifest.
- **Path alias**: `@/` maps to `src/` (configured in tsconfig, vite, and jest).
- **Tests**: Located in `src/__tests__/`. Coverage configured for `src/exporter/` and `src/prompts/` only. Tests use snapshot versioning (e.g., `v1.1.6/`, `v1.1.8/`).
- **Custom attributes**: User-configured HTML attributes captured during element selection. Search directions: parent, descendant, or both. Stored in IndexedDB, available as template tokens.
- **Custom prompt templates**: Stored in IndexedDB. Use Handlebars-like syntax. Editable in Settings. Reset-to-default restores templates from `src/prompts/templates.ts`.
