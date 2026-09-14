(() => {
  const NAME = "Smoothify";
  const VERSION = "0.1.0-alpha.1";
  const STYLE_ID = "smoothify-v01-styles";
  const ROOT_CLASS = "smoothify-fast";
  const DEBUG = false;

  const log = (...args) => {
    if (DEBUG) console.log(`[${NAME}]`, ...args);
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
        --smoothify-duration-normal: 220ms;
        --smoothify-duration-fast: 150ms;
        --smoothify-duration-ultra: 90ms;
        --smoothify-duration: var(--smoothify-duration-fast);
        --smoothify-duration-short: 120ms;
        --smoothify-duration-menu: 140ms;
        --smoothify-ease: cubic-bezier(.2,.8,.2,1);
        --smoothify-ease-out: cubic-bezier(.16,1,.3,1);
        --smoothify-hover-scale: 1.025;
        --smoothify-active-scale: .97;
        --smoothify-card-scale: 1.012;
        --smoothify-menu-offset: 5px;
      }

      html.smoothify-normal,
      body.smoothify-normal {
        --smoothify-duration: var(--smoothify-duration-normal);
      }

      html.smoothify-fast,
      body.smoothify-fast {
        --smoothify-duration: var(--smoothify-duration-fast);
      }

      html.smoothify-ultra,
      body.smoothify-ultra {
        --smoothify-duration: var(--smoothify-duration-ultra);
      }

      html.smoothify-instant,
      body.smoothify-instant {
        --smoothify-duration: 0ms;
        --smoothify-duration-short: 0ms;
        --smoothify-duration-menu: 0ms;
      }

      /* Buttons and interactive controls */
      button,
      [role="button"],
      [data-testid*="button"],
      [data-encore-id="buttonPrimary"],
      [data-encore-id="buttonSecondary"],
      [data-encore-id="buttonTertiary"] {
        transition:
          transform var(--smoothify-duration-short) var(--smoothify-ease),
          opacity var(--smoothify-duration-short) ease,
          background-color var(--smoothify-duration-short) ease,
          color var(--smoothify-duration-short) ease !important;
      }

      button:hover:not(:disabled),
      [role="button"]:hover,
      [data-testid*="button"]:hover,
      [data-encore-id="buttonPrimary"]:hover,
      [data-encore-id="buttonSecondary"]:hover,
      [data-encore-id="buttonTertiary"]:hover {
        transform: scale(var(--smoothify-hover-scale));
      }

      button:active:not(:disabled),
      [role="button"]:active,
      [data-testid*="button"]:active,
      [data-encore-id="buttonPrimary"]:active,
      [data-encore-id="buttonSecondary"]:active,
      [data-encore-id="buttonTertiary"]:active {
        transform: scale(var(--smoothify-active-scale));
        transition-duration: 70ms !important;
      }

      /* Cards — intentionally conservative in V0.1 */
      [data-testid="card-click-handler"],
      [data-testid*="card"] [role="button"],
      [class*="Card"] [role="button"] {
        transition:
          transform var(--smoothify-duration) var(--smoothify-ease),
          opacity var(--smoothify-duration-short) ease,
          background-color var(--smoothify-duration-short) ease !important;
        transform-origin: center center;
      }

      [data-testid="card-click-handler"]:hover,
      [data-testid*="card"] [role="button"]:hover,
      [class*="Card"] [role="button"]:hover {
        transform: scale(var(--smoothify-card-scale));
      }

      [data-testid="card-click-handler"]:active,
      [data-testid*="card"] [role="button"]:active,
      [class*="Card"] [role="button"]:active {
        transform: scale(.985);
        transition-duration: 70ms !important;
      }

      /* Sidebar / navigation */
      nav a,
      nav [role="button"],
      [data-testid*="sidebar"] a,
      [data-testid*="sidebar"] [role="button"],
      [data-testid*="library"] [role="button"] {
        transition:
          transform var(--smoothify-duration-short) var(--smoothify-ease),
          opacity var(--smoothify-duration-short) ease,
          background-color var(--smoothify-duration-short) ease,
          color var(--smoothify-duration-short) ease !important;
      }

      nav a:hover,
      [data-testid*="sidebar"] a:hover {
        transform: translateX(2px);
      }

      /* Menus / popovers. Only animate entry; never delay interaction. */
      [role="menu"],
      [data-testid*="menu"],
      [data-tippy-root] > div {
        animation: smoothify-menu-in var(--smoothify-duration-menu) var(--smoothify-ease-out) both;
        transform-origin: top center;
      }

      @keyframes smoothify-menu-in {
        from {
          opacity: 0;
          transform: translateY(var(--smoothify-menu-offset)) scale(.985);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      /* Keep images crisp and avoid unnecessary paint-heavy effects. */
      img,
      svg {
        backface-visibility: hidden;
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
          scroll-behavior: auto !important;
        }
      }
    `;

    document.head.appendChild(style);
    log("styles injected");
  }

  function applyPreset() {
    document.documentElement.classList.add(ROOT_CLASS);
    document.body?.classList.add(ROOT_CLASS);
    log("preset: Fast");
  }

  async function init() {
    await waitForSpicetify();
    injectStyles();
    applyPreset();

    console.log(`[${NAME}] ${VERSION} loaded`);
  }

  init().catch((error) => {
    console.error(`[${NAME}] failed to initialize`, error);
  });
})();
