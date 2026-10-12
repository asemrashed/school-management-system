import { z } from "zod";

/**
 * Public-website content, editable by Super Admin / Admin under
 * Dashboard -> Administration -> Website. Every field has a safe default so
 * the public site renders sensibly on day one, before anyone edits anything.
 */

const text = (max: number) => z.string().trim().max(max);
// Only http(s) URLs or site-relative paths: blocks javascript:/data: URLs
// from ever reaching an <a href> or <img src> on the public site.
const safeUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/"), "Must start with http(s):// or /");

export const SITE_KEYS = ["general", "home", "admission"] as const;
export const siteKeySchema = z.enum(SITE_KEYS);
export type SiteKey = z.infer<typeof siteKeySchema>;

export const NAV_ITEMS = ["home", "about", "admission", "gallery", "contact"] as const;
export type NavItemKey = (typeof NAV_ITEMS)[number];

export const generalSettingsSchema = z.object({
  schoolName: text(120).min(1),
  tagline: text(160),
  logoUrl: safeUrl,
  address: text(300),
  phone: text(40),
  email: text(120),
  officeHours: text(120),
  mapEmbedUrl: safeUrl,
  facebookUrl: safeUrl,
  youtubeUrl: safeUrl,
  /** Menu labels; set `visible: false` to hide a page from the navbar. */
  nav: z.array(z.object({ key: z.enum(NAV_ITEMS), label: text(30).min(1), visible: z.boolean() })).length(5),
});
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;

export const homeSettingsSchema = z.object({
  heroTitle: text(140),
  heroSubtitle: text(300),
  heroImageUrl: safeUrl,
  heroPrimaryLabel: text(30),
  aboutTitle: text(120),
  aboutText: text(1200),
  /** "How our school management system helps modern schooling" cards. */
  features: z.array(z.object({ title: text(60).min(1), text: text(240) })).max(8),
  showTeachers: z.boolean(),
  showGallery: z.boolean(),
  showNotices: z.boolean(),
});
export type HomeSettings = z.infer<typeof homeSettingsSchema>;

export const admissionSettingsSchema = z.object({
  /** Turns the public application form on or off. */
  open: z.boolean(),
  closedMessage: text(300),
  intro: text(600),
});
export type AdmissionSettings = z.infer<typeof admissionSettingsSchema>;

export const SITE_SCHEMAS = {
  general: generalSettingsSchema,
  home: homeSettingsSchema,
  admission: admissionSettingsSchema,
} as const;

export const DEFAULT_SITE = {
  general: {
    schoolName: "Our School",
    tagline: "Nurturing curious, confident learners",
    logoUrl: "",
    address: "",
    phone: "",
    email: "",
    officeHours: "Sunday–Thursday, 9:00 AM – 3:00 PM",
    mapEmbedUrl: "",
    facebookUrl: "",
    youtubeUrl: "",
    nav: [
      { key: "home", label: "Home", visible: true },
      { key: "about", label: "About", visible: true },
      { key: "admission", label: "Admission", visible: true },
      { key: "gallery", label: "Gallery", visible: true },
      { key: "contact", label: "Contact", visible: true },
    ],
  } satisfies GeneralSettings,
  home: {
    heroTitle: "A caring English-medium school",
    heroSubtitle: "Strong academics, kind values and a community where every child belongs.",
    heroImageUrl: "",
    heroPrimaryLabel: "Apply for admission",
    aboutTitle: "About our school",
    aboutText: "We help every child build a strong foundation for learning and for life.",
    features: [
      { title: "Live progress for parents", text: "Attendance, results and homework are visible to families the same day." },
      { title: "Clear class routines", text: "Students and teachers always know what is next — the timetable builds itself." },
      { title: "Easy fee payment", text: "See dues and pay online or at the office, with receipts for every payment." },
      { title: "Learning materials anywhere", text: "Past papers, slides and recorded classes are one tap away." },
    ],
    showTeachers: true,
    showGallery: true,
    showNotices: true,
  } satisfies HomeSettings,
  admission: {
    open: true,
    closedMessage: "Admissions are currently closed. Please check back soon.",
    intro: "Fill in the form below and our office will contact you.",
  } satisfies AdmissionSettings,
};

// --- teachers on the website -----------------------------------------------

export const websiteTeacherSchema = z.object({
  id: z.string(),
  name: z.string(),
  designation: z.string().nullable(),
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
  showOnWebsite: z.boolean(),
  websiteOrder: z.number().int(),
});
export type WebsiteTeacher = z.infer<typeof websiteTeacherSchema>;

export const updateWebsiteTeacherSchema = z.object({
  designation: text(80).optional(),
  bio: text(500).optional(),
  photoUrl: safeUrl.optional(),
  showOnWebsite: z.boolean().optional(),
  websiteOrder: z.number().int().min(0).max(999).optional(),
});
export type UpdateWebsiteTeacherInput = z.infer<typeof updateWebsiteTeacherSchema>;

// --- gallery ----------------------------------------------------------------

export const galleryImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  caption: z.string().nullable(),
  album: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type GalleryImageDto = z.infer<typeof galleryImageSchema>;

export const createGalleryImageSchema = z.object({
  url: safeUrl.refine((v) => v !== "", "Upload an image first"),
  caption: text(160).optional(),
  album: text(60).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});
export type CreateGalleryImageInput = z.infer<typeof createGalleryImageSchema>;
export const updateGalleryImageSchema = createGalleryImageSchema.partial();

// --- public forms -----------------------------------------------------------

export const contactFormSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10, "Please write a few more words").max(2000),
  /** Honeypot: real people never see or fill this; bots do. Accepted by the schema so the controller can drop it silently. */
  website: z.string().max(200).optional(),
});
export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const admissionFormSchema = z.object({
  studentName: z.string().trim().min(2).max(100),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  appliedClassId: z.string().min(1, "Choose a class"),
  previousSchool: z.string().trim().max(150).optional(),
  guardianName: z.string().trim().min(2).max(100),
  guardianPhone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,18}$/, "Enter a valid phone number"),
  guardianEmail: z.string().trim().toLowerCase().email(),
  address: z.string().trim().max(300).optional(),
  message: z.string().trim().max(1000).optional(),
  website: z.string().max(200).optional(),
});
export type AdmissionFormInput = z.infer<typeof admissionFormSchema>;

export const admissionApplicationDtoSchema = z.object({
  id: z.string(),
  studentName: z.string(),
  dateOfBirth: z.string().nullable(),
  gender: z.string().nullable(),
  appliedClassId: z.string().nullable(),
  appliedClassName: z.string().nullable(),
  previousSchool: z.string().nullable(),
  guardianName: z.string(),
  guardianPhone: z.string(),
  guardianEmail: z.string(),
  address: z.string().nullable(),
  message: z.string().nullable(),
  status: z.enum(["new", "approved", "rejected"]),
  createdAt: z.string(),
});
export type AdmissionApplicationDto = z.infer<typeof admissionApplicationDtoSchema>;

export const rejectApplicationSchema = z.object({ reviewNote: text(300).optional() });

export const contactMessageDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  message: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
});
export type ContactMessageDto = z.infer<typeof contactMessageDtoSchema>;

// --- public site payload ----------------------------------------------------

export interface PublicSite {
  general: GeneralSettings;
  home: HomeSettings;
  admission: AdmissionSettings;
  teachers: Array<{ id: string; name: string; designation: string | null; bio: string | null; photoUrl: string | null }>;
  gallery: Array<{ id: string; url: string; caption: string | null; album: string | null }>;
  notices: Array<{ id: string; title: string; publishedAt: string | null }>;
  events: Array<{ id: string; title: string; startAt: string; location: string | null }>;
  classes: Array<{ id: string; name: string }>;
}
