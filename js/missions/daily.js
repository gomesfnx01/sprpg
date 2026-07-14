/* ============================================================
   daily.js — Missão: QUESTS (metas diárias)

   O total de XP de hoje é sempre recalculado do zero (pool ÷ metas
   ativas × marcadas) e nunca passa do teto — qualquer mudança na
   lista de metas ou nas marcações aciona App.reconcileDailyToday(),
   que ajusta o XP instantaneamente pra diferença certa.

   IMPORTANTE: Uma vez marcada, a meta não pode ser desmarcada.
   ============================================================ */
(function (global) {
  'use strict';

  const Daily = {
    render() {
      const s = App.state.daily;
      const lv = XP.calcLevel(s.totalXp);
      const weekend = Utils.isWeekendStr(s.today.date);
      const goals = s.goals;
      const xpPerGoal = goals.length > 0 ? (s.pool / goals.length) : 0;
      const completedIds = s.today.completedIds;
      const earnedToday = s.today.appliedXp || 0;

      const root = document.getElementById('screen-daily');
      root.innerHTML =
        '<div class="screen-header">' +
          '<h2>📜 Missão: Quests</h2>' +
          UI.levelBadgeHTML(lv.level) +
        '</div>' +
        UI.xpBarHTML(lv.currentXp, lv.neededXp) +

        (weekend
          ? '<div class="window rest-window">' +
              '<div class="rest-icon">🛌</div>' +
              '<div><strong>Fim de semana — Descanso do Herói</strong>' +
              '<p>As metas diárias não valem XP hoje. Aproveite para recarregar as energias!</p></div>' +
            '</div>'
          : '<div class="window today-window">' +
              '<div class="today-window-title">Progresso de hoje</div>' +
              '<div class="today-xp">+' + earnedToday + ' / ' + s.pool + ' XP</div>' +
              (goals.length > 0
                ? '<div class="hint">Cada meta vale ' + (Math.round(xpPerGoal * 10) / 10) + ' XP (pool fixo dividido pelas ' + goals.length + ' metas ativas). O XP é creditado na hora, e nunca passa do teto do dia.</div>'
                : '<div class="hint">Cadastre metas abaixo para começar a ganhar XP diário.</div>'
              ) +
              '<div style="margin-top: 8px; font-family: var(--font-mono); font-size: 10px; color: var(--ember); border: 1px dashed var(--ember); padding: 6px; border-radius: 4px; background: rgba(226,112,58,0.08);">' +
                '⚠️ <strong>Atenção:</strong> Após marcar uma meta, ela <strong>não poderá ser desmarcada</strong>. Certifique-se de ter concluído a tarefa antes de confirmar.' +
              '</div>' +
            '</div>'
        ) +

        '<div class="window">' +
          '<div class="window-title">Nova meta</div>' +
          '<form id="daily-add-form" class="inline-form">' +
            '<input type="text" id="daily-add-input" placeholder="Ex.: Beber 2L de água" maxlength="80" required autocomplete="off" />' +
            '<button type="submit" class="btn btn-primary">Adicionar</button>' +
          '</form>' +
        '</div>' +

        '<div class="window">' +
          '<div class="window-title">Suas metas (' + goals.length + ')</div>' +
          (goals.length === 0
            ? '<p class="empty-msg">Nenhuma meta cadastrada ainda. Toda meta nova entra na divisão do XP diário.</p>'
            : '<ul class="goal-list">' + goals.map((g) => this.goalItemHTML(g, completedIds, weekend, xpPerGoal)).join('') + '</ul>')
        + '</div>' +

        '<div class="window">' +
          '<div class="window-title">Histórico</div>' +
          (s.history.length === 0
            ? '<p class="empty-msg">Ainda sem histórico. Ele aparece a partir do primeiro dia fechado.</p>'
            : '<ul class="history-list">' + s.history.slice(0, 30).map((h) => this.historyItemHTML(h)).join('') + '</ul>')
        + '</div>';

      this.wire(weekend);
    },

    goalItemHTML(g, completedIds, weekend, xpPerGoal) {
      const done = completedIds.indexOf(g.id) !== -1;
      return (
        '<li class="goal-item' + (done ? ' goal-done' : '') + '">' +
          '<label class="goal-check">' +
            '<input type="checkbox" data-id="' + g.id + '" class="daily-toggle" ' +
              (done ? 'checked disabled' : '') + (weekend ? ' disabled' : '') + ' />' +
            '<span class="checkmark"></span>' +
          '</label>' +
          '<span class="goal-text">' + Utils.escapeHtml(g.text) + '</span>' +
          '<span class="goal-xp">' + (Math.round(xpPerGoal * 10) / 10) + ' XP</span>' +
          '<button class="icon-btn daily-edit" data-id="' + g.id + '" title="Editar">✎</button>' +
          '<button class="icon-btn daily-del" data-id="' + g.id + '" title="Excluir">🗑</button>' +
        '</li>'
      );
    },

    historyItemHTML(h) {
      if (h.weekend) {
        return '<li class="history-item history-rest"><span>' + Utils.formatDateBR(h.date) + '</span><span>Descanso</span></li>';
      }
      return (
        '<li class="history-item">' +
          '<span>' + Utils.formatDateBR(h.date) + '</span>' +
          '<span>' + h.completedCount + '/' + h.totalGoals + ' metas</span>' +
          '<span class="history-xp">+' + h.xpEarned + ' XP</span>' +
        '</li>'
      );
    },

    wire(weekend) {
      const form = document.getElementById('daily-add-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('daily-add-input');
        const text = input.value.trim();
        if (!text) return;
        App.state.daily.goals.push({ id: Utils.uid(), text: text, createdAt: Date.now() });
        App.reconcileDailyToday(false); // nova meta reduz o valor de cada uma — recalcula na hora
        this.render();
        UI.toast('Meta adicionada à sua jornada diária', 'info');
      });

      // Listeners apenas para marcar (nunca desmarcar)
      document.querySelectorAll('.daily-toggle:not(:disabled)').forEach((cb) => {
        cb.addEventListener('change', () => {
          if (weekend) return;
          if (cb.checked) {
            // Apenas marcar
            const id = cb.dataset.id;
            const s = App.state.daily;
            if (s.today.completedIds.indexOf(id) === -1) {
              s.today.completedIds.push(id);
              App.reconcileDailyToday(false);
              this.render();
            }
          }
          // Se for desmarcado (o que não deve acontecer com disabled), ignoramos
        });
      });

      document.querySelectorAll('.daily-edit').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const s = App.state.daily;
          const goal = s.goals.find((g) => g.id === id);
          if (!goal) return;
          // Não permite editar se a meta já foi concluída hoje
          if (s.today.completedIds.indexOf(id) !== -1) {
            UI.toast('Esta meta já foi concluída hoje e não pode ser editada.', 'info');
            return;
          }
          const novo = prompt('Editar meta:', goal.text);
          if (novo === null) return;
          const trimmed = novo.trim();
          if (!trimmed) return;
          goal.text = trimmed;
          App.persist();
          this.render();
        });
      });

      document.querySelectorAll('.daily-del').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const s = App.state.daily;
          // Não permite excluir se a meta já foi concluída hoje
          if (s.today.completedIds.indexOf(id) !== -1) {
            UI.toast('Esta meta já foi concluída hoje e não pode ser excluída.', 'info');
            return;
          }
          if (!confirm('Excluir esta meta? O XP de hoje é recalculado automaticamente.')) return;
          s.goals = s.goals.filter((g) => g.id !== id);
          // Remove da lista de concluídos (se por acaso estiver lá)
          const idx = s.today.completedIds.indexOf(id);
          if (idx !== -1) s.today.completedIds.splice(idx, 1);
          App.reconcileDailyToday(false);
          this.render();
        });
      });
    }
  };

  global.Daily = Daily;
})(window);