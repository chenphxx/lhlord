<template>
    <section class="inventory-page">
        <div class="inventory-head">
            <div>
                <div class="eyebrow">修士 · 随身储物</div>
                <h2>背包</h2>
            </div>
            <div class="head-meta">
                <span>{{ filteredItems.length }} 种物品</span>
                <span>共 {{ totalQuantity }} 件</span>
            </div>
        </div>

        <div class="inventory-toolbar">
            <el-radio-group v-model="category" size="small">
                <el-radio-button label="all">全部</el-radio-button>
                <el-radio-button label="herb">草药</el-radio-button>
                <el-radio-button label="pill">丹药</el-radio-button>
                <el-radio-button label="furnace">丹炉</el-radio-button>
                <el-radio-button label="recipe">丹方</el-radio-button>
                <el-radio-button label="material">材料</el-radio-button>
            </el-radio-group>
            <el-input v-model="search" clearable placeholder="搜索物品" />
        </div>

        <div v-loading="loading" class="inventory-grid">
            <article v-for="item in filteredItems" :key="item.item_id" class="item-card">
                <div class="item-glyph" :class="glyphClass(item)">{{ glyphText(item) }}</div>
                <div class="item-body">
                    <div class="item-top">
                        <strong>{{ item.item_name }}</strong>
                        <span class="item-level">L{{ item.level }}</span>
                    </div>
                    <div class="item-category">{{ item.item_category_name }}</div>
                    <p>{{ effectText(item) }}</p>
                </div>
                <div class="item-foot">
                    <span>×{{ item.quantity }}</span>
                    <el-button
                        v-if="item.pill_category"
                        size="small"
                        type="primary"
                        plain
                        :loading="usingPillId === item.item_id"
                        :disabled="usingPillId !== 0"
                        @click="usePill(item)"
                    >
                        服用
                    </el-button>
                </div>
            </article>
            <el-empty v-if="!loading && filteredItems.length === 0" description="背包中没有符合条件的物品" />
        </div>
    </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const props = defineProps({
    characterId: { type: Number, default: 0 },
    refreshKey: { type: Number, default: 0 },
});
const emit = defineEmits(['updated']);
const loading = ref(true);
const items = ref([]);
const category = ref('all');
const search = ref('');
const usingPillId = ref(0);

const filteredItems = computed(() =>
{
    const keyword = search.value.trim();
    return items.value.filter((item) =>
    {
        if (category.value === 'herb' && !item.main_effect) return false;
        if (category.value === 'pill' && !item.pill_category) return false;
        if (category.value === 'furnace' && !item.item_code?.startsWith('FURNACE_ALC')) return false;
        if (category.value === 'recipe' && Number(item.item_category_id) !== 12) return false;
        if (category.value === 'material' && Number(item.item_category_id) !== 2) return false;
        if (!keyword) return true;
        return `${item.item_name} ${item.description || ''} ${item.item_category_name || ''}`.includes(keyword);
    });
});
const totalQuantity = computed(() =>
    filteredItems.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
);

function glyphClass(item)
{
    if (item.main_effect) return `herb-level-${Math.min(Number(item.level) || 1, 12)}`;
    if (item.pill_category) return 'pill-glyph';
    if (item.item_code?.startsWith('FURNACE_ALC')) return 'furnace-glyph';
    if (Number(item.item_category_id) === 12) return 'recipe-glyph';
    return 'generic-glyph';
}

function glyphText(item)
{
    if (item.main_effect) return item.main_effect.slice(0, 1);
    if (item.pill_category) return '丹';
    if (item.item_code?.startsWith('FURNACE_ALC')) return '炉';
    if (Number(item.item_category_id) === 12) return '方';
    return item.item_name?.slice(0, 1) || '物';
}

function effectText(item)
{
    if (item.main_effect) return `${item.main_effect} / ${item.secondary_effect} / ${item.guide_effect}`;
    if (item.pill_category) return `${item.pill_category}丹药 · ${item.effect_type || '未知效果'}`;
    return item.description || '暂无描述';
}

async function load()
{
    loading.value = true;
    try
    {
        const { data } = await api.get('/game/state');
        items.value = data.data.inventory || [];
    }
    catch (error)
    {
        ElMessage.error(`读取背包失败: ${error.response?.data?.message || error.message}`);
    }
    finally
    {
        loading.value = false;
    }
}

async function usePill(item)
{
    if (!props.characterId || usingPillId.value) return;
    usingPillId.value = item.item_id;
    try
    {
        const { data } = await api.post('/alchemy/use-pill', {
            characterId: props.characterId,
            itemId: item.item_id,
            quantity: 1,
        });
        ElMessage.success(`服下${data.data.pill_name}, 丹毒 ${data.data.toxin_value}`);
        await load();
        emit('updated');
    }
    catch (error)
    {
        ElMessage.error(`服用失败: ${error.response?.data?.message || error.message}`);
    }
    finally
    {
        usingPillId.value = 0;
    }
}

watch(() => props.refreshKey, load);
onMounted(load);
</script>

<style scoped>
.inventory-page {
    min-height: calc(100vh - 112px);
    padding: 22px;
    border: 1px solid var(--lhl-line);
    border-radius: 10px;
    background: var(--lhl-panel);
    box-shadow: var(--lhl-shadow);
}
.inventory-head,
.inventory-toolbar,
.item-top,
.item-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.inventory-head h2 {
    margin: 3px 0 0;
    font-family: var(--lhl-font-display);
    font-size: 26px;
    font-weight: 500;
    letter-spacing: 5px;
}
.eyebrow,
.item-level,
.item-category,
.head-meta,
.item-foot {
    color: var(--lhl-text-2);
    font-size: 12px;
}
.eyebrow {
    color: var(--lhl-gold);
    letter-spacing: 3px;
}
.head-meta {
    display: flex;
    gap: 16px;
}
.inventory-toolbar {
    margin: 22px 0 16px;
}
.inventory-toolbar .el-input {
    width: 240px;
}
.inventory-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
    min-height: 180px;
}
.item-card {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 10px 12px;
    padding: 14px;
    border: 1px solid var(--lhl-line);
    border-radius: 8px;
    background: var(--lhl-bg-color);
}
.item-glyph {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 50% 50% 44% 44%;
    color: #f8f1de;
    font-family: var(--lhl-font-display);
    font-size: 20px;
}
.pill-glyph { background: linear-gradient(145deg, #d09237, #6d3e16); border-radius: 50%; }
.furnace-glyph { background: linear-gradient(145deg, #8f6f3c, #3d2c18); }
.recipe-glyph { background: linear-gradient(145deg, #4f8f7f, #1f463d); border-radius: 6px; }
.generic-glyph { background: linear-gradient(145deg, #5c7c72, #263d37); }
.herb-level-1 { background: linear-gradient(145deg, #5c7c72, #263d37); }
.herb-level-2 { background: linear-gradient(145deg, #6d8d7c, #2e4a3c); }
.herb-level-3 { background: linear-gradient(145deg, #8b7d52, #41351f); }
.herb-level-4 { background: linear-gradient(145deg, #2f8f79, #17463c); }
.herb-level-5 { background: linear-gradient(145deg, #4c8bbf, #1d3551); }
.herb-level-6 { background: linear-gradient(145deg, #7c5f9d, #352245); }
.herb-level-7 { background: linear-gradient(145deg, #d09237, #5b3516); }
.herb-level-8 { background: linear-gradient(145deg, #d6ad45, #6a4b16); }
.herb-level-9 { background: linear-gradient(145deg, #d74a3a, #6d1d16); }
.herb-level-10 { background: linear-gradient(145deg, #c86fc1, #4a2451); }
.herb-level-11 { background: linear-gradient(145deg, #63b3d4, #1d4c63); }
.herb-level-12 { background: linear-gradient(145deg, #e8483f, #5b0f0f); }
.item-top strong {
    font-size: 14px;
}
.item-top {
    align-items: flex-start;
}
.item-category {
    margin-top: 2px;
}
.item-body p {
    margin: 8px 0 0;
    color: var(--lhl-text-2);
    font-size: 12px;
    line-height: 1.7;
}
.item-foot {
    grid-column: 1 / -1;
    padding-top: 8px;
    border-top: 1px dashed var(--lhl-line);
}
@media (max-width: 760px) {
    .inventory-page {
        padding: 14px;
    }
    .inventory-toolbar {
        align-items: stretch;
        flex-direction: column;
    }
    .inventory-toolbar .el-input {
        width: 100%;
    }
}
</style>
