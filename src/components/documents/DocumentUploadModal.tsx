import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { Category, DocumentItem } from '../../types';
import { DIVISION_CATEGORIES } from '../../services/seedService';
import {
  uploadFileFast,
  validateUploadFile,
  validateExternalUrl,
  formatFileSize,
} from '../../utils/fileUpload';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    docData: Omit<DocumentItem, 'id' | 'createdAt' | 'downloadsCount'>
  ) => Promise<void>;
  categories: Category[];
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useUI();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableDivisions =
    categories && categories.length > 0 ? categories : DIVISION_CATEGORIES;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(
    availableDivisions[0]?.id || 'cat_leader'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [isUrlMode, setIsUrlMode] = useState(false);

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setDescription('');
    setCategoryId(availableDivisions[0]?.id || 'cat_leader');
    setSelectedFile(null);
    setExternalUrl('');
    setIsUrlMode(false);
    setUploadProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectValidatedFile = (file: File) => {
    setError(null);
    const check = validateUploadFile(file);
    if (!check.valid) {
      const msg = check.error || 'Unsupported file format or size.';
      setError(msg);
      showToast(msg, 'error');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      selectValidatedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectValidatedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    setError(null);

    if (title.trim().length < 2) {
      setError('Document title must be at least 2 characters.');
      return;
    }

    if (!isUrlMode && !selectedFile) {
      setError('Please select or drag a valid file to upload.');
      return;
    }

    if (isUrlMode) {
      const urlCheck = validateExternalUrl(externalUrl);
      if (!urlCheck.valid) {
        setError(urlCheck.error || 'Please provide a valid document URL.');
        return;
      }
    }

    const selectedCat = availableDivisions.find((c) => c.id === categoryId);
    setUploading(true);

    try {
      let finalFileUrl = externalUrl.trim();
      let finalStoragePath: string | undefined = undefined;
      let finalFileName = selectedFile ? selectedFile.name : title.trim();
      let finalFileSize = selectedFile ? selectedFile.size : 0;
      let finalFileType = selectedFile
        ? selectedFile.name.split('.').pop() || 'doc'
        : externalUrl.toLowerCase().includes('spreadsheet')
        ? 'xlsx'
        : externalUrl.toLowerCase().includes('document')
        ? 'docx'
        : 'link';

      if (!isUrlMode && selectedFile) {
        const result = await uploadFileFast(selectedFile, 'documents', (pct) => {
          setUploadProgress(pct);
        });
        finalFileUrl = result.url;
        finalStoragePath = result.storagePath;
        finalFileType = result.extension;
        finalFileSize = result.size;
      }

      if (!currentUser?.uid) {
        throw new Error('Authentication required to upload documents.');
      }

      await onSave({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        categoryName: selectedCat?.name || 'General',
        fileUrl: finalFileUrl,
        storagePath: finalStoragePath,
        fileName: finalFileName,
        fileSize: finalFileSize,
        fileType: finalFileType.toLowerCase(),
        createdBy: currentUser.uid,
        authorId: currentUser.uid,
        authorName:
          userProfile?.displayName ||
          currentUser.displayName ||
          'Committee Member',
      });

      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload document. Please try again.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg flex flex-col my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Upload to Repository
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Archive templates, forms, spreadsheets, and minutes.
            </p>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode switch */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setIsUrlMode(false);
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                !isUrlMode
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600'
              }`}
            >
              Upload Local File (PDF, DOCX, XLSX)
            </button>
            <button
              type="button"
              onClick={() => {
                setIsUrlMode(true);
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                isUrlMode
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600'
              }`}
            >
              Link Cloud Document (Google Drive)
            </button>
          </div>

          {!isUrlMode ? (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                File *
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : selectedFile
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-indigo-500 bg-slate-50/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <FileText className="w-8 h-8 text-emerald-600" />
                    <p className="text-xs font-bold text-slate-900">
                      {selectedFile.name}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 tabular-nums">
                      <span>
                        {formatFileSize(selectedFile.size)} · Click to replace
                      </span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = '';
                        }}
                        className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-semibold"
                        title="Remove selected file"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <Upload className="w-8 h-8 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-700">
                      Drag & drop your document here, or{' '}
                      <span className="text-indigo-600 underline">browse</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Supports PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, JPG, PNG, WEBP (up to 8MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Document URL *
              </label>
              <input
                type="url"
                required
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Document Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 2026 Student Organization Budget Requisition Form"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          {/* Division */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Division *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900 font-medium"
            >
              {availableDivisions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context regarding version, revisions, or usage instructions..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>
                  {uploadProgress < 100
                    ? 'Uploading & saving document...'
                    : 'Finalizing record...'}
                </span>
                <span className="tabular-nums font-semibold">
                  {Math.max(10, uploadProgress)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-150"
                  style={{ width: `${Math.max(10, uploadProgress)}%` }}
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 disabled:opacity-50 rounded-lg shadow-2xs transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Archiving Document...</span>
                </>
              ) : (
                <span>Save to Repository</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
