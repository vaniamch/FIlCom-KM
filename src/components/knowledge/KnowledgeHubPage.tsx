import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Eye,
  Bookmark,
  BookmarkCheck,
  User,
  BookOpen,
  Paperclip,
  Download,
  Edit3,
  Trash2,
  Archive,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import {
  KnowledgeArticle,
  Category,
  Bookmark as BookmarkType,
} from '../../types';
import { triggerFileDownload } from '../../utils/fileActions';

interface KnowledgeHubPageProps {
  articles: KnowledgeArticle[];
  categories: Category[];
  userBookmarks: BookmarkType[];
  initialTypeFilter?: string;
  onSelectArticle: (articleId: string) => void;
  onOpenCreateArticle: (openAsSop?: boolean) => void;
  onEditArticle?: (article: KnowledgeArticle) => void;
  onArchiveArticle?: (article: KnowledgeArticle) => void;
  onDeleteArticle?: (articleId: string) => void;
  onToggleBookmark: (targetId: string, title: string) => void;
  globalSearch?: string;
}

const ITEMS_PER_PAGE = 9;

export const KnowledgeHubPage: React.FC<KnowledgeHubPageProps> = ({
  articles,
  categories,
  userBookmarks,
  initialTypeFilter = 'active',
  onSelectArticle,
  onOpenCreateArticle,
  onEditArticle,
  onArchiveArticle,
  onDeleteArticle,
  onToggleBookmark,
  globalSearch = '',
}) => {
  const { isEditor, isAdmin, currentUser } = useAuth();
  const { showToast, confirmAction } = useUI();
  const [search, setSearch] = useState(globalSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>(initialTypeFilter);
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'title'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setSearch(globalSearch);
  }, [globalSearch]);

  useEffect(() => {
    if (initialTypeFilter) {
      setSelectedType(initialTypeFilter);
    }
  }, [initialTypeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    selectedCategory,
    selectedDepartment,
    selectedType,
    dateRange,
    selectedTag,
    sortBy,
  ]);

  // Extract all unique tags & departments
  const allTags = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((art) => {
      art.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [articles]);

  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => set.add(c.name));
    articles.forEach((art) => {
      if (art.department) set.add(art.department);
      if (art.targetCommittee) set.add(art.targetCommittee);
    });
    return Array.from(set).sort();
  }, [articles, categories]);

  // Filtered & Sorted Articles
  const filteredArticles = useMemo(() => {
    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return articles
      .filter((art) => {
        const ownerUid = art.createdBy || art.authorId;
        // Only Admins or the record owner can view non-published drafts/archived items
        if (
          art.status !== 'published' &&
          !isAdmin &&
          (!currentUser?.uid || ownerUid !== currentUser.uid)
        ) {
          return false;
        }

        const q = search.trim().toLowerCase();
        const matchQuery =
          !q ||
          art.title.toLowerCase().includes(q) ||
          art.summary?.toLowerCase().includes(q) ||
          art.content?.toLowerCase().includes(q) ||
          art.categoryName?.toLowerCase().includes(q) ||
          art.department?.toLowerCase().includes(q) ||
          art.knowledgeType?.toLowerCase().includes(q) ||
          art.sopNumber?.toLowerCase().includes(q) ||
          art.authorName?.toLowerCase().includes(q) ||
          art.tags?.some((t) => t.toLowerCase().includes(q));

        const matchCat =
          selectedCategory === 'all' || art.categoryId === selectedCategory;
        const matchDept =
          selectedDepartment === 'all' ||
          (art.department || art.targetCommittee || art.categoryName) ===
            selectedDepartment;
        const matchTag =
          selectedTag === 'all' || art.tags?.includes(selectedTag);

        let matchType = true;
        if (selectedType === 'active') {
          matchType = art.status !== 'archived';
        } else if (selectedType === 'published') {
          matchType = art.status === 'published';
        } else if (selectedType === 'draft') {
          matchType = art.status === 'draft';
        } else if (selectedType === 'archived') {
          matchType = art.status === 'archived';
        } else if (selectedType === 'sop') {
          matchType = !!art.isSOP && art.status !== 'archived';
        } else if (selectedType === 'standard') {
          matchType = !art.isSOP && art.status !== 'archived';
        }

        let matchDate = true;
        if (dateRange !== 'all') {
          const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
          const createdMs = new Date(art.createdAt).getTime();
          matchDate = nowMs - createdMs <= days * dayMs;
        }

        return (
          matchQuery &&
          matchCat &&
          matchDept &&
          matchTag &&
          matchType &&
          matchDate
        );
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
        if (sortBy === 'popular') {
          return (b.viewsCount || 0) - (a.viewsCount || 0);
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [
    articles,
    search,
    selectedCategory,
    selectedDepartment,
    selectedType,
    dateRange,
    selectedTag,
    sortBy,
    isEditor,
    currentUser,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredArticles.length / ITEMS_PER_PAGE)
  );
  const safePage = Math.min(currentPage, totalPages);
  const paginatedArticles = filteredArticles.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const isBookmarked = (id: string) => {
    return userBookmarks.some((b) => b.targetId === id);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Knowledge Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Access, document, and preserve organizational procedures, guides, and wisdom.
          </p>
        </div>

        {isEditor && (
          <button
            onClick={() => onOpenCreateArticle(selectedType === 'sop')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-full shadow-[0_4px_14px_rgba(11,19,43,0.2)] transition-all self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{selectedType === 'sop' ? 'Create SOP' : 'Document Knowledge'}</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white/80 backdrop-blur-md border border-white/90 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] space-y-4">
        {/* Search & Sort Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title, content keyword, SOP number, or author..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-full focus:outline-none transition-colors"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl focus:outline-none transition-colors text-slate-700 font-medium"
            >
              <option value="all">All Tags ({allTags.length})</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
              <button
                onClick={() => setSortBy('newest')}
                className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                  sortBy === 'newest'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Newest
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                  sortBy === 'popular'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Popular
              </button>
              <button
                onClick={() => setSortBy('title')}
                className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                  sortBy === 'title'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A-Z
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Filters: Department, Type/Status, Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full py-1.5 px-3 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl focus:outline-none text-slate-700 font-medium"
          >
            <option value="all">All Departments</option>
            {allDepartments.map((dept) => (
              <option key={dept} value={dept}>
                Dept: {dept}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full py-1.5 px-3 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl focus:outline-none text-slate-700 font-medium"
          >
            <option value="active">All Active Documents</option>
            <option value="published">Published Only</option>
            <option value="draft">Drafts Only</option>
            <option value="standard">Standard Guides Only</option>
            <option value="sop">SOP Workflows Only</option>
            <option value="archived">Archived Only</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) =>
              setDateRange(e.target.value as 'all' | '7d' | '30d' | '90d')
            }
            className="w-full py-1.5 px-3 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl focus:outline-none text-slate-700 font-medium"
          >
            <option value="all">Any Date</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>

        {/* Category Horizontal Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-[#0b132b] text-white font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            All Divisions ({articles.length})
          </button>
          {categories.map((cat) => {
            const count = articles.filter(
              (a) => a.categoryId === cat.id
            ).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-[#0b132b] text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Articles Grid */}
      {paginatedArticles.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 p-12 text-center shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)]">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">
            No knowledge articles found
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search ||
            selectedCategory !== 'all' ||
            selectedTag !== 'all' ||
            selectedDepartment !== 'all' ||
            dateRange !== 'all' ||
            selectedType !== 'active'
              ? 'Try adjusting your search criteria or resetting the filters.'
              : 'Start building your organizational memory by documenting your first guide.'}
          </p>
          {isEditor && (
            <button
              onClick={() => onOpenCreateArticle(selectedType === 'sop')}
              className="mt-4 px-5 py-2 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-full shadow-2xs transition-colors"
            >
              Document New Knowledge
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedArticles.map((article) => {
              const bookmarked = isBookmarked(article.id);
              const ownerUid = article.createdBy || article.authorId;
              const isOwner = !!currentUser?.uid && ownerUid === currentUser.uid;
              const canModify = isAdmin || (isEditor && isOwner);
              const firstAttachment = article.attachments?.[0];

              return (
                <div
                  key={article.id}
                  className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] hover:shadow-[0_8px_24px_-4px_rgba(79,114,205,0.12)] hover:border-indigo-300 transition-all flex flex-col justify-between group"
                >
                  <div className="p-5">
                    {/* Zero-Pill Top Metadata */}
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-2.5">
                      <span className="font-medium text-slate-700 truncate">
                        {article.categoryName}
                        {article.knowledgeType
                          ? ` · ${article.knowledgeType}`
                          : ''}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {article.status !== 'published' && (
                          <span className="text-amber-600 font-semibold text-[11px] capitalize">
                            {article.status.replace('_', ' ')}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleBookmark(article.id, article.title);
                          }}
                          title={bookmarked ? 'Remove bookmark' : 'Save bookmark'}
                          className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5"
                        >
                          {bookmarked ? (
                            <BookmarkCheck className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Bookmark className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Title & Summary */}
                    <h2
                      onClick={() => onSelectArticle(article.id)}
                      className="text-sm font-bold text-slate-900 hover:text-indigo-700 transition-colors line-clamp-2 cursor-pointer"
                    >
                      {article.title}
                    </h2>

                    <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                      {article.summary ||
                        article.content.substring(0, 160) + '...'}
                    </p>

                    {/* Tags */}
                    {article.tags && article.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
                        {article.tags.slice(0, 3).map((tag, idx) => (
                          <span key={tag}>
                            #{tag}
                            {idx < Math.min(article.tags.length, 3) - 1 && (
                              <span className="ml-2" aria-hidden="true">
                                ·
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100/90 rounded-b-xl flex items-center justify-between text-[11px] text-slate-500 gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{article.authorName}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 tabular-nums">
                      {firstAttachment && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const ok = await triggerFileDownload(
                              firstAttachment.url,
                              firstAttachment.name
                            );
                            showToast(
                              ok
                                ? `Downloading "${firstAttachment.name}"`
                                : 'Unable to download attachment.',
                              ok ? 'success' : 'error'
                            );
                          }}
                          title={`Download attachment: ${firstAttachment.name}`}
                          className="inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span>{article.attachments?.length}</span>
                        </button>
                      )}

                      {canModify && onEditArticle && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditArticle(article);
                          }}
                          title="Edit document"
                          className="text-slate-400 hover:text-indigo-700 p-0.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canModify && onArchiveArticle && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = await confirmAction({
                              title:
                                article.status === 'archived'
                                  ? 'Restore Article'
                                  : 'Archive Article',
                              message:
                                article.status === 'archived'
                                  ? `Restore "${article.title}" from archive?`
                                  : `Archive "${article.title}"?`,
                              confirmLabel:
                                article.status === 'archived'
                                  ? 'Restore'
                                  : 'Archive',
                            });
                            if (confirmed) onArchiveArticle(article);
                          }}
                          title={
                            article.status === 'archived'
                              ? 'Restore from archive'
                              : 'Archive document'
                          }
                          className="text-slate-400 hover:text-amber-700 p-0.5"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canModify && onDeleteArticle && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = await confirmAction({
                              title: 'Delete Knowledge Document',
                              message: `Permanently delete "${article.title}" and its attachments?`,
                              confirmLabel: 'Delete',
                              danger: true,
                            });
                            if (confirmed) onDeleteArticle(article.id);
                          }}
                          title="Delete document"
                          className="text-slate-400 hover:text-rose-600 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        {article.viewsCount || 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
              <span>
                Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(safePage * ITEMS_PER_PAGE, filteredArticles.length)}{' '}
                of {filteredArticles.length} documents
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="px-2.5 font-semibold tabular-nums">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
