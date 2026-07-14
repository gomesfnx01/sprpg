/* ============================================================
   xp.js — motor de experiência e níveis (estilo RPG)

   Curva por missão: para sair do nível N é necessário
   (100 + (N-1)*40) XP acumulados naquele "degrau" (sem limite).

   Nível GERAL: usa a mesma curva, mas só pode subir no máximo
   3 vezes por mês-calendário. O XP total nunca para de contar —
   ele só fica "banco/represado" além do 3º nível do mês, e é
   liberado automaticamente assim que o mês vira.
   ============================================================ */
(function (global) {
  'use strict';

  const MAX_OVERALL_LEVELUPS_PER_MONTH = 3;

  function xpNeededForLevel(level) {
    return 100 + (level - 1) * 40;
  }

  function calcLevel(totalXp) {
    let level = 1;
    let remaining = Math.max(0, Math.floor(totalXp));
    let need = xpNeededForLevel(level);
    while (remaining >= need) {
      remaining -= need;
      level += 1;
      need = xpNeededForLevel(level);
    }
    return { level: level, currentXp: remaining, neededXp: need, totalXp: totalXp };
  }

  function ensureOverallMonthReset(state) {
    const ov = state.overall;
    const mk = Utils.currentMonthKey();
    if (ov.levelUpMonthKey !== mk) {
      ov.levelUpMonthKey = mk;
      ov.levelUpsThisMonth = 0;
    }
  }

  // Tenta "gastar" o XP represado em subidas de nível geral, respeitando o
  // limite mensal. Não adiciona XP nenhum — só processa o que já existe.
  function settleOverall(state) {
    ensureOverallMonthReset(state);
    const ov = state.overall;
    let levelsGained = 0;
    while (ov.levelUpsThisMonth < MAX_OVERALL_LEVELUPS_PER_MONTH) {
      const need = xpNeededForLevel(ov.level);
      if ((ov.totalXp - ov.xpConsumed) >= need) {
        ov.xpConsumed += need;
        ov.level += 1;
        ov.levelUpsThisMonth += 1;
        levelsGained += 1;
      } else {
        break;
      }
    }
    return { leveledUp: levelsGained > 0, newLevel: ov.level, levelsGained: levelsGained };
  }

  // Progresso "efetivo" pra exibir na barra de XP geral, considerando o teto mensal.
  function calcOverallProgress(state) {
    const ov = state.overall;
    const need = xpNeededForLevel(ov.level);
    const raw = ov.totalXp - ov.xpConsumed;
    const capped = ov.levelUpsThisMonth >= MAX_OVERALL_LEVELUPS_PER_MONTH && raw >= need;
    return {
      level: ov.level,
      currentXp: Math.min(raw, need),
      neededXp: need,
      capped: capped,
      levelUpsThisMonth: ov.levelUpsThisMonth,
      maxLevelUpsPerMonth: MAX_OVERALL_LEVELUPS_PER_MONTH
    };
  }

  // Aplica um delta (positivo OU negativo) de XP a um módulo + ao total geral.
  // Usado pelas Quests pra conceder/retirar XP instantaneamente ao marcar/desmarcar.
  function applyDelta(state, moduleKey, delta) {
    if (!delta) {
      return {
        moduleLeveledUp: false, moduleLeveledDown: false, moduleNewLevel: state[moduleKey].level,
        overallLeveledUp: false, overallLeveledDown: false, overallNewLevel: state.overall.level,
        amount: 0
      };
    }
    const mod = state[moduleKey];
    const beforeModLevel = calcLevel(mod.totalXp).level;
    mod.totalXp = Math.max(0, mod.totalXp + delta);
    const afterMod = calcLevel(mod.totalXp);
    mod.level = afterMod.level;

    state.overall.totalXp = Math.max(0, state.overall.totalXp + delta);
    let overallLeveledUp = false;
    let overallLeveledDown = false;
    let overallLevelsGained = 0;
    if (delta > 0) {
      const res = settleOverall(state);
      overallLeveledUp = res.leveledUp;
      overallLevelsGained = res.levelsGained;
    } else {
      const ov = state.overall;
      while (ov.level > 1 && ov.xpConsumed > ov.totalXp) {
        ov.level -= 1;
        ov.xpConsumed -= xpNeededForLevel(ov.level);
        if (ov.levelUpsThisMonth > 0) ov.levelUpsThisMonth -= 1;
        overallLeveledDown = true;
      }
    }

    return {
      moduleLeveledUp: afterMod.level > beforeModLevel,
      moduleLeveledDown: afterMod.level < beforeModLevel,
      moduleNewLevel: afterMod.level,
      overallLeveledUp: overallLeveledUp,
      overallLeveledDown: overallLeveledDown,
      overallLevelsGained: overallLevelsGained,
      overallNewLevel: state.overall.level,
      amount: delta
    };
  }

  // Aplica XP a um módulo de missão (daily/fitness/studies/finance) + ao total geral.
  function applyXp(state, moduleKey, amount) {
    if (!amount || amount <= 0) {
      return {
        moduleLeveledUp: false,
        moduleNewLevel: state[moduleKey].level,
        overallLeveledUp: false,
        overallNewLevel: state.overall.level,
        amount: 0
      };
    }
    return applyDelta(state, moduleKey, amount);
  }

  global.XP = {
    xpNeededForLevel, calcLevel, applyXp, applyDelta,
    settleOverall, calcOverallProgress, ensureOverallMonthReset,
    MAX_OVERALL_LEVELUPS_PER_MONTH
  };
})(window);
