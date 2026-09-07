/**
 * The page's two pictures, drawn rather than fetched.
 *
 * The design puts a mountain range along the hero and a photograph of a summit
 * behind the quote. Both are here as inline SVG, and that is a deliberate
 * choice rather than a shortcut: a photograph would be a binary in the repo, a
 * request on every load, a licence to keep track of, and a fixed set of colours
 * that cannot follow the theme. These take their palette from the page's own
 * tokens, so they turn dark with everything else and cost nothing to send.
 *
 * Both are `aria-hidden`: they carry no information, and a screen reader
 * announcing "mountains" between the timer and the quote would be reading out
 * the wallpaper.
 */

// ---------------------------------------------------------------------------
// Drawing a range
// ---------------------------------------------------------------------------
/** A point on a ridgeline. */
type Point = readonly [number, number];

/**
 * A ridgeline as a closed shape, from the summits and saddles it passes through.
 *
 * The first and last points sit on the card's edges and stay square; every
 * point between them is rounded, and by how much depends on which kind it is.
 * A summit — lower `y` than both its neighbours — gets a small radius, because
 * a peak is very nearly a corner and rounding it off is what turned the old
 * paths into hills. A saddle gets a large one: the floor of a valley is where
 * scree collects, and it is the one part of a mountain that really is a curve.
 *
 * That asymmetry is the whole trick. The previous version of this was a
 * polyline, which draws the same corner at the top and the bottom and reads as
 * a sawtooth from across the room. Same points, two radii, and it reads as
 * rock.
 */
function ridge(points: readonly Point[], floor: number): string {
  const at = (n: number) => points[n]!;
  const [firstX, firstY] = at(0);
  const [lastX] = at(points.length - 1);

  // How far back from a corner the curve starts, never more than it has room
  // for — a short segment between two close peaks must not round past its own
  // midpoint, or the two curves cross and the ridge folds over itself.
  const toward = ([x, y]: Point, [tx, ty]: Point, want: number): Point => {
    const span = Math.hypot(tx - x, ty - y);
    const step = Math.min(want, span / 2) / (span || 1);
    return [x + (tx - x) * step, y + (ty - y) * step];
  };

  let d = `M${firstX} ${firstY}`;
  for (let n = 1; n < points.length - 1; n += 1) {
    const here = at(n);
    const summit = here[1] < at(n - 1)[1] && here[1] < at(n + 1)[1];
    const want = summit ? 3.5 : 13;
    const [ix, iy] = toward(here, at(n - 1), want);
    const [ox, oy] = toward(here, at(n + 1), want);
    d += ` L${ix.toFixed(1)} ${iy.toFixed(1)} Q${here[0]} ${here[1]} ${ox.toFixed(1)} ${oy.toFixed(1)}`;
  }
  const [endX, endY] = at(points.length - 1);
  return `${d} L${endX} ${endY} L${lastX} ${floor} L${firstX} ${floor} Z`;
}

/**
 * The snow lying on a summit, hanging down its lee side.
 *
 * Ragged rather than triangular, and asymmetric — snow sits where the wind
 * does not reach, so a cap that is the same on both flanks looks drawn and one
 * that spills down one side looks seen. `size` is the drop in user units.
 */
function cap([x, y]: Point, size: number): string {
  const s = size / 20;
  return `M${x} ${y} l${20 * s} ${15 * s} l${-8 * s} ${2 * s}`
    + ` l${-6 * s} ${-4 * s} l${-7 * s} ${5 * s} l${-8 * s} ${-2 * s} Z`;
}

// The three ridgelines, far to near. They share no x positions on purpose: a
// near summit sitting directly under a far one reads as one mountain with a
// stripe, and the point of three layers is that they are three places.
const FAR: Point[] = [
  [-8, 128], [34, 100], [72, 120], [118, 88], [166, 116], [216, 92],
  [268, 118], [316, 90], [366, 114], [428, 104],
];
const MID: Point[] = [
  [-8, 152], [40, 116], [88, 142], [148, 102], [206, 140], [268, 110],
  [326, 144], [382, 116], [428, 138],
];
const NEAR: Point[] = [
  [-8, 168], [52, 124], [110, 160], [186, 102], [258, 156], [330, 120],
  [428, 152],
];

// Built once at module load: the shapes never change, and each is drawn twice
// — once for the rock and once for the mist over it.
const FAR_D = ridge(FAR, 180);
const MID_D = ridge(MID, 180);
const NEAR_D = ridge(NEAR, 180);

/**
 * The range along the bottom-right of the hero.
 *
 * Three ridgelines at falling opacity, with a wash of the card's own colour
 * laid over each one's base. The wash is what does the work: a distant ridge
 * is not merely paler, it is *eaten into* from the bottom by the air in front
 * of it, and drawing that is the difference between three silhouettes stacked
 * up and three mountains standing at three distances.
 *
 * `preserveAspectRatio` pins it to the bottom-right so the peaks stay put as
 * the card changes width and the sky is what gets cropped.
 */
export function HeroRange() {
  return (
    <svg
      className="pom-art-range"
      viewBox="0 0 420 180"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pom-range-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pom-now-2)" stopOpacity=".40" />
          <stop offset="100%" stopColor="var(--pom-now-2)" stopOpacity=".06" />
        </linearGradient>
        <linearGradient id="pom-range-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pom-now)" stopOpacity=".46" />
          <stop offset="100%" stopColor="var(--pom-now)" stopOpacity=".10" />
        </linearGradient>
        <linearGradient id="pom-range-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pom-purple)" stopOpacity=".62" />
          <stop offset="100%" stopColor="var(--pom-purple)" stopOpacity=".16" />
        </linearGradient>
        {/* The air in front of a ridge, mapped to that ridge's own box rather
            than to the card — so a low far one is veiled over the same
            fraction of itself as a tall near one, which is what distance
            actually does. */}
        <linearGradient id="pom-range-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pom-card)" stopOpacity="0" />
          <stop offset="42%" stopColor="var(--pom-card)" stopOpacity=".14" />
          <stop offset="100%" stopColor="var(--pom-card)" stopOpacity=".72" />
        </linearGradient>

        {/* The art stops where its box does, and a tinted shape cut off by a
            straight vertical line reads as a bug in the card rather than as a
            range in the distance. So the whole thing is masked on its left and
            dissolves into the page instead of ending. */}
        <linearGradient id="pom-range-edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="30%" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="pom-range-fade">
          <rect x="0" y="0" width="420" height="180" fill="url(#pom-range-edge)" />
        </mask>
      </defs>

      {/* Each ridge three times: the rock, the mist standing in front of its
          lower half, then the snow, which is above the mist and stays crisp. */}
      <g mask="url(#pom-range-fade)">
        <path fill="url(#pom-range-far)" d={FAR_D} />
        <path fill="url(#pom-range-haze)" d={FAR_D} />
        <path fill="var(--pom-card)" fillOpacity=".40" d={cap([118, 88], 12)} />
        <path fill="var(--pom-card)" fillOpacity=".40" d={cap([316, 90], 11)} />

        <path fill="url(#pom-range-mid)" d={MID_D} />
        <path fill="url(#pom-range-haze)" d={MID_D} />
        <path fill="var(--pom-card)" fillOpacity=".50" d={cap([148, 102], 15)} />
        <path fill="var(--pom-card)" fillOpacity=".50" d={cap([268, 110], 14)} />

        <path fill="url(#pom-range-near)" d={NEAR_D} />
        <path fill="url(#pom-range-haze)" d={NEAR_D} />
        <path fill="var(--pom-card)" fillOpacity=".62" d={cap([186, 102], 19)} />
        <path fill="var(--pom-card)" fillOpacity=".48" d={cap([330, 120], 16)} />
      </g>
    </svg>
  );
}

/**
 * The summit behind the quote.
 *
 * A sky that goes from dusk to warm at the horizon, a sun low in it, and three
 * ridges in front. Fixed colours here rather than tokens — this one is a scene
 * and a scene has its own light; the card's text is white on it in both themes,
 * which is why the palette does not need to follow one.
 *
 * The viewBox is the card's shape, not the drawing's. `slice` scales a picture
 * to cover its box and throws away whatever will not fit, and the box is a
 * wide strip — so a square-ish drawing lost a third of its height off the top
 * *and the bottom*, which is precisely where the sunset was. The card was a
 * flat dark rectangle with a hint of a peak in it: the good half of the scene
 * had been cropped off and nobody could see what was missing. Framing the
 * viewBox on the strip the card actually is keeps the horizon in the picture.
 */
export function QuoteScene() {
  return (
    <svg
      className="pom-art-scene"
      viewBox="0 66 400 194"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pom-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="46%" stopColor="#4c1d95" />
          <stop offset="78%" stopColor="#9d4edd" />
          <stop offset="100%" stopColor="#f0a06a" />
        </linearGradient>
        <linearGradient id="pom-peak-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c5cf0" stopOpacity=".85" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="pom-peak-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#171436" />
        </linearGradient>
        <radialGradient id="pom-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd9a0" />
          <stop offset="60%" stopColor="#fbbf24" stopOpacity=".55" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="260" fill="url(#pom-sky)" />
      <circle cx="286" cy="176" r="46" fill="url(#pom-sun)" />
      <circle cx="286" cy="176" r="15" fill="#ffe6b8" opacity=".9" />

      {/* A few stars, only up in the dark half — which starts at the top of
          the viewBox above, not at the top of the drawing. */}
      <g fill="#fff" opacity=".5">
        <circle cx="42" cy="88" r="1.4" /><circle cx="118" cy="76" r="1" />
        <circle cx="196" cy="96" r="1.2" /><circle cx="284" cy="80" r="1" />
        <circle cx="348" cy="102" r="1.3" /><circle cx="76" cy="114" r="1" />
      </g>

      {/* Far peaks, catching the light. */}
      <path fill="url(#pom-peak-far)" d="M0 196 68 128l52 40 58-58 62 60 54-38 66 54v70H0z" />
      <path fill="#fff" fillOpacity=".55" d="m178 110 22 21-9 1-6-5-7 6-9-2z" />
      <path fill="#fff" fillOpacity=".38" d="m68 128 17 13-7 1-5-3-5 4-6-2z" />

      {/* Near ridge. */}
      <path fill="url(#pom-peak-near)" d="M0 260 92 176l58 44 56-32 66 50 60-30 68 40v12H0z" />
    </svg>
  );
}
