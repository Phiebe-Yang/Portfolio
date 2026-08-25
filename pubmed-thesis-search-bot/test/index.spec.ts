import { describe, it, expect } from 'vitest';
import worker from '../src/index';

describe('Worker fetch handler', () => {
  it('returns 404 for unknown routes', async () => {
    const mockEnv = {
      CHAT_STATE: {
        idFromName: () => ({ toString: () => 'chat-id' }),
        get: () => ({ fetch: async () => new Response('mock') }),
      },
      ASSETS: { fetch: async () => new Response('assets') },
      BROWSER: {},
      AI: { autorag: () => ({ aiSearch: async () => '' }), run: async () => ({}) },
    } as any;

    const request = new Request('http://example.com/unknown');
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as any;
    const response = await worker.fetch(request, mockEnv, ctx);
    expect(response.status).toBe(404);
  });

  it('serves pubmed demo page on /pubmed route', async () => {
    const mockEnv = {
      CHAT_STATE: { idFromName: () => ({ toString: () => 'chat-id' }), get: () => ({}) },
      ASSETS: { fetch: async () => new Response('assets') },
      BROWSER: {},
      AI: { autorag: () => ({ aiSearch: async () => '' }), run: async () => ({}) },
    } as any;

    const request = new Request('http://example.com/pubmed');
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as any;
    const response = await worker.fetch(request, mockEnv, ctx);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('PubMed BigQuery 醫學問答機器人');
  });

  it('returns the same named shared medical conversation', async () => {
    const requestedNames: string[] = [];
    const mockEnv = {
      CHAT_STATE: {
        idFromName: (name: string) => {
          requestedNames.push(name);
          return { toString: () => 'shared-chat-id' };
        },
      },
    } as any;

    const response = await worker.fetch(
      new Request('http://example.com/chat/init', { method: 'POST' }),
      mockEnv,
      {} as any
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'shared-chat-id' });
    expect(requestedNames).toEqual(['shared-medical-chat-v2']);
  });

  it('routes even an old browser chat ID to the shared conversation', async () => {
    let requestedName = '';
    const mockEnv = {
      CHAT_STATE: {
        idFromName: (name: string) => {
          requestedName = name;
          return { toString: () => 'shared-chat-id' };
        },
        get: () => ({ fetch: async () => new Response('shared-chat') }),
      },
    } as any;

    const response = await worker.fetch(
      new Request('http://example.com/chat/doctor-session-id'),
      mockEnv,
      {} as any
    );
    expect(requestedName).toBe('shared-medical-chat-v2');
    expect(await response.text()).toBe('shared-chat');
  });
});
