import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import tablesRouter from './routes/tables.js';
import debugRouter from './routes/debug.js';
import alchemyRouter from './routes/alchemy.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/tables', tablesRouter);
app.use('/api/debug', debugRouter);
app.use('/api/alchemy', alchemyRouter);

// 统一错误处理
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);
  res.status(status).json({ ok: false, message: err.message || '服务器内部错误' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, '127.0.0.1', () => {
  console.log(`lhlord admin server: http://127.0.0.1:${port}`);
});
