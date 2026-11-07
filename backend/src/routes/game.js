import express from 'express';
import { pool } from '../db.js';

const router = express.Router();
const SAVE_ID = 1;
const MAX_TALENTS = 2;
const ROOT_COLUMNS = {
    metal: 'metal_root',
    wood: 'wood_root',
    water: 'water_root',
    fire: 'fire_root',
    earth: 'earth_root',
};
const ROOT_ORDER = Object.keys(ROOT_COLUMNS);

function badRequest(message)
{
    const error = new Error(message);
    error.status = 400;
    return error;
}

function notFound(message)
{
    const error = new Error(message);
    error.status = 404;
    return error;
}

function cultivationRequired(realmLevel, stage)
{
    return 100 * realmLevel * stage;
}

/**
 * @brief 计算闭关一日的修为收益
 *
 * @param {number} aptitude 资质
 * @return {number} 未计入丹药增益的每日修为
 */
function baseCultivationPerDay(aptitude)
{
    return 20 + Number(aptitude || 10) * 2;
}

/**
 * @brief 计算突破成功率
 *
 * @param {number} aptitude 资质
 * @param {number} comprehension 悟性
 * @param {number} bonus 突破丹药提供的加成
 * @return {number} 成功率百分比, 上限 95
 */
function breakthroughChance(aptitude, comprehension, bonus)
{
    return Math.min(95, 65 + Number(aptitude || 0) * 0.5 + Number(comprehension || 0) * 0.25 + Number(bonus || 0));
}

/**
 * @brief 将所选灵根均分为 100 点
 *
 * @param {Array<string>} elements 所选五行灵根
 * @return {object} character_attribute 对应的灵根字段值
 */
function buildRootDistribution(elements)
{
    const roots = Object.fromEntries(Object.values(ROOT_COLUMNS).map((column) => [column, 0]));
    const selected = ROOT_ORDER.filter((element) => elements.includes(element));
    const base = Math.floor(100 / selected.length);
    let remainder = 100 % selected.length;
    for (const element of selected)
    {
        roots[ROOT_COLUMNS[element]] = base + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
    }
    return roots;
}

/**
 * @brief 汇总角色基础属性, 种族加成与天赋加成
 *
 * @param {object} db 连接池或事务连接
 * @param {number} characterId 角色 ID
 * @return {Promise<object|null>} 基础值, 加成与最终属性
 */
async function getEffectiveAttributes(db, characterId)
{
    const [[row]] = await db.query(
        `SELECT ca.aptitude, ca.comprehension, ca.metal_root, ca.wood_root, ca.water_root,
                ca.fire_root, ca.earth_root, ca.max_hp, ca.attack, ca.defense,
                ra.aptitude_bonus AS race_aptitude_bonus,
                ra.comprehension_bonus AS race_comprehension_bonus,
                ra.max_hp_bonus AS race_max_hp_bonus,
                ra.attack_bonus AS race_attack_bonus,
                ra.defense_bonus AS race_defense_bonus,
                ra.cultivation_bonus AS race_cultivation_bonus,
                COALESCE(ts.aptitude_bonus, 0) AS talent_aptitude_bonus,
                COALESCE(ts.comprehension_bonus, 0) AS talent_comprehension_bonus,
                COALESCE(ts.max_hp_bonus, 0) AS talent_max_hp_bonus,
                COALESCE(ts.attack_bonus, 0) AS talent_attack_bonus,
                COALESCE(ts.defense_bonus, 0) AS talent_defense_bonus,
                COALESCE(ts.cultivation_bonus, 0) AS talent_cultivation_bonus,
                COALESCE(ts.alchemy_bonus, 0) AS talent_alchemy_bonus
           FROM \`character\` c
           JOIN character_attribute ca ON ca.character_id = c.character_id
           LEFT JOIN race ra ON ra.race_id = c.race_id
           LEFT JOIN
                (
                    SELECT ct.character_id,
                           SUM(t.aptitude_bonus) AS aptitude_bonus,
                           SUM(t.comprehension_bonus) AS comprehension_bonus,
                           SUM(t.max_hp_bonus) AS max_hp_bonus,
                           SUM(t.attack_bonus) AS attack_bonus,
                           SUM(t.defense_bonus) AS defense_bonus,
                           SUM(t.cultivation_bonus) AS cultivation_bonus,
                           SUM(t.alchemy_bonus) AS alchemy_bonus
                      FROM character_talent ct
                      JOIN talent t ON t.talent_id = ct.talent_id
                     GROUP BY ct.character_id
                ) ts ON ts.character_id = c.character_id
          WHERE c.character_id = ?`,
        [characterId]
    );
    if (!row) return null;

    const total = (base, raceBonus, talentBonus) =>
        Number(base || 0) + Number(raceBonus || 0) + Number(talentBonus || 0);
    return {
        base: {
            aptitude: Number(row.aptitude || 10),
            comprehension: Number(row.comprehension || 10),
            maxHp: Number(row.max_hp || 100),
            attack: Number(row.attack || 10),
            defense: Number(row.defense || 10),
        },
        roots: {
            metal: Number(row.metal_root || 0),
            wood: Number(row.wood_root || 0),
            water: Number(row.water_root || 0),
            fire: Number(row.fire_root || 0),
            earth: Number(row.earth_root || 0),
        },
        raceBonuses: {
            aptitude: Number(row.race_aptitude_bonus || 0),
            comprehension: Number(row.race_comprehension_bonus || 0),
            maxHp: Number(row.race_max_hp_bonus || 0),
            attack: Number(row.race_attack_bonus || 0),
            defense: Number(row.race_defense_bonus || 0),
            cultivation: Number(row.race_cultivation_bonus || 0),
        },
        talentBonuses: {
            aptitude: Number(row.talent_aptitude_bonus || 0),
            comprehension: Number(row.talent_comprehension_bonus || 0),
            maxHp: Number(row.talent_max_hp_bonus || 0),
            attack: Number(row.talent_attack_bonus || 0),
            defense: Number(row.talent_defense_bonus || 0),
            cultivation: Number(row.talent_cultivation_bonus || 0),
            alchemy: Number(row.talent_alchemy_bonus || 0),
        },
        effective: {
            aptitude: total(row.aptitude, row.race_aptitude_bonus, row.talent_aptitude_bonus),
            comprehension: total(row.comprehension, row.race_comprehension_bonus, row.talent_comprehension_bonus),
            maxHp: total(row.max_hp, row.race_max_hp_bonus, row.talent_max_hp_bonus),
            attack: total(row.attack, row.race_attack_bonus, row.talent_attack_bonus),
            defense: total(row.defense, row.race_defense_bonus, row.talent_defense_bonus),
            cultivationRateBonus:
                Number(row.race_cultivation_bonus || 0) + Number(row.talent_cultivation_bonus || 0),
            alchemyRateBonus: Number(row.talent_alchemy_bonus || 0),
        },
    };
}

/**
 * @brief 读取角色天赋列表
 *
 * @param {object} db 连接池或事务连接
 * @param {number} characterId 角色 ID
 * @return {Promise<Array>} 天赋列表
 */
async function getCharacterTalents(db, characterId)
{
    const [rows] = await db.query(
        `SELECT t.*
           FROM character_talent ct
           JOIN talent t ON t.talent_id = ct.talent_id
          WHERE ct.character_id = ?
          ORDER BY t.talent_id`,
        [characterId]
    );
    return rows;
}

export async function getState()
{
    const [[save]] = await pool.query(
        `SELECT gs.save_id, gs.character_id, gs.realm_stage, gs.cultivation,
                gs.spirit_stones, gs.day_count,
                c.character_name, c.age, c.gender, c.class_id, c.race_id,
                c.character_description,
                cl.class_name, r.realm_id, r.realm_name, r.realm_level, r.realm_world,
                ra.race_name, ra.race_description,
                sm.member_name, s.sect_name
           FROM game_save gs
           JOIN \`character\` c ON c.character_id = gs.character_id
           JOIN realm r ON r.realm_id = c.realm_id
           LEFT JOIN class cl ON cl.class_id = c.class_id
           LEFT JOIN race ra ON ra.race_id = c.race_id
           LEFT JOIN sect_member sm ON sm.character_id = c.character_id AND sm.member_status = 1
           LEFT JOIN sect s ON s.sect_id = sm.sect_id
          WHERE gs.save_id = ?`,
        [SAVE_ID]
    );

    if (!save)
    {
        return { hasSave: false };
    }

    const [inventory] = await pool.query(
        `SELECT ci.item_id, ci.quantity, i.item_name, i.item_code, i.level, i.description,
                i.item_category_id, ic.item_category_name,
                h.main_effect, h.secondary_effect, h.guide_effect,
                p.pill_category, p.effect_type, p.base_effect,
                p.breakthrough_bonus, p.toxicity, p.buff_code,
                pr.recipe_id, pr.pill_id
           FROM character_inventory ci
           JOIN item i ON i.item_id = ci.item_id
           JOIN item_category ic ON ic.item_category_id = i.item_category_id
           LEFT JOIN herb h ON h.item_id = ci.item_id
           LEFT JOIN pill p ON p.item_id = ci.item_id
           LEFT JOIN pill_recipe pr ON pr.recipe_item_id = ci.item_id
          WHERE ci.character_id = ? AND ci.quantity > 0
          ORDER BY i.item_category_id, i.level, i.item_name`,
        [save.character_id]
    );
    const [buffs] = await pool.query(
        `SELECT cb.buff_code, cb.buff_value, cb.expires_at, b.buff_name
           FROM character_buff cb
           LEFT JOIN buff b ON b.buff_code = cb.buff_code
          WHERE cb.character_id = ? AND cb.status = 1
            AND (cb.expires_at IS NULL OR cb.expires_at > NOW())
          ORDER BY cb.expires_at`,
        [save.character_id]
    );
    const [events] = await pool.query(
        `SELECT event_id, event_type, title, description, create_time
           FROM game_event
          WHERE save_id = ?
          ORDER BY event_id DESC
          LIMIT 12`,
        [SAVE_ID]
    );

    const [talents, attributes] = await Promise.all([
        getCharacterTalents(pool, save.character_id),
        getEffectiveAttributes(pool, save.character_id),
    ]);
    const threshold = cultivationRequired(Number(save.realm_level), Number(save.realm_stage));
    const cultivationBonus = maxBuffValue(buffs, 'CULTIVATION_UP');
    const breakthroughBonus = maxBuffValue(buffs, 'BREAKTHROUGH_BONUS');
    const cultivationRateBonus = attributes.effective.cultivationRateBonus;
    return {
        hasSave: true,
        character: {
            characterId: Number(save.character_id),
            name: save.character_name,
            gender: Number(save.gender || 1),
            age: Number(save.age || 16),
            description: save.character_description,
            raceId: Number(save.race_id),
            raceName: save.race_name || '未知种族',
            raceDescription: save.race_description,
            classId: Number(save.class_id || 0),
            className: save.class_name || '散修',
            sectName: save.sect_name || '无门无派',
            realm: save.realm_name,
            realmId: Number(save.realm_id),
            realmLevel: Number(save.realm_level),
            realmWorld: Number(save.realm_world),
            stage: Number(save.realm_stage),
            aptitude: attributes.effective.aptitude,
            comprehension: attributes.effective.comprehension,
            maxHp: attributes.effective.maxHp,
            attack: attributes.effective.attack,
            defense: attributes.effective.defense,
            baseAttributes: attributes.base,
            roots: attributes.roots,
            raceBonuses: attributes.raceBonuses,
            talentBonuses: attributes.talentBonuses,
            cultivationRateBonus,
            alchemyRateBonus: attributes.effective.alchemyRateBonus,
            talents,
        },
        cultivation: Number(save.cultivation),
        cultivationRequired: threshold,
        cultivationPerDay: Math.round(
            baseCultivationPerDay(attributes.effective.aptitude) *
                (1 + (cultivationBonus + cultivationRateBonus) / 100)
        ),
        breakthroughChance: Math.round(
            breakthroughChance(attributes.effective.aptitude, attributes.effective.comprehension, breakthroughBonus) * 10
        ) / 10,
        spiritStones: Number(save.spirit_stones),
        dayCount: Number(save.day_count),
        inventory,
        buffs,
        events,
    };
}

/**
 * @brief 取某一类增益中的最大生效值
 *
 * @param {Array} buffs 角色当前生效的增益
 * @param {string} code 增益编码
 * @return {number} 最大生效值, 没有对应增益时返回 0
 */
function maxBuffValue(buffs, code)
{
    return buffs
        .filter((buff) => buff.buff_code === code)
        .reduce((max, buff) => Math.max(max, Number(buff.buff_value || 0)), 0);
}

async function recordEvent(conn, type, title, description)
{
    await conn.query(
        `INSERT INTO game_event (save_id, event_type, title, description)
         VALUES (?, ?, ?, ?)`,
        [SAVE_ID, type, title, description]
    );
}

router.get('/state', async (req, res, next) =>
{
    try
    {
        res.json({ ok: true, data: await getState() });
    }
    catch (error)
    {
        next(error);
    }
});

/**
 * @brief 获取全部境界, 供玩家端绘制境界天梯
 *
 * 境界按位面与位面内序号排序, 前端据此判断当前境界所处的阶段与后续境界
 *
 * @return {Promise<Array>} 境界列表(realm_id, realm_name, realm_world, realm_level)
 */
router.get('/realms', async (req, res, next) =>
{
    try
    {
        const [rows] = await pool.query(
            `SELECT realm_id, realm_code, realm_name, realm_world, realm_level
               FROM realm
              ORDER BY realm_world, realm_level`
        );
        res.json({ ok: true, data: rows });
    }
    catch (error)
    {
        next(error);
    }
});

/**
 * @brief 获取新角色创建可选项
 */
router.get('/creation-options', async (req, res, next) =>
{
    try
    {
        const [races] = await pool.query(
            `SELECT race_id, race_code, race_name, race_description,
                    aptitude_bonus, comprehension_bonus, max_hp_bonus,
                    attack_bonus, defense_bonus, cultivation_bonus
               FROM race
              ORDER BY race_id`
        );
        const [classes] = await pool.query(
            `SELECT class_id, class_code, class_name, class_description
               FROM class
              ORDER BY class_id`
        );
        const [talents] = await pool.query(
            `SELECT *
               FROM talent
              ORDER BY talent_id`
        );
        res.json({
            ok: true,
            data: {
                races,
                classes,
                talents,
                roots: ROOT_ORDER,
                maxTalents: MAX_TALENTS,
                rootPoints: 100,
            },
        });
    }
    catch (error)
    {
        next(error);
    }
});

router.post('/start', async (req, res, next) =>
{
    const conn = await pool.getConnection();
    try
    {
        const name = String(req.body?.name || '').trim();
        const gender = Number(req.body?.gender || 1);
        const raceId = Number(req.body?.raceId || 0);
        const classId = Number(req.body?.classId || 0);
        const rootElements = Array.isArray(req.body?.rootElements) ? req.body.rootElements : [];
        const talentIds = Array.isArray(req.body?.talentIds)
            ? [...new Set(req.body.talentIds.map((id) => Number(id)).filter((id) => id > 0))]
            : [];
        if (name.length < 1 || name.length > 16)
        {
            throw badRequest('道号长度需要在 1 到 16 个字符之间');
        }
        if (![1, 2].includes(gender))
        {
            throw badRequest('请选择有效的性别');
        }
        if (!raceId || !classId)
        {
            throw badRequest('种族与职业不能为空');
        }
        if (rootElements.length === 0 || rootElements.some((element) => !ROOT_ORDER.includes(element)))
        {
            throw badRequest('请至少选择一种有效灵根');
        }
        if (talentIds.length < 1 || talentIds.length > MAX_TALENTS)
        {
            throw badRequest(`请选择 1 至 ${MAX_TALENTS} 个天赋`);
        }

        await conn.beginTransaction();
        const [saves] = await conn.query(
            `SELECT save_id FROM game_save WHERE save_id = ? FOR UPDATE`,
            [SAVE_ID]
        );
        if (saves.length > 0)
        {
            throw badRequest('已有存档，请继续当前修行');
        }

        const [[race]] = await conn.query(
            `SELECT race_id, race_name FROM race WHERE race_id = ?`,
            [raceId]
        );
        if (!race) throw badRequest('所选种族不存在');
        const [[characterClass]] = await conn.query(
            `SELECT class_id, class_name FROM class WHERE class_id = ?`,
            [classId]
        );
        if (!characterClass) throw badRequest('所选职业不存在');
        const [talentRows] = await conn.query(
            `SELECT talent_id FROM talent WHERE talent_id IN (?)`,
            [talentIds]
        );
        if (talentRows.length !== talentIds.length)
        {
            throw badRequest('所选天赋中包含无效项');
        }

        const roots = buildRootDistribution(rootElements);
        const [characterResult] = await conn.query(
            `INSERT INTO \`character\`
                (character_name, gender, age, race_id, class_id, realm_id, character_description)
             VALUES (?, ?, 16, ?, ?, 1, ?)`,
            [name, gender, raceId, classId, `${race.race_name}${characterClass.class_name}, 初入修仙之路的玩家修士`]
        );
        const characterId = Number(characterResult.insertId);
        await conn.query(
            `INSERT INTO character_attribute
                (character_id, aptitude, comprehension, metal_root, wood_root, water_root,
                 fire_root, earth_root, max_hp, attack, defense)
             VALUES (?, 10, 10, ?, ?, ?, ?, ?, 100, 10, 10)`,
            [
                characterId,
                roots.metal_root,
                roots.wood_root,
                roots.water_root,
                roots.fire_root,
                roots.earth_root,
            ]
        );
        for (const talentId of talentIds)
        {
            await conn.query(
                `INSERT INTO character_talent (character_id, talent_id) VALUES (?, ?)`,
                [characterId, talentId]
            );
        }
        await conn.query(
            `INSERT INTO character_alchemy_skill (character_id) VALUES (?)`,
            [characterId]
        );
        await conn.query(
            `INSERT INTO game_save (save_id, character_id) VALUES (?, ?)`,
            [SAVE_ID, characterId]
        );

        for (const [itemCode, quantity] of [
            ['HERB_HUOXUE', 8],
            ['HERB_SHENGXI', 8],
            ['HERB_YULU', 8],
            ['FURNACE_ALC_L1', 1],
            ['RECIPE_HUICHUN', 1],
            ['RECIPE_JULING', 1],
        ])
        {
            const [result] = await conn.query(
                `INSERT INTO character_inventory (character_id, item_id, quantity)
                 SELECT ?, item_id, ? FROM item WHERE item_code = ?`,
                [characterId, quantity, itemCode]
            );
            if (result.affectedRows === 0)
            {
                throw new Error(`开局物品不存在: ${itemCode}`);
            }
        }

        await recordEvent(
            conn,
            'start',
            '踏入仙途',
            `${race.race_name}修士${name}在青岚山醒来，身边只有几味草药与一尊旧丹炉`
        );
        await conn.commit();
        res.json({ ok: true, data: await getState() });
    }
    catch (error)
    {
        await conn.rollback();
        next(error);
    }
    finally
    {
        conn.release();
    }
});

router.post('/cultivate', async (req, res, next) =>
{
    const conn = await pool.getConnection();
    try
    {
        await conn.beginTransaction();
        const [[save]] = await conn.query(
            `SELECT gs.*, r.realm_level
               FROM game_save gs
               JOIN \`character\` c ON c.character_id = gs.character_id
               JOIN realm r ON r.realm_id = c.realm_id
              WHERE gs.save_id = ? FOR UPDATE`,
            [SAVE_ID]
        );
        if (!save) throw notFound('尚未创建修行存档');
        const attributes = await getEffectiveAttributes(conn, save.character_id);
        if (!attributes) throw notFound('角色属性不存在');

        const [buffs] = await conn.query(
            `SELECT MAX(buff_value) AS cultivation_bonus
               FROM character_buff
              WHERE character_id = ? AND buff_code = 'CULTIVATION_UP' AND status = 1
                AND (expires_at IS NULL OR expires_at > NOW())`,
            [save.character_id]
        );
        const bonus = Number(buffs[0]?.cultivation_bonus || 0);
        const gained = Math.round(
            baseCultivationPerDay(attributes.effective.aptitude) *
                (1 + (bonus + attributes.effective.cultivationRateBonus) / 100)
        );
        await conn.query(
            `UPDATE game_save
                SET cultivation = cultivation + ?, day_count = day_count + 1
              WHERE save_id = ?`,
            [gained, SAVE_ID]
        );
        await recordEvent(conn, 'cultivate', '闭关一日', `灵气沿经脉周天运行，修为增长 ${gained} 点`);
        await conn.commit();
        res.json({ ok: true, data: await getState(), result: { gained } });
    }
    catch (error)
    {
        await conn.rollback();
        next(error);
    }
    finally
    {
        conn.release();
    }
});

router.post('/explore', async (req, res, next) =>
{
    const conn = await pool.getConnection();
    try
    {
        await conn.beginTransaction();
        const [[save]] = await conn.query(
            `SELECT gs.*, r.realm_level
               FROM game_save gs
               JOIN \`character\` c ON c.character_id = gs.character_id
               JOIN realm r ON r.realm_id = c.realm_id
              WHERE gs.save_id = ? FOR UPDATE`,
            [SAVE_ID]
        );
        if (!save) throw notFound('尚未创建修行存档');

        const [[herb]] = await conn.query(
            `SELECT i.item_id, i.item_name
               FROM item i
               JOIN herb h ON h.item_id = i.item_id
              WHERE i.level <= ? AND i.level <= 3
              ORDER BY RAND()
              LIMIT 1`,
            [Number(save.realm_level) + 1]
        );
        if (!herb) throw new Error('没有找到适合当前境界的草药');

        const stones = 12 + Math.floor(Math.random() * 9);
        const quantity = 2 + Math.floor(Math.random() * 3);
        await conn.query(
            `UPDATE game_save
                SET spirit_stones = spirit_stones + ?, day_count = day_count + 1
              WHERE save_id = ?`,
            [stones, SAVE_ID]
        );
        await conn.query(
            `INSERT INTO character_inventory (character_id, item_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
            [save.character_id, herb.item_id, quantity]
        );
        await recordEvent(conn, 'explore', '山中寻药', `你找到 ${quantity} 株${herb.item_name}，并拾得 ${stones} 枚灵石`);
        await conn.commit();
        res.json({ ok: true, data: await getState(), result: { herb, quantity, stones } });
    }
    catch (error)
    {
        await conn.rollback();
        next(error);
    }
    finally
    {
        conn.release();
    }
});

router.post('/breakthrough', async (req, res, next) =>
{
    const conn = await pool.getConnection();
    try
    {
        await conn.beginTransaction();
        const [[save]] = await conn.query(
            `SELECT gs.*, r.realm_id, r.realm_name, r.realm_level, r.realm_world
               FROM game_save gs
               JOIN \`character\` c ON c.character_id = gs.character_id
               JOIN realm r ON r.realm_id = c.realm_id
              WHERE gs.save_id = ? FOR UPDATE`,
            [SAVE_ID]
        );
        if (!save) throw notFound('尚未创建修行存档');
        const attributes = await getEffectiveAttributes(conn, save.character_id);
        if (!attributes) throw notFound('角色属性不存在');

        const required = cultivationRequired(Number(save.realm_level), Number(save.realm_stage));
        if (Number(save.cultivation) < required)
        {
            throw badRequest(`修为不足，至少需要 ${required} 点`);
        }

        const [buffRows] = await conn.query(
            `SELECT MAX(buff_value) AS breakthrough_bonus
               FROM character_buff
              WHERE character_id = ? AND buff_code = 'BREAKTHROUGH_BONUS' AND status = 1
                AND (expires_at IS NULL OR expires_at > NOW())`,
            [save.character_id]
        );
        const chance = breakthroughChance(
            attributes.effective.aptitude,
            attributes.effective.comprehension,
            buffRows[0]?.breakthrough_bonus
        );
        const success = Math.random() * 100 < chance;
        let eventTitle;
        let eventDescription;
        let nextRealm = null;

        if (success)
        {
            let nextStage = Number(save.realm_stage) + 1;
            let nextRealmId = Number(save.realm_id);
            if (nextStage > 3)
            {
                const [[realm]] = await conn.query(
                    `SELECT realm_id, realm_name
                       FROM realm
                      WHERE realm_world = ? AND realm_level = ?
                      LIMIT 1`,
                    [save.realm_world, Number(save.realm_level) + 1]
                );
                if (!realm)
                {
                    throw badRequest('此存档版本暂未开放更高境界');
                }
                nextRealm = realm;
                nextRealmId = Number(realm.realm_id);
                nextStage = 1;
            }

            await conn.query(
                `UPDATE \`character\` SET realm_id = ? WHERE character_id = ?`,
                [nextRealmId, save.character_id]
            );
            await conn.query(
                `UPDATE game_save SET realm_stage = ?, cultivation = 0 WHERE save_id = ?`,
                [nextStage, SAVE_ID]
            );
            eventTitle = '突破成功';
            eventDescription = nextRealm
                ? `灵气贯通周天，你突破至${nextRealm.realm_name}境`
                : `根基稳固，你进入${save.realm_name}${['', '初期', '中期', '后期'][nextStage]}`;
        }
        else
        {
            const remaining = Math.floor(Number(save.cultivation) * 0.75);
            await conn.query(
                `UPDATE game_save SET cultivation = ? WHERE save_id = ?`,
                [remaining, SAVE_ID]
            );
            eventTitle = '突破未成';
            eventDescription = `灵气未能贯通，修为受损，尚余 ${remaining} 点`;
        }

        await conn.query(
            `UPDATE game_save SET day_count = day_count + 1 WHERE save_id = ?`,
            [SAVE_ID]
        );
        await recordEvent(conn, success ? 'breakthrough' : 'breakthrough_failed', eventTitle, eventDescription);
        await conn.commit();
        res.json({ ok: true, data: await getState(), result: { success, chance, eventTitle, eventDescription } });
    }
    catch (error)
    {
        await conn.rollback();
        next(error);
    }
    finally
    {
        conn.release();
    }
});

export default router;
