# Integrations

ClankerContext can send context directly to your AI coding tool over a local HTTP connection. When you click Send, the extension exports the issue using your [prompt template](/prompt-templates) and delivers it over a local connection. Two integrations are supported: **OpenCode** and **VS Code (Copilot Chat)**. All communication stays on your machine — nothing is sent to external servers.

## OpenCode

Sends the exported markdown directly into an OpenCode chat session.

### Prerequisites

- [OpenCode](https://opencode.ai) installed
- OpenCode's server running (`opencode web` or `opencode --port 4096`)

### Setup

1. Open the ClankerContext popup and click the **gear icon** to open Settings
2. The default OpenCode connection is pre-configured at `localhost:4096`
3. Click **Select Session** and pick the session for your project
4. If you have multiple projects, sessions are grouped by project

### How messages are sent

When you click **Send** (or auto-send triggers), the extension exports the issue to markdown and sends it to OpenCode's local API as a new message in your selected session. The request includes a project directory header so OpenCode routes it to the correct project instance.

### Message queuing

OpenCode supports message queuing. If your session is busy processing a previous request, the extension detects this and waits — auto-send only fires when the session is idle. This prevents interrupting work in progress.

## VS Code (Copilot Chat)

Sends exported markdown into GitHub Copilot Chat in a VS Code window.

### Prerequisites

- VS Code with the [ClankerContext VS Code extension](https://marketplace.visualstudio.com/items?itemName=clankercontext.clankercontext) installed
- GitHub Copilot active in VS Code

### Setup

1. Install the [ClankerContext extension](https://marketplace.visualstudio.com/items?itemName=clankercontext.clankercontext) from the VS Code marketplace
2. Open the ClankerContext Chrome extension and click the **gear icon** to open Settings
3. The default VS Code connection is pre-configured
4. Click **Select VSCode Window** — the extension auto-discovers running VS Code instances by scanning local ports (41970–41979)
5. Pick the VS Code window for your project

### How messages are sent

The VS Code extension runs a small local HTTP server. When you click **Send**, the Chrome extension sends the markdown directly to that server, which injects it into Copilot Chat. Each VS Code window gets its own port, so the extension knows exactly which window to target.

### No message queuing

Unlike OpenCode, VS Code does not have message queuing or session status checking. Messages are sent immediately regardless of whether Copilot is currently processing. This means auto-send is disabled by default for VS Code connections.

## Comparison

| Feature | OpenCode | VS Code |
|---------|----------|---------|
| Sends context to | Chat session | Copilot Chat |
| Default port | 4096 | 41970–41979 |
| Message queuing | Yes | No |
| Checks if busy before sending | Yes | No |
| Auto-send enabled by default | Yes | No |
| Companion extension required | No | Yes ([VS Code extension](https://marketplace.visualstudio.com/items?itemName=clankercontext.clankercontext)) |

## Auto-Send

When enabled on a connection, issues are automatically sent after you log them — no need to click Send.

- Only the **active** connection auto-sends (you can have multiple connections but only one is active at a time)
- **OpenCode:** the extension checks whether the session is idle before sending. If it's busy, auto-send is skipped for that issue
- **VS Code:** sends immediately with no status check
- Toggle auto-send per connection in Settings
- Auto-send is independent of auto-copy-to-clipboard — both can be on simultaneously

## Managing Connections

- Default connections for both OpenCode and VS Code are created on first install
- You can add additional connections with custom endpoints
- Set a connection as **active** to make it the target for the Send button and auto-send
- Only one connection can be active at a time
- Use the **Test** button to verify a connection is healthy (green = connected, red = unreachable)

## Troubleshooting

- **"Failed to fetch sessions" (OpenCode)** — Make sure OpenCode's server is running: `opencode web`
- **"No VSCode windows found"** — Install the [ClankerContext VS Code extension](https://marketplace.visualstudio.com/items?itemName=clankercontext.clankercontext) and make sure a VS Code window is open
- **Send fails** — Check the endpoint in Settings and verify the tool is running
- **Auto-send isn't working** — Verify auto-send is toggled on for the active connection. For OpenCode, the session must be idle

## Next Steps

- [**Quick Start**](/quick-start) — Get started with ClankerContext in minutes
- [**Prompt Templates**](/prompt-templates) — Customize the markdown that gets sent to your tools
- [**Element Capture**](/element-capture) — How elements are captured across Fix, Modify, and Quick Select modes
