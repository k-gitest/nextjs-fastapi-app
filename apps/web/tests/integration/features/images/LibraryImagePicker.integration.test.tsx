import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { LibraryImagePicker } from "@/features/images/components/LibraryImagePicker";
import { renderWithQueryClient } from "@tests/test-utils/vitest-util";
import { server } from "@tests/mocks/server";
import type { ImageSummary, AddFilesResult } from "@/features/images/types";
import type { AlbumImageItem } from "@/features/albums/types";
import type { AlbumDetail } from "@/features/albums/types";

const mockUnassignedImages: ImageSummary[] = [
  {
    id: "img-1",
    originalFileName: "photo1.png",
    mimeType: "image/png",
    fileSize: 1000,
    createdAt: new Date("2026-06-01"),
    usageCount: 0,
  },
  {
    id: "img-2",
    originalFileName: "photo2.png",
    mimeType: "image/png",
    fileSize: 2000,
    createdAt: new Date("2026-06-02"),
    usageCount: 0,
  },
];

describe("LibraryImagePicker", () => {
  const mockOnAdd = vi.fn<(images: ImageSummary[]) => AddFilesResult>();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAdd.mockReturnValue({ ok: true });
  });

  const openPicker = async (attachedImageIds: Set<string> = new Set()) => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <LibraryImagePicker attachedImageIds={attachedImageIds} onAdd={mockOnAdd} />,
    );
    await user.click(
      await screen.findByRole("button", { name: "ライブラリから選択" }),
    );
    expect(
      await screen.findByText("ライブラリから画像を選択"),
    ).toBeInTheDocument();
    return user;
  };

  it("トリガーボタンが表示されること", async () => {
    renderWithQueryClient(
      <LibraryImagePicker attachedImageIds={new Set()} onAdd={mockOnAdd} />,
    );
    expect(
      await screen.findByRole("button", { name: "ライブラリから選択" }),
    ).toBeInTheDocument();
  });

  it("disabledのとき、トリガーボタンがdisabledになること", async () => {
    renderWithQueryClient(
      <LibraryImagePicker attachedImageIds={new Set()} onAdd={mockOnAdd} disabled />,
    );
    expect(
      await screen.findByRole("button", { name: "ライブラリから選択" }),
    ).toBeDisabled();
  });

  it("開くと未所属タブがデフォルトで表示され、未所属画像一覧が表示されること", async () => {
    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
    );

    await openPicker();

    expect(
      await screen.findByRole("checkbox", { name: "photo1.pngを選択" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "photo2.pngを選択" }),
    ).toBeInTheDocument();
  });

  it("画像を選択すると、追加ボタンに件数が反映されること", async () => {
    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
    );

    const user = await openPicker();
    await user.click(
      await screen.findByRole("checkbox", { name: "photo1.pngを選択" }),
    );

    expect(
      await screen.findByRole("button", { name: "追加（1件）" }),
    ).toBeInTheDocument();
  });

  it("選択なしでは追加ボタンがdisabledになること", async () => {
    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
    );

    await openPicker();

    expect(await screen.findByRole("button", { name: "追加" })).toBeDisabled();
  });

  it("画像を選択して追加すると、選択したImageSummary[]でonAddが呼ばれ、成功時はダイアログが閉じること", async () => {
    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
    );

    const user = await openPicker();
    await user.click(
      await screen.findByRole("checkbox", { name: "photo1.pngを選択" }),
    );
    await user.click(await screen.findByRole("button", { name: "追加（1件）" }));

    expect(mockOnAdd).toHaveBeenCalledTimes(1);
    expect(mockOnAdd).toHaveBeenCalledWith([
      expect.objectContaining({ id: "img-1" }),
    ]);

    await waitFor(() => {
      expect(
        screen.queryByText("ライブラリから画像を選択"),
      ).not.toBeInTheDocument();
    });
  });

  it("onAddがok:falseを返すと、対応するエラーメッセージが表示され、ダイアログは閉じないこと", async () => {
    mockOnAdd.mockReturnValue({ ok: false, reason: "too_many" });
    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
    );

    const user = await openPicker();
    await user.click(
      await screen.findByRole("checkbox", { name: "photo1.pngを選択" }),
    );
    await user.click(await screen.findByRole("button", { name: "追加（1件）" }));

    expect(
      await screen.findByText(/添付できる画像は最大\d+枚です/),
    ).toBeInTheDocument();
    expect(screen.getByText("ライブラリから画像を選択")).toBeInTheDocument();
  });

  it("onAddがtoo_largeを返すと、合計サイズ超過のエラーメッセージが表示されること", async () => {
    mockOnAdd.mockReturnValue({ ok: false, reason: "too_large" });
    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
    );

    const user = await openPicker();
    await user.click(
      await screen.findByRole("checkbox", { name: "photo1.pngを選択" }),
    );
    await user.click(await screen.findByRole("button", { name: "追加（1件）" }));

    expect(
      await screen.findByText("画像の合計サイズが上限を超えています"),
    ).toBeInTheDocument();
  });

  it("attachedImageIdsに含まれる画像は「追加済み」と表示され、選択できないこと", async () => {
    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
    );

    const user = await openPicker(new Set(["img-1"]));

    const attachedCheckbox = await screen.findByRole("checkbox", {
      name: "photo1.pngは追加済みです",
    });
    expect(attachedCheckbox).toHaveAttribute("aria-disabled", "true");

    await user.click(attachedCheckbox);
    // 追加済みはトグル対象外のため、追加ボタンは0件のまま(disabled)
    expect(screen.getByRole("button", { name: "追加" })).toBeDisabled();
  });

  it("Albumタブに切り替えると、そのAlbumの画像一覧が表示されること", async () => {
    const mockAlbumImages: AlbumImageItem[] = [
      {
        id: "img-3",
        originalFileName: "summer.png",
        mimeType: "image/png",
        fileSize: 1500,
        createdAt: new Date("2026-06-03"),
        usageCount: 0,
        albumDisplayOrder: 0,
      },
    ];
    const mockAlbumDetail: AlbumDetail = {
      id: "album-1",
      name: "夏休み",
      userId: "user-1",
      createdAt: new Date("2026-05-01"),
      updatedAt: new Date("2026-05-01"),
      images: mockAlbumImages,
    } as AlbumDetail;

    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
      http.get("*/api/albums", () =>
        HttpResponse.json([
          {
            id: "album-1",
            name: "夏休み",
            userId: "user-1",
            createdAt: new Date("2026-05-01"),
            updatedAt: new Date("2026-05-01"),
          },
        ]),
      ),
      http.get("*/api/albums/:id", () => HttpResponse.json(mockAlbumDetail)),
    );

    const user = await openPicker();

    await user.click(await screen.findByRole("button", { name: "夏休み" }));

    expect(
      await screen.findByRole("checkbox", { name: "summer.pngを選択" }),
    ).toBeInTheDocument();
    // タブ切り替え後は未所属タブの画像は表示されない
    expect(
      screen.queryByRole("checkbox", { name: "photo1.pngを選択" }),
    ).not.toBeInTheDocument();
  });

  it("タブを跨いで選択した画像が、追加確定時に両方ともonAddへ渡されること", async () => {
    const mockAlbumImages: AlbumImageItem[] = [
      {
        id: "img-3",
        originalFileName: "summer.png",
        mimeType: "image/png",
        fileSize: 1500,
        createdAt: new Date("2026-06-03"),
        usageCount: 0,
        albumDisplayOrder: 0,
      },
    ];
    const mockAlbumDetail: AlbumDetail = {
      id: "album-1",
      name: "夏休み",
      userId: "user-1",
      createdAt: new Date("2026-05-01"),
      updatedAt: new Date("2026-05-01"),
      images: mockAlbumImages,
    } as AlbumDetail;

    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
      http.get("*/api/albums", () =>
        HttpResponse.json([
          {
            id: "album-1",
            name: "夏休み",
            userId: "user-1",
            createdAt: new Date("2026-05-01"),
            updatedAt: new Date("2026-05-01"),
          },
        ]),
      ),
      http.get("*/api/albums/:id", () => HttpResponse.json(mockAlbumDetail)),
    );

    const user = await openPicker();

    // 未所属タブでphoto1を選択
    await user.click(
      await screen.findByRole("checkbox", { name: "photo1.pngを選択" }),
    );

    // Albumタブへ切り替えてsummerを選択（選択状態はタブを跨いで保持される想定）
    await user.click(await screen.findByRole("button", { name: "夏休み" }));
    await user.click(
      await screen.findByRole("checkbox", { name: "summer.pngを選択" }),
    );

    expect(
      await screen.findByRole("button", { name: "追加（2件）" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "追加（2件）" }));

    expect(mockOnAdd).toHaveBeenCalledWith([
      expect.objectContaining({ id: "img-1" }),
      expect.objectContaining({ id: "img-3" }),
    ]);
  });

  it("キャンセルをクリックすると、onAddが呼ばれずダイアログが閉じること", async () => {
    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
    );

    const user = await openPicker();
    await user.click(
      await screen.findByRole("checkbox", { name: "photo1.pngを選択" }),
    );
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(mockOnAdd).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByText("ライブラリから画像を選択"),
      ).not.toBeInTheDocument();
    });
  });

  it("ダイアログを閉じて再度開くと、選択状態がリセットされていること", async () => {
    server.use(
      http.get("*/api/images/unassigned", () =>
        HttpResponse.json(mockUnassignedImages),
      ),
    );

    const user = await openPicker();
    await user.click(
      await screen.findByRole("checkbox", { name: "photo1.pngを選択" }),
    );
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    await waitFor(() => {
      expect(
        screen.queryByText("ライブラリから画像を選択"),
      ).not.toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "ライブラリから選択" }),
    );
    expect(
      await screen.findByText("ライブラリから画像を選択"),
    ).toBeInTheDocument();

    expect(await screen.findByRole("button", { name: "追加" })).toBeDisabled();
  });
});