"use client";

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article" | "profile";
  noIndex?: boolean;
}

const DEFAULT_TITLE = "Darse Burhani — Aljamea-tus-Saifiyah Academic & Attendance Platform";
const TITLE_TEMPLATE = "%s | Darse Burhani";
const DEFAULT_DESCRIPTION =
  "Unified academic portal, biometric attendance telemetry, Quran Hifz milestones, and student engagement platform for Aljamea-tus-Saifiyah.";
const DEFAULT_OG_IMAGE = "https://darseburhani.edu/og-image.svg";
const BASE_URL = "https://darseburhani.edu";

/**
 * Route-to-metadata dictionary for standard routes.
 */
export const ROUTE_METADATA: Record<string, { title: string; description: string; noIndex?: boolean }> = {
  "/": {
    title: "Sign In — Darse Burhani",
    description: "Secure gateway for Aljamea-tus-Saifiyah administrators, faculty, talabat, and parents.",
  },
  "/login": {
    title: "Sign In — Darse Burhani",
    description: "Sign in with your ITS credentials or institutional email to access Darse Burhani modules.",
  },
  "/thank-you": {
    title: "Submission Received — Thank You",
    description: "Your request or academic form submission has been securely recorded in the institutional database.",
  },
  "/privacy": {
    title: "Privacy & Data Protection Policy",
    description: "Institutional privacy guidelines, biometric template safeguards, and data governance standards.",
  },
  "/terms": {
    title: "Terms of Portal Service",
    description: "Terms and conditions governing the usage of Aljamea-tus-Saifiyah Darse Burhani academic services.",
  },
  "/fatimi-calendar": {
    title: "Fatimi Hijri Calendar & Academic Schedule",
    description: "Official Aljamea-tus-Saifiyah Fatimi calendar, miqaats, examination cycles, and academic milestones.",
  },
  "/library/tv": {
    title: "Library Circulation TV Billboard",
    description: "Live interactive display of library book checkouts, new arrivals, and top talabat readers.",
    noIndex: true,
  },
  "/404": {
    title: "404 — Page Not Found",
    description: "The requested academic resource or portal route could not be found.",
    noIndex: true,
  },
  "/admin": {
    title: "Administrative Control Center",
    description: "Comprehensive administration dashboard for student rosters, biometric terminals, and attendance telemetry.",
    noIndex: true,
  },
  "/teacher": {
    title: "Teacher & Faculty Portal",
    description: "Classroom management, daily attendance rosters, Hifz assessment slips, and takhteet lesson planning.",
    noIndex: true,
  },
  "/talabat": {
    title: "Talabat Student Portal",
    description: "Personal attendance ledger, Quran Hifz progress, library loans, badges, and skill achievements.",
    noIndex: true,
  },
  "/parent": {
    title: "Parent Portal Console",
    description: "Real-time updates on your child's attendance records, Hifz milestones, and institutional notices.",
    noIndex: true,
  },
};

/**
 * Utility to dynamically update document head metadata.
 */
export function updateMetaTags({
  title,
  description,
  image = DEFAULT_OG_IMAGE,
  url,
  type = "website",
  noIndex = false,
}: SEOProps) {
  // 1. Update Title
  const formattedTitle = title
    ? title.includes("Darse Burhani")
      ? title
      : TITLE_TEMPLATE.replace("%s", title)
    : DEFAULT_TITLE;

  document.title = formattedTitle;

  // 2. Helper to set or create meta tag
  const setMeta = (nameOrProperty: string, content: string, isProperty = false) => {
    const attribute = isProperty ? "property" : "name";
    let element = document.querySelector(`meta[${attribute}="${nameOrProperty}"]`) as HTMLMetaElement | null;
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, nameOrProperty);
      document.head.appendChild(element);
    }
    element.setAttribute("content", content);
  };

  // Helper for link tags
  const setLink = (rel: string, href: string) => {
    let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!element) {
      element = document.createElement("link");
      element.setAttribute("rel", rel);
      document.head.appendChild(element);
    }
    element.setAttribute("href", href);
  };

  const finalDescription = description || DEFAULT_DESCRIPTION;
  const finalUrl = url || (typeof window !== "undefined" ? window.location.href : BASE_URL);

  // Standard Meta
  setMeta("description", finalDescription);
  setMeta("robots", noIndex ? "noindex, nofollow" : "index, follow");

  // Open Graph
  setMeta("og:title", formattedTitle, true);
  setMeta("og:description", finalDescription, true);
  setMeta("og:image", image, true);
  setMeta("og:url", finalUrl, true);
  setMeta("og:type", type, true);
  setMeta("og:site_name", "Darse Burhani", true);

  // Twitter Card
  setMeta("twitter:card", "summary_large_image");
  setMeta("twitter:title", formattedTitle);
  setMeta("twitter:description", finalDescription);
  setMeta("twitter:image", image);
  setMeta("twitter:url", finalUrl);

  // Canonical Link
  setLink("canonical", finalUrl);
}

/**
 * Component to declare SEO metadata declaratively on individual pages.
 */
export function SEO(props: SEOProps) {
  useEffect(() => {
    updateMetaTags(props);
  }, [props.title, props.description, props.image, props.url, props.noIndex]);

  return null;
}

/**
 * Global Route Listener hook to set appropriate default SEO tags based on current pathname.
 */
export function useAutoRouteSEO() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    let matchedMeta = ROUTE_METADATA[pathname];

    if (!matchedMeta) {
      if (pathname.startsWith("/admin")) {
        const sub = pathname.replace("/admin/", "").replace(/-/g, " ");
        matchedMeta = {
          title: `Admin · ${sub.charAt(0).toUpperCase() + sub.slice(1)}`,
          description: "Administrative console operations for Aljamea-tus-Saifiyah.",
          noIndex: true,
        };
      } else if (pathname.startsWith("/teacher")) {
        const sub = pathname.replace("/teacher/", "").replace(/-/g, " ");
        matchedMeta = {
          title: `Teacher · ${sub.charAt(0).toUpperCase() + sub.slice(1)}`,
          description: "Faculty portal management and student assessment tracking.",
          noIndex: true,
        };
      } else if (pathname.startsWith("/talabat")) {
        const sub = pathname.replace("/talabat/", "").replace(/-/g, " ");
        matchedMeta = {
          title: `Talabat · ${sub.charAt(0).toUpperCase() + sub.slice(1)}`,
          description: "Student portal academic records and attendance journal.",
          noIndex: true,
        };
      } else if (pathname.startsWith("/parent")) {
        const sub = pathname.replace("/parent/", "").replace(/-/g, " ");
        matchedMeta = {
          title: `Parent · ${sub.charAt(0).toUpperCase() + sub.slice(1)}`,
          description: "Parent portal records and academic progress updates.",
          noIndex: true,
        };
      } else {
        matchedMeta = {
          title: DEFAULT_TITLE,
          description: DEFAULT_DESCRIPTION,
        };
      }
    }

    updateMetaTags({
      title: matchedMeta.title,
      description: matchedMeta.description,
      noIndex: matchedMeta.noIndex,
      url: `${BASE_URL}${pathname}`,
    });

    trackPageView(pathname, matchedMeta.title);
  }, [location.pathname]);
}
