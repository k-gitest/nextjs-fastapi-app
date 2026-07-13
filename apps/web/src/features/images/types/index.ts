import type { AttachImageInput } from "@/features/images/schemas";

/**
 * 複数画像添付UI（useImageList）が管理する1枚分の状態。
 *
 * origin:
 *   "existing" - TodoEditModal オープン時にDBから読み込んだ画像。
 *                previewUrl は `/api/images/{id}/view`（302リダイレクトでB2実URLへ誘導される）。
 *                status は常に "done" 固定（アップロード処理を経由しないため）。
 *   "new"      - addFiles() でユーザーが選択した画像。
 *                previewUrl は URL.createObjectURL(file) によるローカルプレビュー。
 *                アップロードは addFiles() 内で imageUploadService 経由で開始され、
 *                完了/失敗時に status / attachImage / error が更新される。
 *                ImageUploadSlot はこの item を表示するだけの受動的なコンポーネントであり、
 *                アップロード処理自体は一切持たない。
 *
 * fileSize:
 *   addFiles() 時点で確定させる（origin="new"は file.size、origin="existing"はImage.fileSize）。
 *   useImageList の合計サイズ検証（既存+新規）に使う。
 *
 * order:
 *   UI上の表示順を保持するための値。並び替え完了時（DnDのdrop確定時など）に
 *   0..n-1 で再採番する。ドラッグ中など操作の途中経過では items 配列の見た目の並びと
 *   一時的にズレることを許容する（確定タイミングでのみ整合させればよい）。
 *   ImageListInput へ変換する際は、この順序でソートした配列をそのまま送る
 *   （サーバー側 applyImageChange() が配列indexをorderとして解釈するため、
 *    ImageSlotInput自体にはorderフィールドは存在しない）。
 *
 * status:
 *   "uploading" | "done" | "error" の3値。
 *   addFiles() が item を生成すると同時に同一イベント内でアップロードを開始する設計のため、
 *   「まだ何も始まっていない」状態（idle相当）は観測されない
 *   （origin="new"のitemは生成された瞬間から必ず"uploading"）。
 *   遷移は uploading → done、または uploading → error のいずれかのみ。
 *
 * attachImage:
 *   origin="new" かつ status="done" のときのみセットされる、アップロード確定済みメタデータ
 *   （storageKey / originalFileName / mimeType / fileSize の4点セット）。
 *   toImageListInput() / toCreateImageListInput() で kind:"new" の
 *   ImageSlotInput.data にそのまま使う。
 *
 * NOTE: storageKey を独立フィールドとして持たない。
 *   origin="existing" は送信時に id のみで足りる（{ kind: "existing", id }）。
 *   origin="new" は attachImage.storageKey を唯一の情報源とする。
 *   両方に別々の storageKey を持たせると更新漏れによる不整合の温床になるため、
 *   意図的に単一の情報源（attachImage）へ寄せている。
 */
export type ImageItem = {
  id: string;
  origin: "existing" | "new";
  file: File | null;
  previewUrl: string;
  fileSize: number;
  order: number;
  status: "uploading" | "done" | "error";
  error?: string;
  attachImage?: AttachImageInput;
};

// too_many/too_large 以外の判定（MIMEエラー・重複・破損画像等）が将来必要になった場合、
// ここに追記していく想定の拡張ポイント。
export type AddFilesRejectionReason = "too_many" | "too_large";

export type AddFilesResult = { ok: true } | { ok: false; reason: AddFilesRejectionReason };