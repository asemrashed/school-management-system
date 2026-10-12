import type { Env } from "../env";

export type PaymentMethodKey = "bkash" | "nagad" | "sslcommerz";

export interface PaymentSession {
  redirectUrl: string;
  gatewaySessionId: string;
}

export interface PaymentProvider {
  /** True when the app runs its own fake checkout instead of a real gateway. */
  readonly sandbox: boolean;
  isEnabled(method: PaymentMethodKey): boolean;
  /** Methods the UI may offer right now. */
  enabledMethods(): PaymentMethodKey[];
  /**
   * Starts a checkout. `sessionRef` is OUR OnlinePayment.gatewaySessionId; it
   * is what the gateway echoes back so a callback can be matched to a session.
   */
  initiate(method: PaymentMethodKey, args: { amount: number; invoiceId: string; sessionRef: string }): Promise<PaymentSession>;
  /** Server-side check that a gateway really took the money (never trust the browser). */
  verify(method: PaymentMethodKey, args: { valId: string; expectedAmount: number; sessionRef: string }): Promise<boolean>;
}

const ALL: PaymentMethodKey[] = ["bkash", "nagad", "sslcommerz"];

export class GatewayNotWiredError extends Error {
  constructor(method: PaymentMethodKey) {
    super(
      `${method} checkout is not wired to a live merchant API in this build. ` +
        `Use PAYMENT_SANDBOX=true for testing, enable SSLCOMMERZ, or record the payment at the office.`
    );
    this.name = "GatewayNotWiredError";
  }
}

/**
 * Resolved from env at boot (devops.md). Each gateway is independently
 * env-gated. In sandbox mode every method is available and checkout happens
 * on the school's own fake page.
 *
 * Live gateways:
 *  - SSLCommerz: implemented against the documented v4 init + validation APIs.
 *    NOT exercised against a real merchant account in this repo's tests —
 *    run it in SSLCommerz's sandbox store before going live.
 *  - bKash / Nagad: need merchant-specific tokenized-checkout agreements
 *    (app key/secret + signed requests); intentionally not faked. They throw
 *    GatewayNotWiredError until a real integration is added.
 */
export function createPaymentProvider(env: Env): PaymentProvider {
  const sandbox = env.PAYMENT_SANDBOX;
  const sslBase = (env.NODE_ENV === "production" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com");

  const provider: PaymentProvider = {
    sandbox,
    isEnabled(method) {
      if (sandbox) return true;
      if (method === "bkash") return env.BKASH_ENABLED;
      if (method === "nagad") return env.NAGAD_ENABLED;
      return env.SSLCOMMERZ_ENABLED;
    },
    enabledMethods() {
      return ALL.filter((m) => provider.isEnabled(m));
    },
    async initiate(method, args) {
      if (!provider.isEnabled(method)) throw new Error(`${method} is not enabled in this environment.`);
      if (sandbox) {
        return {
          gatewaySessionId: args.sessionRef,
          redirectUrl: `${env.PUBLIC_WEB_URL}/pay/sandbox?session=${encodeURIComponent(args.sessionRef)}`,
        };
      }
      if (method !== "sslcommerz") throw new GatewayNotWiredError(method);

      const body = new URLSearchParams({
        store_id: env.SSLCOMMERZ_STORE_ID ?? "",
        store_passwd: env.SSLCOMMERZ_STORE_PASSWORD ?? "",
        total_amount: (args.amount / 100).toFixed(2),
        currency: "BDT",
        tran_id: args.sessionRef,
        success_url: `${env.PUBLIC_API_URL}/fees/payments/callback/sslcommerz`,
        fail_url: `${env.PUBLIC_WEB_URL}/dashboard?payment=failed`,
        cancel_url: `${env.PUBLIC_WEB_URL}/dashboard?payment=cancelled`,
        ipn_url: `${env.PUBLIC_API_URL}/fees/payments/callback/sslcommerz`,
        cus_name: "School fee",
        cus_email: "noreply@school.test",
        cus_add1: "-",
        cus_city: "Dhaka",
        cus_country: "Bangladesh",
        cus_phone: "0000000000",
        shipping_method: "NO",
        product_name: "School fee",
        product_category: "Education",
        product_profile: "non-physical-goods",
        value_a: args.invoiceId,
      });
      const res = await fetch(`${sslBase}/gwprocess/v4/api.php`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { status?: string; GatewayPageURL?: string };
      if (!res.ok || json.status !== "SUCCESS" || !json.GatewayPageURL) {
        throw new Error("SSLCommerz did not return a checkout page. Check the store credentials.");
      }
      return { redirectUrl: json.GatewayPageURL, gatewaySessionId: args.sessionRef };
    },
    async verify(method, args) {
      if (sandbox) return true; // the sandbox page is itself trusted-by-construction (authenticated route)
      if (method !== "sslcommerz") throw new GatewayNotWiredError(method);
      const url =
        `${sslBase}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(args.valId)}` +
        `&store_id=${encodeURIComponent(env.SSLCOMMERZ_STORE_ID ?? "")}` +
        `&store_passwd=${encodeURIComponent(env.SSLCOMMERZ_STORE_PASSWORD ?? "")}&format=json`;
      const res = await fetch(url);
      const json = (await res.json().catch(() => ({}))) as { status?: string; tran_id?: string; amount?: string };
      const paid = json.status === "VALID" || json.status === "VALIDATED";
      // The transaction must be ours AND for the exact amount we asked for.
      return paid && json.tran_id === args.sessionRef && Math.round(Number(json.amount) * 100) === args.expectedAmount;
    },
  };
  return provider;
}
