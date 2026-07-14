/* ============================================================
   utils.js — funções utilitárias compartilhadas
   ============================================================ */
(function (global) {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function todayDate() {
    return new Date();
  }

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function todayStr() {
    return toDateStr(todayDate());
  }

  function toMonthKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function currentMonthKey() {
    return toMonthKey(todayDate());
  }

  function isWeekend(d) {
    const day = d.getDay(); // 0 = domingo, 6 = sábado
    return day === 0 || day === 6;
  }

  function isTodayWeekend() {
    return isWeekend(todayDate());
  }

  function parseDateStr(dateStr) {
    const [y, m, dd] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, dd);
  }

  function isWeekendStr(dateStr) {
    return isWeekend(parseDateStr(dateStr));
  }

  function addDaysToStr(dateStr, n) {
    const dt = parseDateStr(dateStr);
    dt.setDate(dt.getDate() + n);
    return toDateStr(dt);
  }

  function diffDays(fromStr, toStr) {
    const a = parseDateStr(fromStr);
    const b = parseDateStr(toStr);
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function mondayOfWeek(dateStr) {
    const d = parseDateStr(dateStr);
    const day = d.getDay(); // 0 = domingo
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    return toDateStr(d);
  }

  function dayOfMonth(d) {
    return d.getDate();
  }

  function todayDayOfMonth() {
    return dayOfMonth(todayDate());
  }

  function isFinanceWindowOpen() {
    const d = todayDayOfMonth();
    return d >= 7 && d <= 10;
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '—';
    const [y, m, day] = dateStr.split('-');
    return day + '/' + m + '/' + y;
  }

  function formatMonthBR(monthKey) {
    if (!monthKey) return '—';
    const [y, m] = monthKey.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return meses[parseInt(m, 10) - 1] + '/' + y;
  }

  function formatMoney(v) {
    const n = Number(v) || 0;
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function uid() {
    return 'id_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 100000).toString(36);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  global.Utils = {
    pad, todayDate, toDateStr, todayStr, toMonthKey, currentMonthKey,
    isWeekend, isTodayWeekend, parseDateStr, isWeekendStr, addDaysToStr, diffDays, mondayOfWeek,
    dayOfMonth, todayDayOfMonth, isFinanceWindowOpen,
    formatDateBR, formatMonthBR, formatMoney, uid, clamp, escapeHtml
  };
})(window);
