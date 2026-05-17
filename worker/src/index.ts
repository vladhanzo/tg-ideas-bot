import { Hono } from 'hono';

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  OWNER_TELEGRAM_ID: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string; // "owner/repo"
}

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.text('OK'));

export default app;
