import type { Request, Response } from "express";
import {
  createBookSchema,
  issueBookSchema,
  returnBookSchema,
  createBookSaleSchema,
  type BookDto,
  type BookIssueDto,
  type BookSaleDto,
} from "@packages/shared-types";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

const FINE_PER_DAY_PAISA = 500; // ৳5.00/day overdue — adjust as the school needs.

function toBookDto(row: {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  totalCopies: number;
  availableCopies: number;
  priceForSale: number | null;
}): BookDto {
  return { ...row };
}

export async function listBooks(_req: Request, res: Response) {
  const rows = await prisma.book.findMany({ where: { deletedAt: null }, orderBy: { title: "asc" } });
  res.json({ items: rows.map(toBookDto) });
}

export async function createBook(req: Request, res: Response) {
  const input = createBookSchema.parse(req.body);
  const row = await prisma.book.create({
    data: { ...input, availableCopies: input.totalCopies },
  });
  res.status(201).json({ book: toBookDto(row) });
}

function toIssueDto(row: {
  id: string;
  bookId: string;
  book: { title: string };
  borrowerId: string;
  borrower: { name: string };
  issuedAt: Date;
  dueAt: Date;
  returnedAt: Date | null;
  fineAmount: number | null;
}): BookIssueDto {
  return {
    id: row.id,
    bookId: row.bookId,
    bookTitle: row.book.title,
    borrowerId: row.borrowerId,
    borrowerName: row.borrower.name,
    issuedAt: row.issuedAt.toISOString(),
    dueAt: row.dueAt.toISOString().slice(0, 10),
    returnedAt: row.returnedAt?.toISOString() ?? null,
    fineAmount: row.fineAmount,
  };
}

export async function listIssues(req: Request, res: Response) {
  const activeOnly = req.query.active === "true";
  // Only library staff / admins see everyone's loans; every other role sees
  // just their own borrowing history.
  const seesAll = ["super_admin", "admin", "librarian"].includes(req.user!.role);
  const rows = await prisma.bookIssue.findMany({
    where: {
      ...(activeOnly ? { returnedAt: null } : {}),
      ...(seesAll ? {} : { borrowerId: req.user!.id }),
    },
    include: { book: true, borrower: true },
    orderBy: { issuedAt: "desc" },
  });
  res.json({ items: rows.map(toIssueDto) });
}

export async function issueBook(req: Request, res: Response) {
  const input = issueBookSchema.parse(req.body);
  const book = await prisma.book.findUnique({ where: { id: input.bookId } });
  if (!book) throw AppError.badRequest("BOOK_NOT_FOUND", "That book does not exist.");
  const borrower = await prisma.user.findUnique({ where: { id: input.borrowerId } });
  if (!borrower || borrower.deletedAt || !borrower.isActive) {
    throw AppError.badRequest("BORROWER_NOT_FOUND", "That borrower does not exist or is inactive.");
  }

  const issue = await prisma.$transaction(async (tx) => {
    // Atomic stock claim: fails if the last copy was just taken.
    const claimed = await tx.book.updateMany({
      where: { id: input.bookId, availableCopies: { gt: 0 } },
      data: { availableCopies: { decrement: 1 } },
    });
    if (claimed.count !== 1) throw AppError.conflict("No copies of this book are available.");
    return tx.bookIssue.create({
      data: { bookId: input.bookId, borrowerId: input.borrowerId, dueAt: new Date(input.dueAt) },
      include: { book: true, borrower: true },
    });
  });
  res.status(201).json({ issue: toIssueDto(issue) });
}

export async function returnBook(req: Request, res: Response) {
  const { issueId } = returnBookSchema.parse(req.body);
  const issue = await prisma.bookIssue.findUnique({ where: { id: issueId } });
  if (!issue) throw AppError.notFound("Issue record not found.");
  if (issue.returnedAt) throw AppError.conflict("This book was already returned.");

  const now = new Date();
  const overdueDays = Math.max(0, Math.ceil((now.getTime() - issue.dueAt.getTime()) / (1000 * 60 * 60 * 24)));
  const fineAmount = overdueDays * FINE_PER_DAY_PAISA;

  const [updated] = await prisma.$transaction([
    prisma.bookIssue.update({
      where: { id: issueId },
      data: { returnedAt: now, fineAmount },
      include: { book: true, borrower: true },
    }),
    prisma.book.update({ where: { id: issue.bookId }, data: { availableCopies: { increment: 1 } } }),
  ]);
  res.json({ issue: toIssueDto(updated) });
}

function toSaleDto(row: {
  id: string;
  bookId: string;
  book: { title: string };
  buyer: { name: string };
  quantity: number;
  amount: number;
  soldAt: Date;
}): BookSaleDto {
  return {
    id: row.id,
    bookId: row.bookId,
    bookTitle: row.book.title,
    buyerName: row.buyer.name,
    quantity: row.quantity,
    amount: row.amount,
    soldAt: row.soldAt.toISOString(),
  };
}

export async function listSales(_req: Request, res: Response) {
  const rows = await prisma.bookSale.findMany({
    include: { book: true, buyer: true },
    orderBy: { soldAt: "desc" },
  });
  res.json({ items: rows.map(toSaleDto) });
}

export async function createSale(req: Request, res: Response) {
  const input = createBookSaleSchema.parse(req.body);
  const book = await prisma.book.findUnique({ where: { id: input.bookId } });
  if (!book) throw AppError.badRequest("BOOK_NOT_FOUND", "That book does not exist.");
  if (!book.priceForSale) throw AppError.badRequest("NOT_FOR_SALE", "This book has no sale price set.");
  if (book.availableCopies < input.quantity) {
    throw AppError.conflict("Not enough copies in stock for this sale.");
  }

  const buyer = await prisma.user.findUnique({ where: { id: input.buyerId } });
  if (!buyer || buyer.deletedAt) throw AppError.badRequest("BUYER_NOT_FOUND", "That buyer does not exist.");

  const amount = book.priceForSale * input.quantity;
  const sale = await prisma.$transaction(async (tx) => {
    const claimed = await tx.book.updateMany({
      where: { id: input.bookId, availableCopies: { gte: input.quantity } },
      data: { availableCopies: { decrement: input.quantity } },
    });
    if (claimed.count !== 1) throw AppError.conflict("Not enough copies in stock for this sale.");
    return tx.bookSale.create({
      data: { bookId: input.bookId, buyerId: input.buyerId, quantity: input.quantity, amount },
      include: { book: true, buyer: true },
    });
  });
  res.status(201).json({ sale: toSaleDto(sale) });
}
