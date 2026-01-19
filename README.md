# ClankerContext

A Chrome Extension that generates LLM-optimized context for AI coding tools. Capture frontend bugs and enhancement requests with one click, then export everything your AI assistant needs to understand and fix the issue.

## Demo



https://github.com/user-attachments/assets/542925a3-9629-4502-97c6-4320b7cfe3e5




## Features

- **Element Capture** - Point and click to capture any element's HTML
- **Multi-Element Selection** - Ctrl/Cmd+click to select multiple elements with numbered badges
- **CSS Selectors** - Auto-generates robust selectors using data-testid, ARIA labels, IDs, and smart fallbacks
- **Console Errors** - Captures JavaScript errors with full stack traces
- **Network Failures** - Logs failed API calls with status codes and URLs
- **Markdown Export** - One-click export to LLM-optimized markdown (clipboard or file)
- **Custom Prompt Templates** - Edit Fix/Enhancement templates in Settings to match your workflow
- **Pause/Resume Monitoring** - Pause error capture without losing session data
- **Auto-Copy to Clipboard** - Automatically copy context after logging an issue
- **Direct Integrations** - Send context directly to OpenCode or VSCode 
- **Zero Footprint** - Does nothing until you click "Start listening"

## Privacy

ClankerContext is 100% client-side. **No data is ever sent to any server.** There's no telemetry, no analytics, no tracking. All captured data stays in your browser's IndexedDB until you export or clear it.

## Installation

### From Chrome Web Store

[ClankerContext on Chrome Store](https://chromewebstore.google.com/detail/clankercontext/jenjdejjifbfmlbipddgoohgboapbjhi)

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
5. Click on the relevant element on the page (use **Ctrl/Cmd+click** to select multiple elements)
6. Export the issue as markdown and paste it into your AI coding tool

**Tips:**
- Use the **Pause** button to temporarily stop monitoring without losing your session
- Open **Settings** to customize prompt templates and enable auto-copy
- Configure **Connections** for direct integration with OpenCode or VSCode

## Compatible Tools

ClankerContext exports standard markdown that works with any AI coding assistant:

- Claude Code
- Cursor
- GitHub Copilot
- OpenCode *(direct integration available)*
- VSCode *(direct integration available)*
- Kilo Code
- Aider
- Any tool that accepts text input

**Direct integrations** let you send context straight to the tool without copy/paste. Configure connections in Settings.

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
├── background/    # Service worker, CDP, integrations (OpenCode, VSCode)
├── components/    # Shared UI components (badge, button, card)
├── content/       # Element picker overlay and selector generation
├── exporter/      # Markdown generation and template rendering
├── lib/           # Utility functions
├── popup/         # React UI (main view, settings, prompt editor)
├── prompts/       # Customizable prompt templates
└── shared/        # Types, messages, constants
```

## How It Works

1. **Monitoring**: When you click "Start listening", the extension attaches to Chrome DevTools Protocol to capture console errors and failed network requests. Use Pause/Resume to control monitoring without losing session data.

2. **Element Selection**: When you create an issue, a content script injects an element picker overlay. Click any element to capture its HTML and a CSS selector. Use Ctrl/Cmd+click to select multiple elements—each gets a numbered badge.

3. **Export**: The exporter generates LLM-optimized markdown using customizable templates:
   - Your description
   - Target element(s) HTML and selectors
   - Console errors with stack traces
   - Failed network requests
   - Suggested approach for the AI

4. **Integrations**: Send context directly to OpenCode or VSCode, or copy/download for any other tool.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
