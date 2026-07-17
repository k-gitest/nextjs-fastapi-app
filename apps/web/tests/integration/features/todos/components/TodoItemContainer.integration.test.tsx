import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { TodoItemContainer } from '@/features/todos/components/TodoItemContainer';
import { useTodo } from '@/features/todos/hooks/useTodo';
import { useExclusiveModal, useUIStore } from '@/hooks/useExclusiveModal';
import type { Todo } from '@/features/todos/types';

// 各フックをモック化
vi.mock('@/features/todos/hooks/useTodo');
vi.mock('@/hooks/useExclusiveModal');

describe('TodoItemContainer', () => {
  const mockTodo: Todo = {
    id: 'todo-1', 
    todo_title: 'コンテナテストタスク',
    priority: 'MEDIUM',
    progress: 50,
    userId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // モック関数の定義
  const mockUpdateTodo = vi.fn();
  const mockDeleteTodo = vi.fn();
  const mockOpen = vi.fn();
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // useTodo の戻り値を型安全に設定
    (useTodo as Mock).mockReturnValue({
      updateTodo: mockUpdateTodo,
      deleteTodo: mockDeleteTodo,
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });

    // useExclusiveModal の戻り値を型安全に設定
    (useExclusiveModal as Mock).mockReturnValue({
      isOpen: false,
      open: mockOpen,
      close: mockClose,
    });

    // useUIStore の戻り値を設定 (デフォルトはロックされていない状態)
    (useUIStore as unknown as Mock).mockReturnValue(false);
  });

  it('チェックボックスをクリックすると progress を 100 に更新すること', async () => {
    const user = userEvent.setup();
    render(<TodoItemContainer todo={mockTodo} />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(mockUpdateTodo).toHaveBeenCalledWith({
      id: 'todo-1',
      progress: 100,
    });
  });

  it('編集ボタンをクリックすると open 関数が呼ばれること', async () => {
    const user = userEvent.setup();
    render(<TodoItemContainer todo={mockTodo} />);

    // ドロップダウンメニューのトリガーをクリック
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    // 編集ボタンをクリック
    await user.click(screen.getByText('編集'));

    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('削除の確認ダイアログで「OK」を押すと deleteTodo が呼ばれること', async () => {
    const user = userEvent.setup();
    // window.confirm をスパイ
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    
    render(<TodoItemContainer todo={mockTodo} />);

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await user.click(screen.getByText('削除'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockDeleteTodo).toHaveBeenCalledWith('todo-1');
    
    confirmSpy.mockRestore();
  });

  it('isOpen が true のときに編集モーダルが表示されること', () => {
    // モーダルが開いている状態をモック
    (useExclusiveModal as Mock).mockReturnValue({
      isOpen: true,
      open: mockOpen,
      close: mockClose,
    });

    render(<TodoItemContainer todo={mockTodo} />);

    // TodoEditModalContainer 内の要素が存在するか確認
    expect(screen.getByText('タスクを編集')).toBeInTheDocument();
  });

  it('他のモーダルが開いていてロックされている（isLockedByOther）とき、TodoItem が disabled になること', () => {
    // useUIStore が true (ロック状態) を返すように設定
    (useUIStore as unknown as Mock).mockReturnValue(true);

    render(<TodoItemContainer todo={mockTodo} />);
    
    // TodoItem の Role (checkbox) が disabled になっているか確認
    expect(screen.getByRole('checkbox')).toBeDisabled();
    
    // カード全体が opacity-50 クラスを持っているか確認
    const card = screen.getByText('コンテナテストタスク').closest('.w-full');
    expect(card).toHaveClass('opacity-50');
  });
});