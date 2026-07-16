"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Album } from "../types";

// shadcn Selectはvalue=""を許可しないため、未選択を表す番兵値を使う
const UNSELECTED_VALUE = "__none__";

interface AlbumSelectorProps {
  albums: Album[];
  value: string | null;
  onChange: (albumId: string | null) => void;
  disabled?: boolean;
}

/**
 * Todo単位でのAlbum選択UI。
 *
 * 設計判断:
 * - 選択したalbumIdは保存時に添付する全Imageへ一括で設定される
 *   （画像ごとに異なるAlbumを選択する機能は今回のスコープ外。将来必要になった場合の拡張とする）
 * - albumId=nullを許可する（Default Album自動生成が未実装のため、
 *   Album未作成ユーザーでも既存の画像添付機能を使えるようにする）
 *
 * Albumが1件も無い場合は選択UI自体を出さず、案内文のみ表示する。
 */
export const AlbumSelector = ({ albums, value, onChange, disabled }: AlbumSelectorProps) => {
  if (albums.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        アルバムがありません（画像はアルバム未所属として保存されます）
      </p>
    );
  }

  return (
    <Select
      value={value ?? UNSELECTED_VALUE}
      onValueChange={(next) => onChange(next === UNSELECTED_VALUE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="アルバムを選択" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSELECTED_VALUE}>未所属</SelectItem>
        {albums.map((album) => (
          <SelectItem key={album.id} value={album.id}>
            {album.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};