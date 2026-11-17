import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Download,
  Share2,
  Edit3,
  Trash2,
  FileText,
  Printer,
  Eye,
  Archive,
  CheckCircle2,
  Send,
  XCircle,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import {
  KnowledgeArticle,
  DocumentItem,
  Bookmark as BookmarkType,
  DocumentAttachment,
  ArticleStatus,
} from '../../types';
import {
  incrementArticleViews,
  incrementDocumentDownloads,
} from '../../services/firestoreService';
import {
  triggerFileDownload,
  downloadTextAsFile,
} from '../../utils/fileActions';
import { formatFileSize, isPreviewSupported } from '../../utils/fileUpload';

interface KnowledgeDetailPageProps {
  article: KnowledgeArticle;
  relatedDocuments: DocumentItem[];
  userBookmarks: BookmarkType[];
  onBack: () => void;
  onEdit: (article: KnowledgeArticle) => void;
  onDelete: (articleId: string) => void;
  onUpdateStatus?: (
    article: KnowledgeArticle,
    nextStatus: ArticleStatus,
    extra?: Partial<KnowledgeArticle>,
    changeNote?: string
  ) => Promise<void>;
  onToggleBookmark: (targetId: string, title: string) => void;
  onPreviewDocument?: (docItem: DocumentItem) => void;
}

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  in_review: 'In Review',
  approved: 'Approved',
  published: 'Published',
  rejected: 'Rejected',
  archived: 'Archived',
};

const STATUS_STYLES: Record<ArticleStatus, string> = {
  draft: 'bg-amber-50 text-amber-800 border-amber-200',
  pending_review: 'bg-sky-50 text-sky-800 border-sky-200',
  in_review: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  approved: 'bg-teal-50 text-teal-800 border-teal-200',
  published: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 border-rose-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const KnowledgeDetailPage: React.FC<KnowledgeDetailPageProps> = ({
  article,
  relatedDocuments,
  userBookmarks,
  onBack,
  onEdit,
  onDelete,
  onUpdateStatus,
  onToggleBookmark,
  onPreviewDocument,
}) => {
  const { currentUser, userProfile, isEditor, isAdmin } = useAuth();
  const { showToast, confirmAction } = useUI();
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [expandedRevisionIdx, setExpandedRevisionIdx] = useState<number | null>(
    null
  );

  const ownerUid = article.createdBy || article.authorId;
  const isOwner = !!currentUser?.uid && ownerUid === currentUser.uid;
  const canModify = isAdmin || (isEditor && isOwner);
  const bookmarked = userBookmarks.some((b) => b.targetId === article.id);

  useEffect(() => {
    incrementArticleViews(article.id);
  }, [article.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadFormatted = () => {
    const lines = [
      article.title,
      '='.repeat(Math.min(60, article.title.length)),
      `Category / Division: ${article.categoryName}`,
      `Department: ${article.department || article.targetCommittee || article.categoryName}`,
      `Type: ${article.isSOP ? 'Standard Operating Procedure (SOP)' : article.knowledgeType || 'Guide'}`,
      ...(article.sopNumber ? [`SOP Number: ${article.sopNumber}`] : []),
      ...(article.revisionNumber ? [`Revision: ${article.revisionNumber}`] : []),
      `Status: ${STATUS_LABELS[article.status] || article.status}`,
      `Author: ${article.authorName}`,
      ...(article.reviewer ? [`Reviewer: ${article.reviewer}`] : []),
      ...(article.approver ? [`Approver: ${article.approver}`] : []),
      ...(article.approvedBy ? [`Approved By: ${article.approvedBy}`] : []),
      ...(article.effectiveDate ? [`Effective Date: ${article.effectiveDate}`] : []),
      ...(article.reviewDate ? [`Review Date: ${article.reviewDate}`] : []),
      `Published / Created: ${new Date(article.createdAt).toLocaleString()}`,
      `Last Updated: ${new Date(article.updatedAt || article.createdAt).toLocaleString()}`,
      '',
      ...(article.summary ? ['EXECUTIVE SUMMARY', article.summary, ''] : []),
      ...(article.purpose ? ['PURPOSE', article.purpose, ''] : []),
      ...(article.scope ? ['SCOPE', article.scope, ''] : []),
      ...(article.responsibilities ? ['RESPONSIBILITIES', article.responsibilities, ''] : []),
      ...(article.isSOP && article.sopSteps && article.sopSteps.length > 0
        ? [
            'PROCEDURE STEPS',
            ...article.sopSteps.map(
              (s) =>
                `${s.step}. ${s.title}${s.pic ? ` [PIC: ${s.pic}]` : ''}\n   ${s.detail}${s.notes ? `\n   Note: ${s.notes}` : ''}`
            ),
            '',
          ]
        : []),
      'DETAILED CONTENT',
      article.content,
      ...(article.references ? ['', 'REFERENCES', article.references] : []),
      ...(article.tags?.length ? ['', `Tags: ${article.tags.join(', ')}`] : []),
    ];

    const safeName = article.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
    downloadTextAsFile(`${safeName || 'knowledge_document'}.txt`, lines.join('\n'));
    showToast('Downloaded formatted document summary.', 'success');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: article.title,
          text: article.summary,
          url: window.location.href,
        })
        .catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => showToast('Article link copied to clipboard.', 'success'))
        .catch(() =>
          showToast('Unable to copy link in this browser.', 'error')
        );
    }
  };

  const handleDeleteClick = async () => {
    const confirmed = await confirmAction({
      title: article.isSOP ? 'Delete SOP' : 'Delete Knowledge Article',
      message: `Are you sure you want to permanently delete "${article.title}" and its attached files?`,
      confirmLabel: 'Delete Permanently',
      danger: true,
    });
    if (confirmed) {
      onDelete(article.id);
    }
  };

  const handleWorkflowTransition = async (
    nextStatus: ArticleStatus,
    extra: Partial<KnowledgeArticle> = {},
    changeNote?: string
  ) => {
    if (!onUpdateStatus || workflowBusy) return;
    setWorkflowBusy(true);
    try {
      await onUpdateStatus(article, nextStatus, extra, changeNote);
    } catch (err: any) {
      showToast(err?.message || 'Status update failed.', 'error');
    } finally {
      setWorkflowBusy(false);
    }
  };

  const previewAttachment = (att: DocumentAttachment, idx: number) => {
    if (!onPreviewDocument) return;
    onPreviewDocument({
      id: `att_${article.id}_${idx}`,
      title: att.name,
      description: `Attachment from "${article.title}"`,
      categoryId: article.categoryId,
      categoryName: article.categoryName,
      fileUrl: att.url,
      storagePath: att.storagePath,
      fileName: att.name,
      fileSize: att.size || 0,
      fileType: att.type || att.name.split('.').pop() || 'doc',
      createdBy: article.createdBy || article.authorId,
      authorId: article.authorId,
      authorName: article.authorName,
      downloadsCount: 0,
      createdAt: article.updatedAt || article.createdAt,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Knowledge Hub</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onToggleBookmark(article.id, article.title)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              bookmarked
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {bookmarked ? (
              <>
                <BookmarkCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Bookmarked</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5 text-slate-500" />
                <span>Save</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadFormatted}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-50 text-xs font-semibold transition-colors"
            title="Download document export"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          <button
            onClick={handleShare}
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
            title="Share or Copy Link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={handlePrint}
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
            title="Print or Save PDF"
          >
            <Printer className="w-4 h-4" />
          </button>

          {canModify && (
            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
              <button
                onClick={() => onEdit(article)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit</span>
              </button>
              {onUpdateStatus && (
                <button
                  onClick={async () => {
                    const nextStatus: ArticleStatus =
                      article.status === 'archived' ? 'draft' : 'archived';
                    const confirmed = await confirmAction({
                      title:
                        nextStatus === 'archived'
                          ? 'Archive Record'
                          : 'Restore from Archive',
                      message:
                        nextStatus === 'archived'
                          ? `Archive "${article.title}"? Archived items remain preserved in history and can be restored anytime.`
                          : `Restore "${article.title}" to Draft status?`,
                      confirmLabel:
                        nextStatus === 'archived' ? 'Archive' : 'Restore',
                    });
                    if (confirmed) {
                      await handleWorkflowTransition(
                        nextStatus,
                        {},
                        nextStatus === 'archived'
                          ? 'Archived document'
                          : 'Restored from archive'
                      );
                    }
                  }}
                  disabled={workflowBusy}
                  className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 rounded-lg transition-colors"
                  title={
                    article.status === 'archived'
                      ? 'Restore from archive'
                      : 'Archive document'
                  }
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleDeleteClick}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors"
                title="Delete article"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SOP Workflow Governance Bar (only for SOPs when user can modify & handler exists) */}
      {article.isSOP && canModify && onUpdateStatus && (
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-indigo-100 shadow-2xs p-4 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                STATUS_STYLES[article.status] || STATUS_STYLES.draft
              }`}
            >
              Status: {STATUS_LABELS[article.status] || article.status}
            </span>
            {article.sopNumber && (
              <span className="font-mono font-bold text-slate-700 text-[11px]">
                {article.sopNumber}
              </span>
            )}
            {article.revisionNumber && (
              <span className="text-slate-500 text-[11px]">
                Rev {article.revisionNumber}
              </span>
            )}
            {article.approvedBy && (
              <span className="text-emerald-700 text-[11px] font-semibold">
                Approved by {article.approvedBy}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(article.status === 'draft' || article.status === 'rejected') && (
              <button
                type="button"
                disabled={workflowBusy}
                onClick={() =>
                  handleWorkflowTransition(
                    'pending_review',
                    {},
                    'Submitted SOP for review'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for Review</span>
              </button>
            )}

            {article.status === 'pending_review' && (
              <button
                type="button"
                disabled={workflowBusy}
                onClick={() =>
                  handleWorkflowTransition(
                    'in_review',
                    {},
                    'Started SOP review'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <span>Start Review</span>
              </button>
            )}

            {(article.status === 'pending_review' ||
              article.status === 'in_review') && (
              <>
                <button
                  type="button"
                  disabled={workflowBusy}
                  onClick={() => {
                    const approverName =
                      article.approver?.trim() ||
                      userProfile?.displayName ||
                      currentUser?.displayName ||
                      'Executive Approver';
                    const reviewerName =
                      article.reviewer?.trim() ||
                      userProfile?.displayName ||
                      'Committee Reviewer';
                    handleWorkflowTransition(
                      'approved',
                      {
                        reviewer: reviewerName,
                        approver: approverName,
                        approvedBy: approverName,
                        approvedAt: new Date().toISOString(),
                      },
                      `Approved by ${approverName}`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve SOP</span>
                </button>
                <button
                  type="button"
                  disabled={workflowBusy}
                  onClick={() =>
                    handleWorkflowTransition(
                      'rejected',
                      {
                        rejectedReason: 'Returned for revision by reviewer',
                      },
                      'Rejected / returned for revision'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </>
            )}

            {article.status === 'approved' && (
              <button
                type="button"
                disabled={workflowBusy}
                onClick={() =>
                  handleWorkflowTransition(
                    'published',
                    {},
                    'Published approved SOP'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-300" />
                <span>Publish SOP</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Article Card */}
      <article className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/90 shadow-[0_8px_30px_rgb(79,114,205,0.08)] p-6 sm:p-10 space-y-6 print:shadow-none print:border-0 print:p-0">
        {/* Unboxed Metadata (Zero-Pill Discipline) */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 pb-2 border-b border-slate-100">
          <span className="font-semibold text-slate-800">
            {article.categoryName} Division
          </span>
          {article.department && article.department !== article.categoryName && (
            <>
              <span aria-hidden="true">·</span>
              <span>Dept: {article.department}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{article.knowledgeType || (article.isSOP ? 'SOP' : 'Guide')}</span>
          <span aria-hidden="true">·</span>
          <span>By {article.authorName}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            Published{' '}
            {new Date(article.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          {article.updatedAt && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                Updated {new Date(article.updatedAt).toLocaleDateString()}
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{article.viewsCount || 0} views</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-slate-700">
            {STATUS_LABELS[article.status] || article.status}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {article.title}
        </h1>

        {/* Executive Summary Callout */}
        {article.summary && (
          <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-lg text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
            <span className="font-bold text-slate-900 block mb-1">
              Executive Summary:
            </span>
            {article.summary}
          </div>
        )}

        {/* SOP Governance & Scope Metadata */}
        {article.isSOP &&
          (article.sopNumber ||
            article.purpose ||
            article.scope ||
            article.responsibilities ||
            article.reviewer ||
            article.approver ||
            article.effectiveDate) && (
            <div className="p-4 bg-slate-50/80 border border-slate-200/90 rounded-xl space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-2 border-b border-slate-200/70">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    SOP Number
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {article.sopNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Revision
                  </span>
                  <span className="font-semibold text-slate-900">
                    {article.revisionNumber || '1.0'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Reviewer / Approver
                  </span>
                  <span className="font-semibold text-slate-900">
                    {article.reviewer || '—'} / {article.approver || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Effective / Review Date
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {article.effectiveDate || '—'}
                    {article.reviewDate ? ` → ${article.reviewDate}` : ''}
                  </span>
                </div>
              </div>

              {article.purpose && (
                <div>
                  <span className="font-bold text-slate-900 block">Purpose:</span>
                  <p className="text-slate-700 leading-relaxed mt-0.5">
                    {article.purpose}
                  </p>
                </div>
              )}
              {article.scope && (
                <div>
                  <span className="font-bold text-slate-900 block">Scope:</span>
                  <p className="text-slate-700 leading-relaxed mt-0.5">
                    {article.scope}
                  </p>
                </div>
              )}
              {article.responsibilities && (
                <div>
                  <span className="font-bold text-slate-900 block">
                    Responsibilities:
                  </span>
                  <p className="text-slate-700 leading-relaxed mt-0.5">
                    {article.responsibilities}
                  </p>
                </div>
              )}
              {article.references && (
                <div>
                  <span className="font-bold text-slate-900 block">
                    References & Related Documents:
                  </span>
                  <p className="text-slate-700 leading-relaxed mt-0.5">
                    {article.references}
                  </p>
                </div>
              )}
            </div>
          )}

        {/* Standard Operating Procedure Steps (if SOP) */}
        {article.isSOP && article.sopSteps && article.sopSteps.length > 0 && (
          <div className="space-y-3 pt-4">
            <h2 className="text-base font-bold text-slate-900">
              Standard Operating Procedure Steps
            </h2>
            <div className="space-y-3">
              {article.sopSteps.map((step) => (
                <div
                  key={step.step}
                  className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-lg flex items-start gap-3.5"
                >
                  <div className="w-6 h-6 rounded-md bg-indigo-900 text-white flex items-center justify-center font-bold text-xs shrink-0 tabular-nums">
                    {step.step}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-slate-900">
                        {step.title}
                      </h3>
                      {step.pic && (
                        <span className="text-[11px] font-semibold text-indigo-700">
                          PIC: {step.pic}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {step.detail}
                    </p>
                    {step.notes && (
                      <p className="text-[11px] text-slate-500 mt-1 italic">
                        Note: {step.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-800 leading-relaxed space-y-4 pt-2">
          {article.content.split('\n\n').map((paragraph, index) => {
            if (paragraph.startsWith('### ')) {
              return (
                <h3
                  key={index}
                  className="text-base font-bold text-slate-900 pt-3"
                >
                  {paragraph.replace('### ', '')}
                </h3>
              );
            }
            if (paragraph.startsWith('## ')) {
              return (
                <h2
                  key={index}
                  className="text-lg font-bold text-slate-900 pt-4"
                >
                  {paragraph.replace('## ', '')}
                </h2>
              );
            }
            if (paragraph.startsWith('- ') || paragraph.startsWith('1. ')) {
              return (
                <div
                  key={index}
                  className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 font-normal"
                >
                  {paragraph.split('\n').map((line, lIdx) => (
                    <div key={lIdx} className="py-0.5">
                      {line}
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <p key={index} className="whitespace-pre-line">
                {paragraph}
              </p>
            );
          })}
        </div>

        {/* Attachments Section */}
        {article.attachments && article.attachments.length > 0 && (
          <div className="pt-6 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Attached Documents & Templates ({article.attachments.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {article.attachments.map((att, idx) => {
                const canPreview =
                  onPreviewDocument &&
                  isPreviewSupported(att.type, att.name, att.url);
                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg flex items-center justify-between gap-3 transition-colors text-slate-800 group"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (canPreview) {
                          previewAttachment(att, idx);
                        } else {
                          triggerFileDownload(att.url, att.name).then((ok) => {
                            showToast(
                              ok
                                ? `Downloading "${att.name}"`
                                : 'Unable to open attachment.',
                              ok ? 'success' : 'error'
                            );
                          });
                        }
                      }}
                      className="flex items-center gap-2.5 min-w-0 text-left flex-1"
                    >
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-indigo-700">
                          {att.name}
                        </p>
                        <p className="text-[11px] text-slate-500 tabular-nums uppercase">
                          {att.type || 'DOC'}
                          {att.size ? ` · ${formatFileSize(att.size)}` : ''}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0 no-print">
                      {canPreview && (
                        <button
                          type="button"
                          onClick={() => previewAttachment(att, idx)}
                          title="Preview attachment"
                          className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-white rounded-md transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await triggerFileDownload(att.url, att.name);
                          if (ok) {
                            showToast(`Downloading "${att.name}"`, 'success');
                          } else {
                            showToast('Unable to download attachment.', 'error');
                          }
                        }}
                        title="Download attachment"
                        className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-white rounded-md transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tags Footer */}
        {article.tags && article.tags.length > 0 && (
          <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Archived Under:</span>
            {article.tags.map((tag, idx) => (
              <span key={tag}>
                #{tag}
                {idx < article.tags.length - 1 && (
                  <span className="ml-2" aria-hidden="true">
                    ·
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* Revision History Section */}
      {article.revisionHistory && article.revisionHistory.length > 0 && (
        <div className="bg-white/85 rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-3 no-print">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Revision History ({article.revisionHistory.length} previous version
              {article.revisionHistory.length === 1 ? '' : 's'})
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {article.revisionHistory.map((rev, idx) => {
              const expanded = expandedRevisionIdx === idx;
              return (
                <div key={idx} className="py-3 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-indigo-900">
                        {rev.version}
                      </span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="font-semibold text-slate-800">
                        {rev.changeNote || 'Revision saved'}
                      </span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="text-slate-500">
                        {rev.updatedBy} ({new Date(rev.updatedAt).toLocaleString()})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRevisionIdx(expanded ? null : idx)
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 shrink-0"
                    >
                      <span>{expanded ? 'Hide Snapshot' : 'View Snapshot'}</span>
                      {expanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {expanded && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5 text-[11px] text-slate-700">
                      <p className="font-bold text-slate-900">{rev.title}</p>
                      {rev.summary && <p className="italic">{rev.summary}</p>}
                      <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed pt-1">
                        {rev.content}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Related Documents from Repository */}
      {relatedDocuments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-6 space-y-4 no-print">
          <h2 className="text-sm font-bold text-slate-900">
            Related Documents in {article.categoryName}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedDocuments.map((docItem) => (
              <div
                key={docItem.id}
                className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
              >
                <button
                  type="button"
                  onClick={() => onPreviewDocument?.(docItem)}
                  className="min-w-0 text-left flex-1 group"
                >
                  <p className="font-semibold text-slate-900 truncate group-hover:text-indigo-700">
                    {docItem.title}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {docItem.fileName} · {formatFileSize(docItem.fileSize)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await incrementDocumentDownloads(docItem.id);
                    const ok = await triggerFileDownload(
                      docItem.fileUrl,
                      docItem.fileName
                    );
                    if (ok) {
                      showToast(`Downloading "${docItem.fileName}"`, 'success');
                    }
                  }}
                  title="Download file"
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
