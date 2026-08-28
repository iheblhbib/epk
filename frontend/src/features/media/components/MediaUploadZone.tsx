import { Loader2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useUploadMedia } from '@/features/media/hooks/useMedia'
import { cn } from '@/lib/utils'

const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.mp3,.wav,.flac,.mp4,.mov,.pdf,.docx'

export function MediaUploadZone({ workspaceId }: { workspaceId: number }) {
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadMedia(workspaceId)

  const uploadFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    setProgress(0)
    upload.mutate(
      { files: fileArray, onProgress: setProgress },
      {
        onSuccess: (uploaded) => {
          toast.success(uploaded.length === 1 ? 'File uploaded' : `${uploaded.length} files uploaded`)
          setProgress(null)
        },
        onError: (error) => {
          const message =
            (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
            'Could not upload one or more files'
          toast.error(message)
          setProgress(null)
        },
      }
    )
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        uploadFiles(event.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/50',
        isDragging && 'border-primary bg-primary/5'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={(event) => {
          if (event.target.files) uploadFiles(event.target.files)
          event.target.value = ''
        }}
      />
      {upload.isPending ? (
        <>
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Uploading{progress !== null ? ` — ${progress}%` : '…'}</p>
        </>
      ) : (
        <>
          <UploadCloud className="size-6 text-muted-foreground" />
          <p className="text-sm text-foreground">
            <span className="font-medium">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">
            Images, audio, video, and documents
          </p>
        </>
      )}
    </div>
  )
}
