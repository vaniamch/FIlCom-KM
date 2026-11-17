/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider, useUI } from './context/UIContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { KnowledgeHubPage } from './components/knowledge/KnowledgeHubPage';
import { KnowledgeDetailPage } from './components/knowledge/KnowledgeDetailPage';
import { KnowledgeEditorModal } from './components/knowledge/KnowledgeEditorModal';
import { DocumentRepositoryPage } from './components/documents/DocumentRepositoryPage';
import { DocumentUploadModal } from './components/documents/DocumentUploadModal';
import { DocumentPreviewModal } from './components/documents/DocumentPreviewModal';
import { EventArchivePage } from './components/events/EventArchivePage';
import { EventModal } from './components/events/EventModal';
import { LessonsLearnedPage } from './components/lessons/LessonsLearnedPage';
import { LessonModal } from './components/lessons/LessonModal';
import { BookmarksPage } from './components/bookmarks/BookmarksPage';
import { AdminDashboardPage } from './components/admin/AdminDashboardPage';
import { UserProfileModal } from './components/profile/UserProfileModal';
import { AuthModal } from './components/auth/AuthModal';
import { LandingPage } from './components/landing/LandingPage';

import {
  PageRoute,
  KnowledgeArticle,
  Category,
  DocumentItem,
  CampusEvent,
  LessonLearned,
  Bookmark,
  ActivityLog,
  ArticleStatus,
  DocumentAttachment,
} from './types';

import {
  getArticles,
  getCategories,
  getDocuments,
  getEvents,
  getLessons,
  getUserBookmarks,
  getActivityLogs,
  createArticle,
  updateArticle,
  deleteArticle,
  createDocumentItem,
  deleteDocumentItem,
  createEvent,
  updateEvent,
  deleteEvent,
  createLesson,
  updateLesson,
  deleteLesson,
  toggleBookmark,
  removeBookmark,
  logActivity,
} from './services/firestoreService';
import { checkAndSeedDatabase } from './services/seedService';

interface ParsedLocation {
  page: PageRoute;
  targetId?: string;
  knowledgeFilter?: string;
  wasProtectedPath: boolean;
}

function parseLocationToRoute(pathname: string): ParsedLocation {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') {
    return { page: 'landing', wasProtectedPath: false };
  }
  if (clean === '/dashboard') {
    return { page: 'dashboard', wasProtectedPath: true };
  }
  if (clean === '/knowledge') {
    return { page: 'knowledge', wasProtectedPath: true };
  }
  if (clean.startsWith('/knowledge/')) {
    const id = decodeURIComponent(clean.slice('/knowledge/'.length));
    return id
      ? { page: 'knowledge-detail', targetId: id, wasProtectedPath: true }
      : { page: 'knowledge', wasProtectedPath: true };
  }
  if (clean === '/sop') {
    return { page: 'knowledge', knowledgeFilter: 'sop', wasProtectedPath: true };
  }
  if (clean === '/documents') {
    return { page: 'documents', wasProtectedPath: true };
  }
  if (clean === '/events') {
    return { page: 'events', wasProtectedPath: true };
  }
  if (clean === '/lessons') {
    return { page: 'lessons', wasProtectedPath: true };
  }
  if (clean === '/bookmarks') {
    return { page: 'bookmarks', wasProtectedPath: true };
  }
  if (clean === '/admin') {
    return { page: 'admin', wasProtectedPath: true };
  }
  return { page: 'dashboard', wasProtectedPath: true };
}

function routeToPath(page: PageRoute, targetId?: string): string {
  switch (page) {
    case 'landing':
      return '/';
    case 'dashboard':
      return '/dashboard';
    case 'knowledge':
      return '/knowledge';
    case 'knowledge-detail':
      return targetId ? `/knowledge/${encodeURIComponent(targetId)}` : '/knowledge';
    case 'documents':
      return '/documents';
    case 'events':
      return '/events';
    case 'lessons':
      return '/lessons';
    case 'bookmarks':
      return '/bookmarks';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught application error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-6 text-center space-y-4">
            <h2 className="text-base font-bold text-slate-900">Something went wrong</h2>
            <p className="text-xs text-slate-600 leading-relaxed break-words">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-lg"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const {
    currentUser,
    userProfile,
    loading: authLoading,
    isAdmin,
    isEditor,
    isDeactivated,
  } = useAuth();
  const { showToast } = useUI();

  const initialParsed = parseLocationToRoute(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  // Navigation State - Protected internal routes wait on authentication
  const [currentPage, setCurrentPage] = useState<PageRoute>(initialParsed.page);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    initialParsed.targetId || null
  );
  const [knowledgeTypeFilter, setKnowledgeTypeFilter] = useState<string>(
    initialParsed.knowledgeFilter || 'active'
  );
  const [pendingRoute, setPendingRoute] = useState<{
    page: PageRoute;
    targetId?: string;
    knowledgeFilter?: string;
  } | null>(
    initialParsed.wasProtectedPath
      ? {
          page: initialParsed.page,
          targetId: initialParsed.targetId,
          knowledgeFilter: initialParsed.knowledgeFilter,
        }
      : null
  );
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Data Store
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [userBookmarks, setUserBookmarks] = useState<Bookmark[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Modals
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [defaultIsSOP, setDefaultIsSOP] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentItem | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CampusEvent | null>(null);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonLearned | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const clearWorkspaceState = useCallback(() => {
    setArticles([]);
    setCategories([]);
    setDocuments([]);
    setEvents([]);
    setLessons([]);
    setUserBookmarks([]);
    setActivityLogs([]);
    setGlobalSearch('');
    setSelectedArticleId(null);
    setIsArticleModalOpen(false);
    setEditingArticle(null);
    setIsDocumentModalOpen(false);
    setPreviewDocument(null);
    setIsEventModalOpen(false);
    setEditingEvent(null);
    setIsLessonModalOpen(false);
    setEditingLesson(null);
    setIsProfileModalOpen(false);
  }, []);

  // Load Database Records (Authenticated & Active users only)
  const loadAllData = useCallback(async () => {
    if (!currentUser || isDeactivated) {
      clearWorkspaceState();
      return;
    }

    setDataLoading(true);
    try {
      const [arts, cats, docs, evts, lsns, logs, bms] = await Promise.all([
        getArticles({
          viewer: { role: userProfile?.role || 'member', uid: currentUser.uid },
        }),
        getCategories(),
        getDocuments(),
        getEvents(),
        getLessons(),
        getActivityLogs(25),
        getUserBookmarks(currentUser.uid),
      ]);

      setArticles(arts);
      setCategories(cats);
      setDocuments(docs);
      setEvents(evts);
      setLessons(lsns);
      setActivityLogs(logs);
      setUserBookmarks(bms);
    } catch (err) {
      console.error('Error loading Firestore data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [currentUser, isDeactivated, userProfile?.role, clearWorkspaceState]);

  // Browser back/forward popstate listener
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseLocationToRoute(window.location.pathname);
      if (parsed.page !== 'landing' && (!currentUser || isDeactivated)) {
        setPendingRoute({
          page: parsed.page,
          targetId: parsed.targetId,
          knowledgeFilter: parsed.knowledgeFilter,
        });
        setCurrentPage('landing');
        window.history.replaceState({}, '', '/');
        setIsAuthModalOpen(true);
        return;
      }
      if (parsed.page === 'admin' && !isAdmin) {
        setCurrentPage('dashboard');
        window.history.replaceState({}, '', '/dashboard');
        return;
      }
      setCurrentPage(parsed.page);
      setSelectedArticleId(parsed.targetId || null);
      if (parsed.knowledgeFilter) {
        setKnowledgeTypeFilter(parsed.knowledgeFilter);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, isDeactivated, isAdmin]);

  // Strict Auth & Route Protection Gate
  useEffect(() => {
    if (authLoading) return;

    if (!currentUser || isDeactivated) {
      clearWorkspaceState();
      if (currentPage !== 'landing') {
        if (!currentUser && !pendingRoute) {
          setPendingRoute({
            page: currentPage,
            targetId: selectedArticleId || undefined,
          });
        }
        setCurrentPage('landing');
        window.history.replaceState({}, '', '/');
        setIsAuthModalOpen(true);
        if (isDeactivated) {
          showToast('Your account has been deactivated by an administrator.', 'error');
        }
      }
      return;
    }

    // Authenticated & active: resolve pending redirect if any
    if (pendingRoute) {
      const targetPage =
        pendingRoute.page === 'admin' && !isAdmin
          ? 'dashboard'
          : pendingRoute.page === 'landing'
          ? 'dashboard'
          : pendingRoute.page;
      const targetPath = routeToPath(targetPage, pendingRoute.targetId);
      setCurrentPage(targetPage);
      setSelectedArticleId(pendingRoute.targetId || null);
      setKnowledgeTypeFilter(pendingRoute.knowledgeFilter || 'active');
      window.history.replaceState({}, '', targetPath);
      setPendingRoute(null);
      setIsAuthModalOpen(false);
      return;
    }

    // Enforce Admin Console access guard
    if (currentPage === 'admin' && !isAdmin) {
      setCurrentPage('dashboard');
      window.history.replaceState({}, '', '/dashboard');
      showToast('Access denied: Administrator privileges required.', 'error');
    }
  }, [
    authLoading,
    currentUser,
    isDeactivated,
    isAdmin,
    currentPage,
    selectedArticleId,
    pendingRoute,
    clearWorkspaceState,
    showToast,
  ]);

  // Initial Load & Admin Seed check once authenticated + active
  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || isDeactivated || !userProfile) {
      clearWorkspaceState();
      return;
    }

    let cancelled = false;
    const init = async () => {
      if (isAdmin) {
        await checkAndSeedDatabase(
          currentUser.uid,
          userProfile.displayName || currentUser.displayName || 'Executive Board',
          true
        );
      }
      if (!cancelled) {
        await loadAllData();
      }
    };
    init();

    return () => {
      cancelled = true;
    };
  }, [authLoading, currentUser?.uid, isDeactivated, userProfile?.role, isAdmin, loadAllData, clearWorkspaceState]);

  // Handle navigation with authentication & RBAC enforcement
  const navigateTo = useCallback(
    (page: PageRoute, targetId?: string, knowledgeFilter?: string) => {
      if (page !== 'landing' && (!currentUser || isDeactivated)) {
        setPendingRoute({ page, targetId, knowledgeFilter });
        setCurrentPage('landing');
        if (window.location.pathname !== '/') {
          window.history.replaceState({}, '', '/');
        }
        setIsAuthModalOpen(true);
        if (isDeactivated) {
          showToast('Your account has been deactivated by an administrator.', 'error');
        }
        return;
      }

      if (page === 'admin' && !isAdmin) {
        showToast('Access denied: Administrator privileges required.', 'error');
        setCurrentPage('dashboard');
        window.history.pushState({}, '', '/dashboard');
        return;
      }

      setKnowledgeTypeFilter(knowledgeFilter || 'active');
      setCurrentPage(page);
      setSelectedArticleId(targetId || null);

      const nextPath = routeToPath(page, targetId);
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentUser, isDeactivated, isAdmin, showToast]
  );

  const handleOpenAuthModal = () => {
    setIsAuthModalOpen(true);
  };

  const handleEnterFromLanding = (targetPage?: PageRoute, knowledgeFilter?: string) => {
    const destination = targetPage || 'dashboard';
    if (!currentUser || isDeactivated) {
      setPendingRoute({ page: destination, knowledgeFilter });
      setIsAuthModalOpen(true);
      if (isDeactivated) {
        showToast('Your account has been deactivated by an administrator.', 'error');
      }
      return;
    }
    navigateTo(destination, undefined, knowledgeFilter);
  };

  const handlePreviewAttachment = (att: DocumentAttachment, sourceCategory?: string) => {
    const ext = (att.name.split('.').pop() || '').toLowerCase();
    setPreviewDocument({
      id: `att_${Date.now()}`,
      title: att.name,
      description: 'Attachment Preview',
      fileUrl: att.url,
      fileName: att.name,
      fileType: ext || att.type || 'bin',
      fileSize: att.size ?? 0,
      categoryId: 'attachment',
      categoryName: sourceCategory || 'Attachment',
      createdBy: currentUser?.uid || '',
      authorId: currentUser?.uid || '',
      authorName: userProfile?.displayName || 'Committee Member',
      downloadsCount: 0,
      createdAt: new Date().toISOString(),
    });
  };

  // Article / SOP Actions
  const handleSaveArticle = async (
    articleData: Partial<KnowledgeArticle> & { _changeNote?: string }
  ) => {
    if (!currentUser || isDeactivated || !isEditor) {
      throw new Error('Permission denied: Only active Editors or Admins can save knowledge documents.');
    }

    const { _changeNote, ...cleanData } = articleData;
    const editorName = userProfile?.displayName || currentUser.displayName || 'Committee Editor';
    try {
      if (editingArticle) {
        await updateArticle(editingArticle.id, cleanData, {
          editorName,
          changeNote: _changeNote,
        });
        logActivity({
          userId: currentUser.uid,
          userName: editorName,
          userEmail: currentUser.email || '',
          action: cleanData.isSOP ? 'Updated SOP' : 'Updated Knowledge',
          entityType: 'knowledge',
          entityId: editingArticle.id,
          details: `Revised "${cleanData.title || editingArticle.title}"${_changeNote ? ` (${_changeNote})` : ''}`,
        }).catch(() => {});
        showToast(
          cleanData.isSOP ? 'SOP updated successfully.' : 'Knowledge document updated.',
          'success'
        );
      } else {
        const newArt = await createArticle({
          title: cleanData.title || 'Untitled Knowledge Document',
          content: cleanData.content || '',
          summary: cleanData.summary || '',
          categoryId: cleanData.categoryId || 'cat_leader',
          categoryName: cleanData.categoryName || 'Leader',
          department: cleanData.department || cleanData.categoryName || 'Leader',
          knowledgeType: cleanData.knowledgeType || (cleanData.isSOP ? 'SOP' : 'Guide'),
          tags: cleanData.tags || [],
          createdBy: currentUser.uid,
          authorId: currentUser.uid,
          authorName: editorName,
          authorEmail: currentUser.email || '',
          status: cleanData.status || 'published',
          attachments: cleanData.attachments || [],
          isSOP: !!cleanData.isSOP,
          sopNumber: cleanData.sopNumber,
          purpose: cleanData.purpose,
          scope: cleanData.scope,
          responsibilities: cleanData.responsibilities,
          references: cleanData.references,
          reviewer: cleanData.reviewer,
          approver: cleanData.approver,
          approvedBy: cleanData.approvedBy,
          approvedAt: cleanData.approvedAt,
          effectiveDate: cleanData.effectiveDate,
          reviewDate: cleanData.reviewDate,
          revisionNumber: cleanData.revisionNumber,
          sopSteps: cleanData.sopSteps || [],
          targetCommittee: cleanData.targetCommittee || '',
        });

        logActivity({
          userId: currentUser.uid,
          userName: editorName,
          userEmail: currentUser.email || '',
          action: newArt.isSOP ? `Created SOP (${newArt.status})` : `Created Knowledge (${newArt.status})`,
          entityType: 'knowledge',
          entityId: newArt.id,
          details: `Saved "${newArt.title}" in ${newArt.categoryName}`,
        }).catch(() => {});
        showToast(
          newArt.status === 'draft'
            ? 'Saved as draft.'
            : newArt.isSOP
            ? `SOP saved with status "${newArt.status.replace('_', ' ')}".`
            : 'Knowledge document published.',
          'success'
        );
      }

      setEditingArticle(null);
      await loadAllData();
    } catch (err: any) {
      console.error('Error in handleSaveArticle:', err);
      throw err;
    }
  };

  const handleUpdateArticleStatus = async (
    article: KnowledgeArticle,
    nextStatus: ArticleStatus,
    extra?: Partial<KnowledgeArticle>,
    changeNote?: string
  ) => {
    if (!currentUser || isDeactivated || !isEditor) {
      showToast('Permission denied.', 'error');
      return;
    }

    const actorName = userProfile?.displayName || currentUser.displayName || 'Committee Reviewer';
    try {
      await updateArticle(
        article.id,
        { status: nextStatus, ...extra },
        { editorName: actorName, changeNote: changeNote || `Status -> ${nextStatus}` }
      );
      await logActivity({
        userId: currentUser.uid,
        userName: actorName,
        userEmail: currentUser.email || '',
        action: `Status: ${nextStatus.replace('_', ' ')}`,
        entityType: 'knowledge',
        entityId: article.id,
        details: `Updated "${article.title}" status to ${nextStatus}`,
      });
      await loadAllData();
      showToast(`Status updated to ${nextStatus.replace('_', ' ')}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status.', 'error');
      throw err;
    }
  };

  const handleArchiveArticle = async (article: KnowledgeArticle) => {
    const nextStatus: ArticleStatus =
      article.status === 'archived' ? 'draft' : 'archived';
    await handleUpdateArticleStatus(
      article,
      nextStatus,
      {},
      nextStatus === 'archived' ? 'Archived from active library' : 'Restored to draft'
    );
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!currentUser || isDeactivated || !isEditor) {
      showToast('Permission denied.', 'error');
      return;
    }

    try {
      await deleteArticle(articleId);
      await logActivity({
        userId: currentUser.uid,
        userName: userProfile?.displayName || 'Editor',
        userEmail: currentUser.email || '',
        action: 'Deleted Knowledge',
        entityType: 'knowledge',
        entityId: articleId,
        details: 'Removed article from hub',
      });
      await loadAllData();
      showToast('Article deleted.', 'success');
      navigateTo('knowledge');
    } catch (err: any) {
      showToast(`Delete failed: ${err?.message || err}`, 'error');
    }
  };

  // Document Actions
  const handleSaveDocument = async (
    docData: Omit<DocumentItem, 'id' | 'createdAt' | 'downloadsCount'>
  ) => {
    if (!currentUser || isDeactivated || !isEditor) {
      throw new Error('Permission denied: Only active Editors or Admins can upload documents.');
    }

    const newDoc = await createDocumentItem({
      ...docData,
      createdBy: currentUser.uid,
      authorId: currentUser.uid,
    });
    await logActivity({
      userId: currentUser.uid,
      userName: userProfile?.displayName || 'Contributor',
      userEmail: currentUser.email || '',
      action: 'Uploaded Document',
      entityType: 'document',
      entityId: newDoc.id,
      details: `Added "${newDoc.title}" to ${newDoc.categoryName}`,
    });
    await loadAllData();
    showToast(`Document "${newDoc.title}" uploaded to repository.`, 'success');
  };

  const handleDeleteDocument = async (docItem: DocumentItem) => {
    if (!currentUser || isDeactivated || !isEditor) {
      showToast('Permission denied.', 'error');
      return;
    }

    try {
      await deleteDocumentItem(docItem.id, docItem);
      await logActivity({
        userId: currentUser.uid,
        userName: userProfile?.displayName || 'Editor',
        userEmail: currentUser.email || '',
        action: 'Deleted Document',
        entityType: 'document',
        entityId: docItem.id,
        details: `Removed "${docItem.title}" from repository`,
      });
      if (previewDocument?.id === docItem.id) {
        setPreviewDocument(null);
      }
      await loadAllData();
      showToast(`Deleted "${docItem.title}".`, 'success');
    } catch (err: any) {
      showToast(`Delete document failed: ${err?.message || err}`, 'error');
    }
  };

  const handleDocumentDownloaded = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId ? { ...d, downloadsCount: (d.downloadsCount || 0) + 1 } : d
      )
    );
  };

  // Event Actions
  const handleSaveEvent = async (eventData: Omit<CampusEvent, 'id' | 'createdAt'>) => {
    if (!currentUser || isDeactivated || !isEditor) {
      throw new Error('Permission denied: Only active Editors or Admins can manage events.');
    }

    if (editingEvent) {
      await updateEvent(editingEvent.id, eventData);
      showToast('Event archive updated.', 'success');
    } else {
      const newEvt = await createEvent({
        ...eventData,
        createdBy: currentUser.uid,
        authorId: currentUser.uid,
      });
      await logActivity({
        userId: currentUser.uid,
        userName: userProfile?.displayName || 'Leader',
        userEmail: currentUser.email || '',
        action: 'Archived Event',
        entityType: 'event',
        entityId: newEvt.id,
        details: `Logged event "${newEvt.title}" (${newEvt.academicYear})`,
      });
      showToast('Event archived successfully.', 'success');
    }
    setEditingEvent(null);
    await loadAllData();
  };

  const handleDeleteEvent = async (id: string) => {
    if (!currentUser || isDeactivated || !isEditor) {
      showToast('Permission denied.', 'error');
      return;
    }

    try {
      await deleteEvent(id);
      await loadAllData();
      showToast('Event record deleted.', 'success');
    } catch (err: any) {
      showToast(`Delete event failed: ${err?.message || err}`, 'error');
    }
  };

  // Lesson Actions
  const handleSaveLesson = async (lessonData: Omit<LessonLearned, 'id' | 'createdAt'>) => {
    if (!currentUser || isDeactivated || !isEditor) {
      throw new Error('Permission denied: Only active Editors or Admins can manage lessons.');
    }

    if (editingLesson) {
      await updateLesson(editingLesson.id, lessonData);
      await logActivity({
        userId: currentUser.uid,
        userName: userProfile?.displayName || 'Leader',
        userEmail: currentUser.email || '',
        action: 'Updated Lesson',
        entityType: 'lesson',
        entityId: editingLesson.id,
        details: `Updated lesson: "${lessonData.activityTitle}"`,
      });
      showToast('Lesson learned updated.', 'success');
    } else {
      const newLsn = await createLesson({
        ...lessonData,
        createdBy: currentUser.uid,
        authorId: currentUser.uid,
      });
      await logActivity({
        userId: currentUser.uid,
        userName: userProfile?.displayName || 'Leader',
        userEmail: currentUser.email || '',
        action: 'Shared Lesson',
        entityType: 'lesson',
        entityId: newLsn.id,
        details: `Logged wisdom: "${newLsn.activityTitle}"`,
      });
      showToast('Lesson learned submitted.', 'success');
    }
    setEditingLesson(null);
    await loadAllData();
  };

  const handleDeleteLesson = async (id: string) => {
    if (!currentUser || isDeactivated || !isEditor) {
      showToast('Permission denied.', 'error');
      return;
    }

    try {
      await deleteLesson(id);
      await loadAllData();
      showToast('Lesson entry deleted.', 'success');
    } catch (err: any) {
      showToast(`Delete lesson failed: ${err?.message || err}`, 'error');
    }
  };

  // Bookmark Toggle
  const handleToggleBookmark = async (
    targetId: string,
    title: string,
    targetType: 'knowledge' | 'document' | 'sop' | 'lesson' = 'knowledge'
  ) => {
    if (!currentUser || isDeactivated) {
      showToast('Please sign in to save bookmarks.', 'info');
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const added = await toggleBookmark(currentUser.uid, targetId, targetType, title);
      const updatedBookmarks = await getUserBookmarks(currentUser.uid);
      setUserBookmarks(updatedBookmarks);
      showToast(added ? `Saved "${title}" to bookmarks.` : `Removed "${title}" from bookmarks.`, 'success');
    } catch (err: any) {
      console.error('Bookmark toggle error:', err);
      showToast('Failed to update bookmark.', 'error');
    }
  };

  const handleRemoveBookmark = async (bookmarkId: string) => {
    if (!currentUser || isDeactivated) return;
    try {
      await removeBookmark(bookmarkId);
      const updated = await getUserBookmarks(currentUser.uid);
      setUserBookmarks(updated);
      showToast('Bookmark removed.', 'success');
    } catch (err: any) {
      console.error('Remove bookmark error:', err);
      showToast('Failed to remove bookmark.', 'error');
    }
  };

  // Active article for detail view
  const currentArticle = articles.find((a) => a.id === selectedArticleId);
  const relatedDocs = currentArticle
    ? documents.filter((d) => d.categoryId === currentArticle.categoryId)
    : [];
  const draftCount = articles.filter((a) =>
    ['draft', 'pending_review', 'in_review'].includes(a.status)
  ).length;

  // Wait for auth hydration when landing on a protected URL so authenticated refreshes don't flash Landing
  if (authLoading && currentPage !== 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#ebf1fd] via-[#f3f6fe] to-[#e7edfa] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Public Landing Page (and hard fallback when unauthenticated or deactivated)
  if (currentPage === 'landing' || !currentUser || isDeactivated) {
    return (
      <div className="min-h-screen w-full bg-[#dce4f6] text-slate-900">
        <LandingPage
          onEnterKMS={(targetPage, filter) => handleEnterFromLanding(targetPage, filter)}
          onOpenAuth={handleOpenAuthModal}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => {
            setIsAuthModalOpen(false);
            if (!currentUser) {
              setPendingRoute(null);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ebf1fd] via-[#f3f6fe] to-[#e7edfa] text-slate-900 flex print:bg-none print:bg-white">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => navigateTo(page)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenAuth={handleOpenAuthModal}
      />

      {/* Main Viewport Container (with left margin for 256px sidebar on desktop) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 print:pl-0">
        {/* Top Header Bar */}
        <Header
          currentPage={currentPage}
          onToggleMobile={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onOpenAuth={handleOpenAuthModal}
          onNavigateHome={() => navigateTo('landing')}
          onNavigate={(page, targetId) => navigateTo(page, targetId)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          searchQuery={globalSearch}
          onSearchChange={(q) => setGlobalSearch(q)}
          activityLogs={activityLogs}
          draftCount={draftCount}
          articles={articles}
          documents={documents}
          events={events}
          lessons={lessons}
          onPreviewDocument={(docItem) => setPreviewDocument(docItem)}
        />

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 print:p-0">
          {dataLoading ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-900 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-500">
                Loading FilCom Knowledge Management...
              </p>
            </div>
          ) : (
            <>
              {currentPage === 'dashboard' && (
                <DashboardPage
                  articles={articles}
                  documents={documents}
                  categories={categories}
                  events={events}
                  activityLogs={activityLogs}
                  onNavigate={navigateTo}
                  onOpenCreateArticle={() => {
                    if (!isEditor) return;
                    setDefaultIsSOP(false);
                    setEditingArticle(null);
                    setIsArticleModalOpen(true);
                  }}
                  onOpenUploadDocument={() => {
                    if (!isEditor) return;
                    setIsDocumentModalOpen(true);
                  }}
                  onPreviewDocument={(docItem) => setPreviewDocument(docItem)}
                  onDownloadDocument={handleDocumentDownloaded}
                />
              )}

              {currentPage === 'knowledge' && (
                <KnowledgeHubPage
                  articles={articles}
                  categories={categories}
                  userBookmarks={userBookmarks}
                  initialTypeFilter={knowledgeTypeFilter}
                  onSelectArticle={(id) => navigateTo('knowledge-detail', id)}
                  onOpenCreateArticle={(openAsSop) => {
                    if (!isEditor) return;
                    setDefaultIsSOP(!!openAsSop);
                    setEditingArticle(null);
                    setIsArticleModalOpen(true);
                  }}
                  onEditArticle={(art) => {
                    if (!isEditor) return;
                    setDefaultIsSOP(!!art.isSOP);
                    setEditingArticle(art);
                    setIsArticleModalOpen(true);
                  }}
                  onArchiveArticle={handleArchiveArticle}
                  onDeleteArticle={handleDeleteArticle}
                  onToggleBookmark={(id, title) => handleToggleBookmark(id, title, 'knowledge')}
                  globalSearch={globalSearch}
                />
              )}

              {currentPage === 'knowledge-detail' && currentArticle && (
                <KnowledgeDetailPage
                  article={currentArticle}
                  relatedDocuments={relatedDocs}
                  userBookmarks={userBookmarks}
                  onBack={() => navigateTo('knowledge')}
                  onEdit={(art) => {
                    if (!isEditor) return;
                    setDefaultIsSOP(!!art.isSOP);
                    setEditingArticle(art);
                    setIsArticleModalOpen(true);
                  }}
                  onDelete={handleDeleteArticle}
                  onUpdateStatus={handleUpdateArticleStatus}
                  onToggleBookmark={(id, title) => handleToggleBookmark(id, title, 'knowledge')}
                  onPreviewDocument={(docItem) => setPreviewDocument(docItem)}
                />
              )}

              {currentPage === 'knowledge-detail' && !currentArticle && (
                <div className="max-w-lg mx-auto my-12 bg-white/85 rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                  <h2 className="text-base font-bold text-slate-900">Article Not Found</h2>
                  <p className="text-xs text-slate-600">
                    This knowledge record may have been moved or removed.
                  </p>
                  <button
                    onClick={() => navigateTo('knowledge')}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#0b132b] rounded-xl"
                  >
                    Back to Knowledge Hub
                  </button>
                </div>
              )}

              {currentPage === 'documents' && (
                <DocumentRepositoryPage
                  documents={documents}
                  categories={categories}
                  userBookmarks={userBookmarks}
                  onOpenUpload={() => {
                    if (!isEditor) return;
                    setIsDocumentModalOpen(true);
                  }}
                  onDeleteDocument={handleDeleteDocument}
                  onToggleBookmark={(id, title) => handleToggleBookmark(id, title, 'document')}
                  onPreviewDocument={(docItem) => setPreviewDocument(docItem)}
                  onDownloadDocument={handleDocumentDownloaded}
                  globalSearch={globalSearch}
                />
              )}

              {currentPage === 'events' && (
                <EventArchivePage
                  events={events}
                  onOpenCreateEvent={() => {
                    if (!isEditor) return;
                    setEditingEvent(null);
                    setIsEventModalOpen(true);
                  }}
                  onEditEvent={(evt) => {
                    if (!isEditor) return;
                    setEditingEvent(evt);
                    setIsEventModalOpen(true);
                  }}
                  onDeleteEvent={handleDeleteEvent}
                  globalSearch={globalSearch}
                />
              )}

              {currentPage === 'lessons' && (
                <LessonsLearnedPage
                  lessons={lessons}
                  categories={categories}
                  onOpenCreateLesson={() => {
                    if (!isEditor) return;
                    setEditingLesson(null);
                    setIsLessonModalOpen(true);
                  }}
                  onEditLesson={(lsn) => {
                    if (!isEditor) return;
                    setEditingLesson(lsn);
                    setIsLessonModalOpen(true);
                  }}
                  onDeleteLesson={handleDeleteLesson}
                  globalSearch={globalSearch}
                />
              )}

              {currentPage === 'bookmarks' && (
                <BookmarksPage
                  bookmarks={userBookmarks}
                  articles={articles}
                  documents={documents}
                  onSelectArticle={(id) => navigateTo('knowledge-detail', id)}
                  onPreviewDocument={(docItem) => setPreviewDocument(docItem)}
                  onRemoveBookmark={handleRemoveBookmark}
                  onNavigate={navigateTo}
                />
              )}

              {currentPage === 'admin' && isAdmin && (
                <AdminDashboardPage
                  articles={articles}
                  categories={categories}
                  activityLogs={activityLogs}
                  onRefreshData={loadAllData}
                  onSelectArticle={(id) => navigateTo('knowledge-detail', id)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global Modals (Edit/Create modals mounted only for Editors/Admins) */}
      {isEditor && (
        <>
          <KnowledgeEditorModal
            isOpen={isArticleModalOpen}
            onClose={() => {
              setIsArticleModalOpen(false);
              setEditingArticle(null);
              setDefaultIsSOP(false);
            }}
            onSave={handleSaveArticle}
            categories={categories}
            initialData={editingArticle}
            defaultIsSOP={defaultIsSOP}
            onPreviewAttachment={(att) => handlePreviewAttachment(att)}
          />

          <DocumentUploadModal
            isOpen={isDocumentModalOpen}
            onClose={() => setIsDocumentModalOpen(false)}
            onSave={handleSaveDocument}
            categories={categories}
          />

          <EventModal
            isOpen={isEventModalOpen}
            onClose={() => {
              setIsEventModalOpen(false);
              setEditingEvent(null);
            }}
            onSave={handleSaveEvent}
            initialData={editingEvent}
          />

          <LessonModal
            isOpen={isLessonModalOpen}
            onClose={() => {
              setIsLessonModalOpen(false);
              setEditingLesson(null);
            }}
            onSave={handleSaveLesson}
            categories={categories}
            initialData={editingLesson}
          />
        </>
      )}

      <DocumentPreviewModal
        documentItem={previewDocument}
        onClose={() => setPreviewDocument(null)}
        onDownloadComplete={handleDocumentDownloaded}
      />

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <UIProvider>
          <MainApp />
        </UIProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
