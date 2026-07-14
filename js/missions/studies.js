/* ============================================================
   studies.js — Missão: INTELIGÊNCIA (estudos)
   ============================================================ */
(function (global) {
  'use strict';

  const Studies = {
    calcXp(minutes, idealMinutes, ceiling) {
      if (!idealMinutes || idealMinutes <= 0) return 0;
      return Math.round(Math.min(1, minutes / idealMinutes) * ceiling);
    },

    todayMinutes(obj) {
      return (obj.today && obj.today.date === Utils.todayStr()) ? obj.today.minutes : 0;
    },

    render() {
      const s = App.state.studies;
      const lv = XP.calcLevel(s.totalXp);

      const root = document.getElementById('screen-studies');
      let html =
        '<div class="screen-header">' +
          '<h2>🧠 Missão: Inteligência</h2>' +
          UI.levelBadgeHTML(lv.level) +
        '</div>' +
        UI.xpBarHTML(lv.currentXp, lv.neededXp);

      if (s.idealMinutes == null) {
        html +=
          '<div class="window">' +
            '<div class="window-title">Definir meta diária de estudo</div>' +
            '<p class="empty-msg">Quantos minutos por dia é o ideal de estudo pra você? (ex.: 60 para 1 hora). ' +
            'Esse valor é o teto de XP do dia, dividido entre os objetivos que você criar.</p>' +
            '<form id="studies-setup-form" class="inline-form">' +
              '<input type="number" min="1" id="studies-ideal-input" placeholder="Minutos ideais por dia" required />' +
              '<button type="submit" class="btn btn-primary">Definir</button>' +
            '</form>' +
          '</div>';
        root.innerHTML = html;
        this.wire();
        return;
      }

      const n = Math.max(1, s.objectives.length);
      const idealPerObjective = Math.round((s.idealMinutes / n) * 10) / 10;
      const ceilingPerObjective = Math.round((Store.MISSION_XP_CEILING / n) * 10) / 10;

      html +=
        '<div class="window">' +
          '<div class="window-title">Meta diária de estudo</div>' +
          '<div class="goal-current">Ideal: <strong>' + s.idealMinutes + ' min/dia</strong>, dividido entre ' +
            '<strong>' + n + '</strong> objetivo(s) = ' + idealPerObjective + ' min (' + ceilingPerObjective + ' XP) cada.</div>' +
          '<button id="studies-edit-ideal-btn" class="icon-btn">✎ Ajustar meta diária</button>' +
        '</div>' +

        '<div class="window">' +
          '<div class="window-title">Novo objetivo de estudo</div>' +
          '<form id="studies-add-form" class="inline-form" style="flex-wrap: wrap; align-items: end; gap: 6px;">' +
  '<div style="flex: 1 1 140px; min-width: 100px;">' +
    '<label class="field-label" style="display:block; font-size:10px; margin-bottom:2px;">O que você está estudando</label>' +
    '<input type="text" id="studies-subject-input" placeholder="Ex.: Inglês" maxlength="60" required class="field-input" style="width:100%;" />' +
  '</div>' +
  '<div style="flex: 1 1 140px; min-width: 100px;">' +
    '<label class="field-label" style="display:block; font-size:10px; margin-bottom:2px;">Qual o objetivo</label>' +
    '<input type="text" id="studies-goal-input" placeholder="Ex.: Certificação" maxlength="120" required class="field-input" style="width:100%;" />' +
  '</div>' +
  '<button type="submit" class="btn btn-primary" style="margin-bottom: 2px;">Criar</button>' +
'</form>' +
        '</div>';

      html += (s.objectives.length === 0
        ? '<div class="window"><p class="empty-msg">Nenhum objetivo cadastrado ainda. Crie um acima para começar a ganhar XP estudando.</p></div>'
        : s.objectives.map((o) => this.objectiveWindowHTML(o, idealPerObjective, ceilingPerObjective)).join('')
      );

      root.innerHTML = html;
      this.wire();
    },

    objectiveWindowHTML(o, idealPerObjective, ceilingPerObjective) {
      const totalMinutes = o.logs.reduce((sum, l) => sum + l.minutes, 0);
      const todayMin = this.todayMinutes(o);
      const todayXp = this.calcXp(todayMin, idealPerObjective, ceilingPerObjective);
      return (
        '<div class="window objective-window">' +
          '<div class="objective-header">' +
            '<div>' +
              '<div class="objective-subject">' + Utils.escapeHtml(o.subject) + '</div>' +
              '<div class="objective-goal">🎯 ' + Utils.escapeHtml(o.goal) + '</div>' +
            '</div>' +
            '<button class="icon-btn studies-del" data-id="' + o.id + '" title="Excluir objetivo">🗑</button>' +
          '</div>' +
          '<div class="objective-stats">' +
            '<span>⏱ ' + totalMinutes + ' min no total</span>' +
            '<span>Hoje: ' + todayMin + '/' + idealPerObjective + ' min (+' + todayXp + ' XP)</span>' +
          '</div>' +
          '<form class="inline-form studies-log-form" data-id="' + o.id + '" style="flex-wrap: wrap; align-items: end; gap: 6px; margin-top: 8px;">' +
  '<div style="flex: 1 1 100px; min-width: 80px;">' +
    '<label class="field-label" style="display:block; font-size:10px; margin-bottom:2px;">Minutos</label>' +
    '<input type="number" min="1" placeholder="Ex.: 30" class="field-input studies-minutes-input" style="width:100%;" required />' +
  '</div>' +
  '<div style="flex: 1 1 160px; min-width: 120px;">' +
    '<label class="field-label" style="display:block; font-size:10px; margin-bottom:2px;">O que estudou</label>' +
    '<input type="text" placeholder="Ex.: Capítulo 3" maxlength="100" class="field-input studies-note-input" style="width:100%;" required autocomplete="off" />' +
  '</div>' +
  '<button type="submit" class="btn btn-secondary" style="margin-bottom: 2px;">Registrar</button>' +
'</form>' +
          (o.logs.length > 0
            ? '<details class="objective-history"><summary>Ver histórico (' + o.logs.length + ')</summary>' +
                '<ul class="history-list">' +
                  o.logs.slice().reverse().slice(0, 20).map((l) => this.logItemHTML(l)).join('') +
                '</ul>' +
              '</details>'
            : ''
          ) +
        '</div>'
      );
    },

    logItemHTML(l) {
      return (
        '<li class="history-item">' +
          '<span>' + Utils.formatDateBR(l.date) + '</span>' +
          '<span>⏱ ' + l.minutes + 'min — ' + Utils.escapeHtml(l.note) + '</span>' +
          '<span class="history-xp">+' + l.xp + ' XP</span>' +
        '</li>'
      );
    },

    wire() {
      const setupForm = document.getElementById('studies-setup-form');
      if (setupForm) {
        setupForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const val = parseInt(document.getElementById('studies-ideal-input').value, 10);
          if (!val || val <= 0) return;
          App.state.studies.idealMinutes = val;
          App.persist();
          this.render();
        });
        return;
      }

      const editBtn = document.getElementById('studies-edit-ideal-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          const s = App.state.studies;
          const val = prompt('Minutos ideais de estudo por dia:', s.idealMinutes);
          if (val === null) return;
          const n = parseInt(val, 10);
          if (!n || n <= 0) return;
          s.idealMinutes = n;
          App.persist();
          this.render();
        });
      }

      const addForm = document.getElementById('studies-add-form');
      if (addForm) {
        addForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const subject = document.getElementById('studies-subject-input').value.trim();
          const goal = document.getElementById('studies-goal-input').value.trim();
          if (!subject || !goal) return;
          App.state.studies.objectives.push({
            id: Utils.uid(), subject: subject, goal: goal, createdAt: Date.now(),
            today: { date: null, minutes: 0 }, logs: []
          });
          App.persist();
          UI.toast('Novo objetivo de estudo criado', 'info');
          this.render();
        });
      }

      document.querySelectorAll('.studies-del').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!confirm('Excluir este objetivo e todo o seu histórico?')) return;
          const id = btn.dataset.id;
          App.state.studies.objectives = App.state.studies.objectives.filter((o) => o.id !== id);
          App.persist();
          this.render();
        });
      });

      document.querySelectorAll('.studies-log-form').forEach((form) => {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const id = form.dataset.id;
          const minutes = parseInt(form.querySelector('.studies-minutes-input').value, 10);
          const note = form.querySelector('.studies-note-input').value.trim();
          if (!minutes || minutes <= 0 || !note) return;

          const s = App.state.studies;
          const obj = s.objectives.find((o) => o.id === id);
          if (!obj) return;

          const n = Math.max(1, s.objectives.length);
          const idealPerObjective = s.idealMinutes / n;
          const ceilingPerObjective = Store.MISSION_XP_CEILING / n;
          const today = Utils.todayStr();
          if (!obj.today || obj.today.date !== today) obj.today = { date: today, minutes: 0 };

          const prevMinutes = obj.today.minutes;
          const newMinutes = prevMinutes + minutes;
          const prevXp = this.calcXp(prevMinutes, idealPerObjective, ceilingPerObjective);
          const newXp = this.calcXp(newMinutes, idealPerObjective, ceilingPerObjective);
          const delta = newXp - prevXp;

          obj.today.minutes = newMinutes;
          obj.logs.push({ id: Utils.uid(), date: today, minutes: minutes, note: note, xp: delta });
          App.applyXp('studies', delta, 'Inteligência — ' + obj.subject);
          this.render();
        });
      });
    }
  };

  global.Studies = Studies;
})(window);
