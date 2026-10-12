import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import * as setup from "../controllers/setup.controller";

/** Academic structure CRUD. Reads and writes are admin-tier only; teachers and
 * others use the scoped /lookup endpoints for dropdowns instead. */
export const setupRouter = Router();

setupRouter.use(requireAuth, requireRole("super_admin", "admin", "coordinator"));

const crud = (path: string, h: { list: any; create: any; update?: any; remove: any }) => {
  setupRouter.get(path, asyncHandler(h.list));
  setupRouter.post(path, asyncHandler(h.create));
  if (h.update) setupRouter.patch(`${path}/:id`, asyncHandler(h.update));
  setupRouter.delete(`${path}/:id`, asyncHandler(h.remove));
};

crud("/shifts", { list: setup.listShifts, create: setup.createShift, update: setup.updateShift, remove: setup.deleteShift });
crud("/classes", { list: setup.listClasses, create: setup.createClass, update: setup.updateClass, remove: setup.deleteClass });
crud("/sections", { list: setup.listSections, create: setup.createSection, update: setup.updateSection, remove: setup.deleteSection });
crud("/buildings", { list: setup.listBuildings, create: setup.createBuilding, update: setup.updateBuilding, remove: setup.deleteBuilding });
crud("/rooms", { list: setup.listRooms, create: setup.createRoom, update: setup.updateRoom, remove: setup.deleteRoom });
crud("/periods", { list: setup.listPeriods, create: setup.createPeriod, update: setup.updatePeriod, remove: setup.deletePeriod });

setupRouter.get("/academic-years", asyncHandler(setup.listAcademicYears));
setupRouter.post("/academic-years", asyncHandler(setup.createAcademicYear));
setupRouter.post("/academic-years/:id/current", asyncHandler(setup.setCurrentAcademicYear));
setupRouter.delete("/academic-years/:id", asyncHandler(setup.deleteAcademicYear));
