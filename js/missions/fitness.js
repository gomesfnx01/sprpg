/* ============================================================
   fitness.js — Missão: VIGOR (peso, medidas e treino)
   ============================================================ */
(function (global) {
  'use strict';

  const MEASURE_FIELDS = [
    { key: 'peito', label: 'Peito' },
    { key: 'bracoE', label: 'Braço esquerdo' },
    { key: 'bracoD', label: 'Braço direito' },
    { key: 'cintura', label: 'Cintura' },
    { key: 'quadril', label: 'Quadril' },
    { key: 'coxaE', label: 'Coxa esquerda' },
    { key: 'coxaD', label: 'Coxa direita' },
    { key: 'panturrilhaE', label: 'Panturrilha esquerda' },
    { key: 'panturrilhaD', label: 'Panturrilha direita' }
  ];

  const BODY_UPDATE_INTERVAL_DAYS = 15;
  const BODY_XP_FIRST = 10;
  const BODY_XP_IMPROVED = 30;
  const BODY_XP_LOGGED = 5;
  const WEEKLY_WORKOUT_POOL = Store.MISSION_XP_CEILING;

  const Fitness = {
    MEASURE_FIELDS,

    canLogBody(body) {
      if (!body.lastLogDate) return true;
      return Utils.diffDays(body.lastLogDate, Utils.todayStr()) >= BODY_UPDATE_INTERVAL_DAYS;
    },

    daysUntilNextBodyLog(body) {
      if (!body.lastLogDate) return 0;
      const elapsed = Utils.diffDays(body.lastLogDate, Utils.todayStr());
      return Math.max(0, BODY_UPDATE_INTERVAL_DAYS - elapsed);
    },

    calcWorkoutXp(minutes, idealMinutes, ceiling) {
      if (!idealMinutes || idealMinutes <= 0) return 0;
      return Math.round(Math.min(1, minutes / idealMinutes) * ceiling);
    },

    sessionsThisWeek(sessions) {
      const thisMonday = Utils.mondayOfWeek(Utils.todayStr());
      const daysSet = new Set();
      sessions.forEach((s) => {
        if (Utils.mondayOfWeek(s.date) === thisMonday) daysSet.add(s.date);
      });
      return daysSet.size;
    },

    render() {
      const s = App.state.fitness;
      const lv = XP.calcLevel(s.totalXp);
      const last = s.body.entries[s.body.entries.length - 1] || null;
      const canLog = this.canLogBody(s.body);

      const root = document.getElementById('screen-fitness');
      root.innerHTML =
        '<div class="screen-header">' +
          '<h2>💪 Missão: Vigor</h2>' +
          UI.levelBadgeHTML(lv.level) +
        '</div>' +
        UI.xpBarHTML(lv.currentXp, lv.neededXp) +
        this.goalBlockHTML(s, last) +
        this.bodyBlockHTML(s, last, canLog) +
        this.workoutBlockHTML(s);

      this.wire(canLog);
    },

    goalBlockHTML(s, last) {
      if (s.goalWeight == null) {
        return (
          '<div class="window">' +
            '<div class="window-title">Meta de peso</div>' +
            '<form id="fitness-goal-form" class="inline-form">' +
              '<input type="number" step="0.1" min="1" id="fitness-goal-input" placeholder="Peso desejado (kg)" required />' +
              '<button type="submit" class="btn btn-primary">Definir meta</button>' +
            '</form>' +
          '</div>'
        );
      }
      return (
        '<div class="window">' +
          '<div class="window-title">Meta de peso</div>' +
          (s.completed
            ? '<div class="quest-complete">🏆 Meta de ' + s.goalWeight + ' kg concluída! Defina uma nova meta para continuar a jornada.</div>'
            : '<div class="goal-current">Meta atual: <strong>' + s.goalWeight + ' kg</strong>' +
              (last ? ' — peso atual: <strong>' + last.weight + ' kg</strong>' : '') + '</div>'
          ) +
          '<form id="fitness-goal-form" class="inline-form">' +
            '<input type="number" step="0.1" min="1" id="fitness-goal-input" placeholder="Nova meta (kg)" />' +
            '<button type="submit" class="btn btn-secondary">' + (s.completed ? 'Nova meta' : 'Atualizar meta') + '</button>' +
          '</form>' +
        '</div>'
      );
    },

    bodyBlockHTML(s, last, canLog) {
      const daysLeft = this.daysUntilNextBodyLog(s.body);
      return (
        '<div class="window">' +
          '<div class="window-title">Peso &amp; medidas</div>' +
          (!canLog
            ? '<div class="lock-msg">🔒 Próxima atualização de peso/medidas disponível em <strong>' + daysLeft + ' dia(s)</strong>. ' +
              'Isso mantém o foco no acompanhamento real, sem ficar pesando todo dia.</div>'
            : '<form id="fitness-entry-form">' +
                '<label class="field-label">Peso (kg)</label>' +
                '<input type="number" step="0.1" min="1" id="fitness-weight-input" required class="field-input" />' +
                '<details class="measures-details">' +
                  '<summary>Adicionar medidas (opcional)</summary>' +
                  '<div class="measures-grid">' +
                    MEASURE_FIELDS.map((f) =>
                      '<div class="measure-field">' +
                        '<label class="field-label">' + f.label + ' (cm)</label>' +
                        '<input type="number" step="0.1" min="0" data-field="' + f.key + '" class="field-input measure-input" />' +
                      '</div>'
                    ).join('') +
                  '</div>' +
                '</details>' +
                '<button type="submit" class="btn btn-primary btn-block" style="margin-top:10px;">Registrar</button>' +
              '</form>'
          ) +
          (s.body.entries.length === 0
            ? '<p class="empty-msg" style="margin-top:10px;">Nenhum registro ainda.</p>'
            : '<details class="objective-history" style="margin-top:12px;">' +
                '<summary>Ver histórico (' + s.body.entries.length + ')</summary>' +
                '<ul class="fitness-history">' +
                  s.body.entries.slice().reverse().slice(0, 15).map((e) => this.entryItemHTML(e, s.body.entries)).join('') +
                '</ul>' +
              '</details>'
          ) +
        '</div>'
      );
    },

    entryItemHTML(entry, allEntries) {
      const idx = allEntries.findIndex((e) => e.id === entry.id);
      const prev = idx > 0 ? allEntries[idx - 1] : null;
      const weightDelta = prev ? (entry.weight - prev.weight) : 0;
      const arrow = weightDelta > 0 ? '▲' : (weightDelta < 0 ? '▼' : '—');
      const deltaClass = weightDelta > 0 ? 'delta-up' : (weightDelta < 0 ? 'delta-down' : '');
      const hasMeasures = entry.measures && Object.keys(entry.measures).length > 0;
      return (
        '<li class="fitness-entry">' +
          '<div class="fitness-entry-top">' +
            '<span class="fitness-date">' + Utils.formatDateBR(entry.date) + '</span>' +
            '<span class="fitness-weight">' + entry.weight + ' kg ' +
              (prev ? '<span class="' + deltaClass + '">' + arrow + ' ' + Math.abs(weightDelta).toFixed(1) + '</span>' : '') +
            '</span>' +
          '</div>' +
          (hasMeasures
            ? '<div class="fitness-measures-line">' +
                MEASURE_FIELDS.filter((f) => entry.measures[f.key] != null)
                  .map((f) => f.label + ': ' + entry.measures[f.key] + 'cm').join(' · ') +
              '</div>'
            : '') +
        '</li>'
      );
    },

    workoutBlockHTML(s) {
      const w = s.workout;
      if (w.idealMinutes == null || w.weeklyFrequency == null) {
        return (
          '<div class="window">' +
            '<div class="window-title">Treino</div>' +
            '<p class="empty-msg">Defina sua rotina ideal de treino para começar a ganhar XP com ela.</p>' +
            '<form id="workout-setup-form" class="inline-form" style="flex-wrap: wrap; align-items: end; gap: 6px;">' +
              '<div style="flex: 1 1 120px; min-width: 90px;">' +
                '<label class="field-label" style="display:block; font-size:10px; margin-bottom:2px;">Duração (min)</label>' +
                '<input type="number" min="1" id="workout-minutes-input" class="field-input" style="width:100%;" placeholder="Ex.: 30" required />' +
              '</div>' +
              '<div style="flex: 1 1 120px; min-width: 90px;">' +
                '<label class="field-label" style="display:block; font-size:10px; margin-bottom:2px;">Frequência (vezes/semana)</label>' +
                '<input type="number" min="1" max="14" id="workout-freq-input" class="field-input" style="width:100%;" placeholder="Ex.: 3" required />' +
              '</div>' +
              '<button type="submit" class="btn btn-primary" style="margin-bottom: 2px;">Definir</button>' +
            '</form>' +
          '</div>'
        );
      }
      const weekCount = this.sessionsThisWeek(w.sessions);
      const ceilingPerSession = Math.round((WEEKLY_WORKOUT_POOL / w.weeklyFrequency) * 10) / 10;
      const todayMinutes = (w.today && w.today.date === Utils.todayStr()) ? w.today.minutes : 0;
      return (
        '<div class="window">' +
          '<div class="window-title">Treino</div>' +
          '<div class="goal-current">Ideal: <strong>' + w.idealMinutes + ' min</strong>, ' +
            '<strong>' + w.weeklyFrequency + '</strong>x por semana — treinos essa semana: <strong>' + weekCount + '/' + w.weeklyFrequency + '</strong></div>' +
          '<div class="hint">Cada treino vale até ' + ceilingPerSession + ' XP (proporcional ao tempo, comparado ao ideal). Hoje já registrado: ' + todayMinutes + ' min.</div>' +
          '<form id="workout-log-form" class="inline-form" style="margin-top:10px;">' +
            '<input type="number" min="1" id="workout-log-input" placeholder="Minutos treinados hoje" required />' +
            '<button type="submit" class="btn btn-primary">Registrar treino</button>' +
          '</form>' +
          '<button id="workout-edit-btn" class="icon-btn" style="margin-top:6px;">✎ Ajustar rotina ideal</button>' +
          (w.sessions.length === 0
            ? ''
            : '<details class="objective-history" style="margin-top:10px;">' +
                '<summary>Ver histórico de treinos (' + w.sessions.length + ')</summary>' +
                '<ul class="history-list">' +
                  w.sessions.slice().reverse().slice(0, 20).map((sess) =>
                    '<li class="history-item"><span>' + Utils.formatDateBR(sess.date) + '</span><span>' + sess.minutes + ' min</span><span class="history-xp">+' + sess.xp + ' XP</span></li>'
                  ).join('') +
                '</ul>' +
              '</details>'
          ) +
        '</div>'
      );
    },

    wire(canLog) {
      // Meta de peso
      const goalForm = document.getElementById('fitness-goal-form');
      if (goalForm) {
        goalForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = document.getElementById('fitness-goal-input');
          const val = parseFloat(input.value);
          if (!val || val <= 0) return;
          const s = App.state.fitness;
          s.goalWeight = val;
          s.completed = false;
          App.persist();
          UI.toast('Meta de peso definida: ' + val + ' kg', 'info');
          this.render();
        });
      }

      // Registro de peso/medidas
      const entryForm = document.getElementById('fitness-entry-form');
      if (entryForm) {
        entryForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const s = App.state.fitness;
          if (s.completed) {
            UI.toast('Defina uma nova meta antes de registrar mais dados', 'info');
            return;
          }
          const weight = parseFloat(document.getElementById('fitness-weight-input').value);
          if (!weight || weight <= 0) return;
          const measures = {};
          document.querySelectorAll('.measure-input').forEach((inp) => {
            const v = parseFloat(inp.value);
            if (!isNaN(v) && v > 0) measures[inp.dataset.field] = v;
          });

          const isFirst = s.body.entries.length === 0;
          const prev = s.body.entries[s.body.entries.length - 1] || null;
          let xp = BODY_XP_FIRST;
          if (!isFirst && prev) {
            if (s.goalWeight != null) {
              const prevDist = Math.abs(prev.weight - s.goalWeight);
              const newDist = Math.abs(weight - s.goalWeight);
              xp = newDist < prevDist ? BODY_XP_IMPROVED : BODY_XP_LOGGED;
            } else {
              xp = BODY_XP_LOGGED;
            }
          }

          s.body.entries.push({ id: Utils.uid(), date: Utils.todayStr(), weight: weight, measures: measures });
          s.body.lastLogDate = Utils.todayStr();
          App.applyXp('fitness', xp, 'Vigor — registro corporal');

          if (s.goalWeight != null && Math.abs(weight - s.goalWeight) <= 0.3) {
            s.completed = true;
            App.persist();
            setTimeout(() => UI.toast('🏆 Meta de peso alcançada!', 'xp'), 400);
          }
          this.render();
        });
      }

      // Configurar treino
      const setupForm = document.getElementById('workout-setup-form');
      if (setupForm) {
        setupForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const minutes = parseInt(document.getElementById('workout-minutes-input').value, 10);
          const freq = parseInt(document.getElementById('workout-freq-input').value, 10);
          if (!minutes || minutes <= 0 || !freq || freq <= 0) return;
          App.state.fitness.workout.idealMinutes = minutes;
          App.state.fitness.workout.weeklyFrequency = freq;
          App.persist();
          this.render();
        });
      }

      // Editar rotina
      const editBtn = document.getElementById('workout-edit-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          const w = App.state.fitness.workout;
          const minutes = prompt('Duração ideal por treino (minutos):', w.idealMinutes);
          if (minutes === null) return;
          const freq = prompt('Treinos ideais por semana:', w.weeklyFrequency);
          if (freq === null) return;
          const m = parseInt(minutes, 10), f = parseInt(freq, 10);
          if (!m || m <= 0 || !f || f <= 0) return;
          w.idealMinutes = m;
          w.weeklyFrequency = f;
          App.persist();
          this.render();
        });
      }

      // Registrar treino
      const logForm = document.getElementById('workout-log-form');
      if (logForm) {
        logForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = document.getElementById('workout-log-input');
          const minutes = parseInt(input.value, 10);
          if (!minutes || minutes <= 0) return;
          const s = App.state.fitness;
          const w = s.workout;
          const today = Utils.todayStr();
          if (!w.today || w.today.date !== today) w.today = { date: today, minutes: 0 };

          const ceiling = WEEKLY_WORKOUT_POOL / w.weeklyFrequency;
          const prevMinutes = w.today.minutes;
          const newMinutes = prevMinutes + minutes;
          const prevXp = this.calcWorkoutXp(prevMinutes, w.idealMinutes, ceiling);
          const newXp = this.calcWorkoutXp(newMinutes, w.idealMinutes, ceiling);
          const delta = newXp - prevXp;

          w.today.minutes = newMinutes;
          w.sessions.push({ id: Utils.uid(), date: today, minutes: minutes, xp: delta });
          App.applyXp('fitness', delta, 'Vigor — treino');
          this.render();
        });
      }
    }
  };

  global.Fitness = Fitness;
})(window);