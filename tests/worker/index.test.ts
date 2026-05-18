import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../worker/src/github', () => ({
  createFile: vi.fn().mockResolvedValue({ html_url: 'https://github.com/o/r/blob/main/raw/x.md', sha: 'abc' }),
  fileExists: vi.fn().mockResolvedValue(false),
  getFileSha: vi.fn().mockResolvedValue('sha123'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  dispatchVoiceEvent: vi.fn().mockResolvedValue(undefined),
  getRecentCommits: vi.fn().mockResolvedValue(5),
  listRawFiles: vi.fn().mockResolvedValue([
    { name: '2026-05-18_0019_ya-vlad.md', path: 'raw/2026-05-18_0019_ya-vlad.md', html_url: 'https://gh/1' },
  ]),
}));
vi.mock('../../worker/src/telegram', () => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
  sendChatAction: vi.fn().mockResolvedValue(undefined),
  answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
}));

import app from '../../worker/src/index';
import { sendMessage } from '../../worker/src/telegram';
import { createFile, dispatchVoiceEvent, deleteFile, getFileSha, listRawFiles } from '../../worker/src/github';

const ENV = {
  TELEGRAM_BOT_TOKEN: 'testtoken',
  TELEGRAM_WEBHOOK_SECRET: 'testsecret',
  OWNER_TELEGRAM_ID: '123456',
  GITHUB_TOKEN: 'ghtoken',
  GITHUB_REPO: 'owner/vault',
  GITHUB_BOT_REPO: 'owner/bot',
};

function makeWebhookRequest(body: object, secret = 'testsecret') {
  return new Request('https://worker.dev/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secret,
    },
    body: JSON.stringify(body),
  });
}

const baseMsg = {
  message_id: 10,
  from: { id: 123456, first_name: 'Vlad' },
  chat: { id: 123456 },
  date: 1747479130,
};

const textUpdate = {
  update_id: 1,
  message: { ...baseMsg, text: 'My great idea' },
};

beforeEach(() => vi.clearAllMocks());

describe('POST /webhook', () => {
  it('returns 403 when secret is wrong', async () => {
    const res = await app.fetch(makeWebhookRequest(textUpdate, 'wrong'), ENV);
    expect(res.status).toBe(403);
  });

  it('saves note and replies ✅ for text from owner', async () => {
    const res = await app.fetch(makeWebhookRequest(textUpdate), ENV);
    expect(res.status).toBe(200);
    expect(createFile).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledOnce();
    const callArgs = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.text).toContain('✅');
  });

  it('denies non-owner with Access denied message', async () => {
    const foreignUpdate = {
      ...textUpdate,
      message: { ...baseMsg, from: { id: 999, first_name: 'Other' }, text: 'hack' },
    };
    await app.fetch(makeWebhookRequest(foreignUpdate), ENV);
    expect(createFile).not.toHaveBeenCalled();
    const callArgs = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.text).toContain('Access denied');
  });

  it('replies with unsupported message for photo', async () => {
    const photoUpdate = {
      update_id: 2,
      message: { ...baseMsg, photo: [{ file_id: 'abc' }] },
    };
    await app.fetch(makeWebhookRequest(photoUpdate), ENV);
    expect(createFile).not.toHaveBeenCalled();
    const callArgs = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.text).toContain('текст и голос');
  });

  it('dispatches voice event and replies Распознаю for voice', async () => {
    const voiceUpdate = {
      update_id: 3,
      message: { ...baseMsg, voice: { file_id: 'voice_abc', duration: 10 } },
    };
    await app.fetch(makeWebhookRequest(voiceUpdate), ENV);
    expect(dispatchVoiceEvent).toHaveBeenCalledOnce();
    const callArgs = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.text).toContain('Распознаю');
  });

  it('handles /start command', async () => {
    const startUpdate = { update_id: 4, message: { ...baseMsg, text: '/start' } };
    await app.fetch(makeWebhookRequest(startUpdate), ENV);
    expect(createFile).not.toHaveBeenCalled();
    const callArgs = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.text).toContain('/status');
  });

  it('handles /list command and shows inline keyboard', async () => {
    const listUpdate = { update_id: 5, message: { ...baseMsg, text: '/list' } };
    await app.fetch(makeWebhookRequest(listUpdate), ENV);
    expect(listRawFiles).toHaveBeenCalledOnce();
    const callArgs = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.inlineKeyboard).toBeDefined();
    expect(callArgs.inlineKeyboard[0][0].text).toContain('ya-vlad');
  });

  it('handles /status command', async () => {
    const statusUpdate = { update_id: 5, message: { ...baseMsg, text: '/status' } };
    await app.fetch(makeWebhookRequest(statusUpdate), ENV);
    const callArgs = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.text).toContain('5');
  });

  it('links to parent note when replying to bot message', async () => {
    const replyUpdate = {
      update_id: 7,
      message: {
        ...baseMsg,
        text: 'дополнение к идее',
        reply_to_message: { text: '✅ Сохранено: `2026-05-18_0019_ya-vlad.md`' },
      },
    };
    await app.fetch(makeWebhookRequest(replyUpdate), ENV);
    expect(createFile).toHaveBeenCalledOnce();
    const content = (createFile as ReturnType<typeof vi.fn>).mock.calls[0][0].content;
    expect(content).toContain('[[2026-05-18_0019_ya-vlad]]');
  });

  it('handles delete callback query', async () => {
    const cbUpdate = {
      update_id: 6,
      callback_query: {
        id: 'cq1',
        from: { id: 123456 },
        data: 'delete:raw/test.md',
      },
    };
    await app.fetch(makeWebhookRequest(cbUpdate), ENV);
    expect(getFileSha).toHaveBeenCalled();
    expect(deleteFile).toHaveBeenCalled();
  });
});
