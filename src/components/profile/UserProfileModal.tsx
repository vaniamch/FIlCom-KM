import React, { useState, useEffect } from 'react';
import { X, User, ShieldCheck, Mail, Building2, CheckCircle2, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, updateProfile, logout } = useAuth();
  const { showToast } = useUI();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [department, setDepartment] = useState(userProfile?.department || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !userProfile) return;
    setDisplayName(userProfile.displayName || '');
    setDepartment(userProfile.department || '');
    setSavedSuccess(false);
  }, [isOpen, userProfile]);

  if (!isOpen || !userProfile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        department: department.trim(),
      });
      setSavedSuccess(true);
      showToast('Profile details updated.', 'success');
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e: any) {
      showToast(e?.message || 'Failed to update profile settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Member Profile & Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Profile details updated successfully.</span>
            </div>
          )}

          {/* Avatar and Role */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            {userProfile.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.displayName}
                className="w-12 h-12 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-900 text-indigo-100 flex items-center justify-center font-bold text-base">
                {userProfile.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <p className="font-bold text-slate-900 text-sm">{userProfile.displayName}</p>
              <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                <span className="font-semibold text-indigo-900 capitalize">{userProfile.role} Access</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">UID: {userProfile.id.substring(0, 8)}...</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Email Address (Verified)
            </label>
            <input
              type="email"
              disabled
              value={userProfile.email}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono text-xs cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Assigned Committee / Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Executive Board, Tech Committee, Logistics"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-lg focus:outline-none text-slate-900"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                logout();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg font-semibold text-xs shadow-2xs transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
