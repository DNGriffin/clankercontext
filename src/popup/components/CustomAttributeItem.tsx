import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Loader2 } from 'lucide-react';
import type { CustomAttribute, AttributeSearchDirection } from '@/shared/types';
import { normalizeAttributeName } from '@/shared/utils';

interface CustomAttributeItemProps {
  attribute: CustomAttribute;
  onEdit: () => void;
  onDelete: (id: string) => Promise<void>;
}

/**
 * Get the direction icon based on search direction.
 */
function getDirectionIcon(direction: AttributeSearchDirection) {
  switch (direction) {
    case 'parent':
      return <ArrowUp className="h-3 w-3 text-muted-foreground" />;
    case 'descendant':
      return <ArrowDown className="h-3 w-3 text-muted-foreground" />;
    case 'both':
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
  }
}

/**
 * Get the direction label for display.
 */
function getDirectionLabel(direction: AttributeSearchDirection): string {
  switch (direction) {
    case 'parent':
      return 'Search parents';
    case 'descendant':
      return 'Search descendants';
    case 'both':
      return 'Search both';
  }
}

export function CustomAttributeItem({
  attribute,
  onEdit,
  onDelete,
}: CustomAttributeItemProps): React.ReactElement {
  const [deleting, setDeleting] = useState(false);
  const tokenName = normalizeAttributeName(attribute.name);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(attribute.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 px-3 py-2 hover:bg-muted/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getDirectionIcon(attribute.searchDirection)}
          <span className="text-sm font-medium truncate">{attribute.name}</span>
        </div>
        <div className="flex items-center shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onEdit}
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-5 text-xs text-muted-foreground">
        <span>{getDirectionLabel(attribute.searchDirection)}</span>
        <span className="text-muted-foreground/50">|</span>
        <code className="text-[10px] bg-muted px-1 rounded">{`{{${tokenName}}}`}</code>
      </div>
    </div>
  );
}
