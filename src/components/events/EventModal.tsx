import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CampusEvent } from '../../types';
import { validateExternalUrl } from '../../utils/fileUpload';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Omit<CampusEvent, 'id' | 'createdAt'>) => Promise<void>;
  initialData?: CampusEvent | null;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const { currentUser, userProfile } = useAuth();

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [academicYear, setAcademicYear] = useState(initialData?.academicYear || '2026/2027');
  const [committee, setCommittee] = useState(initialData?.committee || 'Event Management');
  const [outcomes, setOutcomes] = useState(initialData?.outcomes || '');
  const [evaluation, setEvaluation] = useState(initialData?.evaluation || '');
  const [documentationUrl, setDocumentationUrl] = useState(initialData?.documentationUrl || '');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialData?.title || '');
    setDescription(initialData?.description || '');
    setDate(initialData?.date || new Date().toISOString().split('T')[0]);
    setAcademicYear(initialData?.academicYear || '2026/2027');
    setCommittee(initialData?.committee || 'Event Management');
    setOutcomes(initialData?.outcomes || '');
    setEvaluation(initialData?.evaluation || '');
    setDocumentationUrl(initialData?.documentationUrl || '');
    setError(null);
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError('Event title must be at least 3 characters.');
      return;
    }
    if (!committee.trim()) {
      setError('Committee name is required.');
      return;
    }

    let safeDocUrl: string | undefined;
    if (documentationUrl.trim()) {
      const urlCheck = validateExternalUrl(documentationUrl);
      if (!urlCheck.valid || !urlCheck.normalized) {
        setError(urlCheck.error || 'Please enter a valid http(s) URL for the Documentation link.');
        return;
      }
      safeDocUrl = urlCheck.normalized;
    }

    if (!currentUser?.uid) {
      setError('Authentication required to archive an event.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        date,
        academicYear,
        committee: committee.trim(),
        outcomes: outcomes.trim(),
        evaluation: evaluation.trim(),
        documentationUrl: safeDocUrl,
        createdBy: initialData?.createdBy || currentUser.uid,
        authorId: initialData?.authorId || currentUser.uid,
        authorName: initialData?.authorName || userProfile?.displayName || currentUser.displayName || 'Committee Lead',
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {initialData ? 'Edit Event Record' : 'Archive Past Campus Event'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Preserve execution details, attendance metrics, and post-event evaluations.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Campus Hackathon & Tech Summit 2026"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Event Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Academic Year *
              </label>
              <input
                type="text"
                required
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026/2027"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Lead Division *
              </label>
              <select
                value={committee}
                onChange={(e) => setCommittee(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900 font-medium"
              >
                {[
                  'Leader',
                  'Secretary',
                  'Treasurer',
                  'Event Management',
                  'Public Relations',
                  'Logistics & Equipment',
                  'Security',
                  'Catering',
                  'Multimedia',
                  'Fundraising'
                ].map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Event Description & Summary
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Overview of the activity, target audience, venue, and key highlights..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Key Outcomes & Quantifiable Metrics
            </label>
            <textarea
              rows={2}
              value={outcomes}
              onChange={(e) => setOutcomes(e.target.value)}
              placeholder="e.g. 240 attendees, 48 project submissions, $2,400 in merchandise revenue..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Post-Mortem Evaluation & Critical Notes
            </label>
            <textarea
              rows={3}
              value={evaluation}
              onChange={(e) => setEvaluation(e.target.value)}
              placeholder="What worked well, logistical roadblocks, and what future committees must improve..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Documentation & Photo Drive Link
            </label>
            <input
              type="url"
              value={documentationUrl}
              onChange={(e) => setDocumentationUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 disabled:opacity-50 rounded-lg shadow-2xs transition-colors"
            >
              {saving ? 'Saving...' : initialData ? 'Update Event' : 'Archive Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
