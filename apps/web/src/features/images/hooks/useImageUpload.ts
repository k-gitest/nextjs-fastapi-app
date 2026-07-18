import { useCallback, useState } from "react";
import { validateImageFile } from "@/features/images/lib/validate-image";
import type { AttachImageInput } from "@/features/images/schemas";

type UploadState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "uploading"; progress: number }
  | { status: "done"; result: AttachImageInput }
  | { status: "error"; message: string };

/**
 * ファイル選択からB2への直接アップロードまでを担うフック。
 * Todo保存自体はこのフックの責務外（呼び出し側がresultをTodo作成/更新APIに含める）。
 */
export const useImageUpload = () => {
  const [state, setState] = useState<UploadState>({ status: "idle" });

  const upload = useCallback(async (file: File) => {
    setState({ status: "validating" });

    const validation = await validateImageFile(file);
    if (!validation.ok) {
      const message =
        validation.reason === "too_large" ? "ファイルサイズが上限（10MB）を超えています" : "対応していないファイル形式です";
      setState({ status: "error", message });
      return;
    }

    setState({ status: "uploading", progress: 0 });

    try {
      const presignedResponse = await fetch("/api/images/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalFileName: file.name,
          mimeType: validation.mimeType,
          fileSize: file.size,
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error("アップロードURLの取得に失敗しました");
      }

      const { uploadUrl, storageKey } = (await presignedResponse.json()) as {
        uploadUrl: string;
        storageKey: string;
      };

      const putResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": validation.mimeType },
        body: file,
      });

      if (!putResponse.ok) {
        throw new Error("B2へのアップロードに失敗しました");
      }

      setState({
        status: "done",
        result: {
          storageKey,
          originalFileName: file.name,
          mimeType: validation.mimeType,
          fileSize: file.size,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "アップロード中にエラーが発生しました";
      setState({ status: "error", message });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, upload, reset };
};