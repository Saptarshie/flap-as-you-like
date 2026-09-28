export class Input {
  constructor(target = window) {
    this.flapQueued = false;
    this.diveQueued = false;
    this.shootQueued = false;
    this.glide = false;
    this.axisX = 0;
    this.keyLeft = false;
    this.keyRight = false;
    this.touchActive = false;
    this.touchStartX = 0;
    this.touchX = 0;
    this.anyInputAt = 0;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.anyInputAt = performance.now();
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.flapQueued = true;
        e.preventDefault();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.diveQueued = true;
        e.preventDefault();
      } else if (e.code === 'Space') {
        this.shootQueued = true;
        e.preventDefault();
      } else if (e.code === 'KeyG') {
        this.glide = !this.glide;
        this.onGlide?.(this.glide);
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.keyLeft = true;
        e.preventDefault();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.keyRight = true;
        e.preventDefault();
      } else if (e.code === 'Enter' || e.code === 'KeyR') {
        this.enterQueued = true;
      }
      this.onAction?.(e.code);
    };
    this._onKeyUp = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keyLeft = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keyRight = false;
    };
    this._onTouchStart = (e) => {
      this.anyInputAt = performance.now();
      for (const t of e.changedTouches) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && el.dataset && el.dataset.btn) return;
      }
      const t = e.changedTouches[0];
      this.touchActive = true;
      this.touchStartX = t.clientX;
      this.touchX = t.clientX;
      this.flapQueued = true;
      this.onAction?.('Touch');
      e.preventDefault();
    };
    this._onTouchMove = (e) => {
      if (!this.touchActive) return;
      this.touchX = e.changedTouches[0].clientX;
      e.preventDefault();
    };
    this._onTouchEnd = () => {
      this.touchActive = false;
      this.axisX = 0;
    };
    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('touchstart', this._onTouchStart, { passive: false });
    target.addEventListener('touchmove', this._onTouchMove, { passive: false });
    target.addEventListener('touchend', this._onTouchEnd);
    target.addEventListener('touchcancel', this._onTouchEnd);
  }
  requestShoot() {
    this.shootQueued = true;
  }
  toggleGlide() {
    this.glide = !this.glide;
    this.onGlide?.(this.glide);
  }
  update(dt) {
    let ax = 0;
    if (this.keyLeft) ax -= 1;
    if (this.keyRight) ax += 1;
    if (this.touchActive && !ax) {
      const dx = this.touchX - this.touchStartX;
      ax = Math.max(-1, Math.min(1, dx / 70));
      if (Math.abs(dx) < 12) ax = 0;
    }
    this.axisX += (ax - this.axisX) * Math.min(1, dt * 14);
    if (!this.keyLeft && !this.keyRight && !this.touchActive && Math.abs(ax) < 0.01) {
      this.axisX *= Math.max(0, 1 - dt * 6);
    }
  }
  consumeFlap() {
    const f = this.flapQueued;
    this.flapQueued = false;
    return f;
  }
  consumeDive() {
    const d = this.diveQueued;
    this.diveQueued = false;
    return d;
  }
  consumeShoot() {
    const s = this.shootQueued;
    this.shootQueued = false;
    return s;
  }
  consumeEnter() {
    const e = this.enterQueued;
    this.enterQueued = false;
    return e;
  }
}