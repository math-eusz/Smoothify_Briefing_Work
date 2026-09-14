(() => {
  "use strict";

  const NAME = "Smoothify";
  const VERSION = "0.2.0-alpha.1";
  const STYLE_ID = "smoothify-performance-core";
  const ROOT_CLASS = "smoothify-performance";
  const SCROLL_CLASS = "smoothify-scrolling";
  const SCROLL_IDLE_MS = 120;
  const DEBUG = false;

  const state = {
    initialized: false,
    scrolling: false,
    scrollBursts: 0,
    lastScrollAt: 0,
    scrollTimer: null,
    rafPending: false,
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const root = () => document.documentElement;

  function log(...args) {
    if (DEBUG) console.log(`[${NAME}]`, ...args);
  }

  async function waitForSpicetify() {
    while (!window.Spicetify?.Platform) {
      await wait(100);
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --smoothify-fast: 90ms;
        --smoothify-press: 55ms;
        --smoothify-ease: cubic-bezier(.2,.8,.2,1);
      }

      /*
       * Performance-first rules.
       * No blur, no filters, no permanent will-change, no forced GPU layers.
       */
      html.${ROOT_CLASS},
      html.${ROOT_CLASS} body,
      html.${ROOT_CLASS} .main-view-container,
      html.${ROOT_CLASS} .main-rootlist-rootlist,
      html.${ROOT_CLASS} .main-yourLibraryX-libraryContainer {
        scroll-behavior: auto !important;
      }

      html.${ROOT_CLASS} .main-view-container,
      html.${ROOT_CLASS} .main-yourLibraryX-libraryContainer {
        overscroll-behavior: contain;
      }

      /*
       * Immediate click feedback only.
       * We intentionally avoid scaling every control on hover because that can
       * create extra compositing work while the pointer moves across the UI.
       */
      html.${ROOT_CLASS} button:active:not(:disabled),
      html.${ROOT_CLASS} [role="button"]:active,
      html.${ROOT_CLASS} [data-testid="control-button-playpause"]:active,
      html.${ROOT_CLASS} [data-testid="control-button-skip-forward"]:active,
      html.${ROOT_CLASS} [data-testid="control-button-skip-back"]:active {
        transform: scale(.975);
        transition: transform var(--smoothify-press) var(--smoothify-ease) !important;
      }

      /*
       * During an active scroll burst, animations on frequently repeated UI
       * elements are temporarily removed. This prevents lots of small visual
       * transitions from competing with scrolling for the main/compositor work.
       */
      html.${SCROLL_CLASS} [data-testid="card-click-handler"],
      html.${SCROLL_CLASS} [role="row"],
      html.${SCROLL_CLASS} [role="gridcell"],
      html.${SCROLL_CLASS} .main-trackList-trackListRow,
      html.${SCROLL_CLASS} .main-yourLibraryX-listRow,
      html.${SCROLL_CLASS} .main-card-card,
      html.${SCROLL_CLASS} .main-card-cardContainer {
        transition: none !important;
        animation: none !important;
      }

      /* Keep menu motion short so it never makes the interface wait. */
      html.${ROOT_CLASS} [role="menu"],
      html.${ROOT_CLASS} [data-tippy-root] > div {
        animation-duration: var(--smoothify-fast) !important;
        transition-duration: var(--smoothify-fast) !important;
      }

      /* Disable accidental smooth scrolling from themes/extensions in the hot paths. */
      html.${SCROLL_CLASS} .main-view-container,
      html.${SCROLL_CLASS} .main-rootlist-rootlist,
      html.${SCROLL_CLASS} .main-yourLibraryX-libraryContainer {
        scroll-behavior: auto !important;
      }

      @media (prefers-reduced-motion: reduce) {
        html.${ROOT_CLASS} *,
        html.${ROOT_CLASS} *::before,
        html.${ROOT_CLASS} *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
          scroll-behavior: auto !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function endScrollWhenIdle() {
    if (state.scrollTimer !== null) return;

    const check = () => {
      const remaining = SCROLL_IDLE_MS - (performance.now() - state.lastScrollAt);

      if (remaining > 0) {
        state.scrollTimer = window.setTimeout(check, remaining);
        return;
      }

      state.scrollTimer = null;
      state.scrolling = false;
      root().classList.remove(SCROLL_CLASS);
      log("scroll boost off");
    };

    state.scrollTimer = window.setTimeout(check, SCROLL_IDLE_MS);
  }

  function markScrolling() {
    state.lastScrollAt = performance.now();

    if (!state.scrolling) {
      state.scrolling = true;
      state.scrollBursts += 1;
      root().classList.add(SCROLL_CLASS);
      log("scroll boost on");
    }

    endScrollWhenIdle();
  }

  function onScroll() {
    if (state.rafPending) return;

    state.rafPending = true;
    requestAnimationFrame(() => {
      state.rafPending = false;
      markScrolling();
    });
  }

  function installPerformanceHooks() {
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
  }

  async function benchmark(durationMs = 2500) {
    const duration = Math.max(500, Math.min(Number(durationMs) || 2500, 10000));
    const samples = [];

    return new Promise((resolve) => {
      let start = 0;
      let previous = 0;

      const frame = (now) => {
        if (!start) {
          start = now;
          previous = now;
        } else {
          samples.push(now - previous);
          previous = now;
        }

        if (now - start < duration) {
          requestAnimationFrame(frame);
          return;
        }

        const sorted = [...samples].sort((a, b) => a - b);
        const total = samples.reduce((sum, value) => sum + value, 0);
        const avgMs = samples.length ? total / samples.length : 0;
        const medianMs = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
        const p95Ms = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
        const worstMs = sorted.length ? sorted[sorted.length - 1] : 0;
        const estimatedFps = avgMs ? 1000 / avgMs : 0;
        const stutterThreshold = medianMs ? medianMs * 1.8 : Infinity;
        const stutterFrames = samples.filter((value) => value > stutterThreshold).length;

        const result = {
          durationMs: Math.round(duration),
          frames: samples.length,
          estimatedFps: Number(estimatedFps.toFixed(1)),
          averageFrameMs: Number(avgMs.toFixed(2)),
          medianFrameMs: Number(medianMs.toFixed(2)),
          p95FrameMs: Number(p95Ms.toFixed(2)),
          worstFrameMs: Number(worstMs.toFixed(2)),
          stutterFrames,
        };

        console.table(result);
        resolve(result);
      };

      requestAnimationFrame(frame);
    });
  }

  async function profileLongTasks(durationMs = 5000) {
    const duration = Math.max(1000, Math.min(Number(durationMs) || 5000, 30000));

    if (!("PerformanceObserver" in window)) {
      console.warn(`[${NAME}] PerformanceObserver is unavailable.`);
      return { supported: false, longTasks: [] };
    }

    const supported = PerformanceObserver.supportedEntryTypes?.includes("longtask");
    if (!supported) {
      console.warn(`[${NAME}] Long Task API is unavailable in this Spotify build.`);
      return { supported: false, longTasks: [] };
    }

    const longTasks = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push({
          startTime: Number(entry.startTime.toFixed(1)),
          duration: Number(entry.duration.toFixed(1)),
        });
      }
    });

    observer.observe({ entryTypes: ["longtask"] });
    await wait(duration);
    observer.disconnect();

    const totalBlockedMs = longTasks.reduce((sum, task) => sum + task.duration, 0);
    const result = {
      supported: true,
      durationMs: duration,
      count: longTasks.length,
      totalBlockedMs: Number(totalBlockedMs.toFixed(1)),
      worstTaskMs: longTasks.length
        ? Math.max(...longTasks.map((task) => task.duration))
        : 0,
      longTasks,
    };

    console.log(`[${NAME}] long-task profile`, result);
    return result;
  }

  function exposeApi() {
    window.Smoothify = Object.freeze({
      version: VERSION,
      status() {
        const status = {
          version: VERSION,
          initialized: state.initialized,
          performanceMode: root().classList.contains(ROOT_CLASS),
          scrolling: state.scrolling,
          scrollBursts: state.scrollBursts,
        };
        console.table(status);
        return status;
      },
      benchmark,
      profileLongTasks,
    });
  }

  async function init() {
    await waitForSpicetify();

    root().classList.add(ROOT_CLASS);
    injectStyles();
    installPerformanceHooks();
    exposeApi();

    state.initialized = true;
    console.log(`[${NAME}] ${VERSION} loaded — performance core active`);
  }

  init().catch((error) => {
    console.error(`[${NAME}] failed to initialize`, error);
  });
})();
