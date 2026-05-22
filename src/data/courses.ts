import type { Course } from "@/types";

const standardPrices = [
  { mode: "On-Site", price: "\u20a670,000", duration: "9 weeks, 144 hours. Morning, Afternoon, and Evening sessions." },
  { mode: "Online", price: "\u20a690,000", duration: "Individually determined and adapted to the student's schedule." },
  { mode: "Private", price: "\u20a6180,000", duration: "Individually determined and adapted to the student's schedule." },
  { mode: "Online Private", price: "\u20a6200,000", duration: "Individually determined and adapted to the student's schedule." },
] satisfies Course["prices"];

const familyReunionPrices = [
  { mode: "On-Site", price: "\u20a685,000", duration: "9 weeks, 144 hours. Morning, Afternoon, and Evening sessions." },
  { mode: "Online", price: "\u20a690,000", duration: "Individually determined and adapted to the student's schedule." },
  { mode: "Private", price: "\u20a6180,000", duration: "Individually determined and adapted to the student's schedule." },
  { mode: "Online Private", price: "\u20a6200,000", duration: "Individually determined and adapted to the student's schedule." },
] satisfies Course["prices"];

export const courses: Course[] = [
  {
    level: "A1",
    title: "Elementary",
    prices: standardPrices,
    description: "Start German from the foundation with practical vocabulary, pronunciation, grammar, and everyday conversations.",
    outcomes: ["Understand basic German expressions", "Introduce yourself and others", "Prepare for internationally recognized A1 expectations"],
  },
  {
    level: "A2",
    title: "Elementary",
    prices: standardPrices,
    description: "Strengthen elementary German for daily communication, travel situations, routine topics, and clearer sentence structure.",
    outcomes: ["Hold routine conversations", "Write short practical messages", "Build confidence for the A2 level"],
  },
  {
    level: "B1",
    title: "Independent",
    prices: standardPrices,
    description: "Develop independent German through speaking, listening, reading, writing, and structured exam preparation.",
    outcomes: ["Discuss familiar topics", "Prepare structured essays", "Practice B1 exam formats"],
  },
  {
    level: "B2",
    title: "Independent",
    prices: standardPrices,
    description: "Improve advanced communication for academic, professional, and immigration-related German language goals.",
    outcomes: ["Argue opinions clearly", "Read complex articles", "Refine grammar accuracy"],
  },
  {
    level: "C1",
    title: "Autonomous",
    prices: standardPrices,
    description: "Polish autonomous German expression for university readiness, advanced exams, and professional communication.",
    outcomes: ["Speak with nuance", "Write academic texts", "Master complex listening tasks"],
  },
  {
    level: "FR",
    title: "Family Reunion",
    prices: familyReunionPrices,
    description: "Focused German preparation for family reunion requirements, interview confidence, and everyday settlement language.",
    outcomes: ["Practice interview questions", "Learn practical vocabulary", "Prepare with a private tutor"],
  },
];
