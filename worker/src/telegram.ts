type InlineKeyboardButton =
  | { text: string; url: string }
  | { text: string; callback_data: string };

interface SendMessageArgs {
  token: string;
  chatId: number;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  inlineKeyboard?: InlineKeyboardButton[][];
}

interface SendChatActionArgs {
  token: string;
  chatId: number;
  action: 'typing' | 'upload_document';
}

interface AnswerCallbackArgs {
  token: string;
  callbackQueryId: string;
  text?: string;
}

function tgUrl(token: string, method: string): string {
  return `https://api.telegram.org/bot${token}/${method}`;
}

export async function sendMessage(args: SendMessageArgs): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: args.chatId,
    text: args.text,
  };
  if (args.parseMode) body.parse_mode = args.parseMode;
  if (args.inlineKeyboard) {
    body.reply_markup = { inline_keyboard: args.inlineKeyboard };
  }
  await fetch(tgUrl(args.token, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function sendChatAction(args: SendChatActionArgs): Promise<void> {
  await fetch(tgUrl(args.token, 'sendChatAction'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: args.chatId, action: args.action }),
  });
}

export async function answerCallbackQuery(args: AnswerCallbackArgs): Promise<void> {
  const body: Record<string, unknown> = { callback_query_id: args.callbackQueryId };
  if (args.text) body.text = args.text;
  await fetch(tgUrl(args.token, 'answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
