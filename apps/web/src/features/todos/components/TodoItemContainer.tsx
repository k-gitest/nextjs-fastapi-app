import { useCallback } from 'react';
import { useExclusiveModal, useUIStore } from '@/hooks/useExclusiveModal';
import { useTodo } from '../hooks/useTodo';
import type { Todo } from '../types';
import { TodoEditModalContainer } from './TodoEditModalContainer';
import { TodoItem } from './TodoItem';

export const TodoItemContainer = ({ todo }: { todo: Todo }) => {
  const { updateTodo, deleteTodo, updateMutation, deleteMutation } = useTodo();
  //const [isEditing, setIsEditing] = useState(false);
  const { isOpen, open, close } = useExclusiveModal();

  const handleToggleComplete = useCallback(async () => {
    const newProgress = todo.progress === 100 ? 0 : 100;
    await updateTodo({ id: todo.id, progress: newProgress });
  }, [todo.id, todo.progress, updateTodo]);

  /*
  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);
  */
  const handleEdit = open;

  const handleDelete = useCallback(async () => {
    if (window.confirm('本当にこのタスクを削除しますか？')) {
      await deleteTodo(todo.id);
    }
  }, [todo.id, deleteTodo]);

  // ✅ ストアの購読を「自分にとって必要な真偽値」に絞る
  const isLockedByOther = useUIStore(
    (state) => state.currentModalId !== null && !isOpen
  );

  // すべてのガード条件を統合
  const isDisabled = updateMutation.isPending || deleteMutation.isPending || isLockedByOther;

  return (
    <>
      <TodoItem
        id={todo.id}
        title={todo.todo_title}
        priority={todo.priority ?? 'MEDIUM'}
        progress={todo.progress ?? 0}
        updatedAt={todo.updatedAt}
        showActions={true}
        onToggleComplete={handleToggleComplete}
        disabled={isDisabled}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      {isOpen && (
        <TodoEditModalContainer
          todo={todo}
          //onClose={() => setIsEditing(false)}
          onClose={close} // モーダルが閉じるときにストアの状態も更新して解放する
        />
      )}
    </>
  );
};
