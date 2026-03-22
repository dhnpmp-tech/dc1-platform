const net = require('net');
const dns = require('dns').promises;

const BLOCKED_HOSTS = new Set([
  'localhost',
  'local',
  'localhost.localdomain',
  '0.0.0.0',
]);

function isIpv4Private(ip) {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;

  const [a, b, c, d] = parts;
  if (a === 0) return true;              // 0.0.0.0/8
  if (a === 10) return true;             // 10.0.0.0/8
  if (a === 127) return true;            // loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark/test ranges
  if (a === 224 && (b === 0 || b === 1 || b === 2)) return true; // multicast/control local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 255) return true;            // limited broadcast
  return false;
}

function isIpv6PrivateOrLocal(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('::1:')) return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('ff')) return true; // multicast
  if (lower.includes('::ffff:127.')) return true; // v4-mapped loopback
  if (lower.startsWith('2001:db8:')) return true; // documentation space

  const v4Match = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match && v4Match[1]) {
    return isIpv4Private(v4Match[1]);
  }

  return false;
}

function isDisallowedWebhookHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local')) return true;
  if (host.endsWith('.internal')) return true;

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) return isIpv4Private(host);
  if (ipVersion === 6) return isIpv6PrivateOrLocal(host);

  return false;
}

function isPublicWebhookUrl(urlValue) {
  if (typeof urlValue !== 'string') return false;
  try {
    const parsed = new URL(urlValue);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return !isDisallowedWebhookHost(parsed.hostname);
  } catch (error) {
    return false;
  }
}

async function hostResolvesToPublicIps(hostname) {
  const host = String(hostname || '').trim();
  if (!host) return false;

  const literalIpVersion = net.isIP(host);
  if (literalIpVersion === 4) return !isIpv4Private(host);
  if (literalIpVersion === 6) return !isIpv6PrivateOrLocal(host);

  let records = [];
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch (_) {
    return false;
  }
  if (!Array.isArray(records) || records.length === 0) return false;

  for (const record of records) {
    const address = String(record?.address || '').trim();
    const version = net.isIP(address);
    if (!version) return false;
    if (version === 4 && isIpv4Private(address)) return false;
    if (version === 6 && isIpv6PrivateOrLocal(address)) return false;
  }
  return true;
}

async function isResolvablePublicWebhookUrl(urlValue) {
  if (!isPublicWebhookUrl(urlValue)) return false;
  try {
    const parsed = new URL(urlValue);
    return hostResolvesToPublicIps(parsed.hostname);
  } catch (_) {
    return false;
  }
}

module.exports = {
  isPublicWebhookUrl,
  isResolvablePublicWebhookUrl,
  isDisallowedWebhookHost,
};
