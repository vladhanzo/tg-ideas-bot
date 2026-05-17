interface CreateFileArgs {
  token: string;
  repo: string;
  path: string;
  content: string;
  message: string;
  sha?: string;
}

interface RepoPathArgs {
  token: string;
  repo: string;
  path: string;
}

interface DispatchVoiceArgs {
  token: string;
  repo: string;
  voiceFileId: string;
  chatId: number;
  messageId: number;
  userTimestamp: string;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'idea-bot/1.0',
    Accept: 'application/vnd.github+json',
  };
}

function encodeContent(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

export async function createFile(args: CreateFileArgs): Promise<{ html_url: string; sha: string }> {
  const body: Record<string, unknown> = {
    message: args.message,
    content: encodeContent(args.content),
  };
  if (args.sha) body.sha = args.sha;

  const res = await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`, {
    method: 'PUT',
    headers: githubHeaders(args.token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json<{ content: { html_url: string }; commit: { sha: string } }>();
  return { html_url: data.content.html_url, sha: data.commit.sha };
}

export async function fileExists(args: RepoPathArgs): Promise<boolean> {
  const res = await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`, {
    headers: githubHeaders(args.token),
  });
  return res.ok;
}

export async function getFileSha(args: RepoPathArgs): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`, {
    headers: githubHeaders(args.token),
  });
  if (!res.ok) return null;
  const data = await res.json<{ sha: string }>();
  return data.sha;
}

export async function deleteFile(args: {
  token: string;
  repo: string;
  path: string;
  sha: string;
  message: string;
}): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`, {
    method: 'DELETE',
    headers: githubHeaders(args.token),
    body: JSON.stringify({ message: args.message, sha: args.sha }),
  });
  if (!res.ok) throw new Error(`GitHub delete error: ${res.status}`);
}

export async function dispatchVoiceEvent(args: DispatchVoiceArgs): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${args.repo}/dispatches`, {
    method: 'POST',
    headers: githubHeaders(args.token),
    body: JSON.stringify({
      event_type: 'voice_message',
      client_payload: {
        voice_file_id: args.voiceFileId,
        chat_id: args.chatId,
        message_id: args.messageId,
        user_timestamp: args.userTimestamp,
      },
    }),
  });
  if (!res.ok) throw new Error(`GitHub dispatch error: ${res.status}`);
}

export async function getRecentCommits(args: {
  token: string;
  repo: string;
  path: string;
  since: string;
}): Promise<number> {
  const url = `https://api.github.com/repos/${args.repo}/commits?path=${encodeURIComponent(args.path)}&since=${args.since}&per_page=100`;
  const res = await fetch(url, { headers: githubHeaders(args.token) });
  if (!res.ok) return 0;
  const data = await res.json<unknown[]>();
  return data.length;
}
