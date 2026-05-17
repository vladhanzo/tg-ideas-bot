export function isAuthorizedRequest(req: Request, expectedSecret: string): boolean {
  const header = req.headers.get('x-telegram-bot-api-secret-token');
  return header === expectedSecret;
}

export function isOwner(userId: number, ownerId: string): boolean {
  return String(userId) === ownerId;
}
