<template>
    <el-tabs v-model="alchemyTab" class="alchemy-tabs">
        <el-tab-pane label="丹房" name="studio">
            <div class="alchemy-studio">
        <div class="studio-left">
            <div class="identity-card">
                <div class="portrait-wrap">
                    <div class="portrait-ring">
                        <div class="portrait-seal">{{ characterDetail.character_name?.slice(0, 1) }}</div>
                    </div>
                    <div class="portrait-name">{{ characterDetail.character_name || '未选择修士' }}</div>
                    <div class="portrait-sub">
                        {{ characterDetail.realm_name || '未知境界' }} · {{ characterDetail.class_name || '散修' }} ·
                        {{ characterDetail.race_name || '未知种族' }}
                    </div>
                </div>

                <div class="section-title">
                    <span class="title-mark"></span>
                    <span>修士命牌</span>
                </div>

                <el-select v-model="characterId" class="character-select" placeholder="选择炼丹修士" @change="onCharacterChange">
                    <el-option
                        v-for="c in overview.characters"
                        :key="c.character_id"
                        :label="`${c.character_name} · ${c.class_name || '散修'} · ${c.realm_name || '未知境界'}`"
                        :value="c.character_id"
                    />
                </el-select>

                <div class="attribute-grid">
                    <div class="attribute-row">
                        <span>年龄</span>
                        <el-input-number v-model="characterDetail.age" :min="1" :max="99999" controls-position="right" @change="saveAttributes" />
                    </div>
                    <div class="attribute-row">
                        <span>资质</span>
                        <el-input-number v-model="characterDetail.attribute.aptitude" :min="0" :max="999" controls-position="right" @change="saveAttributes" />
                    </div>
                    <div class="attribute-row">
                        <span>悟性</span>
                        <el-input-number v-model="characterDetail.attribute.comprehension" :min="0" :max="999" controls-position="right" @change="saveAttributes" />
                    </div>
                    <div class="attribute-row">
                        <span>金灵根</span>
                        <el-input-number v-model="characterDetail.attribute.metal_root" :min="0" :max="100" controls-position="right" @change="saveAttributes" />
                    </div>
                    <div class="attribute-row">
                        <span>木灵根</span>
                        <el-input-number v-model="characterDetail.attribute.wood_root" :min="0" :max="100" controls-position="right" @change="saveAttributes" />
                    </div>
                    <div class="attribute-row">
                        <span>水灵根</span>
                        <el-input-number v-model="characterDetail.attribute.water_root" :min="0" :max="100" controls-position="right" @change="saveAttributes" />
                    </div>
                    <div class="attribute-row">
                        <span>火灵根</span>
                        <el-input-number v-model="characterDetail.attribute.fire_root" :min="0" :max="100" controls-position="right" @change="saveAttributes" />
                    </div>
                    <div class="attribute-row">
                        <span>土灵根</span>
                        <el-input-number v-model="characterDetail.attribute.earth_root" :min="0" :max="100" controls-position="right" @change="saveAttributes" />
                    </div>
                </div>

                <div class="section-title">
                    <span class="title-mark"></span>
                    <span>丹道修为</span>
                </div>
                <div class="attribute-grid">
                    <div class="attribute-row">
                        <span>丹道</span>
                        <el-input-number v-model="characterDetail.alchemy_skill.alchemy_level" :min="1" :max="12" controls-position="right" @change="saveAttributes" />
                    </div>
                    <div class="attribute-row">
                        <span>药理</span>
                        <el-input-number v-model="characterDetail.alchemy_skill.pharmacology_level" :min="1" :max="12" controls-position="right" @change="saveAttributes" />
                    </div>
                    <div class="attribute-row">
                        <span>控火</span>
                        <el-input-number v-model="characterDetail.alchemy_skill.fire_control_level" :min="1" :max="12" controls-position="right" @change="saveAttributes" />
                    </div>
                    <div class="attribute-row">
                        <span>耐药</span>
                        <el-input-number v-model="characterDetail.alchemy_skill.tolerance_level" :min="0" :max="12" controls-position="right" @change="saveAttributes" />
                    </div>
                </div>

                <div class="toxin-row">
                    <span>当前丹毒</span>
                    <el-input-number v-model="characterDetail.toxin_value" :min="0" :max="999" controls-position="right" @change="saveAttributes" />
                </div>

            </div>
        </div>

        <div class="studio-right">
            <div class="furnace-panel">
                <div class="furnace-art" :class="`furnace-level-${currentFurnace?.furnace_level || 1}`" aria-hidden="true">
                    <div class="furnace-rank">L{{ currentFurnace?.furnace_level || 1 }}</div>
                    <svg viewBox="0 0 220 180" class="furnace-svg" role="img" :style="{ filter: `hue-rotate(${furnaceHue}deg) saturate(${furnaceSaturate})` }">
                        <defs>
                            <linearGradient id="bronze" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0" stop-color="#c9a85f" />
                                <stop offset="0.45" stop-color="#8f6f3c" />
                                <stop offset="1" stop-color="#5d452b" />
                            </linearGradient>
                            <radialGradient id="fireCore" cx="0.5" cy="0.5" r="0.55">
                                <stop offset="0" stop-color="#fff3b0" />
                                <stop offset="0.45" stop-color="#f2a03d" />
                                <stop offset="1" stop-color="#9f2f28" />
                            </radialGradient>
                        </defs>
                        <ellipse cx="110" cy="156" rx="72" ry="12" fill="rgba(0,0,0,0.24)" />
                        <path d="M52 84 C52 40 74 22 110 22 C146 22 168 40 168 84 L152 138 L68 138 Z" fill="url(#bronze)" stroke="#332417" stroke-width="4" />
                        <ellipse cx="110" cy="80" rx="52" ry="16" fill="#241a12" stroke="#c9a85f" stroke-width="4" />
                        <circle cx="110" cy="72" r="16" fill="url(#fireCore)" />
                        <path d="M96 138 L124 138 L116 158 L104 158 Z" fill="#7e5b2e" stroke="#332417" stroke-width="4" />
                        <path d="M74 42 C86 54 92 66 92 78" fill="none" stroke="#f1d28c" stroke-width="4" stroke-linecap="round" opacity="0.7" />
                        <path d="M146 42 C134 54 128 66 128 78" fill="none" stroke="#f1d28c" stroke-width="4" stroke-linecap="round" opacity="0.7" />
                    </svg>
                </div>

                <div class="furnace-controls">
                    <el-select v-model="furnaceItemId" placeholder="选择丹炉" style="width: 200px" @change="resetFurnaceQuality">
                        <el-option
                            v-for="f in overview.furnaces"
                            :key="f.item_id"
                            :label="`${f.item_name} · 耐久 ${f.durability}`"
                            :value="f.item_id"
                        />
                    </el-select>
                    <div class="quality-row">
                        <span>丹炉品质</span>
                        <el-input-number v-model="furnaceQuality" :min="1" :max="12" controls-position="right" @change="saveFurnaceQuality" />
                    </div>
                    <div class="quality-row">
                        <span>火候稳定</span>
                        <el-input-number v-model="furnaceHeat" :min="0" :max="20" controls-position="right" @change="saveFurnaceQuality" />
                    </div>
                    <div class="furnace-meta">
                        <span>容量 {{ currentFurnace?.capacity || '--' }}</span>
                        <span>主 {{ currentFurnace?.main_slots || '--' }}</span>
                        <span>辅 {{ currentFurnace?.secondary_slots || '--' }}</span>
                        <span>引 {{ currentFurnace?.guide_slots || '--' }}</span>
                        <span>耐久消耗 {{ durabilityCostForSelection }}</span>
                    </div>
                    <div class="notice-box">
                        <button class="notice-title" type="button" @click="noticeVisible = !noticeVisible">
                            炼丹注意事项 <span>{{ noticeVisible ? '收起' : '展开' }}</span>
                        </button>
                        <div v-if="noticeVisible" class="notice-body">
                            主药决定丹药大类, 辅药决定具体效果, 药引负责平衡寒热; 同药性药材可替换, 低阶药材可堆叠药力; 低阶丹炉炼高阶丹会消耗更多耐久并提高炸炉风险
                        </div>
                    </div>
                </div>
            </div>

            <div class="selected-panel">
                <div class="section-title">
                    <span class="title-mark"></span>
                    <span>炉中药材</span>
                </div>
                <el-table :data="selectedIngredients" border size="small" class="lhl-table">
                    <el-table-column prop="item_name" label="药材" min-width="110" />
                    <el-table-column prop="main_effect" label="主药" width="80" />
                    <el-table-column prop="secondary_effect" label="辅药" width="80" />
                    <el-table-column prop="guide_effect" label="药引" width="70" />
                    <el-table-column label="槽位" width="120">
                        <template #default="{ row, $index }">
                            <el-select v-model="row.slot_type" size="small" @change="resetPlan">
                                <el-option label="主药" value="main" />
                                <el-option label="辅药" value="secondary" />
                                <el-option label="药引" value="guide" />
                            </el-select>
                            <el-select v-if="row.slot_type === 'secondary'" v-model="row.slot_index" size="small" style="width: 72px; margin-left: 4px">
                                <el-option label="辅1" :value="0" />
                                <el-option label="辅2" :value="1" />
                            </el-select>
                        </template>
                    </el-table-column>
                    <el-table-column label="数量" width="120">
                        <template #default="{ row }">
                            <el-input-number v-model="row.quantity" :min="1" size="small" controls-position="right" style="width: 90px" />
                        </template>
                    </el-table-column>
                    <el-table-column label="操作" width="70">
                        <template #default="{ $index }">
                            <el-button size="small" link @click="openReplace(selectedIngredients[$index])">替换</el-button>
                            <el-button size="small" type="danger" link @click="selectedIngredients.splice($index, 1)">移除</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </div>

            <el-dialog v-model="replaceVisible" title="替换炉中药材" width="680px" destroy-on-close>
                <div class="replace-tip">
                    原药材: {{ replaceSource?.item_name }} / 数量 {{ replaceQuantity }}
                </div>
                <el-table :data="replacementHerbs" border size="small" class="lhl-table" max-height="420">
                    <el-table-column prop="item_name" label="可替换药材" min-width="120" />
                    <el-table-column prop="main_effect" label="主药" width="80" />
                    <el-table-column prop="secondary_effect" label="辅药" width="80" />
                    <el-table-column prop="guide_effect" label="药引" width="70" />
                    <el-table-column prop="level" label="等级" width="65" />
                    <el-table-column label="数量" width="110">
                        <template #default>
                            <el-input-number v-model="replaceQuantity" :min="1" size="small" controls-position="right" style="width: 90px" />
                        </template>
                    </el-table-column>
                    <el-table-column label="操作" width="80">
                        <template #default="{ row }">
                            <el-button size="small" type="primary" plain @click="confirmReplace(row)">替换</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </el-dialog>

            <div class="craft-panel">
                <div class="craft-head">
                    <div>
                        <div class="eyebrow">药庐 · 开炉台</div>
                        <div class="craft-title">炼丹配置</div>
                    </div>
                    <div class="craft-actions">
                        <el-button :loading="planning" @click="loadPlan">试炼预览</el-button>
                        <el-button type="success" :loading="crafting" @click="doCraft">开炉炼丹</el-button>
                    </div>
                </div>

                <div class="recipe-row">
                    <el-select v-model="recipeId" clearable placeholder="自由炼丹可留空" style="width: 220px" @change="resetPlan">
                        <el-option
                            v-for="r in overview.recipes"
                            :key="r.recipe_id"
                            :label="`${r.item_name} · L${r.recipe_level} · ${r.pill_category}`"
                            :value="r.recipe_id"
                        />
                    </el-select>
                    <span class="batch-label">批量</span>
                    <el-input-number v-model="batchCount" :min="1" :max="99" controls-position="right" style="width: 120px" />
                    <el-button :disabled="!recipeId" @click="autoFill">自动配药</el-button>
                </div>

                <div v-if="selectedRecipe" class="recipe-detail">
                    <div class="recipe-detail-row"><span>主药</span><span>{{ recipeSlotText('main') }}</span></div>
                    <div class="recipe-detail-row"><span>辅药</span><span>{{ recipeSlotText('secondary') }}</span></div>
                    <div class="recipe-detail-row"><span>药引</span><span>{{ recipeSlotText('guide') }}</span></div>
                    <div class="recipe-detail-row"><span>寒热容忍</span><span>{{ recipeTolerance }}</span></div>
                    <div class="recipe-detail-row"><span>最低丹炉等级</span><span>{{ selectedRecipe.min_furnace_level }}</span></div>
                    <div class="recipe-detail-row"><span>基础炼制时间</span><span>{{ selectedRecipe.base_days }} 天</span></div>
                    <div class="recipe-detail-row"><span>冲突规则</span><span>强金+强木, 强水+强火不可同时出现</span></div>
                </div>

                <el-alert
                    v-if="planResult"
                    class="plan-alert"
                    :type="planResult.outcome === '成丹' ? 'success' : planResult.outcome === '炸炉' ? 'error' : 'warning'"
                    :closable="false"
                    :title="`预计成丹: ${selectedRecipe?.item_name || '未匹配丹方'} / 预估: ${planResult.outcome} / ${planResult.quality} / 稳定性 ${planResult.stability.toFixed(1)} / 耐久消耗 ${planResult.durabilityCost}`"
                />
            </div>

            <div class="material-panel">
                <div class="section-title">
                    <span class="title-mark"></span>
                    <span>药架 · 药材</span>
                </div>
                <div class="filter-row">
                    <el-select v-model="herbCategory" class="herb-filter" placeholder="药材分类">
                        <el-option label="全部药材" value="all" />
                        <el-option label="性平药材" value="flat" />
                        <el-option label="性寒药材" value="cold" />
                        <el-option label="性热药材" value="hot" />
                        <el-option label="疗伤主药" value="heal" />
                        <el-option label="修炼主药" value="cultivation" />
                        <el-option label="战斗主药" value="combat" />
                        <el-option label="特殊主药" value="special" />
                    </el-select>
                    <el-select v-model="herbLevelCategory" class="herb-filter" placeholder="药材等级">
                        <el-option label="全部等级" value="all" />
                        <el-option v-for="level in 12" :key="level" :label="`${level} 级药材`" :value="level" />
                    </el-select>
                    <el-input v-model="herbSearch" clearable placeholder="搜索药材" />
                    <el-radio-group v-model="herbSearchMode" size="small">
                        <el-radio-button label="fuzzy">模糊</el-radio-button>
                        <el-radio-button label="exact">精确</el-radio-button>
                    </el-radio-group>
                </div>
                <div class="herb-grid">
                    <div v-for="herb in paginatedHerbInventory" :key="herb.item_id" class="herb-card">
                        <div class="herb-head">
                            <div class="herb-glyph" :class="`herb-level-${Math.min(herb.level, 12)}`">
                                <span>{{ herb.main_effect?.slice(0, 1) }}</span>
                            </div>
                            <div class="herb-name">{{ herb.item_name }}</div>
                        </div>
                        <div class="herb-level">L{{ herb.level }}</div>
                        <div class="herb-effects">
                            <span>{{ herb.main_effect }}</span>
                            <span>{{ herb.secondary_effect }}</span>
                            <span>{{ herb.guide_effect }}</span>
                        </div>
                        <div class="herb-stock">库存 {{ herb.quantity }}</div>
                        <div class="herb-add">
                            <el-button size="small" type="primary" plain @click="addHerb(herb)">入炉</el-button>
                        </div>
                    </div>
                </div>
                <el-pagination
                    v-model:current-page="herbPage"
                    v-model:page-size="herbPageSize"
                    :total="filteredHerbInventory.length"
                    :page-sizes="[12, 24, 36]"
                    layout="total, sizes, prev, pager, next"
                    small
                    class="herb-pagination"
                />
            </div>

            </div>
        </div>
        </el-tab-pane>

        <el-tab-pane label="背包" name="inventory">
            <div class="inventory-panel">
                <div class="section-title">
                    <span class="title-mark"></span>
                    <span>角色背包</span>
                </div>
                <div class="filter-row">
                    <el-radio-group v-model="inventoryCategory" class="inventory-filter">
                        <el-radio-button label="all">全部物品</el-radio-button>
                        <el-radio-button label="herb">药材</el-radio-button>
                        <el-radio-button label="pill">丹药</el-radio-button>
                        <el-radio-button label="furnace">炼丹炉</el-radio-button>
                    </el-radio-group>
                    <el-input v-model="inventorySearch" clearable placeholder="搜索背包物品" />
                    <el-radio-group v-model="inventorySearchMode" size="small">
                        <el-radio-button label="fuzzy">模糊</el-radio-button>
                        <el-radio-button label="exact">精确</el-radio-button>
                    </el-radio-group>
                </div>
                <div v-loading="loadingInventory" class="herb-grid">
                    <div v-for="item in filteredInventory" :key="item.item_id" class="herb-card inventory-card">
                        <div class="herb-head">
                            <div class="herb-glyph" :class="itemIconClass(item)">{{ itemIconText(item) }}</div>
                            <div class="herb-name">{{ item.item_name }}</div>
                        </div>
                        <div class="herb-level">L{{ item.level }}</div>
                        <div class="inventory-description">{{ item.description || '暂无描述' }}</div>
                        <div class="inventory-effect">{{ itemEffectText(item) }}</div>
                        <div class="herb-stock">数量 {{ item.quantity }}</div>
                    </div>
                </div>
            </div>
        </el-tab-pane>
    </el-tabs>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

defineEmits(['open-admin']);

const SIM_INVENTORY_CHARACTER_ID = 2;
const overview = reactive({ characters: [], recipes: [], furnaces: [] });
const alchemyTab = ref('studio');
const characterId = ref(2);
const recipeId = ref(null);
const furnaceItemId = ref(null);
const batchCount = ref(1);
const herbCategory = ref('all');
const herbLevelCategory = ref('all');
const inventoryCategory = ref('all');
const herbSearch = ref('');
const herbSearchMode = ref('fuzzy');
const herbPage = ref(1);
const herbPageSize = ref(12);
const inventorySearch = ref('');
const inventorySearchMode = ref('fuzzy');

const characterDetail = reactive({
    character_name: '',
    realm_name: '',
    class_name: '',
    race_name: '',
    age: 0,
    attribute: {
        aptitude: 0,
        comprehension: 0,
        metal_root: 0,
        wood_root: 0,
        water_root: 0,
        fire_root: 0,
        earth_root: 0,
    },
    alchemy_skill: {
        alchemy_level: 1,
        pharmacology_level: 1,
        fire_control_level: 1,
        tolerance_level: 0,
    },
    toxin_value: 0,
});

const inventory = ref([]);
const selectedIngredients = ref([]);
const planResult = ref(null);
const replaceVisible = ref(false);
const replaceSource = ref(null);
const replaceQuantity = ref(1);
const noticeVisible = ref(false);
const planning = ref(false);
const crafting = ref(false);
const savingAttributes = ref(false);
const loadingInventory = ref(false);
const furnaceQuality = ref(1);
const furnaceHeat = ref(0);

const herbInventory = computed(() => inventory.value.filter((item) => item.main_effect !== null));
/**
 * @brief 判断物品是否命中搜索关键词
 *
 * @param {object} item 物品
 * @param {string} keyword 关键词
 * @param {string} mode 匹配模式, exact 为精确匹配, 其余为模糊匹配
 * @return {boolean} 是否命中
 */
function matchesSearch(item, keyword, mode)
{
    if (!keyword) return true;
    const text = [item.item_name, item.main_effect, item.secondary_effect, item.guide_effect, item.description]
        .filter(Boolean)
        .join(' ');
    if (mode === 'exact') return text === keyword;
    return text.includes(keyword);
}
const filteredInventory = computed(() =>
{
    let result = inventory.value;
    if (inventoryCategory.value === 'herb') result = result.filter((item) => item.main_effect !== null);
    if (inventoryCategory.value === 'pill') result = result.filter((item) => item.item_code?.startsWith('PILL_'));
    if (inventoryCategory.value === 'furnace')
    {
        result = result.filter((item) => item.item_code?.startsWith('FURNACE_ALC'));
    }
    return result.filter((item) => matchesSearch(item, inventorySearch.value.trim(), inventorySearchMode.value));
});
const filteredHerbInventory = computed(() =>
{
    let result = herbInventory.value;
    if (['flat', 'cold', 'hot'].includes(herbCategory.value))
    {
        const guideMap = { flat: '性平', cold: '性寒', hot: '性热' };
        result = result.filter((item) => item.guide_effect === guideMap[herbCategory.value]);
    }
    else if (herbCategory.value !== 'all')
    {
        const mainEffects = {
            heal: ['活血', '生息', '净血'],
            cultivation: ['聚元', '炼气'],
            combat: ['御气', '振气', '炼魔'],
            special: ['驱妖', '诱妖'],
        };
        result = result.filter((item) => mainEffects[herbCategory.value].includes(item.main_effect));
    }
    if (herbLevelCategory.value !== 'all')
    {
        result = result.filter((item) => Number(item.level) === Number(herbLevelCategory.value));
    }
    return result.filter((item) => matchesSearch(item, herbSearch.value.trim(), herbSearchMode.value));
});
const paginatedHerbInventory = computed(() =>
{
    const start = (herbPage.value - 1) * herbPageSize.value;
    return filteredHerbInventory.value.slice(start, start + herbPageSize.value);
});
const currentFurnace = computed(() =>
    overview.furnaces.find((item) => item.item_id === furnaceItemId.value) || null
);
const selectedRecipe = computed(() =>
    overview.recipes.find((item) => item.recipe_id === recipeId.value) || null
);
const furnaceHue = computed(() => ((Number(currentFurnace.value?.furnace_level) || 1) - 1) * 24);
const furnaceSaturate = computed(() => 1 + ((Number(currentFurnace.value?.furnace_level) || 1) % 4) * 0.08);
const durabilityCostForSelection = computed(() =>
{
    if (!currentFurnace.value) return '--';
    if (!selectedRecipe.value) return 2 * batchCount.value;
    const gap = Number(selectedRecipe.value.recipe_level) - Number(currentFurnace.value.furnace_level);
    if (gap <= 0) return currentFurnace.value.furnace_level > selectedRecipe.value.recipe_level ? batchCount.value : 2 * batchCount.value;
    if (gap === 1) return 40 * batchCount.value;
    if (gap === 2) return 80 * batchCount.value;
    return '禁止';
});
const recipeTolerance = computed(() =>
{
    if (!selectedRecipe.value) return '--';
    const requiredTotal = selectedRecipe.value.slots.reduce(
        (sum, slot) => sum + Number(slot.required_power || 0),
        0
    ) * batchCount.value;
    return Math.max(20, requiredTotal * 0.04);
});

function itemIconClass(row)
{
    if (row.main_effect !== null && row.main_effect !== undefined)
    {
        return `herb-level-${Math.min(Number(row.level) || 1, 12)}`;
    }
    if (row.item_code?.startsWith('PILL_')) return 'pill-glyph';
    if (row.item_code?.startsWith('FURNACE_ALC')) return 'furnace-glyph';
    return 'generic-glyph';
}

function itemIconText(row)
{
    if (row.main_effect !== null && row.main_effect !== undefined)
    {
        return row.main_effect.slice(0, 1);
    }
    if (row.item_code?.startsWith('PILL_')) return '丹';
    if (row.item_code?.startsWith('FURNACE_ALC')) return '炉';
    return row.item_name?.slice(0, 1) || '物';
}

function itemEffectText(row)
{
    if (row.main_effect !== null && row.main_effect !== undefined)
    {
        return `${row.main_effect} / ${row.secondary_effect} / ${row.guide_effect}`;
    }
    if (row.item_code?.startsWith('PILL_'))
    {
        const parts = [];
        if (row.effect_type) parts.push(`类型 ${row.effect_type}`);
        if (row.base_effect) parts.push(`基础 ${row.base_effect}`);
        if (row.toxicity) parts.push(`丹毒 ${row.toxicity}`);
        if (row.breakthrough_bonus) parts.push(`突破 +${row.breakthrough_bonus}`);
        return parts.join(' / ') || '无效果';
    }
    return row.description || '无效果';
}

function recipeSlotText(type)
{
    const slots = selectedRecipe.value?.slots?.filter((slot) => slot.slot_type === type) || [];
    return slots.map((slot) => `${slot.effect_code} >= ${slot.required_power}`).join(' / ') || '无';
}

function notify(type, message)
{
    ElMessage({ type, message, showClose: true, duration: 3500 });
}

function resetPlan()
{
    planResult.value = null;
}

/**
 * @brief 加载炼丹总览(角色/丹方/丹炉)并初始化默认选择
 */
async function loadOverview()
{
    const [overviewRes, recipesRes] = await Promise.all([
        api.get('/alchemy/overview'),
        api.get('/alchemy/recipes'),
    ]);
    overview.characters = overviewRes.data.data.characters;
    overview.recipes = recipesRes.data.data;
    overview.furnaces = overviewRes.data.data.furnaces;
    if (!recipeId.value && overview.recipes.length > 0)
    {
        recipeId.value = overview.recipes[0].recipe_id;
    }
    if (!furnaceItemId.value && overview.furnaces.length > 0)
    {
        furnaceItemId.value = overview.furnaces[0].item_id;
        syncFurnaceQuality();
    }
}

/**
 * @brief 加载当前角色的详情
 */
async function loadCharacter()
{
    if (!characterId.value) return;
    const { data } = await api.get(`/alchemy/characters/${characterId.value}`);
    Object.assign(characterDetail, data.data);
}

/**
 * @brief 加载模拟角色的背包
 */
async function loadInventory()
{
    loadingInventory.value = true;
    try
    {
        const { data } = await api.get('/alchemy/inventory', { params: { characterId: SIM_INVENTORY_CHARACTER_ID } });
        inventory.value = data.data;
    }
    finally
    {
        loadingInventory.value = false;
    }
}

async function loadAll()
{
    await Promise.all([loadCharacter(), loadInventory()]);
}

/**
 * @brief 切换角色后重置组方并重新加载角色详情
 */
async function onCharacterChange()
{
    resetPlan();
    selectedIngredients.value = [];
    await loadCharacter();
}

/**
 * @brief 将编辑中的丹炉数值同步为所选丹炉的属性
 */
function syncFurnaceQuality()
{
    const furnace = overview.furnaces.find((item) => item.item_id === furnaceItemId.value);
    if (furnace)
    {
        furnaceQuality.value = furnace.furnace_level;
        furnaceHeat.value = furnace.heat_stability;
    }
}

async function resetFurnaceQuality()
{
    syncFurnaceQuality();
    resetPlan();
}

/**
 * @brief 保存角色的属性, 炼丹技能, 丹毒与年龄
 */
async function saveAttributes()
{
    if (!characterId.value || savingAttributes.value) return;
    savingAttributes.value = true;
    try
    {
        const { data } = await api.put(`/alchemy/characters/${characterId.value}/attributes`, {
            age: characterDetail.age,
            aptitude: characterDetail.attribute.aptitude,
            comprehension: characterDetail.attribute.comprehension,
            metal_root: characterDetail.attribute.metal_root,
            wood_root: characterDetail.attribute.wood_root,
            water_root: characterDetail.attribute.water_root,
            fire_root: characterDetail.attribute.fire_root,
            earth_root: characterDetail.attribute.earth_root,
            alchemy_level: characterDetail.alchemy_skill.alchemy_level,
            pharmacology_level: characterDetail.alchemy_skill.pharmacology_level,
            fire_control_level: characterDetail.alchemy_skill.fire_control_level,
            tolerance_level: characterDetail.alchemy_skill.tolerance_level,
            toxin_value: characterDetail.toxin_value,
        });
        Object.assign(characterDetail, data.data);
        notify('success', '命牌已更新');
    }
    catch (err)
    {
        notify('error', `保存失败: ${err.response?.data?.message || err.message}`);
    }
    finally
    {
        savingAttributes.value = false;
    }
}

/**
 * @brief 保存丹炉品质与热稳定性
 */
async function saveFurnaceQuality()
{
    if (!furnaceItemId.value) return;
    try
    {
        const { data } = await api.put(`/alchemy/furnaces/${furnaceItemId.value}`, {
            furnace_level: furnaceQuality.value,
            heat_stability: furnaceHeat.value,
        });
        const index = overview.furnaces.findIndex((item) => item.item_id === data.data.item_id);
        if (index >= 0) overview.furnaces[index] = data.data;
        notify('success', '丹炉品质已更新');
        resetPlan();
    }
    catch (err)
    {
        notify('error', `更新丹炉失败: ${err.response?.data?.message || err.message}`);
    }
}

/**
 * @brief 依据当前丹方判断草药所属药位
 *
 * @param {object} herb 草药
 * @return {string} 药位, 取值为 main, secondary 或 guide
 */
function slotForHerb(herb)
{
    if (!recipeId.value) return 'guide';
    const recipe = overview.recipes.find((item) => item.recipe_id === recipeId.value);
    if (!recipe) return 'guide';
    const main = recipe.slots?.some((slot) => slot.slot_type === 'main' && slot.effect_code === herb.main_effect);
    if (main) return 'main';
    const secondary = recipe.slots?.some(
        (slot) => slot.slot_type === 'secondary' && slot.effect_code === herb.secondary_effect
    );
    return secondary ? 'secondary' : 'guide';
}

/**
 * @brief 将草药加入组方, 同药位同药材则累加数量
 *
 * @param {object} herb 草药
 */
function addHerb(herb)
{
    const slotType = slotForHerb(herb);
    const existing = selectedIngredients.value.find(
        (item) => item.item_id === herb.item_id && item.slot_type === slotType
    );
    if (existing)
    {
        existing.quantity += 1;
    }
    else
    {
        selectedIngredients.value.push({
            item_id: herb.item_id,
            item_name: herb.item_name,
            level: herb.level,
            guide_effect: herb.guide_effect,
            main_effect: herb.main_effect,
            secondary_effect: herb.secondary_effect,
            slot_type: slotType,
            slot_index: slotType === 'secondary' ? 0 : 0,
            quantity: 1,
        });
    }
    resetPlan();
}

/**
 * @brief 查询丹方指定药位要求的药性
 *
 * @param {string} slotType 药位类型
 * @param {number} slotIndex 药位序号
 * @return {string|null} 所需药性, 无对应药位时为 null
 */
function requiredEffectForSlot(slotType, slotIndex)
{
    if (!selectedRecipe.value) return null;
    const slot = selectedRecipe.value.slots?.find(
        (item) => item.slot_type === slotType && Number(item.slot_index || 0) === Number(slotIndex || 0)
    );
    return slot?.effect_code || null;
}

const replacementHerbs = computed(() =>
{
    if (!replaceSource.value) return [];
    return herbInventory.value.filter((herb) =>
    {
        if (replaceSource.value.slot_type === 'main')
        {
            return herb.main_effect === replaceSource.value.main_effect;
        }
        if (replaceSource.value.slot_type === 'secondary')
        {
            return herb.secondary_effect === replaceSource.value.secondary_effect;
        }
        return herb.guide_effect === replaceSource.value.guide_effect;
    });
});

function openReplace(row)
{
    replaceSource.value = row;
    replaceQuantity.value = Number(row.quantity || 1);
    replaceVisible.value = true;
}

/**
 * @brief 用所选草药替换组方中的药材并更新数量
 *
 * @param {object} herb 替换后的草药
 */
function confirmReplace(herb)
{
    if (!replaceSource.value) return;
    replaceSource.value.item_id = herb.item_id;
    replaceSource.value.item_name = herb.item_name;
    replaceSource.value.level = herb.level;
    replaceSource.value.guide_effect = herb.guide_effect;
    replaceSource.value.main_effect = herb.main_effect;
    replaceSource.value.secondary_effect = herb.secondary_effect;
    replaceSource.value.quantity = Number(replaceQuantity.value || 1);
    replaceVisible.value = false;
    resetPlan();
}

/**
 * @brief 请求后端按库存自动组方并回填药材
 */
async function autoFill()
{
    if (!characterId.value || !recipeId.value || !furnaceItemId.value)
    {
        notify('warning', '请先选择修士, 丹方和丹炉');
        return;
    }
    const { data } = await api.get('/alchemy/plan', {
        params: {
            characterId: characterId.value,
            inventoryCharacterId: SIM_INVENTORY_CHARACTER_ID,
            recipeId: recipeId.value,
            furnaceItemId: furnaceItemId.value,
            batchCount: batchCount.value,
        },
    });
    selectedIngredients.value = data.data.selected.map((item) => ({
        item_id: item.item_id,
        item_name: item.item_name,
        level: item.level,
        guide_effect: item.guide_effect,
        main_effect: item.main_effect,
        secondary_effect: item.secondary_effect,
        slot_type: item.slot_type,
        slot_index: item.slot_index,
        quantity: item.quantity,
    }));
    planResult.value = data.data;
}

/**
 * @brief 依据当前选择预览炼制结果
 */
async function loadPlan()
{
    if (!characterId.value || !furnaceItemId.value)
    {
        notify('warning', '请先选择修士和炼丹炉');
        return;
    }
    if (!recipeId.value && selectedIngredients.value.length === 0)
    {
        notify('warning', '请选择丹方, 或先加入药材进行自由炼丹');
        return;
    }
    planning.value = true;
    try
    {
        if (selectedIngredients.value.length > 0)
        {
            const { data } = await api.post('/alchemy/plan', {
                characterId: characterId.value,
                inventoryCharacterId: SIM_INVENTORY_CHARACTER_ID,
                recipeId: recipeId.value || 0,
                furnaceItemId: furnaceItemId.value,
                batchCount: batchCount.value,
                ingredients: selectedIngredients.value,
            });
            planResult.value = data.data;
        }
        else
        {
            const { data } = await api.get('/alchemy/plan', {
                params: {
                    characterId: characterId.value,
                    inventoryCharacterId: SIM_INVENTORY_CHARACTER_ID,
                    recipeId: recipeId.value || 0,
                    furnaceItemId: furnaceItemId.value,
                    batchCount: batchCount.value,
                },
            });
            planResult.value = data.data;
        }
    }
    catch (err)
    {
        notify('error', `试炼预览失败: ${err.response?.data?.message || err.message}`);
    }
    finally
    {
        planning.value = false;
    }
}

/**
 * @brief 提交炼丹请求并刷新背包
 */
async function doCraft()
{
    if (!characterId.value || !furnaceItemId.value)
    {
        notify('warning', '请先选择修士和炼丹炉');
        return;
    }
    if (!recipeId.value && selectedIngredients.value.length === 0)
    {
        notify('warning', '自由炼丹需要先选择药材');
        return;
    }
    crafting.value = true;
    try
    {
        const payload = {
            characterId: characterId.value,
            inventoryCharacterId: SIM_INVENTORY_CHARACTER_ID,
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
        await loadInventory();
        selectedIngredients.value = [];
    }
    catch (err)
    {
        notify('error', `开炉失败: ${err.response?.data?.message || err.message}`);
    }
    finally
    {
        crafting.value = false;
    }
}

let previewTimer = null;
/**
 * @brief 防抖调度炼制预览
 */
function schedulePreview()
{
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() =>
    {
        if (characterId.value && furnaceItemId.value && (recipeId.value || selectedIngredients.value.length > 0))
        {
            loadPlan();
        }
    }, 250);
}

watch(
    [characterId, recipeId, furnaceItemId, batchCount, selectedIngredients],
    () => schedulePreview(),
    { deep: true }
);

watch(
    [herbCategory, herbLevelCategory, herbSearch, herbSearchMode],
    () =>
    {
        herbPage.value = 1;
    }
);

onMounted(async () =>
{
    await loadOverview();
    await loadAll();
    schedulePreview();
});
</script>

<style scoped>
.alchemy-studio {
    display: block;
    height: 100%;
    min-height: 0;
    font-family: var(--lhl-font-body);
}
.alchemy-tabs {
    height: calc(100vh - 90px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--lhl-panel);
    border: 1px solid var(--lhl-line);
    border-radius: 10px;
    box-shadow: var(--lhl-shadow);
    padding: 0 14px 14px;
}
.alchemy-tabs :deep(.el-tabs__content) {
    flex: 1;
    height: auto;
    overflow: hidden;
}
.alchemy-tabs :deep(.el-tabs__header) {
    flex: 0 0 auto;
}
.alchemy-tabs :deep(.el-tab-pane) {
    height: 100%;
}
.alchemy-tabs :deep(.el-tabs__item) {
    font-family: var(--lhl-font-display);
    letter-spacing: 3px;
    font-size: 15px;
}
.inventory-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 14px 0;
}
.inventory-panel .herb-grid {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding-right: 6px;
    grid-auto-rows: minmax(170px, auto);
}
.inventory-filter {
    width: auto;
    display: flex;
    flex-wrap: nowrap;
    margin-bottom: 12px;
    white-space: nowrap;
}
.inventory-filter :deep(.el-radio-button__inner) {
    white-space: nowrap;
}
.search-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}
.search-row .el-input {
    width: 220px;
}
.item-icon {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    color: #f8f1de;
    font-family: var(--lhl-font-display);
    font-size: 18px;
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.16), 0 4px 10px rgba(0, 0, 0, 0.18);
}
.pill-glyph {
    background: linear-gradient(145deg, #d09237, #6d3e16);
    border-radius: 50%;
}
.furnace-glyph {
    background: linear-gradient(145deg, #8f6f3c, #3d2c18);
}
.generic-glyph {
    background: linear-gradient(145deg, #5c7c72, #263d37);
}
.studio-left,
.studio-right {
    border: 1px solid var(--lhl-line);
    background: var(--lhl-panel);
    box-shadow: var(--lhl-shadow);
    border-radius: 10px;
    overflow: hidden;
}
.studio-left {
    position: fixed;
    top: 132px;
    left: 36px;
    width: 300px;
    max-height: calc(100vh - 150px);
    overflow: auto;
    z-index: 20;
}
.identity-card {
    position: static;
    width: auto;
    padding: 18px;
    background:
        linear-gradient(160deg, rgba(201, 162, 39, 0.08), transparent 42%),
        var(--lhl-panel);
}
.portrait-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 16px;
}
.portrait-ring {
    width: 112px;
    height: 112px;
    border-radius: 50%;
    padding: 7px;
    background: conic-gradient(from 120deg, var(--lhl-cinnabar), var(--lhl-gold), var(--lhl-jade), var(--lhl-cinnabar));
    box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.06), 0 10px 28px rgba(0, 0, 0, 0.24);
}
.portrait-seal {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background:
        radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.18), transparent 30%),
        var(--lhl-ink-soft);
    color: #f6e7c7;
    font-family: var(--lhl-font-display);
    font-size: 52px;
    text-shadow: 0 0 12px rgba(201, 162, 39, 0.8);
}
.portrait-name {
    margin-top: 12px;
    font-family: var(--lhl-font-display);
    font-size: 22px;
    letter-spacing: 4px;
    color: var(--lhl-text);
}
.portrait-sub {
    margin-top: 5px;
    font-size: 12px;
    letter-spacing: 1px;
    color: var(--lhl-text-2);
}
.section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
    color: var(--lhl-text);
    font-family: var(--lhl-font-display);
    font-size: 15px;
    letter-spacing: 2px;
}
.title-mark {
    width: 18px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--lhl-gold));
}
.character-select {
    width: 100%;
}
.attribute-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.attribute-row,
.toxin-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 9px;
    border: 1px solid var(--lhl-line);
    border-radius: 5px;
    background: var(--lhl-jade-soft);
    color: var(--lhl-text);
    font-size: 13px;
}
.toxin-row {
    margin-top: 10px;
    background: var(--lhl-cinnabar-soft);
}
.admin-link {
    width: 100%;
    margin-top: 14px;
    letter-spacing: 2px;
}
.studio-right {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    margin-left: 316px;
    height: 100%;
    overflow-y: auto;
}
.furnace-panel {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    gap: 18px;
    padding: 18px;
    border-radius: 10px;
    background:
        radial-gradient(circle at 20% 20%, rgba(201, 162, 39, 0.12), transparent 30%),
        var(--lhl-jade-soft);
}
.furnace-art {
    display: grid;
    place-items: center;
    position: relative;
}
.furnace-svg {
    width: 220px;
    height: 180px;
    filter: drop-shadow(0 12px 16px rgba(0, 0, 0, 0.24));
}
.furnace-rank {
    position: absolute;
    top: 0;
    right: 4px;
    z-index: 2;
    min-width: 34px;
    text-align: center;
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--lhl-cinnabar);
    color: #f8f1de;
    font-family: var(--lhl-font-mono);
    font-size: 12px;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
}
.furnace-controls {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
}
.quality-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}
.furnace-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--lhl-line);
    border-radius: 5px;
    background: var(--lhl-bg-color);
    color: var(--lhl-text-2);
    font-size: 12px;
}
.notice-box {
    border: 1px solid var(--lhl-line);
    border-radius: 6px;
    background: var(--lhl-bg-color);
    overflow: hidden;
}
.notice-title {
    width: 100%;
    border: 0;
    padding: 8px 10px;
    text-align: left;
    cursor: pointer;
    color: var(--lhl-jade-deep);
    font-family: var(--lhl-font-body);
    font-size: 13px;
    background: var(--lhl-jade-soft);
}
.notice-body {
    padding: 10px;
    color: var(--lhl-text-2);
    font-size: 12px;
    line-height: 1.7;
}
.craft-panel,
.material-panel,
.selected-panel {
    padding: 14px;
    border: 1px solid var(--lhl-line);
    border-radius: 9px;
    background: var(--lhl-panel);
}
.craft-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 12px;
}
.eyebrow {
    color: var(--lhl-gold);
    font-size: 11px;
    letter-spacing: 3px;
}
.craft-title {
    font-family: var(--lhl-font-display);
    font-size: 24px;
    letter-spacing: 5px;
    color: var(--lhl-text);
}
.craft-actions {
    display: flex;
    gap: 8px;
}
.recipe-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}
.recipe-detail {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--lhl-line);
    border-radius: 7px;
    background: var(--lhl-jade-soft);
}
.recipe-detail-row {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 10px;
    font-size: 13px;
    color: var(--lhl-text);
}
.recipe-detail-row span:first-child {
    color: var(--lhl-jade-deep);
}
.herb-filter {
    width: 180px;
    margin-bottom: 12px;
}
.filter-row {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 8px;
    margin-bottom: 12px;
}
.filter-row .el-input {
    width: 220px;
}
.batch-label {
    color: var(--lhl-text-2);
    font-size: 13px;
}
.plan-alert {
    margin-top: 12px;
}
.herb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 12px;
}
.herb-pagination {
    margin-top: 12px;
    justify-content: flex-end;
}
.inventory-description,
.inventory-effect {
    margin-top: 6px;
    color: var(--lhl-text-2);
    font-size: 12px;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.inventory-effect {
    color: var(--lhl-jade-deep);
}
.herb-card {
    position: relative;
    align-self: start;
    min-height: 0;
    padding: 10px;
    border: 1px solid var(--lhl-line);
    border-radius: 8px;
    background:
        linear-gradient(145deg, rgba(44, 140, 122, 0.06), transparent 55%),
        var(--lhl-bg-color);
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.herb-head {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
}
.herb-card:hover {
    transform: translateY(-3px);
    border-color: var(--lhl-jade);
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.14);
}
.herb-glyph {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 50% 50% 44% 44%;
    color: #f8f1de;
    font-family: var(--lhl-font-display);
    font-size: 22px;
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.18), 0 5px 12px rgba(0, 0, 0, 0.2);
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
.herb-name {
    margin-top: 0;
    font-weight: 700;
    color: var(--lhl-text);
}
.herb-level {
    display: inline-block;
    margin: 4px 8px 0 0;
    font-family: var(--lhl-font-mono);
    font-size: 11px;
    color: var(--lhl-gold);
}
.herb-effects {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
    vertical-align: middle;
}
.herb-effects span {
    font-size: 11px;
    padding: 2px 5px;
    border-radius: 3px;
    color: var(--lhl-jade-deep);
    background: var(--lhl-jade-soft);
}
.herb-stock {
    margin-top: 7px;
    color: var(--lhl-text-2);
    font-size: 12px;
}
.herb-add {
    margin-top: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
}
.herb-add :deep(.el-button) {
    width: 100%;
}
.selected-panel {
    height: auto;
    min-height: 120px;
    min-width: 0;
    flex-shrink: 0;
    overflow: visible;
    padding-bottom: 18px;
}
.selected-panel :deep(.el-table) {
    width: 100%;
}
.replace-tip {
    margin-bottom: 10px;
    color: var(--lhl-text-2);
    font-size: 13px;
}
@media (max-width: 1080px) {
    .studio-left {
        position: relative;
        top: auto;
        left: auto;
        width: auto;
        max-height: none;
        margin-bottom: 14px;
    }
    .studio-right {
        margin-left: 0;
    }
    .furnace-panel {
        grid-template-columns: 1fr;
    }
}
</style>
