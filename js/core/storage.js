/* ============================================================
   storage.js — persistência local (localStorage) com fallback e merge
   ============================================================ */
(function (global) {
  'use strict';

  const KEY = 'rpgProgressao_v1';
  const DATA_VERSION = 2;
  const MISSION_XP_CEILING = 100;

  function defaultData() {
    return {
      version: DATA_VERSION,
      player: { name: null, avatar: '⚔️', tutorialCompleted: false, setupCompleted: false, theme: 'auto' },

      overall: {
        totalXp: 0,
        level: 1,
        xpConsumed: 0,
        levelUpMonthKey: null,
        levelUpsThisMonth: 0,
        maxLevelReached: 1
      },

      daily: {
        totalXp: 0,
        level: 1,
        pool: MISSION_XP_CEILING,
        goals: [],
        today: { date: null, completedIds: [], appliedXp: 0 },
        history: []
      },

      fitness: {
        totalXp: 0,
        level: 1,
        goalWeight: null,
        completed: false,
        body: { entries: [], lastLogDate: null },
        workout: { idealMinutes: null, weeklyFrequency: null, today: { date: null, minutes: 0 }, sessions: [] }
      },

      studies: {
        totalXp: 0,
        level: 1,
        idealMinutes: null,
        objectives: []
      },

      finance: {
        totalXp: 0,
        level: 1,
        months: {}
      },

      rewards: {
        chestsAvailable: 0,
        chestsOpenedTotal: 0,
        collection: []
      }
    };
  }

  function deepMerge(base, incoming) {
    if (!incoming || typeof incoming !== 'object') return base;
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(incoming).forEach((k) => {
      if (incoming[k] && typeof incoming[k] === 'object' && !Array.isArray(incoming[k]) &&
          base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = deepMerge(base[k], incoming[k]);
      } else {
        out[k] = incoming[k];
      }
    });
    return out;
  }

  function migrateDailyToday(data) {
    const d = data.daily;
    if (!d || !d.today) return;
    const t = d.today;
    if (Array.isArray(t.completedIds)) {
      if (typeof t.appliedXp !== 'number') t.appliedXp = 0;
    } else if (t.completedIds && typeof t.completedIds === 'object') {
      const ids = Object.keys(t.completedIds);
      const sum = Object.values(t.completedIds).reduce((a, b) => a + b, 0);
      t.completedIds = ids;
      t.appliedXp = sum;
    } else {
      t.completedIds = [];
      t.appliedXp = 0;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const fresh = defaultData();
        save(fresh);
        return fresh;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== DATA_VERSION) {
        console.warn('Versão de dados incompatível. Iniciando novo save.');
        const fresh = defaultData();
        save(fresh);
        return fresh;
      }
      // Merge com os valores padrão para garantir campos novos
      const base = defaultData();
      const merged = deepMerge(base, parsed);
      migrateDailyToday(merged);
      return merged;
    } catch (e) {
      console.error('Falha ao carregar dados, iniciando novo save.', e);
      const fresh = defaultData();
      save(fresh);
      return fresh;
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Falha ao salvar dados.', e);
      return false;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
      return true;
    } catch (e) {
      console.error('Falha ao limpar dados.', e);
      return false;
    }
  }

  global.Store = { load, save, clear, defaultData, MISSION_XP_CEILING, DATA_VERSION };
})(window);