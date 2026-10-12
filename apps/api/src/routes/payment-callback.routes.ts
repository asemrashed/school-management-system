import express, { Router } from "express";
import { asyncHandler } from "../lib/errors";
import * as feesController from "../controllers/fees.controller";

/**
 * Gateway -> server callbacks. Mounted BEFORE the CSRF check and without
 * requireAuth: gateways don't carry our cookies. Safety comes from
 * confirming every payment server-to-server with the gateway.
 */
export const paymentCallbackRouter = Router();
paymentCallbackRouter.post(
  "/sslcommerz",
  express.urlencoded({ extended: false }),
  asyncHandler(feesController.sslcommerzCallback)
);
