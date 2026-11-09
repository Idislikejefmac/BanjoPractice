// Voice · From a printed syllable ("Crip-", "ple", "Creek,") to the sounds to sing: consonants
// before the vowel, the vowel, consonants after it. Spelling rules plus a short list of very
// common words whose spelling misleads ("the", "of", "love"). It is a rough English reader, not
// a dictionary: good enough for a synthesized voice to say familiar words, never perfect.
// Pure: no audio here; src/audio/voice.ts turns this into sound.

export type Vowel =
  | "IY" // beet
  | "IH" // bit
  | "EH" // bet
  | "AE" // bat
  | "AA" // father
  | "AO" // bought
  | "UH" // put
  | "UW" // boot
  | "AH" // but
  | "ER" // bird
  | "EY" // bait
  | "AY" // bite
  | "OW" // boat
  | "AW" // bout
  | "OY"; // boy

export type Consonant =
  | "P"
  | "B"
  | "T"
  | "D"
  | "K"
  | "G"
  | "F"
  | "V"
  | "S"
  | "Z"
  | "SH"
  | "ZH"
  | "CH"
  | "JH"
  | "TH"
  | "DH"
  | "HH"
  | "M"
  | "N"
  | "NG"
  | "L"
  | "R"
  | "W"
  | "Y";

export interface Syllable {
  readonly onset: readonly Consonant[];
  readonly vowel: Vowel;
  readonly coda: readonly Consonant[];
}

const VOWELS = new Set<string>([
  "IY",
  "IH",
  "EH",
  "AE",
  "AA",
  "AO",
  "UH",
  "UW",
  "AH",
  "ER",
  "EY",
  "AY",
  "OW",
  "AW",
  "OY",
]);

function fromArpa(text: string): Syllable {
  const onset: Consonant[] = [];
  const coda: Consonant[] = [];
  let vowel: Vowel | null = null;
  for (const token of text.split(" ")) {
    if (VOWELS.has(token)) vowel = token as Vowel;
    else (vowel === null ? onset : coda).push(token as Consonant);
  }
  return { onset, vowel: vowel ?? "AH", coda };
}

/** Words (one sung syllable each, lower case, apostrophes dropped) whose spelling misleads. */
const WORDS: Readonly<Record<string, string>> = {
  a: "AH",
  i: "AY",
  im: "AY M",
  ive: "AY V",
  the: "DH AH",
  of: "AH V",
  to: "T UW",
  too: "T UW",
  two: "T UW",
  and: "AE N D",
  an: "AE N",
  in: "IH N",
  was: "W AH Z",
  are: "AA R",
  were: "W ER",
  you: "Y UW",
  your: "Y AO R",
  youre: "Y AO R",
  my: "M AY",
  by: "B AY",
  why: "W AY",
  eye: "AY",
  fly: "F L AY",
  cry: "K R AY",
  try: "T R AY",
  sky: "S K AY",
  die: "D AY",
  lie: "L AY",
  high: "HH AY",
  bye: "B AY",
  love: "L AH V",
  above: "AH B AH V",
  come: "K AH M",
  some: "S AH M",
  one: "W AH N",
  once: "W AH N S",
  none: "N AH N",
  done: "D AH N",
  son: "S AH N",
  sun: "S AH N",
  young: "Y AH NG",
  said: "S EH D",
  says: "S EH Z",
  they: "DH EY",
  them: "DH EH M",
  then: "DH EH N",
  than: "DH AE N",
  that: "DH AE T",
  this: "DH IH S",
  these: "DH IY Z",
  those: "DH OW Z",
  there: "DH EH R",
  their: "DH EH R",
  where: "W EH R",
  what: "W AH T",
  when: "W EH N",
  who: "HH UW",
  whose: "HH UW Z",
  do: "D UW",
  does: "D AH Z",
  go: "G OW",
  gone: "G AO N",
  no: "N OW",
  so: "S OW",
  oh: "OW",
  he: "HH IY",
  she: "SH IY",
  me: "M IY",
  we: "W IY",
  be: "B IY",
  ye: "Y IY",
  is: "IH Z",
  his: "HH IH Z",
  has: "HH AE Z",
  as: "AE Z",
  have: "HH AE V",
  give: "G IH V",
  live: "L IH V",
  for: "F AO R",
  or: "AO R",
  from: "F R AH M",
  all: "AO L",
  call: "K AO L",
  fall: "F AO L",
  tall: "T AO L",
  small: "S M AO L",
  wall: "W AO L",
  hall: "HH AO L",
  could: "K UH D",
  would: "W UH D",
  should: "SH UH D",
  good: "G UH D",
  foot: "F UH T",
  stood: "S T UH D",
  wood: "W UH D",
  put: "P UH T",
  full: "F UH L",
  pull: "P UH L",
  push: "P UH SH",
  now: "N AW",
  how: "HH AW",
  cow: "K AW",
  wow: "W AW",
  brow: "B R AW",
  down: "D AW N",
  town: "T AW N",
  brown: "B R AW N",
  crown: "K R AW N",
  frown: "F R AW N",
  drown: "D R AW N",
  gown: "G AW N",
  owl: "AW L",
  howl: "HH AW L",
  growl: "G R AW L",
  soul: "S OW L",
  though: "DH OW",
  through: "TH R UW",
  thought: "TH AO T",
  bought: "B AO T",
  brought: "B R AO T",
  caught: "K AO T",
  taught: "T AO T",
  night: "N AY T",
  light: "L AY T",
  right: "R AY T",
  sight: "S AY T",
  bright: "B R AY T",
  head: "HH EH D",
  dead: "D EH D",
  bread: "B R EH D",
  heaven: "HH EH V AH N",
  heart: "HH AA R T",
  hear: "HH IH R",
  near: "N IH R",
  dear: "D IH R",
  year: "Y IH R",
  tear: "T IH R",
  fear: "F IH R",
  clear: "K L IH R",
  door: "D AO R",
  floor: "F L AO R",
  poor: "P UH R",
  more: "M AO R",
  before: "B IH F AO R",
  most: "M OW S T",
  post: "P OW S T",
  host: "HH OW S T",
  both: "B OW TH",
  old: "OW L D",
  cold: "K OW L D",
  gold: "G OW L D",
  hold: "HH OW L D",
  told: "T OW L D",
  sold: "S OW L D",
  roll: "R OW L",
  home: "HH OW M",
  know: "N OW",
  low: "L OW",
  show: "SH OW",
  grow: "G R OW",
  snow: "S N OW",
  blow: "B L OW",
  flow: "F L OW",
  slow: "S L OW",
  throw: "TH R OW",
  glow: "G L OW",
  row: "R OW",
  dont: "D OW N T",
  wont: "W OW N T",
  aint: "EY N T",
  cant: "K AE N T",
  didnt: "D IH D N T",
  can: "K AE N",
  been: "B IH N",
  again: "AH G EH N",
  any: "EH N IY",
  many: "M EH N IY",
  very: "V EH R IY",
  every: "EH V R IY",
  only: "OW N L IY",
  lonely: "L OW N L IY",
  river: "R IH V ER",
  over: "OW V ER",
  ever: "EH V ER",
  never: "N EH V ER",
  mother: "M AH DH ER",
  father: "F AA DH ER",
  brother: "B R AH DH ER",
  other: "AH DH ER",
  another: "AH N AH DH ER",
  with: "W IH TH",
  without: "W IH TH AW T",
  out: "AW T",
  our: "AW ER",
  hour: "AW ER",
  round: "R AW N D",
  found: "F AW N D",
  ground: "G R AW N D",
  sound: "S AW N D",
  mountain: "M AW N T AH N",
  mountains: "M AW N T AH N Z",
  blue: "B L UW",
  true: "T R UW",
  new: "N UW",
  view: "V Y UW",
  few: "F Y UW",
  dew: "D UW",
  sleep: "S L IY P",
  keep: "K IY P",
  deep: "D IY P",
  weep: "W IY P",
  beautiful: "B Y UW T AH F AH L",
  til: "T IH L",
  lord: "L AO R D",
  word: "W ER D",
  world: "W ER L D",
  work: "W ER K",
  earth: "ER TH",
  learn: "L ER N",
  turn: "T ER N",
  burn: "B ER N",
  first: "F ER S T",
  girl: "G ER L",
  bird: "B ER D",
  stranger: "S T R EY N JH ER",
  strang: "S T R EY N JH",
  danger: "D EY N JH ER",
  dang: "D EY N JH",
  beau: "B Y UW",
  fore: "F AO R",
  rough: "R AH F",
  tough: "T AH F",
  enough: "IH N AH F",
  laugh: "L AE F",
  angel: "EY N JH AH L",
  ocean: "OW SH AH N",
  tion: "SH AH N",
  tions: "SH AH N Z",
  sion: "ZH AH N",
};

const VOICED_END = new Set<Consonant>([
  "B",
  "D",
  "G",
  "V",
  "Z",
  "ZH",
  "JH",
  "DH",
  "M",
  "N",
  "NG",
  "L",
  "R",
  "W",
  "Y",
]);

/** Consonant letters to sounds. `last` marks the final letters of the syllable. */
function consonants(letters: string, prev: Consonant | null, last: boolean): Consonant[] {
  const out: Consonant[] = [];
  const s = letters.replace(/([bcdfgjklmnpqrstvwxz])\1+/g, "$1"); // double letters sound once
  let before: Consonant | null = prev;
  const push = (c: Consonant) => {
    out.push(c);
    before = c;
  };
  for (let i = 0; i < s.length;) {
    const c = s[i]!;
    const two = s.slice(i, i + 2);
    const three = s.slice(i, i + 3);
    if (three === "tch") {
      push("CH");
      i += 3;
    } else if (two === "sh") {
      push("SH");
      i += 2;
    } else if (two === "ch") {
      push("CH");
      i += 2;
    } else if (two === "th") {
      push("TH");
      i += 2;
    } else if (two === "ph") {
      push("F");
      i += 2;
    } else if (two === "wh") {
      push("W");
      i += 2;
    } else if (two === "ck") {
      push("K");
      i += 2;
    } else if (two === "ng") {
      push("NG");
      i += 2;
    } else if (two === "nk") {
      push("NG");
      push("K");
      i += 2;
    } else if (two === "gh") {
      i += 2; // silent
    } else if (two === "dg") {
      push("JH");
      i += 2;
    } else if (two === "kn" && out.length === 0 && prev === null) {
      push("N");
      i += 2;
    } else if (two === "wr" && out.length === 0 && prev === null) {
      push("R");
      i += 2;
    } else if (two === "qu") {
      push("K");
      push("W");
      i += 2;
    } else if (c === "x") {
      push("K");
      push("S");
      i++;
    } else if (c === "c") {
      push(/^[eiy]/.test(s.slice(i + 1)) ? "S" : "K");
      i++;
    } else if (c === "s") {
      // A final "s" after a voiced sound is a "z" (friends, words).
      push(last && i === s.length - 1 && before !== null && VOICED_END.has(before) ? "Z" : "S");
      i++;
    } else if (c === "#") {
      push("Y");
      i++;
    } else {
      const map: Record<string, Consonant> = {
        b: "B",
        d: "D",
        f: "F",
        g: "G",
        h: "HH",
        j: "JH",
        k: "K",
        l: "L",
        m: "M",
        n: "N",
        p: "P",
        r: "R",
        t: "T",
        v: "V",
        w: "W",
        y: "Y",
        z: "Z",
      };
      const m = map[c];
      if (m) push(m);
      i++;
    }
  }
  return out;
}

const LONG: Readonly<Record<string, Vowel>> = { a: "EY", e: "IY", i: "AY", o: "OW", u: "UW" };

function nucleusVowel(
  nucleus: string,
  onset: string,
  coda: string,
  silentE: boolean,
): { vowel: Vowel; rColored: boolean } {
  const rNext = /^r(?![aeiouy])/.test(coda);
  if (nucleus.length === 1) {
    const v = nucleus;
    if (silentE && v in LONG) return { vowel: LONG[v]!, rColored: false };
    if (v === "a") {
      if (rNext) return { vowel: "AA", rColored: false };
      if (/^(ll|l[kdt]|w)/.test(coda)) return { vowel: "AO", rColored: false };
      if (coda === "") return { vowel: "AA", rColored: false };
      return { vowel: "AE", rColored: false };
    }
    if (v === "e") {
      if (rNext) return { vowel: "ER", rColored: true };
      return { vowel: coda === "" ? "IY" : "EH", rColored: false };
    }
    if (v === "i") {
      if (/^(gh)/.test(coda)) return { vowel: "AY", rColored: false };
      if (rNext) return { vowel: "ER", rColored: true };
      if (coda === "") return { vowel: "AY", rColored: false };
      if (/^(nd|ld|gn)/.test(coda)) return { vowel: "AY", rColored: false };
      return { vowel: "IH", rColored: false };
    }
    if (v === "o") {
      if (rNext) return { vowel: "AO", rColored: false };
      if (coda === "") return { vowel: "OW", rColored: false };
      if (/^(ld|lt|ll)/.test(coda)) return { vowel: "OW", rColored: false };
      if (/^(ng|ss|ft|st|g(?!h))/.test(coda)) return { vowel: "AO", rColored: false };
      return { vowel: "AA", rColored: false };
    }
    if (v === "u") {
      if (rNext) return { vowel: "ER", rColored: true };
      return { vowel: coda === "" ? "UW" : "AH", rColored: false };
    }
    // y
    if (coda === "") return { vowel: onset.length >= 2 ? "AY" : "IY", rColored: false };
    return { vowel: "IH", rColored: false };
  }
  switch (nucleus) {
    case "ee":
    case "ea":
      return { vowel: /^r/.test(coda) ? "IH" : "IY", rColored: false };
    case "ai":
    case "ay":
    case "ei":
      return { vowel: "EY", rColored: false };
    case "ey":
      return { vowel: coda === "" && onset.length > 0 ? "EY" : "IY", rColored: false };
    case "oa":
      return { vowel: "OW", rColored: false };
    case "oo":
      return {
        vowel: /^(k|r)/.test(coda) ? (/^r/.test(coda) ? "AO" : "UH") : "UW",
        rColored: false,
      };
    case "ou":
      return { vowel: /^r/.test(coda) ? "AO" : "AW", rColored: false };
    case "ow":
      return {
        vowel: coda === "" ? "OW" : /^(n|l|d)/.test(coda) ? "AW" : "OW",
        rColored: false,
      };
    case "oi":
    case "oy":
      return { vowel: "OY", rColored: false };
    case "au":
    case "aw":
      return { vowel: "AO", rColored: false };
    case "ew":
    case "ue":
    case "ui":
      return { vowel: "UW", rColored: false };
    case "ie":
      return { vowel: coda === "" || /^[sd]$/.test(coda) ? "AY" : "IY", rColored: false };
    case "ye":
      return { vowel: "AY", rColored: false };
    default:
      return nucleusVowel(nucleus[0]!, onset, coda, false);
  }
}

/** Reads one printed syllable: "Crip-", "ple", "Creek," and so on. */
export function parseSyllable(text: string): Syllable {
  const word = text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z]/g, "");
  const known = WORDS[word];
  if (known !== undefined) return fromArpa(known);
  if (word === "") return { onset: [], vowel: "AH", coda: [] };

  // Syllables like "ple", "ble", "tle": a consonant, then a swallowed vowel and an "l".
  const le = /^([^aeiouy]+)le$/.exec(word);
  if (le) return { onset: consonants(le[1]!, null, false), vowel: "AH", coda: ["L"] };

  const shaped = word.replace(/^y(?=[aeiou])/, "#");
  const m = /^([^aeiouy]*?)([aeiouy]+(?:w(?![aeiouy]))?)(.*)$/.exec(shaped);
  if (!m) {
    // No vowel at all ("n't", "st"): sing a neutral vowel after the first sound.
    const all = consonants(word, null, true);
    return { onset: all.slice(0, 1), vowel: "AH", coda: all.slice(1) };
  }
  const [, onsetLetters, nucleus, afterNucleus] = m as unknown as [string, string, string, string];
  let coda = afterNucleus;
  // A silent final "e" lengthens the vowel before it ("time", "rose").
  let silentE = false;
  if (/^[^aeiouy]+e$/.test(coda) || coda === "e") {
    silentE = coda !== "e";
    coda = coda.slice(0, -1);
  }
  const { vowel, rColored } = nucleusVowel(nucleus, onsetLetters, coda, silentE);
  const onset = consonants(onsetLetters, null, false);
  let codaLetters = coda;
  if (rColored) codaLetters = coda.replace(/^r/, "");
  // A lone final "s" after a long vowel is a "z" (days, eyes, rose); after a short one, an "s".
  const longVowel = ["EY", "AY", "OW", "AW", "OY", "IY", "UW"].includes(vowel);
  const codaSounds: Consonant[] =
    codaLetters === "s" && longVowel ? ["Z"] : consonants(codaLetters, null, true);
  return { onset, vowel, coda: codaSounds };
}
