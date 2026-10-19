import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Teacher mapping helper
const TEACHER_NAME_MAP: Record<string, { its?: string; name: string; email: string }> = {
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
const PERIOD_TIMES: Record<number, { startTime: string; endTime: string }> = {
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

const CLASS_CONFIGS = [
  { grade: "1", section: "A", name: "1 A", classTeacher: "Mulla Husain bhai Mulla Fakhruddin Habib" },
  { grade: "1", section: "B", name: "1 B", classTeacher: "Mulla Husain bhai Shaikh Asgarali bhai Kanchwala" },
  { grade: "2", section: "A", name: "2 A", classTeacher: "Mulla Aliasgar bhai Husainali bhai Khandwala" },
  { grade: "2", section: "B", name: "2 B", classTeacher: "Shaikh Juzer bhai Shaikh Taher bhai Presswala" },
  { grade: "3", section: "A", name: "3 A", classTeacher: "Mulla Taher bhai Shaikh Muslim bhai Shakir" },
  { grade: "3", section: "B", name: "3 B", classTeacher: "Shaikh Murtaza bhai Shaikh Qutbuddin bhai Jamali" },
  { grade: "4", section: "A", name: "4 A", classTeacher: "Shaikh Shabbir bhai Mohsinali bhai Shakir" },
  { grade: "4", section: "B", name: "4 B", classTeacher: "Shaikh Kumail bhai Shaikh Mustafa bhai Raj" },
];

// Raw Timetable Matrix: Array of [className, dayOfWeek, period, subject, teacherKey]
// Day: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const RAW_SLOTS: Array<[string, number, number, string, string]> = [
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

async function main() {
  console.log("=== 1. ENSURING ALL 12 TEACHER PROFILES EXIST ===");
  const teacherIdMap = new Map<string, string>(); // nameKey -> profileId
  const passwordHash = await bcrypt.hash("faculty5253", 10);

  for (const [key, conf] of Object.entries(TEACHER_NAME_MAP)) {
    let profile: any = null;
    if (conf.its) {
      profile = await prisma.teacherProfile.findFirst({
        where: { its: conf.its },
        include: { user: true },
      });
    }
    if (!profile) {
      profile = await prisma.teacherProfile.findFirst({
        where: {
          user: {
            OR: [
              { email: conf.email },
              { firstName: { contains: key.split(" ")[0] } },
            ],
          },
        },
        include: { user: true },
      });
    }

    if (!profile) {
      console.log(`Creating missing teacher profile for: ${key}`);
      const user = await prisma.user.create({
        data: {
          email: conf.email,
          passwordHash,
          plainPassword: "faculty5253",
          firstName: key.split(" ")[0],
          lastName: key.split(" ").slice(1).join(" "),
          role: "TEACHER",
        },
      });
      profile = await prisma.teacherProfile.create({
        data: {
          userId: user.id,
          employeeId: `EMP-${key.replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase()}`,
          department: "Attalimiyah",
          its: conf.its || null,
        },
        include: { user: true },
      });
    }

    teacherIdMap.set(key, profile.id);
    console.log(`✓ Teacher ready: ${key} -> ${profile.id} (${profile.user?.firstName} ${profile.user?.lastName})`);
  }

  console.log("\n=== 2. CREATING / CONFIGURING 8 CLASSES (1A to 4B) ===");
  const classIdMap = new Map<string, string>(); // "1 A" -> classId

  for (const cfg of CLASS_CONFIGS) {
    const classTeacherId = teacherIdMap.get(cfg.classTeacher);
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
          teacherId: classTeacherId || Array.from(teacherIdMap.values())[0],
          masoolId: classTeacherId || null,
        },
      });
      console.log(`Created Class: ${cfg.name} (id: ${cls.id})`);
    } else {
      cls = await prisma.class.update({
        where: { id: cls.id },
        data: {
          name: cfg.name,
          teacherId: classTeacherId || cls.teacherId,
          masoolId: classTeacherId || cls.masoolId,
        },
      });
      console.log(`Updated Class: ${cfg.name} (id: ${cls.id})`);
    }
    classIdMap.set(cfg.name, cls.id);
  }

  console.log("\n=== 3. ENROLLING ALL 148 STUDENTS INTO THEIR RESPECTIVE CLASS ===");
  const allStudents = await prisma.studentProfile.findMany({
    select: { id: true, studentId: true, grade: true, section: true },
  });

  let enrolledCount = 0;
  for (const st of allStudents) {
    // Determine target class
    const gradeNum = st.grade.replace(/[^0-9]/g, "") || "1";
    const secLetter = (st.section || "A").trim().toUpperCase();
    const targetClassName = `${gradeNum} ${secLetter}`;
    const targetClassId = classIdMap.get(targetClassName);

    if (targetClassId) {
      const existing = await prisma.classEnrollment.findFirst({
        where: { studentId: st.id, classId: targetClassId },
      });
      if (!existing) {
        await prisma.classEnrollment.create({
          data: {
            studentId: st.id,
            classId: targetClassId,
            isActive: true,
          },
        });
        enrolledCount++;
      }
    }
  }
  console.log(`✓ Enrolled ${enrolledCount} students into their respective class sections.`);

  console.log("\n=== 4. INGESTING 240 TIMETABLE SLOTS INTO POSTGRESQL ===");
  // Clear any old mock timetable slots
  await prisma.timetableSlot.deleteMany({});

  let insertedSlots = 0;
  for (const [clsName, dayOfWeek, period, subject, teacherKey] of RAW_SLOTS) {
    const classId = classIdMap.get(clsName);
    const teacherId = teacherIdMap.get(teacherKey);
    const times = PERIOD_TIMES[period] || { startTime: "10:30", endTime: "11:00" };

    await prisma.timetableSlot.create({
      data: {
        classId: classId || null,
        className: clsName,
        teacherId: teacherId || null,
        teacherName: teacherKey,
        dayOfWeek,
        period,
        startTime: times.startTime,
        endTime: times.endTime,
        subject,
        roomNumber: `Room ${clsName}`,
      },
    });
    insertedSlots++;
  }
  console.log(`✓ Ingested ${insertedSlots} official timetable slots across 8 classes.`);

  console.log("\n=== 5. INGESTING TAKHTEET LESSONS FROM CSV ===");
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const adminId = adminUser ? adminUser.id : "system-admin";

  const csvPath = path.resolve(process.cwd(), "public/lessons_export_2026-10-19.csv");
  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    console.log(`Found ${lines.length - 1} lesson rows in ${csvPath}`);

    // Delete existing old takhteet plans to replace with official ones
    await prisma.takhteetProgressLog.deleteMany({});
    await prisma.takhteetPlan.deleteMany({});

    let takhteetInserted = 0;
    for (let i = 1; i < lines.length; i++) {
      // Parse CSV line
      const match = lines[i].match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
      if (!match || match.length < 5) continue;
      const clean = match.map((m) => m.replace(/^,?"?|"$/g, "").trim());
      const teacherName = clean[0];
      const className = clean[1];
      const subjectName = clean[2];
      const noOfLessons = parseInt(clean[4], 10) || 1;

      const classId = classIdMap.get(className);
      const teacherId = teacherIdMap.get(teacherName);

      if (classId && teacherId) {
        await prisma.takhteetPlan.create({
          data: {
            title: `${subjectName} (${noOfLessons} lessons/wk)`,
            subject: subjectName,
            classId,
            teacherId,
            academicYear: "1448 H",
            month: 5, // Jumada al-Ula (Month 5)
            progress: 35,
            assignedById: adminId,
            description: `${subjectName} syllabus portion for Class ${className} — ${noOfLessons} weekly teaching periods.`,
          },
        });
        takhteetInserted++;
      }
    }
    console.log(`✓ Ingested ${takhteetInserted} official Takhteet lesson plans.`);
  }

  console.log("\n=== 6. NORMALIZING PARENT PROFILES & LINKS TO TITLE CASE ===");
  const allParentProfiles = await prisma.parentProfile.findMany({});
  for (const p of allParentProfiles) {
    let rel = p.relationType || "Father";
    if (rel.toUpperCase() === "FATHER") rel = "Father";
    else if (rel.toUpperCase() === "MOTHER") rel = "Mother";
    else if (rel.toUpperCase().includes("FATHER") && rel.toUpperCase().includes("MOTHER")) rel = "Father & Mother";

    await prisma.parentProfile.update({
      where: { id: p.id },
      data: { relationType: rel },
    });
  }

  const allLinks = await prisma.parentStudentLink.findMany({});
  for (const l of allLinks) {
    let rel = l.relationship || "Father";
    if (rel.toUpperCase() === "FATHER") rel = "Father";
    else if (rel.toUpperCase() === "MOTHER") rel = "Mother";
    else if (rel.toUpperCase().includes("FATHER") && rel.toUpperCase().includes("MOTHER")) rel = "Father & Mother";

    await prisma.parentStudentLink.update({
      where: { id: l.id },
      data: { relationship: rel },
    });
  }
  console.log(`✓ Normalized ${allParentProfiles.length} parent profiles and ${allLinks.length} links to Title Case.`);

  console.log("\n🎉 ALL TIMETABLE, CLASS, TAKHTEET, AND PARENT DATA INGESTED SUCCESSFULLY!");
}

main().finally(() => prisma.$disconnect());
