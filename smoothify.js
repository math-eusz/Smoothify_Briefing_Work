(() => {
  "use strict";

  const NAME = "Smoothify";
  const VERSION = "0.2.1-alpha.1";
  const STYLE_ID = "smoothify-performance-core";
  const ROOT_CLASS = "smoothify-performance";
  const SCROLL_CLASS = "smoothify-scrolling";
  const SCROLL_IDLE_MS = 110;
  const IMAGE_ROOT_MARGIN = "900px 350px";
  const DEBUG = false;

  const state = {
    initialized: false,
    scrolling: false,
    scrollBursts: 0,
    lastScrollAt: 0,
    scrollTimer: null,
    rafPending: false,
    warmedImages: 0,
    imageCandidates: 0,
    mutationRoots: new Set(),
    mutationFlushPending: false,
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const root = () => document.documentElement;

  let imageObserver = null;
  let mutationObserver = null;

  function log(...args) {
    if (DEBUG) console.log(`[${NAME}]`, ...args);
  }

  async function waitForSpicetify() {
    while (!window.Spicetify?.Platform) {
      await wait(100);
    }
  }

  function injectPreconnect(href) {
    if (document.querySelector(`link[data-smoothify-preconnect="${href}"]`)) return;

    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    link.crossOrigin = "anonymous";
    link.dataset.smoothifyPreconnect = href;
    document.head.appendChild(link);
  }

  function installNetworkHints() {
    // Spotify commonly serves artwork from these CDN families. If one is unused,
    // a preconnect is still cheap; if used, it can remove part of connection setup.
    injectPreconnect("https://i.scdn.co");
    injectPreconnect("https://mosaic.scdn.co");
    injectPreconnect("https://image-cdn-ak.spotifycdn.com");
  }

  function injectStyles() {
    const previous = document.getElementById(STYLE_ID);
    if (previous) previous.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --smoothify-hover: 55ms;
        --smoothify-press: 32ms;
        --smoothify-menu: 70ms;
        --smoothify-ease: cubic-bezier(.2,.8,.2,1);
      }

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

      /* Kill native hover delays on the hot interactive paths. */
      html.${ROOT_CLASS} button,
      html.${ROOT_CLASS} [role="button"],
      html.${ROOT_CLASS} a[href],
      html.${ROOT_CLASS} [data-testid*="button"],
      html.${ROOT_CLASS} [data-testid="card-click-handler"],
      html.${ROOT_CLASS} .main-card-card,
      html.${ROOT_CLASS} .main-card-cardContainer,
      html.${ROOT_CLASS} .main-yourLibraryX-listRow,
      html.${ROOT_CLASS} .main-trackList-trackListRow {
        transition-delay: 0ms !important;
      }

      html.${ROOT_CLASS} button:not(:disabled),
      html.${ROOT_CLASS} [role="button"],
      html.${ROOT_CLASS} a[href],
      html.${ROOT_CLASS} [data-testid*="button"] {
        transition-property: transform, opacity, background-color, color !important;
        transition-duration: var(--smoothify-hover) !important;
        transition-timing-function: var(--smoothify-ease) !important;
      }

      /* Tiny compositor-only hover response: visible immediately, not bouncy. */
      html.${ROOT_CLASS} button:hover:not(:disabled),
      html.${ROOT_CLASS} [role="button"]:hover,
      html.${ROOT_CLASS} [data-testid*="button"]:hover {
        transform: scale(1.012);
      }

      html.${ROOT_CLASS} button:active:not(:disabled),
      html.${ROOT_CLASS} [role="button"]:active,
      html.${ROOT_CLASS} [data-testid*="button"]:active,
      html.${ROOT_CLASS} [data-testid="control-button-playpause"]:active,
      html.${ROOT_CLASS} [data-testid="control-button-skip-forward"]:active,
      html.${ROOT_CLASS} [data-testid="control-button-skip-back"]:active {
        transform: scale(.972);
        transition-duration: var(--smoothify-press) !important;
        transition-delay: 0ms !important;
      }

      /* Cards react fast, but use a smaller scale to avoid repaints/jank. */
      html.${ROOT_CLASS} [data-testid="card-click-handler"],
      html.${ROOT_CLASS} .main-card-card,
      html.${ROOT_CLASS} .main-card-cardContainer {
        transition-property: transform, background-color, opacity !important;
        transition-duration: 65ms !important;
        transition-delay: 0ms !important;
        transition-timing-function: var(--smoothify-ease) !important;
      }

      html.${ROOT_CLASS} [data-testid="card-click-handler"]:hover,
      html.${ROOT_CLASS} .main-card-card:hover,
      html.${ROOT_CLASS} .main-card-cardContainer:hover {
        transform: scale(1.008);
      }

      /* Remove animation work while scrolling through repeated content. */
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

      html.${ROOT_CLASS} [role="menu"],
      html.${ROOT_CLASS} [data-tippy-root] > div,
      html.${ROOT_CLASS} [role="dialog"] {
        animation-delay: 0ms !important;
        transition-delay: 0ms !important;
        animation-duration: var(--smoothify-menu) !important;
        transition-duration: var(--smoothify-menu) !important;
      }

      @media (prefers-reduced-motion: reduce) {
        html.${ROOT_CLASS} *,
        html.${ROOT_CLASS} *::before,
        html.${ROOT_CLASS} *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
          transition-delay: 0ms !important;
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
    };

    state.scrollTimer = window.setTimeout(check, SCROLL_IDLE_MS);
  }

  function markScrolling() {
    state.lastScrollAt = performance.now();

    if (!state.scrolling) {
      state.scrolling = true;
      state.scrollBursts += 1;
      root().classList.add(SCROLL_CLASS);
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

  function warmImage(img, urgent = false) {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.smoothifyWarmed === "1") return;

    img.dataset.smoothifyWarmed = "1";
    state.warmedImages += 1;

    try {
      img.decoding = "async";
      img.loading = "eager";
      img.fetchPriority = urgent ? "high" : "auto";
    } catch (_) {}

    if (img.complete && img.naturalWidth > 0) {
      img.decode?.().catch(() => {});
      return;
    }

    img.addEventListener(
      "load",
      () => {
        img.decode?.().catch(() => {});
      },
      { once: true, passive: true }
    );
  }

  function observeImage(img) {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.smoothifyObserved === "1") return;

    img.dataset.smoothifyObserved = "1";
    state.imageCandidates += 1;

    if (imageObserver) {
      imageObserver.observe(img);
      return;
    }

    const rect = img.getBoundingClientRect();
    const nearViewport = rect.bottom > -900 && rect.top < innerHeight + 900;
    if (nearViewport) warmImage(img, rect.top >= 0 && rect.top <= innerHeight);
  }

  function scanImages(scope) {
    if (!(scope instanceof Element) && scope !== document) return;

    if (scope instanceof HTMLImageElement) observeImage(scope);

    const images = scope.querySelectorAll?.("img");
    if (!images) return;
    for (const img of images) observeImage(img);
  }

  function flushMutationRoots() {
    state.mutationFlushPending = false;

    const roots = [...state.mutationRoots];
    state.mutationRoots.clear();

    // Process only actual newly-added subtrees. No attribute observation and no polling.
    for (const node of roots) scanImages(node);
  }

  function queueMutationRoot(node) {
    if (!(node instanceof Element)) return;
    state.mutationRoots.add(node);

    if (state.mutationFlushPending) return;
    state.mutationFlushPending = true;
    requestAnimationFrame(flushMutationRoots);
  }

  function installArtworkWarmup() {
    if ("IntersectionObserver" in window) {
      imageObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;

            const img = entry.target;
            const rect = img.getBoundingClientRect();
            const urgent = rect.top >= 0 && rect.top <= innerHeight;
            warmImage(img, urgent);
            imageObserver.unobserve(img);
          }
        },
        {
          root: null,
          rootMargin: IMAGE_ROOT_MARGIN,
          threshold: 0.01,
        }
      );
    }

    scanImages(document);

    mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) queueMutationRoot(node);
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });
  }

  function onPointerOver(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const hotArea = target.closest(
      '[data-testid="card-click-handler"], .main-card-card, .main-card-cardContainer, button, [role="button"]'
    );
    if (!hotArea) return;

    const img = hotArea.querySelector("img");
    if (img) warmImage(img, true);
  }

  function installPerformanceHooks() {
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });

    document.addEventListener("pointerover", onPointerOver, {
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
      return { supported: false, longTasks: [] };
    }

    const supported = PerformanceObserver.supportedEntryTypes?.includes("longtask");
    if (!supported) return { supported: false, longTasks: [] };

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
          imageCandidates: state.imageCandidates,
          warmedImages: state.warmedImages,
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
    installNetworkHints();
    injectStyles();
    installPerformanceHooks();
    installArtworkWarmup();
    exposeApi();

    state.initialized = true;
    console.log(`[${NAME}] ${VERSION} loaded — instant hover + artwork warmup active`);
  }

  init().catch((error) => {
    console.error(`[${NAME}] failed to initialize`, error);
  });
})();
