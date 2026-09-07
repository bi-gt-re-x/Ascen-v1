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

/**
 * The range along the bottom-right of the hero.
 *
 * Three layers at different opacities — near, middle, far — because one
 * silhouette reads as a shape and three read as distance. `preserveAspectRatio`
 * pins it to the bottom-right so the peaks stay put as the card changes width
 * and the sky is what gets cropped.
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
          <stop offset="0%" stopColor="var(--pom-now-2)" stopOpacity=".38" />
          <stop offset="100%" stopColor="var(--pom-now-2)" stopOpacity=".08" />
        </linearGradient>
        <linearGradient id="pom-range-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pom-now)" stopOpacity=".42" />
          <stop offset="100%" stopColor="var(--pom-now)" stopOpacity=".10" />
        </linearGradient>
        <linearGradient id="pom-range-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pom-purple)" stopOpacity=".50" />
          <stop offset="100%" stopColor="var(--pom-purple)" stopOpacity=".14" />
        </linearGradient>
      </defs>

      {/* Far ridge — low, wide, palest. */}
      <path
        fill="url(#pom-range-far)"
        d="M0 132 60 96l38 26 44-38 52 40 46-30 60 44 56-32 64 40v30H0z"
      />
      {/* Middle. */}
      <path
        fill="url(#pom-range-mid)"
        d="M0 152 52 118l40 26 56-42 48 36 58-26 54 38 62-28 50 34v24H0z"
      />
      {/* Near ridge, with a snow cap on the tallest peak. */}
      <path
        fill="url(#pom-range-near)"
        d="M0 180 74 132l46 30 62-46 54 40 66-30 58 42 60-28v40z"
      />
      <path
        fill="var(--pom-card)"
        fillOpacity=".55"
        d="m182 116 20 15-8 2-6-4-7 5-8-2z"
      />
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
 */
export function QuoteScene() {
  return (
    <svg
      className="pom-art-scene"
      viewBox="0 0 400 260"
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

      {/* A few stars, only up in the dark half. */}
      <g fill="#fff" opacity=".5">
        <circle cx="42" cy="34" r="1.4" /><circle cx="118" cy="20" r="1" />
        <circle cx="196" cy="44" r="1.2" /><circle cx="284" cy="26" r="1" />
        <circle cx="348" cy="52" r="1.3" /><circle cx="76" cy="72" r="1" />
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
