/**
 * Mahad Al-Zahra (eLearningQuran) Hifz & Ikhtebaar Calculation Engine
 * Accurate milestone tracking, 30-Juz completion projections, and Ikhtebaar readiness.
 */

export interface MahadMilestone {
  key: string;
  name: string;
  nameAr: string;
  juzRange: string;
  juzCount: number;
  cumulativeAjza: number;
  cumulativePages: number;
  requiredPages: number;
}

export const MAHAD_IKHTEBAAR_MILESTONES: MahadMilestone[] = [
  {
    key: "SURAH_BALAD",
    name: "Surah Al-Balad (سورة البلد)",
    nameAr: "سورة البلد إلى الناس",
    juzRange: "Juz 30 (Partial)",
    juzCount: 0.25,
    cumulativeAjza: 0.25,
    cumulativePages: 5,
    requiredPages: 5,
  },
  {
    key: "SURAH_INSHIQAQ",
    name: "Surah Al-Inshiqaq (سورة الانشقاق)",
    nameAr: "سورة الانشقاق إلى الناس",
    juzRange: "Juz 30 (Half)",
    juzCount: 0.5,
    cumulativeAjza: 0.5,
    cumulativePages: 10,
    requiredPages: 10,
  },
  {
    key: "JUZ_AMMA",
    name: "Juz Amma (جزء عم)",
    nameAr: "المرحلة الثالثة - جزء عم كامل",
    juzRange: "Juz 30 (Complete)",
    juzCount: 1,
    cumulativeAjza: 1,
    cumulativePages: 20,
    requiredPages: 20,
  },
  {
    key: "MARHALA_4",
    name: "Marhala 4 (المرحلة الرابعة)",
    nameAr: "المرحلة الرابعة - الأجزاء ٢٥ إلى ٢٩",
    juzRange: "Juz 25–29",
    juzCount: 5,
    cumulativeAjza: 6,
    cumulativePages: 120,
    requiredPages: 100,
  },
  {
    key: "MARHALA_5",
    name: "Marhala 5 (المرحلة الخامسة)",
    nameAr: "المرحلة الخامسة - الأجزاء ٢٠ إلى ٢٤",
    juzRange: "Juz 20–24",
    juzCount: 5,
    cumulativeAjza: 11,
    cumulativePages: 220,
    requiredPages: 100,
  },
  {
    key: "MARHALA_6",
    name: "Marhala 6 (المرحلة السادسة)",
    nameAr: "المرحلة السادسة - الأجزاء ١٥ إلى ١٩",
    juzRange: "Juz 15–19",
    juzCount: 5,
    cumulativeAjza: 16,
    cumulativePages: 320,
    requiredPages: 100,
  },
  {
    key: "MARHALA_7",
    name: "Marhala 7 (المرحلة السابعة)",
    nameAr: "المرحلة السابعة - الأجزاء ٨ إلى ١٤",
    juzRange: "Juz 8–14",
    juzCount: 7,
    cumulativeAjza: 23,
    cumulativePages: 460,
    requiredPages: 140,
  },
  {
    key: "MARHALA_8",
    name: "Marhala 8 / Full Quran (المرحلة الثامنة - الختم)",
    nameAr: "المرحلة الثامنة - الأجزاء ١ إلى ٧",
    juzRange: "Juz 1–7",
    juzCount: 7,
    cumulativeAjza: 30,
    cumulativePages: 604,
    requiredPages: 144,
  },
];

export const TOTAL_QURAN_PAGES = 604;
export const TOTAL_QURAN_AJZA = 30;

/**
 * Calculates current progress toward Full Quran and Next Ikhtebaar milestone
 */
export function calculateHifzProgressAndIkhtebaar(params: {
  currentJuz?: number | null;
  currentSafah?: number | null;
  totalJadeedPages?: number | null;
  weeklyPagesCount?: number;
  recentMarksAverage?: number;
}) {
  const currentJuz = params.currentJuz || 0;
  const currentSafah = params.currentSafah || 0;

  // Approximate total memorized pages
  let totalMemorizedPages = params.totalJadeedPages || 0;
  if (totalMemorizedPages === 0 && currentJuz > 0) {
    totalMemorizedPages = Math.min(
      TOTAL_QURAN_PAGES,
      (currentJuz - 1) * 20 + Math.min(20, currentSafah)
    );
  }

  // Percentage toward 30 Juz completion (604 pages)
  const fullQuranPercentage = Number(
    Math.min(100, (totalMemorizedPages / TOTAL_QURAN_PAGES) * 100).toFixed(1)
  );

  // Determine current and next Mahad milestone
  let currentMilestone = MAHAD_IKHTEBAAR_MILESTONES[0];
  let nextMilestone = MAHAD_IKHTEBAAR_MILESTONES[0];

  for (let i = 0; i < MAHAD_IKHTEBAAR_MILESTONES.length; i++) {
    const m = MAHAD_IKHTEBAAR_MILESTONES[i];
    if (totalMemorizedPages >= m.cumulativePages) {
      currentMilestone = m;
      nextMilestone =
        i < MAHAD_IKHTEBAAR_MILESTONES.length - 1
          ? MAHAD_IKHTEBAAR_MILESTONES[i + 1]
          : m;
    } else {
      nextMilestone = m;
      break;
    }
  }

  // Next Ikhtebaar readiness calculation
  const prevCumulative =
    currentMilestone.key === nextMilestone.key
      ? 0
      : currentMilestone.cumulativePages;
  const pagesIntoMilestone = Math.max(
    0,
    totalMemorizedPages - (currentMilestone.key === nextMilestone.key ? 0 : prevCumulative)
  );
  const milestoneTargetPages = nextMilestone.requiredPages || 20;
  const milestoneProgressPercentage = Number(
    Math.min(100, (pagesIntoMilestone / milestoneTargetPages) * 100).toFixed(1)
  );

  const pagesRemainingForIkhtebaar = Math.max(
    0,
    nextMilestone.cumulativePages - totalMemorizedPages
  );

  // Velocity & Completion Projection
  const weeklyRate = params.weeklyPagesCount || 1.5; // fallback to 1.5 pages/week if new
  const weeksToQuranKhatam =
    weeklyRate > 0
      ? Math.ceil((TOTAL_QURAN_PAGES - totalMemorizedPages) / weeklyRate)
      : null;
  const weeksToNextIkhtebaar =
    weeklyRate > 0 ? Math.ceil(pagesRemainingForIkhtebaar / weeklyRate) : null;

  // Status for next test
  let ikhtebaarStatus = "PREPARING";
  if (milestoneProgressPercentage >= 100) {
    ikhtebaarStatus = "READY_FOR_TEST";
  } else if (milestoneProgressPercentage >= 80) {
    ikhtebaarStatus = "FINAL_REVIEW";
  }

  return {
    totalMemorizedPages,
    totalQuranPages: TOTAL_QURAN_PAGES,
    fullQuranPercentage,
    completedAjza: Number((totalMemorizedPages / 20).toFixed(1)),
    currentMilestone,
    nextMilestone: {
      ...nextMilestone,
      pagesCompleted: pagesIntoMilestone,
      totalPagesRequired: milestoneTargetPages,
      pagesRemaining: pagesRemainingForIkhtebaar,
      progressPercentage: milestoneProgressPercentage,
      status: ikhtebaarStatus,
      estimatedWeeks: weeksToNextIkhtebaar,
    },
    projection: {
      weeklyPacePages: weeklyRate,
      weeksToKhatam: weeksToQuranKhatam,
      estimatedMonthsToKhatam: weeksToQuranKhatam
        ? Number((weeksToQuranKhatam / 4.33).toFixed(1))
        : null,
    },
  };
}
