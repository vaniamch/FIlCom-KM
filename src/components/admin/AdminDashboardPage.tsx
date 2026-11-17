import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  Folder,
  Plus,
  Trash2,
  Check,
  X,
  Lock,
  BookOpen,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { UserProfile, UserRole, UserStatus, KnowledgeArticle, Category, ActivityLog } from '../../types';
import {
  getAllUsers,
  setUserRole,
  setUserStatus,
  updateArticle,
  createCategory,
  deleteCategory,
  logActivity,
} from '../../services/firestoreService';

interface AdminDashboardPageProps {
  articles: KnowledgeArticle[];
  categories: Category[];
  activityLogs: ActivityLog[];
  onRefreshData: () => Promise<void>;
  onSelectArticle: (id: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  articles,
  categories,
  activityLogs,
  onRefreshData,
  onSelectArticle,
}) => {
  const { isAdmin, currentUser, userProfile } = useAuth();
  const { showToast, confirmAction } = useUI();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [, setLoadingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'approvals' | 'categories' | 'audit'>('users');

  // Category creation modal/form
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Status messages
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const list = await getAllUsers();
      setUsers(list);
    } catch (e) {
      console.warn('Failed to load users list:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await setUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      logActivity({
        userId: currentUser?.uid || userProfile?.id || 'admin',
        userName: userProfile?.displayName || 'Executive Admin',
        userEmail: currentUser?.email || '',
        action: 'Updated User Role',
        entityType: 'user',
        entityId: userId,
        details: `Assigned role "${newRole}" to member`,
      }).catch(() => {});
      setActionSuccess(`User role updated to ${newRole}.`);
      showToast(`User role updated to ${newRole}.`, 'success');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      showToast(`Failed to update role: ${err?.message || 'Access denied'}`, 'error');
    }
  };

  const handleStatusChange = async (targetUser: UserProfile, nextStatus: UserStatus) => {
    if (nextStatus === 'inactive') {
      const confirmed = await confirmAction({
        title: 'Deactivate Account',
        message: `Deactivate access for "${targetUser.displayName}" (${targetUser.email})? They will be signed out of internal workspace pages until reactivated.`,
        confirmLabel: 'Deactivate',
        danger: true,
      });
      if (!confirmed) return;
    }

    try {
      await setUserStatus(targetUser.id, nextStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, status: nextStatus } : u))
      );
      logActivity({
        userId: currentUser?.uid || userProfile?.id || 'admin',
        userName: userProfile?.displayName || 'Executive Admin',
        userEmail: currentUser?.email || '',
        action: nextStatus === 'active' ? 'Activated User' : 'Deactivated User',
        entityType: 'user',
        entityId: targetUser.id,
        details: `${nextStatus === 'active' ? 'Activated' : 'Deactivated'} ${targetUser.email}`,
      }).catch(() => {});
      setActionSuccess(`User status updated to ${nextStatus}.`);
      showToast(`User account ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`, 'success');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      showToast(`Failed to update status: ${err?.message || 'Access denied'}`, 'error');
    }
  };

  const handleApproveArticle = async (art: KnowledgeArticle) => {
    const adminName = userProfile?.displayName || currentUser?.displayName || 'Executive Board';
    try {
      const payload: Partial<KnowledgeArticle> = art.isSOP
        ? {
            status: 'published',
            reviewer: art.reviewer || adminName,
            approver: art.approver || adminName,
            approvedBy: adminName,
            approvedAt: new Date().toISOString(),
          }
        : { status: 'published' };

      await updateArticle(art.id, payload, {
        editorName: adminName,
        changeNote: `Approved and published via Admin Console`,
      });
      await logActivity({
        userId: currentUser?.uid || userProfile?.id || 'admin',
        userName: adminName,
        userEmail: currentUser?.email || '',
        action: art.isSOP ? 'Approved & Published SOP' : 'Published Knowledge',
        entityType: 'knowledge',
        entityId: art.id,
        details: `Approved and published "${art.title}"`,
      });
      await onRefreshData();
      setActionSuccess(`"${art.title}" approved and published to Knowledge Hub.`);
      showToast('Approved and published.', 'success');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (e: any) {
      showToast(`Approval error: ${e?.message || e}`, 'error');
    }
  };

  const handleRejectArticle = async (art: KnowledgeArticle) => {
    const adminName = userProfile?.displayName || currentUser?.displayName || 'Executive Board';
    const confirmed = await confirmAction({
      title: 'Return to Rejected / Revision',
      message: `Reject "${art.title}" and return it for revisions?`,
      confirmLabel: 'Reject Entry',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await updateArticle(
        art.id,
        {
          status: 'rejected',
          rejectedReason: 'Returned for revision by Admin Console reviewer.',
        },
        {
          editorName: adminName,
          changeNote: 'Returned for revision via Admin Console',
        }
      );
      await logActivity({
        userId: currentUser?.uid || userProfile?.id || 'admin',
        userName: adminName,
        userEmail: currentUser?.email || '',
        action: 'Rejected Submission',
        entityType: 'knowledge',
        entityId: art.id,
        details: `Returned "${art.title}" for revision`,
      });
      await onRefreshData();
      showToast(`"${art.title}" marked as rejected for revision.`, 'info');
    } catch (e: any) {
      showToast(`Reject failed: ${e?.message || e}`, 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCatName.trim();
    if (!trimmedName) {
      showToast('Division name cannot be empty.', 'error');
      return;
    }

    const duplicate = categories.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      showToast(`Division "${trimmedName}" already exists.`, 'error');
      return;
    }

    setSavingCategory(true);
    try {
      const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await createCategory({
        name: trimmedName,
        description: newCatDescription.trim(),
        slug,
        icon: 'Folder',
      });
      await logActivity({
        userId: currentUser?.uid || userProfile?.id || 'admin',
        userName: userProfile?.displayName || 'Admin',
        userEmail: currentUser?.email || '',
        action: 'Created Division',
        entityType: 'category',
        details: `Added division "${trimmedName}"`,
      });
      setNewCatName('');
      setNewCatDescription('');
      setShowAddCategory(false);
      await onRefreshData();
      setActionSuccess('New division created successfully.');
      showToast('New division created successfully.', 'success');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      showToast(`Error creating division: ${err?.message || err}`, 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    const confirmed = await confirmAction({
      title: 'Delete Division',
      message: `Delete division "${catName}"? Existing articles will remain in the repository.`,
      confirmLabel: 'Delete Division',
      danger: true,
    });
    if (confirmed) {
      try {
        await deleteCategory(catId);
        await onRefreshData();
        setActionSuccess('Division removed.');
        showToast('Division removed.', 'success');
        setTimeout(() => setActionSuccess(null), 3000);
      } catch (err: any) {
        showToast(`Failed to delete division: ${err?.message || err}`, 'error');
      }
    }
  };

  const draftArticles = articles.filter((a) =>
    ['draft', 'pending_review', 'in_review', 'approved'].includes(a.status)
  );

  const activeAdminCount = users.filter(
    (u) => u.role === 'admin' && (u.status || 'active') === 'active'
  ).length;

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-lg mx-auto my-12 shadow-2xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Admin Privileges Required</h2>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          The Administration Console is restricted to designated Student Executive Board administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Admin Console
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200/60">
              Executive Level
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Manage user roles, taxonomies, draft review queues, and system audit trails.
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 ${
            activeTab === 'users'
              ? 'bg-[#0b132b] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white/70 hover:bg-white border border-white/80'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Roles & Directory ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 ${
            activeTab === 'approvals'
              ? 'bg-[#0b132b] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white/70 hover:bg-white border border-white/80'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Pending Approvals ({draftArticles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 ${
            activeTab === 'categories'
              ? 'bg-[#0b132b] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white/70 hover:bg-white border border-white/80'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>Division Taxonomies ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 ${
            activeTab === 'audit'
              ? 'bg-[#0b132b] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 bg-white/70 hover:bg-white border border-white/80'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Audit Logs ({activityLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: User Roles Management */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Authorized Organization Members & RBAC
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Assign roles: Admin (Full control), Editor (Document & Edit), Member (Read & Bookmark)
              </p>
            </div>
            <button
              onClick={loadUsers}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
            >
              Refresh List
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/60 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Committee / Dept</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Assign Role & Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No members registered in database yet.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const userStatus: UserStatus = u.status || 'active';
                    const isSelf = currentUser?.uid === u.id;
                    const isLastActiveAdmin =
                      u.role === 'admin' && userStatus === 'active' && activeAdminCount <= 1;
                    const disableDemoteOrDeactivate = isSelf || isLastActiveAdmin;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {u.displayName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <span className="truncate">{u.displayName}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                          {u.email}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          {u.department || 'General Member'}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`font-semibold text-[11px] capitalize ${
                              u.role === 'admin'
                                ? 'text-indigo-900 font-bold'
                                : u.role === 'editor'
                                ? 'text-blue-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`font-semibold text-[11px] capitalize ${
                              userStatus === 'active' ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {userStatus}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <select
                              value={u.role}
                              disabled={disableDemoteOrDeactivate}
                              title={
                                isSelf
                                  ? 'You cannot change your own role'
                                  : isLastActiveAdmin
                                  ? 'Cannot demote the last active Admin'
                                  : 'Assign user role'
                              }
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-none font-medium text-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="admin">Admin</option>
                              <option value="editor">Editor</option>
                              <option value="member">Member</option>
                            </select>

                            <button
                              type="button"
                              disabled={disableDemoteOrDeactivate && userStatus === 'active'}
                              title={
                                isSelf
                                  ? 'You cannot deactivate your own account'
                                  : isLastActiveAdmin
                                  ? 'Cannot deactivate the last active Admin'
                                  : userStatus === 'active'
                                  ? 'Deactivate user'
                                  : 'Activate user'
                              }
                              onClick={() =>
                                handleStatusChange(
                                  u,
                                  userStatus === 'active' ? 'inactive' : 'active'
                                )
                              }
                              className={`py-1 px-2.5 rounded text-[11px] font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                userStatus === 'active'
                                  ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                              }`}
                            >
                              {userStatus === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Draft Approvals Queue */}
      {activeTab === 'approvals' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Pending Draft Review & Publication Queue
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review articles and SOPs drafted by committee members before public listing.
            </p>
          </div>

          {draftArticles.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-900">Review queue is clear!</p>
              <p className="text-[11px] text-slate-400 mt-1">All submitted articles are published.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {draftArticles.map((art) => (
                <div key={art.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3
                      onClick={() => onSelectArticle(art.id)}
                      className="text-xs sm:text-sm font-bold text-slate-900 hover:text-indigo-700 transition-colors cursor-pointer truncate"
                    >
                      {art.sopNumber ? `${art.sopNumber} · ` : ''}
                      {art.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                      <span className="font-semibold text-amber-700 uppercase">
                        {art.status.replace('_', ' ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{art.categoryName}</span>
                      <span aria-hidden="true">·</span>
                      <span>By {art.authorName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(art.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onSelectArticle(art.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleRejectArticle(art)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleApproveArticle(art)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve & Publish</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Category Taxonomies */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Divisions & Taxonomies</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Define committee divisions to organize guides, SOPs, and files.
              </p>
            </div>

            <button
              onClick={() => setShowAddCategory(!showAddCategory)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-900 hover:bg-indigo-800 rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Division</span>
            </button>
          </div>

          {/* Add Category Form */}
          {showAddCategory && (
            <form
              onSubmit={handleCreateCategory}
              className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs"
            >
              <h3 className="font-bold text-slate-900">New Committee Division</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Division Name (e.g. Alumni Relations)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600 text-slate-900 font-semibold"
                />
                <input
                  type="text"
                  placeholder="Description..."
                  value={newCatDescription}
                  onChange={(e) => setNewCatDescription(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600 text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-4 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg font-semibold"
                >
                  {savingCategory ? 'Creating...' : 'Save Division'}
                </button>
              </div>
            </form>
          )}

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const count = articles.filter((a) => a.categoryId === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span className="font-mono text-[11px] text-slate-400">/{cat.slug}</span>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Delete division"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{cat.name}</h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {cat.description || 'General organizational category.'}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 tabular-nums">
                    {count} articles registered
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Activity Audit Trail</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Append-only security log recording creation, edits, and publication actions.
            </p>
          </div>

          <div className="space-y-2">
            {activityLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No activity logs recorded yet.
              </div>
            ) : (
              activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="min-w-0">
                    <p className="text-slate-900 font-semibold truncate">
                      {log.userName} ({log.userEmail})
                    </p>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      <span className="font-mono uppercase font-bold text-indigo-900">{log.action}</span> · {log.details}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
