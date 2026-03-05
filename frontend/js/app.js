(function () {
  'use strict';

  const VERSION = (window.SO_VERSION && String(window.SO_VERSION)) ? String(window.SO_VERSION) : '0';
  const THEME_OPTIONS = ['liangshan', 'classic'];

  const STATE_LABELS = {
    idle: '待命',
    writing: '写作',
    researching: '研究',
    executing: '执行',
    syncing: '同步',
    error: '出错'
  };

  const DEFAULT_DETAILS = {
    idle: '待命中',
    writing: '在写作中',
    researching: '在研究中',
    executing: '在执行中',
    syncing: '同步中',
    error: '出错了，排查中'
  };
  const AUDIO_STATES = ['idle', 'writing', 'researching', 'executing', 'syncing', 'error'];

  const ui = {
    themeSelect: document.getElementById('themeSelect'),
    coordsBtn: document.getElementById('coordsBtn'),
    audioBtn: document.getElementById('audioBtn'),
    coordsText: document.getElementById('coordsText'),
    statusText: document.getElementById('status-text'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingTitle: document.getElementById('loading-title'),
    loadingProgressBar: document.getElementById('loading-progress-bar'),
    errorPanel: document.getElementById('error-panel')
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function qs(name) { return new URLSearchParams(window.location.search).get(name); }

  async function checkWebPSupport() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width === 1);
      img.onerror = () => resolve(false);
      img.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
    });
  }

  async function fetchThemeConfig(name) {
    const url = `/static/themes/${name}/theme.json?v=${VERSION}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`theme.json load failed: ${url} (${r.status})`);
    return await r.json();
  }

  function showLoadError(msg) {
    ui.errorPanel.style.display = 'block';
    ui.errorPanel.textContent = msg;
  }

  function hideLoadingOverlay() {
    ui.loadingOverlay.style.display = 'none';
  }

  function setLoadingProgress(p01) {
    const p = clamp(Math.floor(p01 * 100), 0, 100);
    ui.loadingProgressBar.style.width = p + '%';
  }

  function normalizeState(s) {
    if (!s) return 'idle';
    if (s === 'working') return 'writing';
    if (s === 'run' || s === 'running') return 'executing';
    if (s === 'sync') return 'syncing';
    if (s === 'research') return 'researching';
    return s;
  }

  function buildVersionedUrl(raw, version) {
    const mark = raw.includes('?') ? '&' : '?';
    return raw + mark + 'v=' + encodeURIComponent(version);
  }

  function createStateAudioManager(themeConfig, version) {
    const audioCfg = themeConfig && themeConfig.audio;
    const disabledStub = {
      hasAny: false,
      setEnabled: function () {},
      playForState: function () {},
      ensureForState: function () {},
      unlock: function () {},
      stop: function () {},
      setRole: function () {},
      getRole: function () { return null; }
    };

    if (!audioCfg || audioCfg.enabled === false) return disabledStub;

    const masterVolume = clamp(Number(audioCfg.volume || 0.55), 0, 1);
    const globalStates = (audioCfg.states && typeof audioCfg.states === 'object') ? audioCfg.states : {};
    const rolesCfg = (audioCfg.roles && typeof audioCfg.roles === 'object') ? audioCfg.roles : {};
    const fallbackRole = (themeConfig && themeConfig.hero && (themeConfig.hero.role || themeConfig.hero.id))
      ? String(themeConfig.hero.role || themeConfig.hero.id)
      : 'songjiang';
    let activeRole = String(audioCfg.role || fallbackRole || 'songjiang').trim();
    if (!activeRole) activeRole = 'songjiang';

    const cacheByRole = {};
    let enabled = true;
    let currentState = null;
    let currentRole = activeRole;
    let currentAudio = null;
    let pendingState = null;

    function getRoleNode(role) {
      const node = rolesCfg[role];
      return (node && typeof node === 'object') ? node : {};
    }

    function buildFromStateNode(node, pattern, role, state) {
      if (!node && !pattern) return null;
      const rawFile = (typeof node === 'string') ? node : (node && (node.mp3 || node.url));
      const file = rawFile || (pattern ? pattern.replace('{role}', role).replace('{state}', state) : null);
      if (!file) return null;

      const loop = !(node && node.loop === false);
      const stateVolume = (node && typeof node.volume === 'number') ? node.volume : 1.0;
      const volume = clamp(masterVolume * stateVolume, 0, 1);
      const audio = new Audio(buildVersionedUrl(String(file), version));
      audio.preload = 'auto';
      audio.loop = loop;
      audio.volume = volume;
      return { audio, loop, volume };
    }

    function ensureRoleEntries(role) {
      if (cacheByRole[role]) return cacheByRole[role];

      const roleNode = getRoleNode(role);
      const rolePattern = (roleNode && typeof roleNode.pattern === 'string') ? roleNode.pattern : null;
      const globalPattern = (typeof audioCfg.pattern === 'string') ? audioCfg.pattern : null;
      const pattern = rolePattern || globalPattern;
      const roleStates = (roleNode && roleNode.states && typeof roleNode.states === 'object') ? roleNode.states : {};
      const entries = {};

      for (const state of AUDIO_STATES) {
        const node = (state in roleStates) ? roleStates[state] : globalStates[state];
        const entry = buildFromStateNode(node, pattern, role, state);
        if (!entry) continue;
        entries[state] = entry;
      }
      cacheByRole[role] = entries;
      return entries;
    }

    function stopCurrent() {
      if (!currentAudio) return;
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
      currentState = null;
      currentRole = activeRole;
    }

    function playState(state, restart) {
      if (!enabled) return;
      const entries = ensureRoleEntries(activeRole);
      const entry = entries[state];
      if (!entry) return;
      if (!restart && currentState === state && currentRole === activeRole && currentAudio && !currentAudio.paused) return;

      if (currentAudio && currentAudio !== entry.audio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      currentAudio = entry.audio;
      currentState = state;
      currentRole = activeRole;
      currentAudio.loop = entry.loop;
      currentAudio.volume = entry.volume;
      if (restart) currentAudio.currentTime = 0;

      const playPromise = currentAudio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          pendingState = state;
        });
      }
    }

    return {
      hasAny: Object.keys(ensureRoleEntries(activeRole)).length > 0,
      setEnabled: function (next) {
        enabled = !!next;
        if (!enabled) {
          if (currentAudio) currentAudio.pause();
          return;
        }
        if (pendingState) {
          const s = pendingState;
          pendingState = null;
          playState(s, true);
        } else if (currentState) {
          playState(currentState, false);
        }
      },
      playForState: function (state) { playState(state, true); },
      ensureForState: function (state) { playState(state, false); },
      stop: function () { stopCurrent(); },
      setRole: function (role) {
        const next = String(role || '').trim();
        if (!next || next === activeRole) return;
        activeRole = next;
        stopCurrent();
      },
      getRole: function () { return activeRole; },
      unlock: function () {
        if (!enabled || !pendingState) return;
        const s = pendingState;
        pendingState = null;
        playState(s, true);
      }
    };
  }

  function formatLine(state, detail) {
    const label = STATE_LABELS[state] || state;
    const d = (detail && String(detail).trim()) ? String(detail).trim() : (DEFAULT_DETAILS[state] || '');
    return `[${label}] ${d}`;
  }

  function initThemeSelect(themeName) {
    ui.themeSelect.value = themeName;
    ui.themeSelect.addEventListener('change', () => {
      const next = ui.themeSelect.value;
      localStorage.setItem('so_theme', next);
      const url = new URL(window.location.href);
      url.searchParams.set('theme', next);
      window.location.href = url.toString();
    });
  }

  function initCoordsToggle(state) {
    ui.coordsBtn.addEventListener('click', () => {
      state.coordsOn = !state.coordsOn;
      ui.coordsBtn.textContent = '坐标: ' + (state.coordsOn ? 'ON' : 'OFF');
    });
  }

  function initAudioToggle(state) {
    if (!ui.audioBtn) return;

    function redraw() {
      const available = !state.audioManager || !!state.audioManager.hasAny;
      if (!available) {
        ui.audioBtn.textContent = '音效: N/A';
        ui.audioBtn.disabled = true;
        return;
      }
      ui.audioBtn.disabled = false;
      ui.audioBtn.textContent = '音效: ' + (state.audioEnabled ? 'ON' : 'OFF');
    }

    state.refreshAudioBtn = redraw;
    redraw();
    ui.audioBtn.addEventListener('click', () => {
      if (state.audioManager && !state.audioManager.hasAny) return;
      state.audioEnabled = !state.audioEnabled;
      localStorage.setItem('so_audio_enabled', state.audioEnabled ? '1' : '0');
      if (state.audioManager) {
        state.audioManager.setEnabled(state.audioEnabled);
        if (state.audioEnabled && !state.pendingAudioState) {
          state.audioManager.ensureForState(state.currentState || 'idle');
        }
      }
      redraw();
    });
  }

  function isHeroMoving(engine) {
    if (!engine) return false;
    if (engine.moving) return true;
    if (!engine.heroBase || !engine.target) return false;
    const dx = Number(engine.target.x || 0) - Number(engine.heroBase.x || 0);
    const dy = Number(engine.target.y || 0) - Number(engine.heroBase.y || 0);
    return Math.sqrt(dx * dx + dy * dy) > 2.0;
  }

  function tryPlayPendingStateAudio(appState) {
    if (!appState.audioManager || !appState.audioEnabled) return;
    if (!appState.pendingAudioState) return;
    if (isHeroMoving(appState.engine)) return;
    appState.audioManager.playForState(appState.pendingAudioState);
    appState.pendingAudioState = null;
  }

  async function init() {
    const appState = {
      supportsWebP: false,
      themeName: 'liangshan',
      themeConfig: null,
      coordsOn: false,
      audioEnabled: localStorage.getItem('so_audio_enabled') !== '0',
      audioManager: null,
      pendingAudioState: null,
      refreshAudioBtn: null,
      lastPointer: { x: null, y: null },
      lastClickCopiedAt: 0,
      currentState: null,
      lastLine: '',
      engine: null,
      sceneRef: null,
      bubble: null // { container, hideAt }
    };

    document.addEventListener('pointerdown', () => {
      if (appState.audioManager) appState.audioManager.unlock();
    }, { passive: true });

    // Decide theme
    const fromUrl = qs('theme');
    const fromLS = localStorage.getItem('so_theme');
    appState.themeName = (fromUrl && THEME_OPTIONS.includes(fromUrl)) ? fromUrl
      : ((fromLS && THEME_OPTIONS.includes(fromLS)) ? fromLS : 'liangshan');

    initThemeSelect(appState.themeName);
    initCoordsToggle(appState);
    initAudioToggle(appState);

    appState.supportsWebP = await checkWebPSupport();
    ui.loadingTitle.textContent = `加载主题中: ${appState.themeName} ...`;

    try {
      appState.themeConfig = await fetchThemeConfig(appState.themeName);
    } catch (e) {
      // Fallback to classic
      try {
        appState.themeName = 'classic';
        ui.themeSelect.value = 'classic';
        appState.themeConfig = await fetchThemeConfig('classic');
        showLoadError(
          '无法加载梁山主题配置，已自动切到 Classic (Debug)。\n\n' +
          '错误: ' + (e && e.message ? e.message : String(e))
        );
      } catch (e2) {
        showLoadError('主题加载失败: ' + (e2 && e2.message ? e2.message : String(e2)));
        return;
      }
    }

    const config = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: 1280,
      height: 720,
      backgroundColor: '#000000',
      pixelArt: true,
      physics: { default: 'arcade' },
      scene: {
        preload: function () { preloadScene(this, appState); },
        create: function () { createScene(this, appState); },
        update: function (time, delta) { updateScene(this, appState, time, delta); }
      }
    };

    new Phaser.Game(config);

    // Panels
    if (window.StarOfficePanels && typeof window.StarOfficePanels.initControlPanel === 'function') {
      window.StarOfficePanels.initControlPanel({
        fetchStatusNow: () => fetchStatusAndApply(appState)
      });
    }
    if (window.StarOfficePanels && typeof window.StarOfficePanels.initMemoPanel === 'function') {
      window.StarOfficePanels.initMemoPanel();
    }

    // Expose minimal API for debugging
    window.StarOfficeApp = {
      fetchStatusNow: () => fetchStatusAndApply(appState),
      setAudioRole: (role) => {
        if (!appState.audioManager) return;
        appState.audioManager.setRole(role);
        if (!appState.pendingAudioState) appState.audioManager.ensureForState(appState.currentState || 'idle');
      }
    };
  }

  function preloadScene(scene, appState) {
    setLoadingProgress(0.02);
    scene.load.on('progress', (p) => setLoadingProgress(p));
    scene.load.on('complete', () => {
      setLoadingProgress(1.0);
      hideLoadingOverlay();
    });

    const engine = new window.StarOfficeThemeEngine.ThemeEngine(appState.themeConfig, {
      version: VERSION,
      supportsWebP: appState.supportsWebP
    });
    appState.engine = engine;
    engine.preload(scene);
  }

  function createScene(scene, appState) {
    appState.sceneRef = scene;
    appState.engine.create(scene);
    appState.audioManager = createStateAudioManager(appState.themeConfig, VERSION);
    if (appState.audioManager && appState.audioManager.hasAny) {
      appState.audioManager.setEnabled(appState.audioEnabled);
    }
    if (typeof appState.refreshAudioBtn === 'function') appState.refreshAudioBtn();

    // Pointer coords + copy
    scene.input.on('pointermove', (p) => {
      appState.lastPointer = { x: Math.round(p.x), y: Math.round(p.y) };
      if (appState.coordsOn) ui.coordsText.textContent = `x: ${appState.lastPointer.x}, y: ${appState.lastPointer.y}`;
    });

    scene.input.on('pointerdown', async (p) => {
      if (appState.audioManager) appState.audioManager.unlock();
      if (!appState.coordsOn) return;
      const x = Math.round(p.x), y = Math.round(p.y);
      ui.coordsText.textContent = `x: ${x}, y: ${y}`;
      const text = `${x},${y}`;
      try {
        await navigator.clipboard.writeText(text);
        appState.lastClickCopiedAt = Date.now();
      } catch (e) {
        // ignore (clipboard may be blocked)
      }
      console.log('[coords]', text);
    });

    // Initial UI + polling
    setStatusLine(appState, 'idle', DEFAULT_DETAILS.idle);
    scene.time.addEvent({ delay: 1200, loop: true, callback: () => fetchStatusAndApply(appState) });
    fetchStatusAndApply(appState);
  }

  async function fetchStatusAndApply(appState) {
    try {
      const r = await fetch('/status', { cache: 'no-store' });
      const data = await r.json();
      const next = normalizeState(data && data.state);
      const detail = data && data.detail;
      const role = data && (data.role || data.character || data.agentRole);
      if (role && appState.audioManager) appState.audioManager.setRole(role);

      if (next !== appState.currentState) {
        appState.currentState = next;
        appState.engine.setTargetForState(next);
        appState.pendingAudioState = next;
        if (appState.audioManager) appState.audioManager.stop();
        tryPlayPendingStateAudio(appState);
        setStatusLine(appState, next, detail);
      } else {
        if (!appState.pendingAudioState && appState.audioManager) appState.audioManager.ensureForState(next);
        tryPlayPendingStateAudio(appState);
        const line = formatLine(next, detail);
        if (line !== appState.lastLine) setStatusLine(appState, next, detail);
      }
    } catch (e) {
      ui.statusText.textContent = '[离线] 无法拉取状态，检查 backend 是否启动 (http://127.0.0.1:18791)';
    }
  }

  function setStatusLine(appState, state, detail) {
    const line = formatLine(state, detail);
    appState.lastLine = line;
    ui.statusText.textContent = line;
    showBubble(appState, line);
  }

  function showBubble(appState, text) {
    const scene = appState.sceneRef;
    const hero = appState.engine && appState.engine.hero;
    if (!scene || !hero) return;
    if (appState.bubble && appState.bubble.container) appState.bubble.container.destroy();

    const fontSize = 12;
    const padX = 8, padY = 6;
    const maxW = 360;

    const txt = scene.add.text(0, 0, text, {
      fontFamily: 'ArkPixel, monospace',
      fontSize: fontSize + 'px',
      color: '#111',
      wordWrap: { width: maxW }
    }).setOrigin(0.5, 0.5);

    const w = clamp(txt.width + padX * 2, 60, maxW + padX * 2);
    const h = clamp(txt.height + padY * 2, 26, 120);

    const g = scene.add.graphics();
    g.fillStyle(0xfff7d6, 0.98);
    g.lineStyle(3, 0x1b1b1b, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.fillTriangle(-10, h / 2 - 2, 10, h / 2 - 2, 0, h / 2 + 12);
    g.strokeTriangle(-10, h / 2 - 2, 10, h / 2 - 2, 0, h / 2 + 12);

    const c = scene.add.container(0, 0, [g, txt]);
    c.setDepth(9999);

    appState.bubble = { container: c, hideAt: scene.time.now + 6500 };
    updateBubblePos(appState);
  }

  function updateBubblePos(appState) {
    const scene = appState.sceneRef;
    const hero = appState.engine && appState.engine.hero;
    const bubble = appState.bubble;
    if (!scene || !hero || !bubble || !bubble.container) return;
    const topY = hero.y - hero.displayHeight;
    bubble.container.x = hero.x;
    bubble.container.y = topY - 18;
  }

  function updateScene(scene, appState, time, delta) {
    // coords display when OFF
    if (!appState.coordsOn) {
      const now = Date.now();
      if (now - appState.lastClickCopiedAt < 900) {
        ui.coordsText.textContent = '已复制坐标';
      } else if (appState.lastPointer.x != null) {
        ui.coordsText.textContent = `x: ${appState.lastPointer.x}, y: ${appState.lastPointer.y}`;
      } else {
        ui.coordsText.textContent = 'x: -, y: -';
      }
    }

    // bubble follow + auto-hide
    if (appState.bubble && appState.bubble.hideAt && scene.time.now > appState.bubble.hideAt) {
      if (appState.bubble.container) appState.bubble.container.destroy();
      appState.bubble = null;
    }
    updateBubblePos(appState);

    // game objects update
    if (appState.engine) appState.engine.update(time, delta, appState.currentState);
    tryPlayPendingStateAudio(appState);
    updateBubblePos(appState);
  }

  init();
})();
