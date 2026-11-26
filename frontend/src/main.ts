import {
    ApiError,
    createCard,
    deleteCard,
    exportCatalog,
    getCards,
    getCatalog,
    getStats,
    importCatalog,
    recordVisit,
    updateCard
} from "./api";
import type {
    Card,
    CardRelation,
    CardWritePayload,
    Catalog,
    CustomField,
    EntityTypeDefinition,
    LinkedCardDraft,
    OperationLogEntry,
    RelatedCard,
    RelationInput,
    RelationPreset,
    StatsSummary
} from "./types";
import "./styles.css";


interface EditorRelation
{
    localId: number;
    presetKey: string | null;
    targetType: string;
    label: string;
    inverseLabel: string;
    targetCardId: string | null;
    newTarget: LinkedCardDraft | null;
}


interface EditorState
{
    mode: "create" | "edit";
    card: Card | null;
    type: EntityTypeDefinition;
    name: string;
    icon: string;
    summary: string;
    customFields: CustomField[];
    relations: EditorRelation[];
    targetOptions: Map<string, RelatedCard[]>;
    loadingOptions: boolean;
    saving: boolean;
    editingNewTargetIds: Set<number>;
}


interface NavLayout
{
    primary: string[];
    other: string[];
}


interface NavDropPlan
{
    location: "primary" | "other";
    index: number;
    targetTypeId: string | null;
    placement: "before" | "after" | "append";
}


const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot)
{
    throw new Error("缺少 #app 容器");
}

const app = appRoot;
const iconPrefix = "/images/icon/";

let catalog: Catalog | null = null;
let currentTypeId = "";
let currentCards: Card[] = [];
let loadingCards = true;
let loadError = "";
let focusedCardId: string | null = null;
let requestSequence = 0;
let activeEditor: EditorState | null = null;
let modalLayer: HTMLDivElement | null = null;
let nextLocalRelationId = 1;
let toastTimer: number | undefined;
let otherMenuOpen = false;
let navLayout: NavLayout | null = null;
let draggedNavTypeId: string | null = null;
let navDropPlan: NavDropPlan | null = null;
let suppressNavClick = false;
let dataTransferBusy: "export" | "import" | null = null;
let statsSummary: StatsSummary | null = null;
let statsPanelView: "visitors" | "operations" | null = null;
let statsLayer: HTMLDivElement | null = null;
let statsLoading = false;
let statsRequestSequence = 0;
let statsError = "";

const primaryNavTypeIds = [
    "sect",
    "family",
    "dynasty",
    "race",
    "character",
    "spirit_beast",
    "technique",
    "spell",
    "item"
];

const navLayoutStorageKey = "lhlord.nav-layout.v1";
const visitorStorageKey = "lhlord.visitor-id.v1";


function escapeHtml(value: string): string
{
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#039;");
}


function iconUrl(path: string): string
{
    const encodedPath = path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    return `${iconPrefix}${encodedPath}`;
}


function findType(typeId: string): EntityTypeDefinition
{
    const entityType = catalog?.types.find((item) => item.id === typeId);
    if (!entityType)
    {
        throw new Error(`未知对象类型: ${typeId}`);
    }
    return entityType;
}


function presetsFor(typeId: string): RelationPreset[]
{
    return (catalog?.relation_presets ?? []).filter(
        (preset) => preset.source_type === typeId
    );
}


function presetByKey(presetKey: string): RelationPreset | undefined
{
    return catalog?.relation_presets.find(
        (preset) => preset.key === presetKey
    );
}


function defaultNavLayout(): NavLayout
{
    const knownTypeIds = catalog?.types.map((entityType) => entityType.id) ?? [];
    const primary = primaryNavTypeIds.filter(
        (typeId) => knownTypeIds.includes(typeId)
    );
    const primarySet = new Set(primary);
    return {
        primary,
        other: knownTypeIds.filter((typeId) => !primarySet.has(typeId))
    };
}


function normalizeNavLayout(candidate: unknown): NavLayout
{
    const fallback = defaultNavLayout();
    if
    (
        !candidate
        || typeof candidate !== "object"
    )
    {
        return fallback;
    }

    const knownTypeIds = new Set(
        catalog?.types.map((entityType) => entityType.id) ?? []
    );
    const candidateRecord = candidate as Record<string, unknown>;
    const rawPrimary = Array.isArray(candidateRecord.primary)
        ? candidateRecord.primary
        : [];
    const rawOther = Array.isArray(candidateRecord.other)
        ? candidateRecord.other
        : [];
    const primary: string[] = [];
    const other: string[] = [];
    const seen = new Set<string>();

    for (const value of rawPrimary)
    {
        if
        (
            typeof value === "string"
            && knownTypeIds.has(value)
            && !seen.has(value)
        )
        {
            primary.push(value);
            seen.add(value);
        }
    }
    for (const value of rawOther)
    {
        if
        (
            typeof value === "string"
            && knownTypeIds.has(value)
            && !seen.has(value)
        )
        {
            other.push(value);
            seen.add(value);
        }
    }

    if (!primary.length)
    {
        primary.push(fallback.primary[0] ?? "");
        primary.forEach((typeId) => seen.add(typeId));
    }
    for (const typeId of knownTypeIds)
    {
        if (!seen.has(typeId))
        {
            other.push(typeId);
            seen.add(typeId);
        }
    }

    return {
        primary: primary.filter(Boolean),
        other
    };
}


function saveNavLayout(): void
{
    if (!navLayout)
    {
        return;
    }
    try
    {
        window.localStorage.setItem(
            navLayoutStorageKey,
            JSON.stringify(navLayout)
        );
    }
    catch
    {
        // Navigation still works when storage is unavailable.
    }
}


function initializeNavLayout(): void
{
    let storedLayout: unknown = null;
    try
    {
        const rawLayout = window.localStorage.getItem(navLayoutStorageKey);
        storedLayout = rawLayout ? JSON.parse(rawLayout) : null;
    }
    catch
    {
        storedLayout = null;
    }
    navLayout = normalizeNavLayout(storedLayout);
    saveNavLayout();
}


function getNavLayout(): NavLayout
{
    if (!navLayout)
    {
        initializeNavLayout();
    }
    return navLayout ?? defaultNavLayout();
}


function normalizeFields(fields: CustomField[]): CustomField[]
{
    return fields
        .map(
            (field) => (
                {
                    key: field.key.trim(),
                    value: field.value.trim()
                }
            )
        )
        .filter((field) => field.key || field.value);
}


function cloneFields(fields: CustomField[]): CustomField[]
{
    return fields.map(
        (field) => (
            {
                key: field.key,
                value: field.value
            }
        )
    );
}


function errorMessage(error: unknown): string
{
    if (error instanceof ApiError)
    {
        return error.message;
    }
    if (error instanceof Error)
    {
        return error.message;
    }
    return "发生未知错误";
}


function showToast(
    message: string,
    tone: "success" | "error" | "info" = "info"
): void
{
    let stack = document.querySelector<HTMLDivElement>("#toast-stack");
    if (!stack)
    {
        stack = document.createElement("div");
        stack.id = "toast-stack";
        stack.className = "toast-stack";
        document.body.append(stack);
    }

    stack.replaceChildren();
    const toast = document.createElement("div");
    toast.className = `toast toast--${tone}`;
    toast.textContent = message;
    toast.setAttribute("role", "status");
    stack.append(toast);

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
        () =>
        {
            toast.classList.add("toast--leaving");
            window.setTimeout(
                () => toast.remove(),
                220
            );
        },
        3600
    );
}


function defaultTypeId(): string
{
    return catalog?.types[0]?.id ?? "";
}


function typeFromHash(): string | null
{
    const hashType = window.location.hash.replace(/^#\/?/, "");
    if (!hashType)
    {
        return null;
    }
    return catalog?.types.some((item) => item.id === hashType)
        ? hashType
        : null;
}


function updateHash(typeId: string): void
{
    window.history.replaceState(
        null,
        "",
        `#/${typeId}`
    );
}


function renderBoot(): void
{
    app.innerHTML = `
        <main class="boot-screen">
            <div class="boot-mark" aria-hidden="true">谱</div>
            <p class="eyebrow">LHLORD · CATALOG</p>
            <h1>万象谱</h1>
            <p class="boot-copy">正在展开修仙世界的名册与器物</p>
            <div class="ink-loader" aria-label="正在加载">
                <span></span><span></span><span></span>
            </div>
        </main>
    `;
}


function renderFatal(error: unknown): void
{
    app.innerHTML = `
        <main class="fatal-screen">
            <div class="fatal-seal">断</div>
            <p class="eyebrow">CONNECTION INTERRUPTED</p>
            <h1>万象谱暂未展开</h1>
            <p>${escapeHtml(errorMessage(error))}</p>
            <button class="primary-button" type="button" data-action="retry-boot">
                重新连接
            </button>
        </main>
    `;
}


function renderNav(): string
{
    if (!catalog)
    {
        return "";
    }

    let previousGroup = "";
    return getNavLayout().primary
        .map((typeId) => findType(typeId))
        .map(
            (entityType) =>
            {
                const separator = (
                    previousGroup
                    && previousGroup !== entityType.group
                )
                    ? `<span class="nav-separator" aria-hidden="true"></span>`
                    : "";
                previousGroup = entityType.group;
                const active = entityType.id === currentTypeId
                    ? " is-active"
                    : "";

                return `
                    ${separator}
                    <button
                        class="nav-object${active}"
                        type="button"
                        role="tab"
                        aria-selected="${active ? "true" : "false"}"
                        draggable="true"
                        data-action="select-type"
                        data-type-id="${escapeHtml(entityType.id)}"
                        data-nav-type-id="${escapeHtml(entityType.id)}"
                        data-nav-location="primary"
                        title="${escapeHtml(entityType.name)} · 拖动调整顺序"
                    >
                        <img
                            src="${iconUrl(entityType.default_icon)}"
                            alt=""
                            width="32"
                            height="32"
                        >
                        <span>${escapeHtml(entityType.name)}</span>
                    </button>
                `;
            }
        )
        .join("");
}


function renderOtherNav(): string
{
    if (!catalog)
    {
        return "";
    }

    const layout = getNavLayout();
    const otherTypes = layout.other.map((typeId) => findType(typeId));
    const otherActive = otherTypes.some(
        (entityType) => entityType.id === currentTypeId
    );
    const menuHidden = otherMenuOpen ? "" : "hidden";

    return `
        <div class="other-nav" data-other-nav>
            <button
                class="nav-object other-nav-trigger${otherActive ? " is-active" : ""}"
                type="button"
                data-action="toggle-other-nav"
                aria-haspopup="menu"
                aria-expanded="${otherMenuOpen ? "true" : "false"}"
                aria-controls="other-object-menu"
            >
                <span class="other-nav-glyph" aria-hidden="true">•••</span>
                <span class="other-nav-label">其他</span>
            </button>
            <div
                id="other-object-menu"
                class="other-nav-menu"
                role="menu"
                aria-label="其他对象类型"
                ${menuHidden}
            >
                ${otherTypes
                    .map(
                        (entityType) => `
                            <button
                                class="other-nav-item${entityType.id === currentTypeId ? " is-active" : ""}"
                                type="button"
                                role="menuitemradio"
                                aria-checked="${entityType.id === currentTypeId ? "true" : "false"}"
                                draggable="true"
                                data-action="select-type"
                                data-type-id="${escapeHtml(entityType.id)}"
                                data-nav-type-id="${escapeHtml(entityType.id)}"
                                data-nav-location="other"
                                title="${escapeHtml(entityType.name)} · 拖动到主栏或调整顺序"
                            >
                                <img
                                    src="${iconUrl(entityType.default_icon)}"
                                    alt=""
                                    width="28"
                                    height="28"
                                >
                                <span>${escapeHtml(entityType.name)}</span>
                            </button>
                        `
                    )
                    .join("")}
            </div>
        </div>
    `;
}


function renderSkeletons(): string
{
    return `
        <div class="card-grid" aria-label="正在加载卡片">
            ${Array.from(
                { length: 3 },
                () => `
                    <article class="entity-card skeleton-card" aria-hidden="true">
                        <div class="skeleton-line skeleton-line--short"></div>
                        <div class="skeleton-line skeleton-line--title"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line skeleton-line--medium"></div>
                    </article>
                `
            ).join("")}
        </div>
    `;
}


function renderRelationGroups(card: Card): string
{
    const hasSectMembers = (
        card.card_type === "sect"
        && card.relations.some(
            (relation) => (
                relation.direction === "incoming"
                && relation.preset_key === "character_sect"
            )
        )
    );
    const visibleRelations = card.relations.filter(
        (relation) => !(
            card.card_type === "sect"
            && relation.direction === "incoming"
            && relation.preset_key === "character_sect"
        )
    );
    if (!visibleRelations.length)
    {
        return `
            <div class="card-empty-note">
                <span class="empty-knot" aria-hidden="true"></span>
                ${hasSectMembers ? "暂无其他关联" : "尚无关联对象"}
            </div>
        `;
    }

    const groups = new Map<string, CardRelation[]>();
    for (const relation of visibleRelations)
    {
        const group = groups.get(relation.label) ?? [];
        group.push(relation);
        groups.set(relation.label, group);
    }

    return [...groups.entries()]
        .map(
            ([label, relations]) => `
                <div class="relation-group">
                    <h4>${escapeHtml(label)}</h4>
                    <div class="relation-list">
                        ${relations
                            .map(
                                (relation) => `
                                    <button
                                        class="relation-chip"
                                        type="button"
                                        data-action="open-related"
                                        data-type-id="${escapeHtml(relation.related_card.card_type)}"
                                        data-card-id="${escapeHtml(relation.related_card.id)}"
                                        title="查看${escapeHtml(findType(relation.related_card.card_type).name)}：${escapeHtml(relation.related_card.name)}"
                                    >
                                        <img
                                            src="${iconUrl(relation.related_card.icon)}"
                                            alt=""
                                            width="24"
                                            height="24"
                                        >
                                        <span>${escapeHtml(relation.related_card.name)}</span>
                                    </button>
                                `
                            )
                            .join("")}
                    </div>
                </div>
            `
        )
        .join("");
}


function renderFields(fields: CustomField[]): string
{
    if (!fields.length)
    {
        return "";
    }

    return `
        <dl class="field-list">
            ${fields
                .map(
                    (field) => `
                        <div class="field-row">
                            <dt>${escapeHtml(field.key)}</dt>
                            <dd>${escapeHtml(field.value || "—")}</dd>
                        </div>
                    `
                )
                .join("")}
        </dl>
    `;
}


function renderMembers(card: Card): string
{
    if (card.card_type !== "sect")
    {
        return "";
    }

    const members = card.relations.filter(
        (relation) => (
            relation.direction === "incoming"
            && relation.preset_key === "character_sect"
        )
    );
    if (!members.length)
    {
        return "";
    }

    return `
        <section class="member-section" aria-label="宗门成员">
            <div class="member-heading">
                <span>宗门成员</span>
                <span class="member-count">${members.length}</span>
            </div>
            <div class="member-list">
                ${members
                    .map(
                        (relation) => `
                            <button
                                class="member-chip"
                                type="button"
                                data-action="open-related"
                                data-type-id="character"
                                data-card-id="${escapeHtml(relation.related_card.id)}"
                                title="查看角色：${escapeHtml(relation.related_card.name)}"
                            >
                                <img
                                    src="${iconUrl(relation.related_card.icon)}"
                                    alt=""
                                    width="34"
                                    height="34"
                                >
                                <span>${escapeHtml(relation.related_card.name)}</span>
                            </button>
                        `
                    )
                    .join("")}
            </div>
        </section>
    `;
}


function renderCard(card: Card): string
{
    const entityType = findType(card.card_type);
    const focusedClass = card.id === focusedCardId
        ? " is-highlighted"
        : "";

    return `
        <article
            class="entity-card${focusedClass}"
            data-card-id="${escapeHtml(card.id)}"
            aria-labelledby="card-title-${escapeHtml(card.id)}"
        >
            <div class="card-rune" aria-hidden="true"></div>
            <header class="card-heading">
                <div class="card-icon-frame">
                    <img
                        src="${iconUrl(card.icon)}"
                        alt="${escapeHtml(entityType.name)}图标"
                        width="58"
                        height="58"
                    >
                </div>
                <div class="card-title-block">
                    <span class="type-stamp">${escapeHtml(entityType.name)}</span>
                    <h3 id="card-title-${escapeHtml(card.id)}">
                        ${escapeHtml(card.name)}
                    </h3>
                </div>
                <button
                    class="icon-button edit-card-button"
                    type="button"
                    data-action="edit-card"
                    data-card-id="${escapeHtml(card.id)}"
                    aria-label="编辑${escapeHtml(card.name)}"
                    title="编辑卡片"
                >
                    <span aria-hidden="true">修</span>
                </button>
            </header>

            <p class="card-summary">
                ${escapeHtml(card.summary || "此人此事，尚待后人补录")}
            </p>

            ${renderFields(card.custom_fields)}
            ${renderMembers(card)}

            <section class="card-relations" aria-label="关联对象">
                ${renderRelationGroups(card)}
            </section>

            <footer class="card-footer">
                <span>${escapeHtml(entityType.group_name)}</span>
                <span class="footer-diamond" aria-hidden="true">◆</span>
                <span>${card.relations.length} 条关联</span>
            </footer>
        </article>
    `;
}


function renderCards(): string
{
    if (loadingCards)
    {
        return renderSkeletons();
    }

    if (loadError)
    {
        return `
            <section class="state-panel state-panel--error">
                <div class="state-seal">阻</div>
                <h2>未能读取这卷名册</h2>
                <p>${escapeHtml(loadError)}</p>
                <button class="primary-button" type="button" data-action="retry-load">
                    再试一次
                </button>
            </section>
        `;
    }

    if (!currentCards.length)
    {
        const entityType = findType(currentTypeId);
        return `
            <section class="state-panel state-panel--empty">
                <div class="empty-illustration" aria-hidden="true">
                    <img
                        src="${iconUrl(entityType.default_icon)}"
                        alt=""
                        width="92"
                        height="92"
                    >
                </div>
                <p class="eyebrow">THE FIRST LEAF</p>
                <h2>这一页尚是空白</h2>
                <p>为${escapeHtml(entityType.name)}添上第一张卡片，世界的因缘便由此展开</p>
                <button class="primary-button" type="button" data-action="create-card">
                    新建${escapeHtml(entityType.name)}
                </button>
            </section>
        `;
    }

    return `
        <div class="card-grid">
            ${currentCards.map(renderCard).join("")}
        </div>
    `;
}


function renderApp(): void
{
    if (!catalog)
    {
        return;
    }

    const currentType = findType(currentTypeId);
    const countLabel = loadingCards ? "读取中" : `${currentCards.length} 张`;

    app.innerHTML = `
        <div class="paper-grain" aria-hidden="true"></div>
        <header class="topbar">
            <div class="brand-row">
                <a class="brand" href="#/${escapeHtml(currentTypeId)}" aria-label="万象谱首页">
                    <span class="brand-seal">谱</span>
                    <span class="brand-copy">
                        <span class="brand-title">万象谱</span>
                        <span class="brand-subtitle">修仙对象录</span>
                    </span>
                </a>
                <div class="brand-tools">
                    <p class="topbar-note">万物有灵 · 因缘可循</p>
                    <div class="header-stats" aria-label="统计信息">
                        <button
                            class="stat-action"
                            type="button"
                            data-action="open-stats"
                            data-stats-view="visitors"
                            aria-label="查看访客统计"
                            title="查看访客统计"
                        >
                            <span class="stat-mark" aria-hidden="true">访</span>
                            <span class="stat-label">访客</span>
                            <strong id="visitor-total-stat">${statsSummary?.visitors.total_visitors ?? "—"}</strong>
                        </button>
                        <button
                            class="stat-action"
                            type="button"
                            data-action="open-stats"
                            data-stats-view="operations"
                            aria-label="查看操作日志统计"
                            title="查看操作日志统计"
                        >
                            <span class="stat-mark" aria-hidden="true">志</span>
                            <span class="stat-label">日志</span>
                            <strong id="operation-total-stat">${statsSummary?.operations.total ?? "—"}</strong>
                        </button>
                    </div>
                    <div class="data-actions" aria-label="数据导入导出">
                        <button
                            class="data-action-button"
                            type="button"
                            data-action="export-data"
                            title="导出全部数据为 ZIP 压缩包"
                            ${dataTransferBusy ? "disabled" : ""}
                        >
                            <span aria-hidden="true">↓</span>
                            <span class="action-label">${dataTransferBusy === "export" ? "导出中" : "导出"}</span>
                        </button>
                        <button
                            class="data-action-button"
                            type="button"
                            data-action="trigger-import"
                            title="从 ZIP 压缩包导入全部数据"
                            ${dataTransferBusy ? "disabled" : ""}
                        >
                            <span aria-hidden="true">↑</span>
                            <span class="action-label">${dataTransferBusy === "import" ? "导入中" : "导入"}</span>
                        </button>
                        <input
                            id="import-archive"
                            class="visually-hidden"
                            type="file"
                            accept=".zip,application/zip"
                            aria-hidden="true"
                            tabindex="-1"
                            ${dataTransferBusy ? "disabled" : ""}
                        >
                    </div>
                </div>
            </div>
            <nav class="object-nav" aria-label="对象类型">
                <span class="object-nav-balance" aria-hidden="true"></span>
                <div class="object-nav-primary" role="tablist">
                    ${renderNav()}
                </div>
                ${renderOtherNav()}
            </nav>
        </header>

        <main class="main-content">
            <section class="category-heading" aria-labelledby="category-title">
                <div>
                    <p class="eyebrow">${escapeHtml(currentType.group_name)} · ${escapeHtml(currentType.id.toUpperCase())}</p>
                    <div class="title-line">
                        <h1 id="category-title">${escapeHtml(currentType.name)}</h1>
                        <span class="card-count">${escapeHtml(countLabel)}</span>
                    </div>
                    <p class="category-description">
                        ${escapeHtml(categoryDescription(currentType.id))}
                    </p>
                </div>
                <button class="primary-button create-button" type="button" data-action="create-card">
                    <span aria-hidden="true">＋</span>
                    新建${escapeHtml(currentType.name)}
                </button>
            </section>

            ${renderCards()}
        </main>

        <footer class="page-footer">
            <span>LHLORD WORLD CODEX</span>
            <span class="footer-rule" aria-hidden="true"></span>
            <span>此间万象，皆可续书</span>
        </footer>
    `;
}


function categoryDescription(typeId: string): string
{
    const descriptions: Record<string, string> = {
        sect: "山门有秩，道统相承，门中人物与传承皆在此卷",
        family: "血脉绵延，家学相续，记一族之兴衰与人物源流",
        dynasty: "凡世鼎祚与仙门秩序交错，统御山河，亦牵系众生",
        race: "各族禀赋殊异，同源异流，共居于天地之间",
        character: "一人的来处、师承与所持之物，都在因缘中彼此照见",
        spirit_beast: "山泽灵兽，或为坐骑，或结契同行，各有性情",
        technique: "心法为舟，载修士渡向长生；宗门传承亦可由此追溯",
        spell: "术有万千，御五行、通神识、藏杀机，也救苍生",
        item: "草木金石与法宝丹符，在仙途之中各承一段因果",
        cave: "洞府藏风聚气，是闭关、炼器与避世之所",
        secret_realm: "天地裂隙与上古遗迹，机缘与凶险从来并存",
        quest: "悬赏与使命串起人物、宗门与秘境，推动世间流转",
        cultivation: "吐纳周天，洗炼经脉，日复一日叩问长生",
        breakthrough: "气机盈满之际破境而上，前路与风险同在",
        dao: "道有万千，悟得一分便多一分天地回响",
        tribulation: "雷云压境，天威试道，渡劫者以命争一线仙途",
        metal: "金主锐与坚，可成锋刃，也可铸不坏之基",
        wood: "木主生发，荣枯之间蕴藏绵延不绝的生机",
        water: "水善变化，润物无声，亦可化万川之势",
        fire: "火主炽烈，焚尽旧障，也照亮炼化之道",
        earth: "土承万物，厚重不移，是阵法与山河的根基",
        qi: "气为修行之本，聚散流转于经脉与天地之间",
        spirit: "神识照微，能观内外诸相，亦能御物于无形",
        sword: "剑心如线，一线既出，便分胜负与生死",
        body: "以血肉筋骨为炉，锤炼出一身横压万法的体魄",
        escape: "遁法借天地之势远行，千变万化，来去无踪",
        combat: "交锋与斗法交织成修士最直接也最残酷的试炼",
        map: "山河舆图记录道路、势力与尚未踏足的危险",
        spirit_field: "灵田孕育草木灵机，是一宗粮脉与丹材之源",
        market: "坊市聚散四方来客，灵物、消息与机缘在此流通",
        formation: "阵纹勾连天地，可护山门，也可困杀强敌",
        reputation: "声望是人心的回音，决定宗门与修士如何被世界看待"
    };
    return descriptions[typeId] ?? "修仙世界中的一则记录";
}


function visitorId(): string
{
    try
    {
        const existing = window.localStorage.getItem(visitorStorageKey);
        if (existing)
        {
            return existing;
        }
        const created = typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        window.localStorage.setItem(visitorStorageKey, created);
        return created;
    }
    catch
    {
        return `visitor-${Date.now()}`;
    }
}


function updateStatsIndicators(): void
{
    const visitorBadge = document.querySelector<HTMLElement>(
        "#visitor-total-stat"
    );
    const operationBadge = document.querySelector<HTMLElement>(
        "#operation-total-stat"
    );
    if (visitorBadge)
    {
        visitorBadge.textContent = statsSummary
            ? String(statsSummary.visitors.total_visitors)
            : "—";
    }
    if (operationBadge)
    {
        operationBadge.textContent = statsSummary
            ? String(statsSummary.operations.total)
            : "—";
    }
}


async function refreshStats(): Promise<void>
{
    const sequence = ++statsRequestSequence;
    statsLoading = true;
    statsError = "";
    renderStatsPanel();
    try
    {
        const summary = await getStats();
        if (sequence !== statsRequestSequence)
        {
            return;
        }
        statsSummary = summary;
        updateStatsIndicators();
    }
    catch (error)
    {
        if (sequence !== statsRequestSequence)
        {
            return;
        }
        statsError = errorMessage(error);
    }
    finally
    {
        if (sequence === statsRequestSequence)
        {
            statsLoading = false;
            renderStatsPanel();
        }
    }
}


async function recordCurrentVisit(): Promise<void>
{
    if (!catalog)
    {
        return;
    }
    try
    {
        const visitors = await recordVisit(
            visitorId(),
            currentTypeId
        );
        if (statsSummary)
        {
            statsSummary = {
                ...statsSummary,
                visitors
            };
            updateStatsIndicators();
            renderStatsPanel();
        }
        else
        {
            await refreshStats();
        }
    }
    catch
    {
        // Statistics failures must not block the catalog.
    }
}


function formatOperationTime(value: string): string
{
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
    {
        return value;
    }
    return new Intl.DateTimeFormat(
        "zh-CN",
        {
            timeZone: "Asia/Shanghai",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }
    ).format(parsed);
}


function operationLabel(action: string): string
{
    const labels: Record<string, string> = {
        create: "新建",
        update: "编辑",
        delete: "删除",
        import: "导入",
        export: "导出"
    };
    return labels[action] ?? action;
}


function entityTypeLabel(typeId: string): string
{
    return catalog?.types.find((item) => item.id === typeId)?.name ?? typeId;
}


function renderVisitorStatsBody(): string
{
    if (!statsSummary)
    {
        return statsLoading
            ? `<div class="stats-loading">正在整理访客足迹……</div>`
            : `<div class="stats-error">${escapeHtml(statsError || "暂无访客数据")}</div>`;
    }

    const visitors = statsSummary.visitors;
    const maximumViews = Math.max(
        1,
        ...visitors.daily.map((day) => day.views)
    );
    return `
        <div class="stats-summary-grid">
            ${renderStatsMetric("累计访客", visitors.total_visitors)}
            ${renderStatsMetric("今日访客", visitors.today_visitors)}
            ${renderStatsMetric("累计浏览", visitors.total_views)}
            ${renderStatsMetric("今日浏览", visitors.today_views)}
        </div>
        <section class="stats-section">
            <h3>近七日访问</h3>
            <div class="visitor-bars">
                ${visitors.daily
                    .map(
                        (day) => `
                            <div class="visitor-bar-column" title="${escapeHtml(day.day)}：${day.views} 次浏览，${day.visitors} 位访客">
                                <span class="visitor-bar-value">${day.views}</span>
                                <span class="visitor-bar-track">
                                    <span
                                        class="visitor-bar-fill"
                                        style="height: ${Math.max(4, Math.round(day.views / maximumViews * 100))}%"
                                    ></span>
                                </span>
                                <span class="visitor-bar-label">${escapeHtml(day.day.slice(5))}</span>
                            </div>
                        `
                    )
                    .join("")}
            </div>
        </section>
        <section class="stats-section">
            <h3>分类浏览</h3>
            ${visitors.pages.length
                ? `
                    <div class="page-stat-list">
                        ${visitors.pages
                            .slice(0, 12)
                            .map(
                                (page) => `
                                    <div class="page-stat-row">
                                        <span>${escapeHtml(entityTypeLabel(page.card_type))}</span>
                                        <span>${page.visitors} 位访客</span>
                                        <strong>${page.views} 次</strong>
                                    </div>
                                `
                            )
                            .join("")}
                    </div>
                `
                : `<p class="stats-empty">尚未记录分类浏览</p>`}
        </section>
    `;
}


function renderStatsMetric(label: string, value: number): string
{
    return `
        <div class="stats-metric">
            <span>${escapeHtml(label)}</span>
            <strong>${value}</strong>
        </div>
    `;
}


function renderOperationStatsBody(): string
{
    if (!statsSummary)
    {
        return statsLoading
            ? `<div class="stats-loading">正在翻阅操作记录……</div>`
            : `<div class="stats-error">${escapeHtml(statsError || "暂无操作日志")}</div>`;
    }

    const operations = statsSummary.operations;
    return `
        <div class="stats-summary-grid stats-summary-grid--operations">
            ${renderStatsMetric("累计操作", operations.total)}
            ${renderStatsMetric("今日操作", operations.today)}
        </div>
        <section class="stats-section">
            <h3>操作构成</h3>
            <div class="operation-action-list">
                ${operations.actions.length
                    ? operations.actions
                        .map(
                            (item) => `
                                <span class="operation-action-chip">
                                    ${escapeHtml(operationLabel(item.action))}
                                    <strong>${item.count}</strong>
                                </span>
                            `
                        )
                        .join("")
                    : `<span class="stats-empty">暂无操作</span>`}
            </div>
        </section>
        <section class="stats-section">
            <h3>最近记录</h3>
            <div class="operation-log-list">
                ${operations.recent.length
                    ? operations.recent
                        .map((entry) => renderOperationLog(entry))
                        .join("")
                    : `<p class="stats-empty">尚未记录任何操作</p>`}
            </div>
        </section>
    `;
}


function renderOperationLog(entry: OperationLogEntry): string
{
    return `
        <article class="operation-log-row">
            <span class="operation-badge operation-badge--${escapeHtml(entry.action)}">
                ${escapeHtml(operationLabel(entry.action))}
            </span>
            <div>
                <p>${escapeHtml(entry.summary)}</p>
                <time>${escapeHtml(formatOperationTime(entry.created_at))}</time>
            </div>
        </article>
    `;
}


function renderStatsPanel(): void
{
    if (!statsLayer || !statsPanelView)
    {
        return;
    }
    const title = statsPanelView === "visitors"
        ? "访客统计"
        : "操作日志统计";
    const body = statsPanelView === "visitors"
        ? renderVisitorStatsBody()
        : renderOperationStatsBody();

    statsLayer.innerHTML = `
        <div class="stats-backdrop">
            <section
                class="stats-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="stats-title"
            >
                <header class="stats-header">
                    <div>
                        <p class="eyebrow">CATALOG INSIGHTS</p>
                        <h2 id="stats-title">${title}</h2>
                    </div>
                    <button
                        class="modal-close"
                        type="button"
                        data-action="close-stats"
                        aria-label="关闭${title}"
                    >×</button>
                </header>
                <div class="stats-body">
                    ${body}
                </div>
            </section>
        </div>
    `;
}


function openStatsPanel(view: "visitors" | "operations"): void
{
    statsPanelView = view;
    if (!statsLayer)
    {
        statsLayer = document.createElement("div");
        statsLayer.className = "stats-layer";
        statsLayer.addEventListener("click", handleStatsClick);
        document.body.append(statsLayer);
    }
    document.body.classList.add("has-modal");
    renderStatsPanel();
    void refreshStats();
    window.requestAnimationFrame(
        () =>
        {
            statsLayer
                ?.querySelector<HTMLButtonElement>("[data-action=\"close-stats\"]")
                ?.focus();
        }
    );
}


function closeStatsPanel(): void
{
    statsLayer?.remove();
    statsLayer = null;
    statsPanelView = null;
    statsLoading = false;
    document.body.classList.remove("has-modal");
}


function handleStatsClick(event: MouseEvent): void
{
    const target = event.target;
    if (!(target instanceof Element))
    {
        return;
    }
    if (target.closest("[data-action=\"close-stats\"]"))
    {
        closeStatsPanel();
        return;
    }
    if (target.classList.contains("stats-backdrop"))
    {
        closeStatsPanel();
    }
}


async function boot(): Promise<void>
{
    loadingCards = true;
    loadError = "";
    renderBoot();

    try
    {
        catalog = await getCatalog();
        initializeNavLayout();
        currentTypeId = typeFromHash() ?? defaultTypeId();
        updateHash(currentTypeId);
        renderApp();
        await loadCurrentCards();
        void (async () =>
        {
            await refreshStats();
            await recordCurrentVisit();
        })();
    }
    catch (error)
    {
        renderFatal(error);
    }
}


async function loadCurrentCards(): Promise<void>
{
    const sequence = ++requestSequence;
    loadingCards = true;
    loadError = "";
    renderApp();

    try
    {
        const cards = await getCards(currentTypeId);
        if (sequence !== requestSequence)
        {
            return;
        }
        currentCards = cards;
    }
    catch (error)
    {
        if (sequence !== requestSequence)
        {
            return;
        }
        currentCards = [];
        loadError = errorMessage(error);
    }
    finally
    {
        if (sequence === requestSequence)
        {
            loadingCards = false;
            renderApp();
            focusPendingCard();
        }
    }
}


function focusPendingCard(): void
{
    if (!focusedCardId)
    {
        return;
    }

    window.requestAnimationFrame(
        () =>
        {
            const target = document.querySelector<HTMLElement>(
                `[data-card-id="${CSS.escape(focusedCardId ?? "")}"]`
            );
            target?.scrollIntoView(
                {
                    behavior: "smooth",
                    block: "center"
                }
            );
            window.setTimeout(
                () =>
                {
                    target?.classList.remove("is-highlighted");
                    focusedCardId = null;
                },
                2200
            );
        }
    );
}


async function selectType(typeId: string): Promise<void>
{
    if (!catalog?.types.some((item) => item.id === typeId))
    {
        return;
    }
    if (typeId === currentTypeId && !loadError)
    {
        return;
    }

    currentTypeId = typeId;
    focusedCardId = null;
    currentCards = [];
    updateHash(typeId);
    await loadCurrentCards();
    void recordCurrentVisit();
}


async function navigateToRelated(
    typeId: string,
    cardId: string
): Promise<void>
{
    focusedCardId = cardId;
    if (typeId === currentTypeId)
    {
        focusPendingCard();
        return;
    }
    currentTypeId = typeId;
    currentCards = [];
    updateHash(typeId);
    await loadCurrentCards();
    void recordCurrentVisit();
}


function categoryTypeForEditor(card: Card | null): EntityTypeDefinition
{
    return findType(card?.card_type ?? currentTypeId);
}


function blankLinkedCard(typeId: string): LinkedCardDraft
{
    const entityType = findType(typeId);
    return {
        card_type: typeId,
        name: "",
        icon: entityType.default_icon,
        summary: "",
        custom_fields: []
    };
}


function relationFromCard(relation: CardRelation): EditorRelation
{
    return {
        localId: nextLocalRelationId++,
        presetKey: relation.preset_key,
        targetType: relation.related_card.card_type,
        label: relation.label,
        inverseLabel: relation.inverse_label,
        targetCardId: relation.related_card.id,
        newTarget: null
    };
}


function openEditor(card: Card | null): void
{
    if (!catalog)
    {
        return;
    }

    closeEditor();
    const entityType = categoryTypeForEditor(card);
    const relations = card
        ? card.relations
            .filter((relation) => relation.direction === "outgoing")
            .map(relationFromCard)
        : [];

    activeEditor = {
        mode: card ? "edit" : "create",
        card,
        type: entityType,
        name: card?.name ?? "",
        icon: card?.icon ?? entityType.default_icon,
        summary: card?.summary ?? "",
        customFields: card ? cloneFields(card.custom_fields) : [],
        relations,
        targetOptions: new Map(),
        loadingOptions: true,
        saving: false,
        editingNewTargetIds: new Set()
    };

    modalLayer = document.createElement("div");
    modalLayer.id = "modal-layer";
    modalLayer.className = "modal-layer";
    modalLayer.addEventListener("click", handleEditorClick);
    modalLayer.addEventListener("input", handleEditorInput);
    modalLayer.addEventListener("change", handleEditorChange);
    document.body.append(modalLayer);
    document.body.classList.add("has-modal");
    document.addEventListener("keydown", handleDocumentKeydown);

    renderEditor();
    window.requestAnimationFrame(
        () =>
        {
            document.querySelector<HTMLInputElement>("#editor-name")?.focus();
        }
    );
    void loadEditorOptions();
}


function closeEditor(): void
{
    if (!activeEditor)
    {
        return;
    }

    activeEditor = null;
    document.removeEventListener("keydown", handleDocumentKeydown);
    document.body.classList.remove("has-modal");
    modalLayer?.remove();
    modalLayer = null;
}


async function loadEditorOptions(): Promise<void>
{
    if (!activeEditor || !catalog)
    {
        return;
    }

    const editor = activeEditor;
    editor.loadingOptions = true;
    renderEditor();

    const requestedTypes = catalog.types.map((entityType) => entityType.id);
    try
    {
        const results = await Promise.all(
            requestedTypes.map(
                async (typeId) => (
                    {
                        typeId,
                        cards: await getCards(typeId)
                    }
                )
            )
        );
        if (activeEditor !== editor)
        {
            return;
        }
        editor.targetOptions = new Map(
            results.map(
                ({ typeId, cards }) => (
                    [
                        typeId,
                        cards.map(
                            (card) => (
                                {
                                    id: card.id,
                                    card_type: card.card_type,
                                    name: card.name,
                                    icon: card.icon
                                }
                            )
                        )
                    ]
                )
            )
        );
    }
    catch (error)
    {
        if (activeEditor === editor)
        {
            showToast(
                `关联对象加载失败：${errorMessage(error)}`,
                "error"
            );
        }
    }
    finally
    {
        if (activeEditor === editor)
        {
            editor.loadingOptions = false;
            renderEditor();
        }
    }
}


function renderIconChoice
(
    entityType: EntityTypeDefinition,
    selectedIcon: string,
    mode: "card" | "linked",
    relationId?: number
): string
{
    const radioName = mode === "card"
        ? "card-icon"
        : `linked-card-icon-${relationId ?? 0}`;

    return `
        <div class="icon-choice-grid">
            ${entityType.icons
                .map(
                    (icon) => `
                        <label class="icon-choice" title="${escapeHtml(icon)}">
                            <input
                                type="radio"
                                name="${radioName}"
                                value="${escapeHtml(icon)}"
                                ${icon === selectedIcon ? "checked" : ""}
                            >
                            <span>
                                <img
                                    src="${iconUrl(icon)}"
                                    alt=""
                                    width="46"
                                    height="46"
                                >
                            </span>
                        </label>
                    `
                )
                .join("")}
        </div>
    `;
}


function renderCustomFieldRows(): string
{
    if (!activeEditor)
    {
        return "";
    }
    const editor = activeEditor;

    if (!editor.customFields.length)
    {
        return `
            <p class="editor-empty-copy">暂无自定义字段，可添加境界、灵根、品阶等信息</p>
        `;
    }

    return editor.customFields
        .map(
            (field, index) => `
                <div class="custom-field-row">
                    <input
                        type="text"
                        placeholder="字段名，如：境界"
                        value="${escapeHtml(field.key)}"
                        data-custom-field-index="${index}"
                        data-custom-field-prop="key"
                        aria-label="自定义字段名称"
                    >
                    <input
                        type="text"
                        placeholder="字段内容"
                        value="${escapeHtml(field.value)}"
                        data-custom-field-index="${index}"
                        data-custom-field-prop="value"
                        aria-label="自定义字段内容"
                    >
                    <div class="field-actions">
                        <button
                            class="mini-button"
                            type="button"
                            data-action="move-field-up"
                            data-field-index="${index}"
                            ${index === 0 ? "disabled" : ""}
                            aria-label="上移字段"
                        >↑</button>
                        <button
                            class="mini-button"
                            type="button"
                            data-action="move-field-down"
                            data-field-index="${index}"
                            ${index === editor.customFields.length - 1 ? "disabled" : ""}
                            aria-label="下移字段"
                        >↓</button>
                        <button
                            class="mini-button mini-button--danger"
                            type="button"
                            data-action="remove-field"
                            data-field-index="${index}"
                            aria-label="删除字段"
                        >×</button>
                    </div>
                </div>
            `
        )
        .join("");
}


function optionCardsFor(relation: EditorRelation): RelatedCard[]
{
    if (!activeEditor)
    {
        return [];
    }

    return (activeEditor.targetOptions.get(relation.targetType) ?? [])
        .filter(
            (card) => card.id !== activeEditor?.card?.id
        );
}


function selectedTargetName(relation: EditorRelation): string
{
    if (relation.newTarget)
    {
        return relation.newTarget.name || "未命名新对象";
    }
    return optionCardsFor(relation).find(
        (card) => card.id === relation.targetCardId
    )?.name ?? "已选择对象";
}


function renderSelectedTarget(relation: EditorRelation): string
{
    if (relation.newTarget)
    {
        return `
            <div class="selected-target selected-target--new">
                <span class="draft-badge">待创建</span>
                <img
                    src="${iconUrl(relation.newTarget.icon)}"
                    alt=""
                    width="32"
                    height="32"
                >
                <strong>${escapeHtml(selectedTargetName(relation))}</strong>
                <button
                    class="text-button"
                    type="button"
                    data-action="edit-new-target"
                    data-relation-id="${relation.localId}"
                >修改</button>
                <button
                    class="mini-button mini-button--danger"
                    type="button"
                    data-action="remove-relation"
                    data-relation-id="${relation.localId}"
                    aria-label="移除关联"
                >×</button>
            </div>
        `;
    }

    if (!relation.targetCardId)
    {
        return "";
    }

    const selectedCard = optionCardsFor(relation).find(
        (card) => card.id === relation.targetCardId
    );
    if (!selectedCard)
    {
        return "";
    }

    return `
        <div class="selected-target">
            <img
                src="${iconUrl(selectedCard.icon)}"
                alt=""
                width="32"
                height="32"
            >
            <strong>${escapeHtml(selectedCard.name)}</strong>
            <button
                class="mini-button mini-button--danger"
                type="button"
                data-action="remove-relation"
                data-relation-id="${relation.localId}"
                aria-label="移除关联"
            >×</button>
        </div>
    `;
}


function renderLinkedTargetForm(relation: EditorRelation): string
{
    if (!relation.newTarget)
    {
        return "";
    }

    const targetType = findType(relation.targetType);
    const draft = relation.newTarget;

    return `
        <div class="linked-draft">
            <div class="linked-draft-heading">
                <span>新建${escapeHtml(targetType.name)}草稿</span>
                <small>随主卡一同保存，不会留下孤立对象</small>
            </div>
            <label class="form-label">
                <span>名称</span>
                <input
                    type="text"
                    maxlength="80"
                    value="${escapeHtml(draft.name)}"
                    placeholder="输入${escapeHtml(targetType.name)}名称"
                    data-new-target-name="${relation.localId}"
                >
            </label>
            <div class="form-label">
                <span>图标</span>
                ${renderIconChoice(targetType, draft.icon, "linked", relation.localId)}
            </div>
            <label class="form-label">
                <span>简介</span>
                <textarea
                    rows="2"
                    maxlength="1000"
                    placeholder="可稍后补充"
                    data-new-target-summary="${relation.localId}"
                >${escapeHtml(draft.summary)}</textarea>
            </label>
            <div class="linked-field-list">
                ${draft.custom_fields
                    .map(
                        (field, index) => `
                            <div class="custom-field-row">
                                <input
                                    type="text"
                                    placeholder="字段名"
                                    value="${escapeHtml(field.key)}"
                                    data-new-field-key="${relation.localId}"
                                    data-new-field-index="${index}"
                                >
                                <input
                                    type="text"
                                    placeholder="字段内容"
                                    value="${escapeHtml(field.value)}"
                                    data-new-field-value="${relation.localId}"
                                    data-new-field-index="${index}"
                                >
                                <button
                                    class="mini-button mini-button--danger"
                                    type="button"
                                    data-action="remove-new-target-field"
                                    data-relation-id="${relation.localId}"
                                    data-field-index="${index}"
                                    aria-label="删除草稿字段"
                                >×</button>
                            </div>
                        `
                    )
                    .join("")}
            </div>
            <div class="linked-draft-actions">
                <button
                    class="text-button"
                    type="button"
                    data-action="add-new-target-field"
                    data-relation-id="${relation.localId}"
                >＋ 自定义字段</button>
                <span></span>
                <button
                    class="secondary-button"
                    type="button"
                    data-action="cancel-new-target"
                    data-relation-id="${relation.localId}"
                >取消</button>
                <button
                    class="primary-button primary-button--compact"
                    type="button"
                    data-action="commit-new-target"
                    data-relation-id="${relation.localId}"
                >保存草稿</button>
            </div>
        </div>
    `;
}


function renderTargetChooser(relation: EditorRelation): string
{
    if (!activeEditor)
    {
        return "";
    }

    if
    (
        relation.newTarget
        && activeEditor.editingNewTargetIds.has(relation.localId)
    )
    {
        return renderLinkedTargetForm(relation);
    }

    if (relation.newTarget || relation.targetCardId)
    {
        return renderSelectedTarget(relation);
    }

    const targetType = findType(relation.targetType);
    const options = optionCardsFor(relation);

    return `
        <div class="relation-picker">
            <input
                class="picker-search"
                type="search"
                placeholder="搜索现有${escapeHtml(targetType.name)}"
                data-relation-search="${relation.localId}"
                ${activeEditor.loadingOptions ? "disabled" : ""}
            >
            <select
                data-relation-select="${relation.localId}"
                ${activeEditor.loadingOptions || !options.length ? "disabled" : ""}
                aria-label="选择关联对象"
            >
                <option value="">
                    ${activeEditor.loadingOptions
                        ? "正在读取……"
                        : options.length
                            ? `选择现有${targetType.name}`
                            : `暂无现有${targetType.name}`}
                </option>
                ${options
                    .map(
                        (card) => `
                            <option value="${escapeHtml(card.id)}">
                                ${escapeHtml(card.name)}
                            </option>
                        `
                    )
                    .join("")}
            </select>
            <button
                class="secondary-button"
                type="button"
                data-action="select-existing-target"
                data-relation-id="${relation.localId}"
                ${activeEditor.loadingOptions || !options.length ? "disabled" : ""}
            >选用</button>
            <button
                class="text-button"
                type="button"
                data-action="start-new-target"
                data-relation-id="${relation.localId}"
            >＋ 新建${escapeHtml(targetType.name)}</button>
        </div>
    `;
}


function renderPresetAddPicker(preset: RelationPreset): string
{
    if (!activeEditor)
    {
        return "";
    }

    const targetType = findType(preset.target_type);
    const options = (activeEditor.targetOptions.get(preset.target_type) ?? [])
        .filter(
            (card) => card.id !== activeEditor?.card?.id
        );

    return `
        <div class="relation-picker">
            <input
                class="picker-search"
                type="search"
                placeholder="搜索现有${escapeHtml(targetType.name)}"
                data-preset-search="${escapeHtml(preset.key)}"
                ${activeEditor.loadingOptions ? "disabled" : ""}
            >
            <select
                data-preset-select="${escapeHtml(preset.key)}"
                ${activeEditor.loadingOptions || !options.length ? "disabled" : ""}
                aria-label="选择关联对象"
            >
                <option value="">
                    ${activeEditor.loadingOptions
                        ? "正在读取……"
                        : options.length
                            ? `选择现有${targetType.name}`
                            : `暂无现有${targetType.name}`}
                </option>
                ${options
                    .map(
                        (card) => `
                            <option value="${escapeHtml(card.id)}">
                                ${escapeHtml(card.name)}
                            </option>
                        `
                    )
                    .join("")}
            </select>
            <button
                class="secondary-button"
                type="button"
                data-action="add-preset-existing"
                data-preset-key="${escapeHtml(preset.key)}"
                ${activeEditor.loadingOptions || !options.length ? "disabled" : ""}
            >选用</button>
            <button
                class="text-button"
                type="button"
                data-action="start-new-preset-target"
                data-preset-key="${escapeHtml(preset.key)}"
            >＋ 新建${escapeHtml(targetType.name)}</button>
        </div>
    `;
}


function renderPresetRelation(preset: RelationPreset): string
{
    if (!activeEditor)
    {
        return "";
    }

    const drafts = activeEditor.relations.filter(
        (relation) => relation.presetKey === preset.key
    );
    const canAdd = preset.cardinality === "many" || drafts.length === 0;
    const targetType = findType(preset.target_type);

    return `
        <section class="relation-block" data-preset-block="${escapeHtml(preset.key)}">
            <div class="relation-block-heading">
                <div>
                    <h4>${escapeHtml(preset.label)}</h4>
                    <p>指向${escapeHtml(targetType.name)} · ${preset.cardinality === "one" ? "单一关联" : "可关联多个"}</p>
                </div>
            </div>
            <div class="relation-draft-list">
                ${drafts.map(renderTargetChooser).join("")}
                ${canAdd ? renderPresetAddPicker(preset) : ""}
            </div>
        </section>
    `;
}


function renderPresetSections(): string
{
    if (!activeEditor)
    {
        return "";
    }

    const presets = presetsFor(activeEditor.type.id);
    if (!presets.length)
    {
        return `
            <p class="editor-empty-copy">该对象类型暂无预设关联，可使用下方自定义因缘</p>
        `;
    }

    return presets.map(renderPresetRelation).join("");
}


function renderCustomRelations(): string
{
    if (!activeEditor)
    {
        return "";
    }

    const customRelations = activeEditor.relations.filter(
        (relation) => relation.presetKey === null
    );

    return `
        <div class="custom-relations">
            ${customRelations
                .map(
                    (relation) => `
                        <section class="relation-block relation-block--custom">
                            <div class="relation-block-heading">
                                <div>
                                    <h4>自定义因缘</h4>
                                    <p>可指向任意对象类型</p>
                                </div>
                                <button
                                    class="mini-button mini-button--danger"
                                    type="button"
                                    data-action="remove-relation"
                                    data-relation-id="${relation.localId}"
                                    aria-label="删除自定义关系"
                                >×</button>
                            </div>
                            <div class="custom-relation-grid">
                                <label class="form-label">
                                    <span>正向名称</span>
                                    <input
                                        type="text"
                                        maxlength="32"
                                        value="${escapeHtml(relation.label)}"
                                        data-custom-label="${relation.localId}"
                                    >
                                </label>
                                <label class="form-label">
                                    <span>反向名称</span>
                                    <input
                                        type="text"
                                        maxlength="32"
                                        value="${escapeHtml(relation.inverseLabel)}"
                                        data-custom-inverse-label="${relation.localId}"
                                    >
                                </label>
                                <label class="form-label">
                                    <span>目标类型</span>
                                    <select data-custom-target-type="${relation.localId}">
                                        ${catalog?.types
                                            .map(
                                                (entityType) => `
                                                    <option
                                                        value="${escapeHtml(entityType.id)}"
                                                        ${entityType.id === relation.targetType ? "selected" : ""}
                                                    >${escapeHtml(entityType.name)}</option>
                                                `
                                            )
                                            .join("")}
                                    </select>
                                </label>
                            </div>
                            ${renderTargetChooser(relation)}
                        </section>
                    `
                )
                .join("")}
            <button
                class="dashed-button"
                type="button"
                data-action="add-custom-relation"
            >
                ＋ 添加自定义因缘
            </button>
        </div>
    `;
}


function renderEditor(): void
{
    if (!activeEditor || !modalLayer)
    {
        return;
    }

    const editor = activeEditor;
    const actionLabel = editor.mode === "create" ? "落卷" : "保存修改";

    modalLayer.innerHTML = `
        <div class="modal-backdrop">
            <section
                class="editor-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="editor-title"
            >
                <header class="editor-header">
                    <div>
                        <p class="eyebrow">${editor.mode === "create" ? "NEW ENTRY" : "REVISE ENTRY"}</p>
                        <h2 id="editor-title">
                            ${editor.mode === "create" ? "新建" : "编辑"}${escapeHtml(editor.type.name)}
                        </h2>
                    </div>
                    <button
                        class="modal-close"
                        type="button"
                        data-action="close-editor"
                        aria-label="关闭编辑器"
                    >×</button>
                </header>

                <form id="card-editor-form" novalidate>
                    <div class="editor-body">
                        <section class="editor-section">
                            <div class="form-grid form-grid--identity">
                                <label class="form-label">
                                    <span>名称 <em>必填</em></span>
                                    <input
                                        id="editor-name"
                                        type="text"
                                        maxlength="80"
                                        value="${escapeHtml(editor.name)}"
                                        placeholder="输入对象名称"
                                    >
                                </label>
                                <div class="form-label">
                                    <span>图记</span>
                                    ${renderIconChoice(editor.type, editor.icon, "card")}
                                </div>
                            </div>
                            <label class="form-label">
                                <span>简介</span>
                                <textarea
                                    id="editor-summary"
                                    rows="3"
                                    maxlength="1000"
                                    placeholder="写下一段来历、性情或传闻"
                                >${escapeHtml(editor.summary)}</textarea>
                            </label>
                        </section>

                        <section class="editor-section">
                            <div class="section-heading">
                                <div>
                                    <p class="eyebrow">CUSTOM ATTRIBUTES</p>
                                    <h3>自定义字段</h3>
                                </div>
                                <button
                                    class="text-button"
                                    type="button"
                                    data-action="add-field"
                                >＋ 添加字段</button>
                            </div>
                            <div class="custom-field-list">
                                ${renderCustomFieldRows()}
                            </div>
                        </section>

                        <section class="editor-section">
                            <div class="section-heading">
                                <div>
                                    <p class="eyebrow">ENTWINED FATES</p>
                                    <h3>预设关联</h3>
                                </div>
                            </div>
                            <p class="section-note">
                                新建时关联为空；可选择已有对象或直接新建关联对象
                            </p>
                            <div class="preset-relations">
                                ${renderPresetSections()}
                            </div>
                        </section>

                        <section class="editor-section">
                            <div class="section-heading">
                                <div>
                                    <p class="eyebrow">OTHER THREADS</p>
                                    <h3>自定义因缘</h3>
                                </div>
                            </div>
                            ${renderCustomRelations()}
                        </section>
                    </div>

                    <footer class="editor-footer">
                        <div>
                            ${editor.mode === "edit"
                                ? `
                                    <button
                                        class="danger-button"
                                        type="button"
                                        data-action="delete-card"
                                        ${editor.saving ? "disabled" : ""}
                                    >删除此卡</button>
                                `
                                : ""}
                        </div>
                        <div class="editor-footer-actions">
                            <button
                                class="secondary-button"
                                type="button"
                                data-action="close-editor"
                                ${editor.saving ? "disabled" : ""}
                            >取消</button>
                            <button
                                class="primary-button"
                                type="submit"
                                ${editor.saving ? "disabled" : ""}
                            >${editor.saving ? "正在落卷……" : actionLabel}</button>
                        </div>
                    </footer>
                </form>
            </section>
        </div>
    `;

    modalLayer
        .querySelector<HTMLFormElement>("#card-editor-form")
        ?.addEventListener(
            "submit",
            (event) =>
            {
                event.preventDefault();
                void saveEditor();
            }
        );
}


function relationById(relationId: number): EditorRelation | undefined
{
    return activeEditor?.relations.find(
        (relation) => relation.localId === relationId
    );
}


function handleEditorClick(event: MouseEvent): void
{
    const target = event.target;
    if (!(target instanceof Element))
    {
        return;
    }

    const button = target.closest<HTMLElement>("[data-action]");
    if (!button || !activeEditor)
    {
        return;
    }

    const action = button.dataset.action;
    if (action === "close-editor")
    {
        closeEditor();
        return;
    }
    if (action === "add-field")
    {
        activeEditor.customFields.push(
            {
                key: "",
                value: ""
            }
        );
        renderEditor();
        return;
    }
    if (action === "remove-field")
    {
        activeEditor.customFields.splice(
            Number(button.dataset.fieldIndex),
            1
        );
        renderEditor();
        return;
    }
    if (action === "move-field-up" || action === "move-field-down")
    {
        const index = Number(button.dataset.fieldIndex);
        const destination = action === "move-field-up"
            ? index - 1
            : index + 1;
        swapArrayItems(
            activeEditor.customFields,
            index,
            destination
        );
        renderEditor();
        return;
    }
    if (action === "add-custom-relation")
    {
        activeEditor.relations.push(
            {
                localId: nextLocalRelationId++,
                presetKey: null,
                targetType: "sect",
                label: "关联",
                inverseLabel: "被关联",
                targetCardId: null,
                newTarget: null
            }
        );
        renderEditor();
        return;
    }
    if (action === "remove-relation")
    {
        const relationId = Number(button.dataset.relationId);
        activeEditor.relations = activeEditor.relations.filter(
            (relation) => relation.localId !== relationId
        );
        activeEditor.editingNewTargetIds.delete(relationId);
        renderEditor();
        return;
    }
    if (action === "add-preset-existing")
    {
        const presetKey = button.dataset.presetKey;
        if (presetKey)
        {
            addPresetExisting(presetKey);
        }
        return;
    }
    if (action === "start-new-preset-target")
    {
        const presetKey = button.dataset.presetKey;
        if (presetKey)
        {
            startNewPresetTarget(presetKey);
        }
        return;
    }
    if (action === "select-existing-target")
    {
        selectExistingTarget(Number(button.dataset.relationId));
        return;
    }
    if (action === "start-new-target")
    {
        startNewTarget(Number(button.dataset.relationId));
        return;
    }
    if (action === "edit-new-target")
    {
        const relationId = Number(button.dataset.relationId);
        activeEditor.editingNewTargetIds.add(relationId);
        renderEditor();
        return;
    }
    if (action === "cancel-new-target")
    {
        const relationId = Number(button.dataset.relationId);
        const relation = relationById(relationId);
        if (!relation)
        {
            return;
        }
        relation.newTarget = null;
        activeEditor.editingNewTargetIds.delete(relationId);
        if (!relation.targetCardId)
        {
            activeEditor.relations = activeEditor.relations.filter(
                (item) => item.localId !== relationId
            );
        }
        renderEditor();
        return;
    }
    if (action === "commit-new-target")
    {
        commitNewTarget(Number(button.dataset.relationId));
        return;
    }
    if (action === "add-new-target-field")
    {
        const relation = relationById(Number(button.dataset.relationId));
        relation?.newTarget?.custom_fields.push(
            {
                key: "",
                value: ""
            }
        );
        renderEditor();
        return;
    }
    if (action === "remove-new-target-field")
    {
        const relation = relationById(Number(button.dataset.relationId));
        relation?.newTarget?.custom_fields.splice(
            Number(button.dataset.fieldIndex),
            1
        );
        renderEditor();
        return;
    }
    if (action === "delete-card")
    {
        void deleteActiveCard();
    }
}


function addPresetExisting(presetKey: string): void
{
    if (!activeEditor || !modalLayer)
    {
        return;
    }
    const preset = presetByKey(presetKey);
    if (!preset)
    {
        return;
    }

    const select = modalLayer.querySelector<HTMLSelectElement>(
        `[data-preset-select="${CSS.escape(presetKey)}"]`
    );
    const targetCardId = select?.value;
    if (!targetCardId)
    {
        showToast("请先选择一个现有对象", "error");
        return;
    }

    const existing = activeEditor.relations.filter(
        (relation) => relation.presetKey === preset.key
    );
    if (preset.cardinality === "one" && existing.length)
    {
        showToast("该关联只能选择一个对象", "error");
        return;
    }
    if (existing.some((relation) => relation.targetCardId === targetCardId))
    {
        showToast("该关联已经存在", "error");
        return;
    }

    activeEditor.relations.push(
        {
            localId: nextLocalRelationId++,
            presetKey: preset.key,
            targetType: preset.target_type,
            label: preset.label,
            inverseLabel: preset.inverse_label,
            targetCardId,
            newTarget: null
        }
    );
    renderEditor();
}


function startNewPresetTarget(presetKey: string): void
{
    if (!activeEditor)
    {
        return;
    }
    const preset = presetByKey(presetKey);
    if (!preset)
    {
        return;
    }
    const existing = activeEditor.relations.filter(
        (relation) => relation.presetKey === preset.key
    );
    if (preset.cardinality === "one" && existing.length)
    {
        showToast("该关联只能选择一个对象", "error");
        return;
    }

    const relation: EditorRelation = {
        localId: nextLocalRelationId++,
        presetKey: preset.key,
        targetType: preset.target_type,
        label: preset.label,
        inverseLabel: preset.inverse_label,
        targetCardId: null,
        newTarget: blankLinkedCard(preset.target_type)
    };
    activeEditor.relations.push(relation);
    activeEditor.editingNewTargetIds.add(relation.localId);
    renderEditor();
}


function selectExistingTarget(relationId: number): void
{
    if (!modalLayer || !activeEditor)
    {
        return;
    }
    const relation = relationById(relationId);
    if (!relation)
    {
        return;
    }

    const select = modalLayer.querySelector<HTMLSelectElement>(
        `[data-relation-select="${relation.localId}"]`
    );
    const targetCardId = select?.value;
    if (!targetCardId)
    {
        showToast("请先选择一个现有对象", "error");
        return;
    }

    const duplicate = activeEditor.relations.some(
        (item) => (
            item.localId !== relation.localId
            && item.presetKey === relation.presetKey
            && item.targetCardId === targetCardId
        )
    );
    if (duplicate)
    {
        showToast("该关联已经存在", "error");
        return;
    }

    const preset = relation.presetKey
        ? presetByKey(relation.presetKey)
        : null;
    if
    (
        preset?.cardinality === "one"
        && activeEditor.relations.some(
            (item) => (
                item.localId !== relation.localId
                && item.presetKey === preset.key
            )
        )
    )
    {
        showToast("该关联只能选择一个对象", "error");
        return;
    }

    relation.targetCardId = targetCardId;
    relation.newTarget = null;
    renderEditor();
}


function startNewTarget(relationId: number): void
{
    if (!activeEditor)
    {
        return;
    }
    const relation = relationById(relationId);
    if (!relation)
    {
        return;
    }

    relation.targetCardId = null;
    relation.newTarget = blankLinkedCard(relation.targetType);
    activeEditor.editingNewTargetIds.add(relation.localId);
    renderEditor();
}


function commitNewTarget(relationId: number): void
{
    if (!activeEditor)
    {
        return;
    }
    const relation = relationById(relationId);
    if (!relation?.newTarget)
    {
        return;
    }
    relation.newTarget.name = relation.newTarget.name.trim();
    relation.newTarget.summary = relation.newTarget.summary.trim();
    relation.newTarget.custom_fields = normalizeFields(
        relation.newTarget.custom_fields
    );
    if (!relation.newTarget.name)
    {
        showToast("请填写新对象名称", "error");
        return;
    }
    activeEditor.editingNewTargetIds.delete(relationId);
    renderEditor();
    showToast("关联对象草稿已就绪，保存主卡时一同落库");
}


function handleEditorInput(event: Event): void
{
    if (!activeEditor)
    {
        return;
    }
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement))
    {
        return;
    }

    if (input.id === "editor-name")
    {
        activeEditor.name = input.value;
        return;
    }
    if (input.id === "editor-summary")
    {
        activeEditor.summary = input.value;
        return;
    }
    if (input.name === "card-icon" && input instanceof HTMLInputElement)
    {
        activeEditor.icon = input.value;
        return;
    }
    if (input.name.startsWith("linked-card-icon-"))
    {
        const relationId = Number(input.name.split("-").at(-1));
        const relation = relationById(relationId);
        if (relation?.newTarget)
        {
            relation.newTarget.icon = input.value;
        }
        return;
    }

    const fieldIndex = input.dataset.customFieldIndex;
    const fieldProperty = input.dataset.customFieldProp;
    if (fieldIndex !== undefined && fieldProperty)
    {
        const field = activeEditor.customFields[Number(fieldIndex)];
        if (field)
        {
            field[fieldProperty as "key" | "value"] = input.value;
        }
        return;
    }

    const customLabelId = input.dataset.customLabel;
    if (customLabelId)
    {
        const relation = relationById(Number(customLabelId));
        if (relation)
        {
            relation.label = input.value;
        }
        return;
    }
    const customInverseId = input.dataset.customInverseLabel;
    if (customInverseId)
    {
        const relation = relationById(Number(customInverseId));
        if (relation)
        {
            relation.inverseLabel = input.value;
        }
        return;
    }

    const newNameId = input.dataset.newTargetName;
    if (newNameId)
    {
        const relation = relationById(Number(newNameId));
        if (relation?.newTarget)
        {
            relation.newTarget.name = input.value;
        }
        return;
    }
    const newSummaryId = input.dataset.newTargetSummary;
    if (newSummaryId)
    {
        const relation = relationById(Number(newSummaryId));
        if (relation?.newTarget)
        {
            relation.newTarget.summary = input.value;
        }
        return;
    }

    const newFieldKeyId = input.dataset.newFieldKey;
    const newFieldIndex = input.dataset.newFieldIndex;
    if (newFieldKeyId && newFieldIndex !== undefined)
    {
        const relation = relationById(Number(newFieldKeyId));
        const field = relation?.newTarget?.custom_fields[Number(newFieldIndex)];
        if (field)
        {
            field.key = input.value;
        }
        return;
    }
    const newFieldValueId = input.dataset.newFieldValue;
    if (newFieldValueId && newFieldIndex !== undefined)
    {
        const relation = relationById(Number(newFieldValueId));
        const field = relation?.newTarget?.custom_fields[Number(newFieldIndex)];
        if (field)
        {
            field.value = input.value;
        }
        return;
    }

    const searchRelationId = input.dataset.relationSearch;
    if (searchRelationId)
    {
        filterRelationOptions(
            Number(searchRelationId),
            input.value
        );
        return;
    }

    const presetSearchKey = input.dataset.presetSearch;
    if (presetSearchKey)
    {
        filterPresetOptions(
            presetSearchKey,
            input.value
        );
    }
}


function handleEditorChange(event: Event): void
{
    if (!activeEditor)
    {
        return;
    }
    const control = event.target;

    if (!(control instanceof HTMLSelectElement))
    {
        return;
    }
    const relationId = control.dataset.customTargetType;
    if (relationId)
    {
        const relation = relationById(Number(relationId));
        if (!relation)
        {
            return;
        }
        relation.targetType = control.value;
        relation.targetCardId = null;
        relation.newTarget = null;
        activeEditor.editingNewTargetIds.delete(relation.localId);
        renderEditor();
    }
}


function filterRelationOptions(
    relationId: number,
    query: string
): void
{
    if (!modalLayer)
    {
        return;
    }
    const select = modalLayer.querySelector<HTMLSelectElement>(
        `[data-relation-select="${relationId}"]`
    );
    filterSelectOptions(select, query);
}


function filterPresetOptions(
    presetKey: string,
    query: string
): void
{
    if (!modalLayer)
    {
        return;
    }
    const select = modalLayer.querySelector<HTMLSelectElement>(
        `[data-preset-select="${CSS.escape(presetKey)}"]`
    );
    filterSelectOptions(select, query);
}


function filterSelectOptions(
    select: HTMLSelectElement | null,
    query: string
): void
{
    if (!select)
    {
        return;
    }
    const normalizedQuery = query.trim().toLocaleLowerCase();
    for (const option of [...select.options])
    {
        if (!option.value)
        {
            option.hidden = false;
            continue;
        }
        option.hidden = (
            Boolean(normalizedQuery)
            && !option.text.toLocaleLowerCase().includes(normalizedQuery)
            && option.value !== select.value
        );
    }
}


function swapArrayItems<T>
(
    items: T[],
    firstIndex: number,
    secondIndex: number
): void
{
    if
    (
        firstIndex < 0
        || secondIndex < 0
        || firstIndex >= items.length
        || secondIndex >= items.length
    )
    {
        return;
    }
    const firstItem = items[firstIndex];
    const secondItem = items[secondIndex];
    if (firstItem === undefined || secondItem === undefined)
    {
        return;
    }
    items[firstIndex] = secondItem;
    items[secondIndex] = firstItem;
}


function relationInputFromDraft(relation: EditorRelation): RelationInput
{
    if (relation.newTarget)
    {
        const newTarget = relation.newTarget;
        newTarget.name = newTarget.name.trim();
        newTarget.summary = newTarget.summary.trim();
        newTarget.custom_fields = normalizeFields(newTarget.custom_fields);
        if (!newTarget.name)
        {
            throw new Error(`请填写新建${findType(relation.targetType).name}的名称`);
        }

        const input: RelationInput = {
            new_target: newTarget
        };
        if (relation.presetKey)
        {
            input.preset_key = relation.presetKey;
        }
        else
        {
            input.target_type = relation.targetType;
            input.label = relation.label.trim();
            input.inverse_label = relation.inverseLabel.trim();
        }
        return input;
    }

    if (!relation.targetCardId)
    {
        throw new Error("存在尚未选择对象的关联");
    }

    const input: RelationInput = {
        target_card_id: relation.targetCardId
    };
    if (relation.presetKey)
    {
        input.preset_key = relation.presetKey;
    }
    else
    {
        input.target_type = relation.targetType;
        input.label = relation.label.trim();
        input.inverse_label = relation.inverseLabel.trim();
        if (!input.label || !input.inverse_label)
        {
            throw new Error("自定义关系必须填写正向和反向名称");
        }
    }
    return input;
}


function buildCardPayload(editor: EditorState): CardWritePayload
{
    const name = editor.name.trim();
    if (!name)
    {
        throw new Error("请填写对象名称");
    }

    const customFields = normalizeFields(editor.customFields);
    const invalidField = customFields.find((field) => !field.key);
    if (invalidField)
    {
        throw new Error("自定义字段名称不能为空");
    }

    const relations = editor.relations.map(relationInputFromDraft);
    const payload: CardWritePayload = {
        name,
        icon: editor.icon,
        summary: editor.summary.trim(),
        custom_fields: customFields,
        relations
    };
    if (editor.mode === "create")
    {
        payload.card_type = editor.type.id;
    }
    return payload;
}


async function saveEditor(): Promise<void>
{
    if (!activeEditor || activeEditor.saving)
    {
        return;
    }

    const editor = activeEditor;
    let payload: CardWritePayload;
    try
    {
        payload = buildCardPayload(editor);
    }
    catch (error)
    {
        showToast(errorMessage(error), "error");
        return;
    }

    editor.saving = true;
    renderEditor();
    try
    {
        if (editor.mode === "edit" && editor.card)
        {
            await updateCard(editor.card.id, payload);
            showToast("卡片与因缘已更新", "success");
        }
        else
        {
            await createCard(
                payload as CardWritePayload & {
                    card_type: string;
                    name: string;
                    icon: string;
                }
            );
            showToast("新的卡片已落卷", "success");
        }
        closeEditor();
        await loadCurrentCards();
        void refreshStats();
    }
    catch (error)
    {
        if (activeEditor === editor)
        {
            editor.saving = false;
            renderEditor();
        }
        showToast(errorMessage(error), "error");
    }
}


async function deleteActiveCard(): Promise<void>
{
    if (!activeEditor?.card || activeEditor.saving)
    {
        return;
    }
    const editor = activeEditor;
    const card = editor.card;
    if (!card)
    {
        return;
    }
    const confirmed = window.confirm(
        `确定删除「${card.name}」？\n\n该卡片的所有关联关系也会一并移除。`
    );
    if (!confirmed)
    {
        return;
    }

    editor.saving = true;
    renderEditor();
    try
    {
        await deleteCard(card.id);
        closeEditor();
        showToast("卡片及其关联已移除", "success");
        await loadCurrentCards();
        void refreshStats();
    }
    catch (error)
    {
        if (activeEditor === editor)
        {
            editor.saving = false;
            renderEditor();
        }
        showToast(errorMessage(error), "error");
    }
}


function handleDocumentKeydown(event: KeyboardEvent): void
{
    if (!activeEditor || !modalLayer)
    {
        return;
    }

    if (event.key === "Escape" && !activeEditor.saving)
    {
        event.preventDefault();
        closeEditor();
        return;
    }

    if (event.key !== "Tab")
    {
        return;
    }

    const focusable = [
        ...modalLayer.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]"
        )
    ].filter(
        (element) => element.offsetParent !== null
    );
    if (!focusable.length)
    {
        return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last)
    {
        return;
    }
    if (event.shiftKey && document.activeElement === first)
    {
        event.preventDefault();
        last.focus();
    }
    else if (!event.shiftKey && document.activeElement === last)
    {
        event.preventDefault();
        first.focus();
    }
}


function setOtherMenuOpen(
    open: boolean,
    returnFocus = false
): void
{
    otherMenuOpen = open;
    const trigger = document.querySelector<HTMLButtonElement>(
        "[data-action=\"toggle-other-nav\"]"
    );
    const menu = document.querySelector<HTMLElement>("#other-object-menu");
    if (!trigger || !menu)
    {
        return;
    }

    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    menu.hidden = !open;
    if (open)
    {
        window.requestAnimationFrame(
            () =>
            {
                menu.querySelector<HTMLButtonElement>(".other-nav-item")?.focus();
            }
        );
    }
    else if (returnFocus)
    {
        trigger.focus();
    }
}


function toggleOtherMenu(): void
{
    setOtherMenuOpen(!otherMenuOpen);
}


function clearNavDropIndicators(): void
{
    document
        .querySelectorAll<HTMLElement>(
            ".is-dragging, .is-drop-active, .is-drop-target, .is-drop-before, .is-drop-after"
        )
        .forEach(
            (element) =>
            {
                element.classList.remove(
                    "is-dragging",
                    "is-drop-active",
                    "is-drop-target",
                    "is-drop-before",
                    "is-drop-after"
                );
            }
        );
}


function showNavDropIndicator(plan: NavDropPlan): void
{
    clearNavDropIndicators();
    navDropPlan = plan;
    if (draggedNavTypeId)
    {
        document
            .querySelector<HTMLElement>(
                `[data-nav-type-id="${CSS.escape(draggedNavTypeId)}"]`
            )
            ?.classList.add("is-dragging");
    }

    if (!plan.targetTypeId)
    {
        const appendTarget = plan.location === "primary"
            ? document.querySelector<HTMLElement>(".object-nav-primary")
            : document.querySelector<HTMLElement>(".other-nav-trigger");
        appendTarget?.classList.add(
            plan.location === "primary"
                ? "is-drop-active"
                : "is-drop-target"
        );
        return;
    }

    const target = document.querySelector<HTMLElement>(
        `[data-nav-location="${plan.location}"][data-nav-type-id="${CSS.escape(plan.targetTypeId)}"]`
    );
    target?.classList.add(
        plan.placement === "before"
            ? "is-drop-before"
            : "is-drop-after"
    );
}


function handleNavDragStart(event: DragEvent): void
{
    const target = event.target;
    if (!(target instanceof Element) || !event.dataTransfer)
    {
        return;
    }
    const draggableItem = target.closest<HTMLElement>("[data-nav-type-id]");
    const typeId = draggableItem?.dataset.navTypeId;
    if (!draggableItem || !typeId)
    {
        return;
    }

    draggedNavTypeId = typeId;
    navDropPlan = null;
    suppressNavClick = true;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", typeId);
    draggableItem.classList.add("is-dragging");
}


function handleNavDragOver(event: DragEvent): void
{
    if (!draggedNavTypeId || !event.dataTransfer)
    {
        return;
    }
    const target = event.target;
    if (!(target instanceof Element))
    {
        return;
    }

    const layout = getNavLayout();
    const otherTrigger = target.closest<HTMLElement>(
        "[data-action=\"toggle-other-nav\"]"
    );
    if (otherTrigger)
    {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        showNavDropIndicator(
            {
                location: "other",
                index: layout.other.length,
                targetTypeId: null,
                placement: "append"
            }
        );
        return;
    }

    const otherItem = target.closest<HTMLElement>(
        "#other-object-menu [data-nav-location=\"other\"]"
    );
    if (otherItem)
    {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const itemTypeId = otherItem.dataset.navTypeId ?? null;
        const itemIndex = itemTypeId
            ? layout.other.indexOf(itemTypeId)
            : layout.other.length;
        const rect = otherItem.getBoundingClientRect();
        const placement = event.clientY < rect.top + rect.height / 2
            ? "before"
            : "after";
        showNavDropIndicator(
            {
                location: "other",
                index: placement === "before" ? itemIndex : itemIndex + 1,
                targetTypeId: itemTypeId,
                placement
            }
        );
        return;
    }

    const otherMenu = target.closest<HTMLElement>("#other-object-menu");
    if (otherMenu)
    {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        showNavDropIndicator(
            {
                location: "other",
                index: layout.other.length,
                targetTypeId: null,
                placement: "append"
            }
        );
        return;
    }

    const primaryNav = target.closest<HTMLElement>(".object-nav-primary");
    if (!primaryNav)
    {
        return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const primaryItems = [
        ...primaryNav.querySelectorAll<HTMLElement>(
            "[data-nav-location=\"primary\"][data-nav-type-id]"
        )
    ];
    let index = primaryItems.length;
    let targetTypeId: string | null = null;
    let placement: "before" | "after" | "append" = "append";

    for (let itemIndex = 0; itemIndex < primaryItems.length; itemIndex += 1)
    {
        const item = primaryItems[itemIndex];
        if (!item)
        {
            continue;
        }
        const rect = item.getBoundingClientRect();
        if (event.clientX < rect.left + rect.width / 2)
        {
            index = itemIndex;
            targetTypeId = item.dataset.navTypeId ?? null;
            placement = "before";
            break;
        }
    }

    if (placement === "append" && primaryItems.length)
    {
        targetTypeId = primaryItems.at(-1)?.dataset.navTypeId ?? null;
        placement = "after";
    }

    showNavDropIndicator(
        {
            location: "primary",
            index,
            targetTypeId,
            placement
        }
    );
}


function finishNavDrag(): void
{
    clearNavDropIndicators();
    draggedNavTypeId = null;
    navDropPlan = null;
    window.setTimeout(
        () =>
        {
            suppressNavClick = false;
        },
        80
    );
}


function handleNavDragEnd(): void
{
    finishNavDrag();
}


function moveNavItem
(
    typeId: string,
    destination: "primary" | "other",
    requestedIndex: number
): void
{
    const layout = getNavLayout();
    const sourceIsPrimary = layout.primary.includes(typeId);
    const sourceIsOther = layout.other.includes(typeId);
    if (!sourceIsPrimary && !sourceIsOther)
    {
        return;
    }
    if
    (
        sourceIsPrimary
        && destination === "other"
        && layout.primary.length === 1
    )
    {
        showToast("主栏至少保留一个对象入口", "error");
        return;
    }

    const sourceList = sourceIsPrimary ? layout.primary : layout.other;
    const sourceIndex = sourceList.indexOf(typeId);
    let targetIndex = requestedIndex;
    if (sourceIsPrimary === (destination === "primary"))
    {
        if (targetIndex > sourceIndex)
        {
            targetIndex -= 1;
        }
    }

    layout.primary = layout.primary.filter((item) => item !== typeId);
    layout.other = layout.other.filter((item) => item !== typeId);
    const destinationList = destination === "primary"
        ? layout.primary
        : layout.other;
    destinationList.splice(
        Math.max(0, Math.min(targetIndex, destinationList.length)),
        0,
        typeId
    );
    navLayout = layout;
    saveNavLayout();
    otherMenuOpen = false;
    renderApp();
}


function handleNavDrop(event: DragEvent): void
{
    if (!draggedNavTypeId || !navDropPlan)
    {
        return;
    }
    event.preventDefault();
    const typeId = draggedNavTypeId;
    const destination = navDropPlan.location;
    const destinationIndex = navDropPlan.index;
    moveNavItem(
        typeId,
        destination,
        destinationIndex
    );
    finishNavDrag();
}


function handleObjectNavWheel(event: WheelEvent): void
{
    const target = event.target;
    if (!(target instanceof Element))
    {
        return;
    }
    const nav = target.closest<HTMLElement>(".object-nav-primary");
    if (!nav)
    {
        return;
    }

    const maximumScroll = nav.scrollWidth - nav.clientWidth;
    if (maximumScroll <= 0)
    {
        return;
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    if (!delta)
    {
        return;
    }

    const previousScroll = nav.scrollLeft;
    nav.scrollLeft = Math.max(
        0,
        Math.min(maximumScroll, previousScroll + delta)
    );
    if (nav.scrollLeft !== previousScroll)
    {
        event.preventDefault();
    }
}


function archiveDateStamp(): string
{
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
        "-",
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
    ].join("");
}


function downloadArchive(blob: Blob): void
{
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `lhlord-data-${archiveDateStamp()}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(
        () => URL.revokeObjectURL(objectUrl),
        1000
    );
}


async function exportAppData(): Promise<void>
{
    if (dataTransferBusy)
    {
        return;
    }

    dataTransferBusy = "export";
    renderApp();
    try
    {
        const blob = await exportCatalog(getNavLayout());
        downloadArchive(blob);
        showToast("全部数据已导出为 ZIP 压缩包", "success");
        void refreshStats();
    }
    catch (error)
    {
        showToast(errorMessage(error), "error");
    }
    finally
    {
        dataTransferBusy = null;
        renderApp();
    }
}


async function importArchiveFile(file: File): Promise<void>
{
    if (dataTransferBusy)
    {
        return;
    }
    if (file.size > 50 * 1024 * 1024)
    {
        showToast("导入压缩包不能超过 50 MB", "error");
        return;
    }
    const confirmed = window.confirm(
        "导入会覆盖当前全部卡片和关联关系，是否继续？\n\n建议先使用“导出”备份当前数据。"
    );
    if (!confirmed)
    {
        return;
    }

    dataTransferBusy = "import";
    renderApp();
    try
    {
        const result = await importCatalog(file);
        if (result.nav_layout)
        {
            navLayout = normalizeNavLayout(result.nav_layout);
            saveNavLayout();
        }
        showToast(
            `已导入 ${result.imported_cards} 张卡片和 ${result.imported_relations} 条关联`,
            "success"
        );
        dataTransferBusy = null;
        await loadCurrentCards();
        void refreshStats();
    }
    catch (error)
    {
        dataTransferBusy = null;
        renderApp();
        showToast(errorMessage(error), "error");
    }
}


async function handleAppClick(event: MouseEvent): Promise<void>
{
    const target = event.target;
    if (!(target instanceof Element))
    {
        return;
    }
    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement)
    {
        return;
    }

    const action = actionElement.dataset.action;
    if
    (
        suppressNavClick
        && actionElement.closest(
            "[data-nav-type-id], [data-action=\"toggle-other-nav\"]"
        )
    )
    {
        suppressNavClick = false;
        return;
    }
    if (action === "retry-boot")
    {
        await boot();
        return;
    }
    if (action === "retry-load")
    {
        await loadCurrentCards();
        return;
    }
    if (action === "open-stats")
    {
        const view = actionElement.dataset.statsView;
        if (view === "visitors" || view === "operations")
        {
            openStatsPanel(view);
        }
        return;
    }
    if (action === "export-data")
    {
        await exportAppData();
        return;
    }
    if (action === "trigger-import")
    {
        document.querySelector<HTMLInputElement>("#import-archive")?.click();
        return;
    }
    if (action === "toggle-other-nav")
    {
        toggleOtherMenu();
        return;
    }
    if (action === "select-type")
    {
        const typeId = actionElement.dataset.typeId;
        if (typeId)
        {
            otherMenuOpen = false;
            await selectType(typeId);
        }
        return;
    }
    if (action === "create-card")
    {
        openEditor(null);
        return;
    }
    if (action === "edit-card")
    {
        const cardId = actionElement.dataset.cardId;
        const card = currentCards.find((item) => item.id === cardId);
        if (card)
        {
            openEditor(card);
        }
        return;
    }
    if (action === "open-related")
    {
        const typeId = actionElement.dataset.typeId;
        const cardId = actionElement.dataset.cardId;
        if (typeId && cardId)
        {
            await navigateToRelated(typeId, cardId);
        }
    }
}


function handleAppChange(event: Event): void
{
    const target = event.target;
    if
    (
        !(target instanceof HTMLInputElement)
        || target.id !== "import-archive"
    )
    {
        return;
    }

    const file = target.files?.[0];
    target.value = "";
    if (file)
    {
        void importArchiveFile(file);
    }
}


async function handleHashChange(): Promise<void>
{
    if (!catalog)
    {
        return;
    }
    const typeId = typeFromHash();
    if (typeId && typeId !== currentTypeId)
    {
        await selectType(typeId);
    }
}


app.addEventListener("click", (event) => {
    void handleAppClick(event);
});
app.addEventListener("change", handleAppChange);
app.addEventListener("dragstart", handleNavDragStart);
app.addEventListener("dragend", handleNavDragEnd);
app.addEventListener("dragover", handleNavDragOver);
app.addEventListener("drop", handleNavDrop);
app.addEventListener(
    "wheel",
    handleObjectNavWheel,
    { passive: false }
);
document.addEventListener("click", (event) => {
    if
    (
        !otherMenuOpen
        || !(event.target instanceof Node)
    )
    {
        return;
    }
    const otherNav = document.querySelector(".other-nav");
    if (!otherNav?.contains(event.target))
    {
        setOtherMenuOpen(false);
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape")
    {
        return;
    }
    if (statsPanelView)
    {
        event.preventDefault();
        closeStatsPanel();
        return;
    }
    if (otherMenuOpen)
    {
        event.preventDefault();
        setOtherMenuOpen(false, true);
    }
});
window.addEventListener("hashchange", () => {
    void handleHashChange();
});

void boot();
