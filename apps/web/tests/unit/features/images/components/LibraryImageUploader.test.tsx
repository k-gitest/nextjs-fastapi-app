import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import React from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { LibraryImageUploader } from "@/features/images/components/LibraryImageUploader";
import { useImageUpload } from "@/features/images/hooks/useImageUpload";
import { useCreateImage } from "@/features/images/hooks/useCreateImage";
import type { CreateImageInput } from "@/features/images/schemas";
import type { ImageSummary } from "@/features/images/types";
import { ApiError } from "@/errors/api-error";

vi.mock("@/features/images/hooks/useImageUpload", () => ({
  useImageUpload: vi.fn(),
}));

vi.mock("@/features/images/hooks/useCreateImage", () => ({
  useCreateImage: vi.fn(),
}));

const mockedUseImageUpload = vi.mocked(useImageUpload);
const mockedUseCreateImage = vi.mocked(useCreateImage);

const sampleUploadResult: CreateImageInput = {
  storageKey: "key_123",
  originalFileName: "sample.png",
  mimeType: "image/png",
  fileSize: 1234,
};

type CreateImageMutationResult = UseMutationResult<ImageSummary, ApiError, CreateImageInput>;

// UseMutationResultはstatusによるdiscriminated unionのため、
// 実際に構造を満たすオブジェクトをテストごとに組み立てる（as unknown asによる型潰しを避ける）。
const buildIdleMutationResult = (
  overrides: Partial<CreateImageMutationResult> = {},
): CreateImageMutationResult =>
  ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    data: undefined,
    error: null,
    variables: undefined,
    context: undefined,
    failureCount: 0,
    failureReason: null,
    isError: false,
    isIdle: true,
    isPaused: false,
    isPending: false,
    isSuccess: false,
    status: "idle",
    submittedAt: 0,
    ...overrides,
  }) as CreateImageMutationResult;

const buildPendingMutationResult = (
  overrides: Partial<CreateImageMutationResult> = {},
): CreateImageMutationResult =>
  ({
    ...buildIdleMutationResult(),
    isIdle: false,
    isPending: true,
    status: "pending",
    ...overrides,
  }) as CreateImageMutationResult;

const buildErrorMutationResult = (
  error: ApiError,
  overrides: Partial<CreateImageMutationResult> = {},
): CreateImageMutationResult =>
  ({
    ...buildIdleMutationResult(),
    isIdle: false,
    isError: true,
    error,
    status: "error",
    ...overrides,
  }) as CreateImageMutationResult;

describe("LibraryImageUploader", () => {
  const mockUpload = vi.fn();
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseImageUpload.mockReturnValue({
      state: { status: "idle" },
      upload: mockUpload,
      reset: mockReset,
    });
    mockedUseCreateImage.mockReturnValue(buildIdleMutationResult());
  });

  it("ファイルが選択されたとき、uploadが呼び出されること", () => {
    const { container } = render(<LibraryImageUploader />);
    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) throw new Error("File input not found");

    const file = new File(["dummy"], "test.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledWith(file);
  });

  it("アップロードステータスがdoneになったとき、createImageのmutateが呼び出されること", () => {
    const mockMutate = vi.fn();
    mockedUseCreateImage.mockReturnValue(buildIdleMutationResult({ mutate: mockMutate }));

    const { rerender } = render(<LibraryImageUploader />);

    mockedUseImageUpload.mockReturnValue({
      state: { status: "done", result: sampleUploadResult },
      upload: mockUpload,
      reset: mockReset,
    });

    rerender(<LibraryImageUploader />);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      sampleUploadResult,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("mutate成功時、resetが呼ばれinput値がクリアされること", () => {
    const mockMutate = vi.fn();
    mockedUseCreateImage.mockReturnValue(buildIdleMutationResult({ mutate: mockMutate }));

    const { container, rerender } = render(<LibraryImageUploader />);

    mockedUseImageUpload.mockReturnValue({
      state: { status: "done", result: sampleUploadResult },
      upload: mockUpload,
      reset: mockReset,
    });

    rerender(<LibraryImageUploader />);

    const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
    onSuccess();

    expect(mockReset).toHaveBeenCalledTimes(1);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.value).toBe("");
  });

  it("アップロード中はアップロード中メッセージを表示する", () => {
    mockedUseImageUpload.mockReturnValue({
      state: { status: "uploading", progress: 0 },
      upload: mockUpload,
      reset: mockReset,
    });

    render(<LibraryImageUploader />);

    expect(screen.getByText("アップロード中...")).toBeInTheDocument();
  });

  it("アップロードエラー時、エラーメッセージを表示する", () => {
    mockedUseImageUpload.mockReturnValue({
      state: { status: "error", message: "対応していないファイル形式です" },
      upload: mockUpload,
      reset: mockReset,
    });

    render(<LibraryImageUploader />);

    expect(screen.getByText("対応していないファイル形式です")).toBeInTheDocument();
  });

  it("createImage作成中は画像を登録中メッセージを表示する", () => {
    mockedUseCreateImage.mockReturnValue(buildPendingMutationResult());

    render(<LibraryImageUploader />);

    expect(screen.getByText("画像を登録中...")).toBeInTheDocument();
  });

  it("createImage失敗時、エラーメッセージを表示する", () => {
    mockedUseCreateImage.mockReturnValue(
      buildErrorMutationResult(new ApiError(500, "作成に失敗しました")),
    );

    render(<LibraryImageUploader />);

    expect(screen.getByText("作成に失敗しました")).toBeInTheDocument();
  });
});