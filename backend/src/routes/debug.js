import { Router } from 'express';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const router = Router();

// 调试控制台仅允许只读语句, 数据修改请走管理界面的增删改功能
const READ_ONLY_RE = /^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|USE|WITH)\b/i;
const USE_RE = /^\s*USE\s+`?([A-Za-z0-9_]+)`?\s*;?\s*$/i;

// 调试使用独立连接池, 切换数据库不会影响管理后台主连接
const debugPool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lhlord',
  waitForConnections: true,
  connectionLimit: 2,
  charset: 'utf8mb4',
});

let currentDb = process.env.DB_NAME || 'lhlord';

// 数据库列表
router.get('/databases', async (req, res, next) => {
  try {
    const [rows] = await debugPool.query(
      `SELECT SCHEMA_NAME FROM information_schema.schemata
       WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
       ORDER BY SCHEMA_NAME`
    );
    res.json({ ok: true, data: { databases: rows.map((r) => r.SCHEMA_NAME), current: currentDb } });
  } catch (err) {
    next(err);
  }
});

// 切换当前数据库
router.post('/use', async (req, res, next) => {
  try {
    const { database } = req.body || {};
    if (!database || !/^[A-Za-z0-9_]+$/.test(database)) {
      return res.status(400).json({ ok: false, message: '数据库名非法' });
    }
    const [rows] = await debugPool.query(
      'SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME = ?',
      [database]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: `数据库不存在: ${database}` });
    }
    currentDb = database;
    res.json({ ok: true, data: { current: currentDb } });
  } catch (err) {
    next(err);
  }
});

router.post('/query', async (req, res, next) => {
  try {
    const { sql } = req.body || {};
    if (!sql || typeof sql !== 'string' || !sql.trim()) {
      return res.status(400).json({ ok: false, message: 'SQL 不能为空' });
    }
    const trimmed = sql.trim();
    const useMatch = USE_RE.exec(trimmed);
    if (useMatch) {
      const database = useMatch[1];
      const [rows] = await debugPool.query(
        'SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME = ?',
        [database]
      );
      if (rows.length === 0) {
        return res.status(404).json({ ok: false, message: `数据库不存在: ${database}` });
      }
      currentDb = database;
      return res.json({ ok: true, data: { current: currentDb, message: `已切换到数据库 ${currentDb}` } });
    }
    if (!READ_ONLY_RE.test(trimmed)) {
      return res.status(400).json({
        ok: false,
        message: '调试功能仅允许只读查询(SELECT / SHOW / DESCRIBE / EXPLAIN / USE / WITH), 修改数据请使用管理界面',
      });
    }
    const conn = await debugPool.getConnection();
    try {
      await conn.query(`USE \`${currentDb}\``);
      const [result] = await conn.query(sql);
      if (Array.isArray(result)) {
        const columns = result.length > 0 ? Object.keys(result[0]) : [];
        res.json({ ok: true, data: { current: currentDb, columns, rows: result, count: result.length } });
      } else {
        res.json({
          ok: true,
          data: {
            current: currentDb,
            columns: [],
            rows: [],
            count: 0,
            affectedRows: result.affectedRows,
            message: '语句执行完成(非结果集)',
          },
        });
      }
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
