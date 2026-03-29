const providersRouter = require('../routes/providers');

describe('providers heartbeat HMAC enforcement policy', () => {
  const { shouldEnforceHeartbeatHmac } = providersRouter.__private;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_REQUIRE = process.env.DC1_REQUIRE_HEARTBEAT_HMAC;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    process.env.DC1_REQUIRE_HEARTBEAT_HMAC = ORIGINAL_REQUIRE;
  });

  it('enforces heartbeat HMAC in production even when toggle is unset', () => {
    delete process.env.DC1_REQUIRE_HEARTBEAT_HMAC;
    process.env.NODE_ENV = 'production';

    expect(shouldEnforceHeartbeatHmac()).toBe(true);
  });

  it('enforces heartbeat HMAC in production even when toggle is explicitly disabled', () => {
    process.env.DC1_REQUIRE_HEARTBEAT_HMAC = '0';
    process.env.NODE_ENV = 'production';

    expect(shouldEnforceHeartbeatHmac()).toBe(true);
  });

  it('enforces heartbeat HMAC outside production only when toggle is enabled', () => {
    process.env.NODE_ENV = 'development';
    process.env.DC1_REQUIRE_HEARTBEAT_HMAC = '1';
    expect(shouldEnforceHeartbeatHmac()).toBe(true);

    process.env.DC1_REQUIRE_HEARTBEAT_HMAC = '0';
    expect(shouldEnforceHeartbeatHmac()).toBe(false);
  });
});
