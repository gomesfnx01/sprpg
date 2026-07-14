/* ============================================================
   rewards.js — Missão: BAÚ / RECOMPENSAS

   Cada vez que o nível GERAL sobe, um baú fica disponível.
   Ao abrir, sorteia uma raridade (ponderada) e um card aleatório
   dentro de CARDS/manifest.json (gerado por generate-cards-manifest.js),
   com uma animação de revelação diferente por raridade.
   ============================================================ */
const SEASON_NAME = 'CHAVES POOP'; // ← altere aqui a cada temporada

(function (global) {
  'use strict';

  const RARITY_CONFIG = {
    comuns: { label: 'Comum', weight: 25, cssClass: 'comum' },
    raras: { label: 'Rara', weight: 25, cssClass: 'rara' },
    epicas: { label: 'Épica', weight: 25, cssClass: 'epica' },
    lendarias: { label: 'Lendária', weight: 25, cssClass: 'lendaria' }
  };
  const RARITY_ORDER = ['comuns', 'raras', 'epicas', 'lendarias'];
  const MANIFEST_URL = 'CARDS/manifest.json';

  const Rewards = {
    manifest: null,
    manifestError: false,
    loading: false,
    opening: false,

    loadManifest() {
      if (this.manifest || this.loading) return;
      this.loading = true;
      // Mostra indicador de carregamento
      const root = document.getElementById('screen-rewards');
      if (root) {
        root.innerHTML =
          '<div class="screen-header"><h2>🎁 Recompensas</h2></div>' +
          '<div class="window"><p class="empty-msg">⏳ Carregando cards... Aguarde um momento.</p></div>';
      }
      fetch(MANIFEST_URL, { cache: 'no-store' })
        .then((r) => { if (!r.ok) throw new Error('manifest not found'); return r.json(); })
        .then((data) => {
          this.manifest = data;
          this.loading = false;
          this.render();
        })
        .catch(() => {
          this.manifestError = true;
          this.loading = false;
          this.render();
        });
    },

    cardPath(rarity, filename) {
      return 'CARDS/' + rarity + '/' + filename;
    },

    findCollectionEntry(rarity, filename) {
      return App.state.rewards.collection.find((c) => c.rarity === rarity && c.filename === filename);
    },

    unownedFilesIn(rarity) {
      const files = (this.manifest && this.manifest[rarity]) ? this.manifest[rarity] : [];
      return files.filter((filename) => !this.findCollectionEntry(rarity, filename));
    },

    pickRarity() {
      const available = RARITY_ORDER.filter((r) => this.unownedFilesIn(r).length > 0);
      if (available.length === 0) return null;
      const totalWeight = available.reduce((sum, r) => sum + RARITY_CONFIG[r].weight, 0);
      let roll = Math.random() * totalWeight;
      for (const r of available) {
        roll -= RARITY_CONFIG[r].weight;
        if (roll <= 0) return r;
      }
      return available[available.length - 1];
    },

    render() {
      const root = document.getElementById('screen-rewards');
      const s = App.state.rewards;

      if (!this.manifest && !this.manifestError) {
        this.loadManifest();
        return;
      }

      let html = '<div class="screen-header"><h2>🎁 Recompensas</h2></div>';

      // --- BANNER DA TEMPORADA ---
      html += `<div style="text-align: center; margin: 0 14px 16px; font-family: var(--font-display); font-size: 13px; color: var(--gold); text-shadow: 2px 2px 0 rgba(0,0,0,0.5); background: rgba(240,198,116,0.08); border: 1px solid var(--gold); border-radius: 30px; padding: 6px 12px; display: inline-block; width: auto; letter-spacing: 1px;">
            🏷️ Temporada: ${SEASON_NAME}
          </div>`;

      if (this.manifestError) {
        html += '<div class="window"><p class="empty-msg">Não consegui carregar <code>CARDS/manifest.json</code>. ' +
          'Confira se a pasta CARDS foi publicada junto com o resto do site, e se o manifest foi gerado ' +
          '(rode <code>node generate-cards-manifest.js</code>).</p></div>';
        root.innerHTML = html;
        return;
      }

      // --- Baú ---
      html += '<div class="window chest-window">' +
        '<div class="window-title">Baú</div>' +
        (s.chestsAvailable > 0
          ? '<div class="chest-idle-wrap">' +
          this.chestSvgHTML() +
          '<div class="goal-current" style="text-align:center;">Você tem <strong>' + s.chestsAvailable + '</strong> baú(s) disponível(is)!</div>' +
          '<button id="open-chest-btn" class="btn btn-primary btn-block">Abrir baú</button>' +
          '<div id="chest-feedback" style="margin-top: 6px; font-family: var(--font-mono); font-size: 11px; color: var(--muted); min-height: 20px;"></div>' +
          '</div>'
          : '<div class="chest-idle-wrap">' +
          this.chestSvgHTML(true) +
          '<p class="empty-msg" style="text-align:center;">Nenhum baú disponível agora. Suba de nível geral pra ganhar mais!</p>' +
          '</div>'
        ) +
        '<div class="hint">Baús são concedidos a cada nível geral que você sobe. Todas as raridades têm a mesma chance: 25% cada!</div>' +
        '</div>';

      // --- Coleção ---
      html += '<div class="window"><div class="window-title">Coleção (' + this.collectionCountLabel() + ')</div>' +
        RARITY_ORDER.map((r) => this.rarityGalleryHTML(r)).join('') +
        '</div>';

      root.innerHTML = html;
      this.wire();
    },

    collectionCountLabel() {
      const owned = App.state.rewards.collection.length;
      const total = RARITY_ORDER.reduce((sum, r) => sum + ((this.manifest && this.manifest[r]) ? this.manifest[r].length : 0), 0);
      return owned + '/' + total;
    },

    chestSvgHTML(dim) {
      return (
        '<div class="chest-static' + (dim ? ' chest-dim' : '') + '">' +
        '<svg viewBox="0 0 120 100" class="chest-svg">' +
        '<rect x="10" y="45" width="100" height="45" rx="6" class="chest-body" />' +
        '<path d="M10 45 L10 30 Q10 20 25 20 L95 20 Q110 20 110 30 L110 45 Z" class="chest-lid" />' +
        '<circle cx="60" cy="50" r="8" class="chest-lock" />' +
        '</svg>' +
        '</div>'
      );
    },

    rarityGalleryHTML(rarity) {
      const cfg = RARITY_CONFIG[rarity];
      const files = (this.manifest && this.manifest[rarity]) ? this.manifest[rarity] : [];
      const owned = App.state.rewards.collection.filter((c) => c.rarity === rarity);
      return (
        '<div class="rarity-group rarity-' + cfg.cssClass + '">' +
        '<div class="rarity-group-title">' + cfg.label + ' (' + owned.length + '/' + files.length + ')</div>' +
        (files.length === 0
          ? '<p class="empty-msg">Nenhum card cadastrado ainda nessa raridade.</p>'
          : '<div class="card-grid">' +
          files.map((filename) => {
            const entry = this.findCollectionEntry(rarity, filename);
            if (entry) {
              return (
                '<div class="card-slot card-slot-owned" data-rarity="' + rarity + '" data-filename="' + filename + '">' +
                '<img src="' + this.cardPath(rarity, filename) + '" alt="' + cfg.label + '" loading="lazy" decoding="async" />' +
                '</div>'
              );
            }
            return '<div class="card-slot card-slot-locked">?</div>';
          }).join('') +
          '</div>'
        ) +
        '</div>'
      );
    },

    wire() {
      const openBtn = document.getElementById('open-chest-btn');
      if (openBtn) {
        openBtn.addEventListener('click', () => this.openChest());
      }
      document.querySelectorAll('.card-slot-owned').forEach((el) => {
        el.addEventListener('click', () => {
          this.showCardViewer(el.dataset.rarity, el.dataset.filename);
        });
      });
    },

    showCardViewer(rarity, filename) {
      const cfg = RARITY_CONFIG[rarity];
      const overlay = document.createElement('div');
      overlay.className = 'card-viewer-overlay';
      overlay.innerHTML =
        '<div class="card-viewer-frame rarity-frame-' + cfg.cssClass + '">' +
        '<img src="' + this.cardPath(rarity, filename) + '" alt="' + cfg.label + '" decoding="async" />' +
        '</div>';
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));
      const dismiss = () => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 250);
      };
      overlay.addEventListener('click', dismiss);
    },

    openChest() {
      if (this.opening) return;
      const s = App.state.rewards;
      if (s.chestsAvailable <= 0) return;

      // Se o manifest ainda não foi carregado, carrega e retorna
      if (!this.manifest) {
        this.loadManifest();
        // Exibe mensagem de carregamento no feedback
        const feedback = document.getElementById('chest-feedback');
        if (feedback) feedback.textContent = '⏳ Carregando cards...';
        return;
      }

      // Sorteia a raridade
      const rarity = this.pickRarity();
      if (!rarity) {
        const totalCards = RARITY_ORDER.reduce((sum, r) => sum + ((this.manifest[r]) ? this.manifest[r].length : 0), 0);
        if (totalCards === 0) {
          UI.toast('Ainda não há cards cadastrados em nenhuma raridade.', 'info');
        } else {
          UI.toast('🏆 Coleção completa! Você já tem todos os cards cadastrados. O baú continua guardado até chegarem cards novos.', 'info');
        }
        return;
      }

      const files = this.unownedFilesIn(rarity);
      const filename = files[Math.floor(Math.random() * files.length)];

      // Feedback visual "Abrindo..."
      const feedback = document.getElementById('chest-feedback');
      if (feedback) feedback.textContent = '⏳ Abrindo baú...';

      this.opening = true;
      s.chestsAvailable -= 1;
      s.chestsOpenedTotal += 1;
      s.collection.push({ rarity: rarity, filename: filename, firstObtainedAt: Date.now() });
      App.persist();
      App.updateRewardsBadge();
      App.renderHub();

      this.playChestAnimation(rarity, filename, () => {
        this.opening = false;
        if (feedback) feedback.textContent = '';
        this.render();
      });
    },

    playChestAnimation(rarity, filename, onDone) {
      const cfg = RARITY_CONFIG[rarity];
      const overlay = document.createElement('div');
      overlay.className = 'chest-overlay';
      overlay.innerHTML =
        '<div class="chest-anim-wrap">' +
        this.chestSvgHTML() +
        '</div>';
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));

      const chestWrap = overlay.querySelector('.chest-anim-wrap');
      chestWrap.classList.add('chest-shaking');
      if (global.Sound) Sound.playChestShake();

      // Feedback visual na animação: o texto "Abrindo..." já está no feedback, mas durante a animação o overlay já é visível.

      setTimeout(() => {
        chestWrap.classList.remove('chest-shaking');
        chestWrap.classList.add('chest-open');

        setTimeout(() => {
          if (global.Sound) Sound.playChestReveal(rarity);
          overlay.innerHTML =
            '<div class="card-reveal-wrap reveal-' + cfg.cssClass + '">' +
            '<div class="reveal-burst"></div>' +
            '<div class="reveal-rarity-label">' + cfg.label + '!</div>' +
            '<div class="reveal-card-frame">' +
            '<img src="' + this.cardPath(rarity, filename) + '" alt="' + cfg.label + '" decoding="async" />' +
            '</div>' +
            '<div class="reveal-hint">toque para continuar</div>' +
            '</div>';
          requestAnimationFrame(() => overlay.classList.add('card-visible'));

          const dismiss = () => {
            overlay.classList.remove('visible');
            setTimeout(() => { overlay.remove(); onDone(); }, 300);
          };
          overlay.addEventListener('click', dismiss);
        }, 550);
      }, 900);
    }
  };

  global.Rewards = Rewards;
})(window);