import { Hono } from 'hono';
import { isAuthorizedRequest, isOwner } from './auth';
import { buildFilename, toSlug } from './slug';
import { buildNote } from './markdown';
import { createFile, fileExists, getFileSha, deleteFile, dispatchVoiceEvent, getRecentCommits, listRawFiles } from './github';
import { sendMessage, sendChatAction, answerCallbackQuery } from './telegram';

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  OWNER_TELEGRAM_ID: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_BOT_REPO: string;
}

interface TelegramMessage {
  message_id: number;
  from: { id: number; first_name: string };
  chat: { id: number };
  text?: string;
  voice?: { file_id: string; duration: number };
  date: number;
  reply_to_message?: { text?: string };
}

interface TelegramCallbackQuery {
  id: string;
  from: { id: number };
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

function moscowIso(unixTs: number): string {
  const d = new Date(unixTs * 1000);
  const offset = 3 * 60;
  const local = new Date(d.getTime() + offset * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T` +
    `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}+03:00`
  );
}

async function uniquePath(basePath: string, token: string, repo: string): Promise<string> {
  let path = basePath;
  let suffix = 2;
  while (await fileExists({ token, repo, path })) {
    path = basePath.replace('.md', `_${suffix}.md`);
    suffix++;
  }
  return path;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.text('OK'));

app.post('/webhook', async (c) => {
  const env = c.env;

  if (!isAuthorizedRequest(c.req.raw, env.TELEGRAM_WEBHOOK_SECRET)) {
    return c.text('Forbidden', 403);
  }

  const update: TelegramUpdate = await c.req.json();

  // Callback query (delete button)
  if (update.callback_query) {
    const cq = update.callback_query;
    if (!isOwner(cq.from.id, env.OWNER_TELEGRAM_ID)) {
      await answerCallbackQuery({ token: env.TELEGRAM_BOT_TOKEN, callbackQueryId: cq.id, text: 'Access denied' });
      return c.json({ ok: true });
    }
    if (cq.data?.startsWith('delete:')) {
      const path = cq.data.slice('delete:'.length);
      if (!path.startsWith('raw/') || path.includes('..')) {
        await answerCallbackQuery({ token: env.TELEGRAM_BOT_TOKEN, callbackQueryId: cq.id, text: 'Недопустимый путь' });
        return c.json({ ok: true });
      }
      const sha = await getFileSha({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, path });
      if (sha) {
        await deleteFile({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, path, sha, message: `remove: ${path}` });
        await answerCallbackQuery({ token: env.TELEGRAM_BOT_TOKEN, callbackQueryId: cq.id, text: '🗑️ Удалено' });
      } else {
        await answerCallbackQuery({ token: env.TELEGRAM_BOT_TOKEN, callbackQueryId: cq.id, text: 'Файл не найден' });
      }
    }
    return c.json({ ok: true });
  }

  const msg = update.message;
  if (!msg) return c.json({ ok: true });

  const chatId = msg.chat.id;
  const token = env.TELEGRAM_BOT_TOKEN;

  if (!isOwner(msg.from.id, env.OWNER_TELEGRAM_ID)) {
    await sendMessage({ token, chatId, text: 'Access denied' });
    return c.json({ ok: true });
  }

  // /start
  if (msg.text === '/start') {
    await sendMessage({ token, chatId, text: '👋 Отправь текст или голосовое — сохраню в Obsidian.\n\n/status — статистика' });
    return c.json({ ok: true });
  }

  // /list
  if (msg.text === '/list') {
    const files = await listRawFiles({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, count: 5 });
    if (files.length === 0) {
      await sendMessage({ token, chatId, text: '📭 Нет идей' });
    } else {
      await sendMessage({
        token,
        chatId,
        text: `📋 Последние ${files.length} идей:`,
        inlineKeyboard: files.map((f) => [
          { text: f.name.replace('.md', ''), url: f.html_url },
          { text: '❌', callback_data: `delete:${f.path}` },
        ]),
      });
    }
    return c.json({ ok: true });
  }

  // /status
  if (msg.text === '/status') {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const count = await getRecentCommits({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, path: 'raw/', since });
    await sendMessage({ token, chatId, text: `📊 Идей за 30 дней: ${count}` });
    return c.json({ ok: true });
  }

  // Text message
  if (msg.text) {
    try {
      const ts = moscowIso(msg.date);
      const basePath = buildFilename(msg.text, new Date(msg.date * 1000));
      const path = await uniquePath(basePath, env.GITHUB_TOKEN, env.GITHUB_REPO);
      const linkedTo = msg.reply_to_message?.text?.match(/`([^`]+)\.md`/)?.[1];
      const content = buildNote({ text: msg.text, type: 'text', messageId: msg.message_id, createdAt: ts, linkedTo });
      const slug = toSlug(msg.text);
      const { html_url } = await createFile({
        token: env.GITHUB_TOKEN,
        repo: env.GITHUB_REPO,
        path,
        content,
        message: `idea: ${slug}`,
      });
      await sendMessage({
        token,
        chatId,
        text: `✅ Сохранено: \`${path.split('/').pop()}\``,
        parseMode: 'Markdown',
        inlineKeyboard: [
          [
            { text: '🔗 GitHub', url: html_url },
            { text: '❌ Удалить', callback_data: `delete:${path}` },
          ],
        ],
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await sendMessage({ token, chatId, text: `⚠️ Ошибка сохранения: ${reason}` });
      return c.text('Internal Server Error', 500);
    }
    return c.json({ ok: true });
  }

  // Voice message
  if (msg.voice) {
    await sendChatAction({ token, chatId, action: 'typing' });
    await sendMessage({ token, chatId, text: '🎙️ Распознаю…' });
    try {
      await dispatchVoiceEvent({
        token: env.GITHUB_TOKEN,
        repo: env.GITHUB_BOT_REPO,
        voiceFileId: msg.voice.file_id,
        chatId,
        messageId: msg.message_id,
        userTimestamp: moscowIso(msg.date),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await sendMessage({ token, chatId, text: `⚠️ Не удалось запустить транскрипцию: ${reason}` });
      return c.text('Internal Server Error', 500);
    }
    return c.json({ ok: true });
  }

  // Unsupported
  await sendMessage({ token, chatId, text: 'Поддерживается только текст и голос' });
  return c.json({ ok: true });
});

export default app;
