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
      responseStructure = { status: 'success' } 
    } = req.body;
    
    const uuid = uuidv4();
    
    const inbox = {
      uuid,
      name: name || `Inbox-${uuid.substring(0, 5)}`,
      method: method.toUpperCase(),
      headers: JSON.stringify(headers),
      queryParams: JSON.stringify(queryParams),
      auth: JSON.stringify(auth),
      responseStructure: JSON.stringify(responseStructure),
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
      return res.status(404).json({ error: 'Inbox not found' });
    }
    
    let parsedBody = req.body;
    if (Buffer.isBuffer(req.body)) {
        parsedBody = req.body.toString('utf-8');
    }

    const receivedMsg = {
      id: uuidv4(),
      method: req.method,
      headers: req.headers,
      query: req.query,
      body: parsedBody,
      receivedAt: Date.now(),
      status: 'SUCCESS',
      errors: []
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

    await client.lPush(`messages:${uuid}`, JSON.stringify(receivedMsg));
    await client.lTrim(`messages:${uuid}`, 0, 99);
    
    io.to(uuid).emit('newMessage', receivedMsg);

    if (receivedMsg.status === 'FAILED') {
      return res.status(400).json({ 
        error: 'Webhook validation failed', 
        details: receivedMsg.errors 
      });
    }

    const responseStructure = JSON.parse(inbox.responseStructure || '{"status":"success"}');
    res.status(200).json(responseStructure);

  } catch (err) {
    logger.error(`Error processing webhook for ${req.params.uuid}:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
