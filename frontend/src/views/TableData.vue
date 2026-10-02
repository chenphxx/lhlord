<template>
    <div class="table-data">
        <div class="toolbar">
            <div class="toolbar-left">
                <el-tag size="large" type="primary" effect="dark" class="table-chip">{{ tableName }}</el-tag>
                <el-button size="small" @click="openSchema">表结构</el-button>
            </div>
            <div class="toolbar-right">
                <el-select v-model="searchField" style="width: 170px" @change="reload(1)">
                    <el-option label="全部字段" value="" />
                    <el-option
                        v-for="c in schema.columns"
                        :key="c.COLUMN_NAME"
                        :label="c.COLUMN_NAME"
                        :value="c.COLUMN_NAME"
                    />
                </el-select>
                <el-input
                    v-model="search"
                    placeholder="模糊搜索..."
                    clearable
                    style="width: 200px"
                    @keyup.enter="reload(1)"
                    @clear="reload(1)"
                />
                <el-button type="primary" @click="reload(1)">查询</el-button>
                <el-dropdown trigger="click" @command="exportFile">
                    <el-button :disabled="selectedRows.length === 0">
                        导出选中({{ selectedRows.length }})<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                    </el-button>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
                            <el-dropdown-item command="json">导出 JSON</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
                <el-button @click="fileInput.click()">导入</el-button>
                <el-popover placement="bottom" :width="380" trigger="click">
                    <template #reference>
                        <el-button circle size="small" type="info" plain>?</el-button>
                    </template>
                    <div class="import-help">
                        <p class="help-title">导入文件要求</p>
                        <ul>
                            <li>支持 <b>.csv</b> / <b>.json</b> 两种格式</li>
                            <li>CSV: 首行为字段名(需与表字段一致), 之后每行一条记录; 建议 UTF-8 编码</li>
                            <li>JSON: 对象数组, 键为字段名</li>
                            <li>自增主键与 create_time / update_time 自动忽略, 无需提供</li>
                            <li>单元格为空视为 NULL; 单次最多 1000 行</li>
                        </ul>
                    </div>
                </el-popover>
                <input ref="fileInput" type="file" accept=".json,.csv" style="display: none" @change="onImportFile" />
                <el-button type="success" @click="openAdd">新增</el-button>
                <el-button @click="loadData">刷新</el-button>
            </div>
        </div>

        <el-table
            v-loading="loading"
            :data="rows"
            border
            stripe
            class="data-table lhl-table"
            @selection-change="selectedRows = $event"
        >
            <el-table-column type="selection" width="45" fixed="left" />
            <el-table-column type="index" label="#" width="50" />
            <el-table-column
                v-for="col in schema.columns"
                :key="col.COLUMN_NAME"
                :prop="col.COLUMN_NAME"
                :label="col.COLUMN_NAME"
                min-width="150"
                show-overflow-tooltip
            >
                <template #header>
                    <el-tooltip
                        :content="`${col.COLUMN_TYPE}${col.COLUMN_COMMENT ? ' · ' + col.COLUMN_COMMENT : ''}`"
                        placement="top"
                    >
                        <span>{{ col.COLUMN_NAME }}</span>
                    </el-tooltip>
                </template>
                <template #default="{ row }">
                    <span class="cell-value">{{ formatCell(row[col.COLUMN_NAME]) }}</span>
                    <el-button
                        class="copy-btn"
                        link
                        size="small"
                        :icon="CopyDocument"
                        @click.stop="copyValue(row[col.COLUMN_NAME])"
                    />
                </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                    <el-button size="small" @click="openEdit(row)">编辑</el-button>
                    <el-button size="small" type="danger" @click="removeRow(row)">删除</el-button>
                </template>
            </el-table-column>
        </el-table>

        <div class="pager">
            <el-pagination
                v-model:current-page="page"
                v-model:page-size="pageSize"
                :total="total"
                :page-sizes="[10, 20, 50, 100]"
                layout="total, sizes, prev, pager, next, jumper"
                @current-change="loadData"
                @size-change="reload(1)"
            />
        </div>

        <!-- 记录新增/编辑弹窗 -->
        <el-dialog
            v-model="dialogVisible"
            :title="editMode === 'add' ? `新增记录 - ${tableName}` : `编辑记录 - ${tableName}`"
            width="680px"
            destroy-on-close
        >
            <el-form label-width="180px" label-position="right">
                <el-form-item
                    v-for="col in formColumns"
                    :key="col.COLUMN_NAME"
                    :label="colLabel(col)"
                    :required="isRequired(col)"
                >
                    <el-switch
                        v-if="isBoolean(col)"
                        v-model="form[col.COLUMN_NAME]"
                        :disabled="!col.editable"
                        :active-value="1"
                        :inactive-value="0"
                    />
                    <el-input-number
                        v-else-if="isNumber(col)"
                        v-model="form[col.COLUMN_NAME]"
                        :disabled="!col.editable"
                        :step="isInteger(col) ? 1 : 0.01"
                        :precision="isInteger(col) ? 0 : undefined"
                        controls-position="right"
                        style="width: 100%"
                    />
                    <el-date-picker
                        v-else-if="isDate(col)"
                        v-model="form[col.COLUMN_NAME]"
                        :disabled="!col.editable"
                        :type="datePickerType(col)"
                        :value-format="dateValueFormat(col)"
                        style="width: 100%"
                    />
                    <el-input
                        v-else
                        v-model="form[col.COLUMN_NAME]"
                        :disabled="!col.editable"
                        :type="isLongText(col) ? 'textarea' : 'text'"
                        :rows="isLongText(col) ? 3 : 1"
                        :placeholder="col.COLUMN_COMMENT || col.COLUMN_NAME"
                    />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="save">保存</el-button>
            </template>
        </el-dialog>

        <!-- 表结构抽屉(支持编辑字段) -->
        <el-drawer v-model="schemaVisible" :title="`表结构 - ${tableName}`" size="720px">
            <div class="schema-toolbar">
                <el-button size="small" type="primary" @click="openAddColumn">新增字段</el-button>
                <el-button size="small" @click="loadSchema">刷新结构</el-button>
            </div>
            <el-table :data="schema.columns" border size="small" class="lhl-table">
                <el-table-column prop="COLUMN_NAME" label="字段" min-width="120" />
                <el-table-column prop="COLUMN_TYPE" label="类型" width="120" />
                <el-table-column prop="IS_NULLABLE" label="可空" width="60">
                    <template #default="{ row }">{{ row.IS_NULLABLE === 'NO' ? '否' : '是' }}</template>
                </el-table-column>
                <el-table-column prop="COLUMN_KEY" label="键" width="55" />
                <el-table-column prop="COLUMN_DEFAULT" label="默认值" width="100" show-overflow-tooltip />
                <el-table-column prop="COLUMN_COMMENT" label="注释" min-width="120" show-overflow-tooltip />
                <el-table-column label="操作" width="130" fixed="right">
                    <template #default="{ row }">
                        <el-button size="small" @click="openEditColumn(row)">编辑</el-button>
                        <el-button size="small" type="danger" @click="dropColumn(row)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-drawer>

        <!-- 字段编辑弹窗 -->
        <el-dialog
            v-model="columnDialogVisible"
            :title="columnEditMode === 'add' ? `新增字段 - ${tableName}` : `编辑字段 - ${tableName}`"
            width="520px"
            destroy-on-close
        >
            <el-form label-width="90px">
                <el-form-item label="字段名" required>
                    <el-input v-model="columnForm.name" placeholder="仅字母/数字/下划线" />
                </el-form-item>
                <el-form-item label="类型" required>
                    <el-select v-model="columnForm.type" style="width: 100%">
                        <el-option v-for="t in COLUMN_TYPES" :key="t" :label="t" :value="t" />
                    </el-select>
                </el-form-item>
                <el-form-item v-if="LENGTH_TYPES.includes(columnForm.type)" label="长度">
                    <el-input v-model="columnForm.length" placeholder="如 64 / 10,2" />
                </el-form-item>
                <el-form-item label="可空">
                    <el-switch v-model="columnForm.nullable" />
                </el-form-item>
                <el-form-item label="默认值">
                    <el-input v-model="columnForm.defaultVal" placeholder="留空表示无默认值" />
                </el-form-item>
                <el-form-item label="注释">
                    <el-input v-model="columnForm.comment" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="columnDialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="columnSaving" @click="saveColumn">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { computed, h, onMounted, ref } from 'vue';
import { ArrowDown, CopyDocument } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../api/index.js';
import { COLUMN_TYPES, LENGTH_TYPES } from '../utils/types.js';

const props = defineProps({
    tableName: { type: String, required: true },
});

const schema = ref({ table: '', primaryKey: null, columns: [] });
const rows = ref([]);
const selectedRows = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const search = ref('');
const searchField = ref('');
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const schemaVisible = ref(false);
const editMode = ref('add');
const form = ref({});
const pkValue = ref(null);
const fileInput = ref(null);

// 字段编辑状态
const columnDialogVisible = ref(false);
const columnSaving = ref(false);
const columnEditMode = ref('add');
const columnForm = ref({ name: '', type: 'VARCHAR', length: '64', nullable: true, defaultVal: '', comment: '' });
const editingColumnName = ref('');

const SKIP_COLUMNS = new Set(['create_time', 'update_time']);

const isInteger = (col) => ['bigint', 'int', 'smallint', 'mediumint', 'tinyint'].includes(col.DATA_TYPE);
const isDecimal = (col) => ['decimal', 'float', 'double', 'numeric'].includes(col.DATA_TYPE);
const isNumber = (col) => isInteger(col) || isDecimal(col);
const isBoolean = (col) => col.DATA_TYPE === 'tinyint' && String(col.COLUMN_TYPE).includes('(1)');
const isDate = (col) => ['datetime', 'timestamp', 'date', 'time'].includes(col.DATA_TYPE);
const isLongText = (col) => ['text', 'mediumtext', 'longtext', 'tinytext', 'json'].includes(col.DATA_TYPE);

function formatCell(value)
{
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
}

/**
 * @brief 复制单元格内容到剪贴板
 *
 * @param {*} value 待复制的值
 */
async function copyValue(value)
{
    const text = value === null || value === undefined ? '' : String(value);
    try
    {
        await navigator.clipboard.writeText(text);
        ElMessage.success('已复制');
    }
    catch
    {
        ElMessage.error('复制失败, 请手动选择复制');
    }
}

const datePickerType = (col) => (col.DATA_TYPE === 'date' ? 'date' : col.DATA_TYPE === 'time' ? 'time' : 'datetime');
const dateValueFormat = (col) =>
    col.DATA_TYPE === 'date' ? 'YYYY-MM-DD' : col.DATA_TYPE === 'time' ? 'HH:mm:ss' : 'YYYY-MM-DD HH:mm:ss';

const formColumns = computed(() =>
    schema.value.columns
        .filter((c) => !SKIP_COLUMNS.has(c.COLUMN_NAME))
        .map((c) =>
        {
            const autoInc = !!(c.EXTRA && c.EXTRA.includes('auto_increment'));
            return {
                ...c,
                editable: editMode.value === 'add' ? !autoInc : c.COLUMN_KEY !== 'PRI',
            };
        })
);

const colLabel = (col) => (col.COLUMN_COMMENT ? `${col.COLUMN_COMMENT} (${col.COLUMN_NAME})` : col.COLUMN_NAME);
const isRequired = (col) =>
    col.IS_NULLABLE === 'NO' && col.COLUMN_DEFAULT === null && !(col.EXTRA && col.EXTRA.includes('auto_increment'));

/**
 * @brief 加载当前表的结构元数据
 */
async function loadSchema()
{
    const { data } = await api.get(`/tables/${props.tableName}`);
    schema.value = data.data;
}

/**
 * @brief 按当前分页与搜索条件加载表数据
 */
async function loadData()
{
    loading.value = true;
    try
    {
        const { data } = await api.get(`/tables/${props.tableName}/data`, {
            params: { page: page.value, pageSize: pageSize.value, search: search.value, field: searchField.value },
        });
        rows.value = data.data.rows;
        total.value = data.data.total;
    }
    catch (err)
    {
        ElMessage.error(`加载数据失败: ${err.response?.data?.message || err.message}`);
    }
    finally
    {
        loading.value = false;
    }
}

function reload(p)
{
    page.value = p || 1;
    return loadData();
}

function openSchema()
{
    loadSchema();
    schemaVisible.value = true;
}

/**
 * @brief 依据表结构生成新增记录的默认表单
 *
 * @return {object} 以字段名为键的默认值集合
 */
function emptyForm()
{
    const f = {};
    for (const col of schema.value.columns)
    {
        if (col.EXTRA && col.EXTRA.includes('auto_increment')) continue;
        if (SKIP_COLUMNS.has(col.COLUMN_NAME)) continue;
        if (col.COLUMN_DEFAULT !== null && col.COLUMN_DEFAULT !== undefined)
        {
            f[col.COLUMN_NAME] = col.COLUMN_DEFAULT;
        }
        else
        {
            f[col.COLUMN_NAME] = isBoolean(col) ? 0 : null;
        }
    }
    return f;
}

function openAdd()
{
    editMode.value = 'add';
    pkValue.value = null;
    form.value = emptyForm();
    dialogVisible.value = true;
}

function openEdit(row)
{
    editMode.value = 'edit';
    pkValue.value = row[schema.value.primaryKey];
    form.value = { ...row };
    dialogVisible.value = true;
}

/**
 * @brief 校验并提交记录的新增或更新请求
 */
async function save()
{
    for (const col of formColumns.value)
    {
        const v = form.value[col.COLUMN_NAME];
        if (isRequired(col) && (v === null || v === undefined || v === ''))
        {
            ElMessage.warning(`字段 ${col.COLUMN_NAME} 为必填`);
            return;
        }
    }
    const payload = {};
    for (const col of formColumns.value)
    {
        if (!col.editable) continue;
        payload[col.COLUMN_NAME] = form.value[col.COLUMN_NAME] ?? null;
    }
    saving.value = true;
    try
    {
        if (editMode.value === 'add')
        {
            await api.post(`/tables/${props.tableName}`, payload);
            ElMessage.success('新增成功');
        }
        else
        {
            await api.put(`/tables/${props.tableName}/${pkValue.value}`, payload);
            ElMessage.success('更新成功');
        }
        dialogVisible.value = false;
        await loadData();
    }
    catch (err)
    {
        ElMessage.error(`保存失败: ${err.response?.data?.message || err.message}`);
    }
    finally
    {
        saving.value = false;
    }
}

/**
 * @brief 确认后按主键删除记录
 *
 * @param {object} row 待删除的行数据
 */
async function removeRow(row)
{
    try
    {
        await ElMessageBox.confirm(
            `确认删除「${props.tableName}」中主键 ${schema.value.primaryKey}=${row[schema.value.primaryKey]} 的记录?`,
            '删除确认',
            { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
        );
    }
    catch
    {
        return;
    }
    try
    {
        await api.delete(`/tables/${props.tableName}/${row[schema.value.primaryKey]}`);
        ElMessage.success('删除成功');
        await loadData();
    }
    catch (err)
    {
        ElMessage.error(`删除失败: ${err.response?.data?.message || err.message}`);
    }
}

// 导出
/**
 * @brief 将记录转换为带 BOM 的 CSV 文本
 *
 * @param {Array} exportRows 待导出的记录
 * @param {Array} cols 列元数据
 * @return {string} CSV 文本
 */
function toCsv(exportRows, cols)
{
    const header = cols.map((c) => c.COLUMN_NAME);
    const lines = [header];
    for (const row of exportRows)
    {
        lines.push(
            header.map((h) =>
            {
                let v = row[h];
                if (v === null || v === undefined) return '';
                v = String(v);
                if (/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
                return v;
            })
        );
    }
    return '\uFEFF' + lines.map((l) => l.join(',')).join('\r\n');
}

/**
 * @brief 将勾选记录导出为 CSV 或 JSON 文件
 *
 * @param {string} type 导出格式, 取值为 csv 或 json
 */
function exportFile(type)
{
    if (selectedRows.value.length === 0)
    {
        ElMessage.warning('请先勾选要导出的记录');
        return;
    }
    let content;
    let mime;
    let ext;
    if (type === 'csv')
    {
        content = toCsv(selectedRows.value, schema.value.columns);
        mime = 'text/csv;charset=utf-8';
        ext = 'csv';
    }
    else
    {
        content = JSON.stringify(selectedRows.value, null, 2);
        mime = 'application/json';
        ext = 'json';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.tableName}_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
}

// 导入
/**
 * @brief 解析 CSV 文本, 支持引号包裹与转义
 *
 * @param {string} text CSV 原文
 * @return {Array<Array<string>>} 解析后的二维数组
 */
function parseCsv(text)
{
    const src = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < src.length; i++)
    {
        const ch = src[i];
        if (inQuotes)
        {
            if (ch === '"')
            {
                if (src[i + 1] === '"')
                {
                    field += '"';
                    i++;
                }
                else
                {
                    inQuotes = false;
                }
            }
            else
            {
                field += ch;
            }
        }
        else if (ch === '"')
        {
            inQuotes = true;
        }
        else if (ch === ',')
        {
            row.push(field);
            field = '';
        }
        else if (ch === '\n' || ch === '\r')
        {
            if (ch === '\r' && src[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            if (row.some((x) => x !== '')) rows.push(row);
            row = [];
        }
        else
        {
            field += ch;
        }
    }
    row.push(field);
    if (row.some((x) => x !== '')) rows.push(row);
    return rows;
}

/**
 * @brief 读取并解析所选文件, 确认后批量导入
 *
 * @param {Event} e 文件输入框的 change 事件
 */
async function onImportFile(e)
{
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    let rows = [];
    try
    {
        if (file.name.endsWith('.json'))
        {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) throw new Error('JSON 内容应为对象数组');
            rows = parsed;
        }
        else if (file.name.endsWith('.csv'))
        {
            const parsed = parseCsv(text);
            if (parsed.length < 2) throw new Error('CSV 至少需要表头与一行数据');
            const headers = parsed[0].map((h) => h.trim());
            rows = parsed.slice(1).map((r) =>
            {
                const obj = {};
                headers.forEach((h, idx) =>
                {
                    obj[h] = (r[idx] ?? '').trim();
                });
                return obj;
            });
        }
        else
        {
            throw new Error('仅支持 .json / .csv 文件');
        }
        if (rows.length === 0) throw new Error('文件中没有数据');
    }
    catch (err)
    {
        ElMessage.error(`解析文件失败: ${err.message}`);
        e.target.value = '';
        return;
    }
    try
    {
        await ElMessageBox.confirm(
            `确认导入 ${rows.length} 条记录到「${props.tableName}」?\n导入为新增数据, 不会覆盖已有记录。\n要求: 字段名需与表字段一致, 自增主键与 create_time/update_time 无需提供, 空单元格视为 NULL。`,
            '导入确认',
            { type: 'info', confirmButtonText: '导入', cancelButtonText: '取消' }
        );
    }
    catch
    {
        e.target.value = '';
        return;
    }
    try
    {
        const { data } = await api.post(`/tables/${props.tableName}/import`, { rows });
        ElMessage.success(`导入成功: ${data.data.affectedRows} 条`);
        await loadData();
    }
    catch (err)
    {
        ElMessage.error(`导入失败: ${err.response?.data?.message || err.message}`);
    }
    finally
    {
        e.target.value = '';
    }
}

// 字段编辑
function extractLength(columnType)
{
    const m = /\((\d+)(?:,\d+)?\)/.exec(columnType || '');
    return m ? m[1] : '';
}

function openAddColumn()
{
    columnEditMode.value = 'add';
    editingColumnName.value = '';
    columnForm.value = { name: '', type: 'VARCHAR', length: '64', nullable: true, defaultVal: '', comment: '' };
    columnDialogVisible.value = true;
}

function openEditColumn(col)
{
    columnEditMode.value = 'edit';
    editingColumnName.value = col.COLUMN_NAME;
    columnForm.value = {
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE.toUpperCase(),
        length: extractLength(col.COLUMN_TYPE),
        nullable: col.IS_NULLABLE === 'YES',
        defaultVal: col.COLUMN_DEFAULT === null || col.COLUMN_DEFAULT === undefined ? '' : String(col.COLUMN_DEFAULT),
        comment: col.COLUMN_COMMENT || '',
    };
    columnDialogVisible.value = true;
}

/**
 * @brief 校验并提交字段的新增或修改请求
 */
async function saveColumn()
{
    const f = columnForm.value;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(f.name))
    {
        ElMessage.warning('字段名需以字母/下划线开头, 只能包含字母/数字/下划线');
        return;
    }
    if (!f.type)
    {
        ElMessage.warning('请选择字段类型');
        return;
    }
    let critical = false;
    let criticalText = '';
    if (columnEditMode.value === 'add')
    {
        criticalText = `新增字段「${f.name}」(${f.type})。该操作会修改表结构, 确认继续?`;
        critical = true;
    }
    else
    {
        const original = schema.value.columns.find((c) => c.COLUMN_NAME === editingColumnName.value);
        const typeChanged = f.type.toUpperCase() !== (original.DATA_TYPE || '').toUpperCase();
        const nameChanged = f.name !== editingColumnName.value;
        const nullableChanged = f.nullable !== (original.IS_NULLABLE === 'YES');
        if (nameChanged || typeChanged || nullableChanged)
        {
            critical = true;
            const parts = [];
            if (nameChanged) parts.push(`字段名 ${editingColumnName.value} -> ${f.name}`);
            if (typeChanged) parts.push(`类型 ${original.COLUMN_TYPE} -> ${f.type}`);
            if (nullableChanged) parts.push(`可空性 -> ${f.nullable ? '可空' : '不可空'}`);
            criticalText = `以下关键配置将变更: ${parts.join(', ')}。可能影响已有数据或关联查询, 确认继续?`;
        }
    }
    if (critical)
    {
        try
        {
            await ElMessageBox.confirm(criticalText, '关键配置变更确认', {
                type: 'warning',
                confirmButtonText: '确认变更',
                cancelButtonText: '取消',
            });
        }
        catch
        {
            return;
        }
    }
    columnSaving.value = true;
    try
    {
        const length = f.length ? String(f.length) : '';
        if (columnEditMode.value === 'add')
        {
            await api.post(`/tables/${props.tableName}/columns`, {
                name: f.name,
                type: f.type,
                length,
                nullable: f.nullable,
                comment: f.comment,
            });
            ElMessage.success('字段新增成功');
        }
        else
        {
            await api.put(`/tables/${props.tableName}/columns/${editingColumnName.value}`, {
                newName: f.name,
                type: f.type,
                length,
                nullable: f.nullable,
                defaultVal: f.defaultVal === '' ? null : f.defaultVal,
                comment: f.comment,
            });
            ElMessage.success('字段修改成功');
        }
        columnDialogVisible.value = false;
        await loadSchema();
        await loadData();
    }
    catch (err)
    {
        ElMessage.error(`操作失败: ${err.response?.data?.message || err.message}`);
    }
    finally
    {
        columnSaving.value = false;
    }
}

/**
 * @brief 分析字段引用影响, 确认后删除字段
 *
 * @param {object} col 字段元数据
 */
async function dropColumn(col)
{
    if (col.COLUMN_NAME === schema.value.primaryKey)
    {
        ElMessage.warning('不允许删除主键字段');
        return;
    }
    let refs = null;
    try
    {
        const { data } = await api.get(`/tables/${props.tableName}/columns/${col.COLUMN_NAME}/refs`);
        refs = data.data;
    }
    catch (err)
    {
        ElMessage.error(`影响分析失败: ${err.response?.data?.message || err.message}`);
        return;
    }
    const impacts = [];
    if (refs.sameName && refs.sameName.length > 0)
    {
        impacts.push({
            title: '其他表中存在同名字段(逻辑/导入导出可能引用)',
            items: refs.sameName.map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}${r.COLUMN_COMMENT ? ` · ${r.COLUMN_COMMENT}` : ''}`),
        });
    }
    if (refs.fkRefs && refs.fkRefs.length > 0)
    {
        impacts.push({
            title: '以下字段的注释声明引用了本表本字段(逻辑外键)',
            items: refs.fkRefs.map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}${r.COLUMN_COMMENT ? ` · ${r.COLUMN_COMMENT}` : ''}`),
        });
    }
    const message = h('div', { style: 'max-height: 300px; overflow: auto;' }, [
        h('p', { style: 'margin: 0 0 8px;' }, `删除字段「${col.COLUMN_NAME}」将永久丢失该列全部数据。`),
        impacts.length > 0
            ? impacts.map((imp) => [
                    h('p', { style: 'font-weight: 600; margin: 8px 0 4px;' }, imp.title),
                    h('ul', { style: 'margin: 0; padding-left: 20px;' }, imp.items.map((it) => h('li', { style: 'margin: 2px 0;' }, it))),
                ])
            : h('p', { style: 'color: #909399;' }, '未发现其他表引用此字段。'),
        h('p', { style: 'color: #e6a23c; margin: 8px 0 0;' }, '删除后可能影响依赖它的查询与程序, 请确认。'),
    ]);
    try
    {
        await ElMessageBox.confirm(message, '删除字段确认', {
            type: 'error',
            confirmButtonText: '确认删除',
            cancelButtonText: '取消',
        });
    }
    catch
    {
        return;
    }
    try
    {
        await api.delete(`/tables/${props.tableName}/columns/${col.COLUMN_NAME}`);
        ElMessage.success('字段删除成功');
        await loadSchema();
        await loadData();
    }
    catch (err)
    {
        ElMessage.error(`删除失败: ${err.response?.data?.message || err.message}`);
    }
}

onMounted(async () =>
{
    await loadSchema();
    await loadData();
});
</script>

<style scoped>
.table-data {
    background: var(--lhl-panel);
    border: 1px solid var(--lhl-line);
    border-radius: 8px;
    box-shadow: var(--lhl-shadow);
    padding: 16px;
    min-height: calc(100vh - 90px);
    box-sizing: border-box;
}
.table-chip {
    font-family: var(--lhl-font-mono);
    letter-spacing: 0.5px;
    border-radius: 4px;
}
.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
}
.toolbar-left,
.toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.data-table {
    width: 100%;
}
.cell-value {
    margin-right: 4px;
}
.copy-btn {
    visibility: hidden;
    color: var(--lhl-jade);
}
.data-table :deep(.el-table__row:hover) .copy-btn {
    visibility: visible;
}
.pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
}
.schema-toolbar {
    margin-bottom: 12px;
}
.import-help {
    font-size: 13px;
    line-height: 1.7;
}
.import-help ul {
    margin: 4px 0 0;
    padding-left: 18px;
}
.help-title {
    font-weight: 600;
    margin: 0 0 4px;
}
.import-help li {
    color: var(--el-text-color-regular);
}
</style>
