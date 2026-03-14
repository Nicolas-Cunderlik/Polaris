import { useCallback, useEffect, useMemo, useState } from 'react';
import { type FileError, type FileRejection, useDropzone } from 'react-dropzone';

interface FileWithPreview extends File {
  preview?: string;
  errors: readonly FileError[];
}

type UseFileUploadOptions = {
  /**
   * Endpoint to upload files to. Placeholder in local dev.
   */
  uploadUrl?: string;
  /**
   * Allowed MIME types for each file upload (e.g `image/png`, `text/html`, etc). Wildcards are also supported (e.g `image/*`).
   */
  allowedMimeTypes?: string[];
  /**
   * Maximum upload size of each file allowed in bytes. (e.g 1000 bytes = 1 KB)
   */
  maxFileSize?: number;
  /**
   * Maximum number of files allowed per upload.
   */
  maxFiles?: number;
};

type UseFileUploadReturn = ReturnType<typeof useFileUpload>;

const useFileUpload = (options: UseFileUploadOptions) => {
  const {
    uploadUrl,
    allowedMimeTypes = [],
    maxFileSize = Number.POSITIVE_INFINITY,
    maxFiles = 1,
  } = options;

  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([]);
  const [successes, setSuccesses] = useState<string[]>([]);

  const isSuccess = useMemo(() => {
    if (errors.length === 0 && successes.length === 0) {
      return false;
    }
    if (errors.length === 0 && successes.length === files.length) {
      return true;
    }
    return false;
  }, [errors.length, successes.length, files.length]);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      const validFiles = acceptedFiles
        .filter((file) => !files.find((x) => x.name === file.name))
        .map((file) => {
          (file as FileWithPreview).preview = URL.createObjectURL(file);
          (file as FileWithPreview).errors = [];
          return file as FileWithPreview;
        });

      const invalidFiles = fileRejections.map(({ file, errors }) => {
        (file as FileWithPreview).preview = URL.createObjectURL(file);
        (file as FileWithPreview).errors = errors;
        return file as FileWithPreview;
      });

      const newFiles = [...files, ...validFiles, ...invalidFiles];

      setFiles(newFiles);
    },
    [files]
  );

  const dropzoneProps = useDropzone({
    onDrop,
    noClick: true,
    accept: allowedMimeTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: maxFileSize,
    maxFiles: maxFiles,
    multiple: maxFiles !== 1,
  });

  const onUpload = useCallback(async () => {
    setLoading(true);

    // Placeholder uploader: mark files as uploaded after a short delay.
    const filesWithErrors = errors.map((x) => x.name);
    const filesToUpload =
      filesWithErrors.length > 0
        ? [
            ...files.filter((f) => filesWithErrors.includes(f.name)),
            ...files.filter((f) => !successes.includes(f.name)),
          ]
        : files;

    await new Promise((resolve) => setTimeout(resolve, 400));

    const responseErrors: { name: string; message: string }[] = [];
    setErrors(responseErrors);

    const responseSuccesses = filesToUpload.map((file) => ({ name: file.name }));
    const newSuccesses = Array.from(
      new Set([...successes, ...responseSuccesses.map((x) => x.name)])
    );
    setSuccesses(newSuccesses);

    if (uploadUrl) {
      console.info(`Upload placeholder: files would be sent to ${uploadUrl}`);
    }

    setLoading(false);
  }, [errors, files, successes, uploadUrl]);

  useEffect(() => {
    if (files.length === 0) {
      setErrors([]);
    }

    if (files.length <= maxFiles) {
      let changed = false;
      const newFiles = files.map((file) => {
        if (file.errors.some((e) => e.code === 'too-many-files')) {
          file.errors = file.errors.filter((e) => e.code !== 'too-many-files');
          changed = true;
        }
        return file;
      });
      if (changed) {
        setFiles(newFiles);
      }
    }
  }, [files, maxFiles]);

  return {
    files,
    setFiles,
    successes,
    isSuccess,
    loading,
    errors,
    setErrors,
    onUpload,
    maxFileSize: maxFileSize,
    maxFiles: maxFiles,
    allowedMimeTypes,
    ...dropzoneProps,
  };
};

export { useFileUpload, type UseFileUploadOptions, type UseFileUploadReturn };
