/* ================================================================
   js/qx_type_label.js   v3
   日期：2026-10-08
   说明：
   - 身份字典唯一真相，从 emobao_usertype 读库
   - 全局缓存，只读一次
   - 其他模块（qx0_main.js / qx6_settings.js / qx5_profile.js）统一调这里
   - v3 修正：
     · 主键字段名改正：usertypekey → typekeyno（对库实测）
     · 其余字段名确认：typename_cn / typename_en / sortorder / isactive
   - v2 容错：
     · 读库失败 → 用内联 FALLBACK，不抛错
     · 并发 load() 只发一次请求
     · 提供 ready() / waitFor() 供外部等加载
   API：
     qxTypeLabel.load()       -> Promise<map>         读库或兜底，永不 reject
     qxTypeLabel.ready()      -> Promise<bool>        等第一轮加载完成
     qxTypeLabel.waitFor(ms)  -> Promise<bool>        等“字典可用”，超时返回 false
     qxTypeLabel.get(ut)      -> string               按当前语言返回身份名
     qxTypeLabel.getRaw(ut)   -> { cn, en, sortorder, isactive } | null
     qxTypeLabel.getMap()     -> { 1: {...}, ... }
     qxTypeLabel.has(ut)      -> bool
     qxTypeLabel.isLoaded()   -> bool
     qxTypeLabel.source()     -> 'db' | 'fallback' | 'none'
   字段约定（emobao_usertype）：
     typekeyno / typename_cn / typename_en / sortorder / isactive
   ================================================================ */

   (function () {
    'use strict';

    const SUPABASE_URL = 'https://api.emobao.com';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';

    const FETCH_TIMEOUT_MS = 8000;

    /* 兜底字典：字段名与库一致，仅在读库失败时使用
       注意：这里的名字应与库里的真实名字保持一致 */
    const FALLBACK = Object.freeze({
        1:  { cn: '普通用户',  en: 'Normal User',   sortorder: 1 },
        2:  { cn: 'VIP',      en: 'VIP',           sortorder: 2 },
        3:  { cn: 'VIP',      en: 'VIP',           sortorder: 3 },
        4:  { cn: 'VIP',      en: 'VIP',           sortorder: 4 },
        5:  { cn: 'VIP',      en: 'VIP',           sortorder: 5 },
        6:  { cn: '家庭',     en: 'Family',        sortorder: 6 },
        7:  { cn: '辅导员',   en: 'Counselor',     sortorder: 7 },
        8:  { cn: '音乐管理', en: 'Music Admin',   sortorder: 8 },
        9:  { cn: '系统管理', en: 'System Admin',  sortorder: 9 },
        10: { cn: '财务',     en: 'Finance',       sortorder: 10 },
        11: { cn: '企业',     en: 'Enterprise',    sortorder: 11 },
        12: { cn: '学生',     en: 'Student',       sortorder: 12 },
        13: { cn: '待用身份', en: 'Reserved',      sortorder: 13 },
        14: { cn: '访客',     en: 'Guest',         sortorder: 14 },
    });

    let MAP = null;
    let LOADED = false;
    let LOADING = null;
    let SOURCE = 'none';     // 'db' | 'fallback' | 'none'

    function getLang() {
        return (window.mQxb && window.mQxb.Language) || 1;
    }

    async function fetchWithTimeout(url, headers, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs || FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(url, {
                headers: headers,
                cache: 'no-store',
                signal: controller.signal,
            });
            clearTimeout(timer);
            return res;
        } catch (e) {
            clearTimeout(timer);
            throw e;
        }
    }

    async function fetchFromDb() {
        /* 修正：主键字段名 typekeyno（非 usertypekey） */
        const url = `${SUPABASE_URL}/rest/v1/emobao_usertype` +
                    `?isactive=eq.true` +
                    `&select=typekeyno,typename_cn,typename_en,sortorder,isactive` +
                    `&order=sortorder.asc`;
        const res = await fetchWithTimeout(url, {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
        }, FETCH_TIMEOUT_MS);
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`REST emobao_usertype: ${res.status} ${txt}`);
        }
        return res.json();
    }

    function normalize(rows) {
        const map = {};
        (rows || []).forEach(r => {
            /* 修正：主键字段名 typekeyno */
            const k = parseInt(r.typekeyno);
            if (isNaN(k)) return;
            map[k] = {
                cn: r.typename_cn || '',
                en: r.typename_en || '',
                sortorder: r.sortorder || 0,
                isactive: r.isactive !== false,
            };
        });
        return map;
    }

    /* 读库或兜底，永不 reject */
    async function load() {
        if (LOADED && MAP) return MAP;
        if (LOADING) return LOADING;

        LOADING = (async () => {
            try {
                const rows = await fetchFromDb();
                const map = normalize(rows);
                if (Object.keys(map).length > 0) {
                    MAP = map;
                    SOURCE = 'db';
                    console.log('[qxTypeLabel] 已从 emobao_usertype 加载', Object.keys(MAP).length, '条');
                } else {
                    console.warn('[qxTypeLabel] emobao_usertype 为空，使用兜底字典');
                    MAP = FALLBACK;
                    SOURCE = 'fallback';
                }
            } catch (e) {
                console.error('[qxTypeLabel] 读库失败，使用兜底字典', e);
                MAP = FALLBACK;
                SOURCE = 'fallback';
            }
            LOADED = true;
            LOADING = null;
            return MAP;
        })();

        return LOADING;
    }

    function ready() {
        if (LOADED) return Promise.resolve(true);
        return load().then(() => true).catch(() => false);
    }

    /* 等“字典可用”，最多等 ms 毫秒；超时返回 false */
    function waitFor(ms) {
        const timeout = (ms == null) ? 3000 : ms;
        if (LOADED && MAP) return Promise.resolve(true);

        return new Promise((resolve) => {
            let done = false;
            const finish = (ok) => {
                if (done) return;
                done = true;
                resolve(ok);
            };
            const t = setTimeout(() => finish(LOADED && !!MAP), timeout);
            ready().then(() => {
                clearTimeout(t);
                finish(LOADED && !!MAP);
            }).catch(() => {
                clearTimeout(t);
                finish(false);
            });
        });
    }

    function getMap() {
        return MAP || FALLBACK;
    }

    function getRaw(ut) {
        const k = parseInt(ut);
        if (isNaN(k)) return null;
        const map = getMap();
        return map[k] || null;
    }

    function has(ut) {
        const k = parseInt(ut);
        if (isNaN(k)) return false;
        return !!getMap()[k];
    }

    function get(ut) {
        const k = parseInt(ut);
        const raw = getRaw(k);
        if (raw) {
            return getLang() === 1 ? raw.cn : raw.en;
        }
        const fb = FALLBACK[k] || FALLBACK[1];
        return getLang() === 1 ? fb.cn : fb.en;
    }

    function isLoaded() {
        return LOADED;
    }

    function source() {
        return SOURCE;
    }

    window.qxTypeLabel = {
        load: load,
        ready: ready,
        waitFor: waitFor,
        get: get,
        getRaw: getRaw,
        getMap: getMap,
        has: has,
        isLoaded: isLoaded,
        source: source,
        FALLBACK: FALLBACK,
    };

    console.log('[qxTypeLabel] 模块已注册（v3, typekeyno）');
})();