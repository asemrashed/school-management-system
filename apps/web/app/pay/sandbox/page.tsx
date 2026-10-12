"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@packages/ui";
import { errorMessage } from "@/lib/errors";
import { useCompleteSandboxPayment } from "@/lib/hooks/use-fees";

/**
 * Stand-in for bKash / Nagad / card checkout, shown only when the API runs with
 * PAYMENT_SANDBOX=true. Lets you test the full pay -> confirm -> receipt flow
 * with no merchant account. The API rejects this call when sandbox is off.
 */
function SandboxCheckout() {
  const router = useRouter();
  const session = useSearchParams().get("session") ?? "";
  const complete = useCompleteSandboxPayment();
  const [error, setError] = React.useState<string | null>(null);

  async function finish(outcome: "success" | "fail") {
    setError(null);
    try {
      await complete.mutateAsync({ session, outcome });
      router.replace(`/dashboard?payment=${outcome === "success" ? "success" : "failed"}`);
    } catch (err) {
      setError(errorMessage(err, "Could not complete the test payment."));
    }
  }

  if (!session) return <p className="p-8 text-sm text-slate-600">Missing payment session. <Link className="text-brand-600 underline" href="/dashboard">Back to dashboard</Link></p>;
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader><CardTitle>Test checkout</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">This is a practice payment page. No real money moves. Choose what the bank should answer.</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button disabled={complete.isPending} onClick={() => finish("success")}>Pay successfully</Button>
          <Button variant="outline" disabled={complete.isPending} onClick={() => finish("fail")}>Cancel / fail</Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default function SandboxPayPage() {
  return <React.Suspense fallback={null}><SandboxCheckout /></React.Suspense>;
}
