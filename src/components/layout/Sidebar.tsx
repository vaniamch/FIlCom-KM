import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  CalendarDays,
  Lightbulb,
  Bookmark,
  ShieldCheck,
  LogOut,
  UserCheck,
  ChevronRight,
  X,
  Headphones,
  Home,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { PageRoute } from '../../types';

interface SidebarProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  onOpenProfile,
  onOpenAuth,
}) => {
  const { currentUser, userProfile, isAdmin, logout } = useAuth();
  const { showToast } = useUI();

  const navItems = [
    { id: 'dashboard' as PageRoute, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'knowledge' as PageRoute, label: 'Knowledge Base', icon: BookOpen, hasArrow: true },
    { id: 'documents' as PageRoute, label: 'Documentation', icon: FileText },
    { id: 'events' as PageRoute, label: 'Announcements & Events', icon: CalendarDays },
    { id: 'lessons' as PageRoute, label: 'FAQ & Wisdom', icon: Lightbulb },
    { id: 'bookmarks' as PageRoute, label: 'Saved Bookmarks', icon: Bookmark },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden no-print"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container: Sleek Dark Navy with high rounded corners */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0c142b] text-slate-300 flex flex-col border-r border-slate-800/90 shadow-xl transition-transform duration-200 ease-in-out lg:translate-x-0 overflow-hidden no-print ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 1. Brand Header (text only - no star icon) */}
        <div className="h-20 px-5 flex items-center justify-between border-b border-slate-800/60">
          <div
            onClick={() => {
              onNavigate('landing');
              onCloseMobile();
            }}
            className="flex items-center cursor-pointer group min-w-0"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white tracking-tight text-sm block leading-tight truncate">
                  FilCom Knowledge Management
                </span>
              </div>
              <span className="text-[10px] text-sky-400 block tracking-normal mt-0.5 font-semibold truncate">
                FilKom Day Committee
              </span>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1 relative z-10">
          {/* Quick link back to Landing Page */}
          <button
            onClick={() => {
              onNavigate('landing');
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-all text-left mb-2 ${
              currentPage === 'landing'
                ? 'bg-blue-600/30 text-white font-bold border border-blue-400/30 shadow-xs'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Home className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Landing Page</span>
            </div>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
              Home
            </span>
          </button>

          <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Workspace
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl transition-all text-left ${
                  isActive
                    ? 'bg-blue-600/25 text-white font-bold border border-blue-400/30 shadow-[0_2px_10px_rgba(59,130,246,0.15)]'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.hasArrow && <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              </button>
            );
          })}

          {/* Admin Management Section (Visible strictly to Admins) */}
          {isAdmin && (
            <>
              <div className="pt-4 px-3 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Administration
              </div>
              <button
                onClick={() => {
                  onNavigate('admin');
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl transition-all text-left ${
                  currentPage === 'admin'
                    ? 'bg-blue-600/25 text-white font-bold border border-blue-400/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className={`w-4 h-4 shrink-0 ${currentPage === 'admin' ? 'text-sky-400' : 'text-amber-400'}`} />
                  <span>Admin Console</span>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                  Admin
                </span>
              </button>
            </>
          )}

          {/* 3. Need Help Card */}
          <div className="pt-4">
            <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-[11px] leading-tight">Need Help?</p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">FilKom Day Committee</p>
                </div>
              </div>
              <button
                onClick={() => {
                  onNavigate('lessons');
                  onCloseMobile();
                }}
                className="w-6 h-6 rounded-full bg-slate-700 hover:bg-indigo-600 text-white flex items-center justify-center shrink-0 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Subtle Decorative CSS Glow at bottom of sidebar */}
        <div className="absolute -bottom-6 -left-6 w-32 h-32 pointer-events-none opacity-20 bg-sky-500 rounded-full blur-2xl" />

        {/* 4. User Profile Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-[#090f22] relative z-10">
          {currentUser ? (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 transition-opacity"
              >
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName}
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-900 text-sky-300 border border-indigo-700/50 flex items-center justify-center font-bold text-xs shrink-0">
                    {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {userProfile?.displayName || 'Committee Lead'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5 capitalize">
                    {userProfile?.role || 'member'} · {userProfile?.department || 'Student Org'}
                  </p>
                </div>
              </button>

              <button
                onClick={async () => {
                  try {
                    await logout();
                    onNavigate('landing');
                    onCloseMobile();
                    showToast('Signed out successfully.', 'info');
                  } catch (err: any) {
                    showToast(`Sign out failed: ${err?.message || err}`, 'error');
                  }
                }}
                title="Sign out"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="w-full py-2 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <UserCheck className="w-4 h-4" />
              <span>Sign In / Join</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
