<template>
    <div class="alchemy-view">
        <div class="alchemy-head">
            <div>
                <div class="eyebrow">药庐 · 丹火</div>
                <h2>炼丹房</h2>
                <p>草药、丹炉与丹方均读取当前角色背包</p>
            </div>
            <div class="head-badges">
                <span>丹道 L{{ characterDetail.alchemy_skill.alchemy_level }}</span>
                <span>控火 L{{ characterDetail.alchemy_skill.fire_control_level }}</span>
                <span>丹毒 {{ characterDetail.toxin_value }}</span>
            </div>
        </div>

        <div class="alchemy-layout">
            <aside class="identity-card">
                <div class="portrait-ring">
                    <div class="portrait-seal">{{ characterDetail.character_name?.slice(0, 1) }}</div>
                </div>
                <div class="portrait-name">{{ characterDetail.character_name || '修士' }}</div>
                <div class="portrait-sub">
                    {{ characterDetail.realm_name || '未知境界' }} · {{ characterDetail.race_name || '未知种族' }} ·
                    {{ characterDetail.class_name || '散修' }}
                </div>
                <div class="identity-stats">
                    <div><span>资质</span><strong>{{ characterDetail.attribute.aptitude }}</strong></div>
                    <div><span>悟性</span><strong>{{ characterDetail.attribute.comprehension }}</strong></div>
                    <div><span>丹道</span><strong>{{ characterDetail.alchemy_skill.alchemy_level }}</strong></div>
                    <div><span>药理</span><strong>{{ characterDetail.alchemy_skill.pharmacology_level }}</strong></div>
                    <div><span>控火</span><strong>{{ characterDetail.alchemy_skill.fire_control_level }}</strong></div>
                    <div><span>耐药</span><strong>{{ characterDetail.alchemy_skill.tolerance_level }}</strong></div>
                </div>
                <div class="inventory-hint">
                    背包内：{{ herbInventory.length }} 种草药 · {{ overview.recipes.length }} 张丹方 ·
                    {{ overview.furnaces.length }} 尊丹炉
                </div>
            </aside>

            <main class="alchemy-main">
                <section class="alchemy-panel furnace-panel">
                    <div class="panel-title">
                        <span>丹炉</span>
                        <small>只显示背包中持有的丹炉</small>
                    </div>
                    <div class="furnace-row">
                        <div class="furnace-mark" aria-hidden="true">
                            <span>{{ currentFurnace?.furnace_level || '-' }}</span>
                        </div>
                        <div class="furnace-controls">
                            <el-select v-model="furnaceItemId" placeholder="选择丹炉" @change="resetPlan">
                                <el-option
                                    v-for="furnace in overview.furnaces"
                                    :key="furnace.item_id"
                                    :label="`${furnace.item_name} · 耐久 ${furnace.durability}`"
                                    :value="furnace.item_id"
                                />
                            </el-select>
                            <div class="furnace-meta">
                                <span>容量 {{ currentFurnace?.capacity || '--' }}</span>
                                <span>主 {{ currentFurnace?.main_slots || '--' }}</span>
                                <span>辅 {{ currentFurnace?.secondary_slots || '--' }}</span>
                                <span>引 {{ currentFurnace?.guide_slots || '--' }}</span>
                                <span>预计消耗 {{ durabilityCostForSelection }}</span>
                            </div>
                        </div>
                    </div>
                    <el-empty v-if="overview.furnaces.length === 0" description="背包中没有丹炉，请先获取" :image-size="60" />
                </section>

                <section class="alchemy-panel craft-panel">
                    <div class="panel-title">
                        <span>炼丹配置</span>
                        <div class="craft-actions">
                            <el-button :loading="planning" @click="loadPlan">试炼预览</el-button>
                            <el-button type="success" :loading="crafting" @click="doCraft">开炉炼丹</el-button>
                        </div>
                    </div>
                    <div class="recipe-row">
                        <el-select v-model="recipeId" clearable placeholder="自由炼丹可留空" @change="resetPlan">
                            <el-option
                                v-for="recipe in overview.recipes"
                                :key="recipe.recipe_id"
                                :label="`${recipe.item_name} · L${recipe.recipe_level} · ${recipe.pill_category}`"
                                :value="recipe.recipe_id"
                            />
                        </el-select>
                        <span class="field-label">批量</span>
                        <el-input-number v-model="batchCount" :min="1" :max="99" controls-position="right" />
                        <el-button :disabled="!recipeId" @click="autoFill">自动配药</el-button>
                    </div>
                    <div v-if="selectedRecipe" class="recipe-detail">
                        <div><span>主药</span><strong>{{ recipeSlotText('main') }}</strong></div>
                        <div><span>辅药</span><strong>{{ recipeSlotText('secondary') }}</strong></div>
                        <div><span>药引</span><strong>{{ recipeSlotText('guide') }}</strong></div>
                        <div><span>最低丹炉</span><strong>L{{ selectedRecipe.min_furnace_level }}</strong></div>
                        <div><span>基础耗时</span><strong>{{ selectedRecipe.base_days }} 天</strong></div>
                    </div>
                    <el-alert
                        v-if="planResult"
                        class="plan-alert"
                        :type="planResult.outcome === '成丹' ? 'success' : planResult.outcome === '炸炉' ? 'error' : 'warning'"
                        :closable="false"
                        :title="`${selectedRecipe?.item_name || '自由炼丹'} / ${planResult.outcome} / ${planResult.quality} / 稳定性 ${planResult.stability.toFixed(1)} / 耐久 ${planResult.durabilityCost}`"
                    />
                </section>

                <section class="alchemy-panel selected-panel">
                    <div class="panel-title">
                        <span>炉中药材</span>
                        <small>{{ selectedIngredients.length }} 项</small>
                    </div>
                    <el-table :data="selectedIngredients" border size="small" class="lhl-table">
                        <el-table-column prop="item_name" label="药材" min-width="120" />
                        <el-table-column prop="main_effect" label="主药" width="80" />
                        <el-table-column prop="secondary_effect" label="辅药" width="80" />
                        <el-table-column prop="guide_effect" label="药引" width="70" />
                        <el-table-column label="药位" width="150">
                            <template #default="{ row }">
                                <el-select v-model="row.slot_type" size="small" @change="resetPlan">
                                    <el-option label="主药" value="main" />
                                    <el-option label="辅药" value="secondary" />
                                    <el-option label="药引" value="guide" />
                                </el-select>
                                <el-select v-if="row.slot_type === 'secondary'" v-model="row.slot_index" size="small" class="slot-index">
                                    <el-option label="辅1" :value="0" />
                                    <el-option label="辅2" :value="1" />
                                </el-select>
                            </template>
                        </el-table-column>
                        <el-table-column label="数量" width="110">
                            <template #default="{ row }">
                                <el-input-number v-model="row.quantity" :min="1" :max="herbStock(row.item_id)" size="small" controls-position="right" />
                            </template>
                        </el-table-column>
                        <el-table-column label="操作" width="130">
                            <template #default="{ row, $index }">
                                <el-button size="small" link @click="openReplace(row)">替换</el-button>
                                <el-button size="small" link type="danger" @click="selectedIngredients.splice($index, 1)">移除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </section>

                <section class="alchemy-panel herb-panel">
                    <div class="panel-title">
                        <span>背包药材</span>
                        <div class="herb-tools">
                            <el-input v-model="herbSearch" clearable placeholder="搜索药材" />
                            <el-select v-model="guideFilter" placeholder="药引">
                                <el-option label="全部药引" value="all" />
                                <el-option label="性平" value="性平" />
                                <el-option label="性寒" value="性寒" />
                                <el-option label="性热" value="性热" />
                            </el-select>
                        </div>
                    </div>
                    <div class="herb-grid">
                        <article v-for="herb in filteredHerbs" :key="herb.item_id" class="herb-card">
                            <div class="herb-head">
                                <div class="herb-glyph" :class="`herb-level-${Math.min(Number(herb.level), 12)}`">{{ herb.main_effect?.slice(0, 1) }}</div>
                                <div>
                                    <strong>{{ herb.item_name }}</strong>
                                    <span>L{{ herb.level }} · 库存 {{ herb.quantity }}</span>
                                </div>
                            </div>
                            <div class="herb-effects">
                                <span>{{ herb.main_effect }}</span>
                                <span>{{ herb.secondary_effect }}</span>
                                <span>{{ herb.guide_effect }}</span>
                            </div>
                            <el-button size="small" type="primary" plain @click="addHerb(herb)">入炉</el-button>
                        </article>
                        <el-empty v-if="filteredHerbs.length === 0" description="背包中没有符合条件草药" :image-size="60" />
                    </div>
                </section>
            </main>
        </div>

        <el-dialog v-model="replaceVisible" title="替换药材" width="660px" destroy-on-close>
            <el-table :data="replacementHerbs" border size="small" max-height="420">
                <el-table-column prop="item_name" label="药材" min-width="120" />
                <el-table-column prop="main_effect" label="主药" width="80" />
                <el-table-column prop="secondary_effect" label="辅药" width="80" />
                <el-table-column prop="guide_effect" label="药引" width="70" />
                <el-table-column prop="quantity" label="库存" width="70" />
                <el-table-column label="操作" width="80">
                    <template #default="{ row }">
                        <el-button size="small" type="primary" plain @click="confirmReplace(row)">替换</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-dialog>
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const props = defineProps({
    playerCharacterId: { type: Number, required: true },
    refreshKey: { type: Number, default: 0 },
});
const emit = defineEmits(['crafted']);
const overview = reactive({ recipes: [], furnaces: [] });
const characterDetail = reactive({
    character_name: '',
    realm_name: '',
    class_name: '',
    race_name: '',
    attribute: { aptitude: 0, comprehension: 0 },
    alchemy_skill: {
        alchemy_level: 1,
        pharmacology_level: 1,
        fire_control_level: 1,
        tolerance_level: 0,
    },
    toxin_value: 0,
});
const inventory = ref([]);
const recipeId = ref(null);
const furnaceItemId = ref(null);
const batchCount = ref(1);
const herbSearch = ref('');
const guideFilter = ref('all');
const selectedIngredients = ref([]);
const planResult = ref(null);
const planning = ref(false);
const crafting = ref(false);
const replaceVisible = ref(false);
const replaceSource = ref(null);

const herbInventory = computed(() => inventory.value.filter((item) => Boolean(item.main_effect)));
const filteredHerbs = computed(() =>
{
    const keyword = herbSearch.value.trim();
    return herbInventory.value.filter((item) =>
    {
        if (guideFilter.value !== 'all' && item.guide_effect !== guideFilter.value) return false;
        return !keyword || `${item.item_name} ${item.main_effect} ${item.secondary_effect}`.includes(keyword);
    });
});
const currentFurnace = computed(() =>
    overview.furnaces.find((item) => Number(item.item_id) === Number(furnaceItemId.value)) || null
);
const selectedRecipe = computed(() =>
    overview.recipes.find((item) => Number(item.recipe_id) === Number(recipeId.value)) || null
);
const durabilityCostForSelection = computed(() =>
{
    if (!currentFurnace.value) return '--';
    if (!selectedRecipe.value) return 2 * batchCount.value;
    const gap = Number(selectedRecipe.value.recipe_level) - Number(currentFurnace.value.furnace_level);
    if (gap <= 0) return Number(currentFurnace.value.furnace_level) > Number(selectedRecipe.value.recipe_level) ? batchCount.value : 2 * batchCount.value;
    if (gap === 1) return 40 * batchCount.value;
    if (gap === 2) return 80 * batchCount.value;
    return '禁止';
});
const replacementHerbs = computed(() =>
{
    if (!replaceSource.value) return [];
    return herbInventory.value.filter((item) =>
    {
        if (replaceSource.value.slot_type === 'main') return item.main_effect === replaceSource.value.main_effect;
        if (replaceSource.value.slot_type === 'secondary') return item.secondary_effect === replaceSource.value.secondary_effect;
        return item.guide_effect === replaceSource.value.guide_effect;
    });
});

function notify(type, message)
{
    ElMessage({ type, message, showClose: true, duration: 3500 });
}

function resetPlan()
{
    planResult.value = null;
}

function recipeSlotText(type)
{
    const slots = selectedRecipe.value?.slots?.filter((slot) => slot.slot_type === type) || [];
    return slots.map((slot) => `${slot.effect_code} ≥ ${slot.required_power}`).join(' / ') || '无';
}

function slotForHerb(herb)
{
    if (!selectedRecipe.value) return 'guide';
    if (selectedRecipe.value.slots?.some((slot) => slot.slot_type === 'main' && slot.effect_code === herb.main_effect)) return 'main';
    if (selectedRecipe.value.slots?.some((slot) => slot.slot_type === 'secondary' && slot.effect_code === herb.secondary_effect)) return 'secondary';
    return 'guide';
}

function addHerb(herb)
{
    const slotType = slotForHerb(herb);
    const existing = selectedIngredients.value.find(
        (item) => Number(item.item_id) === Number(herb.item_id) && item.slot_type === slotType
    );
    if (existing)
    {
        existing.quantity = Math.min(Number(herb.quantity), Number(existing.quantity) + 1);
    }
    else
    {
        selectedIngredients.value.push({
            item_id: herb.item_id,
            item_name: herb.item_name,
            level: herb.level,
            main_effect: herb.main_effect,
            secondary_effect: herb.secondary_effect,
            guide_effect: herb.guide_effect,
            slot_type: slotType,
            slot_index: 0,
            quantity: 1,
        });
    }
    resetPlan();
}

function herbStock(itemId)
{
    return Number(inventory.value.find((item) => Number(item.item_id) === Number(itemId))?.quantity || 1);
}

function openReplace(row)
{
    replaceSource.value = row;
    replaceVisible.value = true;
}

function confirmReplace(herb)
{
    Object.assign(replaceSource.value, {
        item_id: herb.item_id,
        item_name: herb.item_name,
        level: herb.level,
        main_effect: herb.main_effect,
        secondary_effect: herb.secondary_effect,
        guide_effect: herb.guide_effect,
    });
    replaceVisible.value = false;
    resetPlan();
}

async function loadCharacter()
{
    const { data } = await api.get(`/alchemy/characters/${props.playerCharacterId}`);
    Object.assign(characterDetail, data.data);
}

async function loadInventory()
{
    const { data } = await api.get('/alchemy/inventory', {
        params: { characterId: props.playerCharacterId },
    });
    inventory.value = data.data;
}

async function loadOverview()
{
    const { data } = await api.get('/alchemy/overview', {
        params: { characterId: props.playerCharacterId },
    });
    overview.recipes = data.data.recipes;
    overview.furnaces = data.data.furnaces;
    if (!overview.recipes.some((recipe) => Number(recipe.recipe_id) === Number(recipeId.value)))
    {
        recipeId.value = overview.recipes[0]?.recipe_id || null;
    }
    if (!overview.furnaces.some((furnace) => Number(furnace.item_id) === Number(furnaceItemId.value)))
    {
        furnaceItemId.value = overview.furnaces[0]?.item_id || null;
    }
}

async function loadAll()
{
    await Promise.all([loadCharacter(), loadInventory(), loadOverview()]);
}

async function autoFill()
{
    if (!recipeId.value || !furnaceItemId.value) return;
    try
    {
        const { data } = await api.get('/alchemy/plan', {
            params: {
                characterId: props.playerCharacterId,
                recipeId: recipeId.value,
                furnaceItemId: furnaceItemId.value,
                batchCount: batchCount.value,
            },
        });
        selectedIngredients.value = data.data.selected.map((item) => ({
            item_id: item.item_id,
            item_name: item.item_name,
            level: item.level,
            main_effect: item.main_effect,
            secondary_effect: item.secondary_effect,
            guide_effect: item.guide_effect,
            slot_type: item.slot_type,
            slot_index: item.slot_index,
            quantity: item.quantity,
        }));
        planResult.value = data.data;
    }
    catch (error)
    {
        notify('error', error.response?.data?.message || error.message);
    }
}

async function loadPlan()
{
    if (!furnaceItemId.value) return;
    planning.value = true;
    try
    {
        const payload = {
            characterId: props.playerCharacterId,
            recipeId: recipeId.value || 0,
            furnaceItemId: furnaceItemId.value,
            batchCount: batchCount.value,
        };
        const { data } = selectedIngredients.value.length
            ? await api.post('/alchemy/plan', { ...payload, ingredients: selectedIngredients.value })
            : await api.get('/alchemy/plan', {
                params: {
                    characterId: props.playerCharacterId,
                    recipeId: recipeId.value,
                    furnaceItemId: furnaceItemId.value,
                    batchCount: batchCount.value,
                },
            });
        planResult.value = data.data;
    }
    catch (error)
    {
        notify('error', `试炼预览失败: ${error.response?.data?.message || error.message}`);
    }
    finally
    {
        planning.value = false;
    }
}

async function doCraft()
{
    if (!furnaceItemId.value || crafting.value) return;
    crafting.value = true;
    try
    {
        const payload = {
            characterId: props.playerCharacterId,
            recipeId: recipeId.value || 0,
            furnaceItemId: furnaceItemId.value,
            batchCount: batchCount.value,
        };
        if (selectedIngredients.value.length > 0)
        {
            payload.ingredients = selectedIngredients.value.map((item) => ({
                item_id: item.item_id,
                quantity: item.quantity,
                slot_type: item.slot_type,
                slot_index: item.slot_index,
            }));
        }
        const { data } = await api.post('/alchemy/craft', payload);
        planResult.value = data.data;
        notify('success', `炼丹完成: ${data.data.outcome} / ${data.data.quality}`);
        selectedIngredients.value = [];
        await loadAll();
        emit('crafted', data.data);
    }
    catch (error)
    {
        notify('error', `开炉失败: ${error.response?.data?.message || error.message}`);
    }
    finally
    {
        crafting.value = false;
    }
}

let previewTimer = null;
watch(
    [recipeId, furnaceItemId, batchCount, selectedIngredients],
    () =>
    {
        if (previewTimer) clearTimeout(previewTimer);
        previewTimer = setTimeout(() =>
        {
            if (furnaceItemId.value && (recipeId.value || selectedIngredients.value.length > 0))
            {
                loadPlan();
            }
        }, 250);
    },
    { deep: true }
);
watch(() => props.refreshKey, loadAll);

onMounted(loadAll);
</script>

<style scoped>
.alchemy-view {
    min-height: calc(100vh - 112px);
}
.alchemy-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 16px;
}
.alchemy-head h2 {
    margin: 3px 0 4px;
    font-family: var(--lhl-font-display);
    font-size: 28px;
    font-weight: 500;
    letter-spacing: 5px;
}
.alchemy-head p,
.panel-title small,
.identity-stats span,
.portrait-sub,
.herb-head span,
.inventory-hint {
    color: var(--lhl-text-2);
    font-size: 12px;
}
.eyebrow {
    color: var(--lhl-gold);
    font-size: 11px;
    letter-spacing: 3px;
}
.head-badges {
    display: flex;
    gap: 8px;
}
.head-badges span {
    padding: 5px 10px;
    border: 1px solid var(--lhl-line);
    border-radius: 999px;
    color: var(--lhl-jade-deep);
    background: var(--lhl-panel);
    font-size: 12px;
}
.alchemy-layout {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
}
.identity-card,
.alchemy-panel {
    border: 1px solid var(--lhl-line);
    border-radius: 9px;
    background: var(--lhl-panel);
    box-shadow: var(--lhl-shadow);
}
.identity-card {
    position: sticky;
    top: 0;
    padding: 18px;
    text-align: center;
}
.portrait-ring {
    width: 92px;
    height: 92px;
    margin: 0 auto 12px;
    border-radius: 50%;
    padding: 6px;
    background: conic-gradient(from 120deg, var(--lhl-cinnabar), var(--lhl-gold), var(--lhl-jade), var(--lhl-cinnabar));
}
.portrait-seal {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--lhl-ink-soft);
    color: #f6e7c7;
    font-family: var(--lhl-font-display);
    font-size: 40px;
}
.portrait-name {
    font-family: var(--lhl-font-display);
    font-size: 22px;
    letter-spacing: 4px;
}
.portrait-sub {
    margin-top: 4px;
}
.identity-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin-top: 16px;
}
.identity-stats div {
    display: flex;
    justify-content: space-between;
    padding: 7px 8px;
    border-radius: 5px;
    background: var(--lhl-jade-soft);
}
.identity-stats strong {
    color: var(--lhl-jade-deep);
}
.inventory-hint {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed var(--lhl-line);
    line-height: 1.7;
}
.alchemy-main {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
}
.alchemy-panel {
    padding: 16px;
}
.panel-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    font-family: var(--lhl-font-display);
    font-size: 16px;
    letter-spacing: 2px;
}
.furnace-row {
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr);
    gap: 16px;
}
.furnace-mark {
    height: 100px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background:
        radial-gradient(circle at 50% 40%, rgba(255, 190, 70, 0.32), transparent 35%),
        linear-gradient(145deg, #8f6f3c, #3d2c18);
    color: #f8f1de;
    font-family: var(--lhl-font-display);
    font-size: 34px;
}
.furnace-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.furnace-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.furnace-meta span {
    padding: 5px 8px;
    border-radius: 4px;
    background: var(--lhl-jade-soft);
    color: var(--lhl-jade-deep);
    font-size: 12px;
}
.craft-actions,
.recipe-row,
.herb-tools {
    display: flex;
    align-items: center;
    gap: 8px;
}
.recipe-row > .el-select {
    width: min(320px, 45%);
}
.field-label {
    color: var(--lhl-text-2);
    font-family: var(--lhl-font-body);
    font-size: 12px;
}
.recipe-detail {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px 16px;
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 7px;
    background: var(--lhl-jade-soft);
}
.recipe-detail div {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
}
.recipe-detail span {
    color: var(--lhl-text-2);
}
.plan-alert {
    margin-top: 12px;
}
.slot-index {
    width: 74px;
    margin-left: 4px;
}
.herb-tools .el-input {
    width: 180px;
}
.herb-tools .el-select {
    width: 110px;
}
.herb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
}
.herb-card {
    padding: 11px;
    border: 1px solid var(--lhl-line);
    border-radius: 7px;
    background: var(--lhl-bg-color);
}
.herb-head {
    display: flex;
    align-items: center;
    gap: 9px;
}
.herb-head > div:last-child {
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.herb-glyph {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 50% 50% 44% 44%;
    color: #f8f1de;
    font-family: var(--lhl-font-display);
}
.herb-effects {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin: 9px 0;
}
.herb-effects span {
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--lhl-jade-deep);
    background: var(--lhl-jade-soft);
    font-size: 11px;
}
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
@media (max-width: 1000px) {
    .alchemy-layout {
        grid-template-columns: minmax(0, 1fr);
    }
    .identity-card {
        position: static;
    }
}
@media (max-width: 720px) {
    .alchemy-head,
    .panel-title,
    .recipe-row,
    .herb-tools {
        align-items: stretch;
        flex-direction: column;
    }
    .furnace-row,
    .recipe-detail {
        grid-template-columns: minmax(0, 1fr);
    }
    .recipe-row > .el-select,
    .herb-tools .el-input,
    .herb-tools .el-select {
        width: 100%;
    }
}
</style>
