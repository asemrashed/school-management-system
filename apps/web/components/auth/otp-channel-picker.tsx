import { Mail, MessageSquare } from "lucide-react";
import { Button } from "@packages/ui";

/** Shared component (component-registry.md: OtpChannelPicker). Only ever
 * shown when the API says a channel choice is required (auth-rbac.md). */
export function OtpChannelPicker({
  onChoose,
  disabled,
}: {
  onChoose: (channel: "email" | "sms") => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={() => onChoose("email")} disabled={disabled}>
        <Mail className="h-4 w-4" /> Send to my email
      </Button>
      <Button variant="outline" onClick={() => onChoose("sms")} disabled={disabled}>
        <MessageSquare className="h-4 w-4" /> Send by SMS
      </Button>
    </div>
  );
}
