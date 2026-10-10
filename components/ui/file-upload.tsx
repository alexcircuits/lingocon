"use client"

import { createContext, useContext } from "react"
import dynamic from "next/dynamic"
import {
  DEFAULT_MAX_UPLOAD_SIZE,
  DEFAULT_UPLOAD_PLACEHOLDER,
  FileUploadView,
  type FileUploadType,
} from "@/components/ui/file-upload-view"

export interface FileUploadProps {
  type: FileUploadType
  accept?: string
  maxSize?: number // in bytes
  value?: string
  onChange: (url: string | null, metadata?: { filename?: string; size?: number }) => void
  className?: string
  placeholder?: string
}

/**
 * The upload field, code-split: react-dropzone and its MIME-type tables were ~20 kB of
 * first-load JS on the settings page and every editor route. The field still renders on the
 * server, and that markup stays in place while the dropzone code loads after hydration. On a
 * client-side navigation before the code is cached, the same markup is drawn from the field's
 * props (an existing file can already be removed; the drop area becomes clickable on load).
 */
const PendingProps = createContext<FileUploadProps | null>(null)

function FileUploadPending() {
  const props = useContext(PendingProps)
  if (!props) return null
  return (
    <FileUploadView
      type={props.type}
      value={props.value}
      maxSize={props.maxSize ?? DEFAULT_MAX_UPLOAD_SIZE}
      placeholder={props.placeholder ?? DEFAULT_UPLOAD_PLACEHOLDER}
      className={props.className}
      error={null}
      isUploading={false}
      isDragActive={false}
      onRemove={() => props.onChange(null)}
    />
  )
}

const FileUploadDropzone = dynamic(
  () => import("@/components/ui/file-upload-dropzone").then((m) => m.FileUploadDropzone),
  { loading: FileUploadPending }
)

export function FileUpload(props: FileUploadProps) {
  return (
    <PendingProps.Provider value={props}>
      <FileUploadDropzone {...props} />
    </PendingProps.Provider>
  )
}
