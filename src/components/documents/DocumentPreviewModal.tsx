import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Printer,
  ExternalLink,
  FileText,
  User,
  Calendar,
  Loader2,
} from 'lucide-react';
import { DocumentItem } from '../../types';
import { useUI } from '../../context/UIContext';
import { incrementDocumentDownloads } from '../../services/firestoreService';
import {
  dataUrlToBlob,
  getGoogleDrivePreviewUrl,
  isDataUrl,
  triggerFileDownload,
} from '../../utils/fileActions';
import {
  formatFileSize,
  isChunkedFileUrl,
  resolveStoredFileUrl,
} from '../../utils/fileUpload';

interface DocumentPreviewModalProps {
  documentItem: DocumentItem | null;
  onClose: () => void;
  onDownloadComplete?: (docId: string) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  documentItem,
  onClose,
  onDownloadComplete,
}) => {
  const { showToast } = useUI();
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const rawFileUrl = documentItem?.fileUrl || '';
  const activeUrl = resolvedUrl || rawFileUrl;
  const fileType = (documentItem?.fileType || '').toLowerCase();
  const fileName = (documentItem?.fileName || '').toLowerCase();

  const isImage =
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(fileType) ||
    activeUrl.startsWith('data:image/') ||
    /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(fileName);

  const isPdf =
    fileType === 'pdf' ||
    activeUrl.startsWith('data:application/pdf') ||
    /\.pdf(\?|$)/i.test(fileName);

  const isText =
    ['txt', 'csv', 'md', 'json', 'log'].includes(fileType) ||
    activeUrl.startsWith('data:text/') ||
    /\.(txt|csv|md|json)(\?|$)/i.test(fileName);

  const googlePreviewUrl =
    !isDataUrl(activeUrl) && !isChunkedFileUrl(activeUrl)
      ? getGoogleDrivePreviewUrl(activeUrl)
      : null;

  useEffect(() => {
    let cancelled = false;
    let createdObjectUrl: string | null = null;
    setTextContent(null);
    setPreviewSrc(null);
    setResolvedUrl('');

    if (!documentItem || !rawFileUrl) return;

    const loadPreview = async () => {
      setLoading(true);
      try {
        const finalUrl = await resolveStoredFileUrl(rawFileUrl);
        if (cancelled) return;
        setResolvedUrl(finalUrl);

        if (isDataUrl(finalUrl)) {
          const blob = dataUrlToBlob(finalUrl);
          if (isText) {
            const txt = await blob.text();
            if (!cancelled) setTextContent(txt);
          } else {
            createdObjectUrl = URL.createObjectURL(blob);
            if (!cancelled) setPreviewSrc(createdObjectUrl);
          }
        } else if (isText) {
          const res = await fetch(finalUrl);
          if (res.ok) {
            const txt = await res.text();
            if (!cancelled) setTextContent(txt);
          }
        } else if (getGoogleDrivePreviewUrl(finalUrl)) {
          setPreviewSrc(getGoogleDrivePreviewUrl(finalUrl));
        } else {
          setPreviewSrc(finalUrl);
        }
      } catch {
        if (!cancelled) {
          setPreviewSrc(null);
          setTextContent(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [documentItem?.id, rawFileUrl, isText]);

  if (!documentItem) return null;

  const handleDownload = async () => {
    const ok = await triggerFileDownload(
      documentItem.fileUrl,
      documentItem.fileName
    );
    if (ok) {
      if (!documentItem.id.startsWith('att_')) {
        await incrementDocumentDownloads(documentItem.id);
        onDownloadComplete?.(documentItem.id);
      }
      showToast(`Downloading "${documentItem.fileName}"`, 'success');
    } else {
      showToast('Unable to download file.', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs print:static print:inset-auto print:bg-white print:p-0">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden print:shadow-none print:border-0 print:max-h-none print:max-w-none">
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70 print:bg-white print:px-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">
              {documentItem.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              <span className="font-semibold text-indigo-900">
                {documentItem.categoryName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono truncate">{documentItem.fileName}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {formatFileSize(documentItem.fileSize)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              title="Print document view"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/60 print:bg-white print:p-0 print:overflow-visible space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 print:border-slate-300">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Uploaded by {documentItem.authorName}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {new Date(documentItem.createdAt).toLocaleDateString()}
                </span>
              </span>
              <span className="uppercase font-mono text-[11px] font-bold text-indigo-700">
                {documentItem.fileType || 'FILE'}
              </span>
            </div>
            {documentItem.description && (
              <p className="text-xs text-slate-700 leading-relaxed pt-1 border-t border-slate-100">
                {documentItem.description}
              </p>
            )}
          </div>

          {loading ? (
            <div className="py-20 text-center space-y-2 bg-white rounded-xl border border-slate-200">
              <Loader2 className="w-6 h-6 text-indigo-700 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                Preparing document preview...
              </p>
            </div>
          ) : isImage && previewSrc ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-center">
              <img
                src={previewSrc}
                alt={documentItem.title}
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
              />
            </div>
          ) : isText && textContent !== null ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5 overflow-x-auto">
              <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                {textContent}
              </pre>
            </div>
          ) : (isPdf || googlePreviewUrl) && previewSrc ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-[60vh] print:hidden">
              <iframe
                src={previewSrc}
                title={documentItem.title}
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Inline preview unavailable for .{documentItem.fileType || 'file'} format
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  Office spreadsheets, Word documents, and external archives can be downloaded directly to view locally or opened in a new browser tab.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 print:hidden">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {documentItem.fileName}</span>
                </button>
                {!isDataUrl(documentItem.fileUrl) &&
                  !isChunkedFileUrl(documentItem.fileUrl) && (
                    <a
                      href={documentItem.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Original Link</span>
                    </a>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
