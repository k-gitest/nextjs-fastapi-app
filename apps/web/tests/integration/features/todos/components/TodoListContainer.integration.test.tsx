import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { TodoList } from '@/features/todos/components/TodoListContainer';
import { useTodo } from '@/features/todos/hooks/useTodo';
import { useExclusiveModal, useUIStore } from '@/hooks/useExclusiveModal';
import type { Todo } from '@/features/todos/types';

// 依存するフックをすべてモック化
vi.mock('@/features/todos/hooks/useTodo');
vi.mock('@/hooks/useExclusiveModal');

describe('TodoList', () => {
  const mockTodos: Todo[] = [
    {
      id: '1',
      todo_title: 'タスク1',
      priority: 'HIGH',
      progress: 0,
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      todo_title: 'タスク2',
      priority: 'MEDIUM',
      progress: 50,
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // TodoItemContainer が内部で利用するフックのデフォルト値を設定
    // これを忘れると "Cannot read properties of undefined (reading 'isPending')" が出ます
    (useTodo as Mock).mockReturnValue({
      todos: [],
      updateTodo: vi.fn(),
      deleteTodo: vi.fn(),
      updateMutation: { isPending: false }, // ここが重要
      deleteMutation: { isPending: false }, // ここが重要
    });

    (useExclusiveModal as Mock).mockReturnValue({
      isOpen: false,
      open: vi.fn(),
      close: vi.fn(),
    });

    (useUIStore as unknown as Mock).mockReturnValue(false);
  });

  it('タスクが空のとき、メッセージが表示されること', () => {
    // beforeEachのデフォルトで todos: [] なのでそのまま render
    render(<TodoList />);
    expect(screen.getByText(/まだタスクがありません/)).toBeInTheDocument();
  });

  it('タスクが存在するとき、リストが表示されること', () => {
    (useTodo as Mock).mockReturnValue({
      todos: mockTodos,
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });

    render(<TodoList />);

    expect(screen.getByText('タスク1')).toBeInTheDocument();
    expect(screen.getByText('タスク2')).toBeInTheDocument();
  });

  it('limit プロップスが指定された場合、その件数のみ表示されること', () => {
    (useTodo as Mock).mockReturnValue({
      todos: mockTodos,
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });

    render(<TodoList limit={1} />);

    expect(screen.getByText('タスク1')).toBeInTheDocument();
    expect(screen.queryByText('タスク2')).not.toBeInTheDocument();
  });

  it('showActions が true のとき、チェックボックスが表示されること', () => {
    (useTodo as Mock).mockReturnValue({
      todos: [mockTodos[0]],
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });

    render(<TodoList showActions={true} />);

    // TodoItemContainer がレンダリングされていれば Checkbox があるはず
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('showActions が false のとき、チェックボックスが表示されないこと', () => {
    (useTodo as Mock).mockReturnValue({
      todos: [mockTodos[0]],
      updateMutation: { isPending: false },
      deleteMutation: { isPending: false },
    });

    render(<TodoList showActions={false} />);

    // TodoItem (純粋表示) なら Checkbox はレンダリングされない
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('タスク1')).toBeInTheDocument();
  });
});