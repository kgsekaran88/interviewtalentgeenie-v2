import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggablePortalCardProps {
  id: string;
  children: React.ReactNode;
  isEditMode: boolean;
}

export const DraggablePortalCard = ({ id, children, isEditMode }: DraggablePortalCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging && 'opacity-50 scale-105',
        isEditMode && 'ring-2 ring-primary/20 ring-dashed rounded-lg'
      )}
    >
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-2 -left-2 z-10 flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full cursor-grab active:cursor-grabbing shadow-lg hover:bg-primary/90 transition-colors"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      {children}
    </div>
  );
};
