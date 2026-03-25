---
name: anima-installer
description: Install, configure, start, verify, update, and optionally expose the Anima digital-human application that integrates with OpenClaw. Use when the user wants OpenClaw to autonomously deploy Anima on the current machine, connect it to local or remote OpenClaw Gateway, auto-discover gateway.auth.token and gateway.port from ~/.openclaw/openclaw.json when possible, write server/.env correctly, run the Flask service in the background, optionally package Electron, and return a usable access URL plus troubleshooting guidance.
---

# Anima Installer Skill

本 Skill 用来帮主人把 Anima 安装成一个可访问的数字人应用，并尽量少问问题。

默认目标：
- 先把 Web 版跑通
- 让 `http://127.0.0.1:19000` 可访问
- 如果本机就是 OpenClaw 所在机，优先自动读取 `~/.openclaw/openclaw.json` 里的真实配置并接上
- Electron 只在主人明确要求桌面应用或安装包时再处理

## 0. 一句话告诉主人这是什么

你可以先这样告诉主人：

> 这是一个给 OpenClaw Agent 加上 3D 数字人界面、语音合成和唇形同步的应用。装好后，你可以在浏览器里和数字人聊天，并把它绑定到 OpenClaw Agent。

## 1. 默认原则

- 默认假设宿主机是 Linux 或 macOS，且 Anima 与 OpenClaw 在同一台机器。
- 默认只安装 Web 版，不在首次安装时打包 Electron。
- 始终使用真实仓库地址：`https://github.com/sumeurai/Anima.git`
- 不要照抄 README 里的占位示例，例如 `your-org/Anima.git`、`agent@10.10.5.24`、`/home/agent/.openclaw`、`hyekyo`。
- 不要默认使用 `setup.sh` 或 `setup.ps1` 作为主链路，因为：
  - 它们会在默认路径下继续处理 Electron，首次安装更重
  - `server/.env` 已存在时它们不会覆盖，容易遗留旧配置
- `ANIMA_API_BASE_URL` 默认写生产地址：`https://sumi.sumeruai.com`
- 不要沿用 `server/.env.example` 里的 `https://sumi-test.sumeruai.com`，除非主人明确要求测试环境。
- 优先从 `~/.openclaw/openclaw.json` 读取真实配置，而不是手填猜测值：
  - `OPENCLAW_TOKEN` 优先读取 `gateway.auth.token`
  - `OPENCLAW_API_URL` 里的端口优先读取 `gateway.port`
  - `OPENCLAW_DEFAULT_AGENT` 优先用 `main`；如果本机没有 `main`，再回退到现有第一个 agent id
  - `OPENCLAW_WORKSPACE_BASE` 优先用 `dirname(agents.defaults.workspace)`；读不到时再回退到 `~/.openclaw`
- 只有在 OpenClaw 真的部署在远程机器上时，才设置 `OPENCLAW_SSH_HOST` 和 `OPENCLAW_WORKSPACE_BASE`。
- `OPENCLAW_SSH_HOST` 必须使用用户当前真实远程地址，例如 `alice@192.168.1.20`；不要写死示例地址。
- `bindings` 示例默认用 `main`，不要沿用 README 里的 `hyekyo`。
- 不要擅自杀掉不明进程，不要擅自改 `19000` 端口。
- Anima 的登录、头像生成、TTS、ASR、ATF 默认依赖 `https://sumi.sumeruai.com`；即使 OpenClaw 接好了，如果这条外网链路不通，数字人功能仍会不完整。

## 2. 安装前检查

先确认：
- `git`
- `node` >= 18
- `npm`
- Python 3.9+
- 能访问 GitHub
- 能访问 `https://sumi.sumeruai.com`
- 如果要接远程 OpenClaw，还需要 `ssh`

如果缺依赖：
- 先明确告诉主人缺什么
- 只有在主人同意时才使用系统包管理器安装

推荐先执行这段检查：

```bash
set -euo pipefail

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Python 3 not found" >&2
  exit 1
fi

command -v git >/dev/null 2>&1 || { echo "git not found" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node not found" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm not found" >&2; exit 1; }

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "${NODE_MAJOR}" -lt 18 ]; then
  echo "Node.js >= 18 is required" >&2
  exit 1
fi

"$PYTHON_BIN" - <<'PY'
import sys
import urllib.request

for url in ["https://github.com", "https://sumi.sumeruai.com"]:
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            print(f"OK {url} -> {resp.status}")
    except Exception as exc:
        print(f"FAIL {url}: {exc}", file=sys.stderr)
        raise SystemExit(1)
PY
```

## 3. 先识别实际环境，不要盲配

### 3.1 识别项目目录

默认安装目录是：

```bash
$HOME/Anima
```

但如果当前目录已经是 Anima 仓库，就直接用当前目录，不要再额外 clone 一份。

推荐这样识别：

```bash
set -euo pipefail

REPO_URL="https://github.com/sumeurai/Anima.git"

if [ -f "./package.json" ] && [ -f "./server/app.py" ] && [ -d "./src" ]; then
  PROJECT_DIR="$(pwd)"
else
  PROJECT_DIR="$HOME/Anima"
fi

echo "PROJECT_DIR=$PROJECT_DIR"
```

如果 `PROJECT_DIR` 已存在但不是 git 仓库，不要直接覆盖，先告诉主人目录已存在且不是 Anima 仓库，再询问是否换目录。

### 3.2 从本机 OpenClaw 配置里读取真实值

优先读取：
- `~/.openclaw/openclaw.json`
- token 读取路径优先是 `gateway.auth.token`
- port 读取路径优先是 `gateway.port`
- 默认 agent 优先是 `main`
- workspace base 优先是 `dirname(agents.defaults.workspace)`

推荐这样读：

```bash
set -euo pipefail

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  PYTHON_BIN="python"
fi

mapfile -t OPENCLAW_DISCOVERY < <("$PYTHON_BIN" - <<'PY'
import json
from pathlib import Path

path = Path.home() / ".openclaw" / "openclaw.json"
token = ""
port = "18789"
workspace_base = str(Path.home() / ".openclaw")
default_agent = "main"

if path.exists():
    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        obj = {}

    if isinstance(obj, dict):
        gateway = obj.get("gateway", {}) if isinstance(obj.get("gateway", {}), dict) else {}
        auth = gateway.get("auth", {}) if isinstance(gateway.get("auth", {}), dict) else {}
        token = str(auth.get("token", "") or "")
        port = str(gateway.get("port", 18789) or 18789)

        agents = obj.get("agents", {}) if isinstance(obj.get("agents", {}), dict) else {}
        defaults = agents.get("defaults", {}) if isinstance(agents.get("defaults", {}), dict) else {}
        workspace = str(defaults.get("workspace", "") or "")
        if workspace:
            workspace_base = str(Path(workspace).expanduser().parent)

        agent_ids = [
            str(item.get("id", "")).strip()
            for item in agents.get("list", [])
            if isinstance(item, dict) and str(item.get("id", "")).strip()
        ]
        if "main" in agent_ids:
            default_agent = "main"
        elif agent_ids:
            default_agent = agent_ids[0]

print(token)
print(port)
print(workspace_base)
print(default_agent)
PY
)

OPENCLAW_TOKEN="${OPENCLAW_DISCOVERY[0]:-}"
OPENCLAW_PORT="${OPENCLAW_DISCOVERY[1]:-18789}"
OPENCLAW_WORKSPACE_BASE="${OPENCLAW_DISCOVERY[2]:-$HOME/.openclaw}"
OPENCLAW_DEFAULT_AGENT="${OPENCLAW_DISCOVERY[3]:-main}"
OPENCLAW_API_URL="http://127.0.0.1:${OPENCLAW_PORT}/v1/chat/completions"

printf '%s\n' \
  "OPENCLAW_PORT=$OPENCLAW_PORT" \
  "OPENCLAW_DEFAULT_AGENT=$OPENCLAW_DEFAULT_AGENT" \
  "OPENCLAW_WORKSPACE_BASE=$OPENCLAW_WORKSPACE_BASE" \
  "OPENCLAW_TOKEN_PRESENT=$( [ -n "$OPENCLAW_TOKEN" ] && echo yes || echo no )"
```

说明：
- 这里的读取逻辑优先适配当前 OpenClaw 常见结构：`gateway.auth.token`
- 不要再按旧写法去读顶层 `token`
- 如果主人明确说 OpenClaw 在远程机器上，不要直接使用本机读到的这些值，进入第 8 节远程分支

## 4. 推荐安装路径：先跑通 Web 版

这是默认主链路。按顺序执行，不要跳步。

```bash
set -euo pipefail

REPO_URL="https://github.com/sumeurai/Anima.git"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  PYTHON_BIN="python"
fi

if [ -f "./package.json" ] && [ -f "./server/app.py" ] && [ -d "./src" ]; then
  PROJECT_DIR="$(pwd)"
else
  PROJECT_DIR="$HOME/Anima"
fi

if [ -e "$PROJECT_DIR" ] && [ ! -d "$PROJECT_DIR/.git" ] && [ "$PROJECT_DIR" != "$(pwd)" ]; then
  echo "Install directory exists but is not a git repo: $PROJECT_DIR" >&2
  exit 1
fi

if [ -d "$PROJECT_DIR/.git" ]; then
  git -C "$PROJECT_DIR" pull --ff-only
elif [ "$PROJECT_DIR" = "$(pwd)" ]; then
  echo "Using existing local source tree: $PROJECT_DIR"
else
  git clone "$REPO_URL" "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"
npm install
npm run build
"$PYTHON_BIN" -m pip install -r server/requirements.txt

mapfile -t OPENCLAW_DISCOVERY < <("$PYTHON_BIN" - <<'PY'
import json
from pathlib import Path

path = Path.home() / ".openclaw" / "openclaw.json"
token = ""
port = "18789"
default_agent = "main"

if path.exists():
    try:
        obj = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        obj = {}

    if isinstance(obj, dict):
        gateway = obj.get("gateway", {}) if isinstance(obj.get("gateway", {}), dict) else {}
        auth = gateway.get("auth", {}) if isinstance(gateway.get("auth", {}), dict) else {}
        token = str(auth.get("token", "") or "")
        port = str(gateway.get("port", 18789) or 18789)

        agents = obj.get("agents", {}) if isinstance(obj.get("agents", {}), dict) else {}
        agent_ids = [
            str(item.get("id", "")).strip()
            for item in agents.get("list", [])
            if isinstance(item, dict) and str(item.get("id", "")).strip()
        ]
        if "main" in agent_ids:
            default_agent = "main"
        elif agent_ids:
            default_agent = agent_ids[0]

print(token)
print(port)
print(default_agent)
PY
)

OPENCLAW_TOKEN="${OPENCLAW_DISCOVERY[0]:-}"
OPENCLAW_PORT="${OPENCLAW_DISCOVERY[1]:-18789}"
OPENCLAW_DEFAULT_AGENT="${OPENCLAW_DISCOVERY[2]:-main}"
OPENCLAW_API_URL="http://127.0.0.1:${OPENCLAW_PORT}/v1/chat/completions"

if [ -f server/.env ]; then
  cp server/.env "server/.env.bak.$(date +%Y%m%d_%H%M%S)"
fi

if [ -n "$OPENCLAW_TOKEN" ]; then
  cat > server/.env <<EOF2
ANIMA_HOST=0.0.0.0
ANIMA_PORT=19000
ANIMA_API_BASE_URL=https://sumi.sumeruai.com
OPENCLAW_API_URL=$OPENCLAW_API_URL
OPENCLAW_TOKEN=$OPENCLAW_TOKEN
OPENCLAW_DEFAULT_AGENT=$OPENCLAW_DEFAULT_AGENT
EOF2
else
  cat > server/.env <<EOF2
ANIMA_HOST=0.0.0.0
ANIMA_PORT=19000
ANIMA_API_BASE_URL=https://sumi.sumeruai.com
EOF2
fi
```

## 5. 启动前先检查 `19000`

先检查 `19000` 是否已经是 Anima：

```bash
set -euo pipefail

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  PYTHON_BIN="python"
fi

HEALTH="$($PYTHON_BIN - <<'PY'
import urllib.request
try:
    data = urllib.request.urlopen("http://127.0.0.1:19000/health", timeout=3).read().decode("utf-8", errors="replace")
    print(data)
except Exception:
    pass
PY
)"

PORT_STATUS="$($PYTHON_BIN - <<'PY'
import socket
s = socket.socket()
s.settimeout(1.5)
try:
    s.connect(("127.0.0.1", 19000))
    print("open")
except Exception:
    print("closed")
finally:
    s.close()
PY
)"

printf '%s\n' "PORT_STATUS=$PORT_STATUS"
printf '%s\n' "HEALTH=$HEALTH"
```

处理规则：
- 如果 `/health` 返回类似 `{"status":"ok","version":"..."}`，说明 Anima 已在运行，不要重复启动，直接告诉主人访问地址。
- 如果端口是 `open`，但 `/health` 不是 Anima：
  - 不要直接杀进程
  - 先问主人是换端口还是停止现有服务
- 如果端口是 `closed`，再进入后台启动步骤

## 6. 后台启动 Flask 服务

推荐这样启动：

```bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/Anima}"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  PYTHON_BIN="python"
fi

HEALTH="$($PYTHON_BIN - <<'PY'
import urllib.request
try:
    data = urllib.request.urlopen("http://127.0.0.1:19000/health", timeout=3).read().decode("utf-8", errors="replace")
    print(data)
except Exception:
    pass
PY
)"

if printf '%s' "$HEALTH" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
  echo "Anima is already running on http://127.0.0.1:19000"
  exit 0
fi

if [ -f "$PROJECT_DIR/anima-server.pid" ] && kill -0 "$(cat "$PROJECT_DIR/anima-server.pid")" 2>/dev/null; then
  kill "$(cat "$PROJECT_DIR/anima-server.pid")" || true
  sleep 1
fi

cd "$PROJECT_DIR/server"
nohup "$PYTHON_BIN" app.py > "$PROJECT_DIR/anima-server.log" 2>&1 &
echo $! > "$PROJECT_DIR/anima-server.pid"
sleep 3

"$PYTHON_BIN" - <<'PY'
import sys
import urllib.request

url = "http://127.0.0.1:19000/health"
try:
    data = urllib.request.urlopen(url, timeout=5).read().decode("utf-8", errors="replace")
    print(data)
except Exception as exc:
    print(f"Health check failed: {exc}", file=sys.stderr)
    raise SystemExit(1)
PY
```

成功后至少告诉主人：

```text
Anima 已安装完成
访问地址：http://127.0.0.1:19000
日志文件：~/Anima/anima-server.log
PID 文件：~/Anima/anima-server.pid
```

## 7. 如果本机没有读到 OpenClaw token

只问主人一次，推荐这样问：

> 我已经把 Anima 的 Web 安装准备好了，但当前没有从 `~/.openclaw/openclaw.json` 读到有效的 OpenClaw token。你希望我先只把界面跑起来，还是现在继续补 OpenClaw 配置，直接启用 Agent 对话？

说明给主人：
- 没 token 也能打开页面
- 但 OpenClaw Agent 聊天、Agent 列表同步、前端创建 Agent 等能力不会完整工作

## 8. 远程 OpenClaw 场景

只有在 Anima 与 OpenClaw 不在同一台机器时，才进入这个分支。

### 8.1 先从远程机器读取真实配置

不要手填猜测值。先通过 SSH 读取远程 `~/.openclaw/openclaw.json`，拿到：
- `gateway.auth.token`
- `gateway.port`
- `dirname(agents.defaults.workspace)`
- 默认 agent，优先 `main`

推荐这样做：

```bash
set -euo pipefail

REMOTE_SSH_HOST="user@remote-host"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  PYTHON_BIN="python"
fi

TMP_REMOTE_JSON="$(mktemp)"
ssh "$REMOTE_SSH_HOST" 'cat ~/.openclaw/openclaw.json' > "$TMP_REMOTE_JSON"

mapfile -t REMOTE_DISCOVERY < <("$PYTHON_BIN" - <<'PY' "$TMP_REMOTE_JSON"
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
obj = json.loads(path.read_text(encoding="utf-8"))

gateway = obj.get("gateway", {}) if isinstance(obj.get("gateway", {}), dict) else {}
auth = gateway.get("auth", {}) if isinstance(gateway.get("auth", {}), dict) else {}
token = str(auth.get("token", "") or "")
port = str(gateway.get("port", 18789) or 18789)

agents = obj.get("agents", {}) if isinstance(obj.get("agents", {}), dict) else {}
defaults = agents.get("defaults", {}) if isinstance(agents.get("defaults", {}), dict) else {}
workspace = str(defaults.get("workspace", "") or "")
workspace_base = str(Path(workspace).expanduser().parent) if workspace else "~/.openclaw"

agent_ids = [
    str(item.get("id", "")).strip()
    for item in agents.get("list", [])
    if isinstance(item, dict) and str(item.get("id", "")).strip()
]
default_agent = "main" if "main" in agent_ids else (agent_ids[0] if agent_ids else "main")

print(token)
print(port)
print(workspace_base)
print(default_agent)
PY
)

rm -f "$TMP_REMOTE_JSON"

REMOTE_OPENCLAW_TOKEN="${REMOTE_DISCOVERY[0]:-}"
REMOTE_OPENCLAW_PORT="${REMOTE_DISCOVERY[1]:-18789}"
REMOTE_OPENCLAW_WORKSPACE_BASE="${REMOTE_DISCOVERY[2]:-~/.openclaw}"
REMOTE_OPENCLAW_DEFAULT_AGENT="${REMOTE_DISCOVERY[3]:-main}"
REMOTE_API_HOST="${REMOTE_SSH_HOST#*@}"
```

如果这里失败，再问主人一次远程 SSH 地址和真实 workspace 路径，不要把 README 里的 `agent@10.10.5.24` 与 `/home/agent/.openclaw` 原样写进去。

### 8.2 远程 Gateway 可直接访问

如果远程 Gateway 对当前机器可达，`server/.env` 写成：

```env
ANIMA_HOST=0.0.0.0
ANIMA_PORT=19000
ANIMA_API_BASE_URL=https://sumi.sumeruai.com
OPENCLAW_API_URL=http://<remote-api-host>:<remote-port>/v1/chat/completions
OPENCLAW_TOKEN=<remote-token>
OPENCLAW_DEFAULT_AGENT=main
OPENCLAW_SSH_HOST=<real-ssh-user>@<real-ssh-host>
OPENCLAW_WORKSPACE_BASE=<real-remote-workspace-base>
```

说明：
- `<remote-api-host>` 不一定等于 README 示例里的 IP，要用当前主人真实可达的地址
- `OPENCLAW_DEFAULT_AGENT` 默认推荐写 `main`；如果远程没有 `main`，再改成远程实际 agent id
- `OPENCLAW_SSH_HOST` 负责前端创建、同步、删除 Agent 时执行 CLI
- `OPENCLAW_WORKSPACE_BASE` 必须是远程机器上的真实 base 路径，不要写死

### 8.3 远程 Gateway 只监听 `127.0.0.1`

如果远程 Gateway 只监听回环地址，先建 SSH 隧道，再把 `OPENCLAW_API_URL` 写成本机转发地址。

推荐：

```bash
set -euo pipefail

REMOTE_SSH_HOST="user@remote-host"
REMOTE_OPENCLAW_PORT="18789"
LOCAL_TUNNEL_PORT="18789"

ssh -fNT -L "${LOCAL_TUNNEL_PORT}:127.0.0.1:${REMOTE_OPENCLAW_PORT}" "$REMOTE_SSH_HOST"
```

然后 `server/.env` 写成：

```env
ANIMA_HOST=0.0.0.0
ANIMA_PORT=19000
ANIMA_API_BASE_URL=https://sumi.sumeruai.com
OPENCLAW_API_URL=http://127.0.0.1:<local-tunnel-port>/v1/chat/completions
OPENCLAW_TOKEN=<remote-token>
OPENCLAW_DEFAULT_AGENT=main
OPENCLAW_SSH_HOST=<real-ssh-user>@<real-ssh-host>
OPENCLAW_WORKSPACE_BASE=<real-remote-workspace-base>
```

说明：
- 如果本机 `18789` 已被别的服务占用，再问主人是否改隧道端口
- `OPENCLAW_API_URL` 负责聊天代理
- `OPENCLAW_SSH_HOST` 与 `OPENCLAW_WORKSPACE_BASE` 负责远程 agent 管理
- 如果远程场景里不配置 `OPENCLAW_SSH_HOST`，纯聊天代理可能还能工作，但前端的 agent 列表、同步、创建、删除不会完整可靠

## 9. 绑定渠道到 `main`（可选）

如果主人需要把某个渠道直接绑定到默认 agent，修改 OpenClaw 服务器上 `~/.openclaw/openclaw.json` 的 `bindings` 时，默认示例写成：

```json
{
  "bindings": [
    {
      "agentId": "main",
      "match": { "channel": "feishu" }
    }
  ]
}
```

说明：
- 不要再沿用 README 里的 `hyekyo`
- 如果主人当前默认 agent 不是 `main`，再把 `main` 换成真实 agent id
- 修改 `openclaw.json` 后，需要重启 Gateway 才会生效

## 10. 安装成功后，必须提醒主人的内容

至少提醒这几件事：

1. 入口地址是 `http://127.0.0.1:19000`
2. 首次使用需要登录；登录与注册默认走 Anima 的远程服务
3. 创建数字人时，在 **Link Agent** 步骤里可以：
   - 新建 OpenClaw Agent
   - 绑定已有 Agent
4. 如果没有配置 `OPENCLAW_TOKEN`，页面能打开，但 OpenClaw Agent 对话能力不会完整
5. 数字人生成、TTS、ASR、ATF 默认依赖 `https://sumi.sumeruai.com`

建议口径：

> 我已经把 Anima 跑起来了。你现在可以先打开页面体验数字人界面；如果你希望数字人直接对接 OpenClaw Agent，我也可以继续帮你检查 token、agent 列表和绑定关系。

## 11. Electron 只在明确要求时处理

只有在主人明确要求桌面应用或安装包时，再执行这一段。

先说明：

> Electron 打包比 Web 版更重，首次安装时不建议默认执行；如果你需要桌面应用，我再继续打包。

执行：

```bash
set -euo pipefail
cd "${PROJECT_DIR:-$HOME/Anima}/electron-shell"
npm install
npm run make
```

完成后告诉主人输出目录：

```text
~/Anima/electron-shell/out
```

说明：
- `electron-shell/src/main.ts` 会在桌面应用启动时自动检测 Flask 是否已运行
- 如果 Flask 没运行，它会尝试自动拉起 `server/app.py`

## 12. 可选：给主人一个公网地址

如果机器上有 `cloudflared`，可以给主人一个临时公网链接：

```bash
cloudflared tunnel --url http://127.0.0.1:19000
```

拿到 `https://xxx.trycloudflare.com` 后发给主人，并说明：

> 这是临时公网地址，关闭隧道后会失效。

不要主动暴露内网 IP。

## 13. 更新已有安装

如果主人说“之前装过，现在帮我更新”，按这条链路做：

```bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/Anima}"

if [ ! -d "$PROJECT_DIR/.git" ]; then
  echo "Anima repo not found at $PROJECT_DIR" >&2
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  PYTHON_BIN="python"
fi

git -C "$PROJECT_DIR" pull --ff-only

cd "$PROJECT_DIR"
npm install
npm run build
"$PYTHON_BIN" -m pip install -r server/requirements.txt

if [ -f "$PROJECT_DIR/anima-server.pid" ] && kill -0 "$(cat "$PROJECT_DIR/anima-server.pid")" 2>/dev/null; then
  kill "$(cat "$PROJECT_DIR/anima-server.pid")" || true
  sleep 1
fi

cd "$PROJECT_DIR/server"
nohup "$PYTHON_BIN" app.py > "$PROJECT_DIR/anima-server.log" 2>&1 &
echo $! > "$PROJECT_DIR/anima-server.pid"
sleep 3

"$PYTHON_BIN" - <<'PY'
import urllib.request
print(urllib.request.urlopen("http://127.0.0.1:19000/health", timeout=5).read().decode("utf-8", errors="replace"))
PY
```

更新时不要随便覆盖主人手改过的 `server/.env`，除非：
- 当前配置明显错误
- 当前环境值仍停留在 README 的占位示例
- 主人明确要求重置

## 14. 常见问题与处理

### Q1. 页面能打开，但 Agent 列表为空

优先检查：
- `OPENCLAW_TOKEN` 是否为空
- `OPENCLAW_API_URL` 是否写对
- 本机或远程执行 `openclaw agents list --json` 是否正常
- 远程场景下 `OPENCLAW_SSH_HOST` 是否配置为真实可 SSH 的地址

告诉主人：

> 这通常不是前端没装好，而是 OpenClaw 配置没有连通，或 agent 列表没有被正确读取。

### Q2. 页面能打开，但创建数字人、TTS、ASR 或唇形同步失败

优先检查：
- 是否能访问 `https://sumi.sumeruai.com`
- 浏览器登录是否成功
- `server/.env` 是否错误地保留了 `https://sumi-test.sumeruai.com`
- `anima-server.log` 是否有请求转发报错

### Q3. `python app.py` 启动失败，提示找不到 `dist/`

说明前端还没 build。重新执行：

```bash
cd "${PROJECT_DIR:-$HOME/Anima}"
npm install
npm run build
```

### Q4. `server/.env` 改了却没生效

重启 Flask 服务：

```bash
kill "$(cat "${PROJECT_DIR:-$HOME/Anima}/anima-server.pid")" || true
cd "${PROJECT_DIR:-$HOME/Anima}/server"
nohup python3 app.py > "${PROJECT_DIR:-$HOME/Anima}/anima-server.log" 2>&1 &
echo $! > "${PROJECT_DIR:-$HOME/Anima}/anima-server.pid"
```

如果当前机器没有 `python3`，把命令里的 `python3` 改成 `python`。

### Q5. 远程 agent 创建或同步时卡住

优先检查：
- `OPENCLAW_SSH_HOST` 是否真实可达
- 是否已经配置 SSH 免密登录
- 远程 `OPENCLAW_WORKSPACE_BASE` 是否写成真实路径

说明：
- 远程 agent 管理依赖 SSH 执行 CLI
- 如果 SSH 需要交互式输入密码，前端调用通常会卡住

### Q6. `19000` 已被别的服务占用

不要直接杀进程。先告诉主人：

> 当前 `19000` 端口已被其他服务占用，而且不是 Anima。你要我改 Anima 端口，还是先停掉现有服务？

## 15. 只有在必要时才问主人的问题

只在下面这些情况提问：
1. 本机没有读到有效的 OpenClaw token
2. `19000` 被别的服务占用，且不是 Anima
3. 主人明确要桌面安装包，才继续 Electron
4. 缺系统依赖，而你需要用系统包管理器安装
5. 主人要求连接远程 OpenClaw，但你还不知道真实 SSH 地址或远程 workspace 路径

## 16. 你自己的执行提醒

- 先跑通 Web 版，再谈 Electron
- 优先使用真实仓库地址：`https://github.com/sumeurai/Anima.git`
- 优先写对 `server/.env`
- 优先把 `ANIMA_API_BASE_URL` 固定到 `https://sumi.sumeruai.com`
- 优先从 `~/.openclaw/openclaw.json` 读取 `gateway.auth.token` 与 `gateway.port`
- 优先验证 `http://127.0.0.1:19000/health`
- 优先把日志与 PID 路径告诉主人
- 不要因为 Electron 或公网访问失败就误判整个 Anima 安装失败
