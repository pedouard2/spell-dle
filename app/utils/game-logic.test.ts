import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTargetWord } from './game-logic';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('getTargetWord (daily mode)', () => {
  it('uses Datamuse and stays deterministic for the day', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ word: 'monorail' }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getTargetWord('medium', 'daily');
    const second = await getTargetWord('medium', 'daily');

    expect(first).toBe('monorail');
    expect(second).toBe('monorail');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('throws when daily API cannot provide a valid word', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(getTargetWord('easy', 'daily')).rejects.toThrow(
      'Unable to fetch a daily word from Datamuse.',
    );
  });
});

describe('getTargetWord (infinite mode)', () => {
  it('returns a clean API word when Datamuse provides candidates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ word: 'co-op' }, { word: 'friend' }, { word: 'two words' }],
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const word = await getTargetWord('easy', 'infinite');

    expect(word).toBe('friend');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('throws when infinite API cannot provide a valid word', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(getTargetWord('hard', 'infinite')).rejects.toThrow(
      'Unable to fetch an infinite word from Datamuse.',
    );
  });

  it('rethrows AbortError so callers can cancel cleanly', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(
      getTargetWord('easy', 'infinite', new AbortController().signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
