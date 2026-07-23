/**
 * 複数画像添付UI（useImageList）が管理する1枚分の状態。
 *
 * clientId:
 *   UI上のアイテム識別子。React key、removeItem/moveItemの照合に使う。
 *   アイテム生成時（origin="existing"はtoExistingItem、origin="new"はaddFiles）に
 *   crypto.randomUUID()等で発行し、アイテムのライフサイクル中は不変。
 *
 * imageId:
 *   DB上のImage.id。
 *   origin="existing"の場合は生成時点で既に確定している（DBから読み込んだ画像のため）。
 *   origin="new"の場合はundefinedで始まり、B2アップロード完了 + POST /api/imagesによる
 *   Image作成が成功した時点でセットされる（startUpload成功時にupdateItem経由で反映）。
 *   Todo保存時（toImageIds）はこのフィールドのみを使う。
 *
 * origin:
 *   "existing" - TodoEditModal オープン時にDBから読み込んだ画像。
 *                previewUrl は /api/images/{id}/view（302リダイレクトでB2実URLへ誘導される）。
 *                status は常に "done" 固定（アップロード処理を経由しないため）。
 *                imageId は生成時点で確定済み。
 *   "new"      - addFiles() でユーザーが選択した画像。
 *                previewUrl は URL.createObjectURL(file) によるローカルプレビュー。
 *                アップロードは addFiles() 内で imageUploadService 経由で開始され、
 *                B2アップロードとImage作成（POST /api/images）の両方が完了した時点で
 *                status="done" / imageId が反映される。
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
 *   （サーバー側 syncTodoImages() が配列indexをTodoImage.orderとして解釈する）。
 *
 * status:
 *   "uploading" | "done" | "error" の3値。
 *   addFiles() が item を生成すると同時に同一イベント内でアップロードを開始する設計のため、
 *   「まだ何も始まっていない」状態（idle相当）は観測されない
 *   （origin="new"のitemは生成された瞬間から必ず"uploading"）。
 *   遷移は uploading → done、または uploading → error のいずれかのみ。
 *   status="done"はimageIdが確実にセットされていることを意味する
 *   （B2アップロードとImage作成の両方が成功して初めてdoneになるため）。
 */
export type ImageItem = {
  clientId: string;
  origin: "existing" | "new";
  file: File | null;
  previewUrl: string;
  fileSize: number;
  order: number;
  status: "uploading" | "done" | "error";
  error?: string;
  imageId?: string;
};

// too_many/too_large 以外の判定（MIMEエラー・重複・破損画像等）が将来必要になった場合、
// ここに追記していく想定の拡張ポイント。
export type AddFilesRejectionReason = "too_many" | "too_large";

export type AddFilesResult = { ok: true } | { ok: false; reason: AddFilesRejectionReason };

/**
 * 画像1件分の一覧表示用DTO（Album詳細・未所属一覧で共用）。
 *
 * storageKeyは含めない（B2オブジェクトキーを公開しない方針）。
 * previewUrlも含めない。/api/images/{id}/view というルーティング知識はUI側の責務であり、
 * クライアント側で id から組み立てる。
 *
 * usageCountはTodoImageの件数（そのImageが何件のTodoに紐づいているか）を表す派生値。
 * DBカラムではなくPrismaの_countから算出するため、サービス層でこのDTOへ明示的にマッピングし、
 * Prismaの内部表現（_count.todoImages）をRoute Handler/UIに漏らさない。
 */
export interface ImageSummary {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  usageCount: number;
}