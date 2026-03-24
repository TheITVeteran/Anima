# Anima

🌐 Language: **中文** | [English](./README.en.md)

基于 `Vue 3 + TypeScript + Vite` 的数字人交互前端，支持对接 OpenClaw AI Agent 平台，提供文字/语音聊天、3D 数字人渲染、TTS 语音合成和 ATF 唇形同步。

## 功能概览

- 登录 / 注册
- 数字人形象选择 & 自定义创建
- 3D 数字人实时渲染
- 文字 / 语音聊天
- TTS 语音合成 + ATF 唇形同步
- 对接 OpenClaw Agent（可选）
- 多语言支持（中文 / 英文）
- Electron 桌面应用打包

---

## 一键安装

### Windows (PowerShell)

```powershell
git clone https://github.com/your-org/Anima.git
cd Anima
.\setup.ps1
```

带 OpenClaw 配置：

```powershell
.\setup.ps1 -OpenClawUrl "http://127.0.0.1:18789/v1/chat/completions" `
            -OpenClawToken "your-token" `
            -OpenClawAgent "main"
```

只构建前端 + 服务器（不打包 Electron）：

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

带 OpenClaw 配置：

```bash
./setup.sh --openclaw-url "http://127.0.0.1:18789/v1/chat/completions" \
           --openclaw-token "your-token" \
           --openclaw-agent "main"
```

只构建前端 + 服务器（不打包 Electron）：

```bash
./setup.sh --skip-electron
```

### 前置条件

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 18+ | 前端构建 & Electron |
| npm | 9+ | 随 Node.js 安装 |
| Python | 3.9+ | Flask 本地服务器 |
| Git | - | 拉取代码 |

---

## 手动安装

### 1. 安装前端依赖 & 构建

```bash
npm install
npm run build
```

### 2. 安装 Python 依赖

```bash
cd server
pip install -r requirements.txt
```

### 3. 配置服务器

```bash
cp server/.env.example server/.env
# 编辑 server/.env 填入配置
```

### 4. 启动服务器

```bash
cd server
python app.py
```

默认访问地址：http://localhost:19000

可选参数：

```bash
python app.py --port 8080
python app.py --host 127.0.0.1 --port 3000
```

### 5. 开发模式（前端热更新）

```bash
npm run dev
```

> 开发模式下 `/api/*` 请求会自动代理到 `http://localhost:19000`（Flask 服务器），见 `vite.config.ts` 中的 proxy 配置。

---

## Electron 桌面应用

### 开发模式

```bash
# 确保 Flask 服务器在 19000 端口运行
cd electron-shell
npm install
npm start
```

Electron 启动时会自动检测 Flask 是否在运行：
- 如果已运行：直接加载页面
- 如果未运行：自动启动 Flask，等待就绪后加载

### 打包安装程序

```bash
# 1. 先构建前端
npm run build

# 2. 打包 Electron
cd electron-shell
npm run make
```

输出在 `electron-shell/out/` 目录，包含 Windows 安装程序（`.exe`）。

### 自定义图标

将 `icon.ico`（Windows）或 `icon.png`（macOS/Linux）放入 `electron-shell/assets/` 目录。

---

## 对接 OpenClaw

Anima 通过 Flask 服务器代理与 OpenClaw 通信。根据 OpenClaw 的部署方式，有以下三种场景：

### 场景一：OpenClaw 部署在本机

```env
OPENCLAW_API_URL=http://127.0.0.1:18789/v1/chat/completions
```

直接可用，无需额外操作。

### 场景二：OpenClaw 部署在远程服务器，Gateway 绑定 0.0.0.0

```env
OPENCLAW_API_URL=http://<远程IP>:18789/v1/chat/completions
```

确保服务器防火墙允许 18789 端口。

### 场景三：OpenClaw 部署在远程服务器，Gateway 绑定 127.0.0.1（默认）

OpenClaw Gateway 默认只监听本机回环地址，外部无法直接访问。需要通过 SSH 隧道转发：

```bash
ssh -L 18789:127.0.0.1:18789 user@<远程IP>
```

保持此终端打开，然后在 `.env` 中使用：

```env
OPENCLAW_API_URL=http://127.0.0.1:18789/v1/chat/completions
```

### OpenClaw Token

`OPENCLAW_TOKEN` 需要与 OpenClaw 服务器上 `openclaw.json` 文件中的 token 保持一致。

### Agent 管理

Anima 支持通过前端直接在 OpenClaw 服务器上创建和管理 Agent。如果 OpenClaw 部署在远程服务器，需要配置 SSH 连接：

```env
# server/.env
OPENCLAW_SSH_HOST=agent@10.10.5.24
OPENCLAW_WORKSPACE_BASE=/home/agent/.openclaw
```

> **重要：** 运行 Flask 的机器必须对 OpenClaw 服务器配置 **SSH 免密登录**（key-based auth），否则远程命令会卡住等待输入密码。
>
> 设置方法：
> ```bash
> ssh-keygen -t ed25519  # 如果还没有密钥
> ssh-copy-id agent@10.10.5.24
> ```

如果 OpenClaw 部署在本机，无需设置 `OPENCLAW_SSH_HOST`，命令会直接在本地执行。

#### 前端创建 Agent 的流程

创建数字人时，在 **Link Agent** 步骤中：

- **新建 Agent** — 填入 Agent ID、名称、人格描述、系统提示词后提交，前端会自动执行：
  1. `openclaw agents add <id> --workspace <path> --non-interactive`
  2. 写入 `IDENTITY.md`（名称）、`SOUL.md`（人格）、`AGENTS.md`（提示词）
  3. `openclaw agents set-identity --agent <id> --from-identity`

- **选择已有 Agent** — 直接绑定已在 OpenClaw 上注册的 Agent

未绑定 Agent 的数字人使用默认的 sumi 后端。

#### 手动管理 Agent（CLI 参考）

```bash
# 查看所有 Agent
openclaw agents list --json

# 添加 Agent
openclaw agents add <id> --workspace /home/agent/.openclaw/workspace-<id> --non-interactive

# 编辑 Agent 人格配置
# 修改 workspace 目录下的：IDENTITY.md, SOUL.md, AGENTS.md, USER.md, TOOLS.md, MEMORY.md

# 同步 Identity 到 OpenClaw 配置
openclaw agents set-identity --agent <id> --workspace <path> --from-identity

# 通过对话修改 Agent 配置
openclaw agent --agent <id> --message '修改 SOUL.md 内容...'

# 删除 Agent
openclaw agents remove <id> --non-interactive
```

#### 绑定渠道到 Agent

修改 OpenClaw 服务器上 `~/.openclaw/openclaw.json` 中的 `bindings`：

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

> 修改 `openclaw.json` 后需要重启 Gateway 才能生效。

---

## OpenClaw Skill 自动部署

如果你使用 OpenClaw 的 skill 功能来自动化部署，可以让 Agent 执行以下命令：

### Windows

```
git clone https://github.com/your-org/Anima.git && cd Anima && powershell -ExecutionPolicy Bypass -File setup.ps1 -OpenClawUrl "http://127.0.0.1:18789/v1/chat/completions" -OpenClawToken "<TOKEN>" -OpenClawAgent "main"
```

### Linux / macOS

```
git clone https://github.com/your-org/Anima.git && cd Anima && chmod +x setup.sh && ./setup.sh --openclaw-url "http://127.0.0.1:18789/v1/chat/completions" --openclaw-token "<TOKEN>" --openclaw-agent "main"
```

> OpenClaw Agent 需要有执行 shell 命令的能力，且目标机器上需要预装 Node.js 和 Python。

---

## 项目结构

```
Anima/
├── public/                  # 静态资源（图片、3D 渲染库）
├── server/                  # Flask 本地服务器
│   ├── app.py               # 服务器入口（静态托管 + OpenClaw 代理）
│   ├── .env.example         # 配置模板
│   └── requirements.txt     # Python 依赖
├── src/
│   ├── api/                 # API 封装（avatars, chat, user, model）
│   ├── locales/             # 国际化（中文、英文）
│   ├── stores/              # Pinia 状态管理
│   ├── utils/atf/           # 数字人渲染（AvatarJS）
│   ├── views/               # 页面组件
│   └── styles/              # 全局样式
├── electron-shell/          # Electron 桌面应用壳
│   ├── src/main.ts          # Electron 主进程（自动启动 Flask）
│   ├── forge.config.ts      # Electron Forge 打包配置
│   └── package.json
├── dist/                    # 前端构建输出（git ignored）
├── setup.ps1                # Windows 一键安装脚本
├── setup.sh                 # Linux/macOS 一键安装脚本
├── vite.config.ts           # Vite 配置（含 /api 代理）
└── package.json
```

---

## 页面路由

| 路径 | 说明 |
|---|---|
| `/login` | 登录 / 注册 |
| `/avatars` | 选择数字人形象 |
| `/avatars/create` | 创建数字人形象（含 Link Agent 步骤） |
| `/chat` | 数字人互动页面（文本、语音、唇形同步） |

---

## 环境变量

### 前端（`.env` / `.env.production`）

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_API_BASE_URL` | 数字人后端 API 地址 | `https://sumi-test.sumeruai.com` |

### Flask 服务器（`server/.env`）

| 变量 | 说明 | 默认值 |
|---|---|---|
| `ANIMA_HOST` | 绑定地址 | `0.0.0.0` |
| `ANIMA_PORT` | 监听端口 | `19000` |
| `ANIMA_API_BASE_URL` | 数字人后端 API 地址 | `https://sumi-test.sumeruai.com` |
| `OPENCLAW_API_URL` | OpenClaw API 地址 | （空） |
| `OPENCLAW_TOKEN` | OpenClaw Bearer Token | （空） |
| `OPENCLAW_DEFAULT_AGENT` | 默认 Agent ID | `main` |
| `OPENCLAW_SSH_HOST` | 远程 OpenClaw SSH 连接（如 `agent@10.10.5.24`） | （空=本地） |
| `OPENCLAW_WORKSPACE_BASE` | Agent workspace 基础目录 | `~/.openclaw` |

### Electron（`electron-shell/.env`）

| 变量 | 说明 | 默认值 |
|---|---|---|
| `ANIMA_PORT` | Flask 后端端口 | `19000` |
| `ANIMA_PYTHON` | Python 可执行文件路径 | 自动检测 |
