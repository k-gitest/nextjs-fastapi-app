"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_IMAGES_PER_TODO,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  type ImageListInput,
} from "@/features/images/schemas";
import { imageUploadService } from "@/features/images/services/imageUploadService";
import type { AddFilesResult, ImageItem } from "@/features/images/types";

// TodoEditModal オープン時の初期化に使う、既存Imageレコードの必要最小限の形。
// Todo側の型（TodoWithImages 等）に依存させず、Imageモデルのうち
// このフックが実際に使うフィールドだけを要求する。
export type ExistingImageSource = {
  id: string;
  fileSize: number;
  order: number;
};

const toExistingItem = (image: ExistingImageSource): ImageItem => ({
  clientId: image.id,
  imageId: image.id,
  origin: "existing",
  file: null,
  previewUrl: `/api/images/${image.id}/view`,
  fileSize: image.fileSize,
  order: image.order,
  status: "done",
});

// order を 0..n-1 で振り直す。並び替え確定タイミング（addFiles/removeItem/moveItem後）で呼ぶ。
const reindexOrder = (items: ImageItem[]): ImageItem[] =>
  items.map((item, index) => (item.order === index ? item : { ...item, order: index }));

/**
 * Todo作成/編集フォームにおける複数画像添付の状態管理フック。
 *
 * - TodoCreateForm: useImageList() を引数なしで呼ぶ（初期状態は空配列）
 * - TodoEditModal: useImageList(todo.images) で既存画像を初期状態に読み込む
 *
 * items配列の管理・アップロードの開始・Snapshot（toImageIds）の生成までを担う。
 * 実際のアップロード処理（presigned URL取得・B2へのPUT・Image作成）自体は
 * imageUploadService に委譲する（UI → hook → service の責務分離を維持するため）。
 *
 * アップロードは addFiles() 内で開始する（Reactのコンポーネントのマウント/effectには
 * 一切依存しない）。そのため ImageUploadSlot は item を表示するだけの受動的な
 * コンポーネントであり、アップロード処理自体は持たない。
 *
 * PR3での変更点:
 *   imageUploadService.upload() が B2 PUT に加えて POST /api/images による
 *   Image作成まで完了させるようになったため、item.imageId は
 *   「B2 PUTだけ済んだ未確定状態」を経由せず、アップロード成功時点で
 *   本物のDB Image.idとして直接セットされる。
 *   item.clientId（UI識別子）と item.imageId（DB識別子）は別フィールドであり、
 *   互いのライフサイクル中に意味が変わることはない。
 */
export const useImageList = (initialImages: ExistingImageSource[] = []) => {
  // NOTE:
  // initialImages は初回マウント時のみ読み込む（useEffectによる同期は行わない）。
  // これは TodoEditModal 側が key={open ? "dialog-open" : "dialog-closed"} によって
  // ダイアログの開閉ごとに配下のツリーを強制的にアンマウント/再マウントする設計を
  // 前提としている（Todoを切り替える際は必ず一度 key が変化し、新しいコンポーネント
  // インスタンスとして生成される）。将来この再マウント保証をやめる場合は、
  // initialImages の変化を useEffect で items へ同期する処理が別途必要になる。
  const [items, setItems] = useState<ImageItem[]>(() =>
    reindexOrder(initialImages.map(toExistingItem)),
  );

  // itemsRef を状態のSource of Truthとして扱う。setItemsのprevコールバックの
  // 実行タイミング（同期/非同期）に依存する代わりに、状態を変更するすべての操作
  // （updateItem/startUpload/addFiles/removeItem/moveItem）が必ずこのapplyItems経由で
  // itemsRef.currentとReact stateの両方を同じタイミングで更新する。
  // これにより、あるコールバック内で行った変更を、直後に呼ばれた別のコールバックが
  // （再レンダーを待たずに）itemsRef.current経由で正しく参照できる。
  const itemsRef = useRef(items);
  const applyItems = useCallback((updater: (prev: ImageItem[]) => ImageItem[]) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    // 関数アップデータで渡すことで、「既に計算済みのnextを採用する」という意図を明示する
    // （Reactが古いstateを使って再計算する余地をなくす）。
    setItems(() => next);
  }, []);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.origin === "new") {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  /**
   * items内の1件を部分更新する内部ヘルパー。startUpload() の成功/失敗コールバックから
   * 呼ばれる（アップロード結果を反映する）。ImageUploadSlotは表示専用コンポーネントであり、
   * これを直接呼ぶことはない（そのため戻り値オブジェクトには含めない）。
   * clientIdで照合する（サーバー確定後もclientId自体は不変のため）。
   */
  const updateItem = useCallback(
    (clientId: string, patch: Partial<ImageItem>) => {
      applyItems((prev) =>
        prev.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)),
      );
    },
    [applyItems],
  );

  /**
   * addFiles() 内でのみ呼ぶ内部専用ヘルパー。fire-and-forget
   * （呼び出し元はこの関数の完了を待たない）。
   * 成功時、imageUploadService.upload() が返す UploadedImage.id を item.imageId に反映し、
   * previewUrl も /api/images/{id}/view へ切り替える（ローカルObjectURLは不要になるためrevoke）。
   * 失敗時は status="error" のみ反映する（B2上に孤立オブジェクトが残る可能性があるが、
   * 既存のPresigned Upload孤立オブジェクト戦略に委ねる。新規の補償処理はここでは行わない）。
   *
   * TODO: アップロード中に removeItem() で削除された場合、通信自体は最後まで継続する
   * （updateItemの対象が見つからず単に無視されるだけで、動作は壊れない）。
   * Album実装時、無駄な通信を早期に打ち切りたくなった場合は AbortController の導入を検討する。
   */
  const startUpload = useCallback(
    (item: ImageItem) => {
      if (!item.file) {
        return;
      }
      const localPreviewUrl = item.previewUrl;
      void imageUploadService
        .upload(item.file)
        .then((uploaded) => {
          updateItem(item.clientId, {
            status: "done",
            imageId: uploaded.id,
            previewUrl: `/api/images/${uploaded.id}/view`,
            error: undefined,
          });
          URL.revokeObjectURL(localPreviewUrl);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "アップロードに失敗しました";
          updateItem(item.clientId, { status: "error", error: message });
        });
    },
    [updateItem],
  );

  /**
   * ファイル選択（<input type="file" multiple> の onChange 等）で呼ぶ。
   * 「既存 + 現在のitems + 今回追加分」の合計で枚数・合計サイズを検証し、
   * 上限を超える場合は今回追加分をまるごと拒否する（部分的な追加は行わない）。
   * 検証OKの場合、item生成と同一イベント内でアップロードを開始する
   * （status="uploading"で生成し、idleを経由しない）。
   *
   * 個々のファイルのMIME種別・単体サイズ検証（マジックバイト判定）はここでは行わない。
   * それは imageUploadService（内部で validateImageFile を呼ぶ）の責務であり、
   * このフックが呼ばれる時点ではまだ判定できない（非同期のファイル読み込みが必要なため）。
   */
  const addFiles = useCallback(
    (files: File[]): AddFilesResult => {
      if (files.length === 0) {
        return { ok: true };
      }

      // itemsRef.current は applyItems によって常に最新化されているため、
      // 直前の removeItem/moveItem 等の結果を再レンダーを待たずに正しく参照できる。
      const currentItems = itemsRef.current;
      const currentCount = currentItems.length;
      const currentSize = currentItems.reduce((sum, item) => sum + item.fileSize, 0);
      const incomingSize = files.reduce((sum, file) => sum + file.size, 0);

      if (currentCount + files.length > MAX_IMAGES_PER_TODO) {
        return { ok: false, reason: "too_many" };
      }
      if (currentSize + incomingSize > MAX_TOTAL_IMAGE_SIZE_BYTES) {
        return { ok: false, reason: "too_large" };
      }

      const newItems: ImageItem[] = files.map((file) => ({
        clientId: crypto.randomUUID(),
        origin: "new",
        file,
        previewUrl: URL.createObjectURL(file),
        fileSize: file.size,
        order: 0, // reindexOrderで振り直すため暫定値
        status: "uploading",
      }));

      applyItems((prev) => reindexOrder([...prev, ...newItems]));
      newItems.forEach(startUpload);

      return { ok: true };
    },
    [applyItems, startUpload],
  );

  /**
   * ローカル状態から削除するのみ。B2削除は行わない。
   * Imageは既に独立作成済みのため、Todoから外してもImage本体・B2は削除されない
   * （Todo保存時のsyncTodoImagesがTodoImageの関連解除のみ行う設計に合わせている）。
   */
  const removeItem = useCallback(
    (clientId: string) => {
      applyItems((prev) => {
        const target = prev.find((item) => item.clientId === clientId);
        if (target?.origin === "new") {
          URL.revokeObjectURL(target.previewUrl);
        }
        return reindexOrder(prev.filter((item) => item.clientId !== clientId));
      });
    },
    [applyItems],
  );

  /**
   * DnDでの並び替え確定時に呼ぶ。fromIndex の要素を toIndex の位置へ移動し、
   * order を振り直す。
   */
  const moveItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      applyItems((prev) => {
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex >= prev.length
        ) {
          return prev;
        }
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return reindexOrder(next);
      });
    },
    [applyItems],
  );

  /**
   * 保存可否判定。1件でも uploading / error の状態が残っている場合は保存不可。
   * （空配列＝画像0枚は許可。全削除して保存するケースがあるため）
   * status === "done" であれば imageId は必ずセットされている不変条件を前提とする
   * （startUploadの成功コールバックがstatusとimageIdを同時に設定するため）。
   */
  const canSave = useMemo(
    () => items.every((item) => item.status === "done"),
    [items],
  );

  const isUploading = useMemo(
    () => items.some((item) => item.status === "uploading"),
    [items],
  );

  const hasError = useMemo(() => items.some((item) => item.status === "error"), [items]);

  /**
   * Todo保存API用。imageId の配列を order 順に生成する。
   * canSave が true であることを呼び出し側が保証している前提（ボタンのdisabled制御等）。
   * imageId が欠けている場合はInvariant違反として例外にする（開発時の不変条件チェック）。
   */
  const toImageIds = useCallback((): ImageListInput => {
    return items.map((item) => {
      if (!item.imageId) {
        throw new Error("未アップロードの画像が含まれています");
      }
      return item.imageId;
    });
  }, [items]);

  return {
    items,
    addFiles,
    removeItem,
    moveItem,
    canSave,
    isUploading,
    hasError,
    toImageIds,
  };
};