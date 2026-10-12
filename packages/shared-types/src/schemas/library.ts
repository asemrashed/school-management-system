import { z } from "zod";

const paisaAmount = z.number().int().nonnegative();

export const bookDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  isbn: z.string().nullable(),
  totalCopies: z.number().int(),
  availableCopies: z.number().int(),
  priceForSale: paisaAmount.nullable(),
});
export type BookDto = z.infer<typeof bookDtoSchema>;

export const createBookSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(160),
  isbn: z.string().max(40).optional(),
  totalCopies: z.number().int().min(1),
  priceForSale: paisaAmount.optional(),
});
export type CreateBookInput = z.infer<typeof createBookSchema>;

export const bookIssueDtoSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  bookTitle: z.string(),
  borrowerId: z.string(),
  borrowerName: z.string(),
  issuedAt: z.string(),
  dueAt: z.string(),
  returnedAt: z.string().nullable(),
  fineAmount: paisaAmount.nullable(),
});
export type BookIssueDto = z.infer<typeof bookIssueDtoSchema>;

export const issueBookSchema = z.object({
  bookId: z.string(),
  borrowerId: z.string(), // a User id (student, teacher, staff)
  dueAt: z.string().date(),
});
export type IssueBookInput = z.infer<typeof issueBookSchema>;

export const returnBookSchema = z.object({
  issueId: z.string(),
});

export const bookSaleDtoSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  bookTitle: z.string(),
  buyerName: z.string(),
  quantity: z.number().int(),
  amount: paisaAmount,
  soldAt: z.string(),
});
export type BookSaleDto = z.infer<typeof bookSaleDtoSchema>;

export const createBookSaleSchema = z.object({
  bookId: z.string(),
  buyerId: z.string(),
  quantity: z.number().int().min(1),
});
export type CreateBookSaleInput = z.infer<typeof createBookSaleSchema>;
