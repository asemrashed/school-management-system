"use client";

import * as React from "react";
import { useToast } from "@packages/ui";

/** Announces the result when the payment gateway sends the person back (?payment=success|failed). */
export function PaymentReturnNotice() {
  const { toast } = useToast();
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("payment");
    if (!result) return;
    if (result === "success") toast({ title: "Payment received", description: "Thank you. Your invoice has been updated.", variant: "success" });
    if (result === "failed") toast({ title: "Payment not completed", description: "No money was taken. You can try again from the Fees tab.", variant: "error" });
    url.searchParams.delete("payment");
    url.searchParams.set("tab", "fees"); // land on the Fees tab after the gateway returns
    window.history.replaceState(null, "", url.pathname + url.search); // don't re-announce on refresh
  }, [toast]);
  return null;
}
