import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarDays, 
  Search, 
  Plus, 
  ExternalLink, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit3,
  Calendar,
  Clock,
  Building2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { CampusEvent } from '../../types';

interface EventArchivePageProps {
  events: CampusEvent[];
  onOpenCreateEvent: () => void;
  onEditEvent: (event: CampusEvent) => void;
  onDeleteEvent: (id: string) => void;
  globalSearch?: string;
}

export const EventArchivePage: React.FC<EventArchivePageProps> = ({
  events,
  onOpenCreateEvent,
  onEditEvent,
  onDeleteEvent,
  globalSearch = '',
}) => {
  const { isEditor, isAdmin, currentUser } = useAuth();
  const { confirmAction } = useUI();
  const [search, setSearch] = useState(globalSearch);
  const [academicYearFilter, setAcademicYearFilter] = useState('all');

  useEffect(() => {
    setSearch(globalSearch);
  }, [globalSearch]);

  const academicYears = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.academicYear) set.add(e.academicYear);
    });
    return Array.from(set).sort().reverse();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const matchQuery =
        !search ||
        evt.title.toLowerCase().includes(search.toLowerCase()) ||
        evt.description?.toLowerCase().includes(search.toLowerCase()) ||
        evt.committee?.toLowerCase().includes(search.toLowerCase()) ||
        evt.outcomes?.toLowerCase().includes(search.toLowerCase());

      const matchYear = academicYearFilter === 'all' || evt.academicYear === academicYearFilter;

      return matchQuery && matchYear;
    });
  }, [events, search, academicYearFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Event Archive
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Historical activity records, post-event reports, budgets, attendance metrics, and retrospective evaluations.
          </p>
        </div>

        {isEditor && (
          <button
            onClick={onOpenCreateEvent}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-full shadow-[0_4px_14px_rgba(11,19,43,0.2)] transition-all self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Archive New Event</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="bg-white/80 backdrop-blur-md border border-white/90 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search past events by name, committee, or keywords..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-full focus:outline-none transition-colors text-slate-900"
            />
          </div>

          <div className="md:col-span-4">
            <select
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50/80 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl focus:outline-none text-slate-700 font-medium"
            >
              <option value="all">All Academic Years</option>
              {academicYears.map((yr) => (
                <option key={yr} value={yr}>
                  Academic Year {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 p-12 text-center shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)]">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No events archived yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Document your student organization's past hackathons, leadership summits, and orientations.
          </p>
          {isEditor && (
            <button
              onClick={onOpenCreateEvent}
              className="mt-4 px-5 py-2 text-xs font-bold text-white bg-[#0b132b] hover:bg-[#15234d] rounded-full shadow-2xs transition-colors"
            >
              Archive First Event
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const ownerUid = event.createdBy || event.authorId;
            const isOwner = !!currentUser?.uid && ownerUid === currentUser.uid;
            const canModify = isAdmin || (isEditor && isOwner);
            return (
              <div
                key={event.id}
                className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 shadow-[0_4px_20px_-4px_rgba(79,114,205,0.08)] hover:shadow-[0_8px_24px_-4px_rgba(79,114,205,0.12)] hover:border-indigo-300 transition-all p-6 space-y-4"
              >
                {/* Header row with Zero-Pill unboxed metadata */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {event.title}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span>{event.committee}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {new Date(event.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">Year {event.academicYear}</span>
                    </div>
                  </div>

                  {canModify && (
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        onClick={() => onEditEvent(event)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                        title="Edit event"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const confirmed = await confirmAction({
                            title: 'Delete Event Archive',
                            message: `Delete archived record for "${event.title}"?`,
                            confirmLabel: 'Delete Event',
                            danger: true,
                          });
                          if (confirmed) {
                            onDeleteEvent(event.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title="Delete event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Description */}
                {event.description && (
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {event.description}
                  </p>
                )}

                {/* Two-box outcomes and evaluation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {event.outcomes && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                      <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
                        Outcomes & Quantifiable Metrics
                      </span>
                      <p className="text-slate-700 leading-relaxed">{event.outcomes}</p>
                    </div>
                  )}

                  {event.evaluation && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                      <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
                        Post-Mortem Evaluation
                      </span>
                      <p className="text-slate-700 leading-relaxed">{event.evaluation}</p>
                    </div>
                  )}
                </div>

                {/* Footer links: Documentation Drive & Reports */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    {event.documentationUrl && (
                      <a
                        href={event.documentationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 hover:text-indigo-900 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Photo Drive / Media Archive</span>
                      </a>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Logged by {event.authorName}
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
