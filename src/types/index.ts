export type UserRole = 'admin' | 'editor' | 'member';
export type UserStatus = 'active' | 'inactive';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ArticleStatus =
  | 'published'
  | 'draft'
  | 'archived'
  | 'pending_review'
  | 'in_review'
  | 'approved'
  | 'rejected';

export interface DocumentAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
  storagePath?: string;
}

export interface SOPStep {
  step: number;
  title: string;
  detail: string;
  pic?: string;
  notes?: string;
}

export interface KnowledgeRevision {
  version: string;
  title: string;
  summary: string;
  content: string;
  status: ArticleStatus;
  sopSteps?: SOPStep[];
  attachments?: DocumentAttachment[];
  updatedBy: string;
  updatedAt: string;
  changeNote?: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  summary: string;
  categoryId: string;
  categoryName: string;
  department?: string;
  knowledgeType?: string;
  tags: string[];
  createdBy: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  status: ArticleStatus;
  viewsCount: number;
  bookmarkCount: number;
  attachments?: DocumentAttachment[];
  isSOP?: boolean;
  sopNumber?: string;
  purpose?: string;
  scope?: string;
  responsibilities?: string;
  references?: string;
  reviewer?: string;
  approver?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  effectiveDate?: string;
  reviewDate?: string;
  revisionNumber?: string;
  revisionHistory?: KnowledgeRevision[];
  sopSteps?: SOPStep[];
  targetCommittee?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  slug: string;
  articleCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  fileUrl: string;
  storagePath?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdBy: string;
  authorId: string;
  authorName: string;
  downloadsCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  academicYear: string;
  committee: string;
  outcomes: string;
  documentationUrl?: string;
  reports?: { title: string; url: string }[];
  evaluation: string;
  createdBy: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LessonLearned {
  id: string;
  activityTitle: string;
  categoryId: string;
  categoryName: string;
  challenges: string;
  solutions: string;
  recommendations: string;
  impactLevel: 'low' | 'medium' | 'high';
  createdBy: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  targetId: string;
  targetType: 'knowledge' | 'document' | 'sop' | 'lesson';
  title: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  entityType: 'knowledge' | 'document' | 'event' | 'lesson' | 'user' | 'category';
  entityId?: string;
  details: string;
  createdAt: string;
}

export type PageRoute =
  | 'landing'
  | 'dashboard'
  | 'knowledge'
  | 'knowledge-detail'
  | 'documents'
  | 'events'
  | 'lessons'
  | 'bookmarks'
  | 'admin';
