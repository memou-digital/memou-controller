'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderHeart,
  Calendar,
  Layers,
  Settings,
  Plus,
  Search,
  ChevronDown,
  Box,
  BarChart2,
  MessageSquare,
  Sparkles,
  SlidersHorizontal,
  RefreshCw,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  X,
  Loader2
} from 'lucide-react';

interface AppNavigationProps {
  activeRoute: 'catalog' | 'orders' | 'editor' | 'profile';
  onCreateOrderClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  tierFilter?: 'ALL' | 'BASIC' | 'PREMIUM' | 'DELUXE';
  onTierChange?: (tier: 'ALL' | 'BASIC' | 'PREMIUM' | 'DELUXE') => void;
  sourceMode?: 'github' | 'local';
  onSourceChange?: (mode: 'github' | 'local') => void;
  githubConnected?: boolean;
  githubUser?: any;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function AppNavigation({
  activeRoute,
  onCreateOrderClick,
  searchQuery,
  onSearchChange,
  tierFilter = 'ALL',
  onTierChange,
  sourceMode,
  onSourceChange,
  githubConnected,
  githubUser,
  onRefresh,
  isRefreshing = false,
}: AppNavigationProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'OWNER_ADMIN' | 'TEAM_MEMBER';
  } | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Escape key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLogoutModal && !isLoggingOut) {
        setShowLogoutModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutModal, isLoggingOut]);

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
      setIsLoggingOut(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* 1. LEFT FLOATING ICON DOCK (Fixed on desktop) */}
      <aside className="fixed left-0 top-0 bottom-0 w-20 bg-white border-r border-[#e2e8f0] z-40 hidden md:flex flex-col items-center justify-between py-6 shadow-sm">
        {/* Top: Logo Mark */}
        <div className="flex flex-col items-center space-y-8 w-full">
          <Link
            href="/"
            className="w-11 h-11 rounded-2xl bg-[#0f172a] text-white font-black flex items-center justify-center text-sm tracking-tighter hover:scale-105 transition shadow-md shadow-slate-900/10"
            title="MEMOu Studio"
          >
            MO
          </Link>

          {/* Navigation Icons Stack */}
          <nav className="flex flex-col items-center space-y-3 w-full px-3">
            {/* Heart / Catalog */}
            <Link
              href="/"
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition ${
                activeRoute === 'catalog'
                  ? 'bg-[#0f172a] text-white shadow-md shadow-slate-900/10'
                  : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
              }`}
              title="Katalog Template"
            >
              <FolderHeart className="h-5 w-5" />
            </Link>

            {/* Calendar / Orders */}
            <Link
              href="/orders"
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition ${
                activeRoute === 'orders'
                  ? 'bg-[#0f172a] text-white shadow-md shadow-slate-900/10'
                  : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
              }`}
              title="Daftar Pesanan (Orders)"
            >
              <Calendar className="h-5 w-5" />
            </Link>
          </nav>
        </div>

        {/* Bottom Dock: User initials & Logout */}
        <div className="flex flex-col items-center space-y-3 w-full px-3">
          {currentUser && (
            <Link
              href="/profile"
              className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center shadow-sm transition ${
                activeRoute === 'profile'
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-2 shadow-indigo-600/30'
                  : 'bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700'
              }`}
              title={`${currentUser.name} (Buka Profil)`}
            >
              {getInitials(currentUser.name)}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#64748b] hover:text-rose-600 hover:bg-rose-50 transition"
            title="Keluar (Logout)"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* 2. TOP HEADER NAVIGATION BAR */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] md:pl-20 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4 py-3.5">
          {/* Left: Capsule Navigation Switcher */}
          <div className="flex items-center space-x-2 overflow-x-auto py-1">
            {/* Mobile Logo Mark */}
            <Link
              href="/"
              className="md:hidden w-10 h-10 rounded-2xl bg-[#0f172a] text-white font-black flex items-center justify-center text-xs tracking-tighter shrink-0 mr-1 shadow-md shadow-slate-900/10"
            >
              MO
            </Link>

            {/* Cloud Status */}
            <div className="hidden sm:flex items-center space-x-2 px-3.5 py-2 rounded-full text-xs font-bold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
              <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
              <span>Cloud Active</span>
            </div>

            {/* Search Pill Trigger */}
            {onSearchChange && (
              <div className="relative hidden lg:flex items-center">
                <Search className="absolute left-3.5 h-3.5 w-3.5 text-[#94a3b8]" />
                <input
                  type="text"
                  placeholder="Cari..."
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#0f172a] focus:bg-white w-36 focus:w-56 transition-all"
                />
              </div>
            )}
          </div>

          {/* Right: Capsule Filter Pills, User Profile & Logout Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Source Mode Toggle (if provided) */}
            {onSourceChange && (
              <div className="hidden sm:flex items-center bg-[#f1f5f9] p-1 rounded-full border border-[#e2e8f0] text-xs">
                <button
                  type="button"
                  onClick={() => onSourceChange('github')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
                    sourceMode === 'github'
                      ? 'bg-white text-[#0f172a] font-extrabold shadow-sm'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                >
                  GitHub
                </button>
                <button
                  type="button"
                  onClick={() => onSourceChange('local')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
                    sourceMode === 'local'
                      ? 'bg-white text-[#0f172a] font-extrabold shadow-sm'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                >
                  Local
                </button>
              </div>
            )}

            {/* Tier Filter Dropdown (if provided) */}
            {onTierChange && (
              <div className="relative hidden md:block">
                <select
                  value={tierFilter}
                  onChange={(e) => onTierChange(e.target.value as any)}
                  className="appearance-none bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] text-xs font-bold pl-4 pr-8 py-2 rounded-full border border-[#e2e8f0] focus:outline-none focus:border-[#0f172a] cursor-pointer transition"
                >
                  <option value="ALL">Product: All</option>
                  <option value="BASIC">Product: Basic</option>
                  <option value="PREMIUM">Product: Premium</option>
                  <option value="DELUXE">Product: Deluxe</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748b] pointer-events-none" />
              </div>
            )}

            {/* Refresh Button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-2.5 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] border border-[#e2e8f0] transition flex items-center justify-center"
                title="Refresh Data"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#0f172a]' : ''}`} />
              </button>
            )}

            {/* Active Logged-in User Chip & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-[#e2e8f0]">
                <Link
                  href="/profile"
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#f8fafc] hover:bg-slate-100 border border-[#e2e8f0] hover:border-slate-300 rounded-full transition"
                  title="Buka Pengaturan Profil"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                    {getInitials(currentUser.name)}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[11px] font-bold text-[#0f172a] leading-none">{currentUser.name}</span>
                    <span className="text-[9px] font-semibold text-indigo-600 leading-none mt-0.5">
                      {currentUser.role === 'OWNER_ADMIN' ? 'Owner / Admin' : 'Team Member'}
                    </span>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-bold transition shadow-sm"
                  title="Keluar dari Akun"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 3. MOBILE BOTTOM NAVIGATION BAR (Fixed at bottom on smartphones) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e2e8f0] md:hidden px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* Tab 1: Katalog */}
          <Link
            href="/"
            className={`flex-1 min-h-[48px] py-1 flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition active:scale-95 ${
              activeRoute === 'catalog'
                ? 'text-[#0f172a]'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                activeRoute === 'catalog'
                  ? 'bg-[#0f172a] text-white shadow-sm'
                  : 'text-[#64748b]'
              }`}
            >
              <FolderHeart className="h-4 w-4" />
            </div>
            <span>Katalog</span>
          </Link>

          {/* Tab 2: Pesanan */}
          <Link
            href="/orders"
            className={`flex-1 min-h-[48px] py-1 flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition active:scale-95 ${
              activeRoute === 'orders'
                ? 'text-[#0f172a]'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                activeRoute === 'orders'
                  ? 'bg-[#0f172a] text-white shadow-sm'
                  : 'text-[#64748b]'
              }`}
            >
              <Calendar className="h-4 w-4" />
            </div>
            <span>Pesanan</span>
          </Link>

          {/* Tab 3: Profil */}
          <Link
            href="/profile"
            className={`flex-1 min-h-[48px] py-1 flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition active:scale-95 ${
              activeRoute === 'profile'
                ? 'text-indigo-600'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition ${
                activeRoute === 'profile'
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-2'
                  : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
              }`}
            >
              {currentUser ? getInitials(currentUser.name) : <UserIcon className="h-3 w-3" />}
            </div>
            <span>Profil</span>
          </Link>

          {/* Tab 4: Keluar */}
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="flex-1 min-h-[48px] py-1 flex flex-col items-center justify-center gap-1 text-[10px] font-bold text-[#64748b] hover:text-rose-600 active:scale-95 transition"
          >
            <div className="p-1 rounded-xl text-[#64748b] hover:text-rose-600 transition">
              <LogOut className="h-4 w-4" />
            </div>
            <span>Keluar</span>
          </button>
        </div>
      </nav>

      {/* 4. MODERN LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all"
        >
          {/* Backdrop Click */}
          <div
            className="absolute inset-0"
            onClick={() => !isLoggingOut && setShowLogoutModal(false)}
          />

          {/* Modal Card */}
          <div className="relative w-full max-w-sm bg-white border border-[#e2e8f0] rounded-3xl p-6 sm:p-7 shadow-2xl shadow-slate-900/15 z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => setShowLogoutModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon Header */}
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-sm">
              <LogOut className="w-5 h-5" />
            </div>

            {/* Title & Description */}
            <h3 className="text-base font-bold text-[#0f172a]">
              Keluar dari Sistem?
            </h3>
            <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
              Sesi kerja Anda saat ini akan diakhiri. Anda perlu masuk kembali untuk mengakses controller dan pesanan klien.
            </p>

            {/* User Profile Info Preview */}
            {currentUser && (
              <div className="flex items-center gap-3 p-3 my-4 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0]">
                <div className="w-9 h-9 rounded-full bg-[#0f172a] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                  {getInitials(currentUser.name)}
                </div>
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="text-xs font-bold text-[#0f172a] truncate">{currentUser.name}</span>
                  <span className="text-[10px] text-[#64748b] truncate">
                    {currentUser.email} &bull; {currentUser.role === 'OWNER_ADMIN' ? 'Owner / Admin' : 'Team Member'}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 px-4 rounded-full border border-[#e2e8f0] bg-white hover:bg-[#f8fafc] active:bg-[#f1f5f9] text-xs font-bold text-[#0f172a] transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={confirmLogout}
                className="flex-1 py-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-xs font-bold text-white shadow-md shadow-rose-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengeluarkan...</span>
                  </>
                ) : (
                  <span>Ya, Keluar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


