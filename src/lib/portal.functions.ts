/**
 * Public server functions for the vendor portal (/v/$token). No login: the unguessable token is the credential.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.string().regex(/^[a-f0-9]{48}$/, "Invalid link");
const values = z.record(z.string(), z.any());

export const getPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    const { portalState } = await import("./workflow.server");
    return portalState(data.token);
  });

export const savePortalDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token, values }).parse(d))
  .handler(async ({ data }) => {
    const { saveDraft } = await import("./workflow.server");
    return saveDraft(data.token, data.values);
  });

export const createPortalUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token,
        fieldKey: z.string().max(80),
        fileName: z.string().max(255),
        mime: z.string().max(100),
        size: z.number().int().nonnegative(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { createUpload } = await import("./workflow.server");
    return createUpload(data.token, data.fieldKey, data.fileName, data.mime, data.size);
  });

export const submitPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token, values }).parse(d))
  .handler(async ({ data }) => {
    const { submit } = await import("./workflow.server");
    return submit(data.token, data.values);
  });
