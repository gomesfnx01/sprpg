/* ============================================================
   app.js — controlador principal da aplicação
   ============================================================ */
(function (global) {
  'use strict';

  const App = {
    state: null,
    _ambianceTimer: null,

    // ------------------------------------------------------------
    // INICIALIZAÇÃO
    // ------------------------------------------------------------
    init() {
      this.state = Store.load();
      // Garante campos novos
      const defaults = Store.defaultData();
      if (!this.state.player) this.state.player = defaults.player;
      if (!this.state.overall) this.state.overall = defaults.overall;
      if (!this.state.daily) this.state.daily = defaults.daily;
      if (!this.state.fitness) this.state.fitness = defaults.fitness;
      if (!this.state.studies) this.state.studies = defaults.studies;
      if (!this.state.finance) this.state.finance = defaults.finance;
      if (!this.state.rewards) this.state.rewards = defaults.rewards;
      if (!this.state.player.avatar) this.state.player.avatar = '⚔️';
      if (!this.state.player.theme) this.state.player.theme = 'auto';
      if (!this.state.overall.maxLevelReached || this.state.overall.maxLevelReached < this.state.overall.level) {
        this.state.overall.maxLevelReached = this.state.overall.level;
      }

      this.rolloverDailyIfNeeded();
      const financeResult = this.rolloverFinanceIfNeeded();
      const overallSettle = XP.settleOverall(this.state);
      this.grantChests(overallSettle.levelsGained + (financeResult ? financeResult.overallLevelsGained : 0));

      const dailyCorrection = this.reconcileDailyToday(true);

      this.persist();
      this.renderAll();
      this.wireNav();
      this.wireIntroFlow();
      this.wireDangerZone();
      this.wireSwipeGestures();
      this.wireSoundEffects();
      this.applyTimeOfDayAmbiance();
      this.startAmbianceUpdater();

      // Tema e personalização
      this.loadTheme();
      this.wireThemePicker();
      this.wireBackup();

      // Popups iniciais
      const popups = [];
      if (dailyCorrection && dailyCorrection.delta !== 0) {
        const sign = dailyCorrection.delta > 0 ? '+' : '';
        popups.push(() => UI.toast('XP de hoje em Quests ajustado: ' + sign + dailyCorrection.delta + ' XP (nunca passa do teto diário)', 'info'));
      }
      if (financeResult && financeResult.settledCount > 0) {
        popups.push(() => UI.toast('Tesouro: fechamento de ' + financeResult.settledCount + ' mês(es) processado', 'xp'));
        if (financeResult.leveledUp) popups.push(() => UI.showLevelUp('Tesouro', financeResult.newLevel));
      }
      if (overallSettle.leveledUp || (financeResult && financeResult.overallLeveledUp)) {
        popups.push(() => UI.showLevelUp('Aventureiro (Geral)', this.state.overall.level));
      }
      popups.forEach((fn, i) => setTimeout(fn, 900 + i * 1000));
    },

    persist() {
      Store.save(this.state);
    },

    // ------------------------------------------------------------
    // SISTEMA DE XP E NÍVEL
    // ------------------------------------------------------------
    applyXp(moduleKey, amount, label) {
      const res = XP.applyXp(this.state, moduleKey, amount);
      this.persist();
      this.updateHeaderPlayer();
      this.renderHub();
      this.grantChests(res.overallLevelsGained);
      if (amount > 0) {
        UI.toast('+' + amount + ' XP — ' + label, 'xp');
        this.vibrate(30);
      }
      if (res.moduleLeveledUp) {
        UI.showLevelUp(label, res.moduleNewLevel);
        this.vibrate([50, 50, 50]);
      }
      if (res.overallLeveledUp) {
        setTimeout(() => UI.showLevelUp('Aventureiro (Geral)', res.overallNewLevel),
          res.moduleLeveledUp ? 1000 : 0);
      }
      return res;
    },

    applyXpDelta(moduleKey, delta, label) {
      const oldOverallLevel = this.state.overall.level;
      const res = XP.applyDelta(this.state, moduleKey, delta);

      if (this.state.overall.level < oldOverallLevel) {
        const lostLevels = oldOverallLevel - this.state.overall.level;
        const ov = this.state.overall;
        this.state.rewards.chestsAvailable = Math.max(0, this.state.rewards.chestsAvailable - lostLevels);
        ov.maxLevelReached = this.state.overall.level;
        this.persist();
        this.updateRewardsBadge();
        if (global.Rewards) Rewards.render();
      }

      this.persist();
      this.updateHeaderPlayer();
      this.renderHub();
      this.grantChests(res.overallLevelsGained);

      if (delta > 0) {
        UI.toast('+' + delta + ' XP — ' + label, 'xp');
        this.vibrate(30);
        if (res.moduleLeveledUp) UI.showLevelUp(label, res.moduleNewLevel);
        if (res.overallLeveledUp) {
          setTimeout(() => UI.showLevelUp('Aventureiro (Geral)', res.overallNewLevel), res.moduleLeveledUp ? 1000 : 0);
        }
      } else if (delta < 0) {
        UI.toast(delta + ' XP — ' + label, 'info');
        this.vibrate(15);
      }
      return res;
    },

    grantChests(count) {
      if (!count || count <= 0) return;
      const ov = this.state.overall;
      const newMax = Math.max(ov.maxLevelReached, ov.level);
      const gained = newMax - ov.maxLevelReached;
      if (gained > 0) {
        this.state.rewards.chestsAvailable += gained;
        ov.maxLevelReached = newMax;
        this.persist();
        this.updateRewardsBadge();
        if (global.Rewards) Rewards.render();
        this.vibrate(40);
      }
    },

    // ------------------------------------------------------------
    // QUESTS (Daily)
    // ------------------------------------------------------------
    reconcileDailyToday(silent) {
      const s = this.state.daily;
      if (!s.today) return { delta: 0, correctTotal: 0 };

      s.today.completedIds = s.today.completedIds.filter((id) => s.goals.some((g) => g.id === id));

      const weekend = Utils.isWeekendStr(s.today.date);
      const goalsCount = s.goals.length;
      const xpPerGoal = (!weekend && goalsCount > 0) ? (s.pool / goalsCount) : 0;
      const correctTotal = (!weekend && goalsCount > 0)
        ? Math.min(s.pool, Math.round(xpPerGoal * s.today.completedIds.length))
        : 0;
      const delta = correctTotal - (s.today.appliedXp || 0);

      if (delta !== 0) {
        if (silent) {
          XP.applyDelta(this.state, 'daily', delta);
          this.persist();
        } else {
          this.applyXpDelta('daily', delta, 'Quests');
        }
      }
      s.today.appliedXp = correctTotal;
      return { delta: delta, correctTotal: correctTotal };
    },

    rolloverDailyIfNeeded() {
      const d = this.state.daily;
      const today = Utils.todayStr();

      if (!d.today || !d.today.date) {
        d.today = { date: today, completedIds: [], appliedXp: 0 };
        return;
      }
      if (d.today.date === today) return;

      this.commitDailyDayHistory(d.today.date, d.today.completedIds.length, d.today.appliedXp, d.goals.length);
      let cursor = Utils.addDaysToStr(d.today.date, 1);
      while (cursor < today) {
        this.commitDailyDayHistory(cursor, 0, 0, d.goals.length);
        cursor = Utils.addDaysToStr(cursor, 1);
      }
      d.today = { date: today, completedIds: [], appliedXp: 0 };
    },

    commitDailyDayHistory(dateStr, completedCount, xpEarned, goalsCount) {
      const d = this.state.daily;
      const weekend = Utils.isWeekendStr(dateStr);
      d.history.unshift({
        date: dateStr,
        xpEarned: weekend ? 0 : xpEarned,
        completedCount: weekend ? 0 : completedCount,
        totalGoals: weekend ? 0 : goalsCount,
        weekend: weekend
      });
      if (d.history.length > 120) d.history.length = 120;
    },

    // ------------------------------------------------------------
    // FINANCEIRO
    // ------------------------------------------------------------
    rolloverFinanceIfNeeded() {
      const fin = this.state.finance;
      const currentKey = Utils.currentMonthKey();
      const tracker = { settledCount: 0, leveledUp: false, newLevel: fin.level, overallLeveledUp: false, overallLevelsGained: 0 };
      Object.keys(fin.months).sort().forEach((key) => {
        const rec = fin.months[key];
        if (key === currentKey || rec.settled || rec.salary == null) return;
        const totalDebts = rec.fixedDebts.reduce((s, d) => s + d.value, 0);
        const totalExpenses = rec.expenses.reduce((s, e) => s + e.value, 0);
        const budget = rec.salary - totalDebts;
        let xp = 0;
        if (budget > 0) {
          const ratio = Math.max(0, Math.min(1, (budget - totalExpenses) / budget));
          xp = Math.round(ratio * Store.MISSION_XP_CEILING);
        }
        rec.settled = true;
        rec.settledXp = xp;
        if (xp > 0) {
          const res = XP.applyXp(this.state, 'finance', xp);
          tracker.settledCount += 1;
          if (res.moduleLeveledUp) { tracker.leveledUp = true; tracker.newLevel = res.moduleNewLevel; }
          if (res.overallLeveledUp) tracker.overallLeveledUp = true;
          tracker.overallLevelsGained += (res.overallLevelsGained || 0);
        } else {
          tracker.settledCount += 1;
        }
      });
      return tracker;
    },

    // ------------------------------------------------------------
    // RENDERIZAÇÃO PRINCIPAL E HUB
    // ------------------------------------------------------------
    renderAll() {
      Daily.render();
      Fitness.render();
      Studies.render();
      Finance.render();
      Rewards.render();
      this.renderHub();
      this.updateHeaderPlayer();
      this.updateRewardsBadge();
    },

    updateHeaderPlayer() {
      const el = document.getElementById('header-player');
      if (!el) return;
      const name = this.state.player.name || 'Aventureiro(a)';
      const avatar = this.state.player.avatar || '⚔️';
      const prog = XP.calcOverallProgress(this.state);
      el.textContent = avatar + ' ' + name + ' · Nível ' + prog.level;
    },

    NAMED_RANK_TIERS: [
      { label: 'Ferro', color: '#3a3a3a', glow: 'rgba(58,58,58,0.55)' },
      { label: 'Bronze', color: '#b06b2e', glow: 'rgba(176,107,46,0.55)' },
      { label: 'Prata', color: '#c7c9d1', glow: 'rgba(199,201,209,0.55)' },
      { label: 'Ouro', color: '#f0c674', glow: 'rgba(240,198,116,0.65)' },
      { label: 'Platina', color: '#dfe7e8', glow: 'rgba(223,231,232,0.6)' },
      { label: 'Esmeralda', color: '#2ecc71', glow: 'rgba(46,204,113,0.6)' },
      { label: 'Safira', color: '#3b82c4', glow: 'rgba(59,130,196,0.6)' },
      { label: 'Rubi', color: '#e0304f', glow: 'rgba(224,48,79,0.6)' },
      { label: 'Ametista', color: '#9b59d0', glow: 'rgba(155,89,208,0.6)' },
      { label: 'Diamante', color: '#7fdbff', glow: 'rgba(127,219,255,0.6)' },
      { label: 'Ônix', color: '#4b4b6b', glow: 'rgba(75,75,107,0.6)' },
      { label: 'Mítico', color: '#ff6b9d', glow: 'rgba(255,107,157,0.65)' }
    ],

    computeRank(level) {
      const tiers = this.NAMED_RANK_TIERS;
      const step = Math.floor((level - 1) / 3);
      const ringCount = ((level - 1) % 3) + 1;
      if (step < tiers.length) {
        const t = tiers[step];
        return { color: t.color, glow: t.glow, label: t.label, ringCount: ringCount, legendary: false };
      }
      const beyond = step - tiers.length;
      const hue = Math.round((beyond * 137.508) % 360);
      return {
        color: 'hsl(' + hue + ' 70% 62%)',
        glow: 'hsl(' + hue + ' 70% 62% / 0.6)',
        label: 'Ascendente ' + (beyond + 1),
        ringCount: ringCount,
        legendary: true
      };
    },

    updateRankBadge(level) {
      const badge = document.getElementById('hub-rank-badge');
      const label = document.getElementById('hub-rank-label');
      if (!badge) return;
      const rank = this.computeRank(level);
      const romans = ['I', 'II', 'III'];

      badge.style.setProperty('--rank-color', rank.color);
      badge.style.setProperty('--rank-glow', rank.glow);
      badge.classList.toggle('rank-legendary', rank.legendary);

      [1, 2, 3].forEach((n) => {
        const ring = badge.querySelector('.rank-ring-' + n);
        if (ring) ring.classList.toggle('active', n <= rank.ringCount);
      });

      if (label) {
        label.textContent = 'Patente: ' + rank.label + ' ' + romans[rank.ringCount - 1] + (rank.legendary ? ' ✦' : '');
      }
    },

    renderHub() {
      const s = this.state;
      const prog = XP.calcOverallProgress(s);
      document.getElementById('hub-overall-level').textContent = prog.level;
      document.getElementById('hub-hero-name').textContent = s.player.name || 'Aventureiro(a)';
      document.getElementById('hub-overall-xpbar').innerHTML = UI.xpBarHTML(prog.currentXp, prog.neededXp);
      this.updateRankBadge(prog.level);

      const capNote = document.getElementById('hub-cap-note');
      if (capNote) {
        if (prog.capped) {
          capNote.style.display = '';
          capNote.textContent = '⏳ Limite de ' + prog.maxLevelUpsPerMonth + ' subidas de nível geral neste mês atingido — o restante libera no mês que vem.';
        } else {
          capNote.style.display = 'none';
          capNote.textContent = '';
        }
      }

      const cards = [
        { key: 'daily', label: 'Quests', icon: '📜' },
        { key: 'fitness', label: 'Vigor', icon: '💪' },
        { key: 'studies', label: 'Inteligência', icon: '🧠' },
        { key: 'finance', label: 'Tesouro', icon: '💰' }
      ];
      const wrap = document.getElementById('hub-cards');
      wrap.innerHTML = cards.map((c) => {
        const mod = s[c.key];
        const lv = XP.calcLevel(mod.totalXp);
        return (
          '<button class="quest-card navbtn" data-screen="screen-' + c.key + '">' +
          '<div class="quest-card-icon">' + c.icon + '</div>' +
          '<div class="quest-card-body">' +
          '<div class="quest-card-title">' + c.label + '</div>' +
          UI.xpBarHTML(lv.currentXp, lv.neededXp, 'xpbar-mini') +
          '</div>' +
          UI.levelBadgeHTML(lv.level) +
          '</button>'
        );
      }).join('');
      wrap.querySelectorAll('.navbtn').forEach((btn) => {
        btn.addEventListener('click', () => UI.switchScreen(btn.dataset.screen));
      });

      const chestBanner = document.getElementById('hub-chest-banner');
      if (chestBanner) {
        const count = s.rewards.chestsAvailable;
        if (count > 0) {
          chestBanner.style.display = '';
          chestBanner.innerHTML =
            '<button class="chest-banner-btn" data-screen="screen-rewards">' +
            '<span class="chest-banner-icon">🎁</span>' +
            '<span>Você tem <strong>' + count + '</strong> baú' + (count > 1 ? 's' : '') + ' esperando! Toque para abrir.</span>' +
            '</button>';
          chestBanner.querySelector('.chest-banner-btn').addEventListener('click', (e) => UI.switchScreen(e.currentTarget.dataset.screen));
        } else {
          chestBanner.style.display = 'none';
          chestBanner.innerHTML = '';
        }
      }
    },

    updateRewardsBadge() {
      const btn = document.getElementById('nav-rewards-btn');
      if (!btn) return;
      const count = this.state.rewards.chestsAvailable;
      let dot = btn.querySelector('.nav-badge');
      if (count > 0) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'nav-badge';
          btn.appendChild(dot);
        }
        dot.textContent = count;
      } else if (dot) {
        dot.remove();
      }
    },

    // ------------------------------------------------------------
    // NAVEGAÇÃO E GESTOS
    // ------------------------------------------------------------
    wireNav() {
      document.querySelectorAll('.navbtn[data-screen]').forEach((btn) => {
        btn.addEventListener('click', () => UI.switchScreen(btn.dataset.screen));
      });
      const last = localStorage.getItem('rpgProgressao_lastScreen') || 'screen-hub';
      UI.switchScreen(document.getElementById(last) ? last : 'screen-hub');
    },

    SCREEN_ORDER: ['screen-hub', 'screen-daily', 'screen-fitness', 'screen-studies', 'screen-finance', 'screen-rewards'],

    wireSwipeGestures() {
      const main = document.getElementById('app-main');
      if (!main) return;
      let startX = 0, startY = 0, tracking = false;
      const THRESHOLD = 60;
      const RATIO = 1.4;

      main.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) { tracking = false; return; }
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
      }, { passive: true });

      main.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * RATIO) return;

        const order = this.SCREEN_ORDER;
        const current = order.find((id) => {
          const el = document.getElementById(id);
          return el && el.classList.contains('active');
        });
        let idx = order.indexOf(current);
        if (idx === -1) return;
        if (dx < 0 && idx < order.length - 1) idx += 1;
        else if (dx > 0 && idx > 0) idx -= 1;
        else return;
        UI.switchScreen(order[idx]);
      }, { passive: true });
    },

    // ------------------------------------------------------------
    // FLUXO DE INTRODUÇÃO (Splash, Nome, Setup, Tutorial)
    // ------------------------------------------------------------
    wireIntroFlow() {
      const splash = document.getElementById('splash');
      const nameScreen = document.getElementById('name-screen');
      const welcomeScreen = document.getElementById('welcome-screen');
      if (!splash) return;

      const revealApp = () => {
        document.getElementById('app-shell').classList.remove('pre-intro');
      };

      const showWelcome = () => {
        document.getElementById('welcome-name').textContent = this.state.player.name || 'Aventureiro(a)';
        welcomeScreen.classList.add('visible');
        let dismissed = false;
        const dismiss = () => {
          if (dismissed) return;
          dismissed = true;
          this.dismissOverlay(welcomeScreen, () => {
            this.showSetupOrTutorial(revealApp);
          });
        };
        welcomeScreen.addEventListener('click', dismiss, { once: true });
        setTimeout(dismiss, 2400);
      };

      this.showSetupOrTutorial = (revealAppCallback) => {
        if (this.state.player.setupCompleted) {
          if (this.state.player.tutorialCompleted) {
            revealAppCallback();
            return;
          }
          this.startTutorial(revealAppCallback);
          return;
        }
        this.showSetupScreen(revealAppCallback);
      };

      this.showSetupScreen = (revealAppCallback) => {
        const setupScreen = document.getElementById('setup-screen');
        if (!setupScreen) {
          this.startTutorial(revealAppCallback);
          return;
        }
        setupScreen.classList.add('visible');

        const form = document.getElementById('setup-form');
        const skipBtn = document.getElementById('setup-skip');

        // ---- Lógica do avatar ----
        const avatarOptions = document.querySelectorAll('.avatar-option');
        avatarOptions.forEach((btn) => {
          btn.addEventListener('click', () => {
            avatarOptions.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
          });
        });
        // Seleciona o primeiro por padrão
        if (avatarOptions.length > 0 && !document.querySelector('.avatar-option.selected')) {
          avatarOptions[0].classList.add('selected');
        }

        const finishSetup = () => {
          setupScreen.classList.remove('visible');
          setupScreen.classList.add('overlay-hide');
          setTimeout(() => {
            setupScreen.remove();
            this.state.player.setupCompleted = true;
            this.persist();
            this.startTutorial(revealAppCallback);
          }, 300);
        };

        form.addEventListener('submit', (e) => {
          e.preventDefault();

          // Captura avatar
          const selectedAvatar = document.querySelector('.avatar-option.selected');
          if (selectedAvatar) {
            this.state.player.avatar = selectedAvatar.dataset.avatar;
          }

          // Captura demais campos
          const weight = parseFloat(document.getElementById('setup-weight').value);
          const studyMinutes = parseInt(document.getElementById('setup-study-minutes').value, 10);
          const salary = parseFloat(document.getElementById('setup-salary').value);

          if (weight && weight > 0) {
            this.state.fitness.goalWeight = weight;
          }
          if (studyMinutes && studyMinutes > 0) {
            this.state.studies.idealMinutes = studyMinutes;
          }
          if (salary && salary >= 0) {
            const monthKey = Utils.currentMonthKey();
            if (!this.state.finance.months[monthKey]) {
              this.state.finance.months[monthKey] = { salary: null, fixedDebts: [], expenses: [], settled: false, settledXp: null };
            }
            this.state.finance.months[monthKey].salary = salary;
          }
          this.persist();
          finishSetup();
        });

        skipBtn.addEventListener('click', finishSetup);
      };

      this.startTutorial = (revealAppCallback) => {
        const screen = document.getElementById('tutorial-screen');
        if (!screen) {
          revealAppCallback();
          return;
        }

        const steps = [
          {
            icon: '⚔️',
            title: 'Bem-vindo, Aventureiro(a)!',
            text: 'Este é o Sistema Pessoal RPG. Aqui você transforma suas metas diárias em missões, ganha XP e sobe de nível como em um jogo. Vamos te mostrar como funciona!'
          },
          {
            icon: '📜',
            title: 'Missão: Quests',
            text: 'Crie metas diárias (ex.: "Beber 2L de água"). Ao concluir cada uma, você ganha XP. O total do dia é dividido igualmente entre todas as metas ativas. Atenção: uma vez marcada, a meta não pode ser desmarcada!'
          },
          {
            icon: '💪',
            title: 'Missão: Vigor',
            text: 'Defina uma meta de peso e registre seu peso e medidas a cada 15 dias. Quanto mais próximo da meta, mais XP. Além disso, registre seus treinos e ganhe XP proporcional ao tempo.'
          },
          {
            icon: '🧠',
            title: 'Missão: Inteligência',
            text: 'Crie objetivos de estudo (ex.: "Inglês"). Registre o tempo estudado e uma nota sobre o que aprendeu. O XP é proporcional ao tempo em relação à sua meta diária de estudo.'
          },
          {
            icon: '💰',
            title: 'Missão: Tesouro',
            text: 'Controle suas finanças: salário, dívidas fixas e gastos mensais. No final do mês, você ganha XP com base em quanto do orçamento sobrou. Quanto mais sobrar, mais XP!'
          },
          {
            icon: '🎁',
            title: 'Recompensas',
            text: 'A cada nível geral que você sobe, ganha um baú. Ao abri-lo, você recebe um card aleatório de uma coleção. Há cards Comuns, Raros, Épicos e Lendários – todos com chances iguais!\n\n🛠️ No menu "Ferramentas" (na Home), você encontra a opção de reiniciar toda a aventura – use com cuidado, pois é irreversível!'
          }
        ];

        let currentStep = 0;
        const stepEl = document.getElementById('tutorial-step');
        const counterEl = document.getElementById('tutorial-counter');
        const prevBtn = document.getElementById('tutorial-prev');
        const nextBtn = document.getElementById('tutorial-next');
        const skipBtn = document.getElementById('tutorial-skip');

        const renderStep = () => {
          const s = steps[currentStep];
          stepEl.innerHTML = `
            <div class="tutorial-icon">${s.icon}</div>
            <div class="tutorial-title">${s.title}</div>
            <div class="tutorial-text">${s.text}</div>
          `;
          counterEl.textContent = `${currentStep + 1} / ${steps.length}`;
          prevBtn.style.display = currentStep === 0 ? 'none' : 'inline-block';
          nextBtn.textContent = currentStep === steps.length - 1 ? 'Iniciar Aventura!' : 'Próximo ▶';
        };

        const goToStep = (index) => {
          if (index < 0 || index >= steps.length) return;
          currentStep = index;
          renderStep();
        };

        const finishTutorial = () => {
          this.state.player.tutorialCompleted = true;
          this.persist();
          this.dismissOverlay(screen, revealAppCallback);
        };

        // Limpa listeners antigos
        const newPrev = prevBtn.cloneNode(true);
        const newNext = nextBtn.cloneNode(true);
        const newSkip = skipBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);
        skipBtn.parentNode.replaceChild(newSkip, skipBtn);

        newPrev.addEventListener('click', () => goToStep(currentStep - 1));
        newNext.addEventListener('click', () => {
          if (currentStep === steps.length - 1) {
            finishTutorial();
          } else {
            goToStep(currentStep + 1);
          }
        });
        newSkip.addEventListener('click', finishTutorial);

        screen.classList.add('visible');
        renderStep();
      };

      // Fluxo do splash
      const showNameOrWelcome = () => {
        if (!this.state.player.name) {
          nameScreen.classList.add('visible');
          document.getElementById('name-input').focus();
        } else {
          showWelcome();
        }
      };

      const dismissSplash = () => {
        splash.classList.add('splash-hide');
        setTimeout(() => {
          splash.remove();
          showNameOrWelcome();
        }, 700);
      };
      splash.addEventListener('click', () => {
        Sound.ensureContext();
        if (!Sound.isMuted()) Sound.startAmbient();
        dismissSplash();
      }, { once: true });

      const nameForm = document.getElementById('name-form');
      nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('name-input');
        const val = input.value.trim();
        if (!val) return;
        this.state.player.name = val;
        this.persist();
        this.updateHeaderPlayer();
        this.renderHub();
        this.dismissOverlay(nameScreen, showWelcome);
      });
    },

    dismissOverlay(el, callback) {
      el.classList.remove('visible');
      el.classList.add('overlay-hide');
      setTimeout(() => {
        el.remove();
        if (callback) callback();
      }, 500);
    },

    // ------------------------------------------------------------
    // AMBIENTAÇÃO DIA/NOITE
    // ------------------------------------------------------------
    applyTimeOfDayAmbiance() {
      const shell = document.getElementById('app-shell');
      if (!shell) return;
      const theme = this.state.player.theme || 'auto';
      let isDay = false;
      if (theme === 'auto') {
        const hour = new Date().getHours();
        isDay = hour >= 6 && hour < 18;
      } else {
        isDay = theme === 'day';
      }
      shell.classList.toggle('time-day', isDay);
      shell.classList.toggle('time-night', !isDay);
    },

    startAmbianceUpdater() {
      const update = () => {
        this.applyTimeOfDayAmbiance();
        if (this._ambianceTimer) {
          cancelAnimationFrame(this._ambianceTimer);
        }
        let lastUpdate = Date.now();
        const check = () => {
          if (document.hidden) {
            this._ambianceTimer = requestAnimationFrame(check);
            return;
          }
          const now = Date.now();
          if (now - lastUpdate >= 5 * 60 * 1000) {
            this.applyTimeOfDayAmbiance();
            lastUpdate = now;
          }
          this._ambianceTimer = requestAnimationFrame(check);
        };
        this._ambianceTimer = requestAnimationFrame(check);
      };
      update();

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.applyTimeOfDayAmbiance();
        }
      });
    },

    // ------------------------------------------------------------
    // SOM E VIBRAÇÃO
    // ------------------------------------------------------------
    wireSoundEffects() {
      const soundBtn = document.getElementById('sound-toggle-btn');
      const updateIcon = () => { soundBtn.textContent = Sound.isMuted() ? '🔇' : '🔊'; };
      updateIcon();
      soundBtn.addEventListener('click', () => {
        const nowMuted = Sound.toggleMuted();
        updateIcon();
        if (nowMuted) Sound.stopAmbient();
        else Sound.startAmbient();
      });

      document.addEventListener('click', (e) => {
        const el = e.target.closest('.btn, .navbtn, .icon-btn, .chest-banner-btn');
        if (el && el.id !== 'sound-toggle-btn') Sound.playClick();
      });

      document.addEventListener('change', (e) => {
        if (e.target.classList && e.target.classList.contains('daily-toggle')) {
          if (e.target.checked) Sound.playToggleOn();
          else Sound.playToggleOff();
        }
      });
    },

    vibrate(pattern) {
      if (navigator.vibrate) navigator.vibrate(pattern);
    },

    // ------------------------------------------------------------
    // ZONA DE REINÍCIO
    // ------------------------------------------------------------
    wireDangerZone() {
      const btn = document.getElementById('reset-adventure-btn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const step1 = confirm(
          'Isso vai apagar TODO o progresso: Quests, Vigor, Inteligência, Tesouro, XP, nível ' +
          'e o nome do Aventureiro(a). Essa ação não pode ser desfeita.\n\nDeseja continuar?'
        );
        if (!step1) return;
        const step2 = confirm('Tem certeza absoluta? Não tem como recuperar depois de reiniciar.');
        if (!step2) return;
        Store.clear();
        localStorage.removeItem('rpgProgressao_lastScreen');
        location.reload();
      });
    },

    // ------------------------------------------------------------
    // PERSONALIZAÇÃO DE TEMA (cores)
    // ------------------------------------------------------------
    loadTheme() {
      const saved = localStorage.getItem('rpgProgressao_theme');
      if (saved) {
        document.documentElement.style.setProperty('--gold', saved);
        const dark = this.darkenColor(saved, 0.4);
        document.documentElement.style.setProperty('--gold-deep', dark);
      }
    },

    darkenColor(hex, amount) {
      let r = parseInt(hex.slice(1, 3), 16);
      let g = parseInt(hex.slice(3, 5), 16);
      let b = parseInt(hex.slice(5, 7), 16);
      r = Math.floor(r * (1 - amount));
      g = Math.floor(g * (1 - amount));
      b = Math.floor(b * (1 - amount));
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    },

    wireThemePicker() {
      const toggleBtn = document.getElementById('theme-toggle-btn');
      const modal = document.getElementById('theme-modal');
      const closeBtn = document.getElementById('theme-close-btn');

      if (!toggleBtn || !modal) return;

      const openModal = () => {
        modal.style.display = 'flex';
        const current = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
        document.querySelectorAll('.theme-option').forEach((btn) => {
          btn.classList.toggle('active-theme', btn.dataset.color === current);
        });
      };

      const closeModal = () => {
        modal.style.display = 'none';
      };

      toggleBtn.addEventListener('click', openModal);
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      document.querySelectorAll('.theme-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const color = btn.dataset.color;
          localStorage.setItem('rpgProgressao_theme', color);
          document.documentElement.style.setProperty('--gold', color);
          const dark = this.darkenColor(color, 0.4);
          document.documentElement.style.setProperty('--gold-deep', dark);
          this.renderHub();
          closeModal();
        });
      });
    },

    // ------------------------------------------------------------
    // BACKUP (EXPORTAR/IMPORTAR)
    // ------------------------------------------------------------
    wireBackup() {
      const exportBtn = document.getElementById('export-btn');
      const importBtn = document.getElementById('import-btn');
      const fileInput = document.getElementById('import-file');

      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          this.exportProgress();
        });
      }

      if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => {
          fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
            this.importProgress(e.target.files[0]);
            e.target.value = '';
          }
        });
      }
    },

    exportProgress() {
      try {
        const data = JSON.stringify(this.state, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rpg_progress_${Utils.todayStr()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        UI.toast('Progresso exportado com sucesso!', 'xp');
      } catch (e) {
        UI.toast('Erro ao exportar: ' + e.message, 'info');
        console.error(e);
      }
    },

    importProgress(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!imported.version || !imported.player || !imported.overall) {
            UI.toast('Arquivo inválido ou corrompido.', 'info');
            return;
          }
          if (!confirm('Isso vai substituir TODO o progresso atual. Deseja continuar?')) return;

          this.state = imported;
          this.loadTheme();
          this.persist();
          this.renderAll();
          UI.toast('Progresso importado com sucesso! Recarregando...', 'xp');
          setTimeout(() => location.reload(), 1500);
        } catch (err) {
          UI.toast('Erro ao importar: ' + err.message, 'info');
          console.error(err);
        }
      };
      reader.readAsText(file);
    },

  };

  global.App = App;

  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
