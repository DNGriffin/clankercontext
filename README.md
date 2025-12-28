# ClankerContext

A Chrome Extension that generates LLM-optimized context for AI coding tools. Capture frontend bugs and enhancement requests with one click, then export everything your AI assistant needs to understand and fix the issue.

## Features

- **Element Capture** - Point and click to capture any element's HTML
- **CSS Selectors** - Auto-generates robust selectors using data-testid, ARIA labels, IDs, and smart fallbacks
- **Console Errors** - Captures JavaScript errors with full stack traces
- **Network Failures** - Logs failed API calls with status codes and URLs
- **Markdown Export** - One-click export to LLM-optimized markdown (clipboard or file)
- **Zero Footprint** - Does nothing until you click "Start listening"

## Privacy

ClankerContext is 100% client-side. **No data is ever sent to any server.** There's no telemetry, no analytics, no tracking. All captured data stays in your browser's IndexedDB until you export or clear it.

## Installation

### From Chrome Web Store

Coming soon.

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/DNGriffin/clankercontext.git
   cd clankercontext
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

## Usage

1. Click the ClankerContext extension icon
2. Click **"Start listening"** to begin monitoring console errors and network requests
3. Click **"Modify with AI"** (for enhancements) or **"Fix with AI"** (for bugs)
4. Enter a description of what you want
5. Click on the relevant element on the page
6. Export the issue as markdown and paste it into your AI coding tool

## Compatible Tools

ClankerContext exports standard markdown that works with any AI coding assistant:

- Claude Code
- Cursor
- GitHub Copilot
- OpenCode
- Kilo Code
- Aider
- Any tool that accepts text input

## Development

```bash
# Install dependencies
npm install

# Build with watch mode
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Production build
npm run build
```

## Architecture

```
src/
├── background/          # Service worker (MV3)
│   ├── index.ts         # Entry point
│   ├── CDPController.ts # Chrome DevTools Protocol for error capture
│   ├── MessageRouter.ts # Message handling between components
│   ├── SessionStateMachine.ts # Session state management
│   └── StorageManager.ts # IndexedDB storage
├── content/             # Content script
│   ├── index.ts         # Element picker overlay
│   └── SelectorGenerator.ts # CSS selector generation
├── popup/               # Extension popup (React)
│   ├── Popup.tsx        # Main UI component
│   └── index.tsx        # Entry point
├── exporter/            # Markdown generation
│   └── MarkdownExporter.ts
└── shared/              # Shared types and constants
    ├── types.ts
    ├── messages.ts
    └── constants.ts
```

## How It Works

1. **Monitoring**: When you click "Start listening", the extension attaches to Chrome DevTools Protocol to capture console errors and failed network requests.

2. **Element Selection**: When you create an issue, a content script injects an element picker overlay. Click any element to capture its HTML and a CSS selector.

3. **Export**: The MarkdownExporter generates LLM-optimized markdown containing:
   - Your description
   - Target element HTML and selector
   - Console errors with stack traces
   - Failed network requests
   - Suggested approach for the AI

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
