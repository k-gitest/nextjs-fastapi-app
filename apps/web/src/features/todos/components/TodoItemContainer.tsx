import { useCallback } from 'react';
import { useExclusiveModal, useUIStore } from '@/hooks/useExclusiveModal';
import { useTodo } from '../hooks/useTodo';
import type { Todo } from '../types';
import type { SimilarTodoItem } from '../hooks/useTodoSearch';
import { TodoEditModalContainer } from './TodoEditModalContainer';
import { TodoItem } from './TodoItem';

// ✅ 通常のTodoと検索結果(SimilarTodoItem)の両方を受け取れるように拡張
interface TodoItemContainerProps {
  todo: Todo | SimilarTodoItem;
  isSearchMode?: boolean;
  score?: number;
}

export const TodoItemContainer = ({ todo, isSearchMode, score }: TodoItemContainerProps) => {
  const { updateTodo, deleteTodo, updateMutation, deleteMutation } = useTodo();
  //const [isEditing, setIsEditing] = useState(false);
  const { isOpen, open, close } = useExclusiveModal();

  // ✅ 型ガード：これが「本物のTodo（DB由来）」かどうかを判定
  const isFullTodo = "todo_title" in todo;

  // ✅ 表示用データの正規化
  const title = isFullTodo ? todo.todo_title : todo.title;
  const updatedAt = isFullTodo ? todo.updatedAt : undefined;

  // ✅ ハンドラーの安全な定義（検索モードなら何もしない）
  const handleToggleComplete = useCallback(async () => {
    if (!isFullTodo) return; // 検索結果の場合は操作不能にする
    const newProgress = todo.progress === 100 ? 0 : 100;
    await updateTodo({ id: String(todo.id), progress: newProgress });
  }, [isFullTodo, todo.id, todo.progress, updateTodo]);

  /*
  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);
  */
  const handleEdit = open;

  const handleDelete = useCallback(async () => {
    if (!isFullTodo) return;
    if (window.confirm('本当にこのタスクを削除しますか？')) {
      await deleteTodo(todo.id);
    }
  }, [isFullTodo, todo.id, deleteTodo]);

  // ✅ ストアの購読を「自分にとって必要な真偽値」に絞る
  const isLockedByOther = useUIStore(
    (state) => state.currentModalId !== null && !isOpen
  );

  // すべてのガード条件を統合
  // 検索モード時は mutation の状態を気にする必要がない（操作させないため）
  const isDisabled = isFullTodo
    ? (updateMutation.isPending || deleteMutation.isPending || isLockedByOther)
    : false;

  return (
    <>
      <TodoItem
        id={todo.id}
        title={title} // ✅ 吸収した変数を使用
        priority={todo.priority ?? 'MEDIUM'}
        progress={todo.progress ?? 0}
        updatedAt={updatedAt} // ✅ 吸収した変数を使用
        // ✅ 検索モードならアクションボタン（チェックボックス、メニュー）を非表示にする
        showActions={isFullTodo && !isSearchMode}
        onToggleComplete={handleToggleComplete}
        disabled={isDisabled}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isSearchMode={isSearchMode} // ✅ TodoItemへ渡す
        score={score}               // ✅ TodoItemへ渡す
      />
      {isOpen && isFullTodo && (
        <TodoEditModalContainer
          todo={todo} // ここで確実に Todo 型であることが保証されている
          //onClose={() => setIsEditing(false)}
          onClose={close} // モーダルが閉じるときにストアの状態も更新して解放する
        />
      )}
    </>
  );
};
