import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTargetWord } from './game-logic';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('getTargetWord rarity and dictionary contract', () => {
  it('classifies difficulty by rarity, not word length', async () => {
    const datamuseWords = [
      { word: 'extraordinary', tags: ['f:900'] },
      { word: 'ordinaryword', tags: ['f:500'] },
      { word: 'caper', tags: ['f:10'] },
    ];

    const dictionaryPayload = (word: string) => [
      {
        phonetic: '/test/',
        phonetics: [{ audio: `https://audio.example/${word}.mp3` }],
        meanings: [{ definitions: [{ definition: `Definition for ${word}` }] }],
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('api.datamuse.com')) {
          return jsonResponse(datamuseWords);
        }
        if (url.includes('api.dictionaryapi.dev')) {
          const word = decodeURIComponent(url.split('/').pop() ?? '');
          return jsonResponse(dictionaryPayload(word));
        }
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    const easy = await getTargetWord('easy', 'daily');
    const medium = await getTargetWord('medium', 'daily');
    const hard = await getTargetWord('hard', 'daily');

    expect(easy.word).toBe('extraordinary');
    expect(medium.word).toBe('ordinaryword');
    expect(hard.word).toBe('caper');
    expect(easy.definition).toContain('extraordinary');
  });

  it('skips words missing dictionary entries and keeps searching', async () => {
    const datamuseWords = [
      { word: 'ultracommon', tags: ['f:1000'] },
      { word: 'stillcommon', tags: ['f:900'] },
      { word: 'midalpha', tags: ['f:700'] },
      { word: 'midbeta', tags: ['f:650'] },
      { word: 'rarealpha', tags: ['f:30'] },
      { word: 'rarebeta', tags: ['f:20'] },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('api.datamuse.com')) {
          return jsonResponse(datamuseWords);
        }
        if (url.includes('api.dictionaryapi.dev')) {
          const word = decodeURIComponent(url.split('/').pop() ?? '');
          if (word === 'ultracommon') {
            return jsonResponse({ title: 'No Definitions Found' }, 404);
          }
          return jsonResponse([
            {
              phonetic: '/ok/',
              phonetics: [{ audio: '' }],
              meanings: [{ definitions: [{ definition: `Definition for ${word}` }] }],
            },
          ]);
        }
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    const result = await getTargetWord('easy', 'daily');
    expect(result.word).toBe('stillcommon');
    expect(result.definition).toContain('stillcommon');
  });

  it('throws when no dictionary-backed words can be found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('api.datamuse.com')) {
          return jsonResponse([{ word: 'candidate', tags: ['f:100'] }]);
        }
        if (url.includes('api.dictionaryapi.dev')) {
          return jsonResponse({ title: 'No Definitions Found' }, 404);
        }
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    await expect(getTargetWord('easy', 'infinite')).rejects.toThrow(
      'Unable to fetch an infinite dictionary-backed word.',
    );
  });

  it('rethrows AbortError to preserve cancellation flow', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(
      getTargetWord('easy', 'daily', new AbortController().signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
