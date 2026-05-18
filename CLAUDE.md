# Проект: Idea Bot — Telegram → Obsidian

## Что это

Личный Telegram-бот для быстрой записи идей в Obsidian без сервера и без абонплаты.

- Отправляю **текст** → за <2 сек появляется `.md` в папке `Inbox/` Obsidian-vault
- Отправляю **голосовое** → GitHub Actions транскрибирует через faster-whisper (~2 мин) и тоже кладёт в `Inbox/`
- **Reply на сообщение бота** → новая заметка получает ссылку `[[parent]]` на исходную идею
- Бот отвечает ссылкой на файл и кнопкой «❌ Удалить»

## Стек

| Слой | Технология |
|---|---|
| Webhook | Cloudflare Worker (TypeScript + Hono) — `idea-bot.vladhanzo.workers.dev` |
| Транскрипция | GitHub Actions (Python 3.11 + faster-whisper small) |
| Хранилище | Приватный GitHub-репо `vladhanzo/obsidian-vault` |
| Синхронизация | Плагин Obsidian Git (auto-pull каждые 5 мин, merge strategy) |

## Репозитории

| Репо | Назначение |
|---|---|
| `vladhanzo/tg-ideas-bot` | Публичный — код Worker'а, Python action, тесты |
| `vladhanzo/obsidian-vault` | Приватный — vault с заметками, папки Inbox/Develop/Projects/Archive |

## Структура репо (tg-ideas-bot)

```
TG+obsidian/               ← корень проекта
├── worker/
│   ├── src/
│   │   ├── index.ts       ← Hono app, /webhook endpoint (главный файл)
│   │   ├── auth.ts        ← isAuthorizedRequest + isOwner
│   │   ├── slug.ts        ← toSlug (кириллица→латиница) + buildFilename (UTC+3)
│   │   ├── markdown.ts    ← buildNote (YAML frontmatter + тело + linkedTo)
│   │   ├── github.ts      ← createFile, fileExists, getFileSha, deleteFile,
│   │   │                     dispatchVoiceEvent, getRecentCommits, listInboxFiles
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
│   ├── worker/            ← vitest тесты (50 тестов, все зелёные)
│   └── action/            ← pytest тесты (14 тестов, все зелёные)
└── CLAUDE.md              ← этот файл
```

## Статус — всё задеплоено и работает

| Задача | Статус |
|---|---|
| Worker + все модули (TS) | ✅ |
| Python action (transcribe, write_note, notify) | ✅ |
| GitHub Actions workflow | ✅ |
| **Деплой на Cloudflare Workers** | ✅ `idea-bot.vladhanzo.workers.dev` |
| **GitHub-репо для vault** | ✅ `vladhanzo/obsidian-vault` |
| **Регистрация Telegram webhook** | ✅ |
| **GitHub Actions секреты** | ✅ |
| **Obsidian Git на ПК** | ✅ auto-pull 5 мин, merge |
| Reply → ссылка на parent-заметку | ✅ |
| /list — последние 5 идей | ✅ |
| Фикс: voice dispatch в правильный репо | ✅ |
| Фикс: path validation в delete | ✅ |

## Cloudflare Worker — секреты

| Секрет | Значение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `TELEGRAM_WEBHOOK_SECRET` | 64-символьный hex |
| `OWNER_TELEGRAM_ID` | `317911286` |
| `GITHUB_TOKEN` | fine-grained PAT (idea-bot) |
| `GITHUB_REPO` | `vladhanzo/obsidian-vault` |
| `GITHUB_BOT_REPO` | `vladhanzo/tg-ideas-bot` |

## GitHub Actions секреты (tg-ideas-bot)

| Секрет | Значение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `VAULT_REPO` | `vladhanzo/obsidian-vault` |
| `VAULT_REPO_TOKEN` | fine-grained PAT |

## Vault — структура папок

```
obsidian-vault/
├── Inbox/      ← идеи падают сюда из бота (не трогать вручную)
├── Develop/    ← развиваешь лучшие идеи, добавляешь контекст
├── Projects/   ← активные проекты с планом (есть шаблон)
├── Archive/    ← сделанное или отпавшее
└── README.md   ← описание системы + еженедельный ритуал
```

## Запуск тестов

```bash
# TypeScript (из папки worker/)
cd worker && npx vitest run

# Python (из корня)
python -m pytest tests/action/ -v
```

## Деплой изменений

```bash
cd worker
wrangler deploy
```

## Ключевые технические решения

| Вопрос | Решение |
|---|---|
| Timezone | UTC+3 (Москва) для имён файлов и `created:` в frontmatter |
| Slug | Кириллица транслитерируется словарём (TS) / python-slugify+Unidecode (Python) |
| Коллизии имён | `uniquePath`: добавляет `_2`, `_3` если файл уже существует |
| Голос → Action | `repository_dispatch` в `GITHUB_BOT_REPO` (не vault!) с payload voice |
| Whisper модель | `faster-whisper small` (460 MB), кешируется в `~/.cache/huggingface` |
| Кнопка «Удалить» | `DELETE /repos/.../contents/{path}` — только `Inbox/`, нет `..` |
| Reply → link | `reply_to_message.text` парсит имя файла → `[[parent]]` в новой заметке |
| Obsidian sync | merge strategy — не падает на unstaged changes |

## Команды бота

| Команда | Действие |
|---|---|
| Любой текст | Сохранить как заметку в Inbox/ |
| Reply на сообщение бота | Сохранить с ссылкой `[[parent]]` |
| Голосовое | Запустить транскрипцию (GitHub Actions) |
| `/start` | Приветствие |
| `/status` | Количество идей за 30 дней |
| `/list` | Последние 5 идей из Inbox с кнопками |
| Кнопка ❌ Удалить | Удалить файл из vault (через callback_query) |
