import prisma from "./prisma";

export interface PortalModulesState {
  talabat: {
    dashboard: boolean;
    attendance: boolean;
    scans: boolean;
    calendar: boolean;
    hifz: boolean;
    library: boolean;
    skillTree: boolean;
    badges: boolean;
    profile: boolean;
    [key: string]: boolean;
  };
  teacher: {
    dashboard: boolean;
    classes: boolean;
    takhteet: boolean;
    attendance: boolean;
    faculty: boolean;
    calendar: boolean;
    hifz: boolean;
    profile: boolean;
    [key: string]: boolean;
  };
}

export interface RegionPermission {
  id: string;
  label: string;
  description: string;
  isOpen: boolean; // whether user can edit
  isVisibleToStudent?: boolean; // whether student can view (backwards compatibility)
  isVisible?: boolean; // whether student can view
}

export interface TeacherItemPermission {
  id: string;
  label: string;
  description: string;
  isOpen: boolean; // whether teacher can edit
  isVisible?: boolean; // whether teacher can view
}

export interface ProfilePermissionsState {
  modules: PortalModulesState;
  talabat: {
    masterEnabled: boolean;
    masterVisible?: boolean;
    photo: RegionPermission;
    personal: RegionPermission;
    academic: RegionPermission;
    contact: RegionPermission;
    identifiers: RegionPermission;
    parents: RegionPermission;
    [key: string]: any;
  };
  teacher: {
    masterEnabled: boolean;
    masterVisible?: boolean;
    items: Record<string, TeacherItemPermission>;
  };
  // Backwards compatibility top-level regions for older talabat calls
  personal: RegionPermission;
  academic: RegionPermission;
  contact: RegionPermission;
  identifiers: RegionPermission;
  parents: RegionPermission;
  photo?: RegionPermission;
}

const defaultModules: PortalModulesState = {
  talabat: {
    dashboard: true,
    attendance: true,
    scans: true,
    calendar: true,
    hifz: true,
    library: true,
    skillTree: true,
    badges: true,
    profile: true,
  },
  teacher: {
    dashboard: true,
    classes: true,
    takhteet: true,
    attendance: true,
    faculty: true,
    calendar: true,
    hifz: true,
    profile: true,
  },
};

const defaultPermissions: ProfilePermissionsState = {
  modules: defaultModules,
  talabat: {
    masterEnabled: true,
    masterVisible: true,
    photo: {
      id: "photo",
      label: "Photo Upload",
      description: "Allow talabat to upload and update their profile photo",
      isOpen: true,
      isVisible: true,
      isVisibleToStudent: true,
    },
    personal: {
      id: "personal",
      label: "Personal Information",
      description: "Age, Blood Group, Dates of Birth, Hafiz status & year",
      isOpen: true,
      isVisible: true,
      isVisibleToStudent: true,
    },
    academic: {
      id: "academic",
      label: "Academic Information",
      description: "Grade, Section, Admission Year, Current Year & Schooling",
      isOpen: true,
      isVisible: true,
      isVisibleToStudent: true,
    },
    contact: {
      id: "contact",
      label: "Contact & Location",
      description: "Watan, Resident City, Full Address & Student Mobile",
      isOpen: true,
      isVisible: true,
      isVisibleToStudent: true,
    },
    identifiers: {
      id: "identifiers",
      label: "Student IDs & Biometrics",
      description: "ITS Number, TR Number, Student ID & Biometric Hash",
      isOpen: false,
      isVisible: true,
      isVisibleToStudent: true,
    },
    parents: {
      id: "parents",
      label: "Parents Details & Contact",
      description: "Father & Mother names, occupations, emails, and parent phone numbers",
      isOpen: false,
      isVisible: false,
      isVisibleToStudent: false,
    },
  },
  teacher: {
    masterEnabled: true,
    masterVisible: true,
    items: {
      photo: { id: "photo", label: "Photo", description: "Profile photo upload & change", isOpen: true, isVisible: true },
      its: { id: "its", label: "ITS No.", description: "ITS 8-digit unique ID", isOpen: false, isVisible: true },
      name: { id: "name", label: "Name", description: "Full Name (First and Last Name)", isOpen: false, isVisible: true },
      age: { id: "age", label: "Age", description: "Age in years", isOpen: true, isVisible: true },
      khidmatMauze: { id: "khidmatMauze", label: "KhidmatMauze", description: "Mauze / Location of Khidmat", isOpen: true, isVisible: true },
      subCategory: { id: "subCategory", label: "Sub-Category", description: "Khidmat sub-category designation", isOpen: true, isVisible: true },
      role: { id: "role", label: "Role", description: "Teacher role / designation", isOpen: true, isVisible: true },
      farigYear: { id: "farigYear", label: "FarigYear", description: "Year of Farig from Aljamea", isOpen: true, isVisible: true },
      farigDarajah: { id: "farigDarajah", label: "FarigDarajah", description: "Darajah upon graduation", isOpen: true, isVisible: true },
      aljameaDegree: { id: "aljameaDegree", label: "AljameaDegree", description: "Degree / Sanad awarded", isOpen: true, isVisible: true },
      hifzStatus: { id: "hifzStatus", label: "Hifz Status", description: "Hafiz / Non-Hafiz / Mutim", isOpen: true, isVisible: true },
      hifzYear: { id: "hifzYear", label: "Hifz Year", description: "Year of Hifz completion", isOpen: true, isVisible: true },
      batchId: { id: "batchId", label: "BatchID", description: "Sanah / Batch ID", isOpen: true, isVisible: true },
      mobile: { id: "mobile", label: "Mobile", description: "Personal mobile contact number", isOpen: true, isVisible: true },
      tEmail: { id: "tEmail", label: "T_Email", description: "Official teacher email address", isOpen: true, isVisible: true },
      khidmatYear: { id: "khidmatYear", label: "KhidmatYear", description: "Years of khidmat rendered", isOpen: true, isVisible: true },
      birthDateAd: { id: "birthDateAd", label: "BIRTHDT_AD", description: "Gregorian Date of Birth", isOpen: true, isVisible: true },
      birthDateH: { id: "birthDateH", label: "BIRTHDT_H", description: "Hijri Date of Birth", isOpen: true, isVisible: true },
    },
  },
  // Backwards compat aliases
  get personal() { return this.talabat.personal; },
  get academic() { return this.talabat.academic; },
  get contact() { return this.talabat.contact; },
  get identifiers() { return this.talabat.identifiers; },
  get parents() { return this.talabat.parents; },
  get photo() { return this.talabat.photo; },
};

let currentPermissions: ProfilePermissionsState = JSON.parse(JSON.stringify(defaultPermissions));
currentPermissions.personal = currentPermissions.talabat.personal;
currentPermissions.academic = currentPermissions.talabat.academic;
currentPermissions.contact = currentPermissions.talabat.contact;
currentPermissions.identifiers = currentPermissions.talabat.identifiers;
currentPermissions.parents = currentPermissions.talabat.parents;
currentPermissions.photo = currentPermissions.talabat.photo;

// Load persisted settings on startup
(async () => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "profile_permissions" },
    });
    if (setting && setting.value && typeof setting.value === "object") {
      const val = setting.value as any;
      if (val.modules) {
        currentPermissions.modules = {
          talabat: { ...defaultModules.talabat, ...(val.modules.talabat || {}) },
          teacher: { ...defaultModules.teacher, ...(val.modules.teacher || {}) },
        };
      }
      if (val.talabat) {
        currentPermissions.talabat = {
          ...currentPermissions.talabat,
          ...val.talabat,
          masterEnabled: val.talabat.masterEnabled !== undefined ? val.talabat.masterEnabled : currentPermissions.talabat.masterEnabled,
          masterVisible: val.talabat.masterVisible !== undefined ? val.talabat.masterVisible : currentPermissions.talabat.masterVisible,
        };
      }
      if (val.teacher) {
        currentPermissions.teacher = {
          masterEnabled: val.teacher.masterEnabled !== undefined ? val.teacher.masterEnabled : currentPermissions.teacher.masterEnabled,
          masterVisible: val.teacher.masterVisible !== undefined ? val.teacher.masterVisible : currentPermissions.teacher.masterVisible,
          items: { ...currentPermissions.teacher.items, ...(val.teacher.items || {}) },
        };
      }
      currentPermissions.personal = currentPermissions.talabat.personal;
      currentPermissions.academic = currentPermissions.talabat.academic;
      currentPermissions.contact = currentPermissions.talabat.contact;
      currentPermissions.identifiers = currentPermissions.talabat.identifiers;
      currentPermissions.parents = currentPermissions.talabat.parents;
      currentPermissions.photo = currentPermissions.talabat.photo;
    }
  } catch (err) {
    console.warn("Could not load persisted profile permissions:", err);
  }
})();

export function getProfilePermissions(): ProfilePermissionsState {
  return currentPermissions;
}

export async function updateProfilePermissions(
  updates: Partial<ProfilePermissionsState> | any
): Promise<ProfilePermissionsState> {
  if (updates.modules) {
    if (updates.modules.talabat) {
      currentPermissions.modules.talabat = {
        ...currentPermissions.modules.talabat,
        ...updates.modules.talabat,
      };
    }
    if (updates.modules.teacher) {
      currentPermissions.modules.teacher = {
        ...currentPermissions.modules.teacher,
        ...updates.modules.teacher,
      };
    }
  }

  if (updates.talabat) {
    currentPermissions.talabat = {
      ...currentPermissions.talabat,
      ...updates.talabat,
      masterEnabled: updates.talabat.masterEnabled !== undefined ? updates.talabat.masterEnabled : currentPermissions.talabat.masterEnabled,
      masterVisible: updates.talabat.masterVisible !== undefined ? updates.talabat.masterVisible : currentPermissions.talabat.masterVisible,
    };
  }

  if (updates.teacher) {
    currentPermissions.teacher = {
      masterEnabled: updates.teacher.masterEnabled !== undefined ? updates.teacher.masterEnabled : currentPermissions.teacher.masterEnabled,
      masterVisible: updates.teacher.masterVisible !== undefined ? updates.teacher.masterVisible : currentPermissions.teacher.masterVisible,
      items: {
        ...currentPermissions.teacher.items,
        ...(updates.teacher.items || {}),
      },
    };
  }

  const legacyKeys = ["personal", "academic", "contact", "identifiers", "parents", "photo"];
  for (const k of legacyKeys) {
    if (updates[k] && typeof updates[k] === "object") {
      currentPermissions.talabat[k] = {
        ...currentPermissions.talabat[k],
        ...updates[k],
      };
    }
  }

  currentPermissions.personal = currentPermissions.talabat.personal;
  currentPermissions.academic = currentPermissions.talabat.academic;
  currentPermissions.contact = currentPermissions.talabat.contact;
  currentPermissions.identifiers = currentPermissions.talabat.identifiers;
  currentPermissions.parents = currentPermissions.talabat.parents;
  currentPermissions.photo = currentPermissions.talabat.photo;

  try {
    const jsonPayload = JSON.parse(JSON.stringify({
      modules: currentPermissions.modules,
      talabat: currentPermissions.talabat,
      teacher: currentPermissions.teacher,
    }));
    await prisma.systemSetting.upsert({
      where: { key: "profile_permissions" },
      create: {
        key: "profile_permissions",
        value: jsonPayload,
      },
      update: {
        value: jsonPayload,
      },
    });
  } catch (err) {
    console.warn("Failed to persist profile permissions to DB:", err);
  }

  return currentPermissions;
}

