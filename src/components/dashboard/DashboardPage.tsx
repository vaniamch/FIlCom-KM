import React, { useMemo } from 'react';
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Users,
  Folder,
  Megaphone,
  HelpCircle,
  Download,
  Calendar,
  Flame,
  BarChart2,
  Lightbulb,
  ChevronRight,
  Building2,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import {
  KnowledgeArticle,
  DocumentItem,
  Category,
  ActivityLog,
  CampusEvent,
  PageRoute,
} from '../../types';
import { incrementDocumentDownloads } from '../../services/firestoreService';
import { triggerFileDownload } from '../../utils/fileActions';
import { formatFileSize } from '../../utils/fileUpload';

interface DashboardPageProps {
  articles: KnowledgeArticle[];
  documents: DocumentItem[];
  categories: Category[];
  events: CampusEvent[];
  activityLogs: ActivityLog[];
  onNavigate: (page: PageRoute, targetId?: string, knowledgeFilter?: string) => void;
  onOpenCreateArticle: () => void;
  onOpenUploadDocument: () => void;
  onPreviewDocument?: (docItem: DocumentItem) => void;
  onDownloadDocument?: (docId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  articles,
  documents,
  categories,
  events,
  onNavigate,
  onOpenCreateArticle,
  onPreviewDocument,
  onDownloadDocument,
}) => {
  const { isEditor } = useAuth();
  const { showToast } = useUI();

  const totalArticles = articles.length;
  const totalDocuments = documents.length;
  const totalDivisions = categories.length || 10;
  const publishedCount = articles.filter((a) => a.status === 'published').length;
  const sopCount = articles.filter((a) => a.isSOP).length;
  const publishRate =
    totalArticles > 0 ? Math.round((publishedCount / totalArticles) * 100) : 100;

  // Live latest announcements / published guides
  const latestAnnouncements = useMemo(() => {
    const active = articles.filter((a) => a.status !== 'archived');
    const sorted = [...active].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    );
    return sorted.slice(0, 3);
  }, [articles]);

  // Live popular documents sorted by downloadsCount desc
  const popularResources = useMemo(() => {
    const sorted = [...documents].sort((a, b) => {
      const diff = (b.downloadsCount || 0) - (a.downloadsCount || 0);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted.slice(0, 3);
  }, [documents]);

  // Live upcoming (or most recent) events
  const displayEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const upcoming = events
      .filter((e) => new Date(e.date).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (upcoming.length >= 2) {
      return upcoming.slice(0, 2);
    }
    const recent = [...events].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return recent.slice(0, 2);
  }, [events]);

  const handleDownloadResource = async (
    e: React.MouseEvent,
    docItem: DocumentItem
  ) => {
    e.stopPropagation();
    await incrementDocumentDownloads(docItem.id);
    onDownloadDocument?.(docItem.id);
    const ok = await triggerFileDownload(docItem.fileUrl, docItem.fileName);
    if (ok) {
      showToast(`Downloading "${docItem.fileName}"`, 'success');
    } else {
      showToast('Unable to download file URL.', 'error');
    }
  };

  const getFileBadgeStyle = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('pdf')) return 'bg-rose-500 text-white';
    if (t.includes('xls') || t.includes('csv')) return 'bg-emerald-600 text-white';
    if (t.includes('doc')) return 'bg-blue-600 text-white';
    if (t.includes('ppt')) return 'bg-amber-500 text-white';
    return 'bg-indigo-600 text-white';
  };

  const getRelativeEventBadge = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)}d ago`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Large Hero Banner - Clean blue and white design */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#d9e5fc] via-[#e5eefd] to-[#edf4fe] border border-white/90 shadow-[0_8px_30px_rgb(79,114,205,0.08)] p-6 sm:p-10 overflow-hidden">
        {/* Clean CSS blue glow accents - no image overlay */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-gradient-to-bl from-sky-200/50 via-indigo-100/30 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 right-1/4 w-60 h-60 bg-gradient-to-tr from-blue-200/40 via-sky-100/20 to-transparent rounded-full blur-2xl pointer-events-none" />

        {/* Hero Content */}
        <div className="relative z-10 max-w-xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 backdrop-blur-md border border-white/80 text-[11px] font-bold text-indigo-900 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-500 fill-sky-400" />
            <span>FilCom Knowledge Hub · FilKom Day Committee</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-[#0b132b] tracking-tight leading-tight">
            Knowledge. Together. Better.
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
            Find what you need, share what you know, and grow as a committee.
          </p>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => onNavigate('knowledge')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-full shadow-[0_4px_14px_rgba(11,19,43,0.2)] transition-all transform hover:-translate-y-0.5"
            >
              <span>Explore Knowledge Base</span>
              <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
            </button>

            {isEditor && (
              <button
                onClick={onOpenCreateArticle}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white/80 hover:bg-white backdrop-blur-sm border border-white/80 rounded-full transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-700" />
                <span>Write Guide</span>
              </button>
            )}
          </div>
        </div>

        {/* Floating Glassmorphism Quote Card on Right */}
        <div className="hidden lg:block absolute right-6 top-8 max-w-[260px] z-20">
          <div className="p-4 rounded-2xl bg-white/75 backdrop-blur-md border border-white/90 shadow-[0_8px_25px_-5px_rgba(79,114,205,0.15)] text-xs text-slate-700 font-medium italic leading-relaxed">
            “ A well-informed committee builds a greater impact. ”
          </div>
        </div>
      </div>

      {/* 2. Quick Access Row (5 Frosted Glass Cards from screenshot) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Quick Access
            </h2>
          </div>
          <button
            onClick={() => onNavigate('knowledge')}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Knowledge Base */}
          <div
            onClick={() => onNavigate('knowledge')}
            className="group p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_16px_-4px_rgba(79,114,205,0.06)] hover:shadow-[0_8px_24px_-4px_rgba(79,114,205,0.12)] hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                Knowledge Base
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Guides, SOP, and tips
              </p>
            </div>
          </div>

          {/* Card 2: SOP Workflows */}
          <div
            onClick={() => onNavigate('knowledge', undefined, 'sop')}
            className="group p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_16px_-4px_rgba(79,114,205,0.06)] hover:shadow-[0_8px_24px_-4px_rgba(79,114,205,0.12)] hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                SOP Workflows
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Procedures across {totalDivisions} divisions
              </p>
            </div>
          </div>

          {/* Card 3: Documentation */}
          <div
            onClick={() => onNavigate('documents')}
            className="group p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_16px_-4px_rgba(79,114,205,0.06)] hover:shadow-[0_8px_24px_-4px_rgba(79,114,205,0.12)] hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <Folder className="w-4 h-4" />
              </div>
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                Documentation
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Reports & archives
              </p>
            </div>
          </div>

          {/* Card 4: Announcements & Events */}
          <div
            onClick={() => onNavigate('events')}
            className="group p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_16px_-4px_rgba(79,114,205,0.06)] hover:shadow-[0_8px_24px_-4px_rgba(79,114,205,0.12)] hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Megaphone className="w-4 h-4" />
              </div>
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                Announcements
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Important updates
              </p>
            </div>
          </div>

          {/* Card 5: FAQ & Lessons */}
          <div
            onClick={() => onNavigate('lessons')}
            className="group p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_16px_-4px_rgba(79,114,205,0.06)] hover:shadow-[0_8px_24px_-4px_rgba(79,114,205,0.12)] hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                FAQ & Wisdom
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Common questions & tips
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle 3-Column Section matching the Reference Image */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: Latest Announcements (Live from Knowledge & SOP DB) */}
        <div className="p-5 rounded-3xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-bold text-slate-900">Latest Updates</h3>
              </div>
              <button
                onClick={() => onNavigate('knowledge')}
                className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {latestAnnouncements.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No knowledge entries yet.
                </p>
              ) : (
                latestAnnouncements.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigate('knowledge-detail', item.id)}
                    className="p-2.5 rounded-xl hover:bg-slate-50/80 transition-colors flex items-start gap-3 cursor-pointer"
                  >
                    <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] shrink-0 tabular-nums">
                      {new Date(item.updatedAt || item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.title}
                        </p>
                        {idx === 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-700 shrink-0">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {item.summary || `${item.categoryName} · ${item.authorName}`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 self-center" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Popular Resources (Live from Documents DB) */}
        <div className="p-5 rounded-3xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-900">Popular Resources</h3>
              </div>
              <button
                onClick={() => onNavigate('documents')}
                className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {popularResources.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No uploaded documents yet.
                </p>
              ) : (
                popularResources.map((docItem) => (
                  <div
                    key={docItem.id}
                    onClick={() =>
                      onPreviewDocument ? onPreviewDocument(docItem) : onNavigate('documents')
                    }
                    className="p-2.5 rounded-xl hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg font-extrabold text-[9px] flex items-center justify-center shrink-0 uppercase ${getFileBadgeStyle(
                          docItem.fileType
                        )}`}
                      >
                        {(docItem.fileType || 'FILE').substring(0, 4)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {docItem.fileName || docItem.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          {formatFileSize(docItem.fileSize || 0)} · {docItem.downloadsCount || 0} downloads
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDownloadResource(e, docItem)}
                      title={`Download ${docItem.fileName}`}
                      className="p-1.5 text-slate-400 hover:text-indigo-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Upcoming Events (Live from Events DB) */}
        <div className="p-5 rounded-3xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900">Events & Timeline</h3>
              </div>
              <button
                onClick={() => onNavigate('events')}
                className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {displayEvents.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No events logged yet.
                </p>
              ) : (
                displayEvents.map((evt) => {
                  const evtDate = new Date(evt.date);
                  const monthLabel = isNaN(evtDate.getTime())
                    ? 'EVT'
                    : evtDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                  const dayLabel = isNaN(evtDate.getTime()) ? '--' : evtDate.getDate();

                  return (
                    <div
                      key={evt.id}
                      onClick={() => onNavigate('events')}
                      className="p-2.5 rounded-xl hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="px-2 py-1.5 rounded-xl bg-slate-100 text-center shrink-0 min-w-[42px]">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase leading-none">
                            {monthLabel}
                          </span>
                          <span className="block text-sm font-extrabold text-slate-900 tabular-nums leading-tight">
                            {dayLabel}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {evt.title}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {evt.committee} · {evt.academicYear}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                        {getRelativeEventBadge(evt.date)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('events')}
            className="mt-4 w-full py-2 text-center text-xs font-bold text-slate-700 hover:text-indigo-900 bg-slate-100/70 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <span>View Calendar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Bottom Row: KMS Overview & About KMS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* KMS Overview Stats (5 cols on desktop) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <BarChart2 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900">KMS Overview</h3>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 text-center">
            <div>
              <span className="block text-2xl sm:text-3xl font-extrabold text-[#0b132b] tabular-nums">
                {totalArticles + totalDocuments}
              </span>
              <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                Resources Available
              </span>
            </div>
            <div>
              <span className="block text-2xl sm:text-3xl font-extrabold text-[#0b132b] tabular-nums">
                {totalDivisions}
              </span>
              <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                Divisions ({sopCount} SOPs)
              </span>
            </div>
            <div>
              <span className="block text-2xl sm:text-3xl font-extrabold text-[#0b132b] tabular-nums">
                {publishRate}%
              </span>
              <span className="text-[11px] font-medium text-slate-500 mt-1 block">
                Published ({publishedCount}/{totalArticles})
              </span>
            </div>
          </div>
        </div>

        {/* About KMS (7 cols on desktop with subtle architectural graphic) */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-3 max-w-sm">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-900">About KMS</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              A centralized hub for our committee — because great things happen when we're informed.
            </p>
            <button
              onClick={() => onNavigate('landing')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 transition-colors"
            >
              <span>Learn More</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Campus Architectural Illustration */}
          <div className="w-40 sm:w-48 h-24 rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-100 flex items-center justify-center text-indigo-400 shrink-0">
            <Building2 className="w-12 h-12 opacity-60" />
          </div>
        </div>
      </div>
    </div>
  );
};
