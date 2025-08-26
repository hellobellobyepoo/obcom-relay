const http = require('http');
const url = require('url');
const WebSocket = require('ws');

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/ws'))) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocket.Server({ noServer: true });
const rooms = new Map(); // code -> [ws1, ws2]

server.on('upgrade', (req, socket, head) => {
  const { query, pathname } = url.parse(req.url, true);
  if (pathname !== '/' && pathname !== '/ws') {
    socket.destroy();
    return;
  }
  const code = (query.code || '').trim();
  if (!code) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    let peers = rooms.get(code);
    if (!peers) { peers = []; rooms.set(code, peers); }
    if (peers.length >= 2) { ws.close(1008, 'Room full'); return; }

    peers.push(ws);
    console.log(`Client joined code ${code} (${peers.length}/2)`);

    ws.on('message', (msg) => {
      for (const peer of peers) {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          peer.send(msg);
        }
      }
    });

    ws.on('close', () => {
      const idx = peers.indexOf(ws);
      if (idx >= 0) peers.splice(idx, 1);
      if (peers.length === 0) rooms.delete(code);
      console.log(`Client left code ${code}`);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Relay server listening on port ${PORT}`);
});
