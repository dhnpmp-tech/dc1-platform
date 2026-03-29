'use strict';

describe('p2p route rate-limit key generators', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('use express-rate-limit ipKeyGenerator for IPv6-safe keys', () => {
    const rateLimitMock = jest.fn(() => (req, res, next) => next());
    rateLimitMock.ipKeyGenerator = jest.fn((ip) => `normalized:${ip}`);

    jest.doMock('express-rate-limit', () => rateLimitMock);
    jest.doMock('../db', () => ({ get: jest.fn(), all: jest.fn() }));
    jest.doMock('../middleware/auth', () => ({ getApiKeyFromReq: jest.fn() }));
    jest.doMock('../services/p2p-discovery', () => ({
      announceFromHttpInput: jest.fn(),
      getDiscoveryStatus: jest.fn(() => ({ mode: 'sqlite-only' })),
      runShadowDiscoveryCycle: jest.fn(),
      listProviders: jest.fn(),
      resolveProvider: jest.fn(),
      resolveProviders: jest.fn(),
      resolveEnvironment: jest.fn(),
      probeDiscovery: jest.fn(),
    }));

    require('../routes/p2p');

    expect(rateLimitMock).toHaveBeenCalledTimes(2);

    const announceOptions = rateLimitMock.mock.calls[0][0];
    const lookupOptions = rateLimitMock.mock.calls[1][0];

    expect(announceOptions.keyGenerator({ ip: '::1' })).toBe('normalized:::1');
    expect(lookupOptions.keyGenerator({ ip: '::1' })).toBe('normalized:::1');
    expect(rateLimitMock.ipKeyGenerator).toHaveBeenCalledWith('::1');
  });
});
