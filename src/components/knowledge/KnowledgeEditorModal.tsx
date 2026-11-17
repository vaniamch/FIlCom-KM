import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileText,
  AlertCircle,
  Upload,
  Loader2,
  Paperclip,
  ArrowUp,
  ArrowDown,
  Eye,
  Download,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import {
  KnowledgeArticle,
  Category,
  DocumentAttachment,
  ArticleStatus,
  SOPStep,
} from '../../types';
import { DIVISION_CATEGORIES } from '../../services/seedService';
import {
  uploadFileFast,
  validateUploadFile,
  validateExternalUrl,
  formatFileSize,
  cleanupStoredFile,
  isPreviewSupported,
} from '../../utils/fileUpload';
import { triggerFileDownload } from '../../utils/fileActions';
import { validateSopPublishEligibility } from '../../services/firestoreService';

interface KnowledgeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (articleData: Partial<KnowledgeArticle>) => Promise<void>;
  categories: Category[];
  initialData?: KnowledgeArticle | null;
  defaultIsSOP?: boolean;
  onPreviewAttachment?: (att: DocumentAttachment) => void;
}

const KNOWLEDGE_TYPES = [
  'Guide',
  'Policy',
  'Template',
  'Best Practice',
  'Reference',
  'Minutes',
  'SOP',
];

export const KnowledgeEditorModal: React.FC<KnowledgeEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  initialData,
  defaultIsSOP = false,
  onPreviewAttachment,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useUI();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableDivisions =
    categories && categories.length > 0 ? categories : DIVISION_CATEGORIES;

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(
    availableDivisions[0]?.id || 'cat_leader'
  );
  const [department, setDepartment] = useState('');
  const [knowledgeType, setKnowledgeType] = useState('Guide');
  const [authorName, setAuthorName] = useState('');
  const [createdDateInput, setCreatedDateInput] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<ArticleStatus>('published');
  const [isSOP, setIsSOP] = useState(false);
  const [targetCommittee, setTargetCommittee] = useState('Event Management');

  // SOP Metadata Fields
  const [sopNumber, setSopNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [scope, setScope] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [references, setReferences] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [approver, setApprover] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [revisionNumber, setRevisionNumber] = useState('1.0');
  const [changeNote, setChangeNote] = useState('');

  const [sopSteps, setSopSteps] = useState<SOPStep[]>([
    {
      step: 1,
      title: 'Prerequisites & Preparation',
      detail: 'Gather requirements, verify credentials, and prepare initial checklist.',
      pic: '',
      notes: '',
    },
    {
      step: 2,
      title: 'Operational Execution',
      detail: 'Coordinate with division team and carry out standard procedure.',
      pic: '',
      notes: '',
    },
  ]);

  // Attachments State
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const [sessionUploadedAttachments, setSessionUploadedAttachments] = useState<
    DocumentAttachment[]
  >([]);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const nextIsSop = initialData ? !!initialData.isSOP : defaultIsSOP;
    const initialCatId =
      initialData?.categoryId || availableDivisions[0]?.id || 'cat_leader';
    const matchedCat = availableDivisions.find((c) => c.id === initialCatId);

    setTitle(initialData?.title || '');
    setCategoryId(initialCatId);
    setDepartment(
      initialData?.department ||
        initialData?.targetCommittee ||
        matchedCat?.name ||
        userProfile?.department ||
        'Leader'
    );
    setKnowledgeType(
      initialData?.knowledgeType || (nextIsSop ? 'SOP' : 'Guide')
    );
    setAuthorName(
      initialData?.authorName ||
        userProfile?.displayName ||
        currentUser?.displayName ||
        'Committee Lead'
    );
    setCreatedDateInput(
      initialData?.createdAt
        ? initialData.createdAt.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setSummary(initialData?.summary || '');
    setContent(initialData?.content || '');
    setTagsInput(initialData?.tags?.join(', ') || '');
    setStatus(initialData?.status || (nextIsSop ? 'draft' : 'published'));
    setIsSOP(nextIsSop);
    setTargetCommittee(
      initialData?.targetCommittee || matchedCat?.name || 'Event Management'
    );

    // SOP metadata
    setSopNumber(initialData?.sopNumber || (nextIsSop ? 'SOP-NEW' : ''));
    setPurpose(initialData?.purpose || '');
    setScope(initialData?.scope || '');
    setResponsibilities(initialData?.responsibilities || '');
    setReferences(initialData?.references || '');
    setReviewer(initialData?.reviewer || '');
    setApprover(initialData?.approver || '');
    setEffectiveDate(
      initialData?.effectiveDate || new Date().toISOString().slice(0, 10)
    );
    setReviewDate(initialData?.reviewDate || '');
    setRevisionNumber(
      initialData?.revisionNumber || (initialData ? '1.1' : '1.0')
    );
    setChangeNote('');

    setSopSteps(
      initialData?.sopSteps && initialData.sopSteps.length > 0
        ? initialData.sopSteps.map((s, idx) => ({
            step: idx + 1,
            title: s.title || '',
            detail: s.detail || '',
            pic: s.pic || '',
            notes: s.notes || '',
          }))
        : [
            {
              step: 1,
              title: 'Prerequisites & Preparation',
              detail:
                'Gather requirements, verify credentials, and prepare initial checklist.',
              pic: '',
              notes: '',
            },
            {
              step: 2,
              title: 'Operational Execution',
              detail:
                'Coordinate with division team and carry out standard procedure.',
              pic: '',
              notes: '',
            },
          ]
    );
    setAttachments(initialData?.attachments || []);
    setSessionUploadedAttachments([]);
    setAttachmentName('');
    setAttachmentUrl('');
    setError(null);
  }, [isOpen, initialData, defaultIsSOP]);

  if (!isOpen) return null;

  const handleCloseCancel = async () => {
    if (saving || isUploadingAttachment) return;
    // Clean up any temporary uploads from this cancelled modal session
    if (sessionUploadedAttachments.length > 0) {
      await Promise.all(
        sessionUploadedAttachments.map((att) =>
          cleanupStoredFile(att.url, att.storagePath)
        )
      );
      setSessionUploadedAttachments([]);
    }
    onClose();
  };

  const handleAddSopStep = () => {
    setSopSteps((prev) => [
      ...prev,
      { step: prev.length + 1, title: '', detail: '', pic: '', notes: '' },
    ]);
  };

  const handleRemoveSopStep = (index: number) => {
    setSopSteps((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((s, idx) => ({ ...s, step: idx + 1 }));
    });
  };

  const handleMoveSopStep = (index: number, direction: 'up' | 'down') => {
    setSopSteps((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy.map((s, idx) => ({ ...s, step: idx + 1 }));
    });
  };

  const handleUpdateSopStep = (
    index: number,
    field: 'title' | 'detail' | 'pic' | 'notes',
    value: string
  ) => {
    setSopSteps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    const validation = validateUploadFile(file);
    if (!validation.valid) {
      const msg = validation.error || 'Unsupported file.';
      setError(msg);
      showToast(msg, 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploadingAttachment(true);
    setUploadProgress(12);

    try {
      const result = await uploadFileFast(file, 'knowledge_attachments', (pct) => {
        setUploadProgress(pct);
      });

      const uploadedAttachment: DocumentAttachment = {
        name: file.name,
        url: result.url,
        size: file.size,
        type: validation.extension || 'doc',
        storagePath: result.storagePath,
      };

      setAttachments((prev) => [...prev, uploadedAttachment]);
      setSessionUploadedAttachments((prev) => [...prev, uploadedAttachment]);
      showToast(`Uploaded "${file.name}" successfully.`, 'success');
    } catch (err: any) {
      const msg = `Failed to attach document: ${err?.message || 'Upload error'}`;
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsUploadingAttachment(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleAddManualLink = () => {
    setError(null);
    if (!attachmentName.trim()) {
      setError('Please enter a label for the external attachment link.');
      return;
    }
    const urlCheck = validateExternalUrl(attachmentUrl);
    if (!urlCheck.valid || !urlCheck.normalized) {
      setError(urlCheck.error || 'Please provide a valid URL.');
      return;
    }

    setAttachments((prev) => [
      ...prev,
      {
        name: attachmentName.trim(),
        url: urlCheck.normalized!,
        size: 0,
        type:
          urlCheck.normalized!.toLowerCase().includes('sheet') ||
          urlCheck.normalized!.includes('xlsx')
            ? 'xlsx'
            : 'link',
      },
    ]);
    setAttachmentName('');
    setAttachmentUrl('');
    showToast('External document link attached.', 'success');
  };

  const handleRemoveAttachment = async (index: number) => {
    const target = attachments[index];
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    // If uploaded during this session (not yet saved to DB), clean up immediately
    if (
      target &&
      sessionUploadedAttachments.some((s) => s.url === target.url)
    ) {
      setSessionUploadedAttachments((prev) =>
        prev.filter((s) => s.url !== target.url)
      );
      await cleanupStoredFile(target.url, target.storagePath);
    }
  };

  const saveArticleWithStatus = async (overrideStatus?: ArticleStatus) => {
    if (saving || isUploadingAttachment) return;
    setError(null);

    const targetStatus = overrideStatus || status;

    if (title.trim().length < 3) {
      setError('Article title must be at least 3 characters long.');
      return;
    }
    if (content.trim().length < 10) {
      setError('Detailed content must be at least 10 characters long.');
      return;
    }
    if (!categoryId) {
      setError('Please select an organizational division.');
      return;
    }
    if (isSOP) {
      if (!sopNumber.trim()) {
        setError('SOP Number is required for Standard Operating Procedures.');
        return;
      }
      const validSteps = sopSteps.filter((s) => s.title.trim());
      if (validSteps.length === 0) {
        setError('Please include at least one procedure step with a title.');
        return;
      }
    }

    // Build attachments list (including any filled manual link)
    const finalAttachments = [...attachments];
    if (attachmentName.trim() && attachmentUrl.trim()) {
      const urlCheck = validateExternalUrl(attachmentUrl);
      if (!urlCheck.valid || !urlCheck.normalized) {
        setError(urlCheck.error || 'Invalid attachment URL.');
        return;
      }
      finalAttachments.push({
        name: attachmentName.trim(),
        url: urlCheck.normalized,
        size: 0,
        type: 'link',
      });
    }

    const selectedCat = availableDivisions.find((c) => c.id === categoryId);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const payload: Partial<KnowledgeArticle> = {
      title: title.trim(),
      categoryId,
      categoryName: selectedCat?.name || 'Leader',
      department: department.trim() || selectedCat?.name || 'Leader',
      knowledgeType: isSOP ? 'SOP' : knowledgeType || 'Guide',
      authorName:
        authorName.trim() ||
        userProfile?.displayName ||
        currentUser?.displayName ||
        'Committee Lead',
      summary: summary.trim() || title.trim(),
      content: content.trim(),
      tags,
      status: targetStatus,
      isSOP: !!isSOP,
      targetCommittee: isSOP
        ? targetCommittee || selectedCat?.name || 'Event Management'
        : '',
      sopNumber: isSOP ? sopNumber.trim() : undefined,
      purpose: isSOP ? purpose.trim() : undefined,
      scope: isSOP ? scope.trim() : undefined,
      responsibilities: isSOP ? responsibilities.trim() : undefined,
      references: isSOP ? references.trim() : undefined,
      reviewer: isSOP ? reviewer.trim() : undefined,
      approver: isSOP ? approver.trim() : undefined,
      effectiveDate: isSOP ? effectiveDate : undefined,
      reviewDate: isSOP ? reviewDate : undefined,
      revisionNumber: isSOP ? revisionNumber.trim() || '1.0' : undefined,
      sopSteps: isSOP
        ? sopSteps
            .filter((s) => s.title.trim())
            .map((s, idx) => ({
              step: idx + 1,
              title: s.title.trim(),
              detail: s.detail.trim(),
              pic: s.pic?.trim() || '',
              notes: s.notes?.trim() || '',
            }))
        : [],
      attachments: finalAttachments,
      ...(initialData ? {} : createdDateInput ? { createdAt: new Date(createdDateInput).toISOString() } : {}),
    };

    try {
      validateSopPublishEligibility(payload, initialData || null);
    } catch (err: any) {
      const msg = err?.message || 'SOP approval requirements not met.';
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...payload,
        ...(changeNote.trim() ? { _changeNote: changeNote.trim() } : {}),
      } as any);
      setSessionUploadedAttachments([]);
      onClose();
    } catch (err: any) {
      console.error('Submit error in KnowledgeEditorModal:', err);
      const msg =
        err?.message ||
        'Failed to save knowledge article. Please check input and try again.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveArticleWithStatus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col my-6 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base">
                {initialData
                  ? 'Edit Knowledge Article / SOP'
                  : isSOP
                  ? 'Create Standard Operating Procedure (SOP)'
                  : 'Document Knowledge Article'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {isSOP ? 'SOP Workflow' : 'Standard Guide'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Preserve institutional wisdom, guidelines, and attachments for future student leaders.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseCancel}
            disabled={saving || isUploadingAttachment}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs"
        >
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {isSOP ? 'SOP Title *' : 'Article or Knowledge Title *'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Campus Festival Stage Equipment & Power Safety Protocol"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none transition-colors text-xs font-semibold text-slate-900"
            />
          </div>

          {/* Division & Format & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Category / Division *
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  const newCatId = e.target.value;
                  setCategoryId(newCatId);
                  const matched = availableDivisions.find(
                    (c) => c.id === newCatId
                  );
                  if (matched) {
                    setDepartment(matched.name);
                    if (isSOP) setTargetCommittee(matched.name);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none text-slate-900 font-medium"
              >
                {availableDivisions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Document Type
              </label>
              <select
                value={isSOP ? 'sop' : 'standard'}
                onChange={(e) => {
                  const nextSop = e.target.value === 'sop';
                  setIsSOP(nextSop);
                  if (nextSop) {
                    setKnowledgeType('SOP');
                    if (!sopNumber) setSopNumber('SOP-NEW');
                    if (status === 'published' && !initialData?.approvedBy) {
                      setStatus('draft');
                    }
                  } else {
                    if (knowledgeType === 'SOP') setKnowledgeType('Guide');
                    if (
                      ['pending_review', 'in_review', 'approved', 'rejected'].includes(
                        status
                      )
                    ) {
                      setStatus('draft');
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none text-slate-900 font-medium"
              >
                <option value="standard">Standard Article / Guide</option>
                <option value="sop">Standard Operating Procedure (SOP)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isSOP ? 'SOP Status' : 'Publication Status'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ArticleStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none text-slate-900 font-medium"
              >
                {isSOP ? (
                  <>
                    <option value="draft">Draft</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="in_review">In Review</option>
                    <option value="approved">Approved</option>
                    <option value="published">Published</option>
                    <option value="rejected">Rejected</option>
                    <option value="archived">Archived</option>
                  </>
                ) : (
                  <>
                    <option value="published">Published (Live to All)</option>
                    <option value="draft">Draft (Save for Review)</option>
                    <option value="archived">Archived</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Department, Knowledge Type, Author, Creation Date */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Event Management"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Knowledge Kind
              </label>
              <select
                value={isSOP ? 'SOP' : knowledgeType}
                disabled={isSOP}
                onChange={(e) => setKnowledgeType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none text-slate-900 disabled:opacity-70"
              >
                {KNOWLEDGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Author / Owner
              </label>
              <input
                type="text"
                value={authorName}
                readOnly
                placeholder="Document owner name"
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none text-slate-700 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Creation Date
              </label>
              <input
                type="date"
                value={createdDateInput}
                disabled={!!initialData}
                onChange={(e) => setCreatedDateInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none text-slate-900 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Conditional: SOP Metadata & Step Builder */}
          {isSOP && (
            <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-xl space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    SOP Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={sopNumber}
                    onChange={(e) => setSopNumber(e.target.value)}
                    placeholder="e.g. SOP-04"
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Responsible Division
                  </label>
                  <select
                    value={targetCommittee}
                    onChange={(e) => setTargetCommittee(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900 font-medium"
                  >
                    {availableDivisions.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name} Division
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Revision Number
                  </label>
                  <input
                    type="text"
                    value={revisionNumber}
                    onChange={(e) => setRevisionNumber(e.target.value)}
                    placeholder="e.g. 1.0"
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Reviewer
                  </label>
                  <input
                    type="text"
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                    placeholder="Reviewer name/role"
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Approver
                  </label>
                  <input
                    type="text"
                    value={approver}
                    onChange={(e) => setApprover(e.target.value)}
                    placeholder="Approver name/role"
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Review Date
                  </label>
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Purpose
                  </label>
                  <textarea
                    rows={2}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Objective and rationale for this SOP..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Scope
                  </label>
                  <textarea
                    rows={2}
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    placeholder="Which divisions, events, or members this SOP applies to..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Responsibilities
                  </label>
                  <textarea
                    rows={2}
                    value={responsibilities}
                    onChange={(e) => setResponsibilities(e.target.value)}
                    placeholder="Role responsibilities (Lead, PIC, Treasurer, Secretary)..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    References & Related Documents
                  </label>
                  <textarea
                    rows={2}
                    value={references}
                    onChange={(e) => setReferences(e.target.value)}
                    placeholder="Related policies, templates, or campus regulations..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              {/* SOP Step-by-Step Builder */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    Step-by-Step Procedure Builder ({sopSteps.length} Steps)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSopStep}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {sopSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#0b132b] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          required
                          placeholder={`Step ${idx + 1} Title (e.g. Submit Faculty Facility Requisition)`}
                          value={step.title}
                          onChange={(e) =>
                            handleUpdateSopStep(idx, 'title', e.target.value)
                          }
                          className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none text-slate-900"
                        />
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveSopStep(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            title="Move step up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSopStep(idx, 'down')}
                            disabled={idx === sopSteps.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            title="Move step down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          {sopSteps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSopStep(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title="Delete step"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Detailed step instructions, checklists, required approvals..."
                        value={step.detail}
                        onChange={(e) =>
                          handleUpdateSopStep(idx, 'detail', e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none text-slate-800"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="PIC / Responsible Person (e.g. Logistics Lead)"
                          value={step.pic || ''}
                          onChange={(e) =>
                            handleUpdateSopStep(idx, 'pic', e.target.value)
                          }
                          className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:bg-white focus:outline-none text-slate-800"
                        />
                        <input
                          type="text"
                          placeholder="Step notes / SLA / verification hint"
                          value={step.notes || ''}
                          onChange={(e) =>
                            handleUpdateSopStep(idx, 'notes', e.target.value)
                          }
                          className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:bg-white focus:outline-none text-slate-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Executive Summary */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Executive Summary / Description (1-2 sentences)
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief synopsis highlighting key instructions for future leaders..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none text-slate-900"
            />
          </div>

          {/* Full Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                Detailed Knowledge Content *
              </label>
              <span className="text-[11px] text-slate-400">
                Supports markdown headings & lists
              </span>
            </div>
            <textarea
              rows={7}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write detailed documentation, procedures, vendor contacts, protocols, notes..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none text-xs text-slate-900 leading-relaxed"
            />
          </div>

          {/* Tags & Revision Change Note */}
          <div className={initialData ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Tags / Keywords (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. Budget, Protocol, Stage, Vendors, Security, Annual Event"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none text-slate-900 font-medium"
              />
            </div>

            {initialData && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Revision Note (for History)
                </label>
                <input
                  type="text"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="Summary of changes in this revision..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl focus:outline-none text-slate-900"
                />
              </div>
            )}
          </div>

          {/* Attachments Section */}
          <div className="p-4.5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-indigo-700" />
                <h3 className="font-bold text-slate-900">
                  Attach Documents, Templates & Files
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                {attachments.length} file{attachments.length === 1 ? '' : 's'} attached
              </span>
            </div>

            {/* Direct Local File Dropzone / Picker */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isUploadingAttachment && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-indigo-600 bg-indigo-50/50'
                  : 'border-slate-300 hover:border-indigo-500 bg-white'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp"
                className="hidden"
              />
              <div className="flex flex-col items-center gap-1.5">
                {isUploadingAttachment ? (
                  <div className="w-full max-w-xs space-y-1.5 py-2">
                    <div className="flex items-center justify-center gap-2 text-indigo-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="font-bold text-xs">
                        Uploading document... {uploadProgress}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-150"
                        style={{ width: `${Math.max(10, uploadProgress)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-700">
                      Click to{' '}
                      <span className="text-indigo-600 underline">
                        Attach File
                      </span>{' '}
                      or drag & drop here
                    </p>
                    <p className="text-[11px] text-slate-400">
                      PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, JPG, PNG, WEBP (up to 8MB)
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Optional Cloud Link Input */}
            <div className="pt-1">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                Or attach external link (Google Drive, Spreadsheet, Figma):
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Document label (e.g. Master_Budget_2026.xlsx)"
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 text-slate-900"
                />
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddManualLink}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs whitespace-nowrap"
                >
                  Add Link
                </button>
              </div>
            </div>

            {/* Attached Documents List */}
            {attachments.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Attached to this Article:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {att.name}
                          </p>
                          <p className="text-[10px] text-slate-400 uppercase">
                            {att.type || 'DOC'}{' '}
                            {att.size ? `· ${formatFileSize(att.size)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {onPreviewAttachment &&
                          isPreviewSupported(att.type, att.name, att.url) && (
                            <button
                              type="button"
                              onClick={() => onPreviewAttachment(att)}
                              className="text-slate-400 hover:text-indigo-600 p-1.5 transition-colors"
                              title="Preview attachment"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await triggerFileDownload(att.url, att.name);
                            if (!ok) {
                              showToast('Unable to download attachment.', 'error');
                            }
                          }}
                          className="text-slate-400 hover:text-indigo-600 p-1.5 transition-colors"
                          title="Download attachment"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 transition-colors"
                          title="Remove attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            {isSOP
              ? 'SOP follows review & approval governance before publishing.'
              : 'Article will be searchable in Knowledge Hub.'}
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCloseCancel}
              disabled={saving || isUploadingAttachment}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveArticleWithStatus('draft')}
              disabled={saving || isUploadingAttachment}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-50 rounded-xl transition-colors"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => saveArticleWithStatus()}
              disabled={saving || isUploadingAttachment}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] disabled:opacity-50 rounded-xl shadow-md transition-all transform hover:-translate-y-0.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to KMS...</span>
                </>
              ) : initialData ? (
                'Update Article'
              ) : isSOP ? (
                status === 'published' ? (
                  'Publish SOP Workflow'
                ) : (
                  'Save SOP Workflow'
                )
              ) : status === 'draft' ? (
                'Save Draft'
              ) : (
                'Publish Knowledge'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
