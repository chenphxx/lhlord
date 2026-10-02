import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const TABLE_NAME_RE = /^[A-Za-z0-9_]+$/;
const COLUMN_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TYPE_WHITELIST = new Set([
  'BIGINT', 'INT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'FLOAT', 'DOUBLE',
  'CHAR', 'VARCHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'DATE', 'DATETIME', 'TIMESTAMP', 'JSON',
]);
const LENGTH_TYPES = new Set(['CHAR', 'VARCHAR', 'DECIMAL']);

// 查询数据库名
const DB_NAME = () => process.env.DB_NAME || 'lhlord';

// 获取指定表的列元数据, 并校验表是否存在
async function getTableMeta(table) {
  if (!TABLE_NAME_RE.test(table)) {
    const err = new Error(`非法表名: ${table}`);
    err.status = 400;
    throw err;
  }
  const [tables] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [DB_NAME(), table]
  );
  if (tables.length === 0) {
    const err = new Error(`数据表不存在: ${table}`);
    err.status = 404;
    throw err;
  }
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
     FROM information_schema.columns
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [DB_NAME(), table]
  );
  const pkColumns = columns.filter((c) => c.COLUMN_KEY === 'PRI');
  return {
    table,
    columns,
    primaryKey: pkColumns.length > 0 ? pkColumns[0].COLUMN_NAME : null,
  };
}

// 筛选出可写列(排除自增主键与自动时间字段)
function getWritableColumns(meta, { forInsert }) {
  const skip = new Set(['create_time', 'update_time']);
  return meta.columns.filter((c) => {
    if (c.EXTRA && c.EXTRA.includes('auto_increment')) return false;
    if (skip.has(c.COLUMN_NAME)) return false;
    if (!forInsert && c.COLUMN_KEY === 'PRI') return false;
    return true;
  });
}

// 将空字符串转为 null, 便于数据库处理
function normalizeValue(value) {
  if (value === '') return null;
  return value;
}

// 校验并生成字段定义 SQL
function buildColumnDef({ name, type, length, nullable, autoIncrement, comment }) {
  if (!COLUMN_NAME_RE.test(name)) {
    const err = new Error(`非法字段名: ${name}`);
    err.status = 400;
    throw err;
  }
  const upperType = String(type || '').toUpperCase();
  if (!TYPE_WHITELIST.has(upperType)) {
    const err = new Error(`不支持的字段类型: ${type}`);
    err.status = 400;
    throw err;
  }
  let sql = `\`${name}\` ${upperType}`;
  if (LENGTH_TYPES.has(upperType) && length) {
    const len = parseInt(length, 10);
    if (len > 0) sql += `(${len})`;
  }
  sql += nullable === false ? ' NOT NULL' : ' NULL';
  if (autoIncrement) sql += ' AUTO_INCREMENT';
  if (comment) sql += ` COMMENT '${String(comment).replace(/'/g, "''")}'`;
  return sql;
}

// 根据 information_schema 列信息生成 ALTER 用完整字段定义
function buildColumnDefFromMeta(col, override = {}) {
  const name = override.name || col.COLUMN_NAME;
  const columnType = override.columnType || col.COLUMN_TYPE;
  const nullable = override.nullable !== undefined ? override.nullable : col.IS_NULLABLE !== 'NO';
  const defaultVal = override.defaultVal !== undefined ? override.defaultVal : col.COLUMN_DEFAULT;
  const extra = col.EXTRA || '';
  const comment = override.comment !== undefined ? override.comment : col.COLUMN_COMMENT;

  let sql = `\`${name}\` ${columnType}`;
  sql += nullable ? ' NULL' : ' NOT NULL';
  if (defaultVal !== null && defaultVal !== undefined) {
    const dv = String(defaultVal);
    if (dv.toUpperCase() === 'CURRENT_TIMESTAMP') sql += ' DEFAULT CURRENT_TIMESTAMP';
    else if (/^-?\d+(\.\d+)?$/.test(dv)) sql += ` DEFAULT ${dv}`;
    else sql += ` DEFAULT '${dv.replace(/'/g, "''")}'`;
  } else {
    sql += ' DEFAULT NULL';
  }
  if (extra.includes('auto_increment')) sql += ' AUTO_INCREMENT';
  if (extra.toLowerCase().includes('on update current_timestamp')) sql += ' ON UPDATE CURRENT_TIMESTAMP';
  if (comment) sql += ` COMMENT '${String(comment).replace(/'/g, "''")}'`;
  return sql;
}

// 表列表
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME, TABLE_COMMENT, TABLE_ROWS
       FROM information_schema.tables
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [DB_NAME()]
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// 新建数据表
router.post('/', async (req, res, next) => {
  try {
    const { tableName, tableComment, columns } = req.body || {};
    if (!tableName || !TABLE_NAME_RE.test(tableName)) {
      return res.status(400).json({ ok: false, message: '表名只能包含字母、数字与下划线' });
    }
    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ ok: false, message: '至少需要一个字段' });
    }
    const colDefs = columns.map(buildColumnDef);
    const pkColumn = columns.find((c) => c.autoIncrement);
    const pkSql = pkColumn
      ? `,\n  PRIMARY KEY (\`${pkColumn.name}\`)`
      : '';
    const commentSql = tableComment
      ? ` COMMENT='${String(tableComment).replace(/'/g, "''")}'`
      : '';
    const sql =
      `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n` +
      `  ${colDefs.join(',\n  ')}${pkSql}\n` +
      `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci${commentSql}`;
    await pool.query(sql);
    res.json({ ok: true, data: { tableName } });
  } catch (err) {
    next(err);
  }
});

// 表结构
router.get('/:table', async (req, res, next) => {
  try {
    const meta = await getTableMeta(req.params.table);
    res.json({ ok: true, data: meta });
  } catch (err) {
    next(err);
  }
});

// 新增字段
router.post('/:table/columns', async (req, res, next) => {
  try {
    const meta = await getTableMeta(req.params.table);
    const { name, type, length, nullable, autoIncrement, comment } = req.body || {};
    if (!name || !type) {
      return res.status(400).json({ ok: false, message: '字段名与类型必填' });
    }
    const def = buildColumnDef({ name, type, length, nullable, autoIncrement, comment });
    const pkSql = autoIncrement ? `, ADD PRIMARY KEY (\`${name}\`)` : '';
    await pool.query(
      `ALTER TABLE \`${meta.table}\` ADD COLUMN ${def}${pkSql}`
    );
    res.json({ ok: true, data: { column: name } });
  } catch (err) {
    next(err);
  }
});

// 修改字段(支持改名/改类型/改可空/改默认值/改注释)
router.put('/:table/columns/:column', async (req, res, next) => {
  try {
    const meta = await getTableMeta(req.params.table);
    const col = meta.columns.find((c) => c.COLUMN_NAME === req.params.column);
    if (!col) {
      return res.status(404).json({ ok: false, message: `字段不存在: ${req.params.column}` });
    }
    const body = req.body || {};
    const newName = body.newName || req.params.column;
    if (!COLUMN_NAME_RE.test(newName)) {
      return res.status(400).json({ ok: false, message: '非法字段名' });
    }
    let columnType = col.COLUMN_TYPE;
    if (body.type) {
      const upperType = String(body.type).toUpperCase();
      if (!TYPE_WHITELIST.has(upperType)) {
        return res.status(400).json({ ok: false, message: `不支持的字段类型: ${body.type}` });
      }
      columnType = upperType;
      if (LENGTH_TYPES.has(upperType) && body.length) {
        const len = parseInt(body.length, 10);
        if (len > 0) columnType += `(${len})`;
      }
    }
    const def = buildColumnDefFromMeta(col, {
      name: newName,
      columnType,
      nullable: body.nullable,
      defaultVal: body.defaultVal,
      comment: body.comment,
    });
    await pool.query(
      `ALTER TABLE \`${meta.table}\` CHANGE \`${req.params.column}\` ${def}`
    );
    res.json({ ok: true, data: { column: newName } });
  } catch (err) {
    next(err);
  }
});

// 删除字段
router.delete('/:table/columns/:column', async (req, res, next) => {
  try {
    const meta = await getTableMeta(req.params.table);
    if (meta.primaryKey === req.params.column) {
      return res.status(400).json({ ok: false, message: '不允许删除主键字段' });
    }
    await pool.query(
      `ALTER TABLE \`${meta.table}\` DROP COLUMN \`${req.params.column}\``
    );
    res.json({ ok: true, data: { column: req.params.column } });
  } catch (err) {
    next(err);
  }
});

// 字段影响分析(删除字段前查看受影响的表/字段)
router.get('/:table/columns/:column/refs', async (req, res, next) => {
  try {
    const meta = await getTableMeta(req.params.table);
    const column = meta.columns.find((c) => c.COLUMN_NAME === req.params.column);
    if (!column) {
      return res.status(404).json({ ok: false, message: `字段不存在: ${req.params.column}` });
    }
    // 1) 其他表中同名字段(程序逻辑/导入导出可能引用)
    const [sameName] = await pool.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_COMMENT
       FROM information_schema.columns
       WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = ?
         AND NOT (TABLE_NAME = ? AND COLUMN_NAME = ?)`,
      [DB_NAME(), column.COLUMN_NAME, meta.table, column.COLUMN_NAME]
    );
    // 2) 注释中声明引用本表本字段的逻辑外键
    const [fkRefs] = await pool.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_COMMENT
       FROM information_schema.columns
       WHERE TABLE_SCHEMA = ? AND COLUMN_COMMENT LIKE ?
         AND NOT (TABLE_NAME = ? AND COLUMN_NAME = ?)`,
      [DB_NAME(), `%${meta.table}.${column.COLUMN_NAME}%`, meta.table, column.COLUMN_NAME]
    );
    res.json({
      ok: true,
      data: {
        column,
        isPrimaryKey: meta.primaryKey === column.COLUMN_NAME,
        sameName,
        fkRefs,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 表数据(分页 + 模糊搜索)
router.get('/:table/data', async (req, res, next) => {
  try {
    const meta = await getTableMeta(req.params.table);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const search = (req.query.search || '').trim();
    const field = (req.query.field || '').trim();

    const stringColumns = meta.columns.filter((c) =>
      ['char', 'varchar', 'text', 'mediumtext', 'longtext', 'tinytext'].includes(c.DATA_TYPE)
    );

    let whereSql = '';
    const whereParams = [];
    if (search) {
      let targetColumn = null;
      if (field) {
        targetColumn = meta.columns.find((c) => c.COLUMN_NAME === field);
        if (!targetColumn) {
          return res.status(400).json({ ok: false, message: `搜索字段不存在: ${field}` });
        }
      }
      if (targetColumn) {
        whereSql = ` WHERE \`${targetColumn.COLUMN_NAME}\` LIKE ?`;
        whereParams.push(`%${search}%`);
      } else if (stringColumns.length > 0) {
        whereSql =
          ' WHERE ' +
          stringColumns.map((c) => `\`${c.COLUMN_NAME}\` LIKE ?`).join(' OR ');
        for (let i = 0; i < stringColumns.length; i++) whereParams.push(`%${search}%`);
      }
    }

    const orderBy = meta.primaryKey
      ? ` ORDER BY \`${meta.primaryKey}\` DESC`
      : '';

    const offset = (page - 1) * pageSize;
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM \`${meta.table}\`${whereSql}`,
      whereParams
    );
    const [rows] = await pool.query(
      `SELECT * FROM \`${meta.table}\`${whereSql}${orderBy} LIMIT ? OFFSET ?`,
      [...whereParams, pageSize, offset]
    );
    res.json({ ok: true, data: { rows, total, page, pageSize } });
  } catch (err) {
    next(err);
  }
});

// 批量导入
router.post('/:table/import', async (req, res, next) => {
  try {
    const meta = await getTableMeta(req.params.table);
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ ok: false, message: 'rows 必须为非空数组' });
    }
    if (rows.length > 1000) {
      return res.status(400).json({ ok: false, message: '单次导入不能超过 1000 行' });
    }
    const writable = getWritableColumns(meta, { forInsert: true });
    const columns = writable.filter((c) => rows.some((r) => r[c.COLUMN_NAME] !== undefined));
    if (columns.length === 0) {
      return res.status(400).json({ ok: false, message: '导入数据中没有可写入的字段' });
    }
    const colNames = columns.map((c) => `\`${c.COLUMN_NAME}\``);
    const placeholders = columns.map(() => '?').join(', ');
    const values = [];
    for (const row of rows) {
      for (const c of columns) {
        values.push(normalizeValue(row[c.COLUMN_NAME] ?? null));
      }
    }
    const valueGroups = rows.map(() => `(${placeholders})`).join(', ');
    const [result] = await pool.query(
      `INSERT INTO \`${meta.table}\` (${colNames.join(', ')}) VALUES ${valueGroups}`,
      values
    );
    res.json({ ok: true, data: { affectedRows: result.affectedRows } });
  } catch (err) {
    next(err);
  }
});

// 新增记录
router.post('/:table', async (req, res, next) => {
  try {
    const meta = await getTableMeta(req.params.table);
    const writable = getWritableColumns(meta, { forInsert: true });
    const body = req.body || {};
    const columns = writable.filter((c) => body[c.COLUMN_NAME] !== undefined);
    if (columns.length === 0) {
      return res.status(400).json({ ok: false, message: '没有可写入的字段' });
    }
    const colNames = columns.map((c) => `\`${c.COLUMN_NAME}\``);
    const values = columns.map((c) => normalizeValue(body[c.COLUMN_NAME]));
    const placeholders = columns.map(() => '?');
    const [result] = await pool.query(
      `INSERT INTO \`${meta.table}\` (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );
    res.json({ ok: true, data: { insertId: result.insertId, affectedRows: result.affectedRows } });
  } catch (err) {
    next(err);
  }
});

// 更新记录(按主键)
router.put('/:table/:id', async (req, res, next) => {
  try {
    const meta = await getTableMeta(req.params.table);
    if (!meta.primaryKey) {
      return res.status(400).json({ ok: false, message: '该表没有主键, 不支持按主键更新' });
    }
    const writable = getWritableColumns(meta, { forInsert: false });
    const body = req.body || {};
    const columns = writable.filter((c) => body[c.COLUMN_NAME] !== undefined);
    if (columns.length === 0) {
      return res.status(400).json({ ok: false, message: '没有可更新的字段' });
    }
    const setSql = columns.map((c) => `\`${c.COLUMN_NAME}\` = ?`).join(', ');
    const values = columns.map((c) => normalizeValue(body[c.COLUMN_NAME]));
    values.push(req.params.id);
    const [result] = await pool.query(
      `UPDATE \`${meta.table}\` SET ${setSql} WHERE \`${meta.primaryKey}\` = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: '记录不存在或内容未变化' });
    }
    res.json({ ok: true, data: { affectedRows: result.affectedRows } });
  } catch (err) {
    next(err);
  }
});

// 删除记录(按主键)
router.delete('/:table/:id', async (req, res, next) => {
  try {
    const meta = await getTableMeta(req.params.table);
    if (!meta.primaryKey) {
      return res.status(400).json({ ok: false, message: '该表没有主键, 不支持按主键删除' });
    }
    const [result] = await pool.query(
      `DELETE FROM \`${meta.table}\` WHERE \`${meta.primaryKey}\` = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: '记录不存在' });
    }
    res.json({ ok: true, data: { affectedRows: result.affectedRows } });
  } catch (err) {
    next(err);
  }
});

export default router;
