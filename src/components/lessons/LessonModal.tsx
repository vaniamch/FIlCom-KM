import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Category, LessonLearned } from '../../types';
import { DIVISION_CATEGORIES } from '../../services/seedService';

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lessonData: Omit<LessonLearned, 'id' | 'createdAt'>) => Promise<void>;
  categories: Category[];
  initialData?: LessonLearned | null;
}

export const LessonModal: React.FC<LessonModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  initialData,
}) => {
  const { currentUser, userProfile } = useAuth();

  const availableDivisions = categories && categories.length > 0 ? categories : DIVISION_CATEGORIES;

  const [activityTitle, setActivityTitle] = useState('');
  const [categoryId, setCategoryId] = useState(availableDivisions[0]?.id || 'cat_leader');
  const [challenges, setChallenges] = useState('');
  const [solutions, setSolutions] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [impactLevel, setImpactLevel] = useState<'low' | 'medium' | 'high'>('high');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setActivityTitle(initialData?.activityTitle || '');
    setCategoryId(initialData?.categoryId || availableDivisions[0]?.id || 'cat_leader');
    setChallenges(initialData?.challenges || '');
    setSolutions(initialData?.solutions || '');
    setRecommendations(initialData?.recommendations || '');
    setImpactLevel(initialData?.impactLevel || 'high');
    setError(null);
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activityTitle.trim().length < 3) {
      setError('Activity title is required.');
      return;
    }
    if (!challenges.trim() || !solutions.trim() || !recommendations.trim()) {
      setError('Please provide the Challenge, Solution, and Recommendation.');
      return;
    }

    if (!currentUser?.uid) {
      setError('Authentication required to submit a lesson learned.');
      return;
    }

    const selectedCat = availableDivisions.find((c) => c.id === categoryId);
    setSaving(true);
    try {
      await onSave({
        activityTitle: activityTitle.trim(),
        categoryId,
        categoryName: selectedCat?.name || 'General',
        challenges: challenges.trim(),
        solutions: solutions.trim(),
        recommendations: recommendations.trim(),
        impactLevel,
        createdBy: initialData?.createdBy || currentUser.uid,
        authorId: initialData?.authorId || currentUser.uid,
        authorName:
          initialData?.authorName ||
          userProfile?.displayName ||
          currentUser.displayName ||
          'Committee Contributor',
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit lesson learned.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {initialData ? 'Edit Lesson Learned' : 'Contribute Lesson Learned'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Prevent recurring mistakes and pass practical solutions to future officers.
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
              Activity or Incident Context *
            </label>
            <input
              type="text"
              required
              value={activityTitle}
              onChange={(e) => setActivityTitle(e.target.value)}
              placeholder="e.g. Campus Hackathon: Electric Breaker Overload in Main Hall"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Division *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900 font-medium"
              >
                {availableDivisions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Impact Severity
              </label>
              <select
                value={impactLevel}
                onChange={(e) => setImpactLevel(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
              >
                <option value="high">High Impact (Critical risk/blocker)</option>
                <option value="medium">Medium Impact (Moderate setback)</option>
                <option value="low">Low Impact (Minor efficiency gain)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              1. What Went Wrong? (The Challenge) *
            </label>
            <textarea
              rows={2}
              required
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
              placeholder="Describe the failure, unexpected setback, or bottleneck..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              2. How Was It Resolved? (Immediate Solution) *
            </label>
            <textarea
              rows={2}
              required
              value={solutions}
              onChange={(e) => setSolutions(e.target.value)}
              placeholder="Describe the short-term fix applied on the spot..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              3. Future Recommendation (Institutional Advice) *
            </label>
            <textarea
              rows={3}
              required
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder="Mandatory guideline or preventive rule for next year's committee..."
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
              {saving ? 'Saving...' : initialData ? 'Update Lesson' : 'Log Lesson'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
