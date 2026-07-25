import { ApiError } from "@/errors/api-error";
import type { Album, AlbumDetail } from "../types";

type CreateAlbumReq = { name: string };
type UpdateAlbumReq = { id: string; name: string };

// Route Handlerのエラーレスポンス（{ message, data }）をApiErrorへ変換する。
// これにより error-handler.ts の isConflictError 等の判定がAlbumでも機能する。
//
// TODO: 現状 features/todos 側のfetch関数（useTodo.ts）は素のErrorをthrowしており、
// ApiErrorへの変換を行っていない。これはAlbumだけの例外実装ではなく、Albumを新標準として
// 採用し、Todo側も将来的に同じApiError変換へ統一する前提とする（別Issueで追従予定）。
const toApiError = async (res: Response): Promise<ApiError> => {
  const body = await res.json().catch(() => undefined);
  return new ApiError(res.status, body?.message, body);
};

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