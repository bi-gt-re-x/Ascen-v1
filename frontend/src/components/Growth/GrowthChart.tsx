/**
 * One canvas chart, with its zoom window, hover and entrance.
 *
 * The drawing lives in utils/growthChart.ts; this owns the things that change
 * — the canvas element, how far the entrance has run, where the wheel has
 * zoomed to, which point the pointer is over — and repaints when any of them
 * does. None of that is React state: a chart that re-rendered the component on
 * every mousemove and every animation frame would be doing sixty renders a
 * second to produce pixels React does not manage anyway.
 *
 * The entrance plays when the chart is chosen, and on the first arrival of
 * data. It deliberately does not play on the 30-second refresh, on zoom, on
 * hover or on resize — a chart quietly re-growing every half minute would be a
 * tic, not an entrance.
 */
import { useCallback, useEffect, useRef } from 'react';
import {
  ANIM_MS,
  computeGeometry,
  drawChart,
  drawHover,
  drawPlaceholder,
  easeOutCubic,
  indexAt,
  zoomWindow,
  type ChartData,
  type ChartType,
  type ZoomWindow,
} from '@/utils/growthChart';

/** The drawing buffer never goes below this, however small the box gets. */
const MIN_WIDTH = 400;
const MIN_HEIGHT = 150;

export interface GrowthChartProps {
  /** The canvas's original id — styles/growth.css sizes them by id. */
  id: string;
  type: ChartType;
  data: ChartData;
  /** Accounts under three days old get the placeholder instead of a chart. */
  placeholder: boolean;
  /** Bumped by the page to replay the entrance. */
  playToken: number;
}

function prefersReducedMotion(): boolean {
  return Boolean(
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
}

export function GrowthChart({
  id,
  type,
  data,
  placeholder,
  playToken,
}: GrowthChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoom = useRef<ZoomWindow>({ startIndex: 0, endIndex: 0 });
  const progress = useRef(0);
  const hovered = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  const total = data.labels.length;

  /** Size the buffer to the rendered box, then paint. */
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (placeholder) {
      drawPlaceholder(canvas);
      return;
    }

    const geo = computeGeometry(
      canvas,
      data,
      type,
      zoom.current,
      progress.current,
    );
    if (!geo) return;
    drawChart(canvas, geo);
    if (hovered.current !== null) drawHover(canvas, geo, hovered.current);
  }, [data, type, placeholder]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    canvas.width = Math.max(
      canvas.clientWidth || parent?.clientWidth || MIN_WIDTH,
      MIN_WIDTH,
    );
    canvas.height = Math.max(
      canvas.clientHeight || parent?.clientHeight || MIN_HEIGHT,
      MIN_HEIGHT,
    );
    paint();
  }, [paint]);

  // The window resets to the whole series whenever the series changes length —
  // a zoom into indices that no longer exist is worse than starting wide.
  useEffect(() => {
    zoom.current = { startIndex: 0, endIndex: Math.max(0, total - 1) };
  }, [total]);

  // The entrance. `playToken` changing is the page saying "play it".
  useEffect(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (prefersReducedMotion()) {
      progress.current = 1;
      paint();
      return;
    }
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / ANIM_MS);
      progress.current = easeOutCubic(t);
      paint();
      if (t < 1) raf.current = requestAnimationFrame(step);
      else raf.current = null;
    };
    progress.current = 0;
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [playToken, paint]);

  // Repaint on data, size and theme. The theme one matters because the colours
  // are read at paint time, not from CSS the browser could re-cascade.
  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    const observer = new MutationObserver(() => paint());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    document.addEventListener('themechange', paint);
    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      document.removeEventListener('themechange', paint);
    };
  }, [resize, paint]);

  const onMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || placeholder) return;
      const geo = computeGeometry(
        canvas,
        data,
        type,
        zoom.current,
        progress.current,
      );
      if (!geo) return;
      const rect = canvas.getBoundingClientRect();
      // The buffer and the box can differ in size; map the pointer into buffer
      // space or the crosshair drifts from the cursor on a scaled canvas.
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const idx = indexAt(geo, x);
      if (idx === hovered.current) return;
      hovered.current = idx;
      drawChart(canvas, geo);
      drawHover(canvas, geo, idx);
    },
    [data, type, placeholder],
  );

  const onLeave = useCallback(() => {
    if (hovered.current === null) return;
    hovered.current = null;
    paint();
  }, [paint]);

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || placeholder || total === 0) return;
      event.preventDefault();
      const geo = computeGeometry(
        canvas,
        data,
        type,
        zoom.current,
        progress.current,
      );
      if (!geo) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const anchor = zoom.current.startIndex + indexAt(geo, x);
      zoom.current = zoomWindow(
        zoom.current,
        event.deltaY < 0 ? 'in' : 'out',
        total,
        anchor,
      );
      paint();
    },
    [data, type, placeholder, total, paint],
  );

  return (
    <canvas
      id={id}
      ref={canvasRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onWheel={onWheel}
    />
  );
}
