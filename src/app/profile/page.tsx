'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AppNavigation from '@/components/AppNavigation';
import {
  Info,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  X,
} from 'lucide-react';

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  role: 'OWNER_ADMIN' | 'TEAM_MEMBER';
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

interface PopupModalState {
  type: 'error' | 'success';
  title: string;
  message: string;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Pop up information state
  const [popupModal, setPopupModal] = useState<PopupModalState | null>(null);

  // Original server state
  const [originalUser, setOriginalUser] = useState<UserProfileData | null>(null);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // Optional password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Close popup modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && popupModal) {
        setPopupModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [popupModal]);

  // 1. Fetch user data on mount
  useEffect(() => {
    fetch('/api/auth/profile')
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat data pengguna');
        return res.json();
      })
      .then((data) => {
        if (data.user) {
          const user: UserProfileData = data.user;
          setOriginalUser(user);

          // Split name into first and last name
          const nameParts = (user.name || '').trim().split(' ');
          const first = nameParts[0] || '';
          const last = nameParts.slice(1).join(' ') || '';
          setFirstName(first);
          setLastName(last);
          setEmail(user.email || '');
        }
      })
      .catch((err) => {
        setPopupModal({
          type: 'error',
          title: 'Gagal Memuat Profil',
          message: err.message || 'Terjadi kesalahan saat mengambil profil pengguna.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Check if form has unsaved modifications (is dirty)
  const isDirty = useMemo(() => {
    if (!originalUser) return false;

    const originalParts = (originalUser.name || '').trim().split(' ');
    const originalFirst = originalParts[0] || '';
    const originalLast = originalParts.slice(1).join(' ') || '';

    const nameChanged = firstName !== originalFirst || lastName !== originalLast;
    const emailChanged = email !== originalUser.email;
    const passwordEntered = currentPassword.length > 0 || newPassword.length > 0;

    return nameChanged || emailChanged || passwordEntered;
  }, [originalUser, firstName, lastName, email, currentPassword, newPassword]);

  // Handle Cancel / Reset
  const handleCancel = () => {
    if (!originalUser) return;
    const nameParts = (originalUser.name || '').trim().split(' ');
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    setEmail(originalUser.email || '');
    setCurrentPassword('');
    setNewPassword('');
    setShowPasswordChange(false);
  };

  // Handle Save
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!firstName.trim()) {
      setPopupModal({
        type: 'error',
        title: 'Validasi Data',
        message: 'Nama depan wajib diisi.',
      });
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setPopupModal({
        type: 'error',
        title: 'Validasi Data',
        message: 'Alamat email wajib diisi dengan format yang benar.',
      });
      return;
    }
    if (newPassword && !currentPassword) {
      setPopupModal({
        type: 'error',
        title: 'Validasi Kata Sandi',
        message: 'Silakan masukkan kata sandi saat ini untuk mengubah kata sandi.',
      });
      return;
    }

    setSaving(true);

    try {
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan perubahan profil.');
      }

      // Update original user state
      setOriginalUser(data.user);
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordChange(false);

      // Trigger modern success popup
      setPopupModal({
        type: 'success',
        title: 'Berhasil Disimpan',
        message: 'Data profil Anda telah berhasil diperbarui.',
      });
    } catch (err: any) {
      setPopupModal({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: err.message || 'Terjadi kesalahan sistem saat menyimpan profil.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] selection:bg-[#0f172a] selection:text-white">
      {/* Navigation Header & Dock */}
      <AppNavigation activeRoute="profile" />

      {/* Main Content Area */}
      <main className="md:pl-20 pt-8 pb-44 md:pb-32 px-4 sm:px-6 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-slate-700 mb-3" />
            <p className="text-xs font-semibold">Memuat data profil...</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Section */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
                Profile
              </h1>
              <p className="text-xs sm:text-sm text-[#64748b] mt-1">
                Manage your information, preferences, and connected data.
              </p>
            </div>

            {/* Profile Information Form */}
            <div className="space-y-4 pt-2">
              {/* First Name & Last Name (2-Column Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-xs font-semibold text-[#334155] mb-1.5">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-xs sm:text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-xs font-semibold text-[#334155] mb-1.5">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-xs sm:text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-[#334155] mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-xs sm:text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
                />
              </div>

              {/* Account Meta Badges */}
              {originalUser && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Peran: {originalUser.role === 'OWNER_ADMIN' ? 'Owner / Admin' : 'Team Member'}</span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Status Akun: {originalUser.isActive ? 'Aktif' : 'Nonaktif'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Password Security Section */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1.5 transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{showPasswordChange ? 'Tutup Pengaturan Kata Sandi' : 'Ubah Kata Sandi (Password)'}</span>
              </button>

              {showPasswordChange && (
                <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label htmlFor="currentPassword" className="block text-xs font-semibold text-[#334155] mb-1">
                      Kata Sandi Saat Ini
                    </label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan kata sandi lama"
                      className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-white text-xs text-[#0f172a] focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="newPassword" className="block text-xs font-semibold text-[#334155] mb-1">
                      Kata Sandi Baru (Min. 6 Karakter)
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Masukkan kata sandi baru"
                      className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-white text-xs text-[#0f172a] focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Action Bar */}
      <footer className="fixed bottom-20 md:bottom-6 left-0 right-0 z-40 px-4 pointer-events-none">
        <div className="max-w-2xl mx-auto md:ml-[calc(50%+2.5rem)] md:-translate-x-1/2 pointer-events-auto">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl sm:rounded-full p-2.5 sm:px-5 sm:py-3 shadow-xl shadow-slate-900/10 flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-md">
            {/* Info Message */}
            <div className="flex items-center gap-2 text-[#64748b] text-xs font-medium w-full sm:w-auto">
              <Info className="w-4 h-4 text-[#94a3b8] shrink-0" />
              <span>
                {isDirty
                  ? "Your changes haven't been saved"
                  : 'All changes are up to date'}
              </span>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={!isDirty || saving}
                onClick={handleCancel}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl sm:rounded-full border border-[#e2e8f0] bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-semibold text-[#0f172a] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isDirty || saving}
                onClick={handleSave}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl sm:rounded-full bg-[#4f46e5] hover:bg-[#4338ca] active:scale-[0.98] text-xs font-semibold text-white transition shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modern Information Pop Up Modal */}
      {popupModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all"
        >
          {/* Backdrop click to close */}
          <div
            className="absolute inset-0"
            onClick={() => setPopupModal(null)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-sm bg-white border border-[#e2e8f0] rounded-3xl p-6 sm:p-7 shadow-2xl shadow-slate-900/15 z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPopupModal(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon Header */}
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm border ${
                popupModal.type === 'error'
                  ? 'bg-rose-50 border-rose-100 text-rose-600'
                  : 'bg-emerald-50 border-emerald-100 text-emerald-600'
              }`}
            >
              {popupModal.type === 'error' ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>

            {/* Title & Message */}
            <h3 className="text-base font-bold text-[#0f172a]">
              {popupModal.title}
            </h3>
            <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
              {popupModal.message}
            </p>

            {/* Confirmation Button */}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setPopupModal(null)}
                className={`w-full py-2.5 px-4 rounded-full text-xs font-bold text-white transition active:scale-[0.98] shadow-sm ${
                  popupModal.type === 'error'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-[#4f46e5] hover:bg-[#4338ca] shadow-indigo-600/20'
                }`}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
