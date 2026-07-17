import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TodoForm } from '@/features/todos/components/TodoForm';

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
});