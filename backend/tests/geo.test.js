const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getGeoLocation, isPrivateIP } = require('../src/lib/geo');

describe('isPrivateIP', () => {
  it('returns true for 127.x', () => assert.equal(isPrivateIP('127.0.0.1'), true));
  it('returns true for 10.x', () => assert.equal(isPrivateIP('10.0.0.1'), true));
  it('returns true for 192.168.x', () => assert.equal(isPrivateIP('192.168.1.1'), true));
  it('returns true for 172.16.x', () => assert.equal(isPrivateIP('172.16.0.1'), true));
  it('returns true for ::1', () => assert.equal(isPrivateIP('::1'), true));
  it('returns true for null', () => assert.equal(isPrivateIP(null), true));
  it('returns false for public IP', () => assert.equal(isPrivateIP('8.8.8.8'), false));
});

describe('getGeoLocation', () => {
  it('returns bypass object for private IP without network call', async () => {
    const fetchCalls = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (...args) => { fetchCalls.push(args); return { ok: true, json: async () => ({}) }; };

    const result = await getGeoLocation('192.168.1.1');
    assert.deepEqual(result, { city: 'Local', region: 'Private', country: 'XX', coords: null });
    assert.equal(fetchCalls.length, 0, 'should not make any fetch calls');

    globalThis.fetch = origFetch;
  });

  it('returns null when ipinfo times out', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      return new Promise((resolve, reject) => {
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
        // Never resolve — wait for abort
      });
    };

    const result = await getGeoLocation('8.8.8.8');
    assert.equal(result, null);

    globalThis.fetch = origFetch;
  });

  it('returns null when ipinfo returns non-OK', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 500 });

    const result = await getGeoLocation('8.8.8.8');
    assert.equal(result, null);

    globalThis.fetch = origFetch;
  });

  it('returns geo data on successful ipinfo response', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ city: 'Dubai', region: 'Dubai', country: 'AE', loc: '25.2,55.27' }),
    });

    const result = await getGeoLocation('1.2.3.4');
    assert.deepEqual(result, { city: 'Dubai', region: 'Dubai', country: 'AE', coords: '25.2,55.27' });

    globalThis.fetch = origFetch;
  });

  it('caches results and does not fetch again', async () => {
    let fetchCount = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCount++;
      return { ok: true, json: async () => ({ city: 'Test', region: 'Test', country: 'US', loc: '1,1' }) };
    };

    await getGeoLocation('5.5.5.5');
    await getGeoLocation('5.5.5.5');
    assert.equal(fetchCount, 1, 'should only fetch once due to cache');

    globalThis.fetch = origFetch;
  });
});
