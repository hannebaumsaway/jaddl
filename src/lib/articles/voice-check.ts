/**
 * Lints a drafted article against the rules in `ARTICLE_VOICE.md` that a
 * machine can actually check.
 *
 * This exists because a model drafting the column reaches for the same tics
 * every time, and they are easier to catch mechanically than to remember:
 *
 * 1. **Slop callsigns.** "Here's the part worth stopping on", "which is the
 *    kind of game where", "Welcome to Week N" — throat-clearing that announces
 *    a point instead of making one. None of them appear in the 2008-2021
 *    corpus; all of them appear in the AI-written 2025 recaps.
 * 2. **First and second person.** The column is written by a beat writer
 *    covering the league, not by an owner in it. Ryan's own articles were
 *    first person because Ryan wrote them; these are not, and a draft that
 *    says "my guys" or "Nate, in your defense" is writing as a participant.
 * 3. **Early-season multipliers.** `computeSeasonAverages` excludes the week
 *    being measured, so in week 2 a player's baseline is week 1 — one game.
 *    "Seven times what Chase had given him all year" is a sentence about a
 *    small sample, not about Ja'Marr Chase.
 *
 * Findings are advisory: `--create` prints them and continues, because a rule
 * this blunt will sometimes be wrong (a quoted owner may legitimately say
 * "I"). They are meant to be read, not obeyed.
 */

export type VoiceSeverity = 'error' | 'warn';

export interface VoiceFinding {
  rule: string;
  severity: VoiceSeverity;
  match: string;
  line: number;
  hint: string;
}

interface Rule {
  rule: string;
  severity: VoiceSeverity;
  pattern: RegExp;
  hint: string;
  /** Only applies at or before this week, for early-season sample rules. */
  throughWeek?: number;
}

/**
 * Throat-clearing. Split across several patterns rather than one alternation
 * so the reported rule name says what kind of tic was found.
 */
const SLOP: Rule[] = [
  {
    rule: 'slop/callsign',
    severity: 'error',
    pattern:
      /\b(here'?s (?:the (?:part|thing|good stuff|kicker|rub)|what(?:'s| is))|the part worth|what'?s (?:wild|unsettling|remarkable) (?:is|here)|let'?s be (?:clear|honest)|make no mistake|it'?s worth noting|needless to say|at the end of the day|when all is said and done|one thing is clear|buckle up|and yet,? here we are)\b/gi,
    hint: 'Announces a point instead of making it. Delete the run-up and start at the fact.',
  },
  {
    rule: 'slop/kind-of-game',
    severity: 'error',
    pattern: /\b(?:which|that)? ?is the kind of (?:game|week|afternoon|season|day)\b|\bthe kind of (?:game|week|afternoon|day) where\b/gi,
    hint: 'Listed explicitly in the ARTICLE_VOICE.md "Do not" section.',
  },
  {
    rule: 'slop/welcome-to-week',
    severity: 'error',
    pattern: /\bwelcome to week \d+\b|\bwelcome to the\b/gi,
    hint: 'Listed explicitly in the ARTICLE_VOICE.md "Do not" section.',
  },
  {
    rule: 'slop/lesson-closer',
    severity: 'error',
    pattern: /\b(learned that|a lesson in|there'?s a lesson|proving once again|reminded (?:us|everyone) that|serves as a reminder)\b/gi,
    hint: 'The "[owner] learned that [lesson]" closer. Listed in the "Do not" section.',
  },
  {
    rule: 'slop/sportswriter-cliche',
    severity: 'warn',
    pattern:
      /\b(statement win|a masterclass|the numbers don'?t lie|speaks volumes|for the ages|(?:firmly )?cemented (?:his|her|their|its)|put the league on notice|announced (?:himself|herself|themselves|itself)|dominant performance|clinical display)\b/gi,
    hint: 'Generic wire-service filler. The column is specific or it is nothing.',
  },
];

/**
 * The narrator is a third party. `I`, `we` and `you` all put the writer inside
 * the league. Contractions are matched separately so the hint can be exact.
 */
const PERSON: Rule[] = [
  {
    rule: 'person/first',
    severity: 'error',
    pattern: /(?<![\w'])(I|I'?m|I'?ve|I'?d|I'?ll|my|mine|myself)(?![\w'])/g,
    hint: 'The column is written by a beat writer covering JADDL, not by an owner in it.',
  },
  {
    rule: 'person/first-plural',
    severity: 'warn',
    pattern: /(?<![\w'])(we|we'?re|we'?ve|we'?d|we'?ll|us|our|ours)(?![\w'])/gi,
    hint: '"We" enlists the writer in the league. Name the team or the league instead.',
  },
  {
    rule: 'person/second',
    severity: 'error',
    pattern: /(?<![\w'])(you|you'?re|you'?ve|you'?d|you'?ll|your|yours)(?![\w'])/gi,
    hint: 'Addressing an owner directly is the participant voice. Write about them, not to them.',
  },
];

/**
 * A player's baseline excludes the week being measured, so through week 3 it
 * rests on one or two games and the ratio is noise.
 */
const EARLY_SAMPLE: Rule[] = [
  {
    rule: 'sample/early-multiplier',
    severity: 'error',
    throughWeek: 3,
    pattern:
      /\b(\d+(?:\.\d+)?x\b|(?:roughly |nearly |near enough |about |a bit over |just over )?(?:twice|three times|four times|five times|six times|seven times|eight times|nine times|ten times)\b|\bmultiplier\b|\b(?:his|her|their) own baseline\b)/gi,
    hint: 'In week ≤3 a baseline is one or two games. Say the player bounced back, not that he went 7x.',
  },
  {
    rule: 'sample/season-long-claim',
    severity: 'error',
    throughWeek: 4,
    pattern: /\b(all year|all season|on the season|to that point this year|season average)\b/gi,
    hint: 'Two weeks is not "all year". Name the week instead.',
  },
];

export const VOICE_RULES: Rule[] = [...SLOP, ...PERSON, ...EARLY_SAMPLE];

/**
 * Scans body markdown. `week` enables the early-season sample rules; pass 0 to
 * skip them (an off-season or undated piece).
 */
export function checkVoice(body: string, week = 0): VoiceFinding[] {
  const lines = body.split(/\r?\n/);
  const findings: VoiceFinding[] = [];

  lines.forEach((line, i) => {
    // Game headings are `## Team A 155.5 | Team B 114.4` — scores, not prose.
    if (/^#{2,3}\s/.test(line) && line.includes('|')) return;

    for (const rule of VOICE_RULES) {
      if (rule.throughWeek !== undefined && (week === 0 || week > rule.throughWeek)) continue;
      for (const m of line.matchAll(rule.pattern)) {
        findings.push({
          rule: rule.rule,
          severity: rule.severity,
          match: m[0],
          line: i + 1,
          hint: rule.hint,
        });
      }
    }
  });

  return findings;
}

/** Human-readable report, or an empty string when the draft is clean. */
export function formatVoiceFindings(findings: VoiceFinding[]): string {
  if (!findings.length) return '';

  const byRule = new Map<string, VoiceFinding[]>();
  for (const f of findings) {
    const list = byRule.get(f.rule) ?? [];
    list.push(f);
    byRule.set(f.rule, list);
  }

  const out: string[] = [];
  for (const [rule, list] of [...byRule].sort()) {
    const mark = list[0].severity === 'error' ? '✗' : '!';
    out.push(`  ${mark} ${rule} (${list.length})`);
    out.push(`      ${list[0].hint}`);
    const shown = list.slice(0, 6);
    for (const f of shown) out.push(`      line ${f.line}: ${JSON.stringify(f.match)}`);
    if (list.length > shown.length) out.push(`      …and ${list.length - shown.length} more`);
  }
  return out.join('\n');
}
