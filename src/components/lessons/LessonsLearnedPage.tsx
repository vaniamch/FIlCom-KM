import React, { useState, useMemo, useEffect } from 'react';
import {
  Lightbulb,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Trash2,
  Edit3,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { LessonLearned, Category } from '../../types';

interface LessonsLearnedPageProps {
  lessons: LessonLearned[];
  categories: Category[];
  onOpenCreateLesson: () => void;
  onEditLesson?: (lesson: LessonLearned) => void;
  onDeleteLesson: (id: string) => void;
  globalSearch?: string;
}

export const LessonsLearnedPage: React.FC<LessonsLearnedPageProps> = ({
  lessons,
  categories,
  onOpenCreateLesson,
  onEditLesson,
  onDeleteLesson,
  globalSearch = '',
}) => {
  const { isAdmin, isEditor, currentUser } = useAuth();
  const { confirmAction } = useUI();
  const [search, setSearch] = useState(globalSearch);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [impactFilter, setImpactFilter] = useState('all');

  useEffect(() => {
    setSearch(globalSearch);
  }, [globalSearch]);

  const filteredLessons = useMemo(() => {
    return lessons.filter((lsn) => {
      const matchQuery =
        !search ||
        lsn.activityTitle.toLowerCase().includes(search.toLowerCase()) ||
        lsn.challenges.toLowerCase().includes(search.toLowerCase()) ||
        lsn.solutions.toLowerCase().includes(search.toLowerCase()) ||
        lsn.recommendations.toLowerCase().includes(search.toLowerCase()) ||
        lsn.authorName?.toLowerCase().includes(search.toLowerCase());

      const matchCat = categoryFilter === 'all' || lsn.categoryId === categoryFilter;
      const matchImpact = impactFilter === 'all' || lsn.impactLevel === impactFilter;

      return matchQuery && matchCat && matchImpact;
    });
  }, [lessons, search, categoryFilter, impactFilter]);

  const getImpactBadge = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high':
        return (
          <span className="text-rose-700 font-bold text-[11px] flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            High Impact Blocker
          </span>
        );
      case 'medium':
        return (
          <span className="text-amber-700 font-semibold text-[11px] flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Medium Impact
          </span>
        );
      case 'low':
        return (
          <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Optimization Tip
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Lessons Learned & Wisdom
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Hard-won experiences, emergency fixes, and preventative rules contributed by university leaders.
          </p>
        </div>

        {isEditor && (
          <button
            onClick={onOpenCreateLesson}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-full shadow-[0_4px_14px_rgba(11,19,43,0.2)] transition-all self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Contribute Wisdom</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="bg-white/80 backdrop-blur-md border border-white/90 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search challenges, solutions, or guidelines..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-full focus:outline-none transition-colors text-slate-900"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl focus:outline-none text-slate-700 font-medium"
            >
              <option value="all">All Divisions</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl focus:outline-none text-slate-700 font-medium"
            >
              <option value="all">All Impact Levels</option>
              <option value="high">High Impact Risks</option>
              <option value="medium">Medium Impact</option>
              <option value="low">Low Impact Optimizations</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lessons List */}
      {filteredLessons.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 p-12 text-center shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)]">
          <Lightbulb className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No lessons recorded</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Help upcoming student committees avoid previous pitfalls by submitting a lesson.
          </p>
          {isEditor && (
            <button
              onClick={onOpenCreateLesson}
              className="mt-4 px-5 py-2 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-full shadow-2xs transition-colors"
            >
              Contribute First Lesson
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredLessons.map((lesson) => {
            const ownerUid = lesson.createdBy || lesson.authorId;
            const isOwner = !!currentUser?.uid && ownerUid === currentUser.uid;
            const canModify = isAdmin || (isEditor && isOwner);
            return (
              <div
                key={lesson.id}
                className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] hover:shadow-[0_8px_24px_-4px_rgba(79,114,205,0.12)] hover:border-indigo-300 transition-all p-5 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Top metadata */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                    <span className="font-semibold text-slate-800">{lesson.categoryName}</span>
                    <div className="flex items-center gap-2">
                      {getImpactBadge(lesson.impactLevel)}
                      {canModify && onEditLesson && (
                        <button
                          onClick={() => onEditLesson(lesson)}
                          className="p-1 text-slate-400 hover:text-indigo-700 transition-colors"
                          title="Edit entry"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canModify && (
                        <button
                          onClick={async () => {
                            const confirmed = await confirmAction({
                              title: 'Delete Lesson Learned',
                              message: `Delete "${lesson.activityTitle}"?`,
                              confirmLabel: 'Delete Entry',
                              danger: true,
                            });
                            if (confirmed) {
                              onDeleteLesson(lesson.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Activity Title */}
                  <h2 className="text-sm font-bold text-slate-900">
                    {lesson.activityTitle}
                  </h2>

                  {/* 3 Step Insight Matrix */}
                  <div className="space-y-2.5 text-xs">
                    <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-100">
                      <span className="font-bold text-rose-900 block text-[11px] mb-1">
                        Challenge Encountered:
                      </span>
                      <p className="text-slate-800 leading-relaxed">{lesson.challenges}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                      <span className="font-bold text-slate-900 block text-[11px] mb-1">
                        Applied Solution:
                      </span>
                      <p className="text-slate-800 leading-relaxed">{lesson.solutions}</p>
                    </div>

                    <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                      <span className="font-bold text-indigo-950 block text-[11px] mb-1">
                        Recommendation for Next Term:
                      </span>
                      <p className="text-slate-800 font-medium leading-relaxed">{lesson.recommendations}</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5" />
                    <span>Contributed by {lesson.authorName}</span>
                  </div>
                  <span className="tabular-nums">
                    {new Date(lesson.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
