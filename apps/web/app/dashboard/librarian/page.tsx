"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  PageHeader,
  DataTable,
  Button,
  Badge,
  FormModal,
  Input,
  Label,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
} from "@packages/ui";
import { createBookSchema, issueBookSchema, createBookSaleSchema } from "@packages/shared-types";
import {
  useBooks,
  useCreateBook,
  useBookIssues,
  useIssueBook,
  useReturnBook,
  useBookSales,
  useCreateBookSale,
} from "@/lib/hooks/use-library";
import { LookupCombobox } from "@/components/forms/lookup-combobox";
import { ApiError } from "@/lib/api-client";
import { useUrlTab } from "@/lib/use-url-tab";

const TAB_VALUES = ["catalog", "issues", "sales"] as const;

export default function LibrarianDashboardPage() {
  const [tab, setTab] = useUrlTab("tab", "catalog", TAB_VALUES);
  return (
    <div>
      <PageHeader title="Library" description="Catalog, issue/return, fines and book sales." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="issues">Issue / Return</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog">
          <CatalogPanel />
        </TabsContent>
        <TabsContent value="issues">
          <IssuesPanel />
        </TabsContent>
        <TabsContent value="sales">
          <SalesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogPanel() {
  const { toast } = useToast();
  const books = useBooks();
  const createBook = useCreateBook();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", author: "", isbn: "", totalCopies: 1, priceForSale: 0 });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createBookSchema.safeParse({
      ...form,
      isbn: form.isbn || undefined,
      priceForSale: form.priceForSale || undefined,
    });
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createBook.mutateAsync(parsed.data);
      toast({ title: "Book added", variant: "success" });
      setOpen(false);
      setForm({ title: "", author: "", isbn: "", totalCopies: 1, priceForSale: 0 });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not add the book.";
      toast({ title: "Could not add book", description: message, variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Catalog"
        actions={
          <FormModal
            open={open}
            onOpenChange={setOpen}
            title="New book"
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> New book
              </Button>
            }
          >
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="book-title">Title</Label>
                <Input id="book-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="book-author">Author</Label>
                <Input id="book-author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="book-isbn">ISBN (optional)</Label>
                <Input id="book-isbn" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="book-copies">Total copies</Label>
                <Input
                  id="book-copies"
                  type="number"
                  min={1}
                  value={form.totalCopies}
                  onChange={(e) => setForm({ ...form, totalCopies: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="book-price">Sale price in paisa (optional — leave 0 if lending-only)</Label>
                <Input
                  id="book-price"
                  type="number"
                  value={form.priceForSale}
                  onChange={(e) => setForm({ ...form, priceForSale: Number(e.target.value) })}
                />
              </div>
              <Button type="submit" disabled={createBook.isPending} className="mt-2">
                {createBook.isPending ? "Adding..." : "Add book"}
              </Button>
            </form>
          </FormModal>
        }
      />
      <DataTable
        columns={[
          { key: "title", header: "Title", render: (b) => b.title },
          { key: "author", header: "Author", render: (b) => b.author },
          { key: "copies", header: "Available", render: (b) => `${b.availableCopies} / ${b.totalCopies}` },
          {
            key: "price",
            header: "Sale price",
            render: (b) => (b.priceForSale ? `৳${(b.priceForSale / 100).toFixed(2)}` : "Lending only"),
          },
        ]}
        data={books.data?.items ?? []}
        keyField={(b) => b.id}
        isLoading={books.isLoading}
        isError={books.isError}
        onRetry={() => books.refetch()}
        emptyTitle="No books yet"
      />
    </div>
  );
}

function IssuesPanel() {
  const { toast } = useToast();
  const issues = useBookIssues();
  const books = useBooks();
  const issueBook = useIssueBook();
  const returnBook = useReturnBook();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ bookId: "", borrowerId: "", dueAt: "" });

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    const parsed = issueBookSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await issueBook.mutateAsync(parsed.data);
      toast({ title: "Book issued", variant: "success" });
      setOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not issue the book.";
      toast({ title: "Could not issue", description: message, variant: "error" });
    }
  }

  async function handleReturn(issueId: string) {
    try {
      const { issue } = await returnBook.mutateAsync(issueId);
      toast({
        title: "Book returned",
        description: issue.fineAmount ? `Fine due: ৳${(issue.fineAmount / 100).toFixed(2)}` : undefined,
        variant: "success",
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not process the return.";
      toast({ title: "Could not return", description: message, variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Issue / Return"
        actions={
          <FormModal
            open={open}
            onOpenChange={setOpen}
            title="Issue a book"
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Issue book
              </Button>
            }
          >
            <form onSubmit={handleIssue} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-book">Book</Label>
                <Select
                  id="issue-book"
                  value={form.bookId}
                  onChange={(e) => setForm({ ...form, bookId: e.target.value })}
                >
                  <option value="">Select a book</option>
                  {books.data?.items.map((b) => (
                    <option key={b.id} value={b.id} disabled={b.availableCopies < 1}>
                      {b.title} ({b.availableCopies} available)
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-borrower">Borrower</Label>
                <LookupCombobox id="issue-borrower" kind="users" value={form.borrowerId} onChange={(v) => setForm({ ...form, borrowerId: v })} placeholder="Search student or staff…" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-due">Due date</Label>
                <Input id="issue-due" type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
              </div>
              <Button type="submit" disabled={issueBook.isPending} className="mt-2">
                {issueBook.isPending ? "Issuing..." : "Issue"}
              </Button>
            </form>
          </FormModal>
        }
      />
      <DataTable
        columns={[
          { key: "book", header: "Book", render: (i) => i.bookTitle },
          { key: "borrower", header: "Borrower", render: (i) => i.borrowerName },
          { key: "due", header: "Due", render: (i) => i.dueAt },
          {
            key: "status",
            header: "Status",
            render: (i) =>
              i.returnedAt ? (
                <Badge variant={i.fineAmount ? "warning" : "success"}>
                  Returned{i.fineAmount ? ` — fine ৳${(i.fineAmount / 100).toFixed(2)}` : ""}
                </Badge>
              ) : (
                <Badge variant="muted">Out</Badge>
              ),
          },
          {
            key: "actions",
            header: "",
            render: (i) =>
              !i.returnedAt && (
                <Button variant="outline" size="sm" onClick={() => handleReturn(i.id)} disabled={returnBook.isPending}>
                  Return
                </Button>
              ),
          },
        ]}
        data={issues.data?.items ?? []}
        keyField={(i) => i.id}
        isLoading={issues.isLoading}
        isError={issues.isError}
        onRetry={() => issues.refetch()}
        emptyTitle="No issues yet"
      />
    </div>
  );
}

function SalesPanel() {
  const { toast } = useToast();
  const sales = useBookSales();
  const books = useBooks();
  const createSale = useCreateBookSale();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ bookId: "", buyerId: "", quantity: 1 });

  async function handleSale(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createBookSaleSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createSale.mutateAsync(parsed.data);
      toast({ title: "Sale recorded", variant: "success" });
      setOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not record the sale.";
      toast({ title: "Could not record sale", description: message, variant: "error" });
    }
  }

  const sellable = (books.data?.items ?? []).filter((b) => b.priceForSale);

  return (
    <div>
      <PageHeader
        title="Book sales"
        actions={
          <FormModal
            open={open}
            onOpenChange={setOpen}
            title="Record a sale"
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> New sale
              </Button>
            }
          >
            <form onSubmit={handleSale} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sale-book">Book</Label>
                <Select
                  id="sale-book"
                  value={form.bookId}
                  onChange={(e) => setForm({ ...form, bookId: e.target.value })}
                >
                  <option value="">Select a book</option>
                  {sellable.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} — ৳{((b.priceForSale ?? 0) / 100).toFixed(2)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sale-buyer">Buyer</Label>
                <LookupCombobox id="sale-buyer" kind="users" value={form.buyerId} onChange={(v) => setForm({ ...form, buyerId: v })} placeholder="Search buyer…" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sale-qty">Quantity</Label>
                <Input
                  id="sale-qty"
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                />
              </div>
              <Button type="submit" disabled={createSale.isPending} className="mt-2">
                {createSale.isPending ? "Recording..." : "Record sale"}
              </Button>
            </form>
          </FormModal>
        }
      />
      <DataTable
        columns={[
          { key: "book", header: "Book", render: (s) => s.bookTitle },
          { key: "buyer", header: "Buyer", render: (s) => s.buyerName },
          { key: "qty", header: "Qty", render: (s) => String(s.quantity) },
          { key: "amount", header: "Amount", render: (s) => `৳${(s.amount / 100).toFixed(2)}` },
        ]}
        data={sales.data?.items ?? []}
        keyField={(s) => s.id}
        isLoading={sales.isLoading}
        isError={sales.isError}
        onRetry={() => sales.refetch()}
        emptyTitle="No sales yet"
      />
    </div>
  );
}
