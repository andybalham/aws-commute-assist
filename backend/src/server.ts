import express from 'express';
import cors from 'cors';
import { config } from './config';
import { routeRequest } from './router';

const app = express();
app.use(cors());
app.use(express.json());

app.all('/{*path}', async (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'local-dev-user';
  const path = req.path;
  const method = req.method;
  const query: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.query)) {
    if (typeof val === 'string') query[key] = val;
  }

  const result = await routeRequest({
    method,
    path,
    params: {},
    query,
    body: req.body,
    userId,
  });

  res.status(result.statusCode);
  if (result.body != null) {
    res.json(result.body);
  } else {
    res.end();
  }
});

app.listen(config.port, () => {
  console.log(`Backend dev server running on http://localhost:${config.port}`);
});
