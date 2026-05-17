interface NoteOptions {
  text: string;
  type: 'text' | 'voice';
  messageId: number;
  createdAt: string;
  linkedTo?: string;
}

export function buildNote(opts: NoteOptions): string {
  const lines = opts.text.trim().split('\n');
  const title = lines[0];
  const body = lines.slice(1).join('\n').trim();

  const frontmatter = [
    '---',
    `created: ${opts.createdAt}`,
    'source: telegram',
    `type: ${opts.type}`,
    `telegram_message_id: ${opts.messageId}`,
    '---',
  ].join('\n');

  const link = opts.linkedTo ? `\n\n> дополнение к [[${opts.linkedTo}]]` : '';

  return body
    ? `${frontmatter}\n\n# ${title}\n\n${body}${link}`
    : `${frontmatter}\n\n# ${title}${link}`;
}
