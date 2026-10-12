import { Fraunces } from "next/font/google";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { RolesSection } from "@/components/marketing/roles-section";
import { Testimonials } from "@/components/marketing/testimonials";
import { Pricing } from "@/components/marketing/pricing";
import { AboutSection } from "@/components/marketing/about-section";
import { Faq } from "@/components/marketing/faq";
import { ContactSection } from "@/components/marketing/contact-section";
import { FooterCta, SiteFooter } from "@/components/marketing/footer";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600"],
});

export default function HomePage() {
  return (
    <div className={`${fraunces.variable} bg-paper`}>
      <MarketingNavbar />
      <main>
        <Hero />
        <Features />
        <RolesSection />
        <Testimonials />
        <Pricing />
        <AboutSection />
        <Faq />
        <ContactSection />
      </main>
      <FooterCta />
      <SiteFooter />
    </div>
  );
}
