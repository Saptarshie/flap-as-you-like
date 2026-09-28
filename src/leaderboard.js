export class Leaderboard {
  constructor(storageKey) {
    this.key = storageKey;
    this.entries = this._load();
    this._lastSeq = this._maxSeq();
  }

  add(stats) {
    this._lastSeq += 1;
    const entry = {
      score: Number(stats.score) || 0,
      coins: Number(stats.coins) || 0,
      distance: Number(stats.distance) || 0,
      bossKills: Number(stats.bossKills) || 0,
      at: Date.now(),
      label: 'Pilot ' + this._lastSeq,
      _seq: this._lastSeq,
    };
    this.entries.push(entry);
    this._sort();
    let rank = this.entries.indexOf(entry) + 1;
    if (rank > 10) {
      this.entries.splice(this.entries.indexOf(entry), 1);
      rank = 0;
    } else if (this.entries.length > 10) {
      this.entries.length = 10;
    }
    this._save();
    return { rank };
  }

  top(n = 10) {
    this._sort();
    return this.entries.slice(0, n).map((e) => ({
      score: e.score,
      coins: e.coins,
      distance: e.distance,
      bossKills: e.bossKills,
      at: e.at,
      label: e.label,
    }));
  }

  best() {
    let best = 0;
    for (const e of this.entries) {
      if (e.score > best) best = e.score;
    }
    return best;
  }

  render(el) {
    if (typeof document === 'undefined' || !el) return;
    this._sort();
    const rows = this.entries.slice(0, 10);
    const parts = [];
    for (let i = 0; i < rows.length; i++) {
      const e = rows[i];
      const me = e._seq === this._lastSeq;
      const d = new Date(e.at);
      const stamp =
        d.toLocaleDateString() + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const km = (e.distance / 1000).toFixed(1);
      const style =
        'display:flex;align-items:baseline;gap:10px;padding:6px 10px;' +
        'border-radius:6px;color:#fff;font-size:14px;' +
        (me
          ? 'background:rgba(255,210,63,0.14);box-shadow:inset 3px 0 0 #ffd23f;'
          : '');
      parts.push(
        '<li class="lb-row' + (me ? ' me' : '') + '" style="' + style + '">' +
        '<span style="color:#ffd23f;font-weight:bold;min-width:32px;">#' + (i + 1) + '</span>' +
        '<span style="font-weight:bold;min-width:48px;">' + e.score + '</span>' +
        '<span style="color:rgba(255,255,255,0.75);flex:1;">(' + e.coins + ' coins, ' + km + ' km, ' + e.bossKills + ' boss)</span>' +
        '<span style="color:#ffd23f;font-size:11px;white-space:nowrap;">' + e.label + ' ' + stamp + '</span>' +
        '</li>'
      );
    }
    el.innerHTML =
      '<ol style="list-style:none;margin:0;padding:0;">' + parts.join('') + '</ol>';
  }

  clear() {
    this.entries = [];
    this._lastSeq = 0;
    try {
      localStorage.removeItem(this.key);
    } catch (e) {}
  }

  _sort() {
    this.entries.sort(
      (a, b) => b.score - a.score || b.coins - a.coins || b.at - a.at
    );
  }

  _maxSeq() {
    let max = 0;
    for (const e of this.entries) {
      if (e && e._seq > max) max = e._seq;
    }
    return max;
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter((e) => e && typeof e === 'object');
    } catch (e) {
      return [];
    }
  }

  _save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.entries));
    } catch (e) {}
  }
}