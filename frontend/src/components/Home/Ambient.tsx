/**
 * The landing page's background — the port of frontend/js/home-ambient.js.
 *
 * One fixed layer behind everything, holding four quiet things: a grid, a slow
 * colour gradient, a field of drifting particles, and a glow that follows the
 * cursor. The first two are pure CSS (styles/home-motion.css); this renders the
 * layer, runs the particle canvas, and moves the glow.
 *
 * The rules it plays by, because a background that costs anything is a
 * background that should not exist:
 *
 *   one canvas, one rAF loop, and the loop stops entirely when the tab is
 *   hidden or the page is scrolled past the point where particles are visible;
 *   the glow is moved with a transform on a promoted layer, never with top/left,
 *   and it eases toward the pointer instead of tracking it exactly, so it reads
 *   as light rather than as a cursor;
 *   nothing runs at all when the machine asks for less motion, or on a device
 *   with no fine pointer (the glow).
 *
 * Unlike the original this is a real element in the tree rather than a div
 * inserted at the top of <body>, so it comes and goes with the page instead of
 * outliving it — leaving a canvas running behind /dashboard was never the
 * intent, it just could not be expressed before.
 */
import { useEffect, useRef, useState } from 'react';
import { reduced } from '@/utils/homePlay';

/** Enough to read as a field and cheap enough to be free; fewer where they crowd. */
const PARTICLES = typeof window !== 'undefined' && window.innerWidth < 720 ? 18 : 40;

interface Dot {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
}

export function Ambient() {
  const layer = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  /** Fades the whole layer in one beat after the page itself arrives. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), reduced ? 0 : 260);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (reduced) return;
    return startParticles(canvas.current);
  }, []);

  useEffect(() => {
    if (reduced) return;
    return startCursorGlow(glow.current);
  }, []);

  return (
    <div
      className={`hm-ambient${ready ? ' hm-ready' : ''}${reduced ? '' : ' hm-animate'}`}
      ref={layer}
      aria-hidden="true"
    >
      <div className="hm-gradient" />
      <div className="hm-grid" />
      <canvas className="hm-particles" ref={canvas} />
      <div className="hm-cursor" ref={glow} />
    </div>
  );
}

function startParticles(canvas: HTMLCanvasElement | null): (() => void) | undefined {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  let dots: Dot[] = [];
  let w = 0;
  let h = 0;
  let frame: number | null = null;
  let last = 0;

  /**
   * Returns false when there is nothing to measure yet. A canvas sized while
   * the page is laid out at zero — loaded in a background tab, or in a window
   * that has not been presented — stays zero for good otherwise, and the field
   * never appears. The draw loop retries.
   */
  function resize(): boolean {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas!.clientWidth || window.innerWidth || 0;
    h = canvas!.clientHeight || window.innerHeight || 0;
    if (!w || !h) return false;
    canvas!.width = Math.round(w * dpr);
    canvas!.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function seed() {
    dots = [];
    for (let i = 0; i < PARTICLES; i++) {
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.8 + Math.random() * 1.6,
        // Pixels per second. Slow: a dot crosses the screen in about two minutes.
        vx: (Math.random() - 0.5) * 12,
        vy: -4 - Math.random() * 10,
        a: 0.1 + Math.random() * 0.22,
      });
    }
  }

  function colour(): string {
    return document.documentElement.getAttribute('data-theme') === 'dark'
      ? '255, 255, 255'
      : '30, 41, 59';
  }

  function draw(now: number) {
    frame = requestAnimationFrame(draw);

    // Nothing measurable yet — try again next frame rather than drawing into a
    // zero-sized canvas forever.
    if (!w || !h) {
      if (!resize()) return;
      seed();
    }

    if (!last) last = now;
    // Seconds since the last frame, clamped so a backgrounded tab does not
    // teleport every dot when it comes back.
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    ctx!.clearRect(0, 0, w, h);
    const rgb = colour();
    dots.forEach((d) => {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      // Off one edge, back on the other.
      if (d.y < -8) {
        d.y = h + 8;
        d.x = Math.random() * w;
      }
      if (d.x < -8) d.x = w + 8;
      if (d.x > w + 8) d.x = -8;

      ctx!.beginPath();
      ctx!.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(${rgb},${d.a})`;
      ctx!.fill();
    });
  }

  function play() {
    if (frame) return;
    last = 0;
    frame = requestAnimationFrame(draw);
  }
  function pause() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = null;
  }

  if (resize()) seed();
  play();

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const onResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (resize()) seed();
    }, 150);
  };
  window.addEventListener('resize', onResize);

  // A hidden tab paints nothing, and neither should this.
  const onVisibility = () => (document.hidden ? pause() : play());
  document.addEventListener('visibilitychange', onVisibility);

  // The layer is fixed, so once the reader is a couple of screens down the dots
  // are still being drawn behind content that covers them. Stop there and pick
  // up again on the way back.
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  const onScroll = () => {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (window.scrollY > window.innerHeight * 2) pause();
      else if (!document.hidden) play();
    }, 120);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    pause();
    if (resizeTimer) clearTimeout(resizeTimer);
    if (scrollTimer) clearTimeout(scrollTimer);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

function startCursorGlow(glow: HTMLDivElement | null): (() => void) | undefined {
  if (!glow) return;
  // Touch and pen have no hovering cursor to follow.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let tx = 0;
  let ty = 0; // where the pointer is
  let cx = 0;
  let cy = 0; // where the light has got to
  let running = false;
  let seen = false;
  let frame: number | null = null;

  function loop() {
    // Ease a tenth of the remaining distance each frame: the light trails the
    // cursor slightly instead of being welded to it.
    cx += (tx - cx) * 0.1;
    cy += (ty - cy) * 0.1;
    glow!.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
    // Close enough to stopped — park the loop until the pointer moves.
    if (Math.abs(tx - cx) < 0.4 && Math.abs(ty - cy) < 0.4) {
      running = false;
      frame = null;
      return;
    }
    frame = requestAnimationFrame(loop);
  }

  const onMove = (event: PointerEvent) => {
    tx = event.clientX;
    ty = event.clientY;
    if (!seen) {
      // First sighting: drop the light straight onto the pointer rather than
      // sliding it in from the corner.
      seen = true;
      cx = tx;
      cy = ty;
      glow.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      glow.classList.add('hm-cursor-on');
    }
    if (!running) {
      running = true;
      frame = requestAnimationFrame(loop);
    }
  };
  const onLeave = () => glow.classList.remove('hm-cursor-on');
  const onEnter = () => {
    if (seen) glow.classList.add('hm-cursor-on');
  };

  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  document.addEventListener('pointerenter', onEnter);

  return () => {
    if (frame) cancelAnimationFrame(frame);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('pointerenter', onEnter);
  };
}
