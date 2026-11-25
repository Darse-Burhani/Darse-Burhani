// ============================================================================
// Al Quran Majeed Ikhtebaar (Examination) Syllabus & Question Generator
// Official Aljamea-tus-Saifiyah Syllabus (Academic Year: 1447_1448H)
// Strictly for Darajah 1 through Darajah 4 (Oola to Rabia)
// All questions carry 10 marks each (6 x 10 = 60 marks)
// Strict Nizam/Darajah Juz filtering + 6 distinct Juz per paper
// ============================================================================

export type NizamType = "OLD" | "NEW";

export interface QuestionItem {
  id: string;
  qNumber: number;
  marks: number;
  promptEn: string;
  ayahTextAr: string;
  surahNameAr: string;
  surahNameEn: string;
  surahNumber: number;
  ayahStart: number;
  ayahEnd?: number;
  juzNumber: number;
}

export interface HifzPortion {
  newPagesCount: number;
  summaryEn: string;
  oldNizamAjzaaEn: string;
  oldNizamAjzaaAr: string;
  newNizamAjzaaEn: string;
  newNizamAjzaaAr: string;
}

export interface UloomQuranPortion {
  bookNameAr: string;
  bookNameEn: string;
  ajzaaEn: string;
  ajzaaAr: string;
}

export interface TajweedTopic {
  en: string;
  ar: string;
}

export interface TajweedPortion {
  sourcesEn: string;
  sourcesAr: string;
  topics: TajweedTopic[];
}

export interface OfficialQuranSyllabus {
  darajahNumber: number;
  nameAr: string;
  nameEn: string;
  shortName: string;
  academicYear: string;
  hifz: HifzPortion;
  uloomQuran: UloomQuranPortion;
  tajweed: TajweedPortion;
}

export interface DarajahSyllabus {
  darajahNumber: number;
  nameAr: string;
  nameEn: string;
  shortName: string;
  juzRangeEn: string;
  juzRangeAr: string;
  allowedJuz: number[];
  totalMarks: number;
  passingMarks: number;
  officialSyllabus: OfficialQuranSyllabus;
}

export interface NizamConfig {
  id: NizamType;
  titleEn: string;
  titleAr: string;
  summaryEn: string;
  darajahs: Record<number, DarajahSyllabus>;
}

const range = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, i) => start + i);

// ────────────────────────────────────────────────────────────────────────────
// OFFICIAL ALJAMEA-TUS-SAIFIYAH SYLLABUS (1447_1448H) — DARAJAH 1 TO 4
// ────────────────────────────────────────────────────────────────────────────
export const OFFICIAL_ALJAMEA_QURAN_SYLLABUS: Record<number, OfficialQuranSyllabus> = {
  1: {
    darajahNumber: 1,
    nameAr: "الأولى",
    nameEn: "Darajah 1",
    shortName: "Oola",
    academicYear: "1447–1448 H",
    hifz: {
      newPagesCount: 100,
      summaryEn: "5 Ajzaa (100 new pages)",
      oldNizamAjzaaEn: "Juz 30, Juz 1–5",
      oldNizamAjzaaAr: "أجزاء: ٣٠، ١-٥",
      newNizamAjzaaEn: "Juz 26–30, Juz 1",
      newNizamAjzaaAr: "أجزاء: ٢٦-٣٠، ١",
    },
    uloomQuran: {
      bookNameAr: "خزائن معاني القرآن الفائقة",
      bookNameEn: "Khazain Ma'ani al-Quran",
      ajzaaEn: "Juz 30, 1, 2",
      ajzaaAr: "الأجزاء: ٣٠، ١، ٢",
    },
    tajweed: {
      sourcesEn: "Tuhfat al-Atfal, Al-Muqaddimah al-Jazariyyah & Al-Burhan",
      sourcesAr: "تحفة الأطفال والمقدمة الجزرية والبرهان",
      topics: [
        { en: "Ism al-Jalalah", ar: "اسم الجلالة" },
        { en: "Ghunnah", ar: "الغنة" },
        { en: "Nun Sakinah & Tanween", ar: "أحكام النون الساكنة والتنوين" },
        { en: "Meem Sakinah", ar: "أحكام الميم الساكنة" },
      ],
    },
  },
  2: {
    darajahNumber: 2,
    nameAr: "الثانية",
    nameEn: "Darajah 2",
    shortName: "Saniya",
    academicYear: "1447–1448 H",
    hifz: {
      newPagesCount: 100,
      summaryEn: "5 Ajzaa (100 new pages)",
      oldNizamAjzaaEn: "Juz 30, Juz 1–12",
      oldNizamAjzaaAr: "أجزاء: ٣٠، ١-١٢",
      newNizamAjzaaEn: "Juz 26–30, Juz 1–6",
      newNizamAjzaaAr: "أجزاء: ٢٦-٣٠، ١-٦",
    },
    uloomQuran: {
      bookNameAr: "خزائن معاني القرآن الفائقة",
      bookNameEn: "Khazain Ma'ani al-Quran",
      ajzaaEn: "Juz 3, 4, 5",
      ajzaaAr: "الأجزاء: ٣، ٤، ٥",
    },
    tajweed: {
      sourcesEn: "Tuhfat al-Atfal, Al-Muqaddimah al-Jazariyyah & Al-Burhan",
      sourcesAr: "تحفة الأطفال والمقدمة الجزرية والبرهان",
      topics: [
        { en: "Rules of Ra", ar: "أحكام الراء" },
        { en: "Al-Madd", ar: "باب المد" },
        { en: "Rawm & Ishmam", ar: "الروم والإشمام" },
        { en: "Tasheel", ar: "التسهيل" },
        { en: "Imalah Kubra", ar: "الإمالة الكبرى" },
      ],
    },
  },
  3: {
    darajahNumber: 3,
    nameAr: "الثالثة",
    nameEn: "Darajah 3",
    shortName: "Salisa",
    academicYear: "1447–1448 H",
    hifz: {
      newPagesCount: 100,
      summaryEn: "5 Ajzaa (100 new pages)",
      oldNizamAjzaaEn: "Juz 30, Juz 1–18",
      oldNizamAjzaaAr: "أجزاء: ٣٠، ١-١٨",
      newNizamAjzaaEn: "Juz 26–30, Juz 1–14",
      newNizamAjzaaAr: "أجزاء: ٢٦-٣٠، ١-١٤",
    },
    uloomQuran: {
      bookNameAr: "خزائن معاني القرآن الفائقة",
      bookNameEn: "Khazain Ma'ani al-Quran",
      ajzaaEn: "Juz 6, 7, 8, 9, 10",
      ajzaaAr: "الأجزاء: ٦، ٧، ٨، ٩، ١٠",
    },
    tajweed: {
      sourcesEn: "Tuhfat al-Atfal, Al-Muqaddimah al-Jazariyyah & Al-Burhan",
      sourcesAr: "تحفة الأطفال والمقدمة الجزرية والبرهان",
      topics: [
        { en: "Makharij al-Huruf", ar: "باب مخارج الحروف" },
        { en: "Sifaat al-Huruf", ar: "باب صفات الحروف" },
        { en: "Letter Relations", ar: "باب المثلين والمتقاربين والمتجانسين والمتباعدين" },
        { en: "Hadhaf & Ithbat", ar: "باب الحذف والإثبات" },
        { en: "Haa ad-Dameer (Silah)", ar: "حكم هاء الضمير (الصلة)" },
      ],
    },
  },
  4: {
    darajahNumber: 4,
    nameAr: "الرابعة",
    nameEn: "Darajah 4",
    shortName: "Rabia",
    academicYear: "1447–1448 H",
    hifz: {
      newPagesCount: 100,
      summaryEn: "5 Ajzaa (100 new pages)",
      oldNizamAjzaaEn: "Juz 30, Juz 1–22",
      oldNizamAjzaaAr: "أجزاء: ٣٠، ١-٢٢",
      newNizamAjzaaEn: "Juz 26–30, Juz 1–18",
      newNizamAjzaaAr: "أجزاء: ٢٦-٣٠، ١-١٨",
    },
    uloomQuran: {
      bookNameAr: "خزائن معاني القرآن الفائقة",
      bookNameEn: "Khazain Ma'ani al-Quran",
      ajzaaEn: "Juz 11, 12, 13, 14, 15",
      ajzaaAr: "الأجزاء: ١١، ١٢، ١٣، ١٤، ١٥",
    },
    tajweed: {
      sourcesEn: "Tuhfat al-Atfal, Al-Muqaddimah al-Jazariyyah & Al-Burhan",
      sourcesAr: "تحفة الأطفال والمقدمة الجزرية والبرهان",
      topics: [
        { en: "Waqf & Ibtida", ar: "باب الوقف والابتداء" },
        { en: "Maqtoo' & Mawsool", ar: "باب المقطوع والموصول" },
        { en: "Haa at-Ta'neeth (Open Taa)", ar: "باب هاء التأنيث التي كتبت بالتاء المجرورة" },
        { en: "Words Read with Sad / Seen", ar: "الكلمات التي تقرأ بالصاد والسين" },
      ],
    },
  },
};

export const QURAN_IKHTEBAAR_DATA: Record<NizamType, NizamConfig> = {
  OLD: {
    id: "OLD",
    titleEn: "Old Nizam",
    titleAr: "النظام القديم",
    summaryEn: "Juz 30 followed sequentially by Juz 1–22.",
    darajahs: {
      1: {
        darajahNumber: 1,
        nameAr: "الأولى",
        nameEn: "Darajah 1",
        shortName: "Oola",
        juzRangeEn: "Juz 30, Juz 1–5",
        juzRangeAr: "أجزاء: ٣٠، ١-٥",
        allowedJuz: [30, ...range(1, 5)],
        totalMarks: 60,
        passingMarks: 40,
        officialSyllabus: OFFICIAL_ALJAMEA_QURAN_SYLLABUS[1],
      },
      2: {
        darajahNumber: 2,
        nameAr: "الثانية",
        nameEn: "Darajah 2",
        shortName: "Saniya",
        juzRangeEn: "Juz 30, Juz 1–12",
        juzRangeAr: "أجزاء: ٣٠، ١-١٢",
        allowedJuz: [30, ...range(1, 12)],
        totalMarks: 60,
        passingMarks: 40,
        officialSyllabus: OFFICIAL_ALJAMEA_QURAN_SYLLABUS[2],
      },
      3: {
        darajahNumber: 3,
        nameAr: "الثالثة",
        nameEn: "Darajah 3",
        shortName: "Salisa",
        juzRangeEn: "Juz 30, Juz 1–18",
        juzRangeAr: "أجزاء: ٣٠، ١-١٨",
        allowedJuz: [30, ...range(1, 18)],
        totalMarks: 60,
        passingMarks: 40,
        officialSyllabus: OFFICIAL_ALJAMEA_QURAN_SYLLABUS[3],
      },
      4: {
        darajahNumber: 4,
        nameAr: "الرابعة",
        nameEn: "Darajah 4",
        shortName: "Rabia",
        juzRangeEn: "Juz 30, Juz 1–22",
        juzRangeAr: "أجزاء: ٣٠، ١-٢٢",
        allowedJuz: [30, ...range(1, 22)],
        totalMarks: 60,
        passingMarks: 40,
        officialSyllabus: OFFICIAL_ALJAMEA_QURAN_SYLLABUS[4],
      },
    },
  },
  NEW: {
    id: "NEW",
    titleEn: "New Nizam",
    titleAr: "النظام الجديد",
    summaryEn: "Juz 26–30 alongside sequential Juz 1–18.",
    darajahs: {
      1: {
        darajahNumber: 1,
        nameAr: "الأولى",
        nameEn: "Darajah 1",
        shortName: "Oola",
        juzRangeEn: "Juz 26–30, Juz 1",
        juzRangeAr: "أجزاء: ٢٦-٣٠، ١",
        allowedJuz: [...range(26, 30), 1],
        totalMarks: 60,
        passingMarks: 40,
        officialSyllabus: OFFICIAL_ALJAMEA_QURAN_SYLLABUS[1],
      },
      2: {
        darajahNumber: 2,
        nameAr: "الثانية",
        nameEn: "Darajah 2",
        shortName: "Saniya",
        juzRangeEn: "Juz 26–30, Juz 1–6",
        juzRangeAr: "أجزاء: ٢٦-٣٠، ١-٦",
        allowedJuz: [...range(26, 30), ...range(1, 6)],
        totalMarks: 60,
        passingMarks: 40,
        officialSyllabus: OFFICIAL_ALJAMEA_QURAN_SYLLABUS[2],
      },
      3: {
        darajahNumber: 3,
        nameAr: "الثالثة",
        nameEn: "Darajah 3",
        shortName: "Salisa",
        juzRangeEn: "Juz 26–30, Juz 1–14",
        juzRangeAr: "أجزاء: ٢٦-٣٠، ١-١٤",
        allowedJuz: [...range(26, 30), ...range(1, 14)],
        totalMarks: 60,
        passingMarks: 40,
        officialSyllabus: OFFICIAL_ALJAMEA_QURAN_SYLLABUS[3],
      },
      4: {
        darajahNumber: 4,
        nameAr: "الرابعة",
        nameEn: "Darajah 4",
        shortName: "Rabia",
        juzRangeEn: "Juz 26–30, Juz 1–18",
        juzRangeAr: "أجزاء: ٢٦-٣٠، ١-١٨",
        allowedJuz: [...range(26, 30), ...range(1, 18)],
        totalMarks: 60,
        passingMarks: 40,
        officialSyllabus: OFFICIAL_ALJAMEA_QURAN_SYLLABUS[4],
      },
    },
  },
};

// ────────────────────────────────────────────────────────────────────────────
// JUZ-VERIFIED MISRI MUSHAF QUESTION POOL (JUZ 1–22 & JUZ 26–30)
// Every entry has exact Surah, Ayah, Juz, Misri text, and 10 marks.
// ────────────────────────────────────────────────────────────────────────────
type RawPoolItem = Omit<QuestionItem, "qNumber" | "marks">;

const MASTER_QUESTION_POOL: RawPoolItem[] = [
  // ── JUZ 1 ──
  {
    id: "juz1-baqarah-6",
    promptEn: "Recite from Surah Al-Baqarah (Juz 1):",
    ayahTextAr: "إِنَّ الَّذِينَ كَفَرُوا سَوَاءٌ عَلَيْهِمْ أَأَنْذَرْتَهُمْ أَمْ لَمْ تُنْذِرْهُمْ لَا يُؤْمِنُونَ ﴿٦﴾ خَتَمَ اللَّهُ عَلَى قُلُوبِهِمْ وَعَلَى سَمْعِهِمْ وَعَلَى أَبْصَارِهِمْ غِشَاوَةٌ وَلَهُمْ عَذَابٌ عَظِيمٌ ﴿٧﴾",
    surahNameAr: "سورة البقرة",
    surahNameEn: "Surah Al-Baqarah",
    surahNumber: 2,
    ayahStart: 6,
    ayahEnd: 16,
    juzNumber: 1,
  },
  {
    id: "juz1-baqarah-30",
    promptEn: "Recite from Surah Al-Baqarah (Juz 1):",
    ayahTextAr: "وَإِذْ قَالَ رَبُّكَ لِلْمَلَائِكَةِ إِنِّي جَاعِلٌ فِي الْأَرْضِ خَلِيفَةً قَالُوا أَتَجْعَلُ فِيهَا مَنْ يُفْسِدُ فِيهَا وَيَسْفِكُ الدِّمَاءَ وَنَحْنُ نُسَبِّحُ بِحَمْدِكَ وَنُقَدِّسُ لَكَ ﴿٣٠﴾",
    surahNameAr: "سورة البقرة",
    surahNameEn: "Surah Al-Baqarah",
    surahNumber: 2,
    ayahStart: 30,
    ayahEnd: 38,
    juzNumber: 1,
  },

  // ── JUZ 2 ──
  {
    id: "juz2-baqarah-177",
    promptEn: "Recite from Surah Al-Baqarah (Juz 2):",
    ayahTextAr: "لَيْسَ الْبِرَّ أَنْ تُوَلُّوا وُجُوهَكُمْ قِبَلَ الْمَشْرِقِ وَالْمَغْرِبِ وَلَكِنَّ الْبِرَّ مَنْ آمَنَ بِاللَّهِ وَالْيَوْمِ الْآخِرِ وَالْمَلَائِكَةِ وَالْكِتَابِ وَالنَّبِيِّينَ ﴿١٧٧﴾",
    surahNameAr: "سورة البقرة",
    surahNameEn: "Surah Al-Baqarah",
    surahNumber: 2,
    ayahStart: 177,
    ayahEnd: 182,
    juzNumber: 2,
  },
  {
    id: "juz2-baqarah-245",
    promptEn: "Recite from Surah Al-Baqarah (Juz 2):",
    ayahTextAr: "مَنْ ذَا الَّذِي يُقْرِضُ اللَّهَ قَرْضًا حَسَنًا فَيُضَاعِفَهُ لَهُ أَضْعَافًا كَثِيرَةً وَاللَّهُ يَقْبِضُ وَيَبْسُطُ وَإِلَيْهِ تُرْجَعُونَ ﴿٢٤٥﴾",
    surahNameAr: "سورة البقرة",
    surahNameEn: "Surah Al-Baqarah",
    surahNumber: 2,
    ayahStart: 245,
    ayahEnd: 249,
    juzNumber: 2,
  },

  // ── JUZ 3 ──
  {
    id: "juz3-imran-1",
    promptEn: "Recite from Surah Ali 'Imran (Juz 3):",
    ayahTextAr: "الم ﴿١﴾ اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ﴿٢﴾ نَزَّلَ عَلَيْكَ الْكِتَابَ بِالْحَقِّ مُصَدِّقًا لِمَا بَيْنَ يَدَيْهِ وَأَنْزَلَ التَّوْرَاةَ وَالْإِنْجِيلَ ﴿٣﴾",
    surahNameAr: "سورة آل عمران",
    surahNameEn: "Surah Ali 'Imran",
    surahNumber: 3,
    ayahStart: 1,
    ayahEnd: 9,
    juzNumber: 3,
  },
  {
    id: "juz3-baqarah-255",
    promptEn: "Recite from Surah Al-Baqarah (Juz 3):",
    ayahTextAr: "اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ﴿٢٥٥﴾",
    surahNameAr: "سورة البقرة",
    surahNameEn: "Surah Al-Baqarah",
    surahNumber: 2,
    ayahStart: 255,
    ayahEnd: 260,
    juzNumber: 3,
  },

  // ── JUZ 4 ──
  {
    id: "juz4-imran-102",
    promptEn: "Recite from Surah Ali 'Imran (Juz 4):",
    ayahTextAr: "يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ حَقَّ تُقَاتِهِ وَلَا تَمُوتُنَّ إِلَّا وَأَنْتُمْ مُسْلِمُونَ ﴿١٠٢﴾ وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا ﴿١٠٣﴾",
    surahNameAr: "سورة آل عمران",
    surahNameEn: "Surah Ali 'Imran",
    surahNumber: 3,
    ayahStart: 102,
    ayahEnd: 110,
    juzNumber: 4,
  },

  // ── JUZ 5 ──
  {
    id: "juz5-nisa-24",
    promptEn: "Recite from Surah An-Nisa (Juz 5):",
    ayahTextAr: "وَالْمُحْصَنَاتُ مِنَ النِّسَاءِ إِلَّا مَا مَلَكَتْ أَيْمَانُكُمْ كِتَابَ اللَّهِ عَلَيْكُمْ وَأُحِلَّ لَكُمْ مَا وَرَاءَ ذَلِكُمْ أَنْ تَبْتَغُوا بِأَمْوَالكُمْ مُحْصِنِينَ غَيْرَ مُسَافِحِينَ ﴿٢٤﴾",
    surahNameAr: "سورة النساء",
    surahNameEn: "Surah An-Nisa",
    surahNumber: 4,
    ayahStart: 24,
    ayahEnd: 30,
    juzNumber: 5,
  },
  {
    id: "juz5-nisa-58",
    promptEn: "Recite from Surah An-Nisa (Juz 5):",
    ayahTextAr: "إِنَّ اللَّهَ يَأْمُرُكُمْ أَنْ تُؤَدُّوا الْأَمَانَاتِ إِلَى أَهْلِهَا وَإِذَا حَكَمْتُمْ بَيْنَ النَّاسِ أَنْ تَحْكُمُوا بِالْعَدْلِ ﴿٥٨﴾",
    surahNameAr: "سورة النساء",
    surahNameEn: "Surah An-Nisa",
    surahNumber: 4,
    ayahStart: 58,
    ayahEnd: 65,
    juzNumber: 5,
  },

  // ── JUZ 6 ──
  {
    id: "juz6-maidah-1",
    promptEn: "Recite from Surah Al-Ma'idah (Juz 6):",
    ayahTextAr: "يَا أَيُّهَا الَّذِينَ آمَنُوا أَوْفُوا بِالْعُقُودِ أُحِلَّتْ لَكُمْ بَهِيمَةُ الْأَنْعَامِ إِلَّا مَا يُتْلَى عَلَيْكُمْ غَيْرَ مُحِلِّي الصَّيْدِ وَأَنْتُمْ حُرُمٌ ﴿١﴾",
    surahNameAr: "سورة المائدة",
    surahNameEn: "Surah Al-Ma'idah",
    surahNumber: 5,
    ayahStart: 1,
    ayahEnd: 6,
    juzNumber: 6,
  },

  // ── JUZ 7 ──
  {
    id: "juz7-anam-1",
    promptEn: "Recite from Surah Al-An'am (Juz 7):",
    ayahTextAr: "الْحَمْدُ لِلَّهِ الَّذِي خَلَقَ السَّمَاوَاتِ وَالْأَرْضَ وَجَعَلَ الظُّلُمَاتِ وَالنُّورَ ثُمَّ الَّذِينَ كَفَرُوا بِرَبِّهِمْ يَعْدِلُونَ ﴿١﴾",
    surahNameAr: "سورة الأنعام",
    surahNameEn: "Surah Al-An'am",
    surahNumber: 6,
    ayahStart: 1,
    ayahEnd: 10,
    juzNumber: 7,
  },

  // ── JUZ 8 ──
  {
    id: "juz8-araf-40",
    promptEn: "Recite from Surah Al-A'raf (Juz 8):",
    ayahTextAr: "إِنَّ الَّذِينَ كَذَّبُوا بِآيَاتِنَا وَاسْتَكْبَرُوا عَنْهَا لَا تُفَتَّحُ لَهُمْ أَبْوَابُ السَّمَاءِ وَلَا يَدْخُلُونَ الْجَنَّةَ حَتَّى يَلِجَ الْجَمَلُ فِي سَمِّ الْخِيَاطِ ﴿٤٠﴾",
    surahNameAr: "سورة الأعراف",
    surahNameEn: "Surah Al-A'raf",
    surahNumber: 7,
    ayahStart: 40,
    ayahEnd: 47,
    juzNumber: 8,
  },

  // ── JUZ 9 ──
  {
    id: "juz9-araf-171",
    promptEn: "Recite from Surah Al-A'raf (Juz 9):",
    ayahTextAr: "وَإِذْ نَتَقْنَا الْجَبَلَ فَوْقَهُمْ كَأَنَّهُ ظُلَّةٌ وَظَنُّوا أَنَّهُ وَاقِعٌ بِهِمْ خُذُوا مَا آتَيْنَاكُمْ بِقُوَّةٍ وَاذْكُرُوا مَا فِيهِ لَعَلَّكُمْ تَتَّقُونَ ﴿١٧١﴾",
    surahNameAr: "سورة الأعراف",
    surahNameEn: "Surah Al-A'raf",
    surahNumber: 7,
    ayahStart: 171,
    ayahEnd: 178,
    juzNumber: 9,
  },

  // ── JUZ 10 ──
  {
    id: "juz10-tawbah-32",
    promptEn: "Recite from Surah At-Tawbah (Juz 10):",
    ayahTextAr: "يُرِيدُونَ أَنْ يُطْفِئُوا نُورَ اللَّهِ بِأَفْوَاهِهِمْ وَيَأْبَى اللَّهُ إِلَّا أَنْ يُتِمَّ نُورَهُ وَلَوْ كَرِهَ الْكَافِرُونَ ﴿٣٢﴾",
    surahNameAr: "سورة التوبة",
    surahNameEn: "Surah At-Tawbah",
    surahNumber: 9,
    ayahStart: 32,
    ayahEnd: 37,
    juzNumber: 10,
  },

  // ── JUZ 11 ──
  {
    id: "juz11-hud-1",
    promptEn: "Recite from Surah Hud (Juz 11):",
    ayahTextAr: "الر كِتَابٌ أُحْكِمَتْ آيَاتُهُ ثُمَّ فُصِّلَتْ مِنْ لَدُنْ حَكِيمٍ خَبِيرٍ ﴿١﴾ أَلَّا تَعْبُدُوا إِلَّا اللَّهَ إِنَّنِي لَكُمْ مِنْهُ نَذِيرٌ وَبَشِيرٌ ﴿٢﴾",
    surahNameAr: "سورة هود",
    surahNameEn: "Surah Hud",
    surahNumber: 11,
    ayahStart: 1,
    ayahEnd: 7,
    juzNumber: 11,
  },

  // ── JUZ 12 ──
  {
    id: "juz12-yusuf-11",
    promptEn: "Recite from Surah Yusuf (Juz 12):",
    ayahTextAr: "قَالُوا يَا أَبَانَا مَا لَكَ لَا تَأْمَنَّا عَلَى يُوسُفَ وَإِنَّا لَهُ لَنَاصِحُونَ ﴿١١﴾ أَرْسِلْهُ مَعَنَا غَدًا يَرْتَعْ وَيَلْعَبْ وَإِنَّا لَهُ لَحَافِظُونَ ﴿١٢﴾",
    surahNameAr: "سورة يوسف",
    surahNameEn: "Surah Yusuf",
    surahNumber: 12,
    ayahStart: 11,
    ayahEnd: 20,
    juzNumber: 12,
  },
  {
    id: "juz12-hud-41",
    promptEn: "Recite from Surah Hud (Juz 12):",
    ayahTextAr: "وَقَالَ ارْكَبُوا فِيهَا بِسْمِ اللَّهِ مَجْرَاهَا وَمُرْسَاهَا إِنَّ رَبِّي لَغَفُورٌ رَحِيمٌ ﴿٤١﴾",
    surahNameAr: "سورة هود",
    surahNameEn: "Surah Hud",
    surahNumber: 11,
    ayahStart: 41,
    ayahEnd: 46,
    juzNumber: 12,
  },

  // ── JUZ 13 ──
  {
    id: "juz13-ibrahim-1",
    promptEn: "Recite from Surah Ibrahim (Juz 13):",
    ayahTextAr: "الر كِتَابٌ أَنْزَلْنَاهُ إِلَيْكَ لِتُخْرِجَ النَّاسَ مِنَ الظُّلُمَاتِ إِلَى النُّورِ بِإِذْنِ رَبِّهِمْ إِلَى صِرَاطِ الْعَزِيزِ الْحَمِيدِ ﴿١﴾",
    surahNameAr: "سورة إبراهيم",
    surahNameEn: "Surah Ibrahim",
    surahNumber: 14,
    ayahStart: 1,
    ayahEnd: 7,
    juzNumber: 13,
  },
  {
    id: "juz13-rad-8",
    promptEn: "Recite from Surah Ar-Ra'd (Juz 13):",
    ayahTextAr: "اللَّهُ يَعْلَمُ مَا تَحْمِلُ كُلُّ أُنْثَى وَمَا تَغِيضُ الْأَرْحَامُ وَمَا تَزْدَادُ وَكُلُّ شَيْءٍ عِنْدَهُ بِمِقْدَارٍ ﴿٨﴾",
    surahNameAr: "سورة الرعد",
    surahNameEn: "Surah Ar-Ra'd",
    surahNumber: 13,
    ayahStart: 8,
    ayahEnd: 15,
    juzNumber: 13,
  },

  // ── JUZ 14 ──
  {
    id: "juz14-nahl-75",
    promptEn: "Recite from Surah An-Nahl (Juz 14):",
    ayahTextAr: "ضَرَبَ اللَّهُ مَثَلًا عَبْدًا مَمْلُوكًا لَا يَقْدِرُ عَلَى شَيْءٍ وَمَنْ رَزَقْنَاهُ مِنَّا رِزْقًا حَسَنًا فَهُوَ يُنْفِقُ مِنْهُ سِرًّا وَجَهْرًا ﴿٧٥﴾",
    surahNameAr: "سورة النحل",
    surahNameEn: "Surah An-Nahl",
    surahNumber: 16,
    ayahStart: 75,
    ayahEnd: 81,
    juzNumber: 14,
  },
  {
    id: "juz14-nahl-18",
    promptEn: "Recite from Surah An-Nahl (Juz 14):",
    ayahTextAr: "وَإِنْ تَعُدُّوا نِعْمَتَ اللَّهِ لَا تُحْصُوهَا إِنَّ اللَّهَ لَغَفُورٌ رَحِيمٌ ﴿١٨﴾",
    surahNameAr: "سورة النحل",
    surahNameEn: "Surah An-Nahl",
    surahNumber: 16,
    ayahStart: 18,
    ayahEnd: 25,
    juzNumber: 14,
  },

  // ── JUZ 15 ──
  {
    id: "juz15-isra-1",
    promptEn: "Recite from Surah Al-Isra (Juz 15):",
    ayahTextAr: "سُبْحَانَ الَّذِي أَسْرَى بِعَبْدِهِ لَيْلًا مِنَ الْمَسْجِدِ الْحَرَامِ إِلَى الْمَسْجِدِ الْأَقْصَا الَّذِي بَارَكْنَا حَوْلَهُ لِنُرِيَهُ مِنْ آيَاتِنَا ﴿١﴾",
    surahNameAr: "سورة الإسراء",
    surahNameEn: "Surah Al-Isra",
    surahNumber: 17,
    ayahStart: 1,
    ayahEnd: 7,
    juzNumber: 15,
  },
  {
    id: "juz15-kahf-9",
    promptEn: "Recite from Surah Al-Kahf (Juz 15):",
    ayahTextAr: "أَمْ حَسِبْتَ أَنَّ أَصْحَابَ الْكَهْفِ وَالرَّقِيمِ كَانُوا مِنْ آيَاتِنَا عَجَبًا ﴿٩﴾ إِذْ أَوَى الْفِتْيَةُ إِلَى الْكَهْفِ فَقَالُوا رَبَّنَا آتِنَا مِنْ لَدُنْكَ رَحْمَةً ﴿١٠﴾",
    surahNameAr: "سورة الكهف",
    surahNameEn: "Surah Al-Kahf",
    surahNumber: 18,
    ayahStart: 9,
    ayahEnd: 16,
    juzNumber: 15,
  },

  // ── JUZ 16 ──
  {
    id: "juz16-taha-1",
    promptEn: "Recite from Surah Ta-Ha (Juz 16):",
    ayahTextAr: "طه ﴿١﴾ مَا أَنْزَلْنَا عَلَيْكَ الْقُرْآنَ لِتَشْقَى ﴿٢﴾ إِلَّا تَذْكِرَةً لِمَنْ يَخْشَى ﴿٣﴾ تَنْزِيلًا مِمَّنْ خَلَقَ الْأَرْضَ وَالسَّمَاوَاتِ الْعُلَى ﴿٤﴾",
    surahNameAr: "سورة طه",
    surahNameEn: "Surah Ta-Ha",
    surahNumber: 20,
    ayahStart: 1,
    ayahEnd: 8,
    juzNumber: 16,
  },
  {
    id: "juz16-maryam-1",
    promptEn: "Recite from Surah Maryam (Juz 16):",
    ayahTextAr: "كهيعص ﴿١﴾ ذِكْرُ رَحْمَتِ رَبِّكَ عَبْدَهُ زَكَرِيَّا ﴿٢﴾ إِذْ نَادَى رَبَّهُ نِدَاءً خَفِيًّا ﴿٣﴾ قَالَ رَبِّ إِنِّي وَهَنَ الْعَظْمُ مِنِّي وَاشْتَعَلَ الرَّأْسُ شَيْبًا ﴿٤﴾",
    surahNameAr: "سورة مريم",
    surahNameEn: "Surah Maryam",
    surahNumber: 19,
    ayahStart: 1,
    ayahEnd: 7,
    juzNumber: 16,
  },

  // ── JUZ 17 ──
  {
    id: "juz17-anbiya-1",
    promptEn: "Recite from Surah Al-Anbiya (Juz 17):",
    ayahTextAr: "اقْتَرَبَ لِلنَّاسِ حِسَابُهُمْ وَهُمْ فِي غَفْلَةٍ مُعْرِضُونَ ﴿١﴾ مَا يَأْتِيهِمْ مِنْ ذِكْرٍ مِنْ رَبِّهِمْ مُحْدَثٍ إِلَّا اسْتَمَعُوهُ وَهُمْ يَلْعَبُونَ ﴿٢﴾",
    surahNameAr: "سورة الأنبياء",
    surahNameEn: "Surah Al-Anbiya",
    surahNumber: 21,
    ayahStart: 1,
    ayahEnd: 7,
    juzNumber: 17,
  },
  {
    id: "juz17-anbiya-87",
    promptEn: "Recite from Surah Al-Anbiya (Juz 17):",
    ayahTextAr: "وَذَا النُّونِ إِذْ ذَهَبَ مُغَاضِبًا فَظَنَّ أَنْ لَنْ نَقْدِرَ عَلَيْهِ فَنَادَى فِي الظُّلُمَاتِ أَنْ لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ ﴿٨٧﴾",
    surahNameAr: "سورة الأنبياء",
    surahNameEn: "Surah Al-Anbiya",
    surahNumber: 21,
    ayahStart: 87,
    ayahEnd: 94,
    juzNumber: 17,
  },

  // ── JUZ 18 ──
  {
    id: "juz18-nur-1",
    promptEn: "Recite from Surah An-Nur (Juz 18):",
    ayahTextAr: "سُورَةٌ أَنْزَلْنَاهَا وَفَرَضْنَاهَا وَأَنْزَلْنَا فِيهَا آيَاتٍ بَيِّنَاتٍ لَعَلَّكُمْ تَذَكَّرُونَ ﴿١﴾",
    surahNameAr: "سورة النور",
    surahNameEn: "Surah An-Nur",
    surahNumber: 24,
    ayahStart: 1,
    ayahEnd: 5,
    juzNumber: 18,
  },
  {
    id: "juz18-nur-35",
    promptEn: "Recite from Surah An-Nur (Juz 18):",
    ayahTextAr: "اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ مَثَلُ نُورِهِ كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ الْمِصْبَاحُ فِي زُجَاجَةٍ الزُّجَاجَةُ كَأَنَّهَا كَوْكَبٌ دُرِّيٌّ يُوقَدُ مِنْ شَجَرَةٍ مُبَارَكَةٍ ﴿٣٥﴾",
    surahNameAr: "سورة النور",
    surahNameEn: "Surah An-Nur",
    surahNumber: 24,
    ayahStart: 35,
    ayahEnd: 38,
    juzNumber: 18,
  },

  // ── JUZ 19 ──
  {
    id: "juz19-furqan-61",
    promptEn: "Recite from Surah Al-Furqan (Juz 19):",
    ayahTextAr: "تَبَارَكَ الَّذِي جَعَلَ فِي السَّمَاءِ بُرُوجًا وَجَعَلَ فِيهَا سِرَاجًا وَقَمَرًا مُنِيرًا ﴿٦١﴾",
    surahNameAr: "سورة الفرقان",
    surahNameEn: "Surah Al-Furqan",
    surahNumber: 25,
    ayahStart: 61,
    ayahEnd: 68,
    juzNumber: 19,
  },
  {
    id: "juz19-naml-30",
    promptEn: "Recite from Surah An-Naml (Juz 19):",
    ayahTextAr: "إِنَّهُ مِنْ سُلَيْمَانَ وَإِنَّهُ بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ ﴿٣٠﴾ أَلَّا تَعْلُوا عَلَيَّ وَأْتُونِي مُسْلِمِينَ ﴿٣١﴾",
    surahNameAr: "سورة النمل",
    surahNameEn: "Surah An-Naml",
    surahNumber: 27,
    ayahStart: 30,
    ayahEnd: 37,
    juzNumber: 19,
  },

  // ── JUZ 20 ──
  {
    id: "juz20-qasas-1",
    promptEn: "Recite from Surah Al-Qasas (Juz 20):",
    ayahTextAr: "طسم ﴿١﴾ تِلْكَ آيَاتُ الْكِتَابِ الْمُبِينِ ﴿٢﴾ نَتْلُو عَلَيْكَ مِنْ نَبَإِ مُوسَى وَفِرْعَوْنَ بِالْحَقِّ لِقَوْمٍ يُؤْمِنُونَ ﴿٣﴾",
    surahNameAr: "سورة القصص",
    surahNameEn: "Surah Al-Qasas",
    surahNumber: 28,
    ayahStart: 1,
    ayahEnd: 7,
    juzNumber: 20,
  },

  // ── JUZ 21 ──
  {
    id: "juz21-luqman-1",
    promptEn: "Recite from Surah Luqman (Juz 21):",
    ayahTextAr: "الم ﴿١﴾ تِلْكَ آيَاتُ الْكِتَابِ الْحَكِيمِ ﴿٢﴾ هُدًى وَرَحْمَةً لِلْمُحْسِنِينَ ﴿٣﴾ الَّذِينَ يُقِيمُونَ الصَّلَاةَ وَيُؤْتُونَ الزَّكَاةَ وَهُمْ بِالْآخِرَةِ هُمْ يُوقِنُونَ ﴿٤﴾",
    surahNameAr: "سورة لقمان",
    surahNameEn: "Surah Luqman",
    surahNumber: 31,
    ayahStart: 1,
    ayahEnd: 9,
    juzNumber: 21,
  },

  // ── JUZ 22 ──
  {
    id: "juz22-ahzab-53",
    promptEn: "Recite from Surah Al-Ahzab (Juz 22):",
    ayahTextAr: "يَا أَيُّهَا الَّذِينَ آمَنُوا لَا تَدْخُلُوا بُيُوتَ النَّبِيِّ إِلَّا أَنْ يُؤْذَنَ لَكُمْ إِلَى طَعَامٍ غَيْرَ نَاظِرِينَ إِنَاهُ ﴿٥٣﴾",
    surahNameAr: "سورة الأحزاب",
    surahNameEn: "Surah Al-Ahzab",
    surahNumber: 33,
    ayahStart: 53,
    ayahEnd: 56,
    juzNumber: 22,
  },
  {
    id: "juz22-yasin-1",
    promptEn: "Recite from Surah Ya-Sin (Juz 22):",
    ayahTextAr: "يس ﴿١﴾ وَالْقُرْآنِ الْحَكِيمِ ﴿٢﴾ إِنَّكَ لَمِنَ الْمُرْسَلِينَ ﴿٣﴾ عَلَى صِرَاطٍ مُسْتَقِيمٍ ﴿٤﴾ تَنْزِيلَ الْعَزِيزِ الرَّحِيمِ ﴿٥﴾",
    surahNameAr: "سورة يس",
    surahNameEn: "Surah Ya-Sin",
    surahNumber: 36,
    ayahStart: 1,
    ayahEnd: 12,
    juzNumber: 22,
  },

  // ── JUZ 26 ──
  {
    id: "juz26-fath-1",
    promptEn: "Recite from Surah Al-Fath (Juz 26):",
    ayahTextAr: "إِنَّا فَتَحْنَا لَكَ فَتْحًا مُبِينًا ﴿١﴾ لِيَغْفِرَ لَكَ اللَّهُ مَا تَقَدَّمَ مِنْ ذَنْبِكَ وَمَا تَأَخَّرَ وَيُتِمَّ نِعْمَتَهُ عَلَيْكَ وَيَهْدِيَكَ صِرَاطًا مُسْتَقِيمًا ﴿٢﴾",
    surahNameAr: "سورة الفتح",
    surahNameEn: "Surah Al-Fath",
    surahNumber: 48,
    ayahStart: 1,
    ayahEnd: 6,
    juzNumber: 26,
  },
  {
    id: "juz26-hujurat-1",
    promptEn: "Recite from Surah Al-Hujurat (Juz 26):",
    ayahTextAr: "يَا أَيُّهَا الَّذِينَ آمَنُوا لَا تُقَدِّمُوا بَيْنَ يَدَيِ اللَّهِ وَرَسُولِهِ وَاتَّقُوا اللَّهَ إِنَّ اللَّهَ سَمِيعٌ عَلِيمٌ ﴿١﴾",
    surahNameAr: "سورة الحجرات",
    surahNameEn: "Surah Al-Hujurat",
    surahNumber: 49,
    ayahStart: 1,
    ayahEnd: 6,
    juzNumber: 26,
  },
  {
    id: "juz26-qaf-1",
    promptEn: "Recite from Surah Qaf (Juz 26):",
    ayahTextAr: "ق وَالْقُرْآنِ الْمَجِيدِ ﴿١﴾ بَلْ عَجِبُوا أَنْ جَاءَهُمْ مُنْذِرٌ مِنْهُمْ فَقَالَ الْكَافِرُونَ هَذَا شَيْءٌ عَجِيبٌ ﴿٢﴾",
    surahNameAr: "سورة ق",
    surahNameEn: "Surah Qaf",
    surahNumber: 50,
    ayahStart: 1,
    ayahEnd: 10,
    juzNumber: 26,
  },

  // ── JUZ 27 ──
  {
    id: "juz27-rahman-1",
    promptEn: "Recite from Surah Ar-Rahman (Juz 27):",
    ayahTextAr: "الرَّحْمَنُ ﴿١﴾ عَلَّمَ الْقُرْآنَ ﴿٢﴾ خَلَقَ الْإِنْسَانَ ﴿٣﴾ عَلَّمَهُ الْبَيَانَ ﴿٤﴾ الشَّمْسُ وَالْقَمَرُ بِحُسْبَانٍ ﴿٥﴾ وَالنَّجْمُ وَالشَّجَرُ يَسْجُدَانِ ﴿٦﴾",
    surahNameAr: "سورة الرحمن",
    surahNameEn: "Surah Ar-Rahman",
    surahNumber: 55,
    ayahStart: 1,
    ayahEnd: 15,
    juzNumber: 27,
  },
  {
    id: "juz27-najm-1",
    promptEn: "Recite from Surah An-Najm (Juz 27):",
    ayahTextAr: "وَالنَّجْمِ إِذَا هَوَى ﴿١﴾ مَا ضَلَّ صَاحِبُكُمْ وَمَا غَوَى ﴿٢﴾ وَمَا يَنْطِقُ عَنِ الْهَوَى ﴿٣﴾ إِنْ هُوَ إِلَّا وَحْيٌ يُوحَى ﴿٤﴾",
    surahNameAr: "سورة النجم",
    surahNameEn: "Surah An-Najm",
    surahNumber: 53,
    ayahStart: 1,
    ayahEnd: 12,
    juzNumber: 27,
  },
  {
    id: "juz27-hadid-28",
    promptEn: "Recite from Surah Al-Hadid (Juz 27):",
    ayahTextAr: "يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ وَآمِنُوا بِرَسُولِهِ يُؤْتِكُمْ كِفْلَيْنِ مِنْ رَحْمَتِهِ وَيَجْعَلْ لَكُمْ نُورًا تَمْشُونَ بِهِ وَيَغْفِرْ لَكُمْ ﴿٢٨﴾",
    surahNameAr: "سورة الحديد",
    surahNameEn: "Surah Al-Hadid",
    surahNumber: 57,
    ayahStart: 28,
    ayahEnd: 29,
    juzNumber: 27,
  },

  // ── JUZ 28 ──
  {
    id: "juz28-mujadila-1",
    promptEn: "Recite from Surah Al-Mujadila (Juz 28):",
    ayahTextAr: "قَدْ سَمِعَ اللَّهُ قَوْلَ الَّتِي تُجَادِلُكَ فِي زَوْجِهَا وَتَشْتَكِي إِلَى اللَّهِ وَاللَّهُ يَسْمَعُ تَحَاوُرَكُمَا إِنَّ اللَّهَ سَمِيعٌ بَصِيرٌ ﴿١﴾",
    surahNameAr: "سورة المجادلة",
    surahNameEn: "Surah Al-Mujadila",
    surahNumber: 58,
    ayahStart: 1,
    ayahEnd: 6,
    juzNumber: 28,
  },
  {
    id: "juz28-hashr-21",
    promptEn: "Recite from Surah Al-Hashr (Juz 28):",
    ayahTextAr: "لَوْ أَنْزَلْنَا هَذَا الْقُرْآنَ عَلَى جَبَلٍ لَرَأَيْتَهُ خَاشِعًا مُتَصَدِّعًا مِنْ خَشْيَةِ اللَّهِ وَتِلْكَ الْأَمْثَالُ نَضْرِبُهَا لِلنَّاسِ لَعَلَّهُمْ يَتَفَكَّرُونَ ﴿٢١﴾",
    surahNameAr: "سورة الحشر",
    surahNameEn: "Surah Al-Hashr",
    surahNumber: 59,
    ayahStart: 21,
    ayahEnd: 24,
    juzNumber: 28,
  },

  // ── JUZ 29 ──
  {
    id: "juz29-mulk-1",
    promptEn: "Recite from Surah Al-Mulk (Juz 29):",
    ayahTextAr: "تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ ﴿١﴾ الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا وَهُوَ الْعَزِيزُ الْغَفُورُ ﴿٢﴾",
    surahNameAr: "سورة الملك",
    surahNameEn: "Surah Al-Mulk",
    surahNumber: 67,
    ayahStart: 1,
    ayahEnd: 8,
    juzNumber: 29,
  },
  {
    id: "juz29-qalam-1",
    promptEn: "Recite from Surah Al-Qalam (Juz 29):",
    ayahTextAr: "ن وَالْقَلَمِ وَمَا يَسْطُرُونَ ﴿١﴾ مَا أَنْتَ بِنِعْمَةِ رَبِّكَ بِمَجْنُونٍ ﴿٢﴾ وَإِنَّ لَكَ لَأَجْرًا غَيْرَ مَمْنُونٍ ﴿٣﴾",
    surahNameAr: "سورة القلم",
    surahNameEn: "Surah Al-Qalam",
    surahNumber: 68,
    ayahStart: 1,
    ayahEnd: 10,
    juzNumber: 29,
  },

  // ── JUZ 30 ──
  {
    id: "juz30-naba-1",
    promptEn: "Recite from Surah An-Naba (Juz 30):",
    ayahTextAr: "عَمَّ يَتَسَاءَلُونَ ﴿١﴾ عَنِ النَّبَإِ الْعَظِيمِ ﴿٢﴾ الَّذِي هُمْ فِيهِ مُخْتَلِفُونَ ﴿٣﴾ كَلَّا سَيَعْلَمُونَ ﴿٤﴾ ثُمَّ كَلَّا سَيَعْلَمُونَ ﴿٥﴾",
    surahNameAr: "سورة النبأ",
    surahNameEn: "Surah An-Naba",
    surahNumber: 78,
    ayahStart: 1,
    ayahEnd: 10,
    juzNumber: 30,
  },
  {
    id: "juz30-abasa-24",
    promptEn: "Recite from Surah 'Abasa (Juz 30):",
    ayahTextAr: "فَلْيَنْظُرِ الْإِنْسَانُ إِلَى طَعَامِهِ ﴿٢٤﴾ أَنَّا صَبَبْنَا الْمَاءَ صَبًّا ﴿٢٥﴾ ثُمَّ شَقَقْنَا الْأَرْضَ شَقًّا ﴿٢٦﴾ فَأَنْبَتْنَا فِيهَا حَبًّا ﴿٢٧﴾",
    surahNameAr: "سورة عبس",
    surahNameEn: "Surah 'Abasa",
    surahNumber: 80,
    ayahStart: 24,
    ayahEnd: 32,
    juzNumber: 30,
  },
];

export const DARAJAH_LIST = [
  { num: 1, nameAr: "الأولى", nameEn: "Darajah 1", shortName: "Oola" },
  { num: 2, nameAr: "الثانية", nameEn: "Darajah 2", shortName: "Saniya" },
  { num: 3, nameAr: "الثالثة", nameEn: "Darajah 3", shortName: "Salisa" },
  { num: 4, nameAr: "الرابعة", nameEn: "Darajah 4", shortName: "Rabia" },
];

export function getDarajahSyllabus(nizam: NizamType, darajah: number): DarajahSyllabus | null {
  const nizamConfig = QURAN_IKHTEBAAR_DATA[nizam];
  if (!nizamConfig) return null;
  return nizamConfig.darajahs[darajah] || null;
}

/**
 * Deterministic PRNG for clean, repeatable shuffling per seed.
 */
function seededOrder<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed + 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generates 6 questions strictly within the assigned Nizam + Darajah Juz syllabus.
 * Guarantees:
 *  - Every question is 10 marks
 *  - Every question is from a DIFFERENT Juz (6 distinct Juz per paper)
 *  - No repeated questions in the paper, and avoids previously shown IDs when shuffling
 */
export function getRandomizedExamPaper(
  nizam: NizamType,
  darajah: number,
  seed: number = 0,
  excludeIds: string[] = []
): QuestionItem[] {
  const syl = getDarajahSyllabus(nizam, darajah);
  if (!syl) return [];

  const allowedSet = new Set(syl.allowedJuz);
  const eligible = MASTER_QUESTION_POOL.filter((q) => allowedSet.has(q.juzNumber));

  const excludedSet = new Set(excludeIds);
  // Strictly prefer mid-Surah/mid-page questions (ayahStart > 3, never starting first 2 lines)
  const nonOpening = eligible.filter((q) => q.ayahStart > 3);
  const openingOnly = eligible.filter((q) => q.ayahStart <= 3);

  const freshNonOpening = nonOpening.filter((q) => !excludedSet.has(q.id));
  const usedNonOpening = nonOpening.filter((q) => excludedSet.has(q.id));
  const freshOpening = openingOnly.filter((q) => !excludedSet.has(q.id));
  const usedOpening = openingOnly.filter((q) => excludedSet.has(q.id));

  const s1 = seed > 0 ? seededOrder(freshNonOpening, seed * 31 + darajah * 7 + (nizam === "NEW" ? 13 : 3)) : freshNonOpening;
  const s2 = seed > 0 ? seededOrder(usedNonOpening, seed * 17 + darajah) : usedNonOpening;
  const s3 = seed > 0 ? seededOrder(freshOpening, seed * 19 + darajah) : freshOpening;
  const s4 = seed > 0 ? seededOrder(usedOpening, seed * 23 + darajah) : usedOpening;
  const combined = [...s1, ...s2, ...s3, ...s4];

  const picked: QuestionItem[] = [];
  const usedJuz = new Set<number>();
  const usedIds = new Set<string>();

  for (const item of combined) {
    if (picked.length >= 6) break;
    if (usedJuz.has(item.juzNumber) || usedIds.has(item.id)) continue;
    usedJuz.add(item.juzNumber);
    usedIds.add(item.id);
    picked.push({
      ...item,
      qNumber: picked.length + 1,
      marks: 10,
    });
  }

  return picked;
}

const JUZ_PAGE_RANGES: Record<number, [number, number]> = {
  1: [2, 21],
  2: [22, 41],
  3: [42, 61],
  4: [62, 81],
  5: [82, 101],
  6: [102, 121],
  7: [122, 141],
  8: [142, 161],
  9: [162, 181],
  10: [182, 201],
  11: [202, 221],
  12: [222, 241],
  13: [242, 261],
  14: [262, 281],
  15: [282, 301],
  16: [302, 321],
  17: [322, 341],
  18: [342, 361],
  19: [362, 381],
  20: [382, 401],
  21: [402, 421],
  22: [422, 441],
  23: [442, 461],
  24: [462, 481],
  25: [482, 501],
  26: [502, 521],
  27: [522, 541],
  28: [542, 561],
  29: [562, 581],
  30: [582, 603],
};

const surahMetaCache = new Map<number, { nameSimple: string; nameAr: string }>();

async function getSurahMeta(surahNum: number): Promise<{ nameSimple: string; nameAr: string }> {
  const cached = surahMetaCache.get(surahNum);
  if (cached) return cached;
  try {
    const res = await fetch(`https://api.quran.com/api/v4/chapters/${surahNum}`);
    if (res.ok) {
      const json = await res.json();
      const ch = json?.chapter;
      if (ch) {
        const meta = {
          nameSimple: `Surah ${ch.name_simple || surahNum}`,
          nameAr: `سورة ${ch.name_arabic || ""}`.trim(),
        };
        surahMetaCache.set(surahNum, meta);
        return meta;
      }
    }
  } catch {}
  return { nameSimple: `Surah ${surahNum}`, nameAr: `سورة ${surahNum}` };
}

/**
 * Fetches 6 truly random mid-page questions (lines 4–13, NEVER first 2 lines)
 * from 6 distinct Juz within the assigned Nizam + Darajah syllabus.
 */
export async function fetchDynamicRandomizedExamPaper(
  nizam: NizamType,
  darajah: number
): Promise<QuestionItem[] | null> {
  const syl = getDarajahSyllabus(nizam, darajah);
  if (!syl || syl.allowedJuz.length === 0) return null;

  const shuffledJuz = [...syl.allowedJuz].sort(() => Math.random() - 0.5).slice(0, 6);

  try {
    const results = await Promise.all(
      shuffledJuz.map(async (juzNum, idx) => {
        const [minPage, maxPage] = JUZ_PAGE_RANGES[juzNum] || [2, 603];
        const randomPage = minPage + Math.floor(Math.random() * (maxPage - minPage + 1));
        const res = await fetch(
          `https://api.quran.com/api/v4/verses/by_page/${randomPage}?words=true&word_fields=text_uthmani,line_number&per_page=50`
        );
        if (!res.ok) return null;
        const json = await res.json();
        const verses: any[] = Array.isArray(json?.verses) ? json.verses : [];
        if (verses.length === 0) return null;

        // Strictly avoid the first 2 lines of the page (and Surah opening ayah 1-2 when possible)
        let candidates = verses.filter((v) => {
          const firstLine = Number(v?.words?.[0]?.line_number) || 1;
          const vNum = Number(v?.verse_number) || 1;
          return firstLine >= 4 && firstLine <= 13 && vNum > 2;
        });
        if (candidates.length === 0) {
          candidates = verses.filter((v) => {
            const firstLine = Number(v?.words?.[0]?.line_number) || 1;
            return firstLine >= 3 && firstLine <= 14;
          });
        }
        if (candidates.length === 0) candidates = verses;

        const chosenIdx = Math.floor(Math.random() * candidates.length);
        const chosen = candidates[chosenIdx];
        const globalIdx = verses.findIndex((v) => v.verse_key === chosen.verse_key);
        const sliceVerses = verses.slice(globalIdx, globalIdx + 2);

        const [surahStr, ayahStartStr] = String(chosen.verse_key || "1:1").split(":");
        const surahNumber = Number(surahStr) || 1;
        const ayahStart = Number(ayahStartStr) || 1;
        const lastVerse = sliceVerses[sliceVerses.length - 1] || chosen;
        const ayahEnd = Number(String(lastVerse.verse_key || "").split(":")[1]) || ayahStart;

        const ayahTextAr = sliceVerses
          .map((v) => {
            const words: any[] = Array.isArray(v.words) ? v.words : [];
            return words
              .map((w) => (w.char_type_name === "end" ? `﴿${w.text_uthmani || w.text || ""}﴾` : (w.text_uthmani || w.text || "")))
              .join(" ");
          })
          .join(" ");

        const meta = await getSurahMeta(surahNumber);
        return {
          id: `dyn-j${juzNum}-p${randomPage}-${surahNumber}-${ayahStart}-${Date.now()}`,
          qNumber: idx + 1,
          marks: 10,
          promptEn: `Recite from ${meta.nameSimple} (Juz ${juzNum}):`,
          ayahTextAr,
          surahNameAr: meta.nameAr,
          surahNameEn: meta.nameSimple,
          surahNumber,
          ayahStart,
          ayahEnd: ayahEnd > ayahStart ? ayahEnd : undefined,
          juzNumber: juzNum,
        } as QuestionItem;
      })
    );

    const valid = results.filter((r): r is QuestionItem => Boolean(r && r.ayahTextAr));
    if (valid.length === 6) return valid;
    return null;
  } catch {
    return null;
  }
}
