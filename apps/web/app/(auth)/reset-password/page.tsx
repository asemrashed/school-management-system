"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Card, CardContent, useToast } from "@packages/ui";
import { OtpChannelPicker } from "@/components/auth/otp-channel-picker";
import {
  useRequestPasswordReset,
  useChooseOtpChannel,
  useVerifyPasswordReset,
} from "@/lib/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

type Step = "request" | "channel" | "verify" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const requestReset = useRequestPasswordReset();
  const chooseChannel = useChooseOtpChannel();
  const verifyReset = useVerifyPasswordReset();

  const [step, setStep] = React.useState<Step>("request");
  const [email, setEmail] = React.useState("");
  const [otpRequestId, setOtpRequestId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await requestReset.mutateAsync({ email });
      setOtpRequestId(result.otpRequestId);
      // Only show a channel picker when SMS is effectively enabled for
      // password_reset (env gateway AND Super Admin toggle both on) —
      // otherwise the email was already sent silently (auth-rbac.md).
      setStep(result.channelChoiceRequired ? "channel" : "verify");
      if (!result.channelChoiceRequired) {
        toast({ title: "Check your email", description: "We sent a 6-digit code if that account exists.", variant: "default" });
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not start password reset.";
      toast({ title: "Something went wrong", description: message, variant: "error" });
    }
  }

  async function handleChannel(channel: "email" | "sms") {
    if (!otpRequestId) return;
    try {
      await chooseChannel.mutateAsync({ otpRequestId, channel });
      setStep("verify");
      toast({
        title: channel === "email" ? "Check your email" : "Check your phone",
        description: "We sent a 6-digit code.",
        variant: "default",
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not send the code.";
      toast({ title: "Something went wrong", description: message, variant: "error" });
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!otpRequestId) return;
    try {
      await verifyReset.mutateAsync({ otpRequestId, code, newPassword });
      setStep("done");
      toast({ title: "Password updated", description: "You can now sign in.", variant: "success" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "That code didn't work.";
      toast({ title: "Verification failed", description: message, variant: "error" });
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <h1 className="text-lg font-semibold text-slate-900">Reset your password</h1>

          {step === "request" && (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Enter the email on your account and we&apos;ll send a code.
              </p>
              <form onSubmit={handleRequest} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={requestReset.isPending}>
                  {requestReset.isPending ? "Sending..." : "Send code"}
                </Button>
              </form>
            </>
          )}

          {step === "channel" && (
            <>
              <p className="mt-1 text-sm text-slate-500">How should we send your code?</p>
              <div className="mt-6">
                <OtpChannelPicker onChoose={handleChannel} disabled={chooseChannel.isPending} />
              </div>
            </>
          )}

          {step === "verify" && (
            <>
              <p className="mt-1 text-sm text-slate-500">Enter the 6-digit code and a new password.</p>
              <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="code">6-digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={verifyReset.isPending}>
                  {verifyReset.isPending ? "Updating..." : "Update password"}
                </Button>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="mt-6 flex flex-col gap-4">
              <p className="text-sm text-slate-600">Your password has been updated.</p>
              <Button onClick={() => router.push("/login")}>Go to sign in</Button>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
