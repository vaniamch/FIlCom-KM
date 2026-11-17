import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  Home,
  X,
  Clock,
  FileText,
  BookOpen,
  Calendar,
  Lightbulb,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  ActivityLog,
  PageRoute,
  KnowledgeArticle,
  DocumentItem,
  CampusEvent,
  LessonLearned,
} from '../../types';

interface HeaderProps {
  currentPage: PageRoute;
  onToggleMobile: () => void;
  onOpenAuth: () => void;
  onNavigateHome: () => void;
  onNavigate: (page: PageRoute, targetId?: string) => void;
  onOpenProfile: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activityLogs: ActivityLog[];
  draftCount?: number;
  articles?: KnowledgeArticle[];
  documents?: DocumentItem[];
  events?: CampusEvent[];
  lessons?: LessonLearned[];
  onPreviewDocument?: (docItem: DocumentItem) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobile,
  onOpenAuth,
  onNavigateHome,
  onNavigate,
  onOpenProfile,
  searchQuery,
  onSearchChange,
  activityLogs,
  draftCount = 0,
  articles = [],
  documents = [],
  events = [],
  lessons = [],
  onPreviewDocument,
}) => {
  const { currentUser, userProfile, isEditor, isAdmin } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut: Cmd+K / Ctrl+K focuses search input, Escape closes dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    if (notificationsOpen || searchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationsOpen, searchOpen]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const matches: Array<{
      id: string;
      type: 'knowledge' | 'sop' | 'document' | 'event' | 'lesson';
      title: string;
      subtitle: string;
      action: () => void;
    }> = [];

    articles.forEach((art) => {
      const hay = [
        art.title,
        art.summary,
        art.content,
        art.sopNumber,
        art.categoryName,
        art.department,
        art.authorName,
        ...(art.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: `art-${art.id}`,
          type: art.isSOP ? 'sop' : 'knowledge',
          title: art.sopNumber ? `${art.sopNumber} · ${art.title}` : art.title,
          subtitle: `${art.isSOP ? 'SOP' : 'Knowledge'} · ${art.categoryName} · ${art.status}`,
          action: () => onNavigate('knowledge-detail', art.id),
        });
      }
    });

    documents.forEach((docItem) => {
      const hay = [
        docItem.title,
        docItem.fileName,
        docItem.description,
        docItem.categoryName,
        docItem.authorName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: `doc-${docItem.id}`,
          type: 'document',
          title: docItem.title,
          subtitle: `Document · ${docItem.fileName} · ${docItem.categoryName}`,
          action: () =>
            onPreviewDocument ? onPreviewDocument(docItem) : onNavigate('documents'),
        });
      }
    });

    events.forEach((evt) => {
      const hay = [
        evt.title,
        evt.description,
        evt.committee,
        evt.academicYear,
        evt.outcomes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: `evt-${evt.id}`,
          type: 'event',
          title: evt.title,
          subtitle: `Event · ${evt.committee} · ${evt.academicYear}`,
          action: () => onNavigate('events'),
        });
      }
    });

    lessons.forEach((lsn) => {
      const hay = [
        lsn.activityTitle,
        lsn.challenges,
        lsn.solutions,
        lsn.recommendations,
        lsn.categoryName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: `lsn-${lsn.id}`,
          type: 'lesson',
          title: lsn.activityTitle,
          subtitle: `Lesson Learned · ${lsn.categoryName}`,
          action: () => onNavigate('lessons'),
        });
      }
    });

    return matches.slice(0, 10);
  }, [searchQuery, articles, documents, events, lessons, onNavigate, onPreviewDocument]);

  const recentLogs = activityLogs.slice(0, 6);
  const badgeCount = Math.min(99, recentLogs.length + (isEditor ? draftCount : 0));

  const handleLogClick = (log: ActivityLog) => {
    setNotificationsOpen(false);
    if (log.entityType === 'knowledge' && log.entityId) {
      onNavigate('knowledge-detail', log.entityId);
    } else if (log.entityType === 'document') {
      onNavigate('documents');
    } else if (log.entityType === 'event') {
      onNavigate('events');
    } else if (log.entityType === 'lesson') {
      onNavigate('lessons');
    } else {
      onNavigate('dashboard');
    }
  };

  const getEntityIcon = (entityType: ActivityLog['entityType']) => {
    switch (entityType) {
      case 'document':
        return <FileText className="w-3.5 h-3.5 text-sky-600" />;
      case 'event':
        return <Calendar className="w-3.5 h-3.5 text-indigo-600" />;
      case 'lesson':
        return <Lightbulb className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <BookOpen className="w-3.5 h-3.5 text-indigo-700" />;
    }
  };

  const getSearchResultIcon = (type: 'knowledge' | 'sop' | 'document' | 'event' | 'lesson') => {
    switch (type) {
      case 'sop':
        return <ClipboardList className="w-3.5 h-3.5 text-indigo-700" />;
      case 'document':
        return <FileText className="w-3.5 h-3.5 text-sky-600" />;
      case 'event':
        return <Calendar className="w-3.5 h-3.5 text-purple-600" />;
      case 'lesson':
        return <Lightbulb className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <BookOpen className="w-3.5 h-3.5 text-indigo-700" />;
    }
  };

  return (
    <header className="h-18 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 bg-[#ebf1fd]/85 backdrop-blur-md border-b border-white/60 no-print">
      {/* Zone 1: Mobile Hamburger & Landing Page Switch */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleMobile}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 bg-white/80 rounded-xl border border-white/80 shadow-2xs transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={onNavigateHome}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white/80 hover:bg-white border border-white/80 rounded-full shadow-2xs transition-all"
        >
          <Home className="w-3.5 h-3.5 text-indigo-700" />
          <span>Landing Page</span>
        </button>
      </div>

      {/* Zone 2: Pill-shaped Glass Search Bar + Global Search Results Dropdown */}
      <div className="flex-1 max-w-xl mx-2" ref={searchContainerRef}>
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search guides, SOP numbers, files, events..."
            className="w-full pl-10 pr-16 py-2 text-xs bg-white/80 hover:bg-white focus:bg-white text-slate-900 placeholder-slate-400 border border-white/90 focus:border-indigo-400 rounded-full focus:outline-none shadow-[0_2px_12px_-2px_rgba(79,114,205,0.06)] transition-all font-medium"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                setSearchOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-full"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 pointer-events-none">
              ⌘ K
            </span>
          )}

          {searchOpen && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">
                  Global Search Results ({searchResults.length})
                </span>
                <span>ESC to close</span>
              </div>
              {searchResults.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500">
                  No matching Knowledge, SOP, Document, Event, or Lesson found for "{searchQuery}".
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        res.action();
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        {getSearchResultIcon(res.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {res.title}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 capitalize">
                          {res.subtitle}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zone 3: Real Notifications Popover & User Account Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Notification Bell with Activity Popover */}
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            className="w-9 h-9 rounded-full bg-white/80 hover:bg-white border border-white/80 flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-2xs transition-colors"
            aria-label="Activity notifications"
          >
            <Bell className="w-4 h-4" />
          </button>
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs pointer-events-none">
              {badgeCount}
            </span>
          )}

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Committee Activity</h3>
                  <p className="text-[10px] text-slate-500">FilCom Knowledge Management Updates</p>
                </div>
                {isEditor && draftCount > 0 && (
                  <button
                    onClick={() => {
                      setNotificationsOpen(false);
                      onNavigate(isAdmin ? 'admin' : 'knowledge');
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200"
                  >
                    {draftCount} Draft{draftCount > 1 ? 's' : ''} Pending
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {recentLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No recent activity recorded yet.
                  </div>
                ) : (
                  recentLogs.map((log) => (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => handleLogClick(log)}
                      className="w-full p-3 text-left hover:bg-slate-50 transition-colors flex items-start gap-2.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        {getEntityIcon(log.entityType)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {log.action}
                        </p>
                        <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                          {log.details}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{log.userName}</span>
                          <span>·</span>
                          <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Lockup */}
        {currentUser ? (
          <div
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 pl-2 pr-1 py-1 rounded-full bg-white/80 hover:bg-white border border-white/90 shadow-2xs transition-all cursor-pointer"
          >
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.displayName}
                className="w-7 h-7 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-700 to-sky-500 text-white font-bold text-xs flex items-center justify-center">
                {userProfile?.displayName?.charAt(0).toUpperCase() || 'F'}
              </div>
            )}
            <div className="hidden sm:block text-left pr-1">
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {userProfile?.displayName || 'Committee Member'}
              </p>
              <p className="text-[10px] text-slate-500 leading-tight">
                {userProfile?.department || 'FilKom Day Committee'}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-full shadow-2xs transition-colors"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
