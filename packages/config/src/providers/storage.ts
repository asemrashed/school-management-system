import fs from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import type { Env } from "../env";

export interface UploadResult {
  url: string;
  publicId: string;
}

export interface StorageProvider {
  upload(fileBuffer: Buffer, folder: string, filename: string): Promise<UploadResult>;
  delete(publicId: string): Promise<void>;
}

/** Absolute folder used by the `local` provider (and served by the API at /files). */
export const localUploadDir = (env: Pick<Env, "UPLOAD_DIR">) => path.resolve(env.UPLOAD_DIR);

/**
 * Resolves the storage provider from env at boot. Callers depend on
 * StorageProvider only — never on a concrete SDK — so swapping
 * STORAGE_PROVIDER never touches feature code.
 */
export function createStorageProvider(env: Env): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case "cloudinary": {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });

      return {
        async upload(fileBuffer, folder, filename) {
          const publicId = `${folder}/${filename.replace(/\.[^/.]+$/, "")}`;
          const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { public_id: publicId, resource_type: "auto", overwrite: true },
              (error, uploadResult) => {
                if (error || !uploadResult) return reject(error ?? new Error("Cloudinary upload failed"));
                resolve(uploadResult);
              }
            );
            stream.end(fileBuffer);
          });
          return { url: result.secure_url, publicId: result.public_id };
        },
        async delete(publicId) {
          await cloudinary.uploader.destroy(publicId);
        },
      };
    }
    case "local": {
      // For development and single-server installs: no cloud account needed.
      const root = localUploadDir(env);
      const base = env.PUBLIC_API_URL.replace(/\/$/, "");
      // Resolve inside `root` and refuse anything that escapes it.
      const inside = (rel: string) => {
        const abs = path.resolve(root, rel);
        if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error("Invalid storage path");
        return abs;
      };
      return {
        async upload(fileBuffer, folder, filename) {
          const publicId = `${folder}/${filename}`;
          const abs = inside(publicId);
          await fs.mkdir(path.dirname(abs), { recursive: true });
          await fs.writeFile(abs, fileBuffer);
          return { url: `${base}/files/${publicId}`, publicId };
        },
        async delete(publicId) {
          await fs.rm(inside(publicId), { force: true });
        },
      };
    }
    case "s3":
      return {
        async upload(fileBuffer, folder, filename) {
          // Wire up @aws-sdk/client-s3 here using env.S3_*.
          throw new Error("S3 provider not yet wired — add SDK call here.");
        },
        async delete(publicId) {
          throw new Error("S3 provider not yet wired — add SDK call here.");
        },
      };
    case "r2":
      return {
        async upload(fileBuffer, folder, filename) {
          // R2 is S3-compatible — reuse @aws-sdk/client-s3 with R2 endpoint.
          throw new Error("R2 provider not yet wired — add SDK call here.");
        },
        async delete(publicId) {
          throw new Error("R2 provider not yet wired — add SDK call here.");
        },
      };
    default: {
      const _exhaustive: never = env.STORAGE_PROVIDER;
      throw new Error(`Unknown STORAGE_PROVIDER: ${_exhaustive}`);
    }
  }
}
