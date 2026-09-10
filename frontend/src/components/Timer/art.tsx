/**
 * The sunset behind the quote.
 *
 * The other half of this file — the mountain range along the hero — moved to
 * components/Range.tsx, because a range turned out not to be about pomodoros:
 * every page here opens on one now, and two implementations of the same
 * ridgeline would be two places for it to drift. This one stayed, because a
 * dusk sky with a sun in it belongs to the page that has a quote on it.
 *
 * Drawn rather than fetched, for the reason the shared file gives at length: a
 * photograph would be a binary in the repo, a request on every load, a licence
 * to keep track of, and a fixed palette. This one keeps its own palette
 * anyway — see below — but it costs nothing to send and it cannot 404.
 *
 * `aria-hidden`: it carries no information, and a screen reader announcing
 * "mountains" between the timer and the quote would be reading out the
 * wallpaper.
 */

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
 *
 * `slice` stays, unlike the shared range in components/Range.tsx, and the
 * difference is what each one is. That range is a motif in a corner and has to
 * be whole, so it uses `meet`; this is a backdrop and has to reach every edge,
 * because a gap between a picture and the card it fills is worse than a crop.
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
