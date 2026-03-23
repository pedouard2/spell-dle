import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTargetWord, STATIC_WORD_DATABASE } from './game-logic';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('getTargetWord (daily mode)', () => {
  it('returns a deterministic word for same day and difficulty', async () => {
    const first = await getTargetWord('medium', 'daily');
    const second = await getTargetWord('medium', 'daily');

    expect(second).toBe(first);
  });

  it('returns words inside expected rank bands', async () => {
    const easyWord = await getTargetWord('easy', 'daily');
    const mediumWord = await getTargetWord('medium', 'daily');
    const hardWord = await getTargetWord('hard', 'daily');

    const easyEntry = STATIC_WORD_DATABASE.find((item) => item.word === easyWord);
    const mediumEntry = STATIC_WORD_DATABASE.find((item) => item.word === mediumWord);
    const hardEntry = STATIC_WORD_DATABASE.find((item) => item.word === hardWord);

    expect(easyEntry?.rank).toBeGreaterThanOrEqual(0);
    expect(easyEntry?.rank).toBeLessThanOrEqual(1000);

    expect(mediumEntry?.rank).toBeGreaterThanOrEqual(1000);
    expect(mediumEntry?.rank).toBeLessThanOrEqual(5000);

    expect(hardEntry?.rank).toBeGreaterThanOrEqual(5000);
    expect(hardEntry?.rank).toBeLessThanOrEqual(100000);
  });
});

describe('getTargetWord (infinite mode)', () => {
  it('returns a clean API word when datamuse provides valid candidates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ word: 'co-op' }, { word: 'spelling' }, { word: 'two words' }],
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const word = await getTargetWord('easy', 'infinite');

    expect(word).toBe('spelling');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to static words when API fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const word = await getTargetWord('hard', 'infinite');

    expect(word).toBe(STATIC_WORD_DATABASE[0].word);
  });

  it('rethrows AbortError to allow upstream cancellation handling', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(getTargetWord('easy', 'infinite', new AbortController().signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
