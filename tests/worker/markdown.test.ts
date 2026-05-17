import { describe, it, expect } from 'vitest';
import { buildNote } from '../../worker/src/markdown';

describe('buildNote', () => {
  it('generates frontmatter with all required fields', () => {
    const note = buildNote({
      text: 'My idea\nMore details here',
      type: 'text',
      messageId: 42,
      createdAt: '2026-05-17T14:32:10+03:00',
    });
    expect(note).toContain('created: 2026-05-17T14:32:10+03:00');
    expect(note).toContain('source: telegram');
    expect(note).toContain('type: text');
    expect(note).toContain('telegram_message_id: 42');
  });

  it('uses first line as title', () => {
    const note = buildNote({
      text: 'My idea\nMore details here',
      type: 'text',
      messageId: 1,
      createdAt: '2026-05-17T14:32:10+03:00',
    });
    expect(note).toContain('# My idea');
  });

  it('includes body when multi-line', () => {
    const note = buildNote({
      text: 'Title\nBody line 1\nBody line 2',
      type: 'text',
      messageId: 1,
      createdAt: '2026-05-17T14:32:10+03:00',
    });
    expect(note).toContain('Body line 1');
    expect(note).toContain('Body line 2');
  });

  it('works for single-line text without body', () => {
    const note = buildNote({
      text: 'Just a title',
      type: 'text',
      messageId: 1,
      createdAt: '2026-05-17T14:32:10+03:00',
    });
    expect(note).toContain('# Just a title');
    expect(note).not.toContain('undefined');
  });

  it('sets type voice correctly', () => {
    const note = buildNote({
      text: 'Transcribed text',
      type: 'voice',
      messageId: 99,
      createdAt: '2026-05-17T14:32:10+03:00',
    });
    expect(note).toContain('type: voice');
  });

  it('wraps content with --- delimiters', () => {
    const note = buildNote({
      text: 'Test',
      type: 'text',
      messageId: 1,
      createdAt: '2026-05-17T14:32:10+03:00',
    });
    expect(note.startsWith('---')).toBe(true);
    expect(note).toContain('\n---\n');
  });

  it('adds link to parent note when linkedTo is set', () => {
    const note = buildNote({
      text: 'Дополнение',
      type: 'text',
      messageId: 2,
      createdAt: '2026-05-17T14:32:10+03:00',
      linkedTo: '2026-05-18_0019_ya-vlad',
    });
    expect(note).toContain('[[2026-05-18_0019_ya-vlad]]');
  });

  it('does not add link when linkedTo is absent', () => {
    const note = buildNote({
      text: 'Обычная идея',
      type: 'text',
      messageId: 3,
      createdAt: '2026-05-17T14:32:10+03:00',
    });
    expect(note).not.toContain('[[');
  });
});
