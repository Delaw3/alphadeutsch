/**
 * German level placement assessment — central configuration.
 *
 * Pure, serialisable data: no React, no fetch, no database. A future admin
 * screen (or API) can manage exactly this shape without touching the UI:
 *
 *   level  ·  active  ·  passMarkPercent  ·  questions[]
 *   question: id · prompt · 4 options · one correctOptionId
 *
 * `ASSESSMENT_SETTINGS.registrationUrl` is the single place the school supplies
 * the real registration link once it exists; while it is `null` the app shows a
 * "registration opens soon" message instead of sending students to a made-up URL.
 */

export type LevelId = "a1" | "a2" | "b1" | "b2";

export type OptionId = "a" | "b" | "c" | "d";

export type AssessmentOption = {
  id: OptionId;
  text: string;
};

export type AssessmentQuestion = {
  id: string;
  prompt: string;
  /** Exactly four options, in display order. */
  options: AssessmentOption[];
  /** Exactly one of the four option ids above. */
  correctOptionId: OptionId;
};

export type LevelDefinition = {
  id: LevelId;
  /** CEFR code shown on the card, e.g. "A1". */
  code: string;
  /** Human name for the level, e.g. "Beginner". */
  name: string;
  /** One-line description for the level card. */
  tagline: string;
};

export type LevelAssessment = {
  level: LevelId;
  /** Administrators can switch a level's assessment off without deleting it. */
  active: boolean;
  /** Percentage (0–100) a student must reach to pass this level. */
  passMarkPercent: number;
  /** ISO date of the last configuration change (future admin audit field). */
  updatedAt: string;
  questions: AssessmentQuestion[];
};

export type AssessmentSettings = {
  /** Used for levels that do not override the pass mark. */
  defaultPassMarkPercent: number;
  /** `null` until the school supplies the real registration URL. */
  registrationUrl: string | null;
  /** Shown instead of redirecting while `registrationUrl` is `null`. */
  registrationComingSoonMessage: string;
};

export const ASSESSMENT_SETTINGS: AssessmentSettings = {
  defaultPassMarkPercent: 50,
  registrationUrl: null,
  registrationComingSoonMessage:
    "Registration isn't open from the app yet. Please check back soon — the school office will share the official registration link here.",
};

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: "a1",
    code: "A1",
    name: "Beginner",
    tagline: "Greetings, numbers and first sentences",
  },
  {
    id: "a2",
    code: "A2",
    name: "Elementary",
    tagline: "Daily life, past events and short conversations",
  },
  {
    id: "b1",
    code: "B1",
    name: "Intermediate",
    tagline: "Work, travel and expressing opinions",
  },
  {
    id: "b2",
    code: "B2",
    name: "Upper Intermediate",
    tagline: "Complex topics, formal writing and precise grammar",
  },
];

const OPTION_IDS = ["a", "b", "c", "d"] as const;

/** Compact question factory: four options + the id of the correct one. */
function q(
  id: string,
  prompt: string,
  options: [string, string, string, string],
  correctOptionId: OptionId,
): AssessmentQuestion {
  return {
    id,
    prompt,
    correctOptionId,
    options: options.map((text, index) => ({ id: OPTION_IDS[index], text })),
  };
}

/* ------------------------------------------------------------------ A1 ---- */
const A1_QUESTIONS: AssessmentQuestion[] = [
  q("a1-q1", "___ heißt du?", ["Wo", "Wie", "Was", "Wer"], "b"),
  q("a1-q2", "Ich ___ aus Nigeria.", ["kommst", "kommt", "komme", "kommen"], "c"),
  q("a1-q3", "Das ist ___ Buch.", ["eine", "einen", "ein", "einem"], "c"),
  q("a1-q4", "Wie viele Tage hat eine Woche?", ["Fünf", "Sieben", "Sechs", "Acht"], "b"),
  q("a1-q5", "Guten Morgen! Wie geht es ___?", ["dir", "dich", "du", "dein"], "a"),
  q("a1-q6", "Ich trinke gern ___", ["Kuchen", "Kartoffel", "Kaffee", "Käse"], "c"),
  q("a1-q7", "___ Sie Deutsch?", ["Sprichst", "Sprechen", "Spricht", "Sprich"], "b"),
  q("a1-q8", "Der Vater von meiner Mutter ist mein ___.", ["Onkel", "Bruder", "Cousin", "Großvater"], "d"),
  q("a1-q9", "Ich ___ 25 Jahre alt.", ["bist", "ist", "bin", "sind"], "c"),
  q("a1-q10", "Wo ___ ihr?", ["wohne", "wohnt", "wohnst", "wohnen"], "b"),
];

/* ------------------------------------------------------------------ A2 ---- */
const A2_QUESTIONS: AssessmentQuestion[] = [
  q("a2-q1", "Ich ___ gestern ins Kino gegangen.", ["habe", "hatte", "bin", "war"], "c"),
  q("a2-q2", "Du ___ jeden Tag Deutsch lernen.", ["müssen", "musst", "müsst", "muss"], "b"),
  q("a2-q3", "Ich fahre ___ dem Bus zur Arbeit.", ["für", "ohne", "mit", "gegen"], "c"),
  q("a2-q4", "Berlin ist ___ als Bonn.", ["größer", "groß", "am größten", "größte"], "a"),
  q("a2-q5", "Wir ___ früher in Lagos.", ["hatten", "sind", "wurden", "waren"], "d"),
  q("a2-q6", "Ich sehe ___ morgen.", ["er", "ihn", "ihm", "sein"], "b"),
  q("a2-q7", "Ich hänge das Bild ___ die Wand.", ["im", "beim", "zum", "an"], "d"),
  q("a2-q8", "Ich habe ___ Zeit.", ["nicht", "kein", "keinen", "keine"], "d"),
  q("a2-q9", "Es ist 14:30 Uhr. Es ist ___.", ["halb zwei", "halb drei", "Viertel nach drei", "drei Uhr"], "b"),
  q("a2-q10", "Ich glaube, ___ er heute kommt.", ["das", "wenn", "dass", "weil"], "c"),
];

/* ------------------------------------------------------------------ B1 ---- */
const B1_QUESTIONS: AssessmentQuestion[] = [
  q("b1-q1", "___ ich Zeit habe, gehe ich schwimmen.", ["Als", "Wenn", "Ob", "Damit"], "b"),
  q("b1-q2", "Er ___ nach Hause, weil er müde war.", ["geht", "gegangen", "ging", "gehte"], "c"),
  q("b1-q3", "Das ist der Mann, ___ ich gestern getroffen habe.", ["der", "dem", "den", "dessen"], "c"),
  q("b1-q4", "Sie lernt viel, ___ sie die Prüfung bestehen will.", ["weil", "obwohl", "trotzdem", "deshalb"], "a"),
  q("b1-q5", "___ Sie mir bitte helfen?", ["Könnten", "Können", "Konnten", "Könnte"], "a"),
  q("b1-q6", "Das Auto ___ Nachbarn ist neu.", ["dem", "den", "des", "der"], "c"),
  q("b1-q7", "Das Formular ___ ausgefüllt.", ["werden", "wird", "ist", "hat"], "b"),
  q("b1-q8", "Ich interessiere mich ___ Sprachen.", ["an", "auf", "über", "für"], "d"),
  q("b1-q9", "Er hat mir gesagt, dass er morgen ___.", ["kommt", "kommen", "komme", "kam"], "a"),
  q("b1-q10", "___ des Regens spielten wir Fußball.", ["Wegen", "Während", "Trotz", "Statt"], "c"),
];

/* ------------------------------------------------------------------ B2 ---- */
const B2_QUESTIONS: AssessmentQuestion[] = [
  q("b2-q1", "Wenn ich das gewusst ___, wäre ich gekommen.", ["hätte", "hatte", "würde", "wäre"], "a"),
  q("b2-q2", "Das Haus ___ 1990 gebaut worden.", ["hat", "wurde", "ist", "war"], "c"),
  q("b2-q3", "Nach ___ der Prüfung fuhr er nach Hause.", ["bestehen", "Bestehen", "bestand", "bestanden"], "b"),
  q("b2-q4", "Die ___ Aufgabe war schwierig.", ["stellende", "gestellt", "gestellte", "stellend"], "c"),
  q("b2-q5", "___ er sehr müde war, arbeitete er weiter.", ["Weil", "Obwohl", "Damit", "Sodass"], "b"),
  q("b2-q6", "Es handelt sich ___ ein Missverständnis.", ["für", "um", "über", "von"], "b"),
  q("b2-q7", "___ des schlechten Wetters fand das Fest im Freien statt.", ["Wegen", "Während", "Statt", "Trotz"], "d"),
  q("b2-q8", "Er sagte, er ___ keine Zeit.", ["habe", "hat", "hätte", "hatte"], "a"),
  q("b2-q9", "Ich lasse mein Auto ___.", ["repariert", "zu reparieren", "reparieren", "reparierend"], "c"),
  q("b2-q10", "Er spricht ___ gut Deutsch, dass man ihn für einen Muttersprachler hält.", ["zu", "sehr", "so", "viel"], "c"),
];

/* ---------------------------------------------------- level registry ---- */

const CONFIG_UPDATED_AT = "2026-11-19";

/**
 * One entry per CEFR level. Level-specific questions and pass marks live here,
 * so an administrator can later change a single level (or deactivate it) without
 * touching the Courses page or the assessment screen.
 */
export const ASSESSMENTS: Record<LevelId, LevelAssessment> = {
  a1: {
    level: "a1",
    active: true,
    passMarkPercent: ASSESSMENT_SETTINGS.defaultPassMarkPercent,
    updatedAt: CONFIG_UPDATED_AT,
    questions: A1_QUESTIONS,
  },
  a2: {
    level: "a2",
    active: true,
    passMarkPercent: ASSESSMENT_SETTINGS.defaultPassMarkPercent,
    updatedAt: CONFIG_UPDATED_AT,
    questions: A2_QUESTIONS,
  },
  b1: {
    level: "b1",
    active: true,
    passMarkPercent: ASSESSMENT_SETTINGS.defaultPassMarkPercent,
    updatedAt: CONFIG_UPDATED_AT,
    questions: B1_QUESTIONS,
  },
  b2: {
    level: "b2",
    active: true,
    passMarkPercent: ASSESSMENT_SETTINGS.defaultPassMarkPercent,
    updatedAt: CONFIG_UPDATED_AT,
    questions: B2_QUESTIONS,
  },
};

/** Narrow an arbitrary route param (e.g. "b1") to a known level id. */
export function isLevelId(value: string): value is LevelId {
  return Object.prototype.hasOwnProperty.call(ASSESSMENTS, value);
}

export function getLevel(level: LevelId): LevelDefinition {
  const found = LEVELS.find((entry) => entry.id === level);
  if (!found) throw new Error(`Unknown level: ${level}`);
  return found;
}

export function getAssessment(level: LevelId): LevelAssessment {
  return ASSESSMENTS[level];
}
