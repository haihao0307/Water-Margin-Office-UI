(function () {
  'use strict';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function normalizeOrigin(o, fallback) {
    if (!o || typeof o !== 'object') return fallback;
    const x = (typeof o.x === 'number') ? o.x : fallback.x;
    const y = (typeof o.y === 'number') ? o.y : fallback.y;
    return { x, y };
  }

  function parseTint(t) {
    if (!t) return null;
    if (typeof t === 'number') return t;
    if (typeof t === 'string') {
      // allow "0xff00aa"
      if (t.startsWith('0x')) return parseInt(t, 16);
      return parseInt(t, 10);
    }
    return null;
  }

  function safeArray(v) { return Array.isArray(v) ? v : []; }

  function defaultPositions() {
    return {
      idle: { x: 640, y: 600 },
      writing: { x: 320, y: 520 },
      researching: { x: 320, y: 520 },
      executing: { x: 320, y: 520 },
      syncing: { x: 640, y: 620 },
      error: { x: 1066, y: 360 }
    };
  }

  function getDesiredPos(themeConfig, state) {
    const p = themeConfig && themeConfig.positions && themeConfig.positions[state];
    if (p && typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
    const d = defaultPositions();
    return d[state] ? { x: d[state].x, y: d[state].y } : { x: 640, y: 600 };
  }

  function getEffect(themeConfig, state) {
    const e = themeConfig && themeConfig.effects && themeConfig.effects[state];
    if (!e) return { tint: null, shake: 0.0, bob: 0.0 };
    return {
      tint: parseTint(e.tint),
      shake: Number(e.shake || 0),
      bob: Number(e.bob || 0)
    };
  }

  function resolveAssetUrl(asset, version, supportsWebP) {
    if (!asset) return null;
    if (supportsWebP && asset.webp) return asset.webp + '?v=' + version;
    if (asset.png) return asset.png + '?v=' + version;
    if (asset.webp) return asset.webp + '?v=' + version;
    return null;
  }

  function ThemeEngine(themeConfig, opts) {
    this.themeConfig = themeConfig || {};
    this.version = (opts && opts.version) || '0';
    this.supportsWebP = !!(opts && opts.supportsWebP);

    this.scene = null;
    this.hero = null;
    this.heroBaseScale = 1.0;
    this.heroStates = null; // state -> { textureKey, animKey, scale? }
    this.heroBase = { x: 640, y: 600 };
    this.target = { x: 640, y: 600 };
    this.moving = false;

    this.bg = null;
    this.bgFg = null;
    this.objects = [];
    this.objectBubbles = [];
  }

  ThemeEngine.prototype.preload = function (scene) {
    this.scene = scene;
    const tc = this.themeConfig;
    const ver = this.version;
    const sw = this.supportsWebP;

    const bgUrl = resolveAssetUrl(tc.assets && tc.assets.bg, ver, sw);
    const heroUrl = resolveAssetUrl(tc.assets && tc.assets.hero, ver, sw);
    if (bgUrl) scene.load.image('bg', bgUrl);
    if (heroUrl) {
      scene.load.spritesheet('hero_sheet', heroUrl, {
        frameWidth: tc.assets.hero.frameWidth,
        frameHeight: tc.assets.hero.frameHeight
      });
    }

    const bgFgUrl = resolveAssetUrl(tc.assets && tc.assets.bgFg, ver, sw);
    if (bgFgUrl) scene.load.image('bg_fg', bgFgUrl);

    // Hero state spritesheets (optional)
    const heroStates = (tc.assets && tc.assets.heroStates) ? tc.assets.heroStates : {};
    Object.keys(heroStates).forEach((state) => {
      const sh = heroStates[state];
      const url = resolveAssetUrl(sh, ver, sw);
      if (!url) return;
      scene.load.spritesheet('hero_state_' + state, url, {
        frameWidth: sh.frameWidth,
        frameHeight: sh.frameHeight
      });
    });

    // Spritesheets for props
    const sheets = (tc.assets && tc.assets.spritesheets) ? tc.assets.spritesheets : {};
    Object.keys(sheets).forEach((key) => {
      const sh = sheets[key];
      const url = resolveAssetUrl(sh, ver, sw);
      if (!url) return;
      scene.load.spritesheet('ss_' + key, url, {
        frameWidth: sh.frameWidth,
        frameHeight: sh.frameHeight
      });
    });
  };

  ThemeEngine.prototype.create = function (scene) {
    this.scene = scene;
    const tc = this.themeConfig;

    // Background: scale to cover 1280x720
    this.bg = scene.add.image(640, 360, 'bg').setOrigin(0.5);
    const scaleX = 1280 / this.bg.width;
    const scaleY = 720 / this.bg.height;
    this.bg.setScale(Math.max(scaleX, scaleY));
    this.bg.setDepth(0);

    // Hero
    const ox = (tc.hero && tc.hero.origin) ? normalizeOrigin(tc.hero.origin, { x: 0.5, y: 1.0 }).x : 0.5;
    const oy = (tc.hero && tc.hero.origin) ? normalizeOrigin(tc.hero.origin, { x: 0.5, y: 1.0 }).y : 1.0;
    const sc = (tc.hero && typeof tc.hero.scale === 'number') ? tc.hero.scale : 1.0;
    this.target = getDesiredPos(tc, 'idle');
    this.heroBase = { x: this.target.x, y: this.target.y };
    this.hero = scene.add.sprite(this.heroBase.x, this.heroBase.y, 'hero_sheet', 0).setOrigin(ox, oy);
    this.hero.setScale(sc);
    this.heroBaseScale = sc;
    this.hero.setDepth(100);

    // Walk animation (used only when moving)
    const frames = (tc.assets && tc.assets.hero && tc.assets.hero.frames) ? Number(tc.assets.hero.frames) : 4;
    const fr = (tc.assets && tc.assets.hero && tc.assets.hero.frameRate) ? Number(tc.assets.hero.frameRate) : 10;
    scene.anims.create({
      key: 'hero_walk',
      frames: scene.anims.generateFrameNumbers('hero_sheet', { start: 0, end: Math.max(0, frames - 1) }),
      frameRate: fr,
      repeat: -1
    });

    // Optional: state-specific animations (idle/writing/researching/etc.)
    this.initHeroStates(scene);

    // Props animations + instances
    this.createObjectsFromTheme(scene);

    // Foreground occlusion
    if (scene.textures.exists('bg_fg')) {
      this.bgFg = scene.add.image(640, 360, 'bg_fg').setOrigin(0.5);
      this.bgFg.setScale(this.bg.scaleX, this.bg.scaleY);
      this.bgFg.setDepth(1000);
    }
  };

  ThemeEngine.prototype.initHeroStates = function (scene) {
    const tc = this.themeConfig;
    const heroStates = (tc.assets && tc.assets.heroStates) ? tc.assets.heroStates : null;
    if (!heroStates) return;

    this.heroStates = {};
    Object.keys(heroStates).forEach((state) => {
      const sh = heroStates[state];
      const textureKey = 'hero_state_' + state;
      if (!scene.textures.exists(textureKey)) return;

      const animKey = 'hero_state_' + state;
      if (!scene.anims.exists(animKey)) {
        const frames = (sh && sh.frames) ? Number(sh.frames) : 1;
        const fr = (sh && sh.frameRate) ? Number(sh.frameRate) : 6;
        scene.anims.create({
          key: animKey,
          frames: scene.anims.generateFrameNumbers(textureKey, { start: 0, end: Math.max(0, frames - 1) }),
          frameRate: fr,
          repeat: -1
        });
      }

      this.heroStates[state] = {
        textureKey: textureKey,
        animKey: animKey,
        scale: (sh && typeof sh.scale === 'number') ? sh.scale : null
      };
    });
  };

  ThemeEngine.prototype.createObjectsFromTheme = function (scene) {
    const tc = this.themeConfig;
    const objects = safeArray(tc.objects);
    const sheets = (tc.assets && tc.assets.spritesheets) ? tc.assets.spritesheets : {};
    const bubbles = this.objectBubbles;

    const ensureAnim = (key, sh) => {
      const animKey = 'anim_' + key;
      if (scene.anims.exists(animKey)) return animKey;
      const frames = (sh && sh.frames) ? Number(sh.frames) : 1;
      const fr = (sh && sh.frameRate) ? Number(sh.frameRate) : 6;
      scene.anims.create({
        key: animKey,
        frames: scene.anims.generateFrameNumbers('ss_' + key, { start: 0, end: Math.max(0, frames - 1) }),
        frameRate: fr,
        repeat: -1
      });
      return animKey;
    };

    for (const o of objects) {
      if (!o || typeof o !== 'object') continue;
      const type = o.type || 'animated';
      const depth = (typeof o.depth === 'number') ? o.depth : 50;
      const scale = (typeof o.scale === 'number') ? o.scale : 1.0;
      const origin = normalizeOrigin(o.origin, { x: 0.5, y: 1.0 });

      if (type === 'animated') {
        const key = o.key;
        const sh = sheets[key];
        if (!key || !sh) continue;
        if (!scene.textures.exists('ss_' + key)) continue;

        const animKey = ensureAnim(key, sh);
        const sp = scene.add.sprite(o.x || 0, o.y || 0, 'ss_' + key, 0).setOrigin(origin.x, origin.y);
        sp.setScale(scale);
        sp.setDepth(depth);
        sp.anims.play(animKey, true);

        if (o.clickText) {
          sp.setInteractive({ useHandCursor: true });
          sp.on('pointerdown', () => {
            const b = scene.add.text(sp.x, sp.y - 20, String(o.clickText), {
              fontFamily: 'ArkPixel, monospace',
              fontSize: '12px',
              color: '#111',
              backgroundColor: '#fff7d6',
              padding: { x: 6, y: 4 }
            }).setOrigin(0.5, 1.0);
            b.setDepth(2000);
            bubbles.push({ t: scene.time.now + 2200, node: b });
          });
        }

        this.objects.push(sp);
      }

      // type === 'image' is reserved for later; V2 can be added without changing engine.
    }
  };

  ThemeEngine.prototype.setTargetForState = function (state) {
    this.target = getDesiredPos(this.themeConfig, state);
  };

  ThemeEngine.prototype.applyHeroVisualForState = function (state) {
    if (!this.hero) return;

    // Moving always uses walk sheet/anim.
    if (this.moving) {
      if (this.hero.texture.key !== 'hero_sheet') this.hero.setTexture('hero_sheet', 0);
      this.hero.setScale(this.heroBaseScale);
      if (!this.hero.anims.isPlaying || this.hero.anims.currentAnim?.key !== 'hero_walk') {
        this.hero.anims.play('hero_walk', true);
      }
      return;
    }

    const hs = this.heroStates ? this.heroStates[state] : null;
    if (hs && hs.textureKey && hs.animKey) {
      if (this.hero.texture.key !== hs.textureKey) this.hero.setTexture(hs.textureKey, 0);
      this.hero.setScale((typeof hs.scale === 'number') ? hs.scale : this.heroBaseScale);
      if (!this.hero.anims.isPlaying || this.hero.anims.currentAnim?.key !== hs.animKey) {
        this.hero.anims.play(hs.animKey, true);
      }
      return;
    }

    // Fallback: show first frame of base hero sheet.
    if (this.hero.texture.key !== 'hero_sheet') this.hero.setTexture('hero_sheet', 0);
    this.hero.setScale(this.heroBaseScale);
    this.hero.anims.stop();
    this.hero.setFrame(0);
  };

  ThemeEngine.prototype.setMoving = function (isMoving) {
    this.moving = !!isMoving;
    if (!this.hero) return;
    if (this.moving) {
      this.applyHeroVisualForState('idle');
    }
  };

  ThemeEngine.prototype.applyStateEffects = function (state, t) {
    if (!this.hero) return;
    const eff = getEffect(this.themeConfig, state);
    if (eff.tint) this.hero.setTint(eff.tint); else this.hero.clearTint();

    // Base position (feet)
    this.hero.x = this.heroBase.x;
    this.hero.y = this.heroBase.y;

    // Small bob/shake while standing
    if (!this.moving) {
      const shake = eff.shake || 0;
      const bob = eff.bob || 0;
      if (shake > 0) {
        this.hero.x += (Math.sin(t * 0.03) * shake);
        this.hero.y += (Math.cos(t * 0.025) * shake);
      }
      if (bob > 0) {
        this.hero.y += Math.sin(t * 0.02) * bob;
      }
    }
  };

  ThemeEngine.prototype.update = function (time, delta, state) {
    if (!this.hero) return;

    // GC object click bubbles
    for (let i = this.objectBubbles.length - 1; i >= 0; i--) {
      const b = this.objectBubbles[i];
      if (b && b.t && time > b.t) {
        if (b.node) b.node.destroy();
        this.objectBubbles.splice(i, 1);
      }
    }

    // Movement
    const speed = 240;
    const dx = this.target.x - this.heroBase.x;
    const dy = this.target.y - this.heroBase.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2.0) {
      if (dx < -1) this.hero.setFlipX(true);
      if (dx > 1) this.hero.setFlipX(false);
      this.setMoving(true);
      const step = (speed * delta) / 1000.0;
      const k = Math.min(1.0, step / dist);
      this.heroBase.x += dx * k;
      this.heroBase.y += dy * k;
    } else {
      this.heroBase.x = this.target.x;
      this.heroBase.y = this.target.y;
      this.setMoving(false);
    }

    this.applyHeroVisualForState(state);
    this.applyStateEffects(state, time);
  };

  window.StarOfficeThemeEngine = {
    ThemeEngine: ThemeEngine,
    getDesiredPos: getDesiredPos,
    resolveAssetUrl: resolveAssetUrl
  };
})();
