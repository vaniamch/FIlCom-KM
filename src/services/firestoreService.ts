import {
  collection,
  doc,
  getDocs,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { cleanupStoredFile } from '../utils/fileUpload';
import {
  KnowledgeArticle,
  Category,
  DocumentItem,
  CampusEvent,
  LessonLearned,
  Bookmark,
  ActivityLog,
  UserProfile,
  UserRole,
  UserStatus,
  KnowledgeRevision,
} from '../types';

const MASTER_ADMIN_EMAIL = '12410288@student.unklab.ac.id';

interface CallerContext {
  uid: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

function normalizeCallerRole(rawRole: unknown, isMaster: boolean): UserRole {
  if (isMaster) return 'admin';
  const normalized = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
  if (normalized === 'admin' || normalized === 'editor' || normalized === 'member') {
    return normalized;
  }
  return 'member';
}

function normalizeCallerStatus(rawStatus: unknown, isMaster: boolean): UserStatus {
  if (isMaster) return 'active';
  const normalized = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  if (normalized === 'inactive') return 'inactive';
  return 'active';
}

async function requireActiveCaller(forceServer: boolean = false): Promise<CallerContext> {
  const fbUser = auth.currentUser;
  if (!fbUser) {
    throw new Error('Authentication required. Please sign in to continue.');
  }

  const isMaster = fbUser.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
  const userRef = doc(db, 'users', fbUser.uid);

  let snap = null;
  if (forceServer) {
    try {
      snap = await getDocFromServer(userRef);
    } catch (err: any) {
      const code = String(err?.code || '').toLowerCase();
      const message = String(err?.message || '').toLowerCase();
      if (code === 'unavailable' || message.includes('offline')) {
        snap = await getDoc(userRef).catch(() => null);
      } else {
        throw err;
      }
    }
  } else {
    snap = await getDoc(userRef).catch(() => null);
  }

  const profile = snap?.exists() ? (snap.data() as UserProfile) : null;

  const status = normalizeCallerStatus(profile?.status, isMaster);
  if (status === 'inactive' && !isMaster) {
    throw new Error('Your account has been deactivated by an administrator.');
  }

  const role = normalizeCallerRole(profile?.role, isMaster);
  return {
    uid: fbUser.uid,
    email: fbUser.email || '',
    role,
    status,
  };
}

async function requireEditorOrAdmin(): Promise<CallerContext> {
  const caller = await requireActiveCaller(true);
  if (caller.role !== 'admin' && caller.role !== 'editor') {
    throw new Error('Permission denied: Member accounts have read-only access.');
  }
  return caller;
}

async function requireAdmin(): Promise<CallerContext> {
  const caller = await requireActiveCaller(true);
  if (caller.role !== 'admin') {
    throw new Error('Permission denied: Administrator privileges are required.');
  }
  return caller;
}

function assertOwnershipOrAdmin(
  caller: CallerContext,
  existingCreatedBy?: string,
  existingAuthorId?: string
): void {
  if (caller.role === 'admin') return;
  const ownerUid = existingCreatedBy || existingAuthorId || '';
  if (!ownerUid || ownerUid !== caller.uid) {
    throw new Error('Permission denied: You can only modify or delete content you created.');
  }
}

export function cleanPayload<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'object' && item !== null ? cleanPayload(item) : item
        );
      } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
        result[key] = cleanPayload(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export function validateSopPublishEligibility(
  incoming: Partial<KnowledgeArticle>,
  existing?: KnowledgeArticle | null
): void {
  const isSOP = incoming.isSOP !== undefined ? !!incoming.isSOP : !!existing?.isSOP;
  const targetStatus = incoming.status || existing?.status;
  if (!isSOP || targetStatus !== 'published') return;

  const reviewer = (incoming.reviewer ?? existing?.reviewer ?? '').trim();
  const approver = (incoming.approver ?? existing?.approver ?? '').trim();
  const approvedBy = (incoming.approvedBy ?? existing?.approvedBy ?? '').trim();
  const prevStatus = existing?.status;

  if (!reviewer || !approver) {
    throw new Error(
      'SOP cannot be published without assigned Reviewer and Approver names.'
    );
  }

  const hasApproval =
    prevStatus === 'approved' || prevStatus === 'published' || Boolean(approvedBy);

  if (!hasApproval) {
    throw new Error(
      'SOP cannot be published before completing Review & Approval. Save as Draft or Submit for Review and obtain approval first.'
    );
  }
}

async function deleteBookmarksForTarget(targetId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const q = query(
      collection(db, 'bookmarks'),
      where('userId', '==', uid),
      where('targetId', '==', targetId)
    );
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) => deleteDoc(doc(db, 'bookmarks', d.id)).catch(() => {}))
    );
  } catch {
    // Non-blocking cleanup
  }
}

// ==========================================
// KNOWLEDGE & SOP ARTICLES
// ==========================================

export async function getArticles(params?: {
  categoryId?: string;
  status?: string;
  isSOP?: boolean;
  viewer?: { role?: UserRole; uid?: string };
}): Promise<KnowledgeArticle[]> {
  try {
    const caller = await requireActiveCaller(true);
    const effectiveRole = caller.role;
    const effectiveUid = caller.uid;
    const colRef = collection(db, 'knowledge');

    let items: KnowledgeArticle[] = [];

    if (effectiveRole === 'admin') {
      const snap = await getDocs(colRef);
      items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as KnowledgeArticle));
    } else if (effectiveRole === 'editor') {
      const [pubSnap, createdSnap, authorSnap] = await Promise.all([
        getDocs(query(colRef, where('status', '==', 'published'))),
        getDocs(query(colRef, where('createdBy', '==', effectiveUid))),
        getDocs(query(colRef, where('authorId', '==', effectiveUid))),
      ]);
      const byId = new Map<string, KnowledgeArticle>();
      [pubSnap, createdSnap, authorSnap].forEach((snap) => {
        snap.docs.forEach((d) => {
          byId.set(d.id, { id: d.id, ...d.data() } as KnowledgeArticle);
        });
      });
      items = Array.from(byId.values());
    } else {
      const snap = await getDocs(query(colRef, where('status', '==', 'published')));
      items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as KnowledgeArticle));
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (params?.categoryId && params.categoryId !== 'all') {
      items = items.filter((item) => item.categoryId === params.categoryId);
    }
    if (params?.status && params.status !== 'all') {
      items = items.filter((item) => item.status === params.status);
    }
    if (params?.isSOP !== undefined) {
      items = items.filter((item) => !!item.isSOP === params.isSOP);
    }
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'knowledge');
    return [];
  }
}

export async function getArticleById(id: string): Promise<KnowledgeArticle | null> {
  try {
    const docRef = doc(db, 'knowledge', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as KnowledgeArticle;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `knowledge/${id}`);
    return null;
  }
}

export async function createArticle(
  data: Omit<KnowledgeArticle, 'id' | 'createdAt' | 'updatedAt' | 'viewsCount' | 'bookmarkCount' | 'createdBy'> & {
    createdBy?: string;
  }
): Promise<KnowledgeArticle> {
  const caller = await requireEditorOrAdmin();
  validateSopPublishEligibility(data, null);

  const id = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const rawArticle: KnowledgeArticle = {
    ...data,
    id,
    createdBy: caller.uid,
    authorId: caller.uid,
    viewsCount: 0,
    bookmarkCount: 0,
    revisionNumber: data.isSOP ? data.revisionNumber || '1.0' : data.revisionNumber,
    revisionHistory: data.revisionHistory || [],
    createdAt: now,
    updatedAt: now,
  };
  const article = cleanPayload(rawArticle);

  try {
    await setDoc(doc(db, 'knowledge', id), article);
    return article;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `knowledge/${id}`);
    throw error;
  }
}

export async function updateArticle(
  id: string,
  updates: Partial<KnowledgeArticle>,
  options?: { editorName?: string; changeNote?: string; skipRevision?: boolean }
): Promise<void> {
  try {
    const caller = await requireEditorOrAdmin();
    const docRef = doc(db, 'knowledge', id);
    const existing = await getArticleById(id);
    if (!existing) {
      throw new Error('Knowledge record not found.');
    }

    assertOwnershipOrAdmin(caller, existing.createdBy, existing.authorId);
    validateSopPublishEligibility(updates, existing);

    // Strip immutable ownership & timestamp fields
    const {
      id: _id,
      createdBy: _cb,
      authorId: _aid,
      createdAt: _ca,
      ...mutableUpdates
    } = updates;

    let nextHistory = mutableUpdates.revisionHistory;
    if (!options?.skipRevision && !mutableUpdates.revisionHistory) {
      const hasContentChange =
        (mutableUpdates.title !== undefined && mutableUpdates.title !== existing.title) ||
        (mutableUpdates.content !== undefined && mutableUpdates.content !== existing.content) ||
        (mutableUpdates.summary !== undefined && mutableUpdates.summary !== existing.summary) ||
        (mutableUpdates.status !== undefined && mutableUpdates.status !== existing.status) ||
        mutableUpdates.sopSteps !== undefined ||
        mutableUpdates.attachments !== undefined;

      if (hasContentChange) {
        const snapshot: KnowledgeRevision = {
          version:
            existing.revisionNumber ||
            `v${(existing.revisionHistory?.length || 0) + 1}.0`,
          title: existing.title,
          summary: existing.summary || '',
          content: existing.content || '',
          status: existing.status,
          sopSteps: existing.sopSteps || [],
          attachments: (existing.attachments || []).map((a) => ({
            name: a.name,
            url: a.url.startsWith('data:') && a.url.length > 5000 ? '' : a.url,
            size: a.size,
            type: a.type,
            storagePath: a.storagePath,
          })),
          updatedBy: options?.editorName || existing.authorName || 'Committee Editor',
          updatedAt: existing.updatedAt || existing.createdAt,
          changeNote:
            options?.changeNote ||
            (mutableUpdates.status && mutableUpdates.status !== existing.status
              ? `Status changed from ${existing.status} to ${mutableUpdates.status}`
              : 'Document revised'),
        };
        const prevList = existing.revisionHistory || [];
        nextHistory = [snapshot, ...prevList].slice(0, 15);
      }
    }

    const cleaned = cleanPayload({
      ...mutableUpdates,
      ...(existing.createdBy ? {} : { createdBy: existing.authorId }),
      ...(nextHistory !== undefined ? { revisionHistory: nextHistory } : {}),
      updatedAt: new Date().toISOString(),
    });

    await updateDoc(docRef, cleaned);

    if (existing.attachments && mutableUpdates.attachments) {
      const keptUrls = new Set(mutableUpdates.attachments.map((a) => a.url));
      const removed = existing.attachments.filter((a) => a.url && !keptUrls.has(a.url));
      await Promise.all(
        removed.map((att) => cleanupStoredFile(att.url, att.storagePath))
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `knowledge/${id}`);
    throw error;
  }
}

export async function deleteArticle(id: string): Promise<void> {
  try {
    const caller = await requireEditorOrAdmin();
    const existing = await getArticleById(id);
    if (!existing) {
      throw new Error('Knowledge record not found.');
    }
    assertOwnershipOrAdmin(caller, existing.createdBy, existing.authorId);

    await deleteDoc(doc(db, 'knowledge', id));
    if (existing.attachments) {
      await Promise.all(
        existing.attachments.map((att) => cleanupStoredFile(att.url, att.storagePath))
      );
    }
    await deleteBookmarksForTarget(id);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `knowledge/${id}`);
    throw error;
  }
}

export async function incrementArticleViews(id: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const docRef = doc(db, 'knowledge', id);
    await updateDoc(docRef, {
      viewsCount: increment(1),
    });
  } catch (error) {
    console.warn('View count increment failed silently:', error);
  }
}

// ==========================================
// CATEGORIES (ADMIN ONLY)
// ==========================================

export async function getCategories(): Promise<Category[]> {
  try {
    await requireActiveCaller();
    const snap = await getDocs(collection(db, 'categories'));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'categories');
    return [];
  }
}

export async function createCategory(data: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
  await requireAdmin();
  const cleanSlug = (data.slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const id = cleanSlug ? `cat_${cleanSlug}` : `cat_${Date.now()}`;
  const now = new Date().toISOString();
  const category: Category = {
    ...data,
    slug: cleanSlug || id,
    id,
    articleCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'categories', id), category);
    return category;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `categories/${id}`);
    throw error;
  }
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<void> {
  await requireAdmin();
  try {
    await updateDoc(doc(db, 'categories', id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `categories/${id}`);
    throw error;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  await requireAdmin();
  try {
    await deleteDoc(doc(db, 'categories', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
    throw error;
  }
}

// ==========================================
// DOCUMENTS REPOSITORY
// ==========================================

export async function getDocuments(categoryId?: string): Promise<DocumentItem[]> {
  try {
    await requireActiveCaller();
    const snap = await getDocs(collection(db, 'documents'));
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocumentItem));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (categoryId && categoryId !== 'all') {
      items = items.filter((d) => d.categoryId === categoryId);
    }
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'documents');
    return [];
  }
}

export async function createDocumentItem(
  data: Omit<DocumentItem, 'id' | 'createdAt' | 'downloadsCount' | 'createdBy'> & {
    createdBy?: string;
  }
): Promise<DocumentItem> {
  const caller = await requireEditorOrAdmin();
  const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const rawItem: DocumentItem = {
    ...data,
    id,
    createdBy: caller.uid,
    authorId: caller.uid,
    downloadsCount: 0,
    createdAt: new Date().toISOString(),
  };
  const item = cleanPayload(rawItem);

  try {
    await setDoc(doc(db, 'documents', id), item);
    return item;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `documents/${id}`);
    throw error;
  }
}

export async function deleteDocumentItem(
  id: string,
  documentMeta?: Partial<DocumentItem>
): Promise<void> {
  try {
    const caller = await requireEditorOrAdmin();
    const snap = await getDoc(doc(db, 'documents', id));
    const existing = snap.exists() ? (snap.data() as DocumentItem) : documentMeta;
    if (!existing) {
      throw new Error('Document record not found.');
    }
    assertOwnershipOrAdmin(caller, existing.createdBy, existing.authorId);

    await deleteDoc(doc(db, 'documents', id));
    await cleanupStoredFile(existing.fileUrl, existing.storagePath);
    await deleteBookmarksForTarget(id);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `documents/${id}`);
    throw error;
  }
}

export async function incrementDocumentDownloads(id: string): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const docRef = doc(db, 'documents', id);
    await updateDoc(docRef, {
      downloadsCount: increment(1),
    });
  } catch (error) {
    console.warn('Download increment failed:', error);
  }
}

// ==========================================
// EVENTS ARCHIVE
// ==========================================

export async function getEvents(): Promise<CampusEvent[]> {
  try {
    await requireActiveCaller();
    const snap = await getDocs(collection(db, 'events'));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampusEvent));
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'events');
    return [];
  }
}

export async function createEvent(
  data: Omit<CampusEvent, 'id' | 'createdAt' | 'createdBy'> & { createdBy?: string }
): Promise<CampusEvent> {
  const caller = await requireEditorOrAdmin();
  const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const rawEvent: CampusEvent = {
    ...data,
    id,
    createdBy: caller.uid,
    authorId: caller.uid,
    createdAt: new Date().toISOString(),
  };
  const event = cleanPayload(rawEvent);

  try {
    await setDoc(doc(db, 'events', id), event);
    return event;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `events/${id}`);
    throw error;
  }
}

export async function updateEvent(id: string, updates: Partial<CampusEvent>): Promise<void> {
  try {
    const caller = await requireEditorOrAdmin();
    const docRef = doc(db, 'events', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Event record not found.');
    }
    const existing = snap.data() as CampusEvent;
    assertOwnershipOrAdmin(caller, existing.createdBy, existing.authorId);

    const { id: _id, createdBy: _cb, authorId: _aid, createdAt: _ca, ...mutable } = updates;
    const cleaned = cleanPayload({
      ...mutable,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(docRef, cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `events/${id}`);
    throw error;
  }
}

export async function deleteEvent(id: string): Promise<void> {
  try {
    const caller = await requireEditorOrAdmin();
    const docRef = doc(db, 'events', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Event record not found.');
    }
    const existing = snap.data() as CampusEvent;
    assertOwnershipOrAdmin(caller, existing.createdBy, existing.authorId);

    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
    throw error;
  }
}

// ==========================================
// LESSONS LEARNED
// ==========================================

export async function getLessons(): Promise<LessonLearned[]> {
  try {
    await requireActiveCaller();
    const snap = await getDocs(collection(db, 'lessons_learned'));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LessonLearned));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'lessons_learned');
    return [];
  }
}

export async function createLesson(
  data: Omit<LessonLearned, 'id' | 'createdAt' | 'createdBy'> & { createdBy?: string }
): Promise<LessonLearned> {
  const caller = await requireEditorOrAdmin();
  const id = `lsn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const rawLesson: LessonLearned = {
    ...data,
    id,
    createdBy: caller.uid,
    authorId: caller.uid,
    createdAt: new Date().toISOString(),
  };
  const lesson = cleanPayload(rawLesson);

  try {
    await setDoc(doc(db, 'lessons_learned', id), lesson);
    return lesson;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `lessons_learned/${id}`);
    throw error;
  }
}

export async function updateLesson(
  id: string,
  updates: Partial<LessonLearned>
): Promise<void> {
  try {
    const caller = await requireEditorOrAdmin();
    const docRef = doc(db, 'lessons_learned', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Lesson record not found.');
    }
    const existing = snap.data() as LessonLearned;
    assertOwnershipOrAdmin(caller, existing.createdBy, existing.authorId);

    const { id: _id, createdBy: _cb, authorId: _aid, createdAt: _ca, ...mutable } = updates;
    const cleaned = cleanPayload({
      ...mutable,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(docRef, cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `lessons_learned/${id}`);
    throw error;
  }
}

export async function deleteLesson(id: string): Promise<void> {
  try {
    const caller = await requireEditorOrAdmin();
    const docRef = doc(db, 'lessons_learned', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Lesson record not found.');
    }
    const existing = snap.data() as LessonLearned;
    assertOwnershipOrAdmin(caller, existing.createdBy, existing.authorId);

    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `lessons_learned/${id}`);
    throw error;
  }
}

// ==========================================
// BOOKMARKS
// ==========================================

export async function getUserBookmarks(userId: string): Promise<Bookmark[]> {
  if (!userId) return [];
  try {
    await requireActiveCaller();
    const q = query(collection(db, 'bookmarks'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bookmark));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'bookmarks');
    return [];
  }
}

export async function toggleBookmark(
  userId: string,
  targetId: string,
  targetType: 'knowledge' | 'document' | 'sop' | 'lesson',
  title: string
): Promise<boolean> {
  try {
    const caller = await requireActiveCaller();
    const effectiveUid = caller.uid;
    if (userId !== effectiveUid) {
      throw new Error('Cannot modify bookmarks for another user.');
    }

    const q = query(
      collection(db, 'bookmarks'),
      where('userId', '==', effectiveUid),
      where('targetId', '==', targetId)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const bookmarkDoc = snap.docs[0];
      await deleteDoc(doc(db, 'bookmarks', bookmarkDoc.id));
      if (targetType === 'knowledge' || targetType === 'sop') {
        const artRef = doc(db, 'knowledge', targetId);
        await updateDoc(artRef, { bookmarkCount: increment(-1) }).catch(() => {});
      }
      return false;
    } else {
      const id = `bm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, 'bookmarks', id), {
        id,
        userId: effectiveUid,
        targetId,
        targetType,
        title,
        createdAt: new Date().toISOString(),
      });
      if (targetType === 'knowledge' || targetType === 'sop') {
        const artRef = doc(db, 'knowledge', targetId);
        await updateDoc(artRef, { bookmarkCount: increment(1) }).catch(() => {});
      }
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'bookmarks');
    throw error;
  }
}

export async function removeBookmark(id: string): Promise<void> {
  try {
    await requireActiveCaller();
    await deleteDoc(doc(db, 'bookmarks', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `bookmarks/${id}`);
    throw error;
  }
}

// ==========================================
// ACTIVITY LOGS
// ==========================================

export async function logActivity(params: {
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  entityType: 'knowledge' | 'document' | 'event' | 'lesson' | 'user' | 'category';
  entityId?: string;
  details: string;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  try {
    await setDoc(doc(db, 'activity_logs', id), {
      ...params,
      userId: uid,
      id,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Activity log write error:', error);
  }
}

export async function getActivityLogs(maxCount: number = 20): Promise<ActivityLog[]> {
  try {
    await requireActiveCaller();
    const q = query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
  } catch {
    try {
      await requireActiveCaller();
      const snap = await getDocs(collection(db, 'activity_logs'));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return items.slice(0, maxCount);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'activity_logs');
      return [];
    }
  }
}

// ==========================================
// USER DIRECTORY & RBAC (ADMIN ONLY)
// ==========================================

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    await requireAdmin();
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => {
      const data = d.data() as Partial<UserProfile>;
      const isMaster = data.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
      return {
        ...data,
        id: d.id,
        email: data.email || '',
        displayName: data.displayName || data.email || 'Student Member',
        role: normalizeCallerRole(data.role, isMaster),
        status: normalizeCallerStatus(data.status, isMaster),
        createdAt: data.createdAt || new Date().toISOString(),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
    return [];
  }
}

export async function setUserRole(userId: string, newRole: UserRole): Promise<void> {
  const caller = await requireAdmin();

  if (caller.uid === userId && newRole !== 'admin') {
    throw new Error('You cannot demote your own administrator account.');
  }

  try {
    const allUsersSnap = await getDocs(collection(db, 'users'));
    const allUsers = allUsersSnap.docs.map((d) => ({
      ...(d.data() as UserProfile),
      id: d.id,
      status: (d.data() as UserProfile).status || 'active',
    }));

    const target = allUsers.find((u) => u.id === userId);
    if (!target) {
      throw new Error('Target user account not found.');
    }

    if (
      target.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() &&
      newRole !== 'admin'
    ) {
      throw new Error('The primary system administrator role cannot be revoked.');
    }

    if (target.role === 'admin' && target.status === 'active' && newRole !== 'admin') {
      const otherActiveAdmins = allUsers.filter(
        (u) => u.id !== userId && u.role === 'admin' && u.status === 'active'
      );
      if (otherActiveAdmins.length === 0) {
        throw new Error('Cannot demote the last active administrator.');
      }
    }

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: new Date().toISOString(),
    });

    const adminRef = doc(db, 'admins', userId);
    if (newRole === 'admin' && target.status === 'active') {
      await setDoc(adminRef, { uid: userId, updated: new Date().toISOString() });
    } else {
      await deleteDoc(adminRef).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    throw error;
  }
}

export async function setUserStatus(userId: string, newStatus: UserStatus): Promise<void> {
  const caller = await requireAdmin();

  if (caller.uid === userId && newStatus !== 'active') {
    throw new Error('You cannot deactivate your own active administrator account.');
  }

  try {
    const allUsersSnap = await getDocs(collection(db, 'users'));
    const allUsers = allUsersSnap.docs.map((d) => ({
      ...(d.data() as UserProfile),
      id: d.id,
      status: (d.data() as UserProfile).status || 'active',
    }));

    const target = allUsers.find((u) => u.id === userId);
    if (!target) {
      throw new Error('Target user account not found.');
    }

    if (
      target.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() &&
      newStatus !== 'active'
    ) {
      throw new Error('The primary system administrator cannot be deactivated.');
    }

    if (target.role === 'admin' && target.status === 'active' && newStatus === 'inactive') {
      const otherActiveAdmins = allUsers.filter(
        (u) => u.id !== userId && u.role === 'admin' && u.status === 'active'
      );
      if (otherActiveAdmins.length === 0) {
        throw new Error('Cannot deactivate the last active administrator.');
      }
    }

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });

    const adminRef = doc(db, 'admins', userId);
    if (target.role === 'admin' && newStatus === 'active') {
      await setDoc(adminRef, { uid: userId, updated: new Date().toISOString() });
    } else {
      await deleteDoc(adminRef).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    throw error;
  }
}
