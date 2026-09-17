import prisma from "./prisma";

export interface ShelfDisplayBook {
  title: string;
  author: string | null;
  coverImage: string | null;
  status: string;
  barcode: string | null;
}

export interface ShelfDisplay {
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor: string | null;
  totalBooks: number;
  availableBooks: number;
  borrowedBooks: number;
  label: string;
  categories: { name: string; count: number }[];
  books: ShelfDisplayBook[];
}

export interface ShelvesDisplayData {
  shelves: ShelfDisplay[];
  stats: {
    totalShelves: number;
    totalBooks: number;
    totalAvailable: number;
    unassignedBooks: number;
  };
}

/**
 * Build the full shelf display payload (used by both the admin shelves page and
 * the public TV display). Covers are capped per shelf so the TV page stays light.
 */
export async function getShelvesDisplay(coverCap = 20): Promise<ShelvesDisplayData> {
  const shelves = await prisma.libraryBook.groupBy({
    by: ["rackNumber", "shelfNumber", "locationColor"],
    _count: { id: true },
    _sum: { availableCopies: true },
    where: { rackNumber: { not: null } },
    orderBy: [{ rackNumber: "asc" }, { shelfNumber: "asc" }],
  });

  const categoryData = await prisma.libraryBook.groupBy({
    by: ["rackNumber", "shelfNumber", "category"],
    _count: { id: true },
    where: { rackNumber: { not: null } },
    orderBy: [{ rackNumber: "asc" }, { shelfNumber: "asc" }, { _count: { id: "desc" } }],
  });

  const shelfCategoryMap: Record<string, { name: string; count: number }[]> = {};
  for (const c of categoryData) {
    const key = `${c.rackNumber}-${c.shelfNumber || ""}`;
    if (!shelfCategoryMap[key]) shelfCategoryMap[key] = [];
    shelfCategoryMap[key].push({ name: c.category, count: c._count.id });
  }

  const shelfBooks = await prisma.libraryBook.findMany({
    where: { rackNumber: { not: null } },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    select: {
      rackNumber: true,
      shelfNumber: true,
      title: true,
      author: true,
      coverImage: true,
      status: true,
      barcode: true,
    },
  });

  const shelfBooksMap: Record<string, ShelfDisplayBook[]> = {};
  for (const b of shelfBooks) {
    const key = `${b.rackNumber}-${b.shelfNumber || ""}`;
    if (!shelfBooksMap[key]) shelfBooksMap[key] = [];
    if (shelfBooksMap[key].length >= coverCap) continue;
    shelfBooksMap[key].push({
      title: b.title,
      author: b.author,
      coverImage: b.coverImage,
      status: b.status,
      barcode: b.barcode,
    });
  }

  const totalBooks = shelves.reduce((a, s) => a + s._count.id, 0);
  const totalAvailable = shelves.reduce((a, s) => a + (s._sum.availableCopies || 0), 0);

  return {
    shelves: shelves.map((s) => {
      const key = `${s.rackNumber}-${s.shelfNumber || ""}`;
      const count = s._count.id;
      const available = s._sum.availableCopies || 0;
      return {
        rackNumber: s.rackNumber,
        shelfNumber: s.shelfNumber,
        locationColor: s.locationColor,
        totalBooks: count,
        availableBooks: available,
        borrowedBooks: count - available,
        label: `${s.rackNumber}${s.shelfNumber ? `-${s.shelfNumber}` : ""}`,
        categories: shelfCategoryMap[key] || [],
        books: shelfBooksMap[key] || [],
      };
    }),
    stats: {
      totalShelves: shelves.length,
      totalBooks,
      totalAvailable,
      unassignedBooks: await prisma.libraryBook.count({ where: { rackNumber: null } }),
    },
  };
}
