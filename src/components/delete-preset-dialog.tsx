import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeletePresetDialogProps {
  open: boolean;
  presetName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeletePresetDialog({
  open,
  presetName,
  onConfirm,
  onCancel,
}: DeletePresetDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="bg-popover border border-border rounded-lg p-5 mx-4 w-full max-w-[320px] shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 shrink-0">
                <Trash2 size={16} className="text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">Delete preset</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-foreground">{presetName}</span>? This action
                  cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onConfirm}
                className="shadow-sm hover:shadow-md hover:ring-2 hover:ring-destructive/20 active:scale-[0.97] transition-all"
              >
                Delete
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
