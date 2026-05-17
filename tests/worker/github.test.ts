import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFile, fileExists, getFileSha, deleteFile, dispatchVoiceEvent, getRecentCommits, listInboxFiles } from '../../worker/src/github';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => mockFetch.mockReset());

describe('createFile', () => {
  it('returns html_url and sha on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: { html_url: 'https://github.com/owner/repo/blob/main/Inbox/test.md' },
        commit: { sha: 'abc123' },
      }),
    });
    const result = await createFile({
      token: 'tok',
      repo: 'owner/repo',
      path: 'Inbox/test.md',
      content: 'hello',
      message: 'idea: test',
    });
    expect(result.html_url).toBe('https://github.com/owner/repo/blob/main/Inbox/test.md');
    expect(result.sha).toBe('abc123');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 422 });
    await expect(
      createFile({ token: 'tok', repo: 'owner/repo', path: 'x.md', content: 'y', message: 'm' }),
    ).rejects.toThrow('GitHub API error: 422');
  });
});

describe('fileExists', () => {
  it('returns true when file found', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ sha: 'abc' }) });
    expect(await fileExists({ token: 'tok', repo: 'owner/repo', path: 'x.md' })).toBe(true);
  });

  it('returns false on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    expect(await fileExists({ token: 'tok', repo: 'owner/repo', path: 'x.md' })).toBe(false);
  });
});

describe('getFileSha', () => {
  it('returns sha when file exists', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ sha: 'mysha' }) });
    expect(await getFileSha({ token: 'tok', repo: 'owner/repo', path: 'x.md' })).toBe('mysha');
  });

  it('returns null when file not found', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    expect(await getFileSha({ token: 'tok', repo: 'owner/repo', path: 'x.md' })).toBeNull();
  });
});

describe('deleteFile', () => {
  it('calls DELETE endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    await deleteFile({ token: 'tok', repo: 'owner/repo', path: 'x.md', sha: 'sha1', message: 'remove: x' });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/contents/x.md');
    expect(opts.method).toBe('DELETE');
  });
});

describe('dispatchVoiceEvent', () => {
  it('sends repository_dispatch with correct payload', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    await dispatchVoiceEvent({
      token: 'tok',
      repo: 'owner/repo',
      voiceFileId: 'voice_abc',
      chatId: 123,
      messageId: 456,
      userTimestamp: '2026-05-17T14:32:10+03:00',
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/dispatches');
    const body = JSON.parse(opts.body as string);
    expect(body.event_type).toBe('voice_message');
    expect(body.client_payload.voice_file_id).toBe('voice_abc');
  });
});

describe('listInboxFiles', () => {
  it('returns files sorted newest first, filtered to .md', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { name: '2026-05-18_0100_idea-b.md', path: 'Inbox/2026-05-18_0100_idea-b.md', html_url: 'https://gh/b', type: 'file' },
        { name: '.gitkeep', path: 'Inbox/.gitkeep', html_url: 'https://gh/k', type: 'file' },
        { name: '2026-05-17_0900_idea-a.md', path: 'Inbox/2026-05-17_0900_idea-a.md', html_url: 'https://gh/a', type: 'file' },
      ],
    });
    const result = await listInboxFiles({ token: 'tok', repo: 'owner/repo', count: 5 });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('2026-05-18_0100_idea-b.md');
    expect(result[1].name).toBe('2026-05-17_0900_idea-a.md');
  });

  it('returns empty array on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    expect(await listInboxFiles({ token: 'tok', repo: 'owner/repo', count: 5 })).toEqual([]);
  });
});

describe('getRecentCommits', () => {
  it('returns count of commits', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{}, {}, {}] });
    const count = await getRecentCommits({ token: 'tok', repo: 'owner/repo', path: 'Inbox/', since: '2026-01-01T00:00:00Z' });
    expect(count).toBe(3);
  });

  it('returns 0 on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const count = await getRecentCommits({ token: 'tok', repo: 'owner/repo', path: 'Inbox/', since: '2026-01-01T00:00:00Z' });
    expect(count).toBe(0);
  });
});
