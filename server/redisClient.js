const { createClient } = require('redis');

/**
 * Safely decodes URI-encoded values without throwing on invalid sequences.
 */
function safeDecode(val) {
  if (!val) return val;
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

/**
 * Robustly parses a Redis URL without relying on standard new URL(),
 * which breaks when passwords contain special characters like '@', '#', '/', '?', etc.
 * Also automatically defaults username to 'default' for Redis 6+ ACL authentication.
 */
function parseRedisUrl(rawUrl, envPassword, envUsername) {
  const url = (rawUrl || '').trim();
  const protocolMatch = url.match(/^(rediss?:\/\/)/i);
  if (!protocolMatch) {
    return {
      host: 'localhost',
      port: 6379,
      isTls: false,
      username: envUsername,
      password: envPassword
    };
  }

  const isTls = protocolMatch[1].toLowerCase() === 'rediss://';
  let rest = url.slice(protocolMatch[0].length);

  let username = envUsername;
  let password = envPassword;
  let hostPort = rest;

  // The last '@' separates userinfo (credentials) from the host:port
  const lastAtIndex = rest.lastIndexOf('@');
  if (lastAtIndex !== -1) {
    const userinfo = rest.slice(0, lastAtIndex);
    hostPort = rest.slice(lastAtIndex + 1);

    const colonIndex = userinfo.indexOf(':');
    if (colonIndex !== -1) {
      const u = userinfo.slice(0, colonIndex);
      const p = userinfo.slice(colonIndex + 1);
      if (!username && u) username = safeDecode(u);
      if (!password && p) password = safeDecode(p);
    } else {
      if (!username && userinfo) username = safeDecode(userinfo);
    }
  }

  // Redis 6+ ACL requires 'default' as the username when authenticating with a password
  if (password && (!username || username === '')) {
    username = 'default';
  }

  // Extract optional database path /0
  let db;
  const slashIndex = hostPort.indexOf('/');
  if (slashIndex !== -1) {
    db = hostPort.slice(slashIndex + 1);
    hostPort = hostPort.slice(0, slashIndex);
  }

  let host = hostPort;
  let port = isTls ? 6380 : 6379;

  // Handle IPv6 bracket notation [::1]:6379 or standard host:port
  if (hostPort.startsWith('[')) {
    const closingBracket = hostPort.indexOf(']');
    if (closingBracket !== -1) {
      host = hostPort.slice(1, closingBracket);
      const after = hostPort.slice(closingBracket + 1);
      if (after.startsWith(':')) {
        const p = parseInt(after.slice(1), 10);
        if (!isNaN(p)) port = p;
      }
    }
  } else {
    const portMatch = hostPort.match(/^(.*):(\d+)$/);
    if (portMatch) {
      host = portMatch[1];
      port = parseInt(portMatch[2], 10);
    }
  }

  return { host, port, isTls, db, username, password };
}

const parsed = parseRedisUrl(
  process.env.REDIS_URL || 'redis://localhost:6379',
  process.env.REDIS_PASSWORD,
  process.env.REDIS_USERNAME
);

const clientConfig = {
  socket: {
    host: parsed.host,
    port: parsed.port,
    tls: parsed.isTls
  }
};

if (parsed.username) {
  clientConfig.username = parsed.username;
}
if (parsed.password) {
  clientConfig.password = parsed.password;
}
if (parsed.db) {
  clientConfig.database = parseInt(parsed.db, 10);
}

const client = createClient(clientConfig);

client.on('error', err => {
  console.error(`Redis Client Error [${parsed.host}:${parsed.port}]:`, err.message || err);
});

async function connect() {
  if (!client.isOpen) {
    await client.connect();
  }
}

module.exports = { client, connect };
