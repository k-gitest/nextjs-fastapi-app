import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TodoFormValues } from '../schemas';
import { TodoForm } from './TodoForm';

interface TodoEditModalProps {
  id: number | string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  progress: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TodoFormValues) => Promise<void>;
  isSubmitting?: boolean;
}

export const TodoEditModal = ({ 
  title, 
  priority, 
  progress, 
  open, 
  onOpenChange, 
  onSubmit,
  isSubmitting,
}: TodoEditModalProps) => {

  /*
  const handleSubmit = async (values: TodoFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };
  */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>タスクを編集</DialogTitle>
        </DialogHeader>
        <TodoForm 
          defaultValues={{
            todo_title: title,
            priority: priority,
            progress: progress,
          }}
          onSubmit={onSubmit}
          isLoading={isSubmitting} 
          submitLabel={isSubmitting ? "保存中..." : "変更を保存"}
        />
      </DialogContent>
    </Dialog>
  );
};