export const ALBUM_QUERY_KEY = ["albums"] as const;

export const albumDetailQueryKey = (id: string) => ["albums", id] as const;