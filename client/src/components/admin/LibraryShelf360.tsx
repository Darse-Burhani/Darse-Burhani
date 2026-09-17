import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Grid, Html, OrbitControls, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";
import {
  Barcode,
  BookOpen,
  Edit3,
  Info,
  Library,
  Move,
  Orbit,
  Pause,
  Rotate3d,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

// ── Types ──
export interface Shelf360Book {
  title: string;
  author: string | null;
  coverImage: string | null;
  status: string;
  barcode: string | null;
}

export interface Shelf360Data {
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor: string | null;
  totalBooks: number;
  availableBooks: number;
  label: string;
  categories: { name: string; count: number }[];
  borrowedBooks: number;
  books: Shelf360Book[];
}

interface LibraryShelf360Props {
  shelves: Shelf360Data[];
  onEdit: (shelf: Shelf360Data) => void;
  onMove: (shelf: Shelf360Data) => void;
  onClear: (shelf: Shelf360Data) => void;
}

// ── Visual constants ──
const COLOR_HEX: Record<string, string> = {
  Red: "#ef4444",
  Blue: "#3b82f6",
  Green: "#22c55e",
  Yellow: "#eab308",
  Orange: "#f97316",
  Purple: "#a855f7",
  Pink: "#ec4899",
  "Light Blue": "#38bdf8",
  White: "#e2e8f0",
};

const RACK_WIDTH = 3.6;
const RACK_DEPTH = 0.85;
const LEVEL_HEIGHT = 1.35;
const BOOK_W = 0.24;
const BOOK_DEPTH = 0.3;
const BOOK_GAP = 0.045;
const BOOK_H_MIN = 0.52;
const BOOK_H_STEP = 0.13;
const MAX_BOOKS = 10;
const DEFAULT_COLOR = "#10b981";

function shelfHex(shelf: Shelf360Data): string {
  return COLOR_HEX[shelf.locationColor ?? ""] ?? DEFAULT_COLOR;
}

/** How many 3D books are rendered for a shelf (mirrors ShelfLevel's count). */
function getBookCountForShelf(shelf: Shelf360Data, maxTotalBooks: number): number {
  if (shelf.totalBooks <= 0) return 0;
  const raw = Math.round((shelf.totalBooks / Math.max(1, maxTotalBooks)) * MAX_BOOKS);
  return Math.min(MAX_BOOKS, Math.max(1, raw));
}

/** World position of a rack in the circular layout (mirrors Rack's placement). */
function computeRackWorldPos(index: number, rackCount: number) {
  const radius = Math.min(28, Math.max(7.5, rackCount * 2.3));
  const angle = rackCount === 1 ? 0 : (index / rackCount) * Math.PI * 2;
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius, angle };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Per-book heights + starting x for a rendered level (shared by render + fly-to). */
function computeBookLayout(bookCount: number): {
  heights: number[];
  startX: number;
} {
  const heights = Array.from(
    { length: bookCount },
    (_, j) => BOOK_H_MIN + ((j * 37 + 11) % 3) * BOOK_H_STEP
  );
  const totalW = bookCount * BOOK_W + Math.max(0, bookCount - 1) * BOOK_GAP;
  return { heights, startX: -totalW / 2 };
}

const BOOK_STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  BORROWED: "bg-rose-50 text-rose-700 border-rose-200",
  RESTOCK_QUEUE: "bg-amber-50 text-amber-700 border-amber-200",
  DAMAGED: "bg-orange-50 text-orange-700 border-orange-200",
  LOST: "bg-gray-100 text-gray-600 border-gray-200",
};

function BookStatusChip({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        BOOK_STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 border-gray-200"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ── Cover texture loading (module-level caches, no Suspense) ──
// `null` in the cache means the image failed to load — don't retry.
const coverTextureCache = new Map<string, THREE.Texture | null>();
const coverLoads = new Map<string, Promise<THREE.Texture | null>>();
// Cover materials are shared per (image, borrowed) so identical covers reuse one material.
const coverMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const coverLoader = new THREE.TextureLoader();

function loadCoverTexture(url: string): Promise<THREE.Texture | null> {
  if (coverTextureCache.has(url)) {
    return Promise.resolve(coverTextureCache.get(url) ?? null);
  }
  const inFlight = coverLoads.get(url);
  if (inFlight) return inFlight;
  const promise = new Promise<THREE.Texture | null>((resolve) => {
    coverLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        coverTextureCache.set(url, tex);
        resolve(tex);
      },
      undefined,
      () => {
        // Image failed to load (network / CORS) — fall back to a colored spine.
        coverTextureCache.set(url, null);
        resolve(null);
      }
    );
  });
  coverLoads.set(url, promise);
  promise.finally(() => coverLoads.delete(url));
  return promise;
}

function getCoverMaterial(
  url: string,
  borrowed: boolean
): THREE.MeshStandardMaterial | null {
  const tex = coverTextureCache.get(url);
  if (!tex) return null; // still loading or failed
  const key = `${url}|${borrowed ? 1 : 0}`;
  let mat = coverMaterialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.55,
      // Borrowed covers are grayed out so availability stays readable
      color: borrowed ? "#aab2bf" : "#ffffff",
    });
    coverMaterialCache.set(key, mat);
  }
  return mat;
}

/** Resolves textures for a list of cover URLs, re-rendering as they load. */
function useCoverTextures(urls: (string | null | undefined)[]): (THREE.Texture | null)[] {
  const [loaded, setLoaded] = useState(0);

  const results = useMemo(
    () => urls.map((u) => (u ? coverTextureCache.get(u) ?? null : null)),
    [urls, loaded]
  );

  useEffect(() => {
    let alive = true;
    const pending = Array.from(
      new Set(urls.filter((u): u is string => !!u && !coverTextureCache.has(u)))
    );
    if (pending.length === 0) return;
    Promise.all(pending.map(loadCoverTexture)).then(() => {
      if (alive) setLoaded((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [urls]);

  return results;
}

// ── 3D: pulsing halo under the searched book ──
function PulseRing({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 5) * 0.08;
    m.scale.set(s, s, 1);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 5) * 0.3;
  });
  return (
    <mesh ref={ref} raycast={() => null} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.3, 0.36, 40]} />
      <meshBasicMaterial
        color="#f59e0b"
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── 3D: Shelf Level (board + books + label) ──
function ShelfLevel({
  shelf,
  y,
  maxTotalBooks,
  selected,
  highlightKey,
  onSelect,
  onBookClick,
}: {
  shelf: Shelf360Data;
  y: number;
  maxTotalBooks: number;
  selected: boolean;
  highlightKey: string | null;
  onSelect: () => void;
  onBookClick: (book: Shelf360Book) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  useCursor(hovered);

  const booksForLevel = useMemo(() => shelf.books ?? [], [shelf.books]);
  const baseColor = useMemo(
    () => new THREE.Color(shelfHex(shelf)),
    [shelf.locationColor]
  );

  const bookCount = useMemo(
    () => getBookCountForShelf(shelf, maxTotalBooks),
    [shelf.totalBooks, maxTotalBooks]
  );

  const availableN = useMemo(
    () =>
      Math.round(
        (shelf.availableBooks / Math.max(1, shelf.totalBooks)) * bookCount
      ),
    [shelf.availableBooks, shelf.totalBooks, bookCount]
  );

  // Per-book layout: heights + x positions
  const { heights, startX } = useMemo(() => computeBookLayout(bookCount), [bookCount]);

  // Colored fallback materials + shared book geometry (disposed on unmount)
  const { shadeMats, borrowedMat, bookGeometry } = useMemo(() => {
    const shades: THREE.MeshStandardMaterial[] = [];
    for (let k = 0; k < 4; k++) {
      const c = baseColor.clone();
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      c.setHSL(
        hsl.h,
        THREE.MathUtils.clamp(hsl.s * (0.8 + k * 0.08), 0, 1),
        THREE.MathUtils.clamp(hsl.l + k * 0.05 - 0.1, 0.18, 0.85)
      );
      shades.push(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
    }
    const borrowed = new THREE.MeshStandardMaterial({
      color: "#7c8aa0",
      roughness: 0.7,
    });
    const geometry = new THREE.BoxGeometry(BOOK_W, 1, BOOK_DEPTH);
    return { shadeMats: shades, borrowedMat: borrowed, bookGeometry: geometry };
  }, [baseColor]);

  useEffect(
    () => () => {
      shadeMats.forEach((m) => m.dispose());
      borrowedMat.dispose();
      bookGeometry.dispose();
    },
    [shadeMats, borrowedMat, bookGeometry]
  );

  // Cover textures for the books we actually render
  const coverUrls = useMemo(
    () =>
      Array.from(
        { length: bookCount },
        (_, j) => booksForLevel[j]?.coverImage ?? null
      ),
    [bookCount, booksForLevel]
  );
  const coverTextures = useCoverTextures(coverUrls);

  const hex = shelfHex(shelf);

  return (
    <group
      position={[0, y, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
        setHoverIndex(null);
      }}
    >
      {/* Shelf board */}
      <mesh castShadow position={[0, 0.045, 0]} receiveShadow>
        <boxGeometry args={[RACK_WIDTH, 0.09, RACK_DEPTH]} />
        <meshStandardMaterial
          color={selected ? "#c97a3d" : "#a97c52"}
          roughness={0.85}
        />
      </mesh>

      {/* Shelf lip (front edge highlight) */}
      <mesh position={[0, 0.09, RACK_DEPTH / 2 + 0.015]}>
        <boxGeometry args={[RACK_WIDTH, 0.045, 0.05]} />
        <meshStandardMaterial
          color={selected ? hex : "#cbb69a"}
          emissive={selected ? hex : "#000000"}
          emissiveIntensity={selected ? 0.55 : 0}
          roughness={0.6}
        />
      </mesh>

      {/* Books (per-book meshes so real cover images can be applied) */}
      {bookCount > 0 &&
        Array.from({ length: bookCount }).map((_, j) => {
          const borrowed = j >= availableN;
          const book = booksForLevel[j];
          const coverMat = book?.coverImage
            ? getCoverMaterial(book.coverImage, borrowed)
            : null;
          const mat =
            coverMat ??
            (borrowed ? borrowedMat : shadeMats[j % shadeMats.length]);
          const bx = startX + j * (BOOK_W + BOOK_GAP) + BOOK_W / 2;
          const isHit =
            !!book &&
            highlightKey ===
              `${shelf.label}|${book.title}|${book.barcode ?? ""}`;
          return (
            <group key={j}>
              <mesh
                castShadow
                geometry={bookGeometry}
                material={mat}
                position={[bx, heights[j] / 2, 0]}
                scale={[1, heights[j], 1]}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHovered(true);
                  setHoverIndex(j);
                }}
                onPointerOut={() => setHoverIndex(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (book) {
                    onBookClick(book);
                  } else {
                    onSelect();
                  }
                }}
              />
              {isHit && (
                <>
                  <PulseRing position={[bx, 0.07, 0]} />
                  <Html
                    position={[bx, heights[j] + 0.55, 0]}
                    center
                    distanceFactor={9}
                    zIndexRange={[10, 0]}
                    style={{ pointerEvents: "none" }}
                  >
                    <div className="flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 shadow-md">
                      <Search className="h-3 w-3" />
                      Found
                    </div>
                  </Html>
                </>
              )}
            </group>
          );
        })}

      {/* Book title tooltip on hover */}
      {hoverIndex !== null && booksForLevel[hoverIndex] && (
        <Html
          position={[
            startX + hoverIndex * (BOOK_W + BOOK_GAP) + BOOK_W / 2,
            heights[hoverIndex] + 0.42,
            0,
          ]}
          center
          distanceFactor={9}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="max-w-52 whitespace-nowrap rounded-md border border-gray-200 bg-white/95 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-md">
            {booksForLevel[hoverIndex].title}
          </div>
        </Html>
      )}

      {/* Level label */}
      <Html
        position={[0, 0.98, 0]}
        center
        distanceFactor={9}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-white/95 px-2 py-0.5 shadow-sm"
          style={{ borderColor: hex }}
        >
          <span className="h-2 w-2 rounded-sm" style={{ background: hex }} />
          <span className="font-mono text-[11px] font-bold text-gray-700">
            {shelf.label}
          </span>
          <span className="text-[10px] text-gray-500">{shelf.totalBooks}</span>
        </div>
      </Html>
    </group>
  );
}

// ── 3D: Rack (frame + levels) ──
function Rack({
  rackLabel,
  shelves,
  index,
  rackCount,
  selectedLabel,
  highlightKey,
  onSelect,
  onBookClick,
  maxTotalBooks,
}: {
  rackLabel: string;
  shelves: Shelf360Data[];
  index: number;
  rackCount: number;
  selectedLabel: string | null;
  highlightKey: string | null;
  onSelect: (shelf: Shelf360Data) => void;
  onBookClick: (shelf: Shelf360Data, book: Shelf360Book) => void;
  maxTotalBooks: number;
}) {
  const radius = Math.min(28, Math.max(7.5, rackCount * 2.3));
  const angle = rackCount === 1 ? 0 : (index / rackCount) * Math.PI * 2;
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;

  const levels = shelves.length;
  const rackHeight = levels * LEVEL_HEIGHT + 0.4;

  const materials = useMemo(
    () => ({
      frame: new THREE.MeshStandardMaterial({ color: "#5a3a24", roughness: 0.85 }),
      board: new THREE.MeshStandardMaterial({ color: "#a97c52", roughness: 0.9 }),
      back: new THREE.MeshStandardMaterial({ color: "#8a623f", roughness: 1 }),
      base: new THREE.MeshStandardMaterial({ color: "#6e4b2d", roughness: 0.9 }),
    }),
    []
  );

  useEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose());
    },
    [materials]
  );

  return (
    <group position={[x, 0, z]} rotation={[0, angle + Math.PI, 0]}>
      {/* Side posts */}
      <mesh castShadow material={materials.frame} position={[-RACK_WIDTH / 2 - 0.09, rackHeight / 2, 0]}>
        <boxGeometry args={[0.18, rackHeight, RACK_DEPTH]} />
      </mesh>
      <mesh castShadow material={materials.frame} position={[RACK_WIDTH / 2 + 0.09, rackHeight / 2, 0]}>
        <boxGeometry args={[0.18, rackHeight, RACK_DEPTH]} />
      </mesh>
      {/* Top board */}
      <mesh castShadow material={materials.frame} position={[0, rackHeight - 0.09, 0]}>
        <boxGeometry args={[RACK_WIDTH + 0.36, 0.18, RACK_DEPTH]} />
      </mesh>
      {/* Base */}
      <mesh castShadow material={materials.base} position={[0, 0.09, 0]}>
        <boxGeometry args={[RACK_WIDTH + 0.4, 0.18, RACK_DEPTH + 0.12]} />
      </mesh>
      {/* Back panel */}
      <mesh material={materials.back} position={[0, rackHeight / 2, -RACK_DEPTH / 2 + 0.06]}>
        <boxGeometry args={[RACK_WIDTH, rackHeight, 0.08]} />
      </mesh>

      {/* Rack label */}
      <Html
        position={[0, rackHeight + 0.6, 0]}
        center
        distanceFactor={9}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="rounded-lg border border-gray-300 bg-white/95 px-2.5 py-1 shadow-md">
          <span className="font-mono text-xs font-bold text-gray-800">{rackLabel}</span>
        </div>
      </Html>

      {shelves.map((shelf, i) => (
        <ShelfLevel
          key={shelf.label}
          shelf={shelf}
          y={0.27 + i * LEVEL_HEIGHT}
          maxTotalBooks={maxTotalBooks}
          selected={selectedLabel === shelf.label}
          highlightKey={highlightKey}
          onSelect={() => onSelect(shelf)}
          onBookClick={(book) => onBookClick(shelf, book)}
        />
      ))}
    </group>
  );
}

// ── 3D: smooth fly-to camera animation (canceled if the user grabs the scene) ──
function FlyToCamera({
  flyTo,
}: {
  flyTo: { key: number; x: number; y: number; z: number } | null;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  const anim = useRef<{
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTgt: THREE.Vector3;
    toTgt: THREE.Vector3;
    start: number;
    dur: number;
  } | null>(null);

  // User grabbing the scene cancels the flight
  useEffect(() => {
    const el = gl.domElement;
    const cancel = () => {
      anim.current = null;
    };
    el.addEventListener("pointerdown", cancel);
    return () => el.removeEventListener("pointerdown", cancel);
  }, [gl]);

  useEffect(() => {
    if (!flyTo || !controls) return;
    const p = new THREE.Vector3(flyTo.x, flyTo.y, flyTo.z);
    const dir = p.clone().normalize();
    const dist = Math.min(9, Math.max(6, Math.hypot(flyTo.x, flyTo.z) * 0.32));
    const toPos = p.clone().addScaledVector(dir, dist);
    toPos.y = Math.max(flyTo.y + 2.6, toPos.y);
    anim.current = {
      fromPos: camera.position.clone(),
      toPos,
      fromTgt: controls.target.clone(),
      toTgt: p.clone(),
      start: performance.now(),
      dur: 950,
    };
  }, [flyTo?.key]);

  useFrame(() => {
    const a = anim.current;
    if (!a || !controls) return;
    const t = Math.min(1, (performance.now() - a.start) / a.dur);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    controls.target.lerpVectors(a.fromTgt, a.toTgt, e);
    controls.update();
    if (t >= 1) anim.current = null;
  });

  return null;
}

// ── Search overlay (title / author / barcode) ──
function SearchOverlay({
  shelves,
  query,
  onQueryChange,
  onPick,
}: {
  shelves: Shelf360Data[];
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (shelf: Shelf360Data, book: Shelf360Book) => void;
}) {
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: { shelf: Shelf360Data; book: Shelf360Book }[] = [];
    for (const s of shelves) {
      for (const b of s.books ?? []) {
        const hay = `${b.title} ${b.author ?? ""} ${b.barcode ?? ""}`.toLowerCase();
        if (hay.includes(q)) {
          out.push({ shelf: s, book: b });
          if (out.length >= 8) break;
        }
      }
      if (out.length >= 8) break;
    }
    return out;
  }, [shelves, query]);

  return (
    <div className="absolute left-1/2 top-3 z-30 w-[min(460px,max(260px,calc(100%-200px)))] -translate-x-1/2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          aria-label="Search books by title, author or barcode"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length > 0) {
              onPick(results[0].shelf, results[0].book);
            } else if (e.key === "Escape") {
              onQueryChange("");
            }
          }}
          placeholder="Search books — title, author or barcode"
          className="w-full rounded-xl border border-gray-200 bg-white/95 py-2 pl-9 pr-9 text-sm text-gray-700 shadow-lg backdrop-blur transition-colors placeholder:text-gray-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            title="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {query.trim() && results.length > 0 && (
        <div className="mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur">
          {results.map(({ shelf, book }) => (
            <button
              key={`${shelf.label}|${book.title}|${book.barcode ?? ""}`}
              onClick={() => onPick(shelf, book)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-emerald-50"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: shelfHex(shelf) }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-800">
                  {book.title}
                </span>
                <span className="block truncate text-[11px] text-gray-500">
                  {book.author ?? "Unknown author"}
                  {book.barcode ? ` · ${book.barcode}` : ""}
                </span>
              </span>
              <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gray-600">
                {shelf.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <div className="mt-1.5 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-500 shadow-xl backdrop-blur">
          No books match “{query.trim()}”
        </div>
      )}
    </div>
  );
}

// ── Info panel (selected shelf) ──
function InfoPanel({
  shelf,
  book,
  onEdit,
  onMove,
  onClear,
  onClose,
}: {
  shelf: Shelf360Data;
  book: Shelf360Book | null;
  onEdit: (s: Shelf360Data) => void;
  onMove: (s: Shelf360Data) => void;
  onClear: (s: Shelf360Data) => void;
  onClose: () => void;
}) {
  const hex = shelfHex(shelf);
  const borrowed = shelf.borrowedBooks ?? shelf.totalBooks - shelf.availableBooks;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-3 left-3 z-20 w-72 max-w-[calc(100%-24px)] rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur"
    >
      <button
        onClick={onClose}
        className="absolute right-2.5 top-2.5 rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        title="Close"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3 flex items-center gap-2 pr-6">
        <span className="h-3 w-3 rounded-sm" style={{ background: hex }} />
        <h3 className="font-mono text-base font-bold text-gray-900">{shelf.label}</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
          {shelf.rackNumber}
        </span>
      </div>

      {book && (
        <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Selected book
            </span>
            {book.status?.trim() ? <BookStatusChip status={book.status} /> : null}
          </div>
          <p className="text-sm font-semibold leading-snug text-gray-900">{book.title}</p>
          {book.author && <p className="mt-0.5 text-xs text-gray-500">{book.author}</p>}
          {book.barcode && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-0.5 font-mono text-[11px] text-gray-600">
              <Barcode className="h-3.5 w-3.5 text-gray-500" />
              {book.barcode}
            </p>
          )}
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-emerald-50 p-2 text-center">
          <p className="text-base font-bold text-emerald-700">{shelf.totalBooks}</p>
          <p className="text-[10px] text-emerald-700">Total</p>
        </div>
        <div className="rounded-lg bg-green-50 p-2 text-center">
          <p className="text-base font-bold text-green-700">{shelf.availableBooks}</p>
          <p className="text-[10px] text-green-700">Available</p>
        </div>
        <div className="rounded-lg bg-rose-50 p-2 text-center">
          <p className="text-base font-bold text-rose-700">{borrowed}</p>
          <p className="text-[10px] text-rose-600">Borrowed</p>
        </div>
      </div>

      {shelf.categories.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {shelf.categories.slice(0, 4).map((cat) => (
            <span
              key={cat.name}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
            >
              {cat.name} ({cat.count})
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 border-t border-gray-100 pt-2.5">
        <button
          onClick={() => onEdit(shelf)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Edit3 className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          onClick={() => onMove(shelf)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
        >
          <Move className="h-3.5 w-3.5" /> Move
        </button>
        <button
          onClick={() => onClear(shelf)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
    </motion.div>
  );
}

// ── Main 360° component ──
export default function LibraryShelf360({
  shelves,
  onEdit,
  onMove,
  onClear,
}: LibraryShelf360Props) {
  const [selected, setSelected] = useState<Shelf360Data | null>(null);
  const [selectedBook, setSelectedBook] = useState<Shelf360Book | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [focus, setFocus] = useState<{
    shelf: Shelf360Data;
    book: Shelf360Book;
    seq: number;
  } | null>(null);
  const focusSeqRef = useRef(0);

  // Auto-rotate runs until the user grabs the scene, then stays off
  const effectiveAutoRotate = autoRotate && !hasInteracted;

  const clearSelection = () => {
    setSelected(null);
    setSelectedBook(null);
  };

  // Pick a search result: select the book and fly the camera to it
  const pickBook = (shelf: Shelf360Data, book: Shelf360Book) => {
    focusSeqRef.current += 1;
    setFocus({ shelf, book, seq: focusSeqRef.current });
    setSelected(shelf);
    setSelectedBook(book);
    setHasInteracted(true);
    setSearchQuery("");
  };


  // Stable keys so the sync effect never loops on object-identity churn from the
  // parent (e.g. a derived/filtered shelves array), while still adopting refreshed data.
  const shelfKey = (s: Shelf360Data) =>
    `${s.label}|${s.totalBooks}|${s.availableBooks}|${s.borrowedBooks ?? 0}|${s.rackNumber ?? ""}|${s.books.length}`;
  const bookKey = (b: Shelf360Book) => `${b.title}|${b.barcode ?? ""}|${b.status}`;

  // Keep selection in sync with refreshed data
  useEffect(() => {
    if (!selected) return;
    const match = shelves.find((s) => s.label === selected.label);
    if (!match) {
      setSelected(null);
      setSelectedBook(null);
      return;
    }
    if (shelfKey(match) !== shelfKey(selected)) {
      setSelected(match);
    }
    if (selectedBook) {
      const bookMatch = match.books.find(
        (b) => b.title === selectedBook.title && b.barcode === selectedBook.barcode
      );
      if (!bookMatch) {
        setSelectedBook(null);
      } else if (bookKey(bookMatch) !== bookKey(selectedBook)) {
        setSelectedBook(bookMatch);
      }
    }
  }, [shelves, selected, selectedBook]);

  const grouped = useMemo(() => {
    const map = new Map<string, Shelf360Data[]>();
    for (const s of shelves) {
      const rack = s.rackNumber || "Unlabeled";
      if (!map.has(rack)) map.set(rack, []);
      map.get(rack)!.push(s);
    }
    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [, list] of entries) {
      list.sort((a, b) => (a.shelfNumber ?? "").localeCompare(b.shelfNumber ?? ""));
    }
    return entries;
  }, [shelves]);

  const maxTotalBooks = useMemo(
    () => Math.max(1, ...shelves.map((s) => s.totalBooks)),
    [shelves]
  );

  // World position of the focused book (mirrors ShelfLevel + Rack layout).
  // Resolves the current shelf from `shelves` by label so a stale `focus` object
  // (captured before a data refresh) can never target the wrong rack.
  const flyTo = useMemo(() => {
    if (!focus) return null;
    const book = focus.book;
    const shelf = shelves.find((s) => s.label === focus.shelf.label) ?? focus.shelf;
    const rackIdx = grouped.findIndex(
      ([label]) => label === (shelf.rackNumber || "Unlabeled")
    );
    if (rackIdx < 0) return null;
    const { x, z, angle } = computeRackWorldPos(rackIdx, grouped.length);
    const levelIdx = grouped[rackIdx][1].findIndex((s) => s.label === shelf.label);
    const n = getBookCountForShelf(shelf, maxTotalBooks);
    const levelY = 0.27 + levelIdx * LEVEL_HEIGHT;
    if (n <= 0) {
      // No visible books — fly to the middle of the shelf instead
      return { key: focus.seq, x, y: levelY + 0.8, z };
    }
    const books = shelf.books ?? [];
    const bookIdx = Math.max(
      0,
      Math.min(
        n - 1,
        books.findIndex(
          (b) => b.title === book.title && (b.barcode ?? "") === (book.barcode ?? "")
        )
      )
    );
    const { heights, startX } = computeBookLayout(n);
    const bx = startX + bookIdx * (BOOK_W + BOOK_GAP) + BOOK_W / 2;
    const offset = new THREE.Vector3(bx, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      angle + Math.PI
    );
    return {
      key: focus.seq,
      x: x + offset.x,
      y: levelY + heights[bookIdx] / 2,
      z: z + offset.z,
    };
  }, [focus, grouped, maxTotalBooks, shelves]);

  const highlightKey = focus
    ? `${focus.shelf.label}|${focus.book.title}|${focus.book.barcode ?? ""}`
    : null;

  const rackCount = grouped.length;
  const radius = Math.min(28, Math.max(7.5, rackCount * 2.3));
  const cameraPos: [number, number, number] = [
    0,
    Math.max(6, radius * 0.42),
    radius + 7,
  ];

  if (shelves.length === 0) {
    return (
      <div className="flex h-[540px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
        <div className="text-center">
          <Library className="mx-auto mb-3 h-12 w-12 text-gray-500" />
          <p className="font-medium text-gray-500">No shelves configured</p>
          <p className="mt-1 text-sm text-gray-500">
            Add books with rack/shelf numbers to see them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-gray-200 bg-[#f2ecdf] shadow-inner">
      <div className="relative h-[540px] sm:h-[600px]">
        <Canvas
          key={resetKey}
          shadows
          dpr={[1, 1.75]}
          camera={{ position: cameraPos, fov: 42 }}
          onPointerMissed={clearSelection}
          onPointerDown={() => setHasInteracted(true)}
          fallback={
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-gray-500">
              WebGL is not supported in this browser — switch to the grid view to
              manage shelves.
            </div>
          }
        >
          <hemisphereLight args={["#dcebff", "#9a7b55", 0.55]} />
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[12, 16, 9]}
            intensity={1.25}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-40}
            shadow-camera-right={40}
            shadow-camera-top={40}
            shadow-camera-bottom={-40}
            shadow-camera-near={1}
            shadow-camera-far={70}
          />
          <pointLight position={[0, 8, 0]} intensity={0.3} color="#ffe8c8" />

          {/* Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
            <planeGeometry args={[120, 120]} />
            <meshStandardMaterial color="#f2ecdf" roughness={1} />
          </mesh>

          {grouped.map(([rackLabel, list], i) => (
            <Rack
              key={rackLabel}
              rackLabel={rackLabel}
              shelves={list}
              index={i}
              rackCount={rackCount}
              selectedLabel={selected?.label ?? null}
              highlightKey={highlightKey}
              onSelect={(shelf) => {
                setSelected(shelf);
                setSelectedBook(null);
              }}
              onBookClick={(shelf, book) => {
                setSelected(shelf);
                setSelectedBook(book);
              }}
              maxTotalBooks={maxTotalBooks}
            />
          ))}

          <ContactShadows
            position={[0, -0.035, 0]}
            opacity={0.5}
            scale={48}
            blur={2.8}
            far={10}
            resolution={512}
            color="#1e293b"
          />

          <Grid
            position={[0, -0.02, 0]}
            args={[10.5, 10.5]}
            cellSize={0.7}
            cellThickness={0.6}
            cellColor="#6f7280"
            sectionSize={3.5}
            sectionThickness={1}
            sectionColor="#9d8b6a"
            fadeDistance={38}
            fadeStrength={1}
            infiniteGrid
          />

          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            autoRotate={effectiveAutoRotate}
            autoRotateSpeed={0.8}
            target={[0, 2.4, 0]}
            minDistance={4}
            maxDistance={60}
            maxPolarAngle={Math.PI * 0.52}
            minPolarAngle={0.12}
          />

          <FlyToCamera flyTo={flyTo} />
        </Canvas>

        {/* Search */}
        <SearchOverlay
          shelves={shelves}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onPick={pickBook}
        />

        {/* Badge */}
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-lg bg-emerald-600/90 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
          <Rotate3d className="h-3.5 w-3.5" />
          360° Shelf View
        </div>

        {/* Toolbar */}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          <button
            onClick={() => {
              setAutoRotate((v) => !v);
              setHasInteracted(false);
            }}
            title={
              effectiveAutoRotate ? "Pause auto-rotation" : "Start auto-rotation"
            }
            className={`flex h-9 w-9 items-center justify-center rounded-lg border shadow-md backdrop-blur transition-all ${
              effectiveAutoRotate
                ? "border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700"
                : "border-gray-200 bg-white/90 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {effectiveAutoRotate ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Orbit className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setResetKey((k) => k + 1)}
            title="Reset camera"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white/90 text-gray-600 shadow-md backdrop-blur transition-all hover:bg-gray-100"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Hint / info */}
        {selected ? (
          <InfoPanel
            shelf={selected}
            book={selectedBook}
            onEdit={onEdit}
            onMove={onMove}
            onClear={onClear}
            onClose={clearSelection}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-xl border border-gray-200 bg-white/85 px-4 py-3 text-xs text-gray-500 shadow-lg backdrop-blur"
          >
            <Info className="h-4 w-4 text-emerald-600" />
            <span>
              <b className="font-semibold text-gray-700">Drag</b> to orbit ·{" "}
              <b className="font-semibold text-gray-700">Scroll</b> to zoom ·{" "}
              <b className="font-semibold text-gray-700">Click a shelf</b> for details
            </span>
          </motion.div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 right-3 z-20 hidden flex-col gap-1.5 rounded-xl border border-gray-200 bg-white/85 px-3.5 py-2.5 text-[11px] text-gray-600 shadow-lg backdrop-blur sm:flex">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: "#10b981" }} />
            Available (coloured spine)
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-[#7c8aa0]" />
            Borrowed (greyed)
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: "#f97316" }} />
            Shelf colour label
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-gradient-to-br from-indigo-400 to-rose-400" />
            Book covers
          </span>
        </div>
      </div>
    </div>
  );
}
