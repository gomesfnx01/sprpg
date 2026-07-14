/* ============================================================
   finance.js — Missão: TESOURO (controle mensal financeiro)

   O XP dessa missão reflete a disciplina financeira do mês:
   quanto menos sobra do orçamento (salário − dívidas fixas) é
   gasto, mais XP no fechamento do mês. O XP só é efetivamente
   aplicado quando o mês vira (ver App.rolloverFinanceIfNeeded);
   durante o mês, mostramos só uma prévia.
   ============================================================ */
(function (global) {
  'use strict';

  const Finance = {
    getMonthRecord(monthKey, createIfMissing) {
      const months = App.state.finance.months;
      if (!months[monthKey] && createIfMissing) {
        months[monthKey] = { salary: null, fixedDebts: [], expenses: [], settled: false, settledXp: null };
      }
      return months[monthKey] || null;
    },

    previewXp(rec) {
      const totalDebts = rec.fixedDebts.reduce((s, d) => s + d.value, 0);
      const totalExpenses = rec.expenses.reduce((s, e) => s + e.value, 0);
      const budget = rec.salary - totalDebts;
      if (budget <= 0) return { xp: 0, budget: budget, totalDebts: totalDebts, totalExpenses: totalExpenses };
      const ratio = Math.max(0, Math.min(1, (budget - totalExpenses) / budget));
      return { xp: Math.round(ratio * Store.MISSION_XP_CEILING), budget: budget, totalDebts: totalDebts, totalExpenses: totalExpenses };
    },

    render() {
      const s = App.state.finance;
      const lv = XP.calcLevel(s.totalXp);
      const monthKey = Utils.currentMonthKey();
      const rec = this.getMonthRecord(monthKey, false);

      const root = document.getElementById('screen-finance');
      root.innerHTML =
        '<div class="screen-header">' +
        '<h2>💰 Missão: Tesouro</h2>' +
        UI.levelBadgeHTML(lv.level) +
        '</div>' +
        UI.xpBarHTML(lv.currentXp, lv.neededXp) +
        '<div class="window-title month-title">Mês atual: ' + Utils.formatMonthBR(monthKey) + '</div>' +

        (!rec || rec.salary == null
          ? this.setupBlockHTML()
          : this.summaryBlockHTML(rec)
        ) +

        (rec && rec.salary != null ? this.expensesBlockHTML(rec) : '') +

        this.historyBlockHTML(monthKey);

      this.wire(monthKey);
    },

    // ----- REMOVIDA a verificação de "windowOpen" -----
    setupBlockHTML() {
      return '<div class="window">' +
        '<div class="window-title">Configurar mês (salário e dívidas fixas)</div>' +
        '<form id="finance-salary-form" class="inline-form">' +
        '<input type="number" step="0.01" min="0" id="finance-salary-input" placeholder="Salário total recebido" required />' +
        '<button type="submit" class="btn btn-primary">Salvar salário</button>' +
        '</form>' +
        '</div>';
    },

    summaryBlockHTML(rec) {
      const p = this.previewXp(rec);
      const saldo = p.budget - p.totalExpenses;
      return (
        '<div class="window">' +
        '<div class="window-title">Resumo do mês</div>' +
        '<div class="finance-summary">' +
        '<div class="finance-row"><span>Salário</span><span>' + Utils.formatMoney(rec.salary) + '</span></div>' +
        '<div class="finance-row"><span>Dívidas fixas</span><span class="neg">- ' + Utils.formatMoney(p.totalDebts) + '</span></div>' +
        '<div class="finance-row"><span>Orçamento livre</span><span>' + Utils.formatMoney(p.budget) + '</span></div>' +
        '<div class="finance-row"><span>Gastos do mês</span><span class="neg">- ' + Utils.formatMoney(p.totalExpenses) + '</span></div>' +
        '<div class="finance-row finance-saldo ' + (saldo < 0 ? 'saldo-neg' : 'saldo-pos') + '"><span>Saldo restante</span><span>' + Utils.formatMoney(saldo) + '</span></div>' +
        '</div>' +
        '<div class="hint" style="margin-top:8px;">XP previsto se o mês fechasse hoje: <strong>' + p.xp + '/' + Store.MISSION_XP_CEILING + '</strong> ' +
        '— quanto menos você gastar do orçamento livre, mais XP no fechamento do mês.</div>' +
        '</div>' +

        '<div class="window">' +
        '<div class="window-title">Dívidas fixas</div>' +
        '<form id="finance-debt-form" class="inline-form">' +
        '<input type="text" id="finance-debt-name" placeholder="Nome (ex.: Aluguel)" maxlength="60" required autocomplete="off" />' +
        '<input type="number" step="0.01" min="0" id="finance-debt-value" placeholder="Valor" required />' +
        '<button type="submit" class="btn btn-secondary">Adicionar</button>' +
        '</form>' +
        (rec.fixedDebts.length === 0
          ? '<p class="empty-msg">Nenhuma dívida fixa cadastrada.</p>'
          : '<ul class="finance-list">' + rec.fixedDebts.map((d) =>
            '<li class="finance-list-item"><span>' + Utils.escapeHtml(d.name) + '</span><span>' + Utils.formatMoney(d.value) + '</span>' +
            '<button class="icon-btn finance-debt-del" data-id="' + d.id + '">🗑</button>' +
            '</li>'
          ).join('') + '</ul>')
        + '</div>'
      );
    },

    expensesBlockHTML(rec) {
      return (
        '<div class="window">' +
        '<div class="window-title">Registrar gasto</div>' +
        '<form id="finance-expense-form" class="inline-form" style="flex-wrap: wrap; align-items: end; gap: 6px;">' +
        '<div style="flex: 1 1 120px; min-width: 80px;">' +
        '<label class="field-label" style="display:block; font-size:10px;">Descrição</label>' +
        '<input type="text" id="finance-expense-name" placeholder="Ex.: Supermercado" maxlength="60" required class="field-input" style="width:100%;" />' +
        '</div>' +
        '<div style="flex: 1 1 100px; min-width: 70px;">' +
        '<label class="field-label" style="display:block; font-size:10px;">Valor</label>' +
        '<input type="number" step="0.01" min="0" id="finance-expense-value" placeholder="0,00" required class="field-input" style="width:100%;" />' +
        '</div>' +
        '<div style="flex: 0 0 120px; min-width: 90px;">' +
        '<label class="field-label" style="display:block; font-size:10px;">Data</label>' +
        '<input type="date" id="finance-expense-date" class="field-input" style="width:100%;" value="' + Utils.todayStr() + '" />' +
        '</div>' +
        '<button type="submit" class="btn btn-primary" style="margin-bottom: 2px;">Adicionar</button>' +
        '</form>' +
        (rec.expenses.length === 0
          ? '<p class="empty-msg">Nenhum gasto registrado neste mês ainda.</p>'
          : '<ul class="finance-list">' + rec.expenses.slice().reverse().map((ex) =>
            '<li class="finance-list-item"><span>' + Utils.escapeHtml(ex.name) + ' (' + Utils.formatDateBR(ex.date) + ')</span><span>' + Utils.formatMoney(ex.value) + '</span>' +
            '<button class="icon-btn finance-expense-del" data-id="' + ex.id + '">🗑</button>' +
            '</li>'
          ).join('') + '</ul>')
        + '</div>'
      );
    },

    historyBlockHTML(currentMonthKey) {
      const months = App.state.finance.months;
      const keys = Object.keys(months).filter((k) => k !== currentMonthKey && months[k].salary != null).sort().reverse();
      if (keys.length === 0) return '';
      return (
        '<div class="window">' +
        '<div class="window-title">Histórico de meses</div>' +
        '<ul class="history-list">' +
        keys.map((k) => {
          const rec = months[k];
          const p = this.previewXp(rec);
          const saldo = p.budget - p.totalExpenses;
          const xpLabel = rec.settled ? ('+' + rec.settledXp + ' XP') : ('pendente de fechamento');
          return '<li class="history-item"><span>' + Utils.formatMonthBR(k) + '</span><span>Saldo: ' + Utils.formatMoney(saldo) + '</span><span class="history-xp">' + xpLabel + '</span></li>';
        }).join('') +
        '</ul>' +
        '</div>'
      );
    },

    wire(monthKey) {
      const salaryForm = document.getElementById('finance-salary-form');
      if (salaryForm) {
        salaryForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const val = parseFloat(document.getElementById('finance-salary-input').value);
          if (isNaN(val) || val < 0) return;
          const rec = this.getMonthRecord(monthKey, true);
          const isFirstSetup = rec.salary == null;
          rec.salary = val;
          App.persist();
          UI.toast(isFirstSetup ? 'Mês configurado' : 'Salário atualizado', 'info');
          this.render();
        });
      }

      const debtForm = document.getElementById('finance-debt-form');
      if (debtForm) {
        debtForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = document.getElementById('finance-debt-name').value.trim();
          const value = parseFloat(document.getElementById('finance-debt-value').value);
          if (!name || isNaN(value) || value < 0) return;
          const rec = this.getMonthRecord(monthKey, true);
          rec.fixedDebts.push({ id: Utils.uid(), name: name, value: value });
          App.persist();
          this.render();
        });
      }

      document.querySelectorAll('.finance-debt-del').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rec = this.getMonthRecord(monthKey, true);
          rec.fixedDebts = rec.fixedDebts.filter((d) => d.id !== btn.dataset.id);
          App.persist();
          this.render();
        });
      });

      const expenseForm = document.getElementById('finance-expense-form');
      if (expenseForm) {
        expenseForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = document.getElementById('finance-expense-name').value.trim();
          const value = parseFloat(document.getElementById('finance-expense-value').value);
          const dateInput = document.getElementById('finance-expense-date');
          const date = dateInput ? dateInput.value : Utils.todayStr();
          if (!name || isNaN(value) || value < 0) return;
          const rec = this.getMonthRecord(monthKey, true);
          rec.expenses.push({ id: Utils.uid(), name: name, value: value, date: date });
          App.persist();
          this.render();
        });
      }

      document.querySelectorAll('.finance-expense-del').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rec = this.getMonthRecord(monthKey, true);
          rec.expenses = rec.expenses.filter((ex) => ex.id !== btn.dataset.id);
          App.persist();
          this.render();
        });
      });
    }
  };

  global.Finance = Finance;
})(window);