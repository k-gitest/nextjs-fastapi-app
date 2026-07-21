import { ApiError } from "@/errors/api-error";
import type { ImageSummary } from "@/features/images/types";
import type { CreateImageInput } from "@/features/images/schemas";

// Todoのfetch関数（useTodo.ts）は素のErrorをthrowしているが、Albumで導入した
// ApiError変換パターンを新規コードでは踏襲する（albumApi.tsのTODOコメント参照）。
const toApiError = async (res: Response): Promise<ApiError> => {
  const body = await res.json().catch(() => undefined);
  return new ApiError(res.status, body?.message, body);
};

export const deleteImageFetch = (id: string): Promise<void> =>
  fetch(`/api/images/${id}`, { method: "DELETE" }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
  });

export const getUnassignedImagesFetch = (): Promise<ImageSummary[]> =>
  fetch("/api/images/unassigned").then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

export const createImageFetch = (data: CreateImageInput): Promise<ImageSummary> =>
  fetch("/api/images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });