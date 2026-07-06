const http = require('http');

const PORT = 3000;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    console.log(`[Mock Server] Received ${req.method} request to ${req.url}`);

    // Mock Route 1: Cloudflare Gateway (/audit)
    if (req.url === '/audit' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Missing or invalid Authorization header" }));
        return;
      }
      // Pretend validation succeeds and we enqueue
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: "Accepted by Mock Gateway Queue" }));
      return;
    }

    // Mock Route 2: OpenAI (/v1/chat/completions)
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== 'Bearer mock-openai-key-123') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Invalid API Key" }));
        return;
      }
      // Return a mock AI response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const mockAiResponse = {
        id: "chatcmpl-mock123",
        choices: [
          {
            message: {
              role: "assistant",
              content: "LGTM 👍 (Mocked BYOK Response: Clean architecture validated!)"
            }
          }
        ]
      };
      res.end(JSON.stringify(mockAiResponse));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
});

server.listen(PORT, () => {
  console.log(`[Mock Server] Listening on http://localhost:${PORT}`);
});
