import { describe, it, expect } from 'vitest';
import { isAuthorizedRequest, isOwner } from '../../worker/src/auth';

describe('isAuthorizedRequest', () => {
  it('returns true when secret header matches', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-telegram-bot-api-secret-token': 'mysecret' },
    });
    expect(isAuthorizedRequest(req, 'mysecret')).toBe(true);
  });

  it('returns false when secret header is missing', () => {
    const req = new Request('https://example.com');
    expect(isAuthorizedRequest(req, 'mysecret')).toBe(false);
  });

  it('returns false when secret header does not match', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
    });
    expect(isAuthorizedRequest(req, 'mysecret')).toBe(false);
  });
});

describe('isOwner', () => {
  it('returns true when user_id matches owner', () => {
    expect(isOwner(123456789, '123456789')).toBe(true);
  });

  it('returns false when user_id does not match', () => {
    expect(isOwner(999, '123456789')).toBe(false);
  });
});
