<template>
    <section v-loading="loading" class="character-admin">
        <div class="admin-head">
            <div>
                <div class="eyebrow">管理后台 · 角色卷宗</div>
                <h2>角色管理</h2>
                <p>修改会直接写入当前存档，并同步到修行、炼丹与背包页面</p>
            </div>
            <el-button type="primary" :loading="saving" @click="saveCharacter">保存全部修改</el-button>
        </div>

        <div v-if="state" class="admin-grid">
            <div class="admin-column">
                <section class="admin-panel">
                    <div class="panel-title">身份与境界</div>
                    <el-form label-position="top" class="compact-form">
                        <div class="two-column">
                            <el-form-item label="道号">
                                <el-input v-model="form.name" maxlength="16" />
                            </el-form-item>
                            <el-form-item label="性别">
                                <el-radio-group v-model="form.gender">
                                    <el-radio :label="1">男</el-radio>
                                    <el-radio :label="2">女</el-radio>
                                </el-radio-group>
                            </el-form-item>
                            <el-form-item label="年龄">
                                <el-input-number v-model="form.age" :min="1" :max="99999" controls-position="right" />
                            </el-form-item>
                            <el-form-item label="种族">
                                <el-select v-model="form.raceId" style="width: 100%">
                                    <el-option v-for="race in catalog.races" :key="race.race_id" :label="race.race_name" :value="race.race_id" />
                                </el-select>
                            </el-form-item>
                            <el-form-item label="职业">
                                <el-select v-model="form.classId" style="width: 100%">
                                    <el-option v-for="item in catalog.classes" :key="item.class_id" :label="item.class_name" :value="item.class_id" />
                                </el-select>
                            </el-form-item>
                            <el-form-item label="境界">
                                <el-select v-model="form.realmId" filterable style="width: 100%">
                                    <el-option
                                        v-for="item in catalog.realms"
                                        :key="item.realm_id"
                                        :label="`${WORLD_LABELS[item.realm_world]} · ${item.realm_name}`"
                                        :value="item.realm_id"
                                    />
                                </el-select>
                            </el-form-item>
                            <el-form-item label="小境界">
                                <el-select v-model="form.realmStage" style="width: 100%">
                                    <el-option label="初期" :value="1" />
                                    <el-option label="中期" :value="2" />
                                    <el-option label="后期" :value="3" />
                                </el-select>
                            </el-form-item>
                            <el-form-item label="灵石">
                                <el-input-number v-model="form.spiritStones" :min="0" controls-position="right" />
                            </el-form-item>
                            <el-form-item label="当前修为">
                                <el-input-number v-model="form.cultivation" :min="0" controls-position="right" />
                            </el-form-item>
                            <el-form-item label="已过天数">
                                <el-input-number v-model="form.dayCount" :min="1" controls-position="right" />
                            </el-form-item>
                        </div>
                        <el-form-item label="角色描述">
                            <el-input v-model="form.description" type="textarea" :rows="2" maxlength="255" />
                        </el-form-item>
                    </el-form>
                </section>

                <section class="admin-panel">
                    <div class="panel-title">
                        <span>基础属性</span>
                        <span class="panel-note">最终属性 = 基础 + 种族 + 天赋</span>
                    </div>
                    <div class="stat-grid">
                        <label v-for="stat in baseStats" :key="stat.key">
                            <span>{{ stat.label }}</span>
                            <el-input-number v-model="form[stat.key]" :min="0" :max="999999" controls-position="right" />
                            <small>最终 {{ effective[stat.key] }}</small>
                        </label>
                    </div>
                </section>

                <section class="admin-panel">
                    <div class="panel-title">
                        <span>五行灵根</span>
                        <span class="panel-note">合计 {{ rootTotal }}</span>
                    </div>
                    <div class="root-grid">
                        <label v-for="root in rootStats" :key="root.key">
                            <span>{{ root.label }}</span>
                            <el-slider v-model="form[root.key]" :max="100" />
                            <strong>{{ form[root.key] }}</strong>
                        </label>
                    </div>
                </section>

                <section class="admin-panel">
                    <div class="panel-title">天赋</div>
                    <el-select v-model="talentIds" multiple :multiple-limit="2" placeholder="最多选择两个天赋" style="width: 100%">
                        <el-option v-for="talent in catalog.talents" :key="talent.talent_id" :label="`${talent.talent_name} · ${talent.rarity}`" :value="talent.talent_id" />
                    </el-select>
                    <div class="talent-list">
                        <article v-for="talent in selectedTalents" :key="talent.talent_id" class="talent-card">
                            <div>
                                <strong>{{ talent.talent_name }}</strong>
                                <span>{{ talent.rarity }}</span>
                            </div>
                            <p>{{ talent.talent_description }}</p>
                            <small>{{ talentEffectText(talent) }}</small>
                        </article>
                    </div>
                </section>

                <section class="admin-panel">
                    <div class="panel-title">丹道与状态</div>
                    <div class="stat-grid small-stats">
                        <label>
                            <span>丹道</span>
                            <el-input-number v-model="form.alchemyLevel" :min="0" :max="12" controls-position="right" />
                        </label>
                        <label>
                            <span>药理</span>
                            <el-input-number v-model="form.pharmacologyLevel" :min="0" :max="12" controls-position="right" />
                        </label>
                        <label>
                            <span>控火</span>
                            <el-input-number v-model="form.fireControlLevel" :min="0" :max="12" controls-position="right" />
                        </label>
                        <label>
                            <span>耐药</span>
                            <el-input-number v-model="form.toleranceLevel" :min="0" :max="12" controls-position="right" />
                        </label>
                        <label>
                            <span>丹毒</span>
                            <el-input-number v-model="form.toxinValue" :min="0" :max="999999" controls-position="right" />
                        </label>
                        <label>
                            <span>炼丹成功</span>
                            <el-input-number v-model="form.successCount" :min="0" :max="999999999" controls-position="right" />
                        </label>
                        <label>
                            <span>最佳丹方</span>
                            <el-input-number v-model="form.bestRecipeLevel" :min="0" :max="12" controls-position="right" />
                        </label>
                    </div>
                </section>
            </div>

            <div class="admin-column inventory-column">
                <section class="admin-panel inventory-panel">
                    <div class="panel-title">
                        <span>角色背包</span>
                        <span class="panel-note">{{ state.inventory.length }} 种物品</span>
                    </div>
                    <div class="inventory-controls">
                        <el-select v-model="inventoryCategory" size="small">
                            <el-option label="全部" value="all" />
                            <el-option label="草药" value="herb" />
                            <el-option label="丹药" value="pill" />
                            <el-option label="丹炉" value="furnace" />
                            <el-option label="丹方" value="recipe" />
                            <el-option label="材料" value="material" />
                        </el-select>
                        <el-input v-model="inventorySearch" size="small" clearable placeholder="搜索背包" />
                    </div>

                    <div class="grant-box">
                        <el-select v-model="grantItemId" filterable placeholder="选择要获取的物品" style="min-width: 260px">
                            <el-option
                                v-for="item in catalog.items"
                                :key="item.item_id"
                                :label="`${item.item_name} · ${item.item_category_name || '未分类'}`"
                                :value="item.item_id"
                            />
                        </el-select>
                        <el-input-number v-model="grantAmount" :min="1" :max="9999" controls-position="right" />
                        <el-button type="primary" :disabled="!grantItemId" :loading="inventoryBusy" @click="grantItem">获取</el-button>
                    </div>

                    <div class="inventory-list">
                        <article v-for="item in filteredInventory" :key="item.item_id" class="inventory-row">
                            <div class="inventory-icon">{{ inventoryGlyph(item) }}</div>
                            <div class="inventory-info">
                                <strong>{{ item.item_name }}</strong>
                                <span>{{ item.item_category_name }} · L{{ item.level }}</span>
                            </div>
                            <span class="quantity">×{{ item.quantity }}</span>
                            <div class="inventory-actions">
                                <el-button size="small" :loading="inventoryBusy" @click="adjustInventory(item, 'remove', 1)">-1</el-button>
                                <el-button size="small" :loading="inventoryBusy" @click="adjustInventory(item, 'add', 1)">+1</el-button>
                                <el-button size="small" type="danger" plain :loading="inventoryBusy" @click="adjustInventory(item, 'set', 0)">移除</el-button>
                            </div>
                        </article>
                        <el-empty v-if="filteredInventory.length === 0" description="背包中没有符合条件的物品" :image-size="70" />
                    </div>
                </section>
            </div>
        </div>
    </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const emit = defineEmits(['player-updated']);
const WORLD_LABELS = { 1: '小世界', 2: '大世界', 3: '仙界', 4: '上层位面' };
const baseStats = [
    { key: 'aptitude', label: '资质' },
    { key: 'comprehension', label: '悟性' },
    { key: 'maxHp', label: '气血' },
    { key: 'attack', label: '攻伐' },
    { key: 'defense', label: '护体' },
];
const rootStats = [
    { key: 'metalRoot', label: '金灵根' },
    { key: 'woodRoot', label: '木灵根' },
    { key: 'waterRoot', label: '水灵根' },
    { key: 'fireRoot', label: '火灵根' },
    { key: 'earthRoot', label: '土灵根' },
];

const loading = ref(true);
const saving = ref(false);
const inventoryBusy = ref(false);
const state = ref(null);
const catalog = reactive({ races: [], classes: [], realms: [], talents: [], items: [] });
const talentIds = ref([]);
const form = reactive({
    name: '',
    gender: 1,
    age: 16,
    raceId: 0,
    classId: 0,
    realmId: 1,
    realmStage: 1,
    cultivation: 0,
    spiritStones: 0,
    dayCount: 1,
    description: '',
    aptitude: 10,
    comprehension: 10,
    maxHp: 100,
    attack: 10,
    defense: 10,
    metalRoot: 20,
    woodRoot: 20,
    waterRoot: 20,
    fireRoot: 20,
    earthRoot: 20,
    alchemyLevel: 1,
    pharmacologyLevel: 1,
    fireControlLevel: 1,
    toleranceLevel: 0,
    successCount: 0,
    bestRecipeLevel: 0,
    toxinValue: 0,
});
const inventoryCategory = ref('all');
const inventorySearch = ref('');
const grantItemId = ref(null);
const grantAmount = ref(1);

const selectedRace = computed(() => catalog.races.find((race) => Number(race.race_id) === Number(form.raceId)));
const selectedTalents = computed(() =>
    talentIds.value.map((id) => catalog.talents.find((talent) => Number(talent.talent_id) === Number(id))).filter(Boolean)
);
const talentBonuses = computed(() =>
{
    const totals = { aptitude: 0, comprehension: 0, maxHp: 0, attack: 0, defense: 0, cultivation: 0, alchemy: 0 };
    for (const talent of selectedTalents.value)
    {
        totals.aptitude += Number(talent.aptitude_bonus || 0);
        totals.comprehension += Number(talent.comprehension_bonus || 0);
        totals.maxHp += Number(talent.max_hp_bonus || 0);
        totals.attack += Number(talent.attack_bonus || 0);
        totals.defense += Number(talent.defense_bonus || 0);
        totals.cultivation += Number(talent.cultivation_bonus || 0);
        totals.alchemy += Number(talent.alchemy_bonus || 0);
    }
    return totals;
});
const effective = computed(() =>
{
    const race = selectedRace.value || {};
    return {
        aptitude: form.aptitude + Number(race.aptitude_bonus || 0) + talentBonuses.value.aptitude,
        comprehension: form.comprehension + Number(race.comprehension_bonus || 0) + talentBonuses.value.comprehension,
        maxHp: form.maxHp + Number(race.max_hp_bonus || 0) + talentBonuses.value.maxHp,
        attack: form.attack + Number(race.attack_bonus || 0) + talentBonuses.value.attack,
        defense: form.defense + Number(race.defense_bonus || 0) + talentBonuses.value.defense,
    };
});
const rootTotal = computed(() =>
    rootStats.reduce((sum, root) => sum + Number(form[root.key] || 0), 0)
);
const filteredInventory = computed(() =>
{
    const keyword = inventorySearch.value.trim();
    return (state.value?.inventory || []).filter((item) =>
    {
        if (inventoryCategory.value === 'herb' && !item.main_effect) return false;
        if (inventoryCategory.value === 'pill' && !item.pill_category) return false;
        if (inventoryCategory.value === 'furnace' && !item.item_code?.startsWith('FURNACE_ALC')) return false;
        if (inventoryCategory.value === 'recipe' && Number(item.item_category_id) !== 12) return false;
        if (inventoryCategory.value === 'material' && Number(item.item_category_id) !== 2) return false;
        return !keyword || `${item.item_name} ${item.item_category_name || ''}`.includes(keyword);
    });
});

function applyState(data)
{
    state.value = data;
    const character = data.character;
    const base = character.baseAttributes;
    const roots = character.roots;
    Object.assign(form, {
        name: character.name,
        gender: character.gender,
        age: character.age,
        raceId: character.raceId,
        classId: Number(state.value.character.classId || form.classId || 0),
        realmId: character.realmId,
        realmStage: character.stage,
        cultivation: data.cultivation,
        spiritStones: data.spiritStones,
        dayCount: data.dayCount,
        description: character.description || '',
        aptitude: base.aptitude,
        comprehension: base.comprehension,
        maxHp: base.maxHp,
        attack: base.attack,
        defense: base.defense,
        metalRoot: roots.metal,
        woodRoot: roots.wood,
        waterRoot: roots.water,
        fireRoot: roots.fire,
        earthRoot: roots.earth,
    });
    talentIds.value = character.talents.map((talent) => Number(talent.talent_id));
}

async function load()
{
    loading.value = true;
    try
    {
        const [playerRes, catalogRes] = await Promise.all([
            api.get('/admin/player'),
            api.get('/admin/catalog'),
        ]);
        Object.assign(catalog, catalogRes.data.data);
        applyState(playerRes.data.data);
        if (!form.classId) form.classId = catalog.classes[0]?.class_id || 0;
    }
    catch (error)
    {
        ElMessage.error(`读取角色失败: ${error.response?.data?.message || error.message}`);
    }
    finally
    {
        loading.value = false;
    }
}

async function loadSkills()
{
    if (!state.value?.character?.characterId) return;
    const { data } = await api.get(`/alchemy/characters/${state.value.character.characterId}`);
    form.alchemyLevel = Number(data.data.alchemy_skill.alchemy_level || 0);
    form.pharmacologyLevel = Number(data.data.alchemy_skill.pharmacology_level || 0);
    form.fireControlLevel = Number(data.data.alchemy_skill.fire_control_level || 0);
    form.toleranceLevel = Number(data.data.alchemy_skill.tolerance_level || 0);
    form.successCount = Number(data.data.alchemy_skill.success_count || 0);
    form.bestRecipeLevel = Number(data.data.alchemy_skill.best_recipe_level || 0);
    form.toxinValue = Number(data.data.toxin_value || 0);
}

async function saveCharacter()
{
    if (saving.value) return;
    saving.value = true;
    try
    {
        const { data } = await api.put('/admin/player', {
            ...form,
            talentIds: talentIds.value,
        });
        applyState(data.data);
        await loadSkills();
        ElMessage.success('角色修改已保存');
        emit('player-updated');
    }
    catch (error)
    {
        ElMessage.error(`保存失败: ${error.response?.data?.message || error.message}`);
    }
    finally
    {
        saving.value = false;
    }
}

async function adjustInventory(item, mode, amount)
{
    if (inventoryBusy.value) return;
    inventoryBusy.value = true;
    try
    {
        const { data } = await api.put(`/admin/player/inventory/${item.item_id}`, { mode, amount });
        state.value = data.data;
        ElMessage.success('背包已更新');
        emit('player-updated');
    }
    catch (error)
    {
        ElMessage.error(`更新背包失败: ${error.response?.data?.message || error.message}`);
    }
    finally
    {
        inventoryBusy.value = false;
    }
}

async function grantItem()
{
    if (!grantItemId.value) return;
    const item = { item_id: grantItemId.value };
    await adjustInventory(item, 'add', grantAmount.value);
    grantItemId.value = null;
}

function talentEffectText(talent)
{
    const labels = {
        aptitude_bonus: '资质',
        comprehension_bonus: '悟性',
        max_hp_bonus: '气血',
        attack_bonus: '攻伐',
        defense_bonus: '护体',
        cultivation_bonus: '修炼效率',
        alchemy_bonus: '炼丹效率',
    };
    return Object.entries(labels)
        .filter(([key]) => Number(talent[key] || 0) !== 0)
        .map(([key, label]) => `${label} ${Number(talent[key]) > 0 ? '+' : ''}${talent[key]}${key.endsWith('_bonus') && ['cultivation_bonus', 'alchemy_bonus'].includes(key) ? '%' : ''}`)
        .join(' · ') || '无数值加成';
}

function inventoryGlyph(item)
{
    if (item.main_effect) return item.main_effect.slice(0, 1);
    if (item.pill_category) return '丹';
    if (item.item_code?.startsWith('FURNACE_ALC')) return '炉';
    if (Number(item.item_category_id) === 12) return '方';
    return item.item_name?.slice(0, 1) || '物';
}

onMounted(async () =>
{
    await load();
    await loadSkills();
});
</script>

<style scoped>
.character-admin {
    min-height: calc(100vh - 112px);
}
.admin-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 16px;
}
.admin-head h2 {
    margin: 3px 0 4px;
    font-family: var(--lhl-font-display);
    font-size: 28px;
    font-weight: 500;
    letter-spacing: 5px;
}
.admin-head p {
    margin: 0;
    color: var(--lhl-text-2);
    font-size: 13px;
}
.eyebrow,
.panel-note,
.talent-card span,
.talent-card small,
.inventory-info span {
    color: var(--lhl-text-2);
    font-size: 11px;
}
.eyebrow {
    color: var(--lhl-gold);
    letter-spacing: 3px;
}
.admin-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
    gap: 16px;
    align-items: start;
}
.admin-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
}
.admin-panel {
    padding: 18px;
    border: 1px solid var(--lhl-line);
    border-radius: 9px;
    background: var(--lhl-panel);
    box-shadow: var(--lhl-shadow);
}
.panel-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    font-family: var(--lhl-font-display);
    font-size: 16px;
    letter-spacing: 2px;
}
.two-column,
.stat-grid,
.root-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
}
.compact-form :deep(.el-form-item) {
    margin-bottom: 8px;
}
.stat-grid label,
.root-grid label {
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 9px;
    border: 1px solid var(--lhl-line);
    border-radius: 6px;
    background: var(--lhl-jade-soft);
}
.stat-grid label small {
    grid-column: 2;
    color: var(--lhl-jade-deep);
    font-size: 11px;
}
.small-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}
.root-grid label {
    grid-template-columns: 58px minmax(0, 1fr) 30px;
}
.root-grid strong {
    color: var(--lhl-jade-deep);
    text-align: right;
}
.talent-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
}
.talent-card {
    padding: 11px;
    border: 1px solid var(--lhl-line);
    border-radius: 6px;
    background: var(--lhl-bg-color);
}
.talent-card > div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}
.talent-card p {
    margin: 7px 0;
    color: var(--lhl-text-2);
    font-size: 12px;
    line-height: 1.6;
}
.inventory-panel {
    position: sticky;
    top: 0;
}
.inventory-controls,
.grant-box,
.inventory-row,
.inventory-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.inventory-controls .el-input {
    flex: 1;
}
.grant-box {
    margin: 12px 0;
    padding: 10px;
    border: 1px solid var(--lhl-line);
    border-radius: 7px;
    background: var(--lhl-jade-soft);
}
.grant-box .el-select {
    flex: 1;
}
.inventory-list {
    max-height: calc(100vh - 340px);
    min-height: 220px;
    overflow: auto;
}
.inventory-row {
    padding: 8px 3px;
    border-bottom: 1px dashed var(--lhl-line);
}
.inventory-icon {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    color: #f8f1de;
    background: var(--lhl-jade-deep);
    font-family: var(--lhl-font-display);
}
.inventory-info {
    flex: 1;
    min-width: 0;
}
.inventory-info strong,
.inventory-info span {
    display: block;
}
.quantity {
    color: var(--lhl-jade-deep);
    font-family: var(--lhl-font-mono);
}
.inventory-actions :deep(.el-button + .el-button) {
    margin-left: 0;
}
@media (max-width: 1180px) {
    .admin-grid {
        grid-template-columns: minmax(0, 1fr);
    }
    .inventory-panel {
        position: static;
    }
    .inventory-list {
        max-height: 460px;
    }
}
@media (max-width: 720px) {
    .admin-head {
        align-items: stretch;
        flex-direction: column;
    }
    .two-column,
    .stat-grid,
    .root-grid,
    .talent-list {
        grid-template-columns: minmax(0, 1fr);
    }
    .grant-box {
        align-items: stretch;
        flex-direction: column;
    }
    .inventory-row {
        flex-wrap: wrap;
    }
}
</style>
