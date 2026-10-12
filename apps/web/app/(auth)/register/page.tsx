"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerSchema, type Role } from "@packages/shared-types";
import { Button, Input, Label, Select, Card, CardContent, useToast } from "@packages/ui";
import { useRegister } from "@/lib/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

// Self-registration is limited to roles that make sense without an admin
// creating the account first. Staff roles are provisioned by Super Admin
// (see /users route + Phase 1 exit criteria).
const SELF_REGISTER_ROLES: Role[] = ["parent", "student"];

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const register = useRegister();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<Role>("parent");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const parsed = registerSchema.safeParse({ name, email, password, role });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setFieldErrors(errs);
      return;
    }

    try {
      const { user } = await register.mutateAsync(parsed.data);
      toast({ title: `Account created — welcome, ${user.name.split(" ")[0]}`, variant: "success" });
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not create the account.";
      toast({ title: "Registration failed", description: message, variant: "error" });
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <h1 className="text-lg font-semibold text-slate-900">Create an account</h1>
          <p className="mt-1 text-sm text-slate-500">For parents and students only.</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">I am a</Label>
              <Select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {SELF_REGISTER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r === "parent" ? "Parent / Guardian" : "Student"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
            </div>
            <Button type="submit" disabled={register.isPending} className="mt-2">
              {register.isPending ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
