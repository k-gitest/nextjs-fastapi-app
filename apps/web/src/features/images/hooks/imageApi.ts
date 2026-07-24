import { ApiError } from "@/errors/api-error";
import type { ImageSummary } from "@/features/images/types";
import type { CreateImageInput } from "@/features/images/schemas";
import { resolveApiUrl } from "@/lib/api-url";

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

export const getUnassignedImagesFetch = async (): Promise<ImageSummary[]> => {
  const url = resolveApiUrl("/api/images/unassigned");

  const res = await fetch(url);

  console.log("SSR API DEBUG", {
    url,
    status: res.status,
    statusText: res.statusText,
    contentType: res.headers.get("content-type"),
  });

  const text = await res.text();

  console.log("SSR API BODY", text.slice(0, 500));

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  return JSON.parse(text);
};

export const createImageFetch = (data: CreateImageInput): Promise<ImageSummary> =>
  fetch("/api/images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

// Imageの所属Album変更（PATCH /api/images/[id]）。
// albumId: string = 指定Albumへ所属 / null = 未所属へ戻す。
// 今回のUI（未所属一覧）ではalbumIdが常にstring（Albumへの割り当てのみ）だが、
// Album詳細画面からの「別Albumへ移動」「未所属へ戻す」も同じ関数で扱えるよう
// 汎用シグネチャにしておく。
export const updateImageAlbumFetch = ({
  imageId,
  albumId,
}: {
  imageId: string;
  albumId: string | null;
}): Promise<ImageSummary> =>
  fetch(`/api/images/${imageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ albumId }),
  }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });