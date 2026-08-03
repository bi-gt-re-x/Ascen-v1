/**
 * The little icon on a calendar block, guessed from its name.
 *
 * There is no icon field anywhere in the data and there never has been, so the
 * name is all there is to go on. Two passes: a list of keyword rules, then —
 * for the names those miss — a dictionary of every icon name plus synonyms,
 * matched exactly and then fuzzily, so "gymm", "Mathz hw" and "swimm sesion"
 * still land on the right drawing rather than the clock.
 *
 * The files are the 80 stroke SVGs in utils/icons/, served at /static/icons/.
 * They are painted with `currentColor` through a CSS mask (`.cal-ico`), so an
 * icon always matches the text beside it in either theme.
 *
 * Ported unchanged from the icon half of calendar-week.js.
 */

/** First match wins, so the specific rules come before the general ones. */
const ICON_RULES: Array<[RegExp, string]> = [
  // Fitness & sport
  [/(gym|workout|weight|lift|strength|exercise)/, 'gym'],
  [/\b(run|jog|sprint|cardio|5k|10k)/, 'run'],
  [/\b(walk|stroll|steps)\b/, 'walk'],
  [/(bike|bicycle|cycling|spin class)/, 'bike'],
  [/(swim|pool|laps)/, 'swim'],
  [/(yoga|stretch|pilates)/, 'yoga'],
  [/(basketball|hoops)/, 'basketball'],
  [/(soccer|football)/, 'soccer'],
  [/(tennis|badminton|squash|pickleball)/, 'tennis'],
  [/(hike|hiking|trail|climb|bouldering)/, 'hike'],
  // Study & school
  [/(math|algebra|calculus|geometry|stats|problem set)/, 'math'],
  [/(exam|test|quiz|midterm|final)/, 'exam'],
  [/(homework|assignment|worksheet)/, 'homework'],
  [/(physics)/, 'physics'],
  [/(chem|lab|science|experiment)/, 'science'],
  [/(bio(logy)?|anatomy)/, 'biology'],
  [/(spanish|french|german|japanese|chinese|language|vocab|duolingo)/, 'language'],
  [/(present|slides|demo)/, 'presentation'],
  [/(research|thesis|paper)/, 'research'],
  [/(school|class|lecture|lesson|graduation)/, 'school'],
  [/(read|book|novel|chapter|study)/, 'reading'],
  [/(essay|write|writing|blog|draft)/, 'writing'],
  [/(journal|diary|reflect)/, 'journal'],
  [/(cod(e|ing)|program|dev|github|debug)/, 'code'],
  // Work
  [/(meet|standup|sync|1:1|interview)/, 'meeting'],
  [/\b(call|phone call|zoom|facetime)\b/, 'call'],
  [/(email|inbox|mail)/, 'email'],
  [/(deadline|due|submit)/, 'deadline'],
  [/(brainstorm|idea|ideate)/, 'idea'],
  [/(budget|finance|taxes|invoice|bank)/, 'finance'],
  [/(report|analytics|metrics|chart)/, 'chart'],
  [/(project|build|sprint)/, 'project'],
  [/\b(work|job|office|shift)\b/, 'work'],
  // Food & drink
  [/(coffee|espresso|latte|tea)\b/, 'coffee'],
  [/(breakfast|brunch)/, 'breakfast'],
  [/(lunch|burger|sandwich)/, 'lunch'],
  [/(cook|bake|meal prep|recipe)/, 'cooking'],
  [/(grocer|supermarket|market run)/, 'groceries'],
  [/(snack|fruit)/, 'snack'],
  [/(hydrate|water)/, 'water'],
  [/(eat|dinner|meal|food|restaurant)/, 'food'],
  // Rest & hobbies
  [/(sleep|bedtime|lights out)/, 'sleep'],
  [/(relax|chill|unwind|rest|lounge)/, 'relax'],
  [/\b(break|pause)\b/, 'break'],
  [/(meditat|mindful|breathe)/, 'meditation'],
  [/(shower|bath)/, 'shower'],
  [/(tv|show|series|netflix|movie|film)/, 'tv'],
  [/(game|gaming|videogame|minecraft|valorant)/, 'game'],
  [/(guitar)/, 'guitar'],
  [/(piano|keyboard practice)/, 'piano'],
  [/(music|violin|song|band|choir)/, 'music'],
  [/(draw|paint|art|sketch|design)/, 'art'],
  [/(photo|camera|shoot)/, 'photo'],
  // People & social
  [/(family|mom|dad|parents|grandma|grandpa|sister|brother)/, 'family'],
  [/(friend|hang ?out|social)/, 'friends'],
  [/(party|celebrat)/, 'party'],
  [/(date night|date\b|anniversary)/, 'date'],
  [/(dog|cat|pet|vet)/, 'pet'],
  [/(birthday)/, 'birthday'],
  // Errands & life
  [/(clean|tidy|chores|vacuum|dishes)/, 'cleaning'],
  [/(laundry|folding)/, 'laundry'],
  [/(shop|mall|buy)/, 'shopping'],
  [/(travel|flight|airport|trip|vacation)/, 'travel'],
  [/(drive|car|commute)/, 'car'],
  [/(errand|pick ?up|drop ?off)/, 'errand'],
  [/(doctor|dentist|appointment|checkup)/, 'doctor'],
  [/(medicine|meds|pill|pharmacy)/, 'medicine'],
  [/(health|therapy|wellness)/, 'health'],
  [/(garden|plant|water the)/, 'garden'],
  [/(fix|repair|install)/, 'repair'],
  // Planning & misc
  [/(focus|deep work|pomodoro|grind)/, 'focus'],
  [/(goal|milestone|target)/, 'goal'],
  [/(plan|schedule|organize|calendar)/, 'plan'],
  [/(streak|habit)/, 'streak'],
  [/(win|trophy|award|competition)/, 'trophy'],
  [/(review|star|important|priority)/, 'star'],
  [/(done|complete|finish)/, 'check'],
  // The names the calendar's own default sections used to have
  [/(morning)/, 'coffee'],
  [/(afternoon)/, 'break'],
  [/(evening)/, 'relax'],
  [/\b(night|bedtime)\b/, 'sleep'],
  [/(session)/, 'focus'],
];

/** Every icon name, plus the words people actually write instead. */
const ICON_TOKENS: Record<string, string> = (() => {
  const map: Record<string, string> = {};

  const names = [
    'art', 'basketball', 'bike', 'biology', 'birthday', 'break', 'breakfast',
    'call', 'car', 'chart', 'check', 'cleaning', 'clock', 'code', 'coffee',
    'cooking', 'date', 'deadline', 'doctor', 'email', 'errand', 'exam',
    'family', 'finance', 'focus', 'food', 'friends', 'game', 'garden',
    'goal', 'groceries', 'guitar', 'gym', 'health', 'hike', 'homework',
    'idea', 'journal', 'language', 'laundry', 'lunch', 'math', 'medicine',
    'meditation', 'meeting', 'music', 'nature', 'party', 'pet', 'phone',
    'photo', 'physics', 'piano', 'plan', 'presentation', 'project',
    'reading', 'relax', 'repair', 'research', 'run', 'school', 'science',
    'shopping', 'shower', 'sleep', 'snack', 'soccer', 'star', 'streak',
    'swim', 'tennis', 'travel', 'trophy', 'tv', 'walk', 'water', 'work',
    'writing', 'yoga',
  ];
  names.forEach((name) => {
    map[name] = name;
  });

  const synonyms: Record<string, string[]> = {
    gym: ['weights', 'lifting', 'deadlift', 'bench', 'squats', 'crossfit', 'fitness'],
    run: ['jogging', 'sprints', 'marathon', 'treadmill', 'parkrun'],
    math: ['calc', 'algebra', 'geometry', 'trig', 'arithmetic'],
    reading: ['novel', 'textbook', 'chapters', 'literature'],
    writing: ['essay', 'draft', 'thesis', 'notes'],
    code: ['coding', 'programming', 'leetcode', 'debugging', 'website'],
    science: ['chemistry', 'chem', 'experiment'],
    homework: ['assignment', 'worksheet', 'revision', 'studying'],
    meeting: ['standup', 'interview', 'catchup', 'onboarding'],
    food: ['dinner', 'meal', 'restaurant', 'takeout'],
    coffee: ['espresso', 'latte', 'cafe', 'matcha', 'boba'],
    cooking: ['baking', 'recipe', 'mealprep'],
    sleep: ['bedtime', 'rest'],
    relax: ['chill', 'unwind', 'lounge', 'destress'],
    meditation: ['mindfulness', 'breathing', 'journaling'],
    game: ['gaming', 'minecraft', 'valorant', 'fortnite', 'chess'],
    tv: ['netflix', 'youtube', 'anime', 'movie', 'series'],
    music: ['violin', 'band', 'choir', 'singing', 'karaoke'],
    art: ['drawing', 'painting', 'sketching', 'design'],
    family: ['parents', 'grandma', 'grandpa', 'siblings', 'cousins'],
    friends: ['hangout', 'social', 'sleepover'],
    party: ['celebration', 'birthday'],
    pet: ['puppy', 'kitten', 'walkies'],
    cleaning: ['chores', 'tidying', 'vacuum', 'dishes', 'organize'],
    shopping: ['mall', 'errands', 'ikea'],
    travel: ['flight', 'airport', 'vacation', 'roadtrip'],
    car: ['driving', 'commute', 'carpool'],
    doctor: ['dentist', 'checkup', 'appointment', 'physio'],
    health: ['therapy', 'wellness'],
    work: ['shift', 'office', 'internship', 'job'],
    finance: ['budget', 'taxes', 'banking', 'invoice'],
    exam: ['midterm', 'finals', 'quiz', 'test'],
    school: ['lecture', 'class', 'tutoring', 'seminar'],
    focus: ['pomodoro', 'deepwork', 'grind', 'lockin'],
    walk: ['stroll', 'steps'],
    swim: ['swimming', 'pool'],
    soccer: ['football', 'futsal'],
    basketball: ['hoops', 'nba'],
    water: ['hydrate', 'hydration'],
    language: ['spanish', 'french', 'duolingo', 'vocab'],
    presentation: ['slides', 'pitch', 'demo'],
  };
  Object.keys(synonyms).forEach((key) => {
    (synonyms[key] ?? []).forEach((word) => {
      map[word] = key;
    });
  });

  return map;
})();

/** Levenshtein distance, capped: -1 once it is certainly over `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return -1;

  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
      rowMin = Math.min(rowMin, cur[j] ?? rowMin);
    }
    if (rowMin > max) return -1;
    prev = cur;
  }
  const distance = prev[b.length] ?? -1;
  return distance <= max ? distance : -1;
}

/** The dictionary pass: exact tokens first, then the closest within a typo budget. */
function smartIconKey(text: string): string | null {
  const tokens = text.split(/[^a-z]+/).filter((token) => token.length >= 3);

  for (const token of tokens) {
    if (ICON_TOKENS[token]) return ICON_TOKENS[token];
    const stem = token.replace(/(ings?|es|s)$/, '');
    if (stem !== token && ICON_TOKENS[stem]) return ICON_TOKENS[stem];
  }

  const dictionary = Object.keys(ICON_TOKENS);
  let bestKey: string | null = null;
  let bestDistance = Infinity;

  for (const token of tokens) {
    // Under four letters there is no room to tell a typo from a different word.
    if (token.length < 4) continue;
    const budget = token.length <= 5 ? 1 : 2;
    for (const word of dictionary) {
      const distance = editDistance(token, word, budget);
      if (distance !== -1 && distance < bestDistance) {
        bestDistance = distance;
        bestKey = ICON_TOKENS[word] ?? null;
        if (distance === 1 && token.length <= 5) break;
      }
    }
  }

  return bestKey;
}

/** The icon's file name. 'clock' is the catch-all. */
export function iconKeyFor(name: string): string {
  const text = String(name || '').toLowerCase();
  for (const [pattern, key] of ICON_RULES) {
    if (pattern.test(text)) return key;
  }
  return smartIconKey(text) || 'clock';
}

/** The URL the `.cal-ico` mask paints. */
export function iconUrlFor(name: string): string {
  return `/static/icons/${iconKeyFor(name)}.svg`;
}
