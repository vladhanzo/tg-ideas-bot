import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMessage, sendChatAction, answerCallbackQuery } from '../../worker/src/telegram';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
});

describe('sendMessage', () => {
  it('calls correct Telegram endpoint', async () => {
    await sendMessage({ token: 'tok', chatId: 123, text: 'Hello' });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bottok/sendMessage');
  });

  it('includes chat_id and text in body', async () => {
    await sendMessage({ token: 'tok', chatId: 123, text: 'Hello' });
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.chat_id).toBe(123);
    expect(body.text).toBe('Hello');
  });

  it('includes inline keyboard when provided', async () => {
    await sendMessage({
      token: 'tok',
      chatId: 123,
      text: 'Hello',
      inlineKeyboard: [[{ text: 'Click', url: 'https://example.com' }]],
    });
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.reply_markup.inline_keyboard[0][0].text).toBe('Click');
  });

  it('includes parse_mode when provided', async () => {
    await sendMessage({ token: 'tok', chatId: 123, text: 'Hello', parseMode: 'Markdown' });
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.parse_mode).toBe('Markdown');
  });
});

describe('sendChatAction', () => {
  it('sends typing action to correct endpoint', async () => {
    await sendChatAction({ token: 'tok', chatId: 123, action: 'typing' });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('sendChatAction');
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.action).toBe('typing');
    expect(body.chat_id).toBe(123);
  });
});

describe('answerCallbackQuery', () => {
  it('calls answerCallbackQuery endpoint with id', async () => {
    await answerCallbackQuery({ token: 'tok', callbackQueryId: 'cq1', text: 'Done' });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('answerCallbackQuery');
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.callback_query_id).toBe('cq1');
    expect(body.text).toBe('Done');
  });

  it('works without optional text', async () => {
    await answerCallbackQuery({ token: 'tok', callbackQueryId: 'cq2' });
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.callback_query_id).toBe('cq2');
    expect(body.text).toBeUndefined();
  });
});
