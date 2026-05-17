# Idea Bot — Telegram → Obsidian (serverless, free)

Personal Telegram bot that saves text ideas to Obsidian via GitHub in <2s, and transcribes voice notes via GitHub Actions + faster-whisper.

## Architecture

```
Telegram → Cloudflare Worker (TypeScript/Hono)
              ├── text → GitHub Contents API → vault/Inbox/*.md
              └── voice → repository_dispatch → GitHub Actions → faster-whisper → vault/Inbox/*.md → Telegram
```

- **Cloudflare Worker** — receives webhooks, saves text notes, triggers voice pipeline
- **GitHub Actions** — transcribes voice, commits .md to vault repo, notifies user
- **Vault repo** (private GitHub) — Obsidian vault, synced via Obsidian Git plugin

## Setup

### 1. Prerequisites

Create two GitHub repos:
- `obsidian-vault` (private) — your vault, add `Inbox/.gitkeep`
- `tg-ideas-bot` (public) — this repo for bot code

Generate a [fine-grained PAT](https://github.com/settings/personal-access-tokens/new):
- `Contents: Read+Write` on vault repo
- `Actions: Write` on bot repo
- `Metadata: Read` on both

Create Telegram bot via [@BotFather](https://t.me/BotFather), set `/setprivacy` → Disable.
Get your Telegram user ID via [@userinfobot](https://t.me/userinfobot).

### 2. Deploy Cloudflare Worker

```bash
npm install -g wrangler
wrangler login

cd worker
npm install
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET   # openssl rand -hex 32
wrangler secret put OWNER_TELEGRAM_ID         # your numeric Telegram user ID
wrangler secret put GITHUB_TOKEN              # fine-grained PAT
wrangler secret put GITHUB_REPO               # owner/obsidian-vault
wrangler deploy
```

### 3. Register Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<worker-subdomain>.workers.dev/webhook",
    "secret_token": "<WEBHOOK_SECRET>",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Expected: `{"ok":true,"result":true}`

### 4. Set GitHub Actions Secrets

In `tg-ideas-bot` repo → Settings → Secrets → Actions:

| Secret | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Your bot token |
| `VAULT_REPO` | `owner/obsidian-vault` |
| `VAULT_REPO_TOKEN` | PAT with Contents write on vault repo |

### 5. Obsidian Sync

Install [Obsidian Git](https://github.com/Vinzent03/obsidian-git) plugin, configure it to use `obsidian-vault` repo. Enable auto-pull.

## Usage

| Action | Result |
|---|---|
| Send any text | Note saved in `Inbox/` within 2s |
| Send voice | "🎙️ Распознаю…" → transcription committed within ~2 min |
| `/start` | Welcome message |
| `/status` | Ideas count for last 30 days |
| Tap `❌ Удалить` | Note deleted from vault (git history preserved) |

## Running Tests

```bash
# Worker (TypeScript)
cd worker && npx vitest run ../tests/worker/

# Action (Python)
pip install "python-slugify[unidecode]" requests
python -m pytest tests/action/ -v
```

## Free Tier Limits

| Service | Limit | Usage | Buffer |
|---|---|---|---|
| Cloudflare Workers | 100k req/day | ~50/day | 2000× |
| GitHub Actions (public repo) | Unlimited | ~10 voice/day | ✅ |
| GitHub API | 5000 req/hour | ~50/day | 100× |
| Telegram Bot API | 30 msg/sec | 1 msg/min | ✅ |
