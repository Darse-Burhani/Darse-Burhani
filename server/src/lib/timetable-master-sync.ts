import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { cache } from "./cache";

// Official Teacher ITS & Email Mapping
export const TEACHER_NAME_MAP: Record<string, { its?: string; name: string; email: string }> = {
  "Burhanddin Sir Kundli": { name: "Burhanddin Sir Kundli", email: "burhanuddin.kundli@darseburhani.com" },
  "Mustafa Sir Tailor": { name: "Mustafa Sir Tailor", email: "mustafa.tailor@darseburhani.com" },
  "Mulla Aliasgar bhai Husainali bhai Khandwala": { its: "60406964", name: "Mulla Aliasgar bhai Husainali bhai Khandwala", email: "aliasgar.khandwala@darseburhani.com" },
  "Mulla Husain bhai Mulla Fakhruddin Habib": { its: "30384792", name: "Mulla Husain bhai Mulla Fakhruddin bhai Habib", email: "husain.habib@darseburhani.com" },
  "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala": { its: "60472254", name: "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala", email: "husain.kanchwala@darseburhani.com" },
  "Mulla Juzer bhai Abbas bhai Bundiwala": { its: "30434547", name: "Mulla Juzer bhai Abbas bhai Bundiwala", email: "juzer.bundiwala@darseburhani.com" },
  "Mulla Taher bhai Shaikh Muslim bhai Shakir": { its: "30394078", name: "Mulla Taher bhai Shaikh Muslim bhai Shakir", email: "taher.shakir@darseburhani.com" },
  "Shaikh Juzer bhai Shaikh Taher bhai Presswala": { its: "20359148", name: "Shaikh Juzer bhai Shaikh Taher bhai Presswala", email: "juzer.presswala@darseburhani.com" },
  "Shaikh Kumail bhai Shaikh Mustafa bhai Raj": { its: "20433286", name: "Shaikh Kumail bhai Shaikh Mustafa bhai Raj", email: "kumail.raj@darseburhani.com" },
  "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali": { its: "30387984", name: "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali", email: "murtaza.jamali@darseburhani.com" },
  "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy": { its: "20359538", name: "Shaikh Qutbuddin bhai Mulla Zainuddin bhai Ezzy", email: "qutbuddin.ezzy@darseburhani.com" },
  "Shaikh Shabbir bhai Mohsinali bhai Shakir": { its: "20378107", name: "Shaikh Shabbir bhai Mohsinali bhai Shakir", email: "shabbir.shakir@darseburhani.com" },
};

// Period Timings
export const PERIOD_TIMES: Record<number, { startTime: string; endTime: string }> = {
  1: { startTime: "10:30", endTime: "11:00" },
  2: { startTime: "11:00", endTime: "11:30" },
  3: { startTime: "11:30", endTime: "12:00" },
  4: { startTime: "12:00", endTime: "12:30" },
  5: { startTime: "12:30", endTime: "13:00" },
  6: { startTime: "14:15", endTime: "14:45" },
  7: { startTime: "14:45", endTime: "15:15" },
  8: { startTime: "15:15", endTime: "15:45" },
  9: { startTime: "15:45", endTime: "16:15" },
};

export const CLASS_CONFIGS = [
  { grade: "1", section: "A", name: "1 A", classTeacher: "Mulla Husain bhai Mulla Fakhruddin Habib" },
  { grade: "1", section: "B", name: "1 B", classTeacher: "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala" },
  { grade: "2", section: "A", name: "2 A", classTeacher: "Mulla Aliasgar bhai Husainali bhai Khandwala" },
  { grade: "2", section: "B", name: "2 B", classTeacher: "Shaikh Juzer bhai Shaikh Taher bhai Presswala" },
  { grade: "3", section: "A", name: "3 A", classTeacher: "Mulla Taher bhai Shaikh Muslim bhai Shakir" },
  { grade: "3", section: "B", name: "3 B", classTeacher: "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali" },
  { grade: "4", section: "A", name: "4 A", classTeacher: "Shaikh Shabbir bhai Mohsinali bhai Shakir" },
  { grade: "4", section: "B", name: "4 B", classTeacher: "Shaikh Kumail bhai Shaikh Mustafa bhai Raj" },
];

// All 240 official timetable slots: [className, dayOfWeek, period, subject, teacherKey]
// Day: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
export const RAW_SLOTS: Array<[string, number, number, string, string]> = [
  // ── 1 A ──
  ["1 A", 1, 1, "Qasaid", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["1 A", 1, 2, "Science", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["1 A", 1, 3, "Kitab al-Taharat", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["1 A", 1, 6, "Geography", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["1 A", 1, 7, "Tamreen", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],

  ["1 A", 2, 1, "Qasaid", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["1 A", 2, 2, "Maths", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["1 A", 2, 3, "Science", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["1 A", 2, 6, "Tamreen", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["1 A", 2, 7, "Sharhal akhbar", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],

  ["1 A", 3, 1, "Qasaid", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["1 A", 3, 2, "Maths", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["1 A", 3, 3, "Kitab al-Taharat", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["1 A", 3, 6, "Dirasat Uloom il-Quran", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["1 A", 3, 7, "Raudat Hidayat", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],

  ["1 A", 4, 1, "Insha", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["1 A", 4, 2, "Tadreeb", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["1 A", 4, 3, "Sharhal akhbar", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["1 A", 4, 6, "English", "Burhanddin Sir Kundli"],
  ["1 A", 4, 7, "Raudat Hidayat", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],

  ["1 A", 5, 1, "Science", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["1 A", 5, 2, "Kitab al-Taharat", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["1 A", 5, 3, "English", "Burhanddin Sir Kundli"],
  ["1 A", 5, 6, "Tamreen", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["1 A", 5, 7, "Sharhal akhbar", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],

  ["1 A", 6, 1, "Dirasat Uloom il-Quran", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["1 A", 6, 2, "English", "Burhanddin Sir Kundli"],
  ["1 A", 6, 3, "Hist/Civ", "Burhanddin Sir Kundli"],
  ["1 A", 6, 4, "Kitab al-Taharat", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["1 A", 6, 5, "Tadreeb", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],

  // ── 1 B ──
  ["1 B", 1, 1, "Qasaid", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["1 B", 1, 2, "Dirasat Uloom il-Quran", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["1 B", 1, 3, "Science", "Mustafa Sir Tailor"],
  ["1 B", 1, 6, "Hist/Civ", "Burhanddin Sir Kundli"],
  ["1 B", 1, 7, "Maths", "Mustafa Sir Tailor"],

  ["1 B", 2, 1, "Qasaid", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["1 B", 2, 2, "Tamreen", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["1 B", 2, 3, "Kitab al-Taharat", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["1 B", 2, 6, "Tadreeb", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["1 B", 2, 7, "Geography", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],

  ["1 B", 3, 1, "Qasaid", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["1 B", 3, 2, "English", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["1 B", 3, 3, "Science", "Mustafa Sir Tailor"],
  ["1 B", 3, 6, "Tadreeb", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["1 B", 3, 7, "Maths", "Mustafa Sir Tailor"],

  ["1 B", 4, 1, "Insha", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["1 B", 4, 2, "Kitab al-Taharat", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["1 B", 4, 3, "Tamreen", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["1 B", 4, 6, "Raudat Hidayat", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["1 B", 4, 7, "Sharhal akhbar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],

  ["1 B", 5, 1, "Raudat Hidayat", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["1 B", 5, 2, "Kitab al-Taharat", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["1 B", 5, 3, "Science", "Mustafa Sir Tailor"],
  ["1 B", 5, 6, "Sharhal akhbar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["1 B", 5, 7, "English", "Mulla Husain bhai Mulla Fakhruddin Habib"],

  ["1 B", 6, 1, "English", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["1 B", 6, 2, "Kitab al-Taharat", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["1 B", 6, 3, "Tamreen", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["1 B", 6, 4, "Dirasat Uloom il-Quran", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["1 B", 6, 5, "Sharhal akhbar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],

  // ── 2 A ──
  ["2 A", 1, 3, "Mukhtasar al-Asar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["2 A", 1, 4, "Tamreen", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["2 A", 1, 5, "Geography", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["2 A", 1, 8, "Dirasat Uloom il-Quran", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["2 A", 1, 9, "Raudat Hidayat", "Mulla Husain bhai Mulla Fakhruddin Habib"],

  ["2 A", 2, 3, "Qasaid", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["2 A", 2, 4, "English", "Burhanddin Sir Kundli"],
  ["2 A", 2, 5, "Mukhtasar al-Asar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["2 A", 2, 8, "Maths", "Mustafa Sir Tailor"],
  ["2 A", 2, 9, "Tamreen", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],

  ["2 A", 3, 3, "Dirasat Uloom il-Quran", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["2 A", 3, 4, "Mukhtasar al-Asar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["2 A", 3, 5, "Hist/Civ", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["2 A", 3, 8, "Sharhal akhbar", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["2 A", 3, 9, "Qasaid", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],

  ["2 A", 4, 3, "Insha", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["2 A", 4, 4, "Mukhtasar al-Asar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["2 A", 4, 5, "English", "Burhanddin Sir Kundli"],
  ["2 A", 4, 8, "Sharhal akhbar", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["2 A", 4, 9, "Raudat Hidayat", "Mulla Husain bhai Mulla Fakhruddin Habib"],

  ["2 A", 5, 3, "Sharhal akhbar", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["2 A", 5, 4, "Science", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["2 A", 5, 5, "English", "Burhanddin Sir Kundli"],
  ["2 A", 5, 8, "Tamreen", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["2 A", 5, 9, "Qasaid", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],

  ["2 A", 6, 1, "Maths", "Mustafa Sir Tailor"],
  ["2 A", 6, 2, "Sharhal akhbar", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["2 A", 6, 3, "Qasaid", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["2 A", 6, 4, "Dirasat Uloom il-Quran", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["2 A", 6, 5, "Tadreeb", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],

  // ── 2 B ──
  ["2 B", 1, 3, "Qasaid", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["2 B", 1, 4, "English", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["2 B", 1, 5, "Mukhtasar al-Asar", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["2 B", 1, 8, "Raudat Hidayat", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["2 B", 1, 9, "Insha", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],

  ["2 B", 2, 3, "Science", "Burhanddin Sir Kundli"],
  ["2 B", 2, 4, "Dirasat Uloom il-Quran", "Mulla Juzer bhai Abbas bhai Bundiwala"],
  ["2 B", 2, 5, "Sharhal akhbar", "Mulla Juzer bhai Abbas bhai Bundiwala"],
  ["2 B", 2, 8, "Hist/Civ", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["2 B", 2, 9, "Tamreen", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],

  ["2 B", 3, 3, "Mukhtasar al-Asar", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["2 B", 3, 4, "Science", "Burhanddin Sir Kundli"],
  ["2 B", 3, 5, "English", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["2 B", 3, 8, "Tamreen", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["2 B", 3, 9, "Maths", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],

  ["2 B", 4, 3, "Sharhal akhbar", "Mulla Juzer bhai Abbas bhai Bundiwala"],
  ["2 B", 4, 4, "Geography", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["2 B", 4, 5, "Raudat Hidayat", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["2 B", 4, 8, "Tadreeb", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["2 B", 4, 9, "Qasaid", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],

  ["2 B", 5, 3, "English", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["2 B", 5, 4, "Science", "Burhanddin Sir Kundli"],
  ["2 B", 5, 5, "Mukhtasar al-Asar", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["2 B", 5, 8, "Tadreeb", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["2 B", 5, 9, "Maths", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],

  ["2 B", 6, 1, "Qasaid", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["2 B", 6, 2, "Tamreen", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["2 B", 6, 3, "Sharhal akhbar", "Mulla Juzer bhai Abbas bhai Bundiwala"],
  ["2 B", 6, 4, "Dirasat Uloom il-Quran", "Mulla Juzer bhai Abbas bhai Bundiwala"],
  ["2 B", 6, 5, "Mukhtasar al-Asar", "Mulla Husain bhai Mulla Fakhruddin Habib"],

  // ── 3 A ──
  ["3 A", 1, 3, "Biology", "Burhanddin Sir Kundli"],
  ["3 A", 1, 4, "English", "Burhanddin Sir Kundli"],
  ["3 A", 1, 5, "Mukhtasar al-Asar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 A", 1, 8, "Physics", "Mustafa Sir Tailor"],
  ["3 A", 1, 9, "Qasaid", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],

  ["3 A", 2, 3, "Raudat Hidayat", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["3 A", 2, 4, "Tadreeb", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["3 A", 2, 5, "Tamreen", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["3 A", 2, 8, "Qasaid", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 A", 2, 9, "Sharhal akhbar", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],

  ["3 A", 3, 3, "Hist/Civ", "Burhanddin Sir Kundli"],
  ["3 A", 3, 4, "Dirasat Uloom il-Quran", "Mulla Juzer bhai Abbas bhai Bundiwala"],
  ["3 A", 3, 5, "Mukhtasar al-Asar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 A", 3, 8, "Qasaid", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 A", 3, 9, "Insha", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],

  ["3 A", 4, 3, "English", "Burhanddin Sir Kundli"],
  ["3 A", 4, 4, "Geography", "Burhanddin Sir Kundli"],
  ["3 A", 4, 5, "Mukhtasar al-Asar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 A", 4, 8, "Qasaid", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 A", 4, 9, "Sharhal akhbar", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],

  ["3 A", 5, 3, "Dirasat Uloom il-Quran", "Mulla Juzer bhai Abbas bhai Bundiwala"],
  ["3 A", 5, 4, "Tamreen", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["3 A", 5, 5, "Mukhtasar al-Asar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 A", 5, 8, "Maths", "Mustafa Sir Tailor"],
  ["3 A", 5, 9, "Sharhal akhbar", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],

  ["3 A", 6, 1, "Mukhtasar al-Asar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 A", 6, 2, "Raudat Hidayat", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["3 A", 6, 3, "Maths", "Mustafa Sir Tailor"],
  ["3 A", 6, 4, "Sharhal akhbar", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["3 A", 6, 5, "Chemistry", "Mulla Aliasgar bhai Husainali bhai Khandwala"],

  // ── 3 B ──
  ["3 B", 1, 3, "Sharhal akhbar", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["3 B", 1, 4, "Mukhtasar al-Asar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 B", 1, 5, "Chemistry", "Burhanddin Sir Kundli"],
  ["3 B", 1, 8, "Qasaid", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["3 B", 1, 9, "Raudat Hidayat", "Mulla Aliasgar bhai Husainali bhai Khandwala"],

  ["3 B", 2, 3, "Tamreen", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["3 B", 2, 4, "Geography", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["3 B", 2, 5, "Biology", "Burhanddin Sir Kundli"],
  ["3 B", 2, 8, "Sharhal akhbar", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["3 B", 2, 9, "Qasaid", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],

  ["3 B", 3, 3, "English", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["3 B", 3, 4, "Mukhtasar al-Asar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 B", 3, 5, "Insha", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["3 B", 3, 8, "Maths", "Mustafa Sir Tailor"],
  ["3 B", 3, 9, "Hist/Civ", "Mulla Husain bhai Mulla Fakhruddin Habib"],

  ["3 B", 4, 3, "Sharhal akhbar", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["3 B", 4, 4, "Mukhtasar al-Asar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 B", 4, 5, "Raudat Hidayat", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["3 B", 4, 8, "Tamreen", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],
  ["3 B", 4, 9, "Dirasat Uloom il-Quran", "Mulla Juzer bhai Abbas bhai Bundiwala"],

  ["3 B", 5, 3, "Tadreeb", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["3 B", 5, 4, "Mukhtasar al-Asar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 B", 5, 5, "English", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["3 B", 5, 8, "Sharhal akhbar", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["3 B", 5, 9, "Dirasat Uloom il-Quran", "Mulla Juzer bhai Abbas bhai Bundiwala"],

  ["3 B", 6, 1, "Qasaid", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["3 B", 6, 2, "Maths", "Mustafa Sir Tailor"],
  ["3 B", 6, 3, "Tadreeb", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
  ["3 B", 6, 4, "Mukhtasar al-Asar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["3 B", 6, 5, "Physics", "Mustafa Sir Tailor"],

  // ── 4 A ──
  ["4 A", 1, 1, "Sharhal akhbar", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["4 A", 1, 2, "Kitab al-Iqtisar", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 A", 1, 3, "Daim al-Islam", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 A", 1, 6, "Lisan Arabi", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["4 A", 1, 7, "Risalah B", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],

  ["4 A", 2, 1, "Sharhal akhbar", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["4 A", 2, 2, "Daim al-Islam", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 A", 2, 3, "Muntaza al-Akhbar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["4 A", 2, 6, "Biology", "Burhanddin Sir Kundli"],
  ["4 A", 2, 7, "English", "Burhanddin Sir Kundli"],

  ["4 A", 3, 1, "Sharhal akhbar", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["4 A", 3, 2, "Daim al-Islam", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 A", 3, 3, "Qasaid", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 A", 3, 6, "Chemistry", "Burhanddin Sir Kundli"],
  ["4 A", 3, 7, "Physics", "Burhanddin Sir Kundli"],

  ["4 A", 4, 1, "Insha", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["4 A", 4, 2, "Tadreeb", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["4 A", 4, 3, "Daim al-Islam", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 A", 4, 6, "Muntaza al-Akhbar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["4 A", 4, 7, "English", "Burhanddin Sir Kundli"],

  ["4 A", 5, 1, "Muntaza al-Akhbar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["4 A", 5, 2, "Qasaid", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 A", 5, 3, "Dirasat Uloom il-Quran", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["4 A", 5, 6, "Risalah B", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["4 A", 5, 7, "Maths", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],

  ["4 A", 6, 1, "Qasaid", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 A", 6, 2, "Daim al-Islam", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 A", 6, 3, "Risalah A", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["4 A", 6, 4, "Geography", "Burhanddin Sir Kundli"],
  ["4 A", 6, 5, "Hist/Civ", "Burhanddin Sir Kundli"],

  // ── 4 B ──
  ["4 B", 1, 1, "Qasaid", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 B", 1, 2, "Daim al-Islam", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["4 B", 1, 3, "Hist/Civ", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["4 B", 1, 6, "Risalah A", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["4 B", 1, 7, "Physics", "Burhanddin Sir Kundli"],

  ["4 B", 2, 1, "Qasaid", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 B", 2, 2, "Daim al-Islam", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["4 B", 2, 3, "Maths", "Mustafa Sir Tailor"],
  ["4 B", 2, 6, "Geography", "Mulla Aliasgar bhai Husainali bhai Khandwala"],
  ["4 B", 2, 7, "Risalah B", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],

  ["4 B", 3, 1, "Qasaid", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 B", 3, 2, "Sharhal akhbar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["4 B", 3, 3, "Daim al-Islam", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["4 B", 3, 6, "Muntaza al-Akhbar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["4 B", 3, 7, "Kitab al-Iqtisar", "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala"],

  ["4 B", 4, 1, "Lisan Arabi", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 B", 4, 2, "Sharhal akhbar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["4 B", 4, 3, "English", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["4 B", 4, 6, "Tadreeb", "Shaikh Juzer bhai Shaikh Taher bhai Presswala"],
  ["4 B", 4, 7, "Risalah B", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],

  ["4 B", 5, 1, "Insha", "Shaikh Kumail bhai Shaikh Mustafa bhai Raj"],
  ["4 B", 5, 2, "Muntaza al-Akhbar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["4 B", 5, 3, "Daim al-Islam", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["4 B", 5, 6, "Chemistry", "Burhanddin Sir Kundli"],
  ["4 B", 5, 7, "Biology", "Burhanddin Sir Kundli"],

  ["4 B", 6, 1, "Daim al-Islam", "Shaikh Shabbir bhai Mohsinali bhai Shakir"],
  ["4 B", 6, 2, "Sharhal akhbar", "Mulla Taher bhai Shaikh Muslim bhai Shakir"],
  ["4 B", 6, 3, "English", "Mulla Husain bhai Mulla Fakhruddin Habib"],
  ["4 B", 6, 4, "Muntaza al-Akhbar", "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali"],
  ["4 B", 6, 5, "Dirasat Uloom il-Quran", "Shaikh Qutbuddin bhai Zainuddin bhai Ezzy"],
];

/**
 * Self-healing schema migration: Ensures PostgreSQL has all required columns,
 * tables, indexes, and enums for the Timetable and Badal systems without
 * relying on build-step migrations.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  try {
    console.log("[db:schema] Verifying PostgreSQL timetable columns, tables, and enums...");

    // 1. Ensure BadalStatus enum exists
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BadalStatus') THEN
          CREATE TYPE "BadalStatus" AS ENUM ('PENDING', 'ASSIGNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
        END IF;
      END $$;
    `);

    // 2. Ensure timetable_slots has className, teacherId, teacherName columns
    await prisma.$executeRawUnsafe(`ALTER TABLE "timetable_slots" ADD COLUMN IF NOT EXISTS "className" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "timetable_slots" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "timetable_slots" ADD COLUMN IF NOT EXISTS "teacherName" TEXT;`);

    // 3. Ensure timetable_badals table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "timetable_badals" (
        "id" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "slotId" TEXT,
        "classId" TEXT,
        "className" TEXT NOT NULL,
        "period" INTEGER NOT NULL,
        "startTime" TEXT NOT NULL,
        "endTime" TEXT NOT NULL,
        "subject" TEXT NOT NULL,
        "originalTeacherId" TEXT,
        "originalTeacherName" TEXT,
        "badalTeacherId" TEXT,
        "badalTeacherName" TEXT,
        "reason" TEXT NOT NULL,
        "status" "BadalStatus" NOT NULL DEFAULT 'ASSIGNED',
        "instructions" TEXT,
        "isFulfilled" BOOLEAN NOT NULL DEFAULT false,
        "assignedById" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "timetable_badals_pkey" PRIMARY KEY ("id")
      );
    `);

    // 4. Ensure performance indexes exist
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "timetable_slots_teacherId_idx" ON "timetable_slots"("teacherId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "timetable_slots_dayOfWeek_period_idx" ON "timetable_slots"("dayOfWeek", "period");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "timetable_slots_className_idx" ON "timetable_slots"("className");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "timetable_slots_classId_dow_p_idx" ON "timetable_slots"("classId", "dayOfWeek", "period");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "timetable_badals_date_idx" ON "timetable_badals"("date");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "timetable_badals_status_idx" ON "timetable_badals"("status");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "timetable_badals_badalTeacherId_idx" ON "timetable_badals"("badalTeacherId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "timetable_badals_originalTeacherId_idx" ON "timetable_badals"("originalTeacherId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "timetable_badals_date_period_idx" ON "timetable_badals"("date", "period");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "timetable_badals_className_date_idx" ON "timetable_badals"("className", "date");`);

    // 5. Ensure Foreign Keys exist
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timetable_slots_teacherId_fkey') THEN
          ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    // 6. Record in _prisma_migrations so Prisma CLI tracks it
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) NOT NULL,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
      VALUES ('20261020000000_add_timetable_badal_and_slot_fields', '', NOW(), '20261020000000_add_timetable_badal_and_slot_fields', NULL, NULL, NOW(), 1)
      ON CONFLICT DO NOTHING;
    `);

    console.log("[db:schema] ✓ PostgreSQL timetable schema verified successfully.");
  } catch (err: any) {
    console.warn("[db:schema] Schema verification note:", err?.message || err);
  }
}

/**
 * Ensures all 12 teachers, 8 Darajah classes (1A to 4B), Masool assignments,
 * student enrollments, and 240 timetable slots are synced into the active database.
 */
export async function syncMasterTimetableAndClasses(force = false): Promise<{
  success: boolean;
  classesCount: number;
  slotsCount: number;
  enrolledCount: number;
  message: string;
}> {
  console.log("[timetable:sync] Initiating Master Timetable & Class Synchronization...");

  // Step 0: Ensure all database tables and columns exist in PostgreSQL
  await ensureDatabaseSchema();

  // Step 1: Resolve / Ensure Teacher Profiles safely
  const teacherIdMap = new Map<string, string>(); // nameKey -> teacherProfileId
  const passwordHash = await bcrypt.hash("faculty5253", 10);

  // Pre-fetch all existing teachers
  const allExistingTeachers = await prisma.teacherProfile.findMany({
    include: { user: true },
  });

  const teachersByIts = new Map<string, any>();
  const teachersByEmail = new Map<string, any>();
  const teachersByName = new Map<string, any>();

  for (const t of allExistingTeachers) {
    if (t.its) teachersByIts.set(t.its, t);
    if (t.user?.email) teachersByEmail.set(t.user.email.toLowerCase(), t);
    if (t.user?.firstName) teachersByName.set(t.user.firstName.toLowerCase().trim(), t);
  }

  const fallbackTeacherId = allExistingTeachers.length > 0 ? allExistingTeachers[0].id : null;

  for (const [key, conf] of Object.entries(TEACHER_NAME_MAP)) {
    let profile = (conf.its && teachersByIts.get(conf.its))
      || teachersByEmail.get(conf.email.toLowerCase())
      || teachersByName.get(key.split(" ")[0].toLowerCase());

    if (!profile) {
      try {
        const safeEmail = conf.email.toLowerCase();
        let user = await prisma.user.findUnique({ where: { email: safeEmail } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: safeEmail,
              passwordHash,
              plainPassword: "faculty5253",
              firstName: key.split(" ")[0],
              lastName: key.split(" ").slice(1).join(" ") || "Faculty",
              role: "TEACHER",
            },
          });
        }

        profile = await prisma.teacherProfile.findUnique({ where: { userId: user.id } });
        if (!profile) {
          const safeEmpId = conf.its || `EMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          profile = await prisma.teacherProfile.create({
            data: {
              userId: user.id,
              employeeId: safeEmpId,
              department: "Attalimiyah",
              its: conf.its || null,
            },
            include: { user: true },
          });
        }
      } catch (err: any) {
        console.warn(`[timetable:sync] Teacher profile fallback notice for ${key}:`, err?.message || err);
      }
    }

    if (profile) {
      teacherIdMap.set(key, profile.id);
    } else if (fallbackTeacherId) {
      teacherIdMap.set(key, fallbackTeacherId);
    }
  }

  // Step 2: Ensure all 8 classes (1A to 4B) exist for academic year 1448 H with proper Masool
  const classIdMap = new Map<string, string>(); // "1 A" -> classId

  for (const cfg of CLASS_CONFIGS) {
    const classTeacherId = teacherIdMap.get(cfg.classTeacher)
      || fallbackTeacherId
      || (await prisma.teacherProfile.findFirst())?.id;

    if (!classTeacherId) {
      console.warn(`[timetable:sync] No teacher profile available to assign to Class ${cfg.name}`);
      continue;
    }

    let cls = await prisma.class.findFirst({
      where: {
        grade: cfg.grade,
        section: cfg.section,
        academicYear: "1448 H",
      },
    });

    if (!cls) {
      cls = await prisma.class.create({
        data: {
          name: cfg.name,
          grade: cfg.grade,
          section: cfg.section,
          subject: "Darajah Core Curriculum",
          academicYear: "1448 H",
          teacherId: classTeacherId,
          masoolId: classTeacherId,
          isActive: true,
        },
      });
      console.log(`[timetable:sync] Created Class ${cfg.name} (id: ${cls.id})`);
    } else {
      cls = await prisma.class.update({
        where: { id: cls.id },
        data: {
          name: cfg.name,
          teacherId: classTeacherId,
          masoolId: classTeacherId,
          isActive: true,
        },
      });
      console.log(`[timetable:sync] Verified Class ${cfg.name} (id: ${cls.id})`);
    }
    classIdMap.set(cfg.name, cls.id);
  }

  // Step 3: Enroll Talabat into their matching classes (Grade + Section)
  const allStudents = await prisma.studentProfile.findMany({
    select: { id: true, studentId: true, grade: true, section: true },
  });

  // Step 3: Fast batch enrollment of Talabat into matching classes
  const enrollmentList: Array<{ classId: string; studentId: string; isActive: boolean }> = [];
  for (const st of allStudents) {
    const gradeNum = (st.grade || "").replace(/[^0-9]/g, "") || "1";
    const secLetter = (st.section || "A").trim().toUpperCase();
    const targetClassName = `${gradeNum} ${secLetter}`;
    const targetClassId = classIdMap.get(targetClassName);

    if (targetClassId) {
      enrollmentList.push({
        classId: targetClassId,
        studentId: st.id,
        isActive: true,
      });
    }
  }

  let enrolledCount = 0;
  if (enrollmentList.length > 0) {
    try {
      const res = await prisma.classEnrollment.createMany({
        data: enrollmentList,
        skipDuplicates: true,
      });
      enrolledCount = res.count;
    } catch {
      // Graceful fallback if composite key conflict
      for (const item of enrollmentList) {
        try {
          await prisma.classEnrollment.upsert({
            where: { classId_studentId: { classId: item.classId, studentId: item.studentId } },
            update: { isActive: true },
            create: item,
          });
          enrolledCount++;
        } catch {}
      }
    }
  }

  // Step 4: Fast batch ingest of Timetable Slots (1 single query instead of 240 roundtrips)
  const currentSlotCount = await prisma.timetableSlot.count();
  if (force || currentSlotCount === 0) {
    if (force) {
      console.log("[timetable:sync] Force-syncing: removing existing slots...");
      await prisma.timetableSlot.deleteMany({});
    }

    const slotPayloads = RAW_SLOTS.map(([clsName, dayOfWeek, period, subject, teacherKey]) => {
      const classId = classIdMap.get(clsName) || null;
      const teacherId = teacherIdMap.get(teacherKey) || fallbackTeacherId || null;
      const times = PERIOD_TIMES[period] || { startTime: "10:30", endTime: "11:00" };
      return {
        classId,
        className: clsName,
        teacherId,
        teacherName: teacherKey,
        dayOfWeek,
        period,
        startTime: times.startTime,
        endTime: times.endTime,
        subject,
        roomNumber: `Room ${clsName}`,
      };
    });

    const created = await prisma.timetableSlot.createMany({
      data: slotPayloads,
      skipDuplicates: true,
    });

    const insertedSlots = created.count || slotPayloads.length;
    cache.invalidateTag("timetable");
    cache.invalidateTag("classes");

    console.log(`[timetable:sync] ✓ Successfully batch seeded ${insertedSlots} timetable slots across 8 classes!`);
    return {
      success: true,
      classesCount: CLASS_CONFIGS.length,
      slotsCount: insertedSlots,
      enrolledCount,
      message: `Master timetable synchronized: 8 classes active, ${insertedSlots} timetable slots generated, ${enrolledCount} students enrolled.`,
    };
  }

  cache.invalidateTag("timetable");
  cache.invalidateTag("classes");

  return {
    success: true,
    classesCount: CLASS_CONFIGS.length,
    slotsCount: currentSlotCount,
    enrolledCount,
    message: `Database already has ${currentSlotCount} slots. Classes and Masools verified.`,
  };
}

/**
 * Checks if the production database has any timetable slots.
 * If 0 slots exist, automatically runs master sync on startup.
 */
export async function syncMasterTimetableIfEmpty(): Promise<void> {
  try {
    await ensureDatabaseSchema();
    const slotCount = await prisma.timetableSlot.count();
    if (slotCount === 0) {
      console.log("[timetable:startup] 0 timetable slots found. Automatically seeding master timetable...");
      await syncMasterTimetableAndClasses(false);
    } else {
      console.log(`[timetable:startup] Database healthy: ${slotCount} timetable slots active.`);
    }
  } catch (err: any) {
    console.warn("[timetable:startup] Could not check or seed timetable slots at startup:", err?.message || err);
  }
}
