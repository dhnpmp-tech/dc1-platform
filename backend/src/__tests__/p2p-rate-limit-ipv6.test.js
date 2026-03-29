const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

jest.mock('../db', () => ({
  get: jest.fn(() => null),
  all: jest.fn(() => []),
}));

jest.mock('../middleware/auth', () => ({
  getApiKeyFromReq: jest.fn(() => null),
}));

jest.mock('../services/p2p-discovery', () => ({
  announceFromHttpInput: jest.fn(),
  getDiscoveryStatus: jest.fn(() => ({ mode: 'shadow' })),
  runShadowDiscoveryCycle: jest.fn(),
  listProviders: jest.fn(async () => []),
  resolveProvider: jest.fn(async () => null),
  resolveProviders: jest.fn(async () => []),
  resolveEnvironment: jest.fn(async () => null),
  probeDiscovery: jest.fn(async () => ({})),
}));

afterAll(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('p2p route rate-limit key generation', () => {
  test('builds namespaced keys for IPv4 and IPv6', () => {
    const route = require('../routes/p2p');

    const ipv4Key = route.p2pRateLimitKey({ ip: '203.0.113.42' });
    const ipv6Key = route.p2pRateLimitKey({ ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' });
    const fallbackKey = route.p2pRateLimitKey({ ip: '', socket: { remoteAddress: '198.51.100.9' } });

    expect(ipv4Key).toBe('p2p-ip:203.0.113.42');
    expect(ipv6Key.startsWith('p2p-ip:')).toBe(true);
    expect(ipv6Key).not.toBe('p2p-ip:2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    expect(fallbackKey).toBe('p2p-ip:198.51.100.9');
  });

  test('does not emit ERR_ERL_KEY_GEN_IPV6 warning on route initialization', () => {
    require('../routes/p2p');

    const ipv6ErrorCalls = errorSpy.mock.calls.filter((call) =>
      call.some((entry) => String(entry).includes('ERR_ERL_KEY_GEN_IPV6'))
    );
    const ipv6WarnCalls = warnSpy.mock.calls.filter((call) =>
      call.some((entry) => String(entry).includes('ERR_ERL_KEY_GEN_IPV6'))
    );

    expect(ipv6ErrorCalls).toHaveLength(0);
    expect(ipv6WarnCalls).toHaveLength(0);
  });
});
