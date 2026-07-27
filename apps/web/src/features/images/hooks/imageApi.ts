import { toApiError } from "@/errors/api-error";
import type { ImageSummary } from "@/features/images/types";
import type { CreateImageInput } from "@/features/images/schemas";

export const deleteImageFetch = (id: string): Promise<void> =>
  fetch(`/api/images/${id}`, { method: "DELETE" }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
  });

export const getUnassignedImagesFetch = async (): Promise<ImageSummary[]> =>
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