/* ============================================================
   ui.js — helpers de interface: barras de XP, toasts, level-up,
   navegação entre telas.
   ============================================================ */
(function (global) {
  'use strict';

  function xpBarHTML(currentXp, neededXp, extraClass) {
    const pct = Utils.clamp((currentXp / neededXp) * 100, 0, 100);
    const pips = 10;
    const filledPips = Math.round((pct / 100) * pips);
    let pipsHtml = '';
    for (let i = 0; i < pips; i++) {
      pipsHtml += '<span class="pip' + (i < filledPips ? ' pip-filled' : '') + '"></span>';
    }
    return (
      '<div class="xpbar ' + (extraClass || '') + '">' +
        '<div class="xpbar-track"><div class="xpbar-fill" style="width:' + pct + '%"></div>' +
          '<div class="xpbar-pips">' + pipsHtml + '</div>' +
        '</div>' +
        '<div class="xpbar-label">' + currentXp + ' / ' + neededXp + ' XP</div>' +
      '</div>'
    );
  }

  function levelBadgeHTML(level) {
    return '<div class="level-badge"><span>Nv.</span><strong>' + level + '</strong></div>';
  }

  let toastTimer = null;
  function toast(msg, kind) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast show' + (kind ? ' toast-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 2200);
  }

  function showLevelUp(label, level) {
    if (global.Sound) Sound.playLevelUp();
    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML =
      '<div class="levelup-window">' +
        '<div class="levelup-burst"></div>' +
        '<div class="levelup-title">LEVEL UP!</div>' +
        '<div class="levelup-sub">' + Utils.escapeHtml(label) + '</div>' +
        '<div class="levelup-level">Nível ' + level + '</div>' +
        '<div class="levelup-hint">toque para continuar</div>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    function dismiss() {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 250);
    }
    overlay.addEventListener('click', dismiss);
    setTimeout(dismiss, 3200);
  }

  function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
    document.querySelectorAll('.navbtn').forEach((b) => {
      b.classList.toggle('navbtn-active', b.dataset.screen === screenId);
    });
    document.getElementById('app-main').scrollTop = 0;
    localStorage.setItem('rpgProgressao_lastScreen', screenId);
  }

  global.UI = { xpBarHTML, levelBadgeHTML, toast, showLevelUp, switchScreen };
})(window);
