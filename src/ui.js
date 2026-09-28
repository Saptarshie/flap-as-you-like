export class UI {
  constructor() {
    this.root = document.getElementById('ui');
    this.hud = document.getElementById('hud');
    this.scoreEl = document.getElementById('score');
    this.coinEl = document.getElementById('coins');
    this.speedEl = document.getElementById('speed');
    this.altEl = document.getElementById('alt');
    this.flapEl = document.getElementById('flapLvl');
    this.healthCells = Array.from(document.querySelectorAll('.healthCell'));
    this.healthText = document.getElementById('healthText');
    this.menuEl = document.getElementById('menu');
    this.overEl = document.getElementById('gameover');
    this.finalScoreEl = document.getElementById('finalScore');
    this.finalCoinsEl = document.getElementById('finalCoins');
    this.finalDistEl = document.getElementById('finalDist');
    this.finalBossEl = document.getElementById('finalBoss');
    this.rankEl = document.getElementById('rank');
    this.boardEl = document.getElementById('board');
    this.bestEl = document.getElementById('best');
    this.flashEl = document.getElementById('flash');
    this.hintEl = document.getElementById('hint');
    this.chips = {
      shield: document.getElementById('chipShield'),
      boost: document.getElementById('chipBoost'),
      mult: document.getElementById('chipMult'),
      glide: document.getElementById('chipGlide'),
    };
    this.bossBar = document.getElementById('bossBar');
    this.bossFill = document.getElementById('bossFill');
    this.bossName = document.getElementById('bossName');
    this.bossHp = document.getElementById('bossHp');
    this.best = Number(localStorage.getItem('flappy3d_best') || 0);
    this._lastFlash = 0;
    this._healthKey = '';
    this._bossKey = '';
    this._chipKey = '';
    this._readoutKey = '';
  }
  showMenu(show) {
    this.menuEl.classList.toggle('hidden', !show);
    this.hud.classList.toggle('hidden', show);
  }
  showGameOver(show, score, coins, dist, bossKills, lb, rank) {
    this.overEl.classList.toggle('hidden', !show);
    if (show) {
      const isBest = score > this.best;
      if (isBest) {
        this.best = score;
        localStorage.setItem('flappy3d_best', String(score));
      }
      this.finalScoreEl.textContent = String(score);
      this.finalCoinsEl.textContent = String(coins);
      this.finalDistEl.textContent = (dist / 1000).toFixed(2) + ' km';
      this.finalBossEl.textContent = String(bossKills || 0);
      this.bestEl.textContent = String(this.best) + (isBest ? '  (new!)' : '');
      this.rankEl.textContent = rank > 0 ? ('Global rank: #' + rank) : 'Not in top 10 yet';
      if (lb && this.boardEl) lb.render(this.boardEl);
    }
  }
  setHUD(score, coins, speedKmh) {
    this.scoreEl.textContent = String(score);
    this.coinEl.textContent = String(coins);
    this.speedEl.textContent = String(Math.round(speedKmh));
  }
  setReadout(altM, flapLevel) {
    const alt = altM != null ? altM.toFixed(1) : this.altEl.textContent;
    const flap = flapLevel != null ? String(flapLevel) : this.flapEl.textContent;
    const key = alt + '|' + flap;
    if (key === this._readoutKey) return;
    this._readoutKey = key;
    if (altM != null) this.altEl.textContent = alt;
    if (flapLevel != null) this.flapEl.textContent = flap;
  }
  setHealth(health, maxHealth, healFrac) {
    const hp = Math.max(0, Math.min(maxHealth, health));
    const quantized = Math.round(Math.max(0, Math.min(1, healFrac)) * 30) / 30;
    const key = hp + '|' + maxHealth + '|' + quantized;
    if (key === this._healthKey) return;
    this._healthKey = key;
    for (let i = 0; i < this.healthCells.length; i++) {
      const fill = i < hp ? 1 : i === hp && hp < maxHealth ? quantized : 0;
      this.healthCells[i].style.setProperty('--fill', Math.max(0, Math.min(1, fill)));
    }
    this.healthText.textContent = hp + 'x';
  }
  setChips(state) {
    const key = [!!state.shield, !!state.boost, state.mult || 0, !!state.glide].join('|');
    if (key === this._chipKey) return;
    this._chipKey = key;
    this.chips.shield.classList.toggle('hidden', !state.shield);
    this.chips.boost.classList.toggle('hidden', !state.boost);
    this.chips.mult.classList.toggle('hidden', !state.mult);
    this.chips.mult.textContent = 'x' + (state.mult || 1) + ' score';
    this.chips.glide.classList.toggle('hidden', !state.glide);
  }
  setBoss(hp, maxHp, name, show) {
    const key = [hp, maxHp, name, !!show].join('|');
    if (key === this._bossKey) return;
    this._bossKey = key;
    this.bossBar.classList.toggle('hidden', !show);
    if (show) {
      this.bossFill.style.width = Math.max(0, Math.min(1, hp / Math.max(1, maxHp))) * 100 + '%';
      this.bossName.firstChild.textContent = name + ' ';
      this.bossHp.textContent = hp + ' / ' + maxHp;
    }
  }
  flashRing() {
    const now = performance.now();
    if (now - this._lastFlash < 300) return;
    this._lastFlash = now;
    this.flashEl.classList.remove('pulse');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('pulse');
  }
  setHint(text) {
    this.hintEl.textContent = text;
    this.hintEl.classList.toggle('hidden', !text);
  }
  popScore() {
    this.scoreEl.classList.remove('pop');
    void this.scoreEl.offsetWidth;
    this.scoreEl.classList.add('pop');
  }
}
