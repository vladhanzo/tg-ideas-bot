# Проект: Idea Bot — Telegram → Obsidian

## Что это

Личный Telegram-бот для быстрой записи идей в Obsidian без сервера и без абонплаты.

- Отправляю **текст** → за <2 сек появляется `.md` в папке `Inbox/` Obsidian-vault
- Отправляю **голосовое** → GitHub Actions транскрибирует через faster-whisper (~2 мин) и тоже кладёт в `Inbox/`
- Бот отвечает ссылкой на файл и кнопкой «❌ Удалить»

## Стек

| Слой | Технология |
|---|---|
| Webhook | Cloudflare Worker (TypeScript + Hono) |
| Транскрипция | GitHub Actions (Python 3.11 + faster-whisper small) |
| Хранилище | Приватный GitHub-репо (vault) = Obsidian vault |
| Синхронизация | Плагин Obsidian Git делает pull на устройствах |

## Структура репо

```
TG+obsidian/               ← корень проекта (этот репо, публичный)
├── worker/
│   ├── src/
│   │   ├── index.ts       ← Hono app, /webhook endpoint (главный файл)
│   │   ├── auth.ts        ← isAuthorizedRequest + isOwner
│   │   ├── slug.ts        ← toSlug (кириллица→латиница) + buildFilename (UTC+3)
│   │   ├── markdown.ts    ← buildNote (YAML frontmatter + тело)
│   │   ├── github.ts      ← createFile, fileExists, getFileSha, deleteFile,
│   │   │                     dispatchVoiceEvent, getRecentCommits
│   │   └── telegram.ts    ← sendMessage, sendChatAction, answerCallbackQuery
│   ├── vitest.config.ts   ← указывает на ../tests/worker/
│   ├── wrangler.toml      ← Cloudflare Worker config (name=idea-bot)
│   └── package.json       ← hono, vitest, @cloudflare/workers-types
├── action/
│   ├── transcribe.py      ← точка входа GitHub Actions: скачать аудио → whisper → notify
│   ├── write_note.py      ← make_slug, build_filename, build_note, find_unique_path
│   ├── notify.py          ← send_message, send_message_with_keyboard (Telegram)
│   └── requirements.txt   ← faster-whisper==1.1.1, python-slugify, requests
├── .github/workflows/
│   └── transcribe.yml     ← запускается по repository_dispatch(voice_message)
├── tests/
│   ├── worker/            ← vitest тесты (44 теста, все зелёные)
│   └── action/            ← pytest тесты (14 тестов, все зелёные)
├── tasks/
│   ├── prd-idea-bot.md    ← полный PRD (требования, архитектура, решения)
│   └── docs/superpowers/plans/2026-05-17-idea-bot.md ← детальный план реализации
├── README.md              ← инструкция по деплою
└── CLAUDE.md              ← этот файл
```

## Статус реализации

**Код полностью написан и протестирован. Деплой ещё не выполнялся.**

| Задача | Статус |
|---|---|
| Worker scaffold (package.json, tsconfig, wrangler.toml) | ✅ |
| auth.ts — webhook secret + owner ID | ✅ |
| slug.ts — транслитерация, kebab-case, Moscow UTC+3 | ✅ |
| markdown.ts — YAML frontmatter + заголовок + тело | ✅ |
| github.ts — Contents API, dispatch, commits | ✅ |
| telegram.ts — sendMessage, sendChatAction, answerCallback | ✅ |
| index.ts — полный Hono webhook handler | ✅ |
| write_note.py + notify.py | ✅ |
| transcribe.py — faster-whisper pipeline | ✅ |
| transcribe.yml — GitHub Actions workflow | ✅ |
| README.md | ✅ |
| **Деплой на Cloudflare Workers** | ❌ не сделан |
| **Создание GitHub-репо для vault** | ❌ не сделан |
| **Регистрация Telegram webhook** | ❌ не сделан |

## Что нужно сделать перед запуском

1. **Создать приватный GitHub-репо** `obsidian-vault` (или другое имя) с папкой `Inbox/.gitkeep`
2. **Создать fine-grained PAT** на GitHub:
   - `Contents: Read+Write` на vault-репо
   - `Actions: Write` на этом репо
   - `Metadata: Read` на оба
3. **Получить токен Telegram-бота** через @BotFather (`/setprivacy` → Disable)
4. **Узнать свой Telegram user ID** через @userinfobot
5. **Установить wrangler** (`npm i -g wrangler && wrangler login`)
6. **Задеплоить Worker:**
   ```bash
   cd worker
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put TELEGRAM_WEBHOOK_SECRET   # openssl rand -hex 32
   wrangler secret put OWNER_TELEGRAM_ID
   wrangler secret put GITHUB_TOKEN
   wrangler secret put GITHUB_REPO               # owner/obsidian-vault
   wrangler deploy
   ```
7. **Зарегистрировать webhook:**
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://idea-bot.<subdomain>.workers.dev/webhook","secret_token":"<SECRET>","allowed_updates":["message","callback_query"]}'
   ```
8. **Добавить секреты в GitHub Actions** (Settings → Secrets → Actions):
   - `TELEGRAM_BOT_TOKEN`
   - `VAULT_REPO` (owner/obsidian-vault)
   - `VAULT_REPO_TOKEN` (PAT с Contents write на vault-репо)

## Запуск тестов

```bash
# TypeScript (из папки worker/)
cd worker && npx vitest run

# Python (из корня)
python -m pytest tests/action/ -v
```

## Ключевые технические решения

| Вопрос | Решение |
|---|---|
| Timezone | UTC+3 (Москва) для имён файлов и `created:` в frontmatter |
| Slug | Кирилица транслитерируется словарём (TS) / python-slugify+Unidecode (Python) |
| Коллизии имён | `uniquePath`: добавляет `_2`, `_3` если файл уже существует |
| Голос → Action | `repository_dispatch` с payload `{voice_file_id, chat_id, message_id, user_timestamp}` |
| Whisper модель | `faster-whisper small` (460 MB), кешируется в `~/.cache/huggingface` |
| Кнопка «Удалить» | `DELETE /repos/.../contents/{path}` — отдельный коммит, история сохраняется |
| Ошибки GitHub API | try/catch → пользователь получает `⚠️ Ошибка:` + HTTP 500 (Telegram повторит webhook) |

## Команды бота

| Команда | Действие |
|---|---|
| Любой текст | Сохранить как заметку в Inbox/ |
| Голосовое | Запустить транскрипцию (GitHub Actions) |
| `/start` | Приветствие |
| `/status` | Количество идей за 30 дней |
| Кнопка ❌ Удалить | Удалить файл из vault (через callback_query) |
