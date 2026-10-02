<template>
    <el-container class="layout">
        <el-aside v-if="activeModule === 'tables'" width="252px" class="aside">
            <div class="brand">
                <div class="seal" aria-hidden="true">灵</div>
                <div class="brand-text">
                    <div class="brand-title">灵寰录</div>
                    <div class="brand-sub">管理后台 · 数据卷宗</div>
                </div>
            </div>

            <div class="table-actions">
                <el-button size="small" type="primary" plain :loading="loadingTables" @click="loadTables">
                    <el-icon><Refresh /></el-icon>
                    <span>刷新表列表</span>
                </el-button>
                <el-button size="small" type="warning" plain @click="openCreateTable">
                    <el-icon><Plus /></el-icon>
                    <span>新增表</span>
                </el-button>
                <el-button size="small" type="primary" plain @click="openAlchemy">
                    <el-icon><MagicStick /></el-icon>
                    <span>炼丹系统</span>
                </el-button>
                <el-button size="small" plain class="debug-btn" @click="openDebug">
                    <el-icon><Monitor /></el-icon>
                    <span>数据库调试</span>
                </el-button>
            </div>

            <div class="aside-label">
                <span class="label-line"></span>
                <span>数据卷宗</span>
                <span class="label-count">{{ tables.length }}</span>
            </div>

            <el-scrollbar class="menu-scroll">
                <div class="table-list">
                    <div
                        v-for="t in tables"
                        :key="t.TABLE_NAME"
                        class="table-item"
                        :class="{ active: t.TABLE_NAME === activeTable }"
                        @click="openTable(t.TABLE_NAME)"
                    >
                        <span class="seal-dot" aria-hidden="true"></span>
                        <div class="table-info">
                            <div class="table-name">{{ t.TABLE_NAME }}</div>
                            <div class="table-comment">{{ t.TABLE_COMMENT }}</div>
                        </div>
                    </div>
                    <el-empty v-if="tables.length === 0 && !loadingTables" description="暂无数据表" :image-size="60" />
                </div>
            </el-scrollbar>

            <div class="aside-foot">灵寰录 · v0.1</div>
        </el-aside>

        <el-container class="body">
            <el-header class="topbar" height="60px">
                <div v-if="activeModule === 'tables'" class="topbar-title">
                    <div class="eyebrow">灵寰录 · 管理后台</div>
                    <div class="title">数据卷宗</div>
                </div>
                <div class="topbar-right">
                    <span v-if="activeModule === 'tables'" class="db-chip">{{ tables.length }} 卷 · lhlord 库</span>
                    <el-tabs v-model="activeModule" class="module-tabs" @tab-change="onModuleTabChange">
                        <el-tab-pane label="修行" name="player" />
                        <el-tab-pane label="炼丹系统" name="alchemy" />
                        <el-tab-pane label="管理后台" name="tables" />
                    </el-tabs>
                    <el-tooltip :content="isDark ? '切换浅色模式' : '切换深色模式'" placement="left">
                        <el-button circle :icon="isDark ? Sunny : Moon" class="theme-btn" @click="toggleTheme" />
                    </el-tooltip>
                </div>
            </el-header>

            <el-main class="main" :class="{ 'alchemy-main': activeModule === 'alchemy' }">
                <GameView v-if="activeModule === 'player'" />
                <AlchemyView v-else-if="activeModule === 'alchemy'" @open-admin="openTableAdmin" />
                <TableData v-else-if="activeTable" :key="activeTable" :table-name="activeTable" />
                <div v-else class="empty-wrap">
                    <el-empty description="从左侧卷宗选择一张数据表" />
                </div>
            </el-main>
        </el-container>

        <!-- 新建数据表 -->
        <el-dialog v-model="tableDialogVisible" title="新建数据表" width="800px" destroy-on-close>
            <el-form label-width="80px">
                <el-form-item label="表名" required>
                    <el-input v-model="newTable.tableName" placeholder="仅字母/数字/下划线, 如 sect_log" />
                </el-form-item>
                <el-form-item label="表注释">
                    <el-input v-model="newTable.tableComment" placeholder="如: 门派日志表" />
                </el-form-item>
                <el-form-item label="字段定义">
                    <div class="column-editor">
                        <div v-for="(col, idx) in newColumns" :key="idx" class="column-row">
                            <el-input v-model="col.name" placeholder="字段名" style="width: 130px" />
                            <el-select v-model="col.type" style="width: 130px">
                                <el-option v-for="t in COLUMN_TYPES" :key="t" :label="t" :value="t" />
                            </el-select>
                            <el-input v-model="col.length" placeholder="长度" style="width: 80px" />
                            <el-checkbox v-model="col.nullable">可空</el-checkbox>
                            <el-checkbox v-model="col.autoIncrement">自增</el-checkbox>
                            <el-input v-model="col.comment" placeholder="注释" style="width: 170px" />
                            <el-button type="danger" link @click="newColumns.splice(idx, 1)">删除</el-button>
                        </div>
                        <el-button size="small" type="primary" plain @click="addColumnRow">
                            <el-icon><Plus /></el-icon>&nbsp;添加字段
                        </el-button>
                    </div>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="tableDialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="creating" @click="createTable">创建</el-button>
            </template>
        </el-dialog>

        <!-- 数据库调试 -->
        <el-dialog v-model="debugVisible" title="数据库调试(SQL 控制台)" width="940px" top="5vh">
            <el-alert
                type="info"
                :closable="false"
                title="仅允许只读查询(SELECT / SHOW / DESCRIBE / EXPLAIN / USE); 修改数据请使用各表的新增/编辑/导入功能。"
                style="margin-bottom: 10px"
            />
            <div class="debug-db-row">
                <span class="debug-db-label">当前数据库:</span>
                <el-select v-model="debugDb" style="width: 220px" @change="switchDebugDb">
                    <el-option v-for="db in debugDbs" :key="db" :label="db" :value="db" />
                </el-select>
            </div>
            <el-select
                v-model="debugExample"
                placeholder="选择示例语句"
                style="width: 100%; margin-bottom: 8px"
                @change="useDebugExample"
            >
                <el-option v-for="ex in debugExamples" :key="ex" :label="ex" :value="ex" />
            </el-select>
            <el-input
                v-model="debugSql"
                type="textarea"
                :rows="5"
                placeholder="输入 SQL 语句, 如: SELECT * FROM item LIMIT 20"
            />
            <div class="debug-actions">
                <el-button type="primary" :loading="debugRunning" @click="runDebug">执行</el-button>
                <el-button @click="debugSql = ''">清空</el-button>
            </div>
            <el-alert v-if="debugError" type="error" :closable="false" :title="debugError" style="margin-top: 10px" />
            <div v-if="debugResult" class="debug-result">
                <div class="debug-meta">
                    共 {{ debugResult.count }} 行<template v-if="debugResult.affectedRows !== undefined">, 影响 {{ debugResult.affectedRows }} 行</template>
                </div>
                <el-table :data="debugResult.rows" border size="small" max-height="360" class="lhl-table">
                    <el-table-column type="index" width="50" />
                    <el-table-column
                        v-for="col in debugResult.columns"
                        :key="col"
                        :prop="col"
                        :label="col"
                        min-width="120"
                        show-overflow-tooltip
                    />
                </el-table>
            </div>
        </el-dialog>
    </el-container>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { MagicStick, Monitor, Moon, Plus, Refresh, Sunny } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api from './api/index.js';
import TableData from './views/TableData.vue';
import AlchemyView from './views/AlchemyView.vue';
import GameView from './views/GameView.vue';
import { COLUMN_TYPES } from './utils/types.js';

const tables = ref([]);
const loadingTables = ref(false);
const activeTable = ref('');
const activeModule = ref('player');

// 主题切换
const isDark = ref(localStorage.getItem('lhlord-theme') === 'dark');

/**
 * @brief 应用主题并持久化选择
 *
 * @param {boolean} dark 是否为深色主题
 */
function applyTheme(dark)
{
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('lhlord-theme', dark ? 'dark' : 'light');
}
applyTheme(isDark.value);

function toggleTheme()
{
    isDark.value = !isDark.value;
    applyTheme(isDark.value);
}

/**
 * @brief 加载数据表列表, 并在管理模块下自动选中首张表
 */
async function loadTables()
{
    loadingTables.value = true;
    try
    {
        const { data } = await api.get('/tables');
        tables.value = data.data;
        if (activeModule.value === 'tables' && !activeTable.value && tables.value.length > 0)
        {
            activeTable.value = tables.value[0].TABLE_NAME;
        }
    }
    catch (err)
    {
        ElMessage.error(`获取数据表列表失败: ${err.response?.data?.message || err.message}`);
    }
    finally
    {
        loadingTables.value = false;
    }
}

function openTable(tableName)
{
    activeModule.value = 'tables';
    activeTable.value = tableName;
}

function openAlchemy()
{
    activeModule.value = 'alchemy';
    activeTable.value = '';
}

function openTableAdmin()
{
    activeModule.value = 'tables';
    if (!activeTable.value && tables.value.length > 0)
    {
        activeTable.value = tables.value[0].TABLE_NAME;
    }
}

function onModuleTabChange(name)
{
    if (name === 'player')
    {
        activeTable.value = '';
    }
    else if (name === 'alchemy')
    {
        openAlchemy();
    }
    else
    {
        openTableAdmin();
    }
}

// 新建表
const tableDialogVisible = ref(false);
const creating = ref(false);
const newTable = reactive({ tableName: '', tableComment: '' });
const newColumns = ref([
    { name: 'id', type: 'BIGINT', length: '', nullable: false, autoIncrement: true, comment: '主键' },
]);

function openCreateTable()
{
    newTable.tableName = '';
    newTable.tableComment = '';
    newColumns.value = [
        { name: 'id', type: 'BIGINT', length: '', nullable: false, autoIncrement: true, comment: '主键' },
    ];
    tableDialogVisible.value = true;
}

function addColumnRow()
{
    newColumns.value.push({
        name: '',
        type: 'VARCHAR',
        length: '64',
        nullable: true,
        autoIncrement: false,
        comment: '',
    });
}

/**
 * @brief 校验表单后提交新建数据表请求
 */
async function createTable()
{
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(newTable.tableName))
    {
        ElMessage.warning('表名需以字母开头, 只能包含字母/数字/下划线');
        return;
    }
    if (newColumns.value.length === 0)
    {
        ElMessage.warning('至少需要一个字段');
        return;
    }
    const names = newColumns.value.map((c) => c.name);
    if (names.some((n) => !n) || newColumns.value.some((c) => !c.type))
    {
        ElMessage.warning('字段名与字段类型必填');
        return;
    }
    if (new Set(names).size !== names.length)
    {
        ElMessage.warning('字段名不能重复');
        return;
    }
    if (newColumns.value.filter((c) => c.autoIncrement).length > 1)
    {
        ElMessage.warning('只能有一个自增字段');
        return;
    }
    creating.value = true;
    try
    {
        const { data } = await api.post('/tables', {
            tableName: newTable.tableName,
            tableComment: newTable.tableComment,
            columns: newColumns.value,
        });
        ElMessage.success(`表 ${data.data.tableName} 创建成功`);
        tableDialogVisible.value = false;
        await loadTables();
        activeTable.value = data.data.tableName;
    }
    catch (err)
    {
        ElMessage.error(`创建失败: ${err.response?.data?.message || err.message}`);
    }
    finally
    {
        creating.value = false;
    }
}

// 数据库调试
const debugVisible = ref(false);
const debugSql = ref('');
const debugExample = ref('');
const debugRunning = ref(false);
const debugError = ref('');
const debugResult = ref(null);
const debugDbs = ref([]);
const debugDb = ref('lhlord');
const debugExamples = [
    'SELECT * FROM item LIMIT 20',
    'SELECT i.item_name, h.main_effect, h.secondary_effect, h.guide_effect FROM item i JOIN herb h ON h.item_id = i.item_id LIMIT 20',
    'SELECT c.character_name, r.race_name, s.sect_name, p.position_name FROM `character` c JOIN race r ON r.race_id = c.race_id JOIN sect_member sm ON sm.character_id = c.character_id JOIN sect s ON s.sect_id = sm.sect_id JOIN sect_position p ON p.position_id = sm.position_id LIMIT 20',
    'SHOW TABLES',
    "SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.tables WHERE TABLE_SCHEMA = 'lhlord' ORDER BY TABLE_NAME",
];

function openDebug()
{
    debugVisible.value = true;
    debugError.value = '';
    loadDebugDatabases();
}

/**
 * @brief 加载可用于调试的数据库列表
 */
async function loadDebugDatabases()
{
    try
    {
        const { data } = await api.get('/debug/databases');
        debugDbs.value = data.data.databases;
        debugDb.value = data.data.current;
    }
    catch (err)
    {
        ElMessage.error(`获取数据库列表失败: ${err.response?.data?.message || err.message}`);
    }
}

/**
 * @brief 切换调试数据库
 *
 * @param {string} db 目标数据库名
 */
async function switchDebugDb(db)
{
    try
    {
        const { data } = await api.post('/debug/use', { database: db });
        debugDb.value = data.data.current;
        ElMessage.success(`已切换到数据库 ${debugDb.value}`);
        debugResult.value = null;
    }
    catch (err)
    {
        debugDb.value = '';
        ElMessage.error(`切换失败: ${err.response?.data?.message || err.message}`);
        loadDebugDatabases();
    }
}

function useDebugExample(val)
{
    if (val) debugSql.value = val;
}

/**
 * @brief 提交调试 SQL 并展示执行结果
 */
async function runDebug()
{
    if (!debugSql.value.trim())
    {
        debugError.value = 'SQL 不能为空';
        return;
    }
    debugRunning.value = true;
    debugError.value = '';
    debugResult.value = null;
    try
    {
        const { data } = await api.post('/debug/query', { sql: debugSql.value });
        debugResult.value = data.data;
        if (data.data.current) debugDb.value = data.data.current;
    }
    catch (err)
    {
        debugError.value = err.response?.data?.message || err.message;
    }
    finally
    {
        debugRunning.value = false;
    }
}

onMounted(loadTables);
</script>

<style>
html,
body,
#app {
    height: 100%;
    margin: 0;
}
</style>

<style scoped>
.layout {
    height: 100%;
}

/* ---------- 玄墨侧栏 ---------- */
.aside {
    background: linear-gradient(180deg, var(--lhl-aside-from) 0%, var(--lhl-aside-to) 100%);
    color: var(--lhl-aside-text);
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--lhl-aside-border);
}

.brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 16px 14px;
}
.seal {
    width: 42px;
    height: 42px;
    border-radius: 6px;
    background: var(--lhl-cinnabar);
    color: #f5efe4;
    font-family: var(--lhl-font-display);
    font-size: 24px;
    line-height: 42px;
    text-align: center;
    box-shadow: inset 0 0 0 2px rgba(245, 239, 228, 0.35), 0 3px 8px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
}
.brand-title {
    font-family: var(--lhl-font-display);
    font-size: 22px;
    letter-spacing: 6px;
    color: var(--lhl-aside-text-strong);
}
.brand-sub {
    font-size: 11px;
    color: var(--lhl-aside-text-muted);
    letter-spacing: 2px;
    margin-top: 2px;
}

.table-actions {
    padding: 4px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-bottom: 1px solid var(--lhl-aside-border);
}
.table-actions :deep(.el-button) {
    width: 100%;
    margin-left: 0;
    letter-spacing: 1px;
}
.table-actions :deep(.el-button--primary.is-plain) {
    --el-button-bg-color: rgba(44, 140, 122, 0.1);
    --el-button-border-color: rgba(44, 140, 122, 0.4);
    --el-button-text-color: var(--lhl-jade-deep);
    --el-button-hover-bg-color: rgba(44, 140, 122, 0.18);
    --el-button-hover-border-color: var(--lhl-jade);
    --el-button-hover-text-color: var(--lhl-jade-deep);
}
.table-actions :deep(.el-button--warning.is-plain) {
    --el-button-bg-color: rgba(201, 162, 39, 0.12);
    --el-button-border-color: rgba(201, 162, 39, 0.38);
    --el-button-text-color: #8a6d18;
    --el-button-hover-bg-color: rgba(201, 162, 39, 0.2);
    --el-button-hover-border-color: var(--lhl-gold);
    --el-button-hover-text-color: #6e5712;
}
.table-actions :deep(.debug-btn) {
    --el-button-bg-color: rgba(13, 27, 30, 0.04);
    --el-button-border-color: rgba(13, 27, 30, 0.14);
    --el-button-text-color: var(--lhl-text-2);
    --el-button-hover-bg-color: rgba(13, 27, 30, 0.08);
    --el-button-hover-border-color: rgba(13, 27, 30, 0.28);
    --el-button-hover-text-color: var(--lhl-text);
}
html.dark .table-actions :deep(.el-button--primary.is-plain) {
    --el-button-bg-color: rgba(45, 212, 191, 0.1);
    --el-button-border-color: rgba(45, 212, 191, 0.45);
    --el-button-text-color: #5eead4;
    --el-button-hover-bg-color: rgba(45, 212, 191, 0.18);
    --el-button-hover-border-color: var(--lhl-jade);
    --el-button-hover-text-color: #99f6e4;
}
html.dark .table-actions :deep(.el-button--warning.is-plain) {
    --el-button-bg-color: rgba(251, 191, 36, 0.1);
    --el-button-border-color: rgba(251, 191, 36, 0.4);
    --el-button-text-color: #fcd34d;
    --el-button-hover-bg-color: rgba(251, 191, 36, 0.16);
    --el-button-hover-border-color: var(--lhl-gold);
    --el-button-hover-text-color: #fde68a;
}
html.dark .table-actions :deep(.debug-btn) {
    --el-button-bg-color: rgba(255, 255, 255, 0.04);
    --el-button-border-color: rgba(255, 255, 255, 0.16);
    --el-button-text-color: #b7c2cb;
    --el-button-hover-bg-color: rgba(255, 255, 255, 0.09);
    --el-button-hover-border-color: rgba(255, 255, 255, 0.3);
    --el-button-hover-text-color: #e6edf3;
}

.aside-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 8px;
    font-family: var(--lhl-font-display);
    font-size: 14px;
    letter-spacing: 3px;
    color: var(--lhl-aside-text-muted);
}
.label-line {
    width: 16px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--lhl-gold));
}
.label-count {
    margin-left: auto;
    font-family: var(--lhl-font-mono);
    font-size: 11px;
    color: var(--lhl-gold);
    border: 1px solid var(--lhl-gold);
    opacity: 0.82;
    border-radius: 3px;
    padding: 0 6px;
    line-height: 18px;
}

.menu-scroll {
    flex: 1;
}
.table-list {
    padding: 2px 8px 12px;
}
.table-item {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 3px;
    border-left: 3px solid transparent;
    transition: background 0.15s, border-color 0.15s;
}
.table-item:hover {
    background: var(--lhl-aside-hover);
}
.table-item.active {
    background: linear-gradient(90deg, var(--lhl-aside-active-from), var(--lhl-aside-active-to));
    border-left-color: var(--lhl-jade);
}
.seal-dot {
    width: 7px;
    height: 7px;
    border-radius: 2px;
    border: 1px solid var(--lhl-aside-text-muted);
    margin-top: 6px;
    flex-shrink: 0;
}
.table-item.active .seal-dot {
    background: var(--lhl-cinnabar);
    border-color: var(--lhl-cinnabar);
    box-shadow: 0 0 0 2px rgba(208, 96, 76, 0.18);
}
.table-name {
    font-family: var(--lhl-font-mono);
    font-size: 13px;
    color: var(--lhl-aside-text-strong);
    word-break: break-all;
}
.table-item.active .table-name {
    color: var(--lhl-aside-text-strong);
    font-weight: 600;
}
.table-comment {
    font-family: var(--lhl-font-display);
    font-size: 12px;
    color: var(--lhl-aside-text-muted);
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.table-item.active .table-comment {
    color: var(--lhl-aside-text-muted);
}
.aside-foot {
    padding: 12px 16px;
    font-size: 11px;
    font-family: var(--lhl-font-mono);
    color: var(--lhl-aside-text-faint);
    border-top: 1px solid var(--lhl-aside-border);
}

/* ---------- 月白主体 ---------- */
.body {
    background: var(--lhl-paper);
}
.topbar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--lhl-panel);
    border-bottom: 1px solid var(--lhl-line);
    padding: 0 20px;
}
.eyebrow {
    font-family: var(--lhl-font-display);
    font-size: 12px;
    letter-spacing: 4px;
    color: var(--lhl-gold);
}
.title {
    font-family: var(--lhl-font-display);
    font-size: 22px;
    letter-spacing: 5px;
    color: var(--lhl-text);
    margin-top: 1px;
}
.topbar-right {
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
}
.module-tabs {
    --el-tabs-header-height: 34px;
}
.module-tabs :deep(.el-tabs__item) {
    font-family: var(--lhl-font-display);
    letter-spacing: 2px;
    color: var(--lhl-text-2);
}
.module-tabs :deep(.el-tabs__item.is-active) {
    color: var(--lhl-jade-deep);
}
.db-chip {
    font-family: var(--lhl-font-mono);
    font-size: 12px;
    color: var(--lhl-jade-deep);
    border: 1px solid var(--lhl-jade);
    background: var(--lhl-jade-soft);
    border-radius: 4px;
    padding: 3px 10px;
    letter-spacing: 0.5px;
}
.theme-btn {
    position: relative;
    border-color: var(--lhl-line);
}

.main {
    padding: 16px 20px 20px;
    overflow: auto;
}
.main.alchemy-main {
    overflow: hidden;
}
.empty-wrap {
    background: var(--lhl-panel);
    border: 1px solid var(--lhl-line);
    border-radius: 8px;
    min-height: calc(100vh - 110px);
    display: flex;
    align-items: center;
    justify-content: center;
}

/* ---------- 弹窗 ---------- */
.column-editor {
    width: 100%;
}
.column-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
.debug-actions {
    margin-top: 10px;
}
.debug-db-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}
.debug-db-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
}
.debug-result {
    margin-top: 12px;
}
.debug-meta {
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
}

/* 窄屏适配 */
@media (max-width: 960px) {
    .layout :deep(.el-aside) {
        width: 200px !important;
    }
    .brand-sub,
    .table-comment {
        display: none;
    }
    .main {
        padding: 12px;
    }
}
</style>
