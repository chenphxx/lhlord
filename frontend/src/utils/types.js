/**
 * @brief 管理后台支持的字段类型白名单
 */
export const COLUMN_TYPES = [
    'BIGINT', 'INT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'FLOAT', 'DOUBLE',
    'CHAR', 'VARCHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
    'DATE', 'DATETIME', 'TIMESTAMP', 'JSON',
];

/**
 * @brief 需要声明长度的字段类型
 */
export const LENGTH_TYPES = ['CHAR', 'VARCHAR', 'DECIMAL'];
