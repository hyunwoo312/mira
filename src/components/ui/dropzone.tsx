import { useState, useRef, type DragEvent } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  label?: string;
  sublabel?: string;
}

function Dropzone({
  onFileSelect,
  accept = '.pdf,.docx,.doc',
  label = 'Drop your file here',
  sublabel = 'PDF, DOCX up to 5MB',
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDragIn = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragOut = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        'flex flex-col items-center gap-2 py-6 cursor-pointer transition-colors text-center',
        'border border-dashed border-border hover:border-primary/40 hover:bg-primary/5',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/40',
        isDragging && 'border-primary bg-primary/5',
      )}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted text-muted-foreground">
        <Upload size={16} />
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-[10px] text-muted-foreground/60">{sublabel}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />
    </div>
  );
}

export { Dropzone };
