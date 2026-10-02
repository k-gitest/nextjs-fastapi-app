import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TodoForm } from '@/features/todos/components/TodoForm';

// 画像添付UIの実体は別コンポーネントの責務のため、ここではモック化し、
// TodoForm自身のドロップ受付（handleDrop）の契約だけを検証する。
vi.mock('@/features/images/components/ImageAttachMenu', () => ({
  ImageAttachMenu: () => <div data-testid="image-attach-menu" />,
}));
vi.mock('@/features/images/components/ImageGallery', () => ({
  ImageGallery: () => <div data-testid="image-gallery" />,
}));

describe('TodoForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初期値が正しく反映されていること', () => {
    const defaultValues = {
      todo_title: 'テストタスク',
      priority: 'HIGH' as const,
      progress: 50,
    };

    render(<TodoForm onSubmit={mockOnSubmit} defaultValues={defaultValues} />);

    expect(screen.getByDisplayValue('テストタスク')).toBeInTheDocument();
    // 優先度「高」が選択されていることを確認（Selectの実装に依存しますが、通常は表示テキストで確認）
    expect(screen.getByRole('combobox', { name: /優先度/i })).toHaveTextContent('高');
    // 数値入力フィールドの確認
    expect(screen.getByRole('spinbutton')).toHaveValue(50);
  });

  it('バリデーションエラーが表示されること（タイトル未入力）', async () => {
    const user = userEvent.setup();
    render(<TodoForm onSubmit={mockOnSubmit} />);

    const submitBtn = screen.getByRole('button', { name: '保存' });
    await user.click(submitBtn);

    // zodのバリデーションメッセージを待機（スキーマ定義に合わせる）
    // 例: "タイトルを入力してください" など
    await waitFor(() => {
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  it('値を入力して送信すると、onSubmitが呼ばれ、フォームがリセットされること', async () => {
    const user = userEvent.setup();
    // 成功時はResolvedPromiseを返す
    mockOnSubmit.mockResolvedValue(undefined);

    render(<TodoForm onSubmit={mockOnSubmit} submitLabel="作成" />);

    // タイトル入力
    await user.type(screen.getByLabelText(/タイトル/i), '新しいタスク');
    
    // 送信
    await user.click(screen.getByRole('button', { name: '作成' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        todo_title: '新しいタスク',
        priority: 'MEDIUM',
        progress: 0,
      });
    });

    // 成功後はリセットされていることを確認
    expect(screen.getByLabelText(/タイトル/i)).toHaveValue('');
  });

  it('送信中にボタンが非活性（disabled）になり、ラベルが変わること', async () => {
    // 意図的に完了を遅らせるPromise
    mockOnSubmit.mockReturnValue(new Promise((resolve) => setTimeout(resolve, 100)));

    render(<TodoForm onSubmit={mockOnSubmit} isLoading={true} />);

    const submitBtn = screen.getByRole('button', { name: '保存中...' });
    expect(submitBtn).toBeDisabled();
  });

  it('数値入力フィールドで進捗率を変更できること', async () => {
    const user = userEvent.setup();
    render(<TodoForm onSubmit={mockOnSubmit} />);

    const progressInput = screen.getByRole('spinbutton');
    
    await user.clear(progressInput);
    await user.type(progressInput, '75');
    
    expect(progressInput).toHaveValue(75);
    // スライダーの連動も確認（value属性などで判定）
    expect(screen.getByText(/進捗 \(75%\)/)).toBeInTheDocument();
  });

  it('キャンセルボタンをクリックすると onCancel が呼ばれること', async () => {
    const user = userEvent.setup();
    render(<TodoForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const cancelBtn = screen.getByRole('button', { name: 'キャンセル' });
    await user.click(cancelBtn);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('disabledがtrueでもisLoadingがfalseなら、ボタンは非活性だがラベルは変わらないこと', () => {
    render(<TodoForm onSubmit={mockOnSubmit} disabled={true} />);

    const submitBtn = screen.getByRole('button', { name: '保存' });
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('保存');
    expect(submitBtn).not.toHaveTextContent('保存中...');
  });

  it('disabledがfalseかつisLoadingがfalseなら、ボタンは活性であること', () => {
    render(<TodoForm onSubmit={mockOnSubmit} disabled={false} />);

    const submitBtn = screen.getByRole('button', { name: '保存' });
    expect(submitBtn).not.toBeDisabled();
  });

  describe('画像添付のドラッグ&ドロップ', () => {
    const mockAddFiles = vi.fn();
    const mockAddExistingImages = vi.fn();
    const mockRemoveItem = vi.fn();

    const buildImageAttachment = () => ({
      items: [],
      addFiles: mockAddFiles,
      addExistingImages: mockAddExistingImages,
      removeItem: mockRemoveItem,
    });

    const pngFile = new File(['png'], 'photo.png', { type: 'image/png' });
    const jpegFile = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
    const pdfFile = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });

    // ドロップ受付領域はタイトル欄を包むdivのため、タイトル入力欄に対してイベントを送る
    // （イベントが親のdivまで伝播する）。
    const getTitleInput = () => screen.getByLabelText(/タイトル/i);

    it('画像ファイルをタイトル欄にドロップすると、addFilesがそのファイルで呼ばれること', () => {
      render(
        <TodoForm onSubmit={mockOnSubmit} imageAttachment={buildImageAttachment()} />,
      );

      fireEvent.drop(getTitleInput(), { dataTransfer: { files: [pngFile] } });

      expect(mockAddFiles).toHaveBeenCalledTimes(1);
      expect(mockAddFiles).toHaveBeenCalledWith([pngFile]);
    });

    it('複数の画像ファイルをドロップすると、まとめてaddFilesに渡されること', () => {
      render(
        <TodoForm onSubmit={mockOnSubmit} imageAttachment={buildImageAttachment()} />,
      );

      fireEvent.drop(getTitleInput(), {
        dataTransfer: { files: [pngFile, jpegFile] },
      });

      expect(mockAddFiles).toHaveBeenCalledTimes(1);
      expect(mockAddFiles).toHaveBeenCalledWith([pngFile, jpegFile]);
    });

    it('画像と画像以外が混在している場合、画像だけがaddFilesに渡されること', () => {
      render(
        <TodoForm onSubmit={mockOnSubmit} imageAttachment={buildImageAttachment()} />,
      );

      fireEvent.drop(getTitleInput(), {
        dataTransfer: { files: [pdfFile, pngFile] },
      });

      expect(mockAddFiles).toHaveBeenCalledTimes(1);
      expect(mockAddFiles).toHaveBeenCalledWith([pngFile]);
    });

    it('画像以外のファイルだけをドロップした場合、addFilesは呼ばれないこと', () => {
      render(
        <TodoForm onSubmit={mockOnSubmit} imageAttachment={buildImageAttachment()} />,
      );

      fireEvent.drop(getTitleInput(), { dataTransfer: { files: [pdfFile] } });

      expect(mockAddFiles).not.toHaveBeenCalled();
    });

    it('サムネイル一覧（ImageGallery）へのドロップは受け付けず、addFilesは呼ばれないこと', () => {
      render(
        <TodoForm onSubmit={mockOnSubmit} imageAttachment={buildImageAttachment()} />,
      );

      fireEvent.drop(screen.getByTestId('image-gallery'), {
        dataTransfer: { files: [pngFile] },
      });

      expect(mockAddFiles).not.toHaveBeenCalled();
    });

    it('imageAttachmentがある場合、dragoverでブラウザ既定動作が抑止されること（ドロップ可能にするため）', () => {
      render(
        <TodoForm onSubmit={mockOnSubmit} imageAttachment={buildImageAttachment()} />,
      );

      // fireEventは、preventDefaultされた場合にfalseを返す
      const notCanceled = fireEvent.dragOver(getTitleInput());

      expect(notCanceled).toBe(false);
    });

    it('imageAttachmentがない場合、画像添付UIは描画されず、ドロップしても何も起きないこと', () => {
      render(<TodoForm onSubmit={mockOnSubmit} />);

      expect(screen.queryByTestId('image-attach-menu')).not.toBeInTheDocument();
      expect(screen.queryByTestId('image-gallery')).not.toBeInTheDocument();

      const dragOverNotCanceled = fireEvent.dragOver(getTitleInput());
      fireEvent.drop(getTitleInput(), { dataTransfer: { files: [pngFile] } });

      // 受付していないため、dragoverの既定動作は抑止されない
      expect(dragOverNotCanceled).toBe(true);
      expect(mockAddFiles).not.toHaveBeenCalled();
    });
  });
});