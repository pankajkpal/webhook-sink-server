const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
client.on('error', err => console.log('Redis Client Error', err));

async function connect() {
  if (!client.isOpen) {
    await client.connect();
  }
}

module.exports = { client, connect };
