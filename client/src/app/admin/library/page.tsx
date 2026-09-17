"use client";

// The SPA version of the library page: LibraryClient fetches its own data
// from the Express API when no `initialData` is supplied.
import LibraryClient from "./LibraryClient";

export default function LibraryPage() {
  return <LibraryClient />;
}
