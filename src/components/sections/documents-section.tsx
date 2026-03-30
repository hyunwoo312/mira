import { useState } from 'react';
import { Dropzone } from '@/components/ui/dropzone';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFiles } from '@/hooks/use-files';
import { formatFileSize, type StoredFile } from '@/lib/file-storage';
import { cn } from '@/lib/utils';

function FileCard({
  file,
  onRemove,
  onSetActive,
}: {
  file: StoredFile;
  onRemove: () => void;
  onSetActive: () => void;
}) {
  const date = new Date(file.uploadedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-3 p-3 border border-border bg-popover">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary shrink-0">
          <FileText size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{file.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {formatFileSize(file.size)} · {date}
          </div>
        </div>
        <button
          type="button"
          onClick={onSetActive}
          className={cn(
            'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors',
            file.isActive
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          {file.isActive ? (
            <span className="flex items-center gap-1">
              <Check size={10} /> Active
            </span>
          ) : (
            'Set active'
          )}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Remove file"
        >
          <Trash2 size={12} />
        </Button>
      </div>
    </motion.div>
  );
}

type Category = StoredFile['category'];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'resume', label: 'Resume' },
  { value: 'cover_letter', label: 'Cover Letter' },
];

export function DocumentsSection() {
  const { addFile, removeFile, setActive, getByCategory } = useFiles();
  const [activeCategory, setActiveCategory] = useState<Category>('resume');

  const resumeFiles = getByCategory('resume');
  const coverFiles = getByCategory('cover_letter');
  const allFiles = [...resumeFiles, ...coverFiles];

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
        Active files are automatically attached when you fill. One active file per category.
      </p>

      <div className="space-y-3">
        <div className="flex gap-1.5">
          {CATEGORIES.map(({ value, label }) => {
            const count = getByCategory(value).length;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveCategory(value)}
                className={cn(
                  'px-3 h-7 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer',
                  activeCategory === value
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-transparent text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {label}
                {count > 0 && ` (${count})`}
              </button>
            );
          })}
        </div>

        <Dropzone
          onFileSelect={(file) => addFile(file, activeCategory)}
          label={`Drop your ${activeCategory === 'resume' ? 'resume' : 'cover letter'} here`}
          sublabel="PDF, DOCX up to 5MB"
        />
      </div>

      {allFiles.length > 0 && (
        <div className="space-y-3">
          {resumeFiles.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/60">
                Resume
              </span>
              <AnimatePresence initial={false}>
                {resumeFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onRemove={() => removeFile(file.id)}
                    onSetActive={() => setActive(file.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {coverFiles.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/60">
                Cover Letter
              </span>
              <AnimatePresence initial={false}>
                {coverFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onRemove={() => removeFile(file.id)}
                    onSetActive={() => setActive(file.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
