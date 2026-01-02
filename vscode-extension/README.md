# ClankerContext

Capture bugs and feature requests from any website and send them directly to GitHub Copilot Chat with full context.

**Free and open source.**

## What is ClankerContext?

ClankerContext bridges the gap between your browser and your IDE. When you encounter a bug or want to request a feature on any website, ClankerContext captures everything an AI coding agent needs to understand and fix the issue:

- The element you clicked on (HTML + CSS selector)
- Console errors and stack traces
- Failed network requests
- Your description of the problem

This context is then sent directly to GitHub Copilot Chat in agent mode, giving it everything needed to start working on a fix immediately.

## How It Works

1. **Install the Chrome Extension** from [clankercontext.com](https://clankercontext.com)
2. **Install this VSCode Extension**
3. Browse any website and click "Start Listening" in the Chrome extension
4. When you find a bug, click "Fix with AI" or "Modify with AI"
5. Select the relevant element on the page
6. The issue context is automatically sent to Copilot Chat in VSCode

## Requirements

- [ClankerContext Chrome Extension](https://clankercontext.com)
- [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) extension

## Extension Settings

- `clankercontext.port`: Port for the local HTTP server (default: 41970)
- `clankercontext.autoStart`: Automatically start the server when VSCode opens (default: true)

## Commands

- **ClankerContext: Start Server** - Start the local server
- **ClankerContext: Stop Server** - Stop the local server
- **ClankerContext: Show Status** - Show server status and Copilot availability

## Links

- [Website](https://clankercontext.com)
- [GitHub Repository](https://github.com/DNGriffin/clankercontext)
- [Report Issues](https://github.com/DNGriffin/clankercontext/issues)

## License

MIT - Free and open source.
