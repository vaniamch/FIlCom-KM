import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Search,
  Upload,
  Download,
  Trash2,
  Bookmark,
  BookmarkCheck,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { DocumentItem, Category, Bookmark as BookmarkType } from '../../types';
import { incrementDocumentDownloads } from '../../services/firestoreService';
import { triggerFileDownload } from '../../utils/fileActions';
import { formatFileSize } from '../../utils/fileUpload';

interface DocumentRepositoryPageProps {
  documents: DocumentItem[];
  categories: Category[];
  userBookmarks: BookmarkType[];
  onOpenUpload: () => void;
  onDeleteDocument: (docItem: DocumentItem) => void;
  onToggleBookmark: (targetId: string, title: string) => void;
  onPreviewDocument: (docItem: DocumentItem) => void;
  onDownloadDocument?: (docId: string) => void;
  globalSearch?: string;
}

const ITEMS_PER_PAGE = 10;

export const DocumentRepositoryPage: React.FC<DocumentRepositoryPageProps> = ({
  documents,
  categories,
  userBookmarks,
  onOpenUpload,
  onDeleteDocument,
  onToggleBookmark,
  onPreviewDocument,
  onDownloadDocument,
  globalSearch = '',
}) => {
  const { isEditor, isAdmin, currentUser } = useAuth();
  const { confirmAction, showToast } = useUI();
  const [search, setSearch] = useState(globalSearch);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'downloads' | 'title'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setSearch(globalSearch);
    setCurrentPage(1);
  }, [globalSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, fileTypeFilter, sortBy]);

  const matchesFileType = (rawType: string | undefined, filter: string) => {
    if (filter === 'all') return true;
    const t = (rawType || '').toLowerCase();
    if (filter === 'pdf') return t === 'pdf';
    if (filter === 'xlsx') return ['xlsx', 'xls', 'csv'].includes(t);
    if (filter === 'docx') return ['docx', 'doc'].includes(t);
    if (filter === 'pptx') return ['pptx', 'ppt'].includes(t);
    if (filter === 'txt') return t === 'txt';
    if (filter === 'image') return ['jpg', 'jpeg', 'png', 'webp'].includes(t);
    return t === filter.toLowerCase();
  };

  const filteredDocs = useMemo(() => {
    const filtered = documents.filter((docItem) => {
      const q = search.trim().toLowerCase();
      const matchQuery =
        !q ||
        docItem.title.toLowerCase().includes(q) ||
        docItem.description?.toLowerCase().includes(q) ||
        docItem.fileName?.toLowerCase().includes(q) ||
        docItem.authorName?.toLowerCase().includes(q);

      const matchCat = selectedCategory === 'all' || docItem.categoryId === selectedCategory;
      const matchType = matchesFileType(docItem.fileType, fileTypeFilter);

      return matchQuery && matchCat && matchType;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'downloads') {
        return (b.downloadsCount || 0) - (a.downloadsCount || 0);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [documents, search, selectedCategory, fileTypeFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / ITEMS_PER_PAGE));
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDocs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDocs, currentPage]);

  const handleDownload = async (docItem: DocumentItem) => {
    await incrementDocumentDownloads(docItem.id);
    if (onDownloadDocument) {
      onDownloadDocument(docItem.id);
    }
    const ok = await triggerFileDownload(docItem.fileUrl, docItem.fileName);
    if (ok) {
      showToast(`Downloading "${docItem.fileName}"`, 'success');
    } else {
      showToast('Unable to download file URL.', 'error');
    }
  };

  const handleDeleteClick = async (docItem: DocumentItem) => {
    const confirmed = await confirmAction({
      title: 'Delete Document',
      message: `Are you sure you want to permanently remove "${docItem.title}" from the repository?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (confirmed) {
      onDeleteDocument(docItem);
    }
  };

  const isBookmarked = (id: string) => {
    return userBookmarks.some((b) => b.targetId === id);
  };

  const getFileBadgeColor = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('pdf')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (t.includes('xls') || t.includes('csv')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (t.includes('doc')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (t.includes('ppt')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(t)) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Document Repository
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Centralized archive for official templates, financial spreadsheets, constitutions, and minutes.
          </p>
        </div>

        {isEditor && (
          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-full shadow-[0_4px_14px_rgba(11,19,43,0.2)] transition-all self-start sm:self-auto shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-white/90 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search file name, title, or uploader..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-full focus:outline-none transition-colors text-slate-900"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl focus:outline-none text-slate-700 font-medium"
            >
              <option value="all">All Divisions ({documents.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={fileTypeFilter}
              onChange={(e) => setFileTypeFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl focus:outline-none text-slate-700 font-medium"
            >
              <option value="all">All File Types</option>
              <option value="pdf">PDF Documents (.pdf)</option>
              <option value="docx">Word Documents (.doc, .docx)</option>
              <option value="xlsx">Spreadsheets (.xls, .xlsx, .csv)</option>
              <option value="pptx">Presentations (.ppt, .pptx)</option>
              <option value="txt">Plain Text (.txt)</option>
              <option value="image">Images (.jpg, .png, .webp)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-2 px-3 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl focus:outline-none text-slate-700 font-medium"
            >
              <option value="newest">Newest</option>
              <option value="downloads">Most Downloaded</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* High-Density Data Table */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">No repository files found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No documents match your query or division filter.
            </p>
            {isEditor && (
              <button
                onClick={onOpenUpload}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-2xs transition-colors"
              >
                Upload First File
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/90 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Document Title</th>
                  <th className="py-3 px-4">Division</th>
                  <th className="py-3 px-4">Size & Type</th>
                  <th className="py-3 px-4">Uploader</th>
                  <th className="py-3 px-4">Upload Date</th>
                  <th className="py-3 px-4 text-right">Downloads</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDocs.map((docItem) => {
                  const bookmarked = isBookmarked(docItem.id);
                  const ownerUid = docItem.createdBy || docItem.authorId;
                  const isOwner = !!currentUser?.uid && ownerUid === currentUser.uid;
                  const canDelete = isAdmin || (isEditor && isOwner);
                  return (
                    <tr
                      key={docItem.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Title & File Name */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 max-w-xs">
                        <button
                          type="button"
                          onClick={() => onPreviewDocument(docItem)}
                          className="flex items-center gap-2.5 text-left w-full"
                        >
                          <span className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-[10px] uppercase shrink-0 ${getFileBadgeColor(docItem.fileType)}`}>
                            {docItem.fileType?.substring(0, 4) || 'FILE'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                              {docItem.title}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                              {docItem.fileName}
                            </p>
                          </div>
                        </button>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {docItem.categoryName || 'General'}
                      </td>

                      {/* Size */}
                      <td className="py-3.5 px-4 text-slate-600 tabular-nums whitespace-nowrap">
                        {formatFileSize(docItem.fileSize || 0)}
                      </td>

                      {/* Uploader */}
                      <td className="py-3.5 px-4 text-slate-600 truncate max-w-[120px]">
                        {docItem.authorName}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                        {new Date(docItem.createdAt).toLocaleDateString()}
                      </td>

                      {/* Downloads */}
                      <td className="py-3.5 px-4 text-right text-slate-700 font-semibold tabular-nums whitespace-nowrap">
                        {docItem.downloadsCount || 0}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onPreviewDocument(docItem)}
                            title="Preview Document"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Preview</span>
                          </button>

                          <button
                            onClick={() => onToggleBookmark(docItem.id, docItem.title)}
                            title={bookmarked ? 'Saved' : 'Save Bookmark'}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                          >
                            {bookmarked ? (
                              <BookmarkCheck className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Bookmark className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => handleDownload(docItem)}
                            title="Download File"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>Download</span>
                          </button>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteClick(docItem)}
                              title="Delete file"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredDocs.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between pt-1 text-xs text-slate-600">
          <span>
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredDocs.length)} of {filteredDocs.length} files
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-2 font-semibold tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-semibold"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
