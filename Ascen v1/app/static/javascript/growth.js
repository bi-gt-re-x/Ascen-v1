// Combined Growth Analytics JavaScript (FIXED VERSION)

// === TOP-LEVEL SCOPE: shared between DOMContentLoaded and event handlers ===
let growthCanvas, dailyXpCanvas, avgTaskXpCanvas;
let growthCtx, dailyXpCtx, avgTaskXpCtx;

let chartData = {
    labels: [],
    dates: [],
    values: [],
    cumulativeValues: [],
    avgTaskValues: []
};

// Consistent plot padding, shared by the chart drawing and the hover tooltip
// so the crosshair lines up exactly with the rendered line.
const CHART_PAD = { left: 54, right: 24, top: 24, bottom: 38 };

// For brand-new accounts (created < 3 days ago) the chart isn't meaningful yet,
// so instead of drawing it we show a placeholder message. Set from the API's
// days_since_creation in loadGrowthData().
let showChartPlaceholder = false;

let zoomState = {
    cumulative: {},
    daily: {},
    avgTask: {}
};

// ============================================================
// UTILITIES
// ============================================================

function formatNumber(value) {
    if (value === 0) return '0';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e30) return sign + Math.round(abs / 1e30) + 'SP';
    if (abs >= 1e27) return sign + Math.round(abs / 1e27) + 'SE';
    if (abs >= 1e24) return sign + Math.round(abs / 1e24) + 'QI';
    if (abs >= 1e21) return sign + Math.round(abs / 1e21) + 'Q';
    if (abs >= 1e18) return sign + Math.round(abs / 1e18) + 'T';
    if (abs >= 1e15) return sign + Math.round(abs / 1e15) + 'B';
    if (abs >= 1e12) return sign + Math.round(abs / 1e12) + 'M';
    if (abs >= 1e9)  return sign + Math.round(abs / 1e9)  + 'B';
    if (abs >= 1e6)  return sign + Math.round(abs / 1e6)  + 'M';
    if (abs >= 1e4)  return sign + Math.round(abs / 1e3)  + 'K';
    if (abs >= 1e3)  return sign + (abs / 1e3).toFixed(1) + 'K';
    return sign + Math.round(value).toString();
}

// Rounded whole number with thousands separators, e.g. 7165 -> "7,165".
function formatInt(value) {
    return Math.round(value || 0).toLocaleString('en-US');
}

// Compute "nice", evenly-rounded y-axis tick values up to just above maxValue.
function niceTicks(maxValue, targetCount) {
    if (!(maxValue > 0)) return { ticks: [0, 1], niceMax: 1 };
    const rawStep = maxValue / targetCount;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    let step;
    if (norm <= 1) step = 1;
    else if (norm <= 2) step = 2;
    else if (norm <= 5) step = 5;
    else step = 10;
    step *= mag;
    const niceMax = Math.ceil(maxValue / step) * step;
    const ticks = [];
    for (let v = 0; v <= niceMax + step * 0.001; v += step) ticks.push(Math.round(v));
    return { ticks, niceMax };
}

// Short axis label, e.g. "Aug 14"
function formatDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Full tooltip label, e.g. "Aug 14, 2023"
function formatDateFull(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Rounded rectangle path (ctx.roundRect isn't available in every browser).
function roundRectPath(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
        return;
    }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Trace a smooth curve through the points using quadratic midpoints.
function traceCurve(ctx, pts) {
    if (!pts.length) return;
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length < 3) {
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        return;
    }
    for (let i = 0; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
}

function getBundleSize(maxValue, minStep = 1) {
    if (maxValue <= 0) return minStep;
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
    const ratio = maxValue / magnitude;
    let size;
    if (ratio <= 1.5)      size = magnitude / 5;
    else if (ratio <= 3.5) size = magnitude / 2;
    else if (ratio <= 7)   size = magnitude;
    else                   size = magnitude * 2;
    return Math.max(size, minStep);
}

function initializeZoomState(type, total) {
    zoomState[type] = {
        startIndex: 0,
        endIndex: Math.max(0, total - 1),
        level: 0,
        anchorIndex: Math.floor(total / 2) // Store the zoom anchor point
    };
    
    // Ensure endIndex is at least 0 for new accounts
    if (total === 0) {
        zoomState[type].endIndex = 0;
    }
}

// ============================================================
// DRAWING
// ============================================================

// Compute the plot geometry (scaled points, axis max, etc.) for a chart type.
// Shared by drawChart and the hover handler so the crosshair lines up exactly.
function computeGeometry(type) {
    const configs = {
        cumulative: { canvas: growthCanvas,    ctx: growthCtx,    key: 'cumulativeValues', minStep: 1000 },
        daily:      { canvas: dailyXpCanvas,   ctx: dailyXpCtx,   key: 'values',           minStep: 50 },
        avgTask:    { canvas: avgTaskXpCanvas,  ctx: avgTaskXpCtx, key: 'avgTaskValues',    minStep: 5 }
    };

    const cfg = configs[type];
    if (!cfg) return null;
    const { canvas, ctx, key, minStep } = cfg;
    const state = zoomState[type];
    if (!canvas || !ctx || !state || state.startIndex > state.endIndex) return null;

    const dates  = chartData.dates.slice(state.startIndex, state.endIndex + 1);
    const values = chartData[key].slice(state.startIndex, state.endIndex + 1);

    const positive = values.filter(v => v > 0);
    const maxValue = positive.length ? Math.max(...positive) : 0;

    // Round y-axis to clean tick values with a little headroom above the peak.
    const rawMax = maxValue > 0 ? maxValue * 1.1 : (minStep >= 1000 ? 200 : minStep * 4);
    const { ticks, niceMax } = niceTicks(rawMax, 6);
    const finalMax = niceMax > 0 ? niceMax : 1;

    const plotW = canvas.width - CHART_PAD.left - CHART_PAD.right;
    const plotH = canvas.height - CHART_PAD.top - CHART_PAD.bottom;
    const baseY = canvas.height - CHART_PAD.bottom;
    const xStep = values.length > 1 ? plotW / (values.length - 1) : 0;
    const yScale = plotH / finalMax;

    const points = values.map((v, i) => ({
        x: CHART_PAD.left + xStep * i,
        y: baseY - Math.max(0, v) * yScale,
        value: v,
        index: i
    }));

    return { canvas, ctx, dates, values, finalMax, ticks, baseY, xStep, yScale, plotH, points, startIndex: state.startIndex };
}

// Theme-aware palette for the canvas charts. In dark mode the chart sits on the
// dark card, so the line/labels go light and the gridlines become subtle white.
function chartColors() {
    const dark = document.body.classList.contains('dark');
    return dark ? {
        grid: 'rgba(255, 255, 255, 0.12)',
        axis: '#c9d1d9',
        line: '#e6e8f0',
        areaTop: 'rgba(163, 138, 112, 0.55)',
        areaBottom: 'rgba(163, 138, 112, 0.05)',
        marker: '#e6e8f0',
        markerRing: '#161B22',
        crosshair: 'rgba(255, 255, 255, 0.35)',
        tooltipBg: '#161B22',
        tooltipBorder: 'rgba(255, 255, 255, 0.18)',
        tooltipShadow: 'rgba(0, 0, 0, 0.5)',
        tooltipDate: '#e6e8f0',
        tooltipXp: '#c9d1d9',
        empty: '#9aa0b5'
    } : {
        grid: 'rgba(44, 48, 46, 0.08)',
        axis: '#9297ab',
        line: '#2C302E',
        areaTop: 'rgba(163, 138, 112, 0.45)',
        areaBottom: 'rgba(163, 138, 112, 0.03)',
        marker: '#2C302E',
        markerRing: '#ffffff',
        crosshair: 'rgba(44, 48, 46, 0.35)',
        tooltipBg: '#ffffff',
        tooltipBorder: 'rgba(44, 48, 46, 0.18)',
        tooltipShadow: 'rgba(44, 48, 46, 0.2)',
        tooltipDate: '#2C302E',
        tooltipXp: '#5a6072',
        empty: '#9aa0b5'
    };
}

// Blank chart area with a centered message, used for brand-new accounts.
function drawChartPlaceholder(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const col = chartColors();
    ctx.save();
    ctx.fillStyle = col.empty;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Quicksand, sans-serif';
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const lines = ['Growth Chart will show up 3 days', 'after you create your account.'];
    const lineHeight = 24;
    lines.forEach((line, i) => {
        ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * lineHeight);
    });
    ctx.restore();
}

function drawChart(type) {
    // New accounts: don't draw the chart, just show the placeholder text.
    if (showChartPlaceholder) {
        const canvasMap = { cumulative: growthCanvas, daily: dailyXpCanvas, avgTask: avgTaskXpCanvas };
        drawChartPlaceholder(canvasMap[type]);
        return;
    }

    const geo = computeGeometry(type);
    if (!geo) return;
    const { canvas, ctx, dates, values, ticks, baseY, yScale, points } = geo;
    const col = chartColors();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!values.length) {
        ctx.fillStyle = col.empty;
        ctx.font = '16px Quicksand';
        ctx.textAlign = 'center';
        ctx.fillText('Do a task for growth to show', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Horizontal gridlines + rounded y-axis value labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '12px Arial';
    for (const val of ticks) {
        const y = baseY - val * yScale;
        ctx.strokeStyle = col.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(CHART_PAD.left, y);
        ctx.lineTo(canvas.width - CHART_PAD.right, y);
        ctx.stroke();
        ctx.fillStyle = col.axis;
        ctx.fillText(formatInt(val), CHART_PAD.left - 8, y);
    }

    // X-axis date labels (evenly sampled)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = col.axis;
    const n = points.length;
    const maxXLabels = Math.min(8, n);
    const step = Math.max(1, Math.round((n - 1) / Math.max(1, maxXLabels - 1)));
    for (let i = 0; i < n; i += step) {
        ctx.fillText(formatDateShort(dates[i]), points[i].x, baseY + 8);
    }

    const allZero = values.every(v => v === 0);

    // Gradient area fill under the curve
    const grad = ctx.createLinearGradient(0, CHART_PAD.top, 0, baseY);
    grad.addColorStop(0, col.areaTop);
    grad.addColorStop(1, col.areaBottom);
    ctx.beginPath();
    traceCurve(ctx, points);
    ctx.lineTo(points[n - 1].x, baseY);
    ctx.lineTo(points[0].x, baseY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // The smooth line on top
    ctx.beginPath();
    traceCurve(ctx, points);
    ctx.strokeStyle = col.line;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (allZero) {
        ctx.fillStyle = col.empty;
        ctx.font = '16px Quicksand';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Do a task for growth to show', canvas.width / 2, (CHART_PAD.top + baseY) / 2);
    }
}

// Draw the hover crosshair, marker dot and the date/XP tooltip.
function drawHover(geo, idx) {
    const { canvas, ctx, dates, values, baseY, points, startIndex } = geo;
    const p = points[idx];
    if (!p) return;
    const col = chartColors();

    ctx.save();

    // Vertical crosshair
    ctx.strokeStyle = col.crosshair;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, CHART_PAD.top);
    ctx.lineTo(p.x, baseY);
    ctx.stroke();

    // Marker dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = col.marker;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = col.markerRing;
    ctx.stroke();

    // Tooltip text: WHEN it was + HOW MUCH xp (no "/100")
    const dateStr = formatDateFull(dates[idx]) || `Day ${startIndex + idx + 1}`;
    const xpStr = `XP: ${formatInt(values[idx])}`;

    ctx.font = 'bold 12.5px Arial';
    const w1 = ctx.measureText(dateStr).width;
    ctx.font = '12px Arial';
    const w2 = ctx.measureText(xpStr).width;
    const boxW = Math.max(w1, w2 + 14) + 20;
    const boxH = 44;

    let bx = p.x + 14;
    if (bx + boxW > canvas.width - 4) bx = p.x - boxW - 14;
    if (bx < 4) bx = 4;
    let by = p.y - boxH - 12;
    if (by < CHART_PAD.top) by = p.y + 14;

    // Box
    ctx.beginPath();
    roundRectPath(ctx, bx, by, boxW, boxH, 8);
    ctx.fillStyle = col.tooltipBg;
    ctx.shadowColor = col.tooltipShadow;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = col.tooltipBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Date line
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col.tooltipDate;
    ctx.font = 'bold 12.5px Arial';
    ctx.fillText(dateStr, bx + 10, by + 15);

    // XP line with a small colour swatch
    ctx.fillStyle = col.line;
    roundRectAt(ctx, bx + 10, by + 30 - 4, 8, 8, 2);
    ctx.fillStyle = col.tooltipXp;
    ctx.font = '12px Arial';
    ctx.fillText(xpStr, bx + 22, by + 30);

    ctx.restore();
}

// Small filled rounded square (tooltip legend swatch).
function roundRectAt(ctx, x, y, w, h, r) {
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
}

// Draw the mini sparkline preview on the "See Average XP Ratings" card.
function drawRatingsSparkline() {
    const canvas = document.getElementById('ratingsSparkline');
    if (!canvas) return;
    if (showChartPlaceholder) { // new account: keep the sparkline blank too
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }
    const parent = canvas.parentElement;
    const w = Math.max(parent.clientWidth || 240, 80);
    const h = Math.max(parent.clientHeight || 44, 24);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const values = (chartData.cumulativeValues && chartData.cumulativeValues.length)
        ? chartData.cumulativeValues
        : [];
    if (values.length < 2) return;

    const pad = 4;
    const maxV = Math.max(...values, 1);
    const minV = Math.min(...values);
    const range = (maxV - minV) || 1;
    const xStep = (w - pad * 2) / (values.length - 1);
    const pts = values.map((v, i) => ({
        x: pad + xStep * i,
        y: (h - pad) - ((v - minV) / range) * (h - pad * 2)
    }));

    const col = chartColors();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, col.areaTop);
    grad.addColorStop(1, col.areaBottom);
    ctx.beginPath();
    traceCurve(ctx, pts);
    ctx.lineTo(pts[pts.length - 1].x, h);
    ctx.lineTo(pts[0].x, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    traceCurve(ctx, pts);
    ctx.strokeStyle = col.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
}

function drawAll() {
    drawChart('cumulative');
    drawChart('daily');
    drawChart('avgTask');
    drawRatingsSparkline();
}

// ============================================================
// ZOOM  — fixed: zoom-out was blocked because the guard fired
// whenever (endIndex - startIndex) >= total-1, which is true
// at the very first render. Now it only blocks when BOTH
// boundaries are already maxed out.
// ============================================================

function zoomChart(type, direction, event = null) {
    const state = zoomState[type];
    const total = chartData.labels.length;
    if (!state || total === 0) return;

    const currentRange = state.endIndex - state.startIndex;

    if (direction === 'in') {
        if (currentRange <= 5) return; // already at minimum zoom

        let center = Math.floor((state.startIndex + state.endIndex) / 2);
        const newRange = Math.max(5, Math.floor(currentRange * 0.8));

        // Zoom toward mouse position
        if (event) {
            const canvas = event.target;
            const rect   = canvas.getBoundingClientRect();
            const x      = event.clientX - rect.left;
            const padding    = 40;
            const chartWidth = canvas.width - padding * 2;

            if (x >= padding && x <= canvas.width - padding) {
                const currentLabels = chartData.labels.slice(state.startIndex, state.endIndex + 1);
                let closestIdx = 0, minDist = Infinity;
                for (let i = 0; i < currentLabels.length; i++) {
                    const pointX = padding + (chartWidth / Math.max(currentLabels.length - 1, 1)) * i;
                    const dist   = Math.abs(x - pointX);
                    if (dist < minDist) { minDist = dist; closestIdx = i; }
                }
                center = state.startIndex + closestIdx;
            }
        }

        // Keep the window exactly `newRange` wide even when the anchor is near an
        // edge: if one side hits a boundary, shift the other side to preserve the
        // width instead of letting the range collapse. (Collapsing over-zoomed at
        // the edges, so zooming back out took many extra clicks to undo.)
        const halfRange = Math.floor(newRange / 2);
        let start = center - halfRange;
        let end = start + newRange;
        if (start < 0) { end -= start; start = 0; }
        if (end > total - 1) { start -= (end - (total - 1)); end = total - 1; }
        state.startIndex = Math.max(0, start);
        state.endIndex = Math.min(total - 1, end);

    } else if (direction === 'out') {
        // Only stop if BOTH boundaries are already at their limits
        if (state.startIndex === 0 && state.endIndex === total - 1) return;

        // Calculate target range (25% increase)
        const targetRange = Math.min(total - 1, Math.floor(currentRange * 1.25));

        // Calculate available space on each side
        const leftSpace = state.startIndex;
        const rightSpace = total - 1 - state.endIndex;
        const totalAvailableSpace = leftSpace + rightSpace;

        // If no space available, can't zoom out
        if (totalAvailableSpace === 0) return;

        // Calculate needed increase
        const neededIncrease = targetRange - currentRange;

        // If we have enough space, distribute it proportionally
        if (totalAvailableSpace >= neededIncrease) {
            // Distribute space proportionally to available space
            const leftRatio = leftSpace / totalAvailableSpace;
            const rightRatio = rightSpace / totalAvailableSpace;
            
            const leftIncrease = Math.floor(neededIncrease * leftRatio);
            const rightIncrease = neededIncrease - leftIncrease;
            
            state.startIndex = Math.max(0, state.startIndex - leftIncrease);
            state.endIndex = Math.min(total - 1, state.endIndex + rightIncrease);
        } else {
            // Not enough space to reach target, use all available
            state.startIndex = 0;
            state.endIndex = total - 1;
        }
    }

    drawAll();
}

function handleWheel(e, type) {
    e.preventDefault();
    const canvasMap = {
        cumulative: growthCanvas,
        daily:      dailyXpCanvas,
        avgTask:    avgTaskXpCanvas
    };
    const modifiedEvent = {
        target:  canvasMap[type],
        clientX: e.clientX,
        clientY: e.clientY
    };
    zoomChart(type, e.deltaY > 0 ? 'out' : 'in', modifiedEvent);
}

// ============================================================
// TOOLTIP — now in top-level scope so it can see everything
// ============================================================

function handleMouseMove(event, type) {
    if (showChartPlaceholder) return; // no hover on the placeholder
    const geo = computeGeometry(type);
    if (!geo || !geo.points.length) return;

    const { canvas, points } = geo;
    const rect = canvas.getBoundingClientRect();
    // Map screen x to canvas x (the canvas is displayed scaled via CSS).
    const scaleX = rect.width ? canvas.width / rect.width : 1;
    const x = (event.clientX - rect.left) * scaleX;

    // Snap to the nearest data point along the line.
    let idx = 0, minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
        const d = Math.abs(x - points[i].x);
        if (d < minDist) { minDist = d; idx = i; }
    }

    drawChart(type);       // redraw clean first
    drawHover(geo, idx);   // then crosshair + date/XP tooltip
}

function handleMouseLeave(type) {
    drawChart(type);       // clear the hover overlay
}

// ============================================================
// GROWTH RATINGS (report card)
// ============================================================

// The grade -> CSS class list, so we can swap a fresh grade colour onto any
// element without knowing its previous grade.
const GRADE_CLASSES = ['grade-S', 'grade-A', 'grade-B', 'grade-C', 'grade-D', 'grade-F', 'grade-none'];

function applyGradeClass(el, grade) {
    if (!el) return;
    el.classList.remove(...GRADE_CLASSES);
    el.classList.add(grade ? ('grade-' + grade) : 'grade-none');
}

function setRatingText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// Colour + fill a trend element. `compact` is the short card chip ("▲ 12%");
// otherwise the long hero form ("▲ 12% vs Last Week").
function applyTrend(el, trend, compact) {
    if (!el) return;
    el.classList.remove('trend-up', 'trend-down', 'trend-flat');
    if (!trend || trend.direction === 'flat') {
        el.classList.add('trend-flat');
        el.textContent = compact ? '— 0%' : '— No Change vs Last Week';
        return;
    }
    // Clamp the magnitude so a tiny prior week can't print an absurd %.
    const pct = Math.min(Math.abs(trend.pct), 999);
    const arrow = trend.direction === 'up' ? '▲' : '▼';
    el.classList.add(trend.direction === 'up' ? 'trend-up' : 'trend-down');
    el.textContent = compact ? `${arrow} ${pct}%` : `${arrow} ${pct}% vs Last Week`;
}

// Populate one metric card: grade badge (top-right), key metric line, optional
// secondary line, the numeric score, and its week-over-week trend chip. Also
// colours the card + badge by grade.
function renderMetricCard(name, grade, score, keyLine, subLine, trend) {
    setRatingText('grade-' + name, grade || '–');
    setRatingText('score-' + name, (score === null || score === undefined) ? '—' : score);
    setRatingText('key-' + name, keyLine);
    setRatingText('sub-' + name, subLine || '');
    applyGradeClass(document.getElementById('grade-' + name), grade);
    applyGradeClass(document.getElementById('card-' + name), grade);
    applyTrend(document.getElementById('trend-' + name), trend, true);
    const card = document.getElementById('card-' + name);
    if (card) card.classList.toggle('metric-pending', !grade);
}

// Fetch the graded report card from the backend and render it. Called on load
// and whenever the ratings view is shown, so it always reflects fresh data.
async function loadGrowthRatings() {
    const username = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (!username) return;

    let data;
    try {
        const res = await fetch(`/api/get_growth_ratings?username=${encodeURIComponent(username)}`);
        data = await res.json();
    } catch {
        return;
    }
    if (!data || !data.success) return;

    const o = data.overall;
    const m = data.metrics;

    // Overall hero
    setRatingText('overallScore', o.score);
    setRatingText('overallGrade', o.grade);
    setRatingText('overallMessage', o.message);
    applyGradeClass(document.getElementById('overallGrade'), o.grade);
    applyGradeClass(document.getElementById('reportHero'), o.grade);
    applyTrend(document.getElementById('overallTrend'), o.trend, false);

    // Raw-data column shows each metric's primary measured value, concisely.
    // 🚀 Productivity — XP per day
    renderMetricCard('productivity', m.productivity.grade, m.productivity.score,
        `${formatNumber(m.productivity.avg_daily_xp)} XP/day`, '', m.productivity.trend);

    // 🎯 Quality — average task difficulty
    renderMetricCard('quality', m.quality.grade, m.quality.score,
        `${formatNumber(m.quality.avg_task_xp)} XP/task`, '', m.quality.trend);

    // 🔥 Consistency — attendance
    renderMetricCard('consistency', m.consistency.grade, m.consistency.score,
        `${m.consistency.active_days}/${m.consistency.total_days} days`,
        '', m.consistency.trend);

    // ⚡ Efficiency — deadlines met (50%) + time to finish (50%)
    renderMetricCard('efficiency', m.efficiency.grade, m.efficiency.score,
        `${m.efficiency.on_time_pct}% on-time`, '', m.efficiency.trend);
}

window.loadGrowthRatings = loadGrowthRatings;

// ============================================================
// DATA
// ============================================================

function resizeCanvases() {
    const minWidth = 400, minHeight = 300;
    [growthCanvas, dailyXpCanvas, avgTaskXpCanvas].forEach(canvas => {
        if (!canvas) return;
        const parent = canvas.parentElement;
        // Size the drawing buffer to the canvas's own rendered box (it flexes to
        // fill the space under the title), falling back to the parent if hidden.
        const width = Math.max(canvas.clientWidth || parent.clientWidth || minWidth, minWidth);
        const height = Math.max(canvas.clientHeight || parent.clientHeight || minHeight, minHeight);
        canvas.width = width;
        canvas.height = height;
    });
    drawAll();
}

function processData(data) {
    chartData = { labels: [], dates: [], values: [], cumulativeValues: [], avgTaskValues: [], tasks: [] };

    // If no data, create default 7-day chart with 200xp y-cap for new users
    if (!data || data.length === 0) {
        const today = new Date();
        for (let i = 1; i <= 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - (7 - i));
            chartData.labels.push(`Day ${i}`);
            chartData.dates.push(d.toISOString().slice(0, 10));
            chartData.values.push(0);
            chartData.cumulativeValues.push(0);
            chartData.avgTaskValues.push(0);
            chartData.tasks.push(0);
        }
    } else {
        // Use a Set to track unique day numbers to prevent duplicates
        const seenDays = new Set();
        data.forEach(d => {
            const dayKey = d.day_number;
            if (!seenDays.has(dayKey)) {
                seenDays.add(dayKey);
                chartData.labels.push(`Day ${d.day_number}`);
                chartData.dates.push(d.date || '');
                chartData.values.push(d.xp_earned);
                chartData.cumulativeValues.push(d.cumulative_xp);
                chartData.avgTaskValues.push(d.avg_task_xp || 0);
                chartData.tasks.push(d.tasks_completed || 0);
            }
        });
    }
    
    const total = chartData.labels.length;
    ['cumulative', 'daily', 'avgTask'].forEach(t => initializeZoomState(t, total));
    resizeCanvases();
}

function clearChartData() {
    processData([]);
}

async function loadGrowthData() {
    try {
        const username = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
        if (!username) { clearChartData(); return; }

        // Pull the user's real XP history (from completed tasks), not sample data.
        const res  = await fetch(`/api/get_growth_data?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        if (!data.success) throw new Error();
        // New accounts (< 3 days old) show a placeholder instead of the chart.
        showChartPlaceholder = (typeof data.days_since_creation === 'number' && data.days_since_creation < 3);
        processData(data.growth_data);

    } catch {
        console.warn('Failed to load growth data, using default 7-day chart');
        showChartPlaceholder = false;
        processData([]); // Will create default 7-day chart with 0 values
    }
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
    growthCanvas    = document.getElementById('growthChart');
    dailyXpCanvas   = document.getElementById('dailyXpChart');
    avgTaskXpCanvas = document.getElementById('averageXpChart');


    if (!growthCanvas || !dailyXpCanvas || !avgTaskXpCanvas) {
        console.error('Missing canvas elements');
        return;
    }

    growthCtx    = growthCanvas.getContext('2d');
    dailyXpCtx   = dailyXpCanvas.getContext('2d');
    avgTaskXpCtx = avgTaskXpCanvas.getContext('2d');


    // Load the graded report card (the primary view on this page).
    loadGrowthRatings();

    window.addEventListener('resize', resizeCanvases);

    growthCanvas.addEventListener('wheel',    e => handleWheel(e, 'cumulative'), { passive: false });
    dailyXpCanvas.addEventListener('wheel',   e => handleWheel(e, 'daily'),      { passive: false });
    avgTaskXpCanvas.addEventListener('wheel', e => handleWheel(e, 'avgTask'),    { passive: false });

    growthCanvas.addEventListener('mousemove',    e => handleMouseMove(e, 'cumulative'));
    dailyXpCanvas.addEventListener('mousemove',   e => handleMouseMove(e, 'daily'));
    avgTaskXpCanvas.addEventListener('mousemove', e => handleMouseMove(e, 'avgTask'));

    growthCanvas.addEventListener('mouseleave',    () => handleMouseLeave('cumulative'));
    dailyXpCanvas.addEventListener('mouseleave',   () => handleMouseLeave('daily'));
    avgTaskXpCanvas.addEventListener('mouseleave', () => handleMouseLeave('avgTask'));

    setTimeout(loadGrowthData, 100);
    setInterval(loadGrowthData, 30000);

    // Keep the report card fresh as tasks are completed elsewhere.
    setInterval(loadGrowthRatings, 30000);

    // Reload data when page becomes visible (e.g., switching tabs)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            loadGrowthData();
            loadGrowthRatings();
        }
    });

    // Reload data when current user changes (storage event)
    window.addEventListener('storage', (e) => {
        if (e.key === 'currentUser' || e.key === 'currentSessionUser') {
            loadGrowthData();
            loadGrowthRatings();
        }
    });

    window.initializeChart = function (tabName) {
        resizeCanvases();
        drawChart(tabName);
    };

    // Make loadGrowthData globally accessible for api.js
    window.loadGrowthData = loadGrowthData;
    
    // Force initial chart draw after data loads
    setTimeout(() => {
        if (chartData.labels.length > 0) {
            drawChart('cumulative');
            drawChart('daily');
            drawChart('avgTask');
        }
    }, 500);
});