import React, { useState, useRef } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  FileText,
  FolderOpen,
  LogIn,
  Pause,
  Play,
  User as UserIcon,
} from 'lucide-react';
import { PageRoute } from '../../types';
import { useAuth } from '../../context/AuthContext';

import teamPlanningImg from '../../assets/images/committee_team_planning_1794727941705.jpg';
import archiveDeskImg from '../../assets/images/knowledge_archive_desk_1794727941492.jpg';
import auditoriumStageImg from '../../assets/images/campus_auditorium_stage_1794727942166.jpg';
import sopArchitectureImg from '../../assets/images/sop_workflow_architecture_1794727942610.jpg';
import multimediaStudioImg from '../../assets/images/multimedia_production_studio_1794727943170.jpg';
import libraryAtriumImg from '../../assets/images/campus_library_atrium_1794727944231.jpg';

interface LandingPageProps {
  onEnterKMS: (targetPage?: PageRoute, knowledgeFilter?: string) => void;
  onOpenAuth: () => void;
}

interface GalleryCard {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  route: PageRoute;
  knowledgeFilter?: string;
  aspectClass: string;
}

const COLUMNS: Array<{
  speedClass: string;
  cards: GalleryCard[];
}> = [
  {
    speedClass: 'ckh-track-up',
    cards: [
      {
        id: 'col1-a',
        image: teamPlanningImg,
        title: 'Committee Alignment',
        subtitle: 'Leader & Coordination Guides',
        route: 'knowledge',
        aspectClass: 'aspect-[4/3]',
      },
      {
        id: 'col1-b',
        image: libraryAtriumImg,
        title: 'Institutional Archive',
        subtitle: 'Knowledge Hub Repository',
        route: 'documents',
        aspectClass: 'aspect-[3/4]',
      },
      {
        id: 'col1-c',
        image: multimediaStudioImg,
        title: 'Multimedia Production',
        subtitle: 'Equipment & Stage Guides',
        route: 'knowledge',
        knowledgeFilter: 'sop',
        aspectClass: 'aspect-[4/3]',
      },
    ],
  },
  {
    speedClass: 'ckh-track-down',
    cards: [
      {
        id: 'col2-a',
        image: archiveDeskImg,
        title: 'SOP & Handbooks',
        subtitle: 'Secretary & Treasury Docs',
        route: 'knowledge',
        knowledgeFilter: 'sop',
        aspectClass: 'aspect-[3/4]',
      },
      {
        id: 'col2-b',
        image: auditoriumStageImg,
        title: 'FilKom Day Summit',
        subtitle: 'Past Event Evaluations',
        route: 'events',
        aspectClass: 'aspect-[4/3]',
      },
      {
        id: 'col2-c',
        image: sopArchitectureImg,
        title: 'Structured Workflows',
        subtitle: 'Standard Procedures',
        route: 'knowledge',
        knowledgeFilter: 'sop',
        aspectClass: 'aspect-[3/4]',
      },
    ],
  },
  {
    speedClass: 'ckh-track-up-slow',
    cards: [
      {
        id: 'col3-a',
        image: auditoriumStageImg,
        title: 'Event Operations',
        subtitle: 'Runsheets & Reports',
        route: 'events',
        aspectClass: 'aspect-[4/3]',
      },
      {
        id: 'col3-b',
        image: sopArchitectureImg,
        title: 'Division Blueprints',
        subtitle: '10 Committee Divisions',
        route: 'knowledge',
        aspectClass: 'aspect-[3/4]',
      },
      {
        id: 'col3-c',
        image: teamPlanningImg,
        title: 'Lessons Learned',
        subtitle: 'Peer Handover Insights',
        route: 'lessons',
        aspectClass: 'aspect-[4/3]',
      },
    ],
  },
  {
    speedClass: 'ckh-track-down-slow',
    cards: [
      {
        id: 'col4-a',
        image: multimediaStudioImg,
        title: 'Media & PR Assets',
        subtitle: 'Templates & Documentation',
        route: 'documents',
        aspectClass: 'aspect-[4/3]',
      },
      {
        id: 'col4-b',
        image: libraryAtriumImg,
        title: 'Shared Memory',
        subtitle: 'Across Generations',
        route: 'knowledge',
        aspectClass: 'aspect-[3/4]',
      },
      {
        id: 'col4-c',
        image: archiveDeskImg,
        title: 'Document Repository',
        subtitle: 'PDF, DOCX & Spreadsheets',
        route: 'documents',
        aspectClass: 'aspect-[3/4]',
      },
    ],
  },
];

const QUICK_ROUTES: Array<{
  route: PageRoute;
  knowledgeFilter?: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { route: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
  { route: 'knowledge', knowledgeFilter: 'sop', label: 'SOP Workflows', icon: FileText },
  { route: 'documents', label: 'Documents', icon: FolderOpen },
  { route: 'events', label: 'Event Archive', icon: Calendar },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterKMS,
  onOpenAuth,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [motionPaused, setMotionPaused] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLElement>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (motionPaused || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width - 0.5;
    const normY = (e.clientY - rect.top) / rect.height - 0.5;
    setPanOffset({
      x: Math.round(normX * -26),
      y: Math.round(normY * -18),
    });
  };

  const handlePointerLeave = () => {
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <main
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label="FilCom Knowledge Hub Interactive Landing"
      className="relative h-screen min-h-[640px] w-full overflow-hidden bg-gradient-to-br from-[#f4f8ff] via-[#e2ecfe] to-[#cedefb] text-[#0b132b] antialiased font-sans selection:bg-sky-200 selection:text-[#0b132b]"
    >
      {/* Moving Multi-Column Editorial Photo Canvas (Screenshot 2 Inspiration + Soft Blue & White Gradient) */}
      <div
        className="absolute -inset-6 sm:-inset-10 transition-transform duration-700 ease-out"
        style={{
          transform: motionPaused
            ? 'translate3d(0px, 0px, 0px)'
            : `translate3d(${panOffset.x}px, ${panOffset.y}px, 0px)`,
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5 h-full px-3 sm:px-6">
          {COLUMNS.map((column, colIdx) => {
            const visibilityClass =
              colIdx === 2
                ? 'hidden md:block'
                : colIdx === 3
                ? 'hidden lg:block'
                : 'block';

            return (
              <div
                key={colIdx}
                className={`relative h-full overflow-hidden ${visibilityClass}`}
              >
                <div
                  className={`flex flex-col gap-3.5 sm:gap-5 ${column.speedClass} ${
                    motionPaused ? 'ckh-motion-paused' : ''
                  }`}
                >
                  {[...column.cards, ...column.cards].map((card, idx) => (
                    <button
                      key={`${card.id}-${idx}`}
                      type="button"
                      onClick={() => onEnterKMS(card.route, card.knowledgeFilter)}
                      className={`group relative w-full ${card.aspectClass} rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-white via-[#eaf1ff] to-[#d5e3fc] border border-white/80 shadow-[0_14px_34px_-12px_rgba(37,65,130,0.18)] text-left focus-visible:outline-2 focus-visible:outline-[#1d4ed8] cursor-pointer shrink-0`}
                    >
                      <img
                        src={card.image}
                        alt={card.title}
                        referrerPolicy="no-referrer"
                        loading="eager"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* Soft blue-white atmospheric tint so photos harmonize with the palette */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0b132b]/75 via-[#1e3a8a]/10 to-white/15 opacity-70 group-hover:opacity-90 transition-opacity duration-300" />
                      <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4 text-white">
                        <p className="text-xs sm:text-sm font-bold leading-snug tracking-tight">
                          {card.title}
                        </p>
                        <p className="text-[11px] text-sky-100/90 font-medium mt-0.5 truncate">
                          {card.subtitle}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Luminous Soft Blue & White Gradient Veil (Screenshot 1 Radial Glow + High-Contrast Center Focus) */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        {/* Top & bottom soft blue-white gradient edges */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#eff5ff]/75 via-white/35 to-[#dbe8fe]/80" />

        {/* Central glowing soft-white & periwinkle-blue mist behind hero typography */}
        <div
          className={`ckh-aura ${
            motionPaused ? 'ckh-motion-paused' : ''
          } absolute inset-0 flex items-center justify-center`}
        >
          <div className="w-[92vw] max-w-[820px] h-[440px] sm:h-[490px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.96)_0%,rgba(235,243,255,0.88)_42%,rgba(191,214,254,0.45)_72%,rgba(219,234,254,0)_100%)] blur-xl" />
        </div>
      </div>

      {/* Centered Focal Hero Overlay (No Header / No Footer) */}
      <div className="relative z-10 h-full w-full flex flex-col items-center justify-between px-4 sm:px-8 py-6 sm:py-9 pointer-events-none">
        {/* Top subtle committee identity lockup */}
        <div className="pointer-events-auto inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/80 backdrop-blur-xl border border-white shadow-[0_8px_24px_-8px_rgba(30,58,138,0.16)]">
          <span className="w-6 h-6 rounded-full bg-[#0b132b] flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-sky-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" />
            </svg>
          </span>
          <span className="text-xs font-bold tracking-[0.1em] uppercase text-[#1e3a8a] whitespace-nowrap">
            FilKom Day Committee
          </span>
        </div>

        {/* Centerpiece Title + Primary Pill CTAs */}
        <div className="pointer-events-auto max-w-2xl mx-auto text-center px-5 sm:px-8 py-7 sm:py-9 rounded-[2rem] bg-white/65 backdrop-blur-2xl border border-white/90 shadow-[0_28px_70px_-18px_rgba(29,78,216,0.22)]">
          <h1 className="text-4xl sm:text-6xl lg:text-[4.25rem] font-extrabold tracking-tight leading-[1.06] text-[#0b132b] [text-wrap:balance]">
            FilCom
            <span className="block bg-gradient-to-r from-[#0b132b] via-[#1d4ed8] to-[#3b82f6] bg-clip-text text-transparent pb-0.5">
              Knowledge Hub
            </span>
          </h1>

          <p className="mt-4 text-xs sm:text-base text-slate-700 max-w-lg mx-auto leading-relaxed font-medium">
            Centralized committee guides, division SOPs, event archives, and shared documents in one living institutional workspace.
          </p>

          <div className="mt-6 sm:mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onEnterKMS('dashboard')}
              className="group inline-flex items-center gap-2.5 px-7 py-3 text-sm font-bold text-white bg-gradient-to-r from-[#0b132b] via-[#172b5c] to-[#1d4ed8] hover:from-[#15234d] hover:to-[#2563eb] rounded-full shadow-[0_14px_30px_-8px_rgba(29,78,216,0.42)] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Explore KMS</span>
              <ArrowRight className="w-4 h-4 text-sky-300 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {currentUser ? (
              <button
                type="button"
                onClick={() => onEnterKMS('dashboard')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[#0b132b] bg-white/90 hover:bg-white border border-slate-200/80 rounded-full shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <UserIcon className="w-4 h-4 text-[#2563eb]" />
                <span className="max-w-[160px] truncate">
                  {userProfile?.displayName || currentUser.email}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#0b132b] bg-white/90 hover:bg-white border border-slate-200/80 rounded-full shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogIn className="w-4 h-4 text-[#2563eb]" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Floating Controls: Motion Toggle + Quick KMS Access */}
        <div className="pointer-events-auto w-full max-w-6xl mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setMotionPaused((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/85 hover:bg-white backdrop-blur-xl border border-white text-xs font-semibold text-[#0b132b] shadow-[0_10px_28px_-8px_rgba(15,23,42,0.16)] transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            {motionPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>Resume motion</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>Pause motion</span>
              </>
            )}
          </button>

          <nav
            aria-label="Quick KMS Modules"
            className="inline-flex flex-wrap items-center justify-center gap-1 p-1.5 rounded-full bg-white/85 backdrop-blur-xl border border-white shadow-[0_12px_32px_-10px_rgba(30,58,138,0.18)]"
          >
            {QUICK_ROUTES.map(({ route, knowledgeFilter, label, icon: Icon }) => (
              <button
                key={`${route}-${label}`}
                type="button"
                onClick={() => onEnterKMS(route, knowledgeFilter)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#0b132b]/85 hover:text-[#0b132b] hover:bg-[#ebf1fd] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Icon className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
};
