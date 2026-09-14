# Smoothify

Smoothify is a lightweight Spicetify extension focused on perceived speed, responsiveness, and subtle UI motion for Spotify Desktop.

The goal is simple: make Spotify feel faster without adding heavy JavaScript, artificial frame loops, or expensive visual effects.

## Current status

Early prototype: **v0.1.0-alpha.1**

The first version focuses on:

- button hover and press feedback;
- card hover and press feedback;
- sidebar/navigation response;
- menu/popover entry animations;
- short, compositor-friendly CSS transitions;
- reduced-motion support.

No theme, blur system, wallpaper integration, or settings UI is included yet.

## Design priorities

1. Stability
2. Responsiveness
3. Smoothness
4. Low resource usage
5. Visual polish

Smoothify prefers `transform` and `opacity`, avoids frame-by-frame JavaScript animation, and does not attempt to force a specific FPS.

## Install the current prototype

Copy `smoothify.js` to your Spicetify extensions directory:

```bash
mkdir -p ~/.config/spicetify/Extensions
cp smoothify.js ~/.config/spicetify/Extensions/smoothify.js
```

Enable it:

```bash
spicetify config extensions smoothify.js
spicetify apply
```

Then restart Spotify if necessary.

## Development test

After changing `smoothify.js`:

```bash
cp smoothify.js ~/.config/spicetify/Extensions/smoothify.js
spicetify apply
```

Restart or reload Spotify when needed.

## Current preset

The prototype uses the **Fast** preset by default.

Main timing values:

- general transition: 150 ms;
- short interaction transition: 120 ms;
- menu entry: 140 ms;
- active press response: 70 ms.

These values are experimental and will be tuned after real testing inside Spotify.

## Important

Spotify changes its DOM frequently. Smoothify intentionally keeps the first prototype small so selectors can be tested before expanding the extension.

Some selectors in this alpha are intentionally broad and should be refined after testing against the current Spotify Desktop build.

## Roadmap

### v0.1

- buttons;
- cards;
- sidebar;
- menus;
- selector testing and fixes.

### v0.2

- page transitions;
- player controls;
- animation curve tuning.

### v0.3

- Normal / Fast / Ultra / Instant presets;
- persistent settings;
- settings UI.

### Later

- optional smooth scrolling experiments;
- theme compatibility work;
- performance profiling;
- structured TypeScript project if the extension grows enough.
