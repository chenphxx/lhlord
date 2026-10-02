<template>
    <div class="game-shell">
        <div v-if="loading" class="game-hint">正在推演天机</div>

        <!-- 开局: 创建修士 -->
        <section v-else-if="!hasSave" class="start-screen">
            <div class="start-scroll">
                <div class="start-seal" aria-hidden="true">灵</div>
                <div class="start-eyebrow">青岚山下 · 修士初醒</div>
                <h1 class="start-title">灵寰录</h1>
                <p class="start-copy">
                    你在一座无名山腰醒来, 丹田空空, 只余一缕灵气游走经脉
                    取一个道号, 从此踏入仙途
                </p>
                <form class="start-form" @submit.prevent="startGame">
                    <label class="start-label" for="dao-name">道号</label>
                    <el-input
                        id="dao-name"
                        v-model="startName"
                        maxlength="16"
                        show-word-limit
                        placeholder="如: 云中客"
                        size="large"
                        @keyup.enter="startGame"
                    />
                    <el-button
                        type="primary"
                        size="large"
                        class="start-btn"
                        :loading="starting"
                        :disabled="!startName.trim()"
                        @click="startGame"
                    >
                        踏入仙途
                    </el-button>
                </form>
                <div class="start-foot">本地单机存档 · 仅一个存档位, 创建后不可重置</div>
            </div>
        </section>

        <template v-else>
            <nav class="game-nav">
                <div class="game-nav-tabs">
                    <button
                        v-for="tab in playerTabs"
                        :key="tab.name"
                        type="button"
                        class="game-tab"
                        :class="{ active: activeTab === tab.name }"
                        :aria-current="activeTab === tab.name ? 'page' : undefined"
                        @click="activeTab = tab.name"
                    >
                        {{ tab.label }}
                    </button>
                </div>
                <div class="game-nav-meta">
                    <span class="meta-chip">第 {{ state.dayCount }} 日</span>
                    <span class="meta-chip gold">灵石 {{ formatNumber(state.spiritStones) }}</span>
                    <span class="meta-chip jade">{{ character.name }} · {{ realmLabel }}</span>
                </div>
            </nav>

            <div v-if="activeTab === 'cultivate'" class="cultivate-layout">
                <aside class="identity-card">
                    <div class="portrait-wrap">
                        <div class="portrait-ring">
                            <div class="portrait-seal">{{ character.name.slice(0, 1) }}</div>
                        </div>
                        <div class="portrait-name">{{ character.name }}</div>
                        <div class="portrait-sub">{{ realmLabel }} · {{ character.className }} · {{ character.sectName }}</div>
                    </div>

                    <div class="section-title">
                        <span class="title-mark"></span>
                        <span>修为</span>
                    </div>
                    <div class="cultivation-block">
                        <div class="cultivation-numbers">
                            <span class="cultivation-current">{{ formatNumber(state.cultivation) }}</span>
                            <span class="cultivation-max">/ {{ formatNumber(state.cultivationRequired) }}</span>
                        </div>
                        <div class="cultivation-bar" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
                            <div class="cultivation-fill" :class="{ ready: cultivationReady }" :style="{ width: `${progressPercent}%` }"></div>
                        </div>
                        <div class="cultivation-note">
                            {{ cultivationReady ? '修为已满, 可以尝试突破' : `尚需 ${formatNumber(state.cultivationRequired - state.cultivation)} 点修为` }}
                        </div>
                    </div>

                    <div class="section-title">
                        <span class="title-mark"></span>
                        <span>根骨</span>
                    </div>
                    <div class="attribute-grid">
                        <div class="attribute-row"><span>资质</span><span class="attribute-value">{{ character.aptitude }}</span></div>
                        <div class="attribute-row"><span>悟性</span><span class="attribute-value">{{ character.comprehension }}</span></div>
                        <div class="attribute-row"><span>气血</span><span class="attribute-value">{{ character.maxHp }}</span></div>
                        <div class="attribute-row"><span>攻伐</span><span class="attribute-value">{{ character.attack }}</span></div>
                        <div class="attribute-row"><span>护体</span><span class="attribute-value">{{ character.defense }}</span></div>
                        <div class="attribute-row"><span>年龄</span><span class="attribute-value">{{ character.age }}</span></div>
                    </div>

                    <div class="section-title">
                        <span class="title-mark"></span>
                        <span>丹药在身</span>
                    </div>
                    <div v-if="state.buffs.length === 0" class="buff-empty">当前没有丹药效力</div>
                    <div v-else class="buff-list">
                        <div v-for="buff in state.buffs" :key="buff.buff_code" class="buff-chip">
                            <span class="buff-name">{{ buffLabel(buff.buff_code) }}</span>
                            <span class="buff-value">+{{ buff.buff_value }}%</span>
                            <span class="buff-time">{{ formatDateTime(buff.expires_at) }}</span>
                        </div>
                    </div>
                </aside>

                <div class="stage-column">
                    <section class="panel ladder-panel">
                        <div class="section-title">
                            <span class="title-mark"></span>
                            <span>{{ worldLabel }} · 境界天梯</span>
                        </div>
                        <div class="realm-ladder">
                            <div
                                v-for="node in ladder"
                                :key="node.realm_id"
                                class="ladder-node"
                                :class="ladderState(node)"
                            >
                                <div class="ladder-name">{{ node.realm_name }}</div>
                                <div class="ladder-dot" aria-hidden="true"></div>
                                <div class="ladder-ticks" aria-hidden="true">
                                    <span v-for="step in STAGE_LABELS.slice(1)" :key="step" class="tick" :class="{ lit: tickLit(node, step) }"></span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="action-grid">
                        <article class="action-card">
                            <div class="action-glyph" aria-hidden="true">寻</div>
                            <div class="action-body">
                                <div class="action-title">探索</div>
                                <p class="action-copy">入山寻药, 或得草药与灵石, 耗时一日</p>
                            </div>
                            <el-button type="primary" plain :loading="acting === 'explore'" @click="doExplore">探索一次</el-button>
                        </article>

                        <article class="action-card">
                            <div class="action-glyph" aria-hidden="true">坐</div>
                            <div class="action-body">
                                <div class="action-title">闭关</div>
                                <p class="action-copy">静室运转周天, 每日可得 {{ formatNumber(state.cultivationPerDay) }} 点修为</p>
                            </div>
                            <el-button type="primary" :loading="acting === 'cultivate'" @click="doCultivate">闭关一日</el-button>
                        </article>

                        <article class="action-card breakthrough-card" :class="{ ready: cultivationReady }">
                            <div class="action-glyph" aria-hidden="true">破</div>
                            <div class="action-body">
                                <div class="action-title">突破</div>
                                <p class="action-copy">
                                    {{ cultivationReady
                                        ? `冲击${nextStageLabel}, 成功率约 ${breakthroughChance}%`
                                        : `修为不足, 尚需 ${formatNumber(state.cultivationRequired - state.cultivation)} 点` }}
                                </p>
                            </div>
                            <el-button
                                type="danger"
                                :plain="!cultivationReady"
                                :disabled="!cultivationReady"
                                :loading="acting === 'breakthrough'"
                                @click="doBreakthrough"
                            >
                                尝试突破
                            </el-button>
                        </article>
                    </section>

                    <div class="lower-grid">
                        <section class="panel bag-panel">
                            <div class="section-title">
                                <span class="title-mark"></span>
                                <span>行囊</span>
                            </div>
                            <div class="bag-filter">
                                <el-radio-group v-model="bagCategory" size="small">
                                    <el-radio-button label="all">全部</el-radio-button>
                                    <el-radio-button label="herb">草药</el-radio-button>
                                    <el-radio-button label="pill">丹药</el-radio-button>
                                    <el-radio-button label="furnace">丹炉</el-radio-button>
                                </el-radio-group>
                            </div>
                            <div v-if="bagItems.length === 0" class="bag-empty">行囊空空, 出门探索或闭关炼丹吧</div>
                            <ul v-else class="bag-list">
                                <li v-for="item in bagItems" :key="item.item_id" class="bag-item">
                                    <span class="bag-glyph" :class="glyphClass(item)">{{ glyphText(item) }}</span>
                                    <span class="bag-name">{{ item.item_name }}</span>
                                    <span class="bag-level">L{{ item.level }}</span>
                                    <span class="bag-count">×{{ item.quantity }}</span>
                                    <el-button
                                        v-if="item.pill_category"
                                        size="small"
                                        text
                                        type="primary"
                                        :loading="usingPillId === item.item_id"
                                        :disabled="usingPillId !== 0"
                                        @click="usePill(item)"
                                    >
                                        服用
                                    </el-button>
                                </li>
                            </ul>
                        </section>

                        <section class="panel journal-panel">
                            <div class="section-title">
                                <span class="title-mark"></span>
                                <span>修行见闻</span>
                            </div>
                            <ul class="journal-list">
                                <li v-for="event in state.events" :key="event.event_id" class="journal-item" :class="`journal-${event.event_type}`">
                                    <div class="journal-head">
                                        <span class="journal-title">{{ event.title }}</span>
                                        <span class="journal-time">{{ formatDateTime(event.create_time) }}</span>
                                    </div>
                                    <p class="journal-copy">{{ event.description }}</p>
                                </li>
                            </ul>
                            <div v-if="state.events.length === 0" class="journal-empty">尚无见闻, 出门走走吧</div>
                        </section>
                    </div>
                </div>
            </div>

            <AlchemyView
                v-else
                :player-character-id="character.characterId"
                :own-furnace-ids="ownedFurnaceIds"
                @crafted="onCrafted"
            />
        </template>
    </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';
import AlchemyView from './AlchemyView.vue';

const playerTabs = [
    { name: 'cultivate', label: '修行' },
    { name: 'alchemy', label: '炼丹房' },
];
const STAGE_LABELS = ['', '初期', '中期', '后期'];
const WORLD_LABELS = { 1: '小世界', 2: '大世界', 3: '仙界', 4: '上层位面' };
const BUFF_LABELS = {
    CULTIVATION_UP: '修炼增益',
    BREAKTHROUGH_BONUS: '突破助力',
    COMPREHENSION_UP: '悟性增益',
    ATTACK_UP: '攻伐增益',
    DEFENSE_UP: '护体增益',
    HEAL: '疗伤',
};

const activeTab = ref('cultivate');
const loading = ref(true);
const starting = ref(false);
const acting = ref('');
const startName = ref('');
const state = ref(null);
const realms = ref([]);
const bagCategory = ref('all');
const usingPillId = ref(0);

const hasSave = computed(() => Boolean(state.value?.hasSave));
const character = computed(() => state.value?.character || {});
const ladder = computed(() =>
    realms.value.filter((realm) => Number(realm.realm_world) === Number(character.value.realmWorld))
);
const worldLabel = computed(() => WORLD_LABELS[character.value.realmWorld] || '未知位面');
const realmLabel = computed(() => `${character.value.realm || ''}${STAGE_LABELS[character.value.stage] || ''}`);
const progressPercent = computed(() =>
{
    if (!state.value?.cultivationRequired) return 0;
    return Math.min(100, Math.round((state.value.cultivation / state.value.cultivationRequired) * 100));
});
const cultivationReady = computed(() => progressPercent.value >= 100);
const breakthroughChance = computed(() => Math.round(state.value?.breakthroughChance || 0));
const nextStageLabel = computed(() =>
{
    const stage = Number(character.value.stage);
    return stage >= 3 ? '下一境界' : `${character.value.realm}${STAGE_LABELS[stage + 1]}`;
});
const ownedFurnaceIds = computed(() =>
    (state.value?.inventory || [])
        .filter((item) => item.item_code?.startsWith('FURNACE_ALC'))
        .map((item) => Number(item.item_id))
);
const bagItems = computed(() =>
{
    const inventory = state.value?.inventory || [];
    if (bagCategory.value === 'herb') return inventory.filter((item) => item.main_effect);
    if (bagCategory.value === 'pill') return inventory.filter((item) => item.pill_category);
    if (bagCategory.value === 'furnace') return inventory.filter((item) => item.item_code?.startsWith('FURNACE_ALC'));
    return inventory;
});

/**
 * @brief 数字千分位展示
 *
 * @param {number} value 数值
 * @return {string} 便于阅读的数字文本
 */
function formatNumber(value)
{
    return Number(value || 0).toLocaleString('zh-CN');
}

/**
 * @brief 将时间格式化为月-日 时:分
 *
 * @param {string} value 时间字符串
 * @return {string} 格式化结果, 空值返回占位符
 */
function formatDateTime(value)
{
    if (!value) return '--';
    const date = new Date(value);
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buffLabel(code)
{
    return BUFF_LABELS[code] || code;
}

function ladderState(node)
{
    const level = Number(node.realm_level);
    if (Number(node.realm_id) === Number(character.value.realmId)) return 'current';
    return level < Number(character.value.realmLevel) ? 'passed' : 'locked';
}

/**
 * @brief 判断境界节点的第 n 个小境界刻度是否点亮
 *
 * @param {object} node 境界节点
 * @param {string} step 小境界名(初期/中期/后期)
 * @return {boolean} 是否点亮
 */
function tickLit(node, step)
{
    const stepIndex = STAGE_LABELS.indexOf(step);
    const level = Number(node.realm_level);
    if (level < Number(character.value.realmLevel)) return true;
    if (level > Number(character.value.realmLevel)) return false;
    return stepIndex <= Number(character.value.stage);
}

function glyphClass(item)
{
    if (item.main_effect) return `herb-level-${Math.min(Number(item.level) || 1, 12)}`;
    if (item.pill_category) return 'pill-glyph';
    if (item.item_code?.startsWith('FURNACE_ALC')) return 'furnace-glyph';
    return 'generic-glyph';
}

function glyphText(item)
{
    if (item.main_effect) return item.main_effect.slice(0, 1);
    if (item.pill_category) return '丹';
    if (item.item_code?.startsWith('FURNACE_ALC')) return '炉';
    return item.item_name?.slice(0, 1) || '物';
}

function notify(type, message)
{
    ElMessage({ type, message, showClose: true, duration: 3500 });
}

/**
 * @brief 应用一次操作返回的存档状态
 *
 * @param {object} data 接口返回的存档数据
 */
function applyState(data)
{
    state.value = data;
}

async function reload()
{
    const { data } = await api.get('/game/state');
    applyState(data.data);
}

async function loadRealms()
{
    const { data } = await api.get('/game/realms');
    realms.value = data.data;
}

/**
 * @brief 提交开局请求并进入修行界面
 */
async function startGame()
{
    const name = startName.value.trim();
    if (!name || starting.value) return;
    starting.value = true;
    try
    {
        const { data } = await api.post('/game/start', { name });
        applyState(data.data);
        notify('success', `${name}, 仙途始于今日`);
    }
    catch (error)
    {
        notify('error', `开局失败: ${error.response?.data?.message || error.message}`);
    }
    finally
    {
        starting.value = false;
    }
}

/**
 * @brief 执行一次玩家操作并刷新存档状态
 *
 * @param {string} action 操作类型(start 之外的 game 接口名)
 * @param {Function} messageOf 依据接口返回组装提示文案
 */
async function runAction(action, messageOf)
{
    if (acting.value) return;
    acting.value = action;
    try
    {
        const { data } = await api.post(`/game/${action}`);
        applyState(data.data);
        notify('success', messageOf(data.result, data.data));
    }
    catch (error)
    {
        notify('error', error.response?.data?.message || error.message);
    }
    finally
    {
        acting.value = '';
    }
}

function doExplore()
{
    runAction('explore', (result) => `采得 ${result.quantity} 株${result.herb.item_name}, 拾得 ${result.stones} 枚灵石`);
}

function doCultivate()
{
    runAction('cultivate', (result) => `闭关一日, 修为增长 ${result.gained} 点`);
}

function doBreakthrough()
{
    runAction('breakthrough', (result) =>
        `${result.success ? '突破成功' : '突破未成'}, ${result.eventDescription}`);
}

/**
 * @brief 服用一颗丹药, 丹药效果写入角色增益
 *
 * @param {object} item 背包中的丹药
 */
async function usePill(item)
{
    if (usingPillId.value) return;
    usingPillId.value = item.item_id;
    try
    {
        const { data } = await api.post('/alchemy/use-pill', {
            characterId: character.value.characterId,
            itemId: item.item_id,
            quantity: 1,
        });
        notify('success', `服下${data.data.pill_name}, 丹毒 ${data.data.toxin_value}`);
        await reload();
    }
    catch (error)
    {
        notify('error', `服用失败: ${error.response?.data?.message || error.message}`);
    }
    finally
    {
        usingPillId.value = 0;
    }
}

/**
 * @brief 炼丹完成后同步最新背包与增益
 */
async function onCrafted()
{
    await reload();
}

onMounted(async () =>
{
    try
    {
        await Promise.all([loadRealms(), reload()]);
    }
    catch (error)
    {
        notify('error', `读取存档失败: ${error.response?.data?.message || error.message}`);
        state.value = { hasSave: false };
    }
    finally
    {
        loading.value = false;
    }
});
</script>

<style scoped>
.game-shell {
    height: 100%;
    min-height: 0;
    font-family: var(--lhl-font-body);
    color: var(--lhl-text);
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.game-hint {
    padding: 60px 0;
    text-align: center;
    color: var(--lhl-text-2);
    letter-spacing: 4px;
}

/* ---------- 开局 ---------- */
.start-screen {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 420px;
    border-radius: 10px;
    background:
        radial-gradient(120% 80% at 50% 0%, rgba(44, 140, 122, 0.22) 0%, transparent 60%),
        linear-gradient(180deg, var(--lhl-ink) 0%, var(--lhl-ink-soft) 100%);
    border: 1px solid var(--lhl-aside-border);
}
.start-scroll {
    width: min(560px, 100% - 32px);
    padding: 40px 36px 30px;
    text-align: center;
    color: #eef4f1;
}
.start-seal {
    width: 56px;
    height: 56px;
    margin: 0 auto 18px;
    border-radius: 8px;
    background: var(--lhl-cinnabar);
    font-family: var(--lhl-font-display);
    font-size: 32px;
    line-height: 56px;
    color: #f5efe4;
    box-shadow: inset 0 0 0 2px rgba(245, 239, 228, 0.35), 0 6px 18px rgba(0, 0, 0, 0.35);
}
.start-eyebrow {
    font-size: 12px;
    letter-spacing: 6px;
    color: rgba(238, 244, 241, 0.55);
}
.start-title {
    margin: 10px 0 14px;
    font-family: var(--lhl-font-display);
    font-size: 44px;
    font-weight: 500;
    letter-spacing: 14px;
    text-indent: 14px;
}
.start-copy {
    margin: 0 auto 26px;
    max-width: 400px;
    font-size: 14px;
    line-height: 2;
    color: rgba(238, 244, 241, 0.7);
}
.start-form {
    display: grid;
    grid-template-columns: 48px 1fr;
    align-items: center;
    gap: 12px;
}
.start-label {
    font-family: var(--lhl-font-display);
    font-size: 18px;
    letter-spacing: 4px;
    color: rgba(238, 244, 241, 0.8);
}
.start-btn {
    grid-column: 1 / -1;
    margin-top: 6px;
    letter-spacing: 6px;
}
.start-foot {
    margin-top: 22px;
    font-size: 12px;
    letter-spacing: 1px;
    color: rgba(238, 244, 241, 0.42);
}

/* ---------- 游戏内导航 ---------- */
.game-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
}
.game-nav-tabs {
    display: flex;
    gap: 6px;
    padding: 4px;
    border-radius: 6px;
    background: var(--lhl-jade-soft);
    border: 1px solid var(--lhl-line);
}
.game-tab {
    min-width: 84px;
    padding: 7px 16px;
    border: none;
    border-radius: 4px;
    background: transparent;
    font-family: var(--lhl-font-display);
    font-size: 15px;
    letter-spacing: 3px;
    color: var(--lhl-text-2);
    cursor: pointer;
    transition: background 0.18s ease, color 0.18s ease;
}
.game-tab:hover {
    color: var(--lhl-jade-deep);
}
.game-tab.active {
    background: var(--lhl-panel);
    color: var(--lhl-jade-deep);
    box-shadow: var(--lhl-shadow);
}
.game-tab:focus-visible {
    outline: 2px solid var(--lhl-jade);
    outline-offset: 2px;
}
.game-nav-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.meta-chip {
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--lhl-line);
    background: var(--lhl-panel);
    font-family: var(--lhl-font-mono);
    font-size: 12px;
    color: var(--lhl-text-2);
}
.meta-chip.gold {
    color: var(--lhl-gold);
    border-color: rgba(201, 162, 39, 0.4);
}
.meta-chip.jade {
    color: var(--lhl-jade-deep);
    border-color: rgba(44, 140, 122, 0.4);
}

/* ---------- 修行布局 ---------- */
.cultivate-layout {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
}
.identity-card {
    position: sticky;
    top: 0;
    padding: 18px;
    border: 1px solid var(--lhl-line);
    border-radius: 8px;
    background: var(--lhl-panel);
    box-shadow: var(--lhl-shadow);
}
.portrait-wrap {
    text-align: center;
}
.portrait-ring {
    width: 92px;
    height: 92px;
    margin: 0 auto 12px;
    border-radius: 50%;
    border: 2px solid var(--lhl-jade);
    background: var(--lhl-jade-soft);
    display: flex;
    align-items: center;
    justify-content: center;
}
.portrait-seal {
    font-family: var(--lhl-font-display);
    font-size: 40px;
    color: var(--lhl-jade-deep);
}
.portrait-name {
    font-family: var(--lhl-font-display);
    font-size: 22px;
    letter-spacing: 4px;
}
.portrait-sub {
    margin-top: 6px;
    font-size: 12px;
    color: var(--lhl-text-2);
}
.section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 18px 0 10px;
    font-size: 13px;
    letter-spacing: 2px;
    color: var(--lhl-text-2);
}
.title-mark {
    width: 3px;
    height: 14px;
    border-radius: 2px;
    background: var(--lhl-jade);
}

.cultivation-numbers {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-family: var(--lhl-font-mono);
}
.cultivation-current {
    font-size: 26px;
    color: var(--lhl-jade-deep);
}
.cultivation-max {
    font-size: 13px;
    color: var(--lhl-text-3);
}
.cultivation-bar {
    margin-top: 8px;
    height: 8px;
    border-radius: 5px;
    background: rgba(44, 140, 122, 0.14);
    overflow: hidden;
}
.cultivation-fill {
    height: 100%;
    border-radius: 5px;
    background: linear-gradient(90deg, var(--lhl-jade) 0%, var(--lhl-jade-deep) 100%);
    transition: width 0.4s ease;
}
.cultivation-fill.ready {
    background: linear-gradient(90deg, var(--lhl-gold) 0%, var(--lhl-cinnabar) 100%);
}
.cultivation-note {
    margin-top: 8px;
    font-size: 12px;
    color: var(--lhl-text-3);
}

.attribute-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 12px;
}
.attribute-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    border-radius: 4px;
    background: var(--lhl-jade-soft);
    font-size: 12px;
    color: var(--lhl-text-2);
}
.attribute-value {
    font-family: var(--lhl-font-mono);
    color: var(--lhl-text);
}

.buff-empty {
    font-size: 12px;
    color: var(--lhl-text-3);
}
.buff-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.buff-chip {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 8px;
    padding: 7px 10px;
    border-radius: 4px;
    border: 1px solid rgba(201, 162, 39, 0.35);
    background: rgba(201, 162, 39, 0.1);
    font-size: 12px;
}
.buff-name {
    color: var(--lhl-text);
}
.buff-value {
    font-family: var(--lhl-font-mono);
    color: var(--lhl-gold);
}
.buff-time {
    grid-column: 1 / -1;
    font-family: var(--lhl-font-mono);
    font-size: 11px;
    color: var(--lhl-text-3);
}

/* ---------- 境界天梯 ---------- */
.stage-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
}
.panel {
    padding: 16px 18px;
    border: 1px solid var(--lhl-line);
    border-radius: 8px;
    background: var(--lhl-panel);
    box-shadow: var(--lhl-shadow);
}
.panel .section-title {
    margin-top: 0;
}
.realm-ladder {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 4px 0;
}
.realm-ladder::before {
    content: '';
    position: absolute;
    top: 24px;
    left: 8%;
    right: 8%;
    height: 2px;
    background: var(--lhl-line);
}
.ladder-node {
    position: relative;
    z-index: 1;
    flex: 1;
    text-align: center;
}
.ladder-name {
    font-family: var(--lhl-font-display);
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--lhl-text-3);
}
.ladder-dot {
    width: 12px;
    height: 12px;
    margin: 10px auto 8px;
    border-radius: 50%;
    background: var(--lhl-panel);
    border: 2px solid var(--lhl-line);
}
.ladder-ticks {
    display: flex;
    justify-content: center;
    gap: 4px;
}
.tick {
    width: 10px;
    height: 3px;
    border-radius: 2px;
    background: var(--lhl-line);
}
.tick.lit {
    background: var(--lhl-jade);
}
.ladder-node.passed .ladder-name {
    color: var(--lhl-text-2);
}
.ladder-node.passed .ladder-dot {
    border-color: var(--lhl-jade);
    background: var(--lhl-jade-soft);
}
.ladder-node.current .ladder-name {
    color: var(--lhl-cinnabar);
}
.ladder-node.current .ladder-dot {
    border-color: var(--lhl-cinnabar);
    background: var(--lhl-cinnabar);
    box-shadow: 0 0 0 4px rgba(181, 67, 46, 0.16);
}
.ladder-node.current .tick.lit {
    background: var(--lhl-cinnabar);
}
.ladder-node.locked .ladder-name {
    opacity: 0.55;
}

/* ---------- 行动 ---------- */
.action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
}
.action-card {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px 12px;
    align-content: start;
    padding: 16px;
    border: 1px solid var(--lhl-line);
    border-radius: 8px;
    background: var(--lhl-panel);
    box-shadow: var(--lhl-shadow);
}
.action-card .el-button {
    grid-column: 2 / -1;
    justify-self: start;
}
.action-glyph {
    width: 38px;
    height: 38px;
    border-radius: 6px;
    background: var(--lhl-jade-soft);
    color: var(--lhl-jade-deep);
    font-family: var(--lhl-font-display);
    font-size: 22px;
    line-height: 38px;
    text-align: center;
}
.action-body {
    min-width: 0;
}
.action-title {
    font-family: var(--lhl-font-display);
    font-size: 17px;
    letter-spacing: 3px;
}
.action-copy {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.8;
    color: var(--lhl-text-2);
}
.breakthrough-card.ready {
    border-color: rgba(181, 67, 46, 0.45);
}
.breakthrough-card.ready .action-glyph {
    background: var(--lhl-cinnabar-soft);
    color: var(--lhl-cinnabar);
}

/* ---------- 行囊与见闻 ---------- */
.lower-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
}
.bag-filter {
    margin-bottom: 10px;
}
.bag-empty {
    padding: 18px 0;
    font-size: 12px;
    color: var(--lhl-text-3);
}
.bag-list,
.journal-list {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 320px;
    overflow: auto;
}
.bag-item {
    display: grid;
    grid-template-columns: 26px 1fr auto auto auto;
    align-items: center;
    gap: 8px;
    padding: 6px 4px;
    border-bottom: 1px dashed var(--lhl-line);
    font-size: 13px;
}
.bag-item:last-child {
    border-bottom: none;
}
.bag-glyph {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: var(--lhl-jade-soft);
    color: var(--lhl-jade-deep);
    font-family: var(--lhl-font-display);
    font-size: 14px;
    line-height: 24px;
    text-align: center;
}
.bag-glyph.pill-glyph {
    background: var(--lhl-cinnabar-soft);
    color: var(--lhl-cinnabar);
}
.bag-glyph.furnace-glyph {
    background: rgba(201, 162, 39, 0.16);
    color: var(--lhl-gold);
}
.bag-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.bag-level,
.bag-count {
    font-family: var(--lhl-font-mono);
    font-size: 12px;
    color: var(--lhl-text-3);
}

.journal-item {
    padding: 8px 10px;
    border-left: 2px solid var(--lhl-line);
    margin-bottom: 8px;
    background: rgba(44, 140, 122, 0.06);
    border-radius: 0 4px 4px 0;
}
.journal-item.journal-breakthrough {
    border-left-color: var(--lhl-jade);
    background: rgba(44, 140, 122, 0.12);
}
.journal-item.journal-breakthrough_failed {
    border-left-color: var(--lhl-cinnabar);
    background: var(--lhl-cinnabar-soft);
}
.journal-item.journal-explore {
    border-left-color: var(--lhl-gold);
    background: rgba(201, 162, 39, 0.1);
}
.journal-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
}
.journal-title {
    font-family: var(--lhl-font-display);
    font-size: 14px;
    letter-spacing: 2px;
}
.journal-time {
    font-family: var(--lhl-font-mono);
    font-size: 11px;
    color: var(--lhl-text-3);
}
.journal-copy {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.8;
    color: var(--lhl-text-2);
}
.journal-empty {
    padding: 18px 0;
    font-size: 12px;
    color: var(--lhl-text-3);
}

@media (max-width: 1180px) {
    .cultivate-layout {
        grid-template-columns: minmax(0, 1fr);
    }
    .identity-card {
        position: static;
    }
    .lower-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}

@media (prefers-reduced-motion: reduce) {
    .cultivation-fill,
    .game-tab {
        transition: none;
    }
}
</style>
