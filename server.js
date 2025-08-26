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

  // Accept both "/" and "/ws" as valid WebSocket paths
  if (pathname !== '/' && pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const code = (query.code || '').trim();
  if (!code) {
    socket.destroy();
    return;
  }

  // ✅ Always create the room if it doesn't exist
  if (!rooms.has(code)) {
    console.log(`Creating new room for code: ${code}`);
    rooms.set(code, []);
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    const peers = rooms.get(code);

    // Optional: limit to 2 peers per room
    if (peers.length >= 2) {
      ws.close(1008, 'Room full');
      return;
    }

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

      // ❌ Don't delete the room when empty — keeps code reusable
      // If you want to auto-clean after X minutes, use a timeout instead
      console.log(`Client left code ${code} (${peers.length}/2)`);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Relay server listening on port ${PORT}`);
});
