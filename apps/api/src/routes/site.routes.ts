import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as site from "../controllers/site.controller";

/** Website administration. Settings, teachers and gallery: Super Admin / Admin.
 * Admissions inbox is also open to the coordinator who runs admissions. */
export const siteRouter = Router();
siteRouter.use(requireAuth);

const owners = requireRole("super_admin", "admin");
const office = requireRole("super_admin", "admin", "coordinator");

siteRouter.get("/settings", owners, asyncHandler(site.getAllSettings));
siteRouter.put("/settings/:key", owners, asyncHandler(site.putSetting));

siteRouter.get("/teachers", owners, asyncHandler(site.listWebsiteTeachers));
siteRouter.patch("/teachers/:id", owners, asyncHandler(site.updateWebsiteTeacher));

siteRouter.get("/gallery", owners, asyncHandler(site.listGallery));
siteRouter.post("/gallery", owners, asyncHandler(site.createGalleryImage));
siteRouter.patch("/gallery/:id", owners, asyncHandler(site.updateGalleryImage));
siteRouter.delete("/gallery/:id", owners, asyncHandler(site.deleteGalleryImage));

siteRouter.get("/contact-messages", owners, asyncHandler(site.listContactMessages));
siteRouter.post("/contact-messages/:id/read", owners, asyncHandler(site.markContactRead));

siteRouter.get("/applications", office, asyncHandler(site.listApplications));
siteRouter.post("/applications/:id/reject", office, asyncHandler(site.rejectApplication));
