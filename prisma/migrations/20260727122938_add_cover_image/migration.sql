-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('AVAILABLE', 'BORROWED', 'RESTOCK_QUEUE', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE', 'LOST');

-- CreateTable
CREATE TABLE "library_books" (
    "id" TEXT NOT NULL,
    "isbn" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publisher" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "barcode" TEXT,
    "rackNumber" TEXT,
    "shelfNumber" TEXT,
    "locationColor" TEXT,
    "coverImage" TEXT,
    "status" "BookStatus" NOT NULL DEFAULT 'AVAILABLE',
    "totalCopies" INTEGER NOT NULL DEFAULT 1,
    "availableCopies" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_loans" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "bookTitle" TEXT NOT NULL,
    "bookBarcode" TEXT,
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "renewed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "library_books_barcode_key" ON "library_books"("barcode");

-- CreateIndex
CREATE INDEX "library_books_isbn_idx" ON "library_books"("isbn");

-- CreateIndex
CREATE INDEX "library_books_barcode_idx" ON "library_books"("barcode");

-- CreateIndex
CREATE INDEX "library_books_category_idx" ON "library_books"("category");

-- CreateIndex
CREATE INDEX "library_books_status_idx" ON "library_books"("status");

-- CreateIndex
CREATE INDEX "library_books_title_idx" ON "library_books"("title");

-- CreateIndex
CREATE INDEX "book_loans_bookId_idx" ON "book_loans"("bookId");

-- CreateIndex
CREATE INDEX "book_loans_studentId_idx" ON "book_loans"("studentId");

-- CreateIndex
CREATE INDEX "book_loans_status_idx" ON "book_loans"("status");

-- CreateIndex
CREATE INDEX "book_loans_dueAt_idx" ON "book_loans"("dueAt");

-- AddForeignKey
ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
