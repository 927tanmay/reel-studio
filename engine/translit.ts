/**
 * Devanagari to the Roman spelling Hinglish is actually typed in — "jaata",
 * "kaise", "nahi", not the academic "jātā" or "kaisē". Used when a Hindi or
 * Hinglish take comes back from the transcriber in Devanagari and the reel
 * wants Roman captions.
 *
 * There is no one right spelling of Hinglish: "mein", "mai" and "me" are all in
 * common use. This gives a readable default; the common short words come from
 * a table, and a post's own `spellings` (or the typed script, see
 * `scriptAlign.ts`) wins over both. Pure; no imports.
 */

const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h", "ळ": "l",
};

/** A consonant with a nukta under it: the sounds Hindi borrowed. */
const NUKTA: Record<string, string> = { "क": "q", "ख": "kh", "ग": "gh", "ज": "z", "फ": "f", "ड": "r", "ढ": "rh" };

/** Precomposed nukta letters, which some text uses instead of letter + nukta. */
const PRECOMPOSED: Record<string, string> = { "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "फ़": "f", "ड़": "r", "ढ़": "rh", "य़": "y" };

const VOWELS: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "o", "ऍ": "e",
};

const MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
};

const HALANT = "्";
const NUKTA_SIGN = "़";
const ANUSVARA = "ं";
const CHANDRABINDU = "ँ";
const VISARGA = "ः";

const DIGITS: Record<string, string> = { "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9" };

/**
 * The short words everyone types the same way, which the letter rules would
 * spell oddly ("mem", "naheem"). Keys are Devanagari, values everyday Roman.
 */
export const COMMON: Record<string, string> = {
  "में": "mein", "मैं": "main", "है": "hai", "हैं": "hain", "हो": "ho", "था": "tha", "थी": "thi", "थे": "the",
  "नहीं": "nahi", "नही": "nahi", "यह": "yeh", "ये": "ye", "वह": "woh", "वो": "wo", "और": "aur",
  "कि": "ki", "की": "ki", "के": "ke", "का": "ka", "को": "ko", "से": "se", "पर": "par", "भी": "bhi",
  "तो": "toh", "क्या": "kya", "क्यों": "kyun", "कैसे": "kaise", "कैसा": "kaisa", "जो": "jo", "जब": "jab",
  "तब": "tab", "अब": "ab", "अभी": "abhi", "सिर्फ": "sirf", "सिर्फ़": "sirf", "बहुत": "bahut", "हाँ": "haan",
  "हां": "haan", "मेरा": "mera", "मेरी": "meri", "तुम": "tum", "आप": "aap", "हम": "hum", "एक": "ek",
  "कुछ": "kuch", "सब": "sab", "लेकिन": "lekin", "क्योंकि": "kyunki", "इसलिए": "isliye", "चाहिए": "chahiye",
};

const isConsonant = (c: string) => c in CONSONANTS || c in PRECOMPOSED;
const isDevanagari = (c: string) => /[ऀ-ॿ]/.test(c);

/** True when a word contains any Devanagari at all. */
export const hasDevanagari = (s: string): boolean => /[ऀ-ॿ]/.test(s);

/**
 * One word (or a run of text) from Devanagari to everyday Roman. Anything not
 * Devanagari — digits, Latin letters, punctuation — passes through unchanged,
 * so "16 GB" in a Hindi transcript stays "16 GB".
 */
export const romanize = (text: string, spellings: Record<string, string> = {}): string =>
  text
    .replace(/[ऀ-ॣ०-ॿ]+/g, (word) => {
      if (spellings[word] !== undefined) return spellings[word];
      if (COMMON[word] !== undefined) return COMMON[word];
      return romanizeWord(word);
    })
    // The danda and double danda are Hindi's full stops.
    .replace(/[।॥]/g, ".");

/**
 * A vowel sign, spelled the way Hinglish is typed: long vowels doubled inside
 * a word ("jaata", "deewar") but single at its end ("jaata", "zaroori", "hota"),
 * where everyone writes them short.
 */
const vowelSign = (sign: string, last: boolean): string => {
  if (last && sign === "ा") return "a";
  if (last && sign === "ी") return "i";
  if (last && sign === "ू") return "u";
  return MATRAS[sign];
};

const romanizeWord = (word: string): string => {
  const chars = Array.from(word);
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (DIGITS[c]) {
      out += DIGITS[c];
      continue;
    }
    if (VOWELS[c]) {
      out += VOWELS[c];
      continue;
    }
    if (c === ANUSVARA || c === CHANDRABINDU) {
      out += "n";
      continue;
    }
    if (c === VISARGA) {
      out += "h";
      continue;
    }
    if (isConsonant(c)) {
      let base = PRECOMPOSED[c] ?? CONSONANTS[c];
      let j = i + 1;
      if (chars[j] === NUKTA_SIGN) {
        base = NUKTA[c] ?? base;
        j++;
      }
      out += base;
      const next = chars[j];
      if (next === HALANT) {
        i = j; // a consonant joined to the next: no vowel
        continue;
      }
      if (next !== undefined && MATRAS[next] !== undefined) {
        out += vowelSign(next, j === chars.length - 1);
        i = j;
        continue;
      }
      // The inherent "a". Spoken Hindi drops it at the end of a word and, in a
      // word of three or more letters, before a final consonant+vowel ("कमरा"
      // is "kamra", not "kamara"); keep it everywhere else.
      const rest = chars.slice(j).filter((x) => isDevanagari(x));
      const atEnd = rest.length === 0 || rest.every((x) => x === ANUSVARA || x === CHANDRABINDU || x === VISARGA);
      const beforeFinalSyllable =
        !atEnd &&
        out.length > base.length &&
        rest.length === 2 &&
        isConsonant(rest[0]) &&
        MATRAS[rest[1]] !== undefined;
      if (!atEnd && !beforeFinalSyllable) out += "a";
      i = j - 1;
      continue;
    }
    if (c === HALANT || c === NUKTA_SIGN) continue;
    if (MATRAS[c]) {
      out += vowelSign(c, i === chars.length - 1);
      continue;
    }
    out += c; // danda and anything else: leave it
  }
  return out;
};
