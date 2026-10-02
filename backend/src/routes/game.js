import express from 'express';
import { pool } from '../db.js';

const router = express.Router();
const SAVE_ID = 1;

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

async function getState()
{
    const [[save]] = await pool.query(
        `SELECT gs.save_id, gs.character_id, gs.realm_stage, gs.cultivation,
                gs.spirit_stones, gs.day_count,
                c.character_name, c.age, c.gender, c.class_id,
                cl.class_name, r.realm_id, r.realm_name, r.realm_level, r.realm_world,
                ca.aptitude, ca.comprehension, ca.max_hp, ca.attack, ca.defense,
                sm.member_name, s.sect_name
           FROM game_save gs
           JOIN \`character\` c ON c.character_id = gs.character_id
           JOIN realm r ON r.realm_id = c.realm_id
           LEFT JOIN class cl ON cl.class_id = c.class_id
           LEFT JOIN character_attribute ca ON ca.character_id = c.character_id
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
        `SELECT ci.item_id, ci.quantity, i.item_name, i.item_code, i.level,
                h.main_effect, h.secondary_effect, h.guide_effect,
                p.pill_category, p.effect_type, p.base_effect,
                p.breakthrough_bonus, p.toxicity, p.buff_code
           FROM character_inventory ci
           JOIN item i ON i.item_id = ci.item_id
           LEFT JOIN herb h ON h.item_id = ci.item_id
           LEFT JOIN pill p ON p.item_id = ci.item_id
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

    const threshold = cultivationRequired(Number(save.realm_level), Number(save.realm_stage));
    const cultivationBonus = maxBuffValue(buffs, 'CULTIVATION_UP');
    const breakthroughBonus = maxBuffValue(buffs, 'BREAKTHROUGH_BONUS');
    return {
        hasSave: true,
        character: {
            characterId: Number(save.character_id),
            name: save.character_name,
            age: Number(save.age || 16),
            className: save.class_name || '散修',
            sectName: save.sect_name || '无门无派',
            realm: save.realm_name,
            realmId: Number(save.realm_id),
            realmLevel: Number(save.realm_level),
            realmWorld: Number(save.realm_world),
            stage: Number(save.realm_stage),
            aptitude: Number(save.aptitude || 10),
            comprehension: Number(save.comprehension || 10),
            maxHp: Number(save.max_hp || 100),
            attack: Number(save.attack || 10),
            defense: Number(save.defense || 10),
        },
        cultivation: Number(save.cultivation),
        cultivationRequired: threshold,
        cultivationPerDay: Math.round(baseCultivationPerDay(save.aptitude) * (1 + cultivationBonus / 100)),
        breakthroughChance: Math.round(breakthroughChance(save.aptitude, save.comprehension, breakthroughBonus) * 10) / 10,
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

router.post('/start', async (req, res, next) =>
{
    const conn = await pool.getConnection();
    try
    {
        const name = String(req.body?.name || '').trim();
        if (name.length < 1 || name.length > 16)
        {
            throw badRequest('道号长度需要在 1 到 16 个字符之间');
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

        const [characterResult] = await conn.query(
            `INSERT INTO \`character\`
                (character_name, gender, age, race_id, race_subsp_id, class_id, realm_id, character_description)
             VALUES (?, 1, 16, 1, 1, 3, 1, '初入修仙之路的玩家修士')`,
            [name]
        );
        const characterId = Number(characterResult.insertId);
        await conn.query(
            `INSERT INTO character_attribute
                (character_id, aptitude, comprehension, metal_root, wood_root, water_root,
                 fire_root, earth_root, max_hp, attack, defense)
             VALUES (?, 16, 14, 20, 20, 20, 20, 20, 100, 10, 10)`,
            [characterId]
        );
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

        await recordEvent(conn, 'start', '踏入仙途', `${name}在青岚山醒来，身边只有几味草药与一尊旧丹炉`);
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
            `SELECT gs.*, r.realm_level, ca.aptitude
               FROM game_save gs
               JOIN \`character\` c ON c.character_id = gs.character_id
               JOIN realm r ON r.realm_id = c.realm_id
               JOIN character_attribute ca ON ca.character_id = c.character_id
              WHERE gs.save_id = ? FOR UPDATE`,
            [SAVE_ID]
        );
        if (!save) throw notFound('尚未创建修行存档');

        const [buffs] = await conn.query(
            `SELECT MAX(buff_value) AS cultivation_bonus
               FROM character_buff
              WHERE character_id = ? AND buff_code = 'CULTIVATION_UP' AND status = 1
                AND (expires_at IS NULL OR expires_at > NOW())`,
            [save.character_id]
        );
        const bonus = Number(buffs[0]?.cultivation_bonus || 0);
        const gained = Math.round(baseCultivationPerDay(save.aptitude) * (1 + bonus / 100));
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
            `SELECT gs.*, r.realm_id, r.realm_name, r.realm_level, r.realm_world,
                    ca.aptitude, ca.comprehension
               FROM game_save gs
               JOIN \`character\` c ON c.character_id = gs.character_id
               JOIN realm r ON r.realm_id = c.realm_id
               JOIN character_attribute ca ON ca.character_id = c.character_id
              WHERE gs.save_id = ? FOR UPDATE`,
            [SAVE_ID]
        );
        if (!save) throw notFound('尚未创建修行存档');

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
        const chance = breakthroughChance(save.aptitude, save.comprehension, buffRows[0]?.breakthrough_bonus);
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
