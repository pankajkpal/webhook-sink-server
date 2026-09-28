const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { client, connect } = require('./redisClient');
const morgan = require('morgan');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'server.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  ],
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

app.use(cors());

// Webhook endpoints: buffer raw payload of any type to prevent SyntaxError crashes from body-parser
app.use('/webhook', express.raw({ type: '*/*', limit: '10mb' }));

app.use(express.json());
const path = require('path');
app.use(express.urlencoded({ extended: true }));
app.use(express.text());
app.use(express.raw({ type: '*/*' }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.static(path.join(__dirname, '../client/dist')));

connect().then(() => {
  logger.info('Connected to Redis');
}).catch(err => logger.error('Redis connection error: ', err));

io.on('connection', (socket) => {
  logger.info(`A client connected: ${socket.id}`);
  
  socket.on('joinInbox', (inboxId) => {
    socket.join(inboxId);
    logger.info(`Socket ${socket.id} joined inbox ${inboxId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

app.post('/api/inboxes', async (req, res) => {
  try {
    const { 
      name, 
      method = 'POST', 
      headers = {}, 
      queryParams = {}, 
      auth = null, 
      responseStructure = { status: 'success' },
      responseStatusCode = 200,
      responseDelayMs = 0,
      rateLimitPerSecond = 0,
      retryAfterSeconds = 20
    } = req.body;
    
    const uuid = uuidv4();
    
    let serializedResponse;
    if (typeof responseStructure === 'string') {
      try {
        JSON.parse(responseStructure);
        serializedResponse = responseStructure;
      } catch {
        serializedResponse = JSON.stringify({ status: 'success' });
      }
    } else {
      serializedResponse = JSON.stringify(responseStructure !== undefined ? responseStructure : { status: 'success' });
    }
    
    const inbox = {
      uuid,
      name: name || `Inbox-${uuid.substring(0, 5)}`,
      method: method.toUpperCase(),
      headers: typeof headers === 'string' ? headers : JSON.stringify(headers || {}),
      queryParams: typeof queryParams === 'string' ? queryParams : JSON.stringify(queryParams || {}),
      auth: typeof auth === 'string' ? auth : JSON.stringify(auth),
      responseStructure: serializedResponse,
      responseStatusCode: String(responseStatusCode || 200),
      responseDelayMs: String(Math.max(0, parseInt(responseDelayMs, 10) || 0)),
      rateLimitPerSecond: String(Math.max(0, parseInt(rateLimitPerSecond, 10) || 0)),
      retryAfterSeconds: String(Math.max(1, parseInt(retryAfterSeconds, 10) || 20)),
      createdAt: Date.now().toString()
    };
    
    await client.hSet(`inbox:${uuid}`, inbox);
    await client.zAdd('inboxes', { score: inbox.createdAt, value: uuid });
    
    res.status(201).json(inbox);
  } catch (err) {
    logger.error('Error creating inbox:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/inboxes/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const existingInbox = await client.hGetAll(`inbox:${uuid}`);
    if (!existingInbox || !existingInbox.uuid) {
      return res.status(404).json({ error: 'Inbox not found' });
    }

    const { 
      name, 
      method, 
      headers, 
      queryParams, 
      auth, 
      responseStructure,
      responseStatusCode,
      responseDelayMs,
      rateLimitPerSecond,
      retryAfterSeconds
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (method !== undefined) updates.method = method.toUpperCase();
    if (headers !== undefined) updates.headers = typeof headers === 'string' ? headers : JSON.stringify(headers);
    if (queryParams !== undefined) updates.queryParams = typeof queryParams === 'string' ? queryParams : JSON.stringify(queryParams);
    if (auth !== undefined) updates.auth = typeof auth === 'string' ? auth : JSON.stringify(auth);
    if (responseStructure !== undefined) {
      if (typeof responseStructure === 'string') {
        try {
          JSON.parse(responseStructure);
          updates.responseStructure = responseStructure;
        } catch {
          return res.status(400).json({ error: 'Invalid JSON for responseStructure' });
        }
      } else {
        updates.responseStructure = JSON.stringify(responseStructure);
      }
    }
    if (responseStatusCode !== undefined) {
      updates.responseStatusCode = String(responseStatusCode);
    }
    if (responseDelayMs !== undefined) {
      updates.responseDelayMs = String(Math.max(0, parseInt(responseDelayMs, 10) || 0));
    }
    if (rateLimitPerSecond !== undefined) {
      updates.rateLimitPerSecond = String(Math.max(0, parseInt(rateLimitPerSecond, 10) || 0));
    }
    if (retryAfterSeconds !== undefined) {
      updates.retryAfterSeconds = String(Math.max(1, parseInt(retryAfterSeconds, 10) || 20));
    }

    if (Object.keys(updates).length > 0) {
      await client.hSet(`inbox:${uuid}`, updates);
    }

    const updated = await client.hGetAll(`inbox:${uuid}`);
    res.json(updated);
  } catch (err) {
    logger.error(`Error updating inbox ${req.params.uuid}:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/inboxes/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    await client.del(`inbox:${uuid}`);
    await client.del(`messages:${uuid}`);
    await client.zRem('inboxes', uuid);
    res.json({ success: true, message: 'Inbox deleted' });
  } catch (err) {
    logger.error(`Error deleting inbox ${req.params.uuid}:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/inboxes', async (req, res) => {
  try {
    const uuids = await client.zRange('inboxes', 0, -1, { REV: true });
    
    const inboxes = [];
    for (const uuid of uuids) {
      const inbox = await client.hGetAll(`inbox:${uuid}`);
      if (inbox && inbox.uuid) {
        inboxes.push(inbox);
      }
    }
    
    res.json(inboxes);
  } catch (err) {
    logger.error('Error listing inboxes:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/inboxes/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const inbox = await client.hGetAll(`inbox:${uuid}`);
    
    if (!inbox || !inbox.uuid) {
      return res.status(404).json({ error: 'Inbox not found' });
    }
    
    res.json(inbox);
  } catch (err) {
    logger.error(`Error getting inbox ${req.params.uuid}:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/inboxes/:uuid/messages', async (req, res) => {
  try {
    const { uuid } = req.params;
    const messagesStr = await client.lRange(`messages:${uuid}`, 0, 100);
    const messages = messagesStr.map(msg => JSON.parse(msg));
    
    res.json(messages);
  } catch (err) {
    logger.error(`Error getting messages for inbox ${req.params.uuid}:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.all('/webhook/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const inbox = await client.hGetAll(`inbox:${uuid}`);
    
    if (!inbox || !inbox.uuid) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ error: 'Inbox not found' });
    }
    
    let rawStr = '';
    if (Buffer.isBuffer(req.body)) {
      rawStr = req.body.toString('utf-8');
    } else if (typeof req.body === 'string') {
      rawStr = req.body;
    } else if (req.body && typeof req.body === 'object') {
      rawStr = JSON.stringify(req.body);
    }

    let parsedBody = rawStr;
    const contentType = (req.headers['content-type'] || '').toLowerCase();

    // Gracefully parse JSON if content-type contains json or payload appears to be JSON
    if (contentType.includes('json') || rawStr.trim().startsWith('{') || rawStr.trim().startsWith('[')) {
      let candidate = rawStr.trim();

      // Auto-heal payload if wrapped in quotes (common when curl is executed in Windows CMD or PowerShell)
      if (
        (candidate.startsWith("'") && candidate.endsWith("'")) ||
        (candidate.startsWith('"') && candidate.endsWith('"') && candidate.length > 2)
      ) {
        const unwrapped = candidate.slice(1, -1).trim();
        if (
          (unwrapped.startsWith('{') && unwrapped.endsWith('}')) ||
          (unwrapped.startsWith('[') && unwrapped.endsWith(']'))
        ) {
          candidate = unwrapped;
        }
      }

      try {
        parsedBody = JSON.parse(candidate);
      } catch {
        // Fallback: If not valid strict JSON, preserve raw string so webhook is never lost
        parsedBody = rawStr;
      }
    }

    const delayMs = Math.max(0, parseInt(inbox.responseDelayMs, 10) || 0);

    const receivedMsg = {
      id: uuidv4(),
      method: req.method,
      headers: req.headers,
      query: req.query,
      body: parsedBody,
      receivedAt: Date.now(),
      status: 'SUCCESS',
      errors: [],
      delayMs
    };

    const expectedMethod = inbox.method;
    if (expectedMethod !== 'ANY' && req.method.toUpperCase() !== expectedMethod) {
      receivedMsg.status = 'FAILED';
      receivedMsg.errors.push(`Expected HTTP Method: ${expectedMethod}, got: ${req.method}`);
    }

    const expectedHeaders = JSON.parse(inbox.headers || '{}');
    for (const [key, val] of Object.entries(expectedHeaders)) {
      if (!req.headers[key.toLowerCase()] || req.headers[key.toLowerCase()] !== val) {
        receivedMsg.status = 'FAILED';
        receivedMsg.errors.push(`Header mismatch: ${key}`);
      }
    }

    const expectedQuery = JSON.parse(inbox.queryParams || '{}');
    for (const [key, val] of Object.entries(expectedQuery)) {
      if (req.query[key] !== val) {
        receivedMsg.status = 'FAILED';
        receivedMsg.errors.push(`Query param mismatch: ${key}`);
      }
    }

    // Check Rate Limiting (Limit per second)
    const rateLimit = parseInt(inbox.rateLimitPerSecond, 10) || 0;
    const retryAfter = parseInt(inbox.retryAfterSeconds, 10) || 20;
    let isRateLimited = false;

    if (rateLimit > 0) {
      const currentSec = Math.floor(Date.now() / 1000);
      const rlKey = `ratelimit:${uuid}:${currentSec}`;
      const count = await client.incr(rlKey);
      if (count === 1) {
        await client.expire(rlKey, 2);
      }
      if (count > rateLimit) {
        isRateLimited = true;
      }
    }

    if (isRateLimited) {
      receivedMsg.status = 'RATE_LIMITED';
      receivedMsg.errors.push(`Rate limit exceeded (${rateLimit} req/sec). Retry-After: ${retryAfter}s`);
    }

    await client.lPush(`messages:${uuid}`, JSON.stringify(receivedMsg));
    await client.lTrim(`messages:${uuid}`, 0, 99);
    
    io.to(uuid).emit('newMessage', receivedMsg);

    // If wait milliseconds configured, wait before sending response (timeout simulation)
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    if (isRateLimited) {
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('Content-Type', 'application/json');
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit of ${rateLimit} req/sec exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter: retryAfter
      });
    }

    if (receivedMsg.status === 'FAILED') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ 
        error: 'Webhook validation failed', 
        details: receivedMsg.errors 
      });
    }

    const statusCode = parseInt(inbox.responseStatusCode, 10) || 200;
    let responseStructure;
    try {
      responseStructure = JSON.parse(inbox.responseStructure || '{"status":"success"}');
    } catch {
      responseStructure = { status: 'success' };
    }

    if (statusCode === 204) {
      return res.status(204).end();
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(statusCode).json(responseStructure);

  } catch (err) {
    logger.error(`Error processing webhook for ${req.params.uuid}:`, err);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Global error handler ensuring all error responses set Content-Type: application/json
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  logger.error('Unhandled server error:', err);
  res.setHeader('Content-Type', 'application/json');
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'Error',
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
