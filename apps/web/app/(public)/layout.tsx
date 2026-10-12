import { Fraunces } from "next/font/google";
import { SiteHeader, SiteFooter } from "@/components/public/site-chrome";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600"] });

/** Shared header/footer for every public page. Content comes from Admin → Website. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} flex min-h-screen flex-col bg-paper text-ink`}>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
