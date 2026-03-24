# Anima

🌐 Language: [中文](./README.md) | **English**

A digital human interactive frontend built with `Vue 3 + TypeScript + Vite`. Supports integration with the OpenClaw AI Agent platform, providing text/voice chat, 3D digital human rendering, TTS voice synthesis, and ATF lip-sync.

## Features

- Login / Registration
- Avatar selection & custom creation
- Real-time 3D digital human rendering
- Text / Voice chat
- TTS voice synthesis + ATF lip-sync
- OpenClaw Agent integration (optional)
- Internationalization (Chinese / English)
- Electron desktop app packaging

---

## One-Click Setup

### Windows (PowerShell)

```powershell
git clone https://github.com/your-org/Anima.git
cd Anima
.\setup.ps1
```

With OpenClaw configuration:

```powershell
.\setup.ps1 -OpenClawUrl "http://127.0.0.1:18789/v1/chat/completions" `
            -OpenClawToken "your-token" `
            -OpenClawAgent "main"
```

Build frontend + server only (skip Electron packaging):

```powershell
.\setup.ps1 -SkipElectron
```

### Linux / macOS

```bash
git clone https://github.com/your-org/Anima.git
cd Anima
chmod +x setup.sh
./setup.sh
```

With OpenClaw configuration:

```bash
./setup.sh --openclaw-url "http://127.0.0.1:18789/v1/chat/completions" \
           --openclaw-token "your-token" \
           --openclaw-agent "main"
```

Build frontend + server only (skip Electron packaging):

```bash
./setup.sh --skip-electron
```

### Prerequisites

| Tool | Minimum Version | Description |
|------|----------------|-------------|
| Node.js | 18+ | Frontend build & Electron |
| npm | 9+ | Included with Node.js |
| Python | 3.9+ | Flask local server |
| Git | - | Clone the repository |

---

## Manual Installation

### 1. Install Frontend Dependencies & Build

```bash
npm install
npm run build
```

### 2. Install Python Dependencies

```bash
cd server
pip install -r requirements.txt
```

### 3. Configure the Server

```bash
cp server/.env.example server/.env
# Edit server/.env with your configuration
```

### 4. Start the Server

```bash
cd server
python app.py
```

Default URL: http://localhost:19000

Optional arguments:

```bash
python app.py --port 8080
python app.py --host 127.0.0.1 --port 3000
```

### 5. Development Mode (Frontend Hot Reload)

```bash
npm run dev
```

> In development mode, `/api/*` requests are automatically proxied to `http://localhost:19000` (Flask server). See the proxy configuration in `vite.config.ts`.

---

## Electron Desktop App

### Development Mode

```bash
# Ensure the Flask server is running on port 19000
cd electron-shell
npm install
npm start
```

On startup, Electron automatically detects whether Flask is running:
- If running: loads the page directly
- If not running: spawns Flask, waits until ready, then loads

### Build Installer

```bash
# 1. Build the frontend first
npm run build

# 2. Package with Electron
cd electron-shell
npm run make
```

Output is in `electron-shell/out/`, containing the Windows installer (`.exe`).

### Custom Icon

Place `icon.ico` (Windows) or `icon.png` (macOS/Linux) in the `electron-shell/assets/` directory.

---

## OpenClaw Integration

Anima communicates with OpenClaw through the Flask server proxy. Depending on your OpenClaw deployment, there are three scenarios:

### Scenario 1: OpenClaw Deployed Locally

```env
OPENCLAW_API_URL=http://127.0.0.1:18789/v1/chat/completions
```

Works out of the box, no additional setup needed.

### Scenario 2: OpenClaw on Remote Server, Gateway Bound to 0.0.0.0

```env
OPENCLAW_API_URL=http://<remote-ip>:18789/v1/chat/completions
```

Ensure the server firewall allows port 18789.

### Scenario 3: OpenClaw on Remote Server, Gateway Bound to 127.0.0.1 (Default)

The OpenClaw Gateway listens on the loopback address by default, making it inaccessible externally. Use an SSH tunnel:

```bash
ssh -L 18789:127.0.0.1:18789 user@<remote-ip>
```

Keep this terminal open, then use in `.env`:

```env
OPENCLAW_API_URL=http://127.0.0.1:18789/v1/chat/completions
```

### OpenClaw Token

`OPENCLAW_TOKEN` must match the token in the `openclaw.json` file on the OpenClaw server.

### Agent Management

Anima can create and manage OpenClaw Agents directly from the frontend. If OpenClaw is deployed on a remote server, configure SSH access:

```env
# server/.env
OPENCLAW_SSH_HOST=agent@10.10.5.24
OPENCLAW_WORKSPACE_BASE=/home/agent/.openclaw
```

> **Important:** The machine running Flask must have **SSH key-based authentication** configured for the OpenClaw server. Otherwise, remote commands will hang waiting for a password.
>
> Setup:
> ```bash
> ssh-keygen -t ed25519  # if you don't have a key yet
> ssh-copy-id agent@10.10.5.24
> ```

If OpenClaw is deployed locally, leave `OPENCLAW_SSH_HOST` empty — commands will run directly on the local machine.

#### Frontend Agent Creation Flow

When creating a digital human, in the **Link Agent** step:

- **Create New Agent** — Enter Agent ID, name, persona, and system prompt. On submit, the frontend automatically executes:
  1. `openclaw agents add <id> --workspace <path> --non-interactive`
  2. Writes `IDENTITY.md` (name), `SOUL.md` (persona), `AGENTS.md` (system prompt)
  3. `openclaw agents set-identity --agent <id> --from-identity`

- **Use Existing Agent** — Directly bind an Agent already registered in OpenClaw

Avatars without a linked Agent use the default sumi backend.

#### Manual Agent Management (CLI Reference)

```bash
# List all agents
openclaw agents list --json

# Add an agent
openclaw agents add <id> --workspace /home/agent/.openclaw/workspace-<id> --non-interactive

# Edit agent persona configuration
# Modify files in the workspace directory: IDENTITY.md, SOUL.md, AGENTS.md, USER.md, TOOLS.md, MEMORY.md

# Sync identity into OpenClaw config
openclaw agents set-identity --agent <id> --workspace <path> --from-identity

# Modify agent config via conversation
openclaw agent --agent <id> --message 'Modify SOUL.md content...'

# Remove an agent
openclaw agents remove <id> --non-interactive
```

#### Binding Channels to an Agent

Edit the `bindings` in `~/.openclaw/openclaw.json` on the OpenClaw server:

```json
{
  "bindings": [
    {
      "agentId": "hyekyo",
      "match": { "channel": "feishu" }
    }
  ]
}
```

> Restart the Gateway after modifying `openclaw.json` for changes to take effect.

---

## OpenClaw Skill Auto-Deployment

If you use OpenClaw's skill feature for automated deployment, have the Agent execute:

### Windows

```
git clone https://github.com/your-org/Anima.git && cd Anima && powershell -ExecutionPolicy Bypass -File setup.ps1 -OpenClawUrl "http://127.0.0.1:18789/v1/chat/completions" -OpenClawToken "<TOKEN>" -OpenClawAgent "main"
```

### Linux / macOS

```
git clone https://github.com/your-org/Anima.git && cd Anima && chmod +x setup.sh && ./setup.sh --openclaw-url "http://127.0.0.1:18789/v1/chat/completions" --openclaw-token "<TOKEN>" --openclaw-agent "main"
```

> The OpenClaw Agent must have shell command execution capabilities, and the target machine must have Node.js and Python pre-installed.

---

## Project Structure

```
Anima/
├── public/                  # Static assets (images, 3D rendering libs)
├── server/                  # Flask local server
│   ├── app.py               # Server entry (static hosting + OpenClaw proxy)
│   ├── .env.example         # Configuration template
│   └── requirements.txt     # Python dependencies
├── src/
│   ├── api/                 # API wrappers (avatars, chat, user, model)
│   ├── locales/             # Internationalization (Chinese, English)
│   ├── stores/              # Pinia state management
│   ├── utils/atf/           # Digital human rendering (AvatarJS)
│   ├── views/               # Page components
│   └── styles/              # Global styles
├── electron-shell/          # Electron desktop app shell
│   ├── src/main.ts          # Electron main process (auto-starts Flask)
│   ├── forge.config.ts      # Electron Forge packaging config
│   └── package.json
├── dist/                    # Frontend build output (git ignored)
├── setup.ps1                # Windows one-click setup script
├── setup.sh                 # Linux/macOS one-click setup script
├── vite.config.ts           # Vite config (includes /api proxy)
└── package.json
```

---

## Routes

| Path | Description |
|---|---|
| `/login` | Login / Registration |
| `/avatars` | Avatar selection |
| `/avatars/create` | Create avatar (includes Link Agent step) |
| `/chat` | Digital human interaction (text, voice, lip-sync) |

---

## Environment Variables

### Frontend (`.env` / `.env.production`)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Digital human backend API URL | `https://sumi.sumeruai.com` |

### Flask Server (`server/.env`)

| Variable | Description | Default |
|---|---|---|
| `ANIMA_HOST` | Bind address | `0.0.0.0` |
| `ANIMA_PORT` | Listen port | `19000` |
| `ANIMA_API_BASE_URL` | Digital human backend API URL | `https://sumi.sumeruai.com` |
| `OPENCLAW_API_URL` | OpenClaw API URL | (empty) |
| `OPENCLAW_TOKEN` | OpenClaw Bearer Token | (empty) |
| `OPENCLAW_DEFAULT_AGENT` | Default Agent ID | `main` |
| `OPENCLAW_SSH_HOST` | Remote OpenClaw SSH host (e.g. `agent@10.10.5.24`) | (empty=local) |
| `OPENCLAW_WORKSPACE_BASE` | Base directory for agent workspaces | `~/.openclaw` |

### Electron (`electron-shell/.env`)

| Variable | Description | Default |
|---|---|---|
| `ANIMA_PORT` | Flask backend port | `19000` |
| `ANIMA_PYTHON` | Python executable path | Auto-detected |
