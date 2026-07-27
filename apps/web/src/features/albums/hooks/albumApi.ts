import { toApiError } from "@/errors/api-error";
import type { Album, AlbumDetail } from "../types";

type CreateAlbumReq = { name: string };
type UpdateAlbumReq = { id: string; name: string };

// Route Handlerのエラーレスポンス（{ message, data }）をApiErrorへ変換する。
// これにより error-handler.ts の isConflictError 等の判定がAlbumでも機能する。
//
// toApiErrorは@/errors/api-errorへ共通化済み（features/todos/hooks/todoApi.tsの新設で
// 3箇所目の重複に達したため）。この関数自体はもう定義しない。

export const fetchAlbums = (): Promise<Album[]> =>
  fetch("/api/albums").then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

export const fetchAlbumDetail = (id: string): Promise<AlbumDetail> =>
  fetch(`/api/albums/${id}`).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

export const createAlbumFetch = (data: CreateAlbumReq): Promise<Album> =>
  fetch("/api/albums", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

export const updateAlbumFetch = ({ id, ...data }: UpdateAlbumReq): Promise<Album> =>
  fetch(`/api/albums/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
    return res.json();
  });

export const deleteAlbumFetch = (id: string): Promise<void> =>
  fetch(`/api/albums/${id}`, { method: "DELETE" }).then(async (res) => {
    if (!res.ok) throw await toApiError(res);
  });