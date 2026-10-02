/**
 * @brief 管理后台 API 服务入口
 *
 * 创建 Express 应用, 挂载数据表/调试/炼丹三组路由并统一处理错误
 */
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import tablesRouter from './routes/tables.js';
import debugRouter from './routes/debug.js';
import alchemyRouter from './routes/alchemy.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

/**
 * @brief 健康检查接口
 *
 * 用于探活与启动状态确认
 */
app.get('/api/health', (req, res) =>
{
    res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/tables', tablesRouter);
app.use('/api/debug', debugRouter);
app.use('/api/alchemy', alchemyRouter);

/**
 * @brief 统一错误处理中间件
 *
 * 将路由抛出的错误(带 status 字段)转换为 JSON 响应
 */
app.use((err, req, res, next) =>
{
    const status = err.status || 500;
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);
    res.status(status).json({ ok: false, message: err.message || '服务器内部错误' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, '127.0.0.1', () =>
{
    console.log(`lhlord admin server: http://127.0.0.1:${port}`);
});
