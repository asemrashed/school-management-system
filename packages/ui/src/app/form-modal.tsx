"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTrigger } from "../components/dialog";

export function FormModal({
  trigger,
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent title={title} description={description}>
        {children}
      </DialogContent>
    </Dialog>
  );
}
