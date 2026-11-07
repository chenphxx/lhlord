/**
 * @brief 玩家角色管理路由
 *
 * 提供存档角色的基础信息, 属性, 天赋与背包维护接口
 */
import { Router } from 'express';
import { pool } from '../db.js';
import { getState } from './game.js';

const router = Router();
const SAVE_ID = 1;
const MAX_TALENTS = 2;

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

function int(value, fallback = 0)
{
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function assertRange(value, min, max, label)
{
    if (value < min || value > max)
    {
        throw badRequest(`${label}需要在 ${min} 到 ${max} 之间`);
    }
}

async function getActiveCharacterId(db)
{
    const [[save]] = await db.query(
        `SELECT character_id FROM game_save WHERE save_id = ?`,
        [SAVE_ID]
    );
    if (!save) throw notFound('尚未创建玩家角色');
    return Number(save.character_id);
}

/**
 * @brief 获取角色管理与背包编辑所需的目录数据
 */
router.get('/catalog', async (req, res, next) =>
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
        const [realms] = await pool.query(
            `SELECT realm_id, realm_code, realm_name, realm_world, realm_level
               FROM realm
              ORDER BY realm_world, realm_level`
        );
        const [talents] = await pool.query(
            `SELECT *
               FROM talent
              ORDER BY talent_id`
        );
        const [items] = await pool.query(
            `SELECT i.item_id, i.item_code, i.item_name, i.level, i.description,
                    i.item_category_id, ic.item_category_name
               FROM item i
               LEFT JOIN item_category ic ON ic.item_category_id = i.item_category_id
              ORDER BY i.item_category_id, i.level, i.item_id`
        );
        res.json({ ok: true, data: { races, classes, realms, talents, items } });
    }
    catch (error)
    {
        next(error);
    }
});

/**
 * @brief 获取当前存档角色完整状态
 */
router.get('/player', async (req, res, next) =>
{
    try
    {
        const state = await getState();
        if (!state.hasSave) throw notFound('尚未创建玩家角色');
        res.json({ ok: true, data: state });
    }
    catch (error)
    {
        next(error);
    }
});

/**
 * @brief 更新当前存档角色的全部可编辑属性
 */
router.put('/player', async (req, res, next) =>
{
    const conn = await pool.getConnection();
    try
    {
        const body = req.body || {};
        await conn.beginTransaction();
        const [[save]] = await conn.query(
            `SELECT gs.save_id, gs.character_id, gs.realm_stage, gs.cultivation,
                    gs.spirit_stones, gs.day_count,
                    c.character_name, c.gender, c.age, c.race_id, c.class_id,
                    c.realm_id, c.character_description,
                    ca.aptitude, ca.comprehension, ca.metal_root, ca.wood_root,
                    ca.water_root, ca.fire_root, ca.earth_root, ca.max_hp,
                    ca.attack, ca.defense,
                    cas.alchemy_level, cas.pharmacology_level,
                    cas.fire_control_level, cas.tolerance_level,
                    cas.success_count, cas.best_recipe_level,
                    cdt.toxin_value
               FROM game_save gs
               JOIN \`character\` c ON c.character_id = gs.character_id
               LEFT JOIN character_attribute ca ON ca.character_id = c.character_id
               LEFT JOIN character_alchemy_skill cas ON cas.character_id = c.character_id
               LEFT JOIN character_drug_toxin cdt ON cdt.character_id = c.character_id
              WHERE gs.save_id = ?
              FOR UPDATE`,
            [SAVE_ID]
        );
        if (!save) throw notFound('尚未创建玩家角色');

        const name = String(body.name ?? save.character_name ?? '').trim();
        if (name.length < 1 || name.length > 16)
        {
            throw badRequest('道号长度需要在 1 到 16 个字符之间');
        }
        const gender = int(body.gender ?? save.gender, 1);
        const age = int(body.age ?? save.age, 16);
        const raceId = int(body.raceId ?? save.race_id, 0);
        const classId = int(body.classId ?? save.class_id, 0);
        const realmId = int(body.realmId ?? save.realm_id, 0);
        const realmStage = int(body.realmStage ?? save.realm_stage, 1);
        const cultivation = int(body.cultivation ?? save.cultivation, 0);
        const spiritStones = int(body.spiritStones ?? save.spirit_stones, 0);
        const dayCount = int(body.dayCount ?? save.day_count, 1);
        const description = String(body.description ?? save.character_description ?? '').slice(0, 255);
        const attributes = {
            aptitude: int(body.aptitude ?? save.aptitude, 10),
            comprehension: int(body.comprehension ?? save.comprehension, 10),
            metal_root: int(body.metalRoot ?? save.metal_root, 0),
            wood_root: int(body.woodRoot ?? save.wood_root, 0),
            water_root: int(body.waterRoot ?? save.water_root, 0),
            fire_root: int(body.fireRoot ?? save.fire_root, 0),
            earth_root: int(body.earthRoot ?? save.earth_root, 0),
            max_hp: int(body.maxHp ?? save.max_hp, 100),
            attack: int(body.attack ?? save.attack, 10),
            defense: int(body.defense ?? save.defense, 10),
        };
        const skills = {
            alchemy_level: int(body.alchemyLevel ?? save.alchemy_level, 1),
            pharmacology_level: int(body.pharmacologyLevel ?? save.pharmacology_level, 1),
            fire_control_level: int(body.fireControlLevel ?? save.fire_control_level, 1),
            tolerance_level: int(body.toleranceLevel ?? save.tolerance_level, 0),
            success_count: int(body.successCount ?? save.success_count, 0),
            best_recipe_level: int(body.bestRecipeLevel ?? save.best_recipe_level, 0),
        };
        const toxinValue = int(body.toxinValue ?? save.toxin_value, 0);

        if (![1, 2].includes(gender)) throw badRequest('性别值无效');
        assertRange(age, 1, 99999, '年龄');
        assertRange(realmStage, 1, 3, '小境界');
        assertRange(cultivation, 0, 999999999, '修为');
        assertRange(spiritStones, 0, 999999999, '灵石');
        assertRange(dayCount, 1, 999999999, '天数');
        for (const field of ['aptitude', 'comprehension'])
        {
            assertRange(attributes[field], 0, 9999, field === 'aptitude' ? '资质' : '悟性');
        }
        for (const field of ['metal_root', 'wood_root', 'water_root', 'fire_root', 'earth_root'])
        {
            assertRange(attributes[field], 0, 100, '灵根');
        }
        for (const field of ['max_hp', 'attack', 'defense'])
        {
            assertRange(attributes[field], 0, 999999, field);
        }
        for (const field of ['alchemy_level', 'pharmacology_level', 'fire_control_level', 'tolerance_level', 'best_recipe_level'])
        {
            assertRange(skills[field], 0, 12, field);
        }
        assertRange(skills.success_count, 0, 999999999, '炼丹成功次数');
        assertRange(toxinValue, 0, 999999, '丹毒');

        const [[race]] = await conn.query(`SELECT race_id FROM race WHERE race_id = ?`, [raceId]);
        const [[characterClass]] = await conn.query(`SELECT class_id FROM class WHERE class_id = ?`, [classId]);
        const [[realm]] = await conn.query(`SELECT realm_id FROM realm WHERE realm_id = ?`, [realmId]);
        if (!race) throw badRequest('所选种族不存在');
        if (!characterClass) throw badRequest('所选职业不存在');
        if (!realm) throw badRequest('所选境界不存在');

        await conn.query(
            `UPDATE \`character\`
                SET character_name = ?, gender = ?, age = ?, race_id = ?, class_id = ?,
                    realm_id = ?, character_description = ?
              WHERE character_id = ?`,
            [name, gender, age, raceId, classId, realmId, description, save.character_id]
        );
        await conn.query(
            `UPDATE game_save
                SET realm_stage = ?, cultivation = ?, spirit_stones = ?, day_count = ?
              WHERE save_id = ?`,
            [realmStage, cultivation, spiritStones, dayCount, SAVE_ID]
        );
        await conn.query(
            `INSERT INTO character_attribute
                (character_id, aptitude, comprehension, metal_root, wood_root, water_root,
                 fire_root, earth_root, max_hp, attack, defense)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                aptitude = VALUES(aptitude),
                comprehension = VALUES(comprehension),
                metal_root = VALUES(metal_root),
                wood_root = VALUES(wood_root),
                water_root = VALUES(water_root),
                fire_root = VALUES(fire_root),
                earth_root = VALUES(earth_root),
                max_hp = VALUES(max_hp),
                attack = VALUES(attack),
                defense = VALUES(defense)`,
            [
                save.character_id,
                attributes.aptitude,
                attributes.comprehension,
                attributes.metal_root,
                attributes.wood_root,
                attributes.water_root,
                attributes.fire_root,
                attributes.earth_root,
                attributes.max_hp,
                attributes.attack,
                attributes.defense,
            ]
        );
        await conn.query(
            `INSERT INTO character_alchemy_skill
                (character_id, alchemy_level, pharmacology_level, fire_control_level, tolerance_level,
                 success_count, best_recipe_level)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                alchemy_level = VALUES(alchemy_level),
                pharmacology_level = VALUES(pharmacology_level),
                fire_control_level = VALUES(fire_control_level),
                tolerance_level = VALUES(tolerance_level),
                success_count = VALUES(success_count),
                best_recipe_level = VALUES(best_recipe_level)`,
            [
                save.character_id,
                skills.alchemy_level,
                skills.pharmacology_level,
                skills.fire_control_level,
                skills.tolerance_level,
                skills.success_count,
                skills.best_recipe_level,
            ]
        );
        await conn.query(
            `INSERT INTO character_drug_toxin (character_id, toxin_value)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE toxin_value = VALUES(toxin_value)`,
            [save.character_id, toxinValue]
        );

        if (Array.isArray(body.talentIds))
        {
            const talentIds = [...new Set(body.talentIds.map((id) => int(id, 0)).filter((id) => id > 0))];
            if (talentIds.length > MAX_TALENTS)
            {
                throw badRequest(`最多只能选择 ${MAX_TALENTS} 个天赋`);
            }
            if (talentIds.length > 0)
            {
                const [talents] = await conn.query(
                    `SELECT talent_id FROM talent WHERE talent_id IN (?)`,
                    [talentIds]
                );
                if (talents.length !== talentIds.length)
                {
                    throw badRequest('天赋列表包含无效项');
                }
            }
            await conn.query(`DELETE FROM character_talent WHERE character_id = ?`, [save.character_id]);
            for (const talentId of talentIds)
            {
                await conn.query(
                    `INSERT INTO character_talent (character_id, talent_id) VALUES (?, ?)`,
                    [save.character_id, talentId]
                );
            }
        }

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

/**
 * @brief 添加, 移除或设置当前角色背包物品数量
 */
router.put('/player/inventory/:itemId', async (req, res, next) =>
{
    const conn = await pool.getConnection();
    try
    {
        const itemId = int(req.params.itemId, 0);
        const mode = String(req.body?.mode || 'add');
        const amount = int(req.body?.amount, 1);
        if (!itemId) throw badRequest('物品 ID 无效');
        if (!['add', 'remove', 'set'].includes(mode)) throw badRequest('库存操作模式无效');
        if (mode !== 'set') assertRange(amount, 1, 9999, '数量');
        if (mode === 'set') assertRange(amount, 0, 999999, '数量');

        await conn.beginTransaction();
        const characterId = await getActiveCharacterId(conn);
        const [[item]] = await conn.query(`SELECT item_id FROM item WHERE item_id = ?`, [itemId]);
        if (!item) throw notFound('物品不存在');
        const [[current]] = await conn.query(
            `SELECT quantity FROM character_inventory
              WHERE character_id = ? AND item_id = ?
              FOR UPDATE`,
            [characterId, itemId]
        );
        const currentQuantity = Number(current?.quantity || 0);
        const nextQuantity =
            mode === 'add'
                ? currentQuantity + amount
                : mode === 'remove'
                    ? Math.max(0, currentQuantity - amount)
                    : amount;

        if (nextQuantity <= 0)
        {
            await conn.query(
                `DELETE FROM character_inventory WHERE character_id = ? AND item_id = ?`,
                [characterId, itemId]
            );
        }
        else
        {
            await conn.query(
                `INSERT INTO character_inventory (character_id, item_id, quantity)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
                [characterId, itemId, nextQuantity]
            );
        }

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

export default router;
