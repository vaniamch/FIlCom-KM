import React, { useState } from 'react';
import { 
  Bookmark, 
  Trash2, 
  BookOpen, 
  FileText, 
  ArrowRight, 
  Download,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { Bookmark as BookmarkType, KnowledgeArticle, DocumentItem, PageRoute } from '../../types';
import { triggerFileDownload } from '../../utils/fileActions';
import { incrementDocumentDownloads } from '../../services/firestoreService';
import { useUI } from '../../context/UIContext';
import { formatFileSize } from '../../utils/fileUpload';

interface BookmarksPageProps {
  bookmarks: BookmarkType[];
  articles: KnowledgeArticle[];
  documents: DocumentItem[];
  onSelectArticle: (id: string) => void;
  onPreviewDocument: (docItem: DocumentItem) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
  onNavigate: (page: PageRoute) => void;
}

export const BookmarksPage: React.FC<BookmarksPageProps> = ({
  bookmarks,
  articles,
  documents,
  onSelectArticle,
  onPreviewDocument,
  onRemoveBookmark,
  onNavigate,
}) => {
  const { showToast } = useUI();
  const [filterType, setFilterType] = useState<'all' | 'knowledge' | 'document'>('all');

  const filteredBookmarks = bookmarks.filter((b) => {
    if (filterType === 'all') return true;
    if (filterType === 'knowledge') return b.targetType === 'knowledge' || b.targetType === 'sop';
    if (filterType === 'document') return b.targetType === 'document';
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Saved Bookmarks
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Fast access to critical articles, forms, and procedures you have saved.
          </p>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-white/80 backdrop-blur-md border border-white/90 rounded-2xl shadow-2xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-colors ${
              filterType === 'all'
                ? 'bg-[#0b132b] text-white font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({bookmarks.length})
          </button>
          <button
            onClick={() => setFilterType('knowledge')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-colors ${
              filterType === 'knowledge'
                ? 'bg-[#0b132b] text-white font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Articles & SOPs
          </button>
          <button
            onClick={() => setFilterType('document')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-colors ${
              filterType === 'document'
                ? 'bg-[#0b132b] text-white font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Repository Docs
          </button>
        </div>
      </div>

      {/* Bookmarks List */}
      {filteredBookmarks.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 p-12 text-center shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)]">
          <Bookmark className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No saved bookmarks</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Click the bookmark icon on any guide, SOP, or repository file to save it here for fast retrieval.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => onNavigate('knowledge')}
              className="px-5 py-2 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-full shadow-2xs transition-colors"
            >
              Browse Knowledge
            </button>
            <button
              onClick={() => onNavigate('documents')}
              className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white/80 hover:bg-white border border-slate-200 rounded-full transition-colors"
            >
              Browse Documents
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] divide-y divide-slate-100 overflow-hidden">
          {filteredBookmarks.map((bookmark) => {
            const isKnowledge = bookmark.targetType === 'knowledge' || bookmark.targetType === 'sop';
            const matchedArticle = isKnowledge ? articles.find((a) => a.id === bookmark.targetId) : null;
            const matchedDoc = !isKnowledge ? documents.find((d) => d.id === bookmark.targetId) : null;
            const isMissing = isKnowledge ? !matchedArticle : !matchedDoc;

            return (
              <div
                key={bookmark.id}
                className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                    {isKnowledge ? <BookOpen className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <h3
                      onClick={() => {
                        if (isKnowledge && matchedArticle) onSelectArticle(bookmark.targetId);
                        else if (matchedDoc) {
                          onPreviewDocument(matchedDoc);
                        } else {
                          showToast('This item is no longer available in the repository.', 'info');
                        }
                      }}
                      className="text-xs sm:text-sm font-bold text-slate-900 hover:text-indigo-700 transition-colors cursor-pointer truncate"
                    >
                      {bookmark.title}
                    </h3>

                    {/* Zero-Pill metadata */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-medium text-slate-700">
                        {isKnowledge ? 'Article / SOP' : 'Repository Document'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        Saved {new Date(bookmark.createdAt).toLocaleDateString()}
                      </span>
                      {matchedDoc && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{formatFileSize(matchedDoc.fileSize || 0)}</span>
                        </>
                      )}
                      {isMissing && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-700 font-semibold">Unavailable</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isKnowledge && matchedArticle ? (
                    <button
                      onClick={() => onSelectArticle(bookmark.targetId)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <span>Read</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : matchedDoc ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await incrementDocumentDownloads(matchedDoc.id);
                        const ok = await triggerFileDownload(matchedDoc.fileUrl, matchedDoc.fileName);
                        if (ok) {
                          showToast(`Downloading "${matchedDoc.fileName}"`, 'success');
                        } else {
                          showToast('Unable to download file URL.', 'error');
                        }
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  ) : null}

                  <button
                    onClick={() => onRemoveBookmark(bookmark.id)}
                    title="Remove from saved bookmarks"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
