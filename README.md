# Smoothify

Smoothify is a lightweight Spicetify extension focused on responsiveness, perceived speed, and smoother Spotify Desktop interaction.

The project is performance-first. It avoids heavy JavaScript, artificial frame loops, permanent GPU promotion, large blur/filter effects, and broad DOM observers.

## Current status

Current prototype: **v0.2.0-alpha.1**

This version changes direction from visual animation experiments to a small **performance core**.

### What v0.2 does

- keeps the extension event-driven;
- uses no polling loop;
- uses no MutationObserver;
- uses no frame-by-frame animation system;
- disables accidental smooth scrolling in the main Spotify hot paths;
- temporarily removes transitions/animations from repeated rows/cards while the user is actively scrolling;
- keeps menu transition duration short;
- keeps only a tiny click feedback animation;
- provides manual performance tools for testing without running a profiler permanently.

The scrolling optimization uses one passive captured `scroll` listener, one `requestAnimationFrame` gate, and one idle timer. When scrolling stops, the temporary performance class is removed.

## Install / update

Copy the current extension into the Spicetify extension folder:

```bash
cp smoothify.js ~/.config/spicetify/Extensions/smoothify.js
spicetify apply
```

If the extension has not been enabled yet:

```bash
spicetify config extensions smoothify.js
spicetify apply
```

Then fully restart Spotify when necessary.

## Verify

Open Spotify DevTools and check the Console.

Expected log:

```text
[Smoothify] 0.2.0-alpha.1 loaded — performance core active
```

You can also run:

```javascript
Smoothify.status()
```

## Manual benchmark

Smoothify includes a benchmark that only runs when manually requested.

In Spotify DevTools Console:

```javascript
await Smoothify.benchmark(5000)
```

It reports:

- estimated FPS;
- average frame time;
- median frame time;
- p95 frame time;
- worst frame time;
- approximate stutter-frame count.

For a useful comparison, run it while doing the same action before and after enabling Smoothify, such as scrolling the same large playlist.

## Long-task profiler

To look for main-thread stalls:

```javascript
await Smoothify.profileLongTasks(5000)
```

During those five seconds, use Spotify normally or repeatedly perform the action that stutters.

If the current Spotify/Electron build exposes the Long Task API, Smoothify reports the number of long tasks, total blocked time, and worst task duration.

The profiler is not active during normal use.

## Performance philosophy

Smoothify does not try to force 180 FPS with timers.

High-refresh rendering should be left to Chromium/Electron and the compositor. Smoothify instead tries to reduce unnecessary work so the renderer has a better chance of meeting the display refresh interval.

It intentionally avoids permanent `will-change`, `translateZ(0)` on the whole UI, global GPU-layer forcing, JavaScript smooth-scroll engines, and expensive visual effects because these can increase memory use or create new stutter.

## Important limitation

Smoothify can reduce UI-side overhead, but it cannot directly fix Spotify backend/network delays or arbitrary heavy work performed internally by Spotify or other extensions.

Other Spicetify extensions can also cause stutter. Performance testing should therefore compare the same Spotify state with the same set of extensions enabled.

## Roadmap

### v0.2

- performance core;
- scroll-burst optimization;
- manual frame benchmark;
- manual long-task profiler;
- selector refinement based on real Spotify testing.

### Next

- identify the exact UI areas that cause frame spikes;
- refine selectors to the current Spotify build;
- investigate player, sidebar, page navigation, and large playlist behavior separately;
- add optional performance levels only after measurements show a real benefit.

The rule is simple: if an optimization does not measurably help or causes regressions, it should be removed.
