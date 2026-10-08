'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { generateOrderUrl } from '@/lib/orderUrlHelper';
import AppNavigation from '@/components/AppNavigation';
import PaginationBar from '@/components/PaginationBar';
import {
  Sparkles,
  Layers,
  FolderHeart,
  Palette,
  ExternalLink,
  Copy,
  Download,
  Search,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  FolderPlus,
  Globe,
  Radio,
  Settings,
  ShieldCheck,
  Zap,
  ArrowRight,
  Clock,
  CreditCard,
  Check,
  X,
  QrCode,
  Building2,
  Wallet
} from 'lucide-react';

const Github = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  topics: string[];
  packageTier: 'BASIC' | 'PREMIUM' | 'DELUXE';
  thumbnailUrl: string | null;
  updatedAt: string;
}

interface LocalTemplateItem {
  id: string;
  category: string;
  categoryLabel: string;
  name: string;
  displayName: string;
  title: string;
  thumbnail: string | null;
  hasConfig: boolean;
  imageCount: number;
  lastModified: string;
  isClientOrder?: boolean;
}

export default function DashboardPage() {
  const [sourceMode, setSourceMode] = useState<'github' | 'local'>('github');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'BASIC' | 'PREMIUM' | 'DELUXE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State (Default 12 cards per page)
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState(12);

  // GitHub State
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<any>(null);
  const [githubRepos, setGithubRepos] = useState<GitHubRepoItem[]>([]);
  const [githubLoading, setGithubLoading] = useState(true);

  // Local Templates State
  const [localTemplates, setLocalTemplates] = useState<LocalTemplateItem[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  // Pricing state loaded from TiDB pricing tables
  const [pricingMap, setPricingMap] = useState<Record<string, number>>({
    BASIC: 49000,
    PREMIUM: 99000,
    DELUXE: 179000,
  });

  // New Client Order Wizard Modal
  const [orderModal, setOrderModal] = useState<{
    open: boolean;
    template: any | null;
    clientName: string;
    clientWhatsapp: string;
    packageTier: 'BASIC' | 'PREMIUM' | 'DELUXE';
    urlType: 'basic' | 'request';
    paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
    paymentMethod: 'QRIS' | 'BANK_TRANSFER';
    eventName: string;
    recipientName: string;
    customUrlSlug: string;
    creating: boolean;
  }>({
    open: false,
    template: null,
    clientName: '',
    clientWhatsapp: '',
    packageTier: 'BASIC',
    urlType: 'basic',
    paymentStatus: 'UNPAID',
    paymentMethod: 'QRIS',
    eventName: 'birthday',
    recipientName: '',
    customUrlSlug: '',
    creating: false,
  });

  // Calculate live preview URL for order wizard modal
  const previewUrlInfo = useMemo(() => {
    return generateOrderUrl({
      urlType: orderModal.urlType,
      eventName: orderModal.eventName,
      recipientName: orderModal.recipientName,
      clientName: orderModal.clientName,
      customUrlSlug: orderModal.customUrlSlug,
    });
  }, [
    orderModal.urlType,
    orderModal.eventName,
    orderModal.recipientName,
    orderModal.clientName,
    orderModal.customUrlSlug,
  ]);

  // Check GitHub Auth & Load Repos
  const checkGithub = async () => {
    setGithubLoading(true);
    try {
      const authRes = await fetch('/api/github/auth');
      const authData = await authRes.json();
      setGithubConnected(authData.connected);
      if (authData.connected) {
        setGithubUser(authData.user);
        const repoRes = await fetch('/api/github/templates');
        const repoData = await repoRes.json();
        if (repoData.success) {
          setGithubRepos(repoData.repos);
        }
      }
    } catch (e) {
      console.error('Failed to load GitHub status:', e);
    } finally {
      setGithubLoading(false);
    }
  };

  // Load Local Templates
  const loadLocalTemplates = async () => {
    setLocalLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success) {
        setLocalTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to load local templates:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  useEffect(() => {
    checkGithub();
    loadLocalTemplates();
    fetch('/api/orders')
      .then((res) => res.json())
      .then((data) => {
        if (data.pricing) {
          setPricingMap((prev) => ({ ...prev, ...data.pricing }));
        }
      })
      .catch(() => {});
  }, []);

  // Filtered GitHub Repos
  const filteredGithubRepos = githubRepos.filter((r) => {
    const matchesTier = tierFilter === 'ALL' || r.packageTier === tierFilter;
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTier && matchesSearch;
  });

  // Filtered Local Templates
  const filteredLocalTemplates = localTemplates.filter((t) => {
    const matchesSearch =
      t.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Reset page when filter or source changes
  useEffect(() => {
    setCatalogPage(1);
  }, [tierFilter, searchQuery, sourceMode]);

  // Paginated Slices (12 per page by default)
  const activeCatalogTotal = sourceMode === 'github' ? filteredGithubRepos.length : filteredLocalTemplates.length;
  const catalogTotalPages = Math.max(1, Math.ceil(activeCatalogTotal / catalogPageSize));

  const paginatedGithubRepos = useMemo(() => {
    const start = (catalogPage - 1) * catalogPageSize;
    return filteredGithubRepos.slice(start, start + catalogPageSize);
  }, [filteredGithubRepos, catalogPage, catalogPageSize]);

  const paginatedLocalTemplates = useMemo(() => {
    const start = (catalogPage - 1) * catalogPageSize;
    return filteredLocalTemplates.slice(start, start + catalogPageSize);
  }, [filteredLocalTemplates, catalogPage, catalogPageSize]);

  // Handle Client Order Generation
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderModal.template || !orderModal.clientName.trim()) return;

    setOrderModal((prev) => ({ ...prev, creating: true }));
    try {
      const res = await fetch('/api/github/client-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateRepo: orderModal.template.name,
          clientName: orderModal.clientName.trim(),
          clientWhatsapp: orderModal.clientWhatsapp.trim(),
          packageTier: orderModal.packageTier,
          urlType: orderModal.urlType,
          paymentStatus: orderModal.paymentStatus,
          paymentMethod: orderModal.paymentMethod,
          eventName: orderModal.eventName.trim(),
          recipientName: orderModal.recipientName.trim(),
          customUrlSlug: orderModal.customUrlSlug.trim(),
          targetSubdomain: previewUrlInfo.subdomain,
          targetUrl: previewUrlInfo.fullUrl,
        }),
      });

      const data = await res.json();
      if (data.success && data.redirectUrl) {
        setOrderModal({
          open: false,
          template: null,
          clientName: '',
          clientWhatsapp: '',
          packageTier: 'BASIC',
          urlType: 'basic',
          paymentStatus: 'UNPAID',
          paymentMethod: 'QRIS',
          eventName: 'birthday',
          recipientName: '',
          customUrlSlug: '',
          creating: false,
        });
        window.location.href = data.redirectUrl;
      } else {
        alert(data.error || 'Gagal membuat pesanan klien');
        setOrderModal((prev) => ({ ...prev, creating: false }));
      }
    } catch {
      alert('Error saat memproses order');
      setOrderModal((prev) => ({ ...prev, creating: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] pb-24 md:pl-20">
      {/* Top Header & Left Navigation Rail */}
      <AppNavigation
        activeRoute="catalog"
        sourceMode={sourceMode}
        onSourceChange={setSourceMode}
        githubConnected={githubConnected}
        githubUser={githubUser}
        onRefresh={() => {
          checkGithub();
          loadLocalTemplates();
        }}
        isRefreshing={githubLoading || localLoading}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-28 md:pb-12 space-y-8">
        {/* Catalog Section Header */}
        <div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#0f172a] tracking-tight">
                {sourceMode === 'github' ? 'GitHub Cloud Templates' : 'Local Workspace Templates'}
              </h2>
              <p className="mt-1 text-xs text-[#64748b]">
                Pilih template master untuk dibuatkan order pesanan klien atau kustomisasi langsung di cloud studio.
              </p>
            </div>

            {/* Source Switcher Pills */}
            <div className="inline-flex bg-[#f1f5f9] p-1 rounded-full border border-[#e2e8f0] text-xs font-semibold self-start md:self-auto">
              <button
                onClick={() => setSourceMode('github')}
                className={`px-4 py-1.5 rounded-full transition flex items-center space-x-1.5 ${
                  sourceMode === 'github'
                    ? 'bg-white text-[#0f172a] font-extrabold shadow-sm'
                    : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                <Github className="h-3.5 w-3.5" />
                <span>GitHub ({githubRepos.length})</span>
              </button>
              <button
                onClick={() => setSourceMode('local')}
                className={`px-4 py-1.5 rounded-full transition flex items-center space-x-1.5 ${
                  sourceMode === 'local'
                    ? 'bg-white text-[#0f172a] font-extrabold shadow-sm'
                    : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Local ({localTemplates.length})</span>
              </button>
            </div>
          </div>

          {/* Package Tier Filters & Search Bar */}
          {sourceMode === 'github' && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
              <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                {(['ALL', 'BASIC', 'PREMIUM', 'DELUXE'] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setTierFilter(tier)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center space-x-1.5 ${
                      tierFilter === tier
                        ? 'bg-[#0f172a] text-white shadow-sm font-extrabold'
                        : 'bg-white text-[#64748b] hover:text-[#0f172a] border border-[#e2e8f0] hover:border-slate-300'
                    }`}
                  >
                    <span>
                      {tier === 'ALL'
                        ? 'Semua Tier'
                        : tier === 'BASIC'
                        ? 'Basic (3 Foto)'
                        : tier === 'PREMIUM'
                        ? 'Premium (8 Foto)'
                        : 'Deluxe (15 Foto)'}
                    </span>
                    <span className="text-[10px] opacity-75 font-mono">
                      ({tier === 'ALL' ? githubRepos.length : githubRepos.filter((r) => r.packageTier === tier).length})
                    </span>
                  </button>
                ))}
              </div>

              {/* Search Pill */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94a3b8]" />
                <input
                  type="text"
                  placeholder="Cari template..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-full bg-white border border-[#e2e8f0] text-[#0f172a] placeholder-[#94a3b8] text-xs focus:outline-none focus:border-[#0f172a] transition shadow-sm"
                />
              </div>
            </div>
          )}

          {/* GITHUB REPOS GRID */}
          {sourceMode === 'github' && (
            <div>
              {!githubConnected && !githubLoading && (
                <div className="p-8 rounded-[24px] bg-white border border-[#e2e8f0] text-center space-y-4 max-w-xl mx-auto my-12 shadow-sm">
                  <div className="h-12 w-12 rounded-2xl bg-[#f1f5f9] text-[#0f172a] flex items-center justify-center mx-auto border border-[#e2e8f0]">
                    <Github className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0f172a]">Hubungkan ke Akun GitHub Anda</h3>
                  <p className="text-xs text-[#64748b] leading-relaxed">
                    Masukkan <code>GITHUB_TOKEN</code> pada file <code>.env.local</code> di folder controller untuk memuat template langsung dari organisasi <code>@memou-templates</code>.
                  </p>
                  <div className="p-3 bg-[#f8fafc] rounded-2xl text-left font-mono text-[11px] text-slate-600 border border-[#e2e8f0]">
                    GITHUB_TOKEN=&quot;ghp_xxxxxxxxxxxx&quot;<br />
                    GITHUB_TEMPLATES_ORG=&quot;memou-templates&quot;<br />
                    GITHUB_CLIENTS_ORG=&quot;memou-clients&quot;
                  </div>
                </div>
              )}

              {githubConnected && filteredGithubRepos.length === 0 && !githubLoading && (
                <div className="text-center py-16 bg-white rounded-[24px] border border-[#e2e8f0] p-8 shadow-sm">
                  <Layers className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-[#0f172a]">Belum Ada Template di GitHub</h3>
                  <p className="text-xs text-[#64748b] max-w-md mx-auto mt-1">
                    Buat repositori baru di organisasi GitHub Anda dengan awalan <code>basic-</code>, <code>premium-</code>, atau <code>deluxe-</code>.
                  </p>
                </div>
              )}

              {githubConnected && filteredGithubRepos.length > 0 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedGithubRepos.map((repo) => (
                      <div
                        key={repo.id}
                        className="group rounded-[24px] bg-white border border-[#e2e8f0] hover:border-slate-400 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md p-4"
                      >
                        <div className="relative h-48 bg-[#f1f5f9] rounded-[18px] overflow-hidden flex items-center justify-center border border-[#e2e8f0]">
                          <img
                            src={repo.thumbnailUrl ? (repo.thumbnailUrl.includes('?') ? `${repo.thumbnailUrl}&v=live_preview` : `${repo.thumbnailUrl}?v=live_preview`) : `/api/github/thumbnail/${repo.fullName}?v=live_preview`}
                            alt={repo.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute top-3 left-3">
                            <span
                              className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider backdrop-blur-md shadow-sm ${
                                repo.packageTier === 'BASIC'
                                  ? 'bg-[#e0f2fe]/90 text-[#0369a1] border border-[#bae6fd]'
                                  : repo.packageTier === 'PREMIUM'
                                  ? 'bg-[#fef3c7]/90 text-[#b45309] border border-[#fde68a]'
                                  : 'bg-[#ecfdf5]/90 text-[#047857] border border-[#a7f3d0]'
                              }`}
                            >
                              {repo.packageTier}
                            </span>
                          </div>
                          <a
                            href={repo.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white text-[#64748b] hover:text-[#0f172a] transition border border-[#e2e8f0] shadow-sm"
                            title="Buka Repo di GitHub"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>

                        <div className="pt-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-base font-bold text-[#0f172a] group-hover:text-slate-700 transition truncate">
                              {repo.name}
                            </h3>
                            <p className="text-xs text-[#64748b] mt-1 line-clamp-2">
                              {repo.description || 'Interactive celebration website template'}
                            </p>
                          </div>

                          <div className="mt-5 pt-3 border-t border-[#e2e8f0] flex items-center gap-2">
                            {/* Open Cloud Visual Editor */}
                            <Link
                              href={`/editor/github/${repo.fullName}`}
                              className="flex-1 py-2 px-3 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] text-xs font-semibold text-center transition flex items-center justify-center space-x-1.5 border border-[#e2e8f0]"
                            >
                              <span>Buka Editor</span>
                            </Link>

                            {/* Create Order Wizard */}
                            <button
                              onClick={() => {
                                let detectedEvent = 'birthday';
                                const lower = repo.name.toLowerCase();
                                if (lower.includes('anniversary')) detectedEvent = 'anniversary';
                                else if (lower.includes('valentine')) detectedEvent = 'valentine';
                                else if (lower.includes('graduation')) detectedEvent = 'graduation';
                                else if (lower.includes('sweet-17') || lower.includes('sweet17')) detectedEvent = 'sweet-17';

                                setOrderModal({
                                  open: true,
                                  template: repo,
                                  clientName: '',
                                  clientWhatsapp: '',
                                  packageTier: repo.packageTier,
                                  urlType: 'basic',
                                  paymentStatus: 'UNPAID',
                                  paymentMethod: 'QRIS',
                                  eventName: detectedEvent,
                                  recipientName: '',
                                  customUrlSlug: '',
                                  creating: false,
                                });
                              }}
                              className="py-2 px-4 rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-extrabold transition flex items-center space-x-1.5 shadow-sm"
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
                              <span>Buat Order</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <PaginationBar
                    currentPage={catalogPage}
                    totalPages={catalogTotalPages}
                    pageSize={catalogPageSize}
                    totalItems={activeCatalogTotal}
                    pageSizeOptions={[12, 24, 36]}
                    onPageChange={setCatalogPage}
                    onPageSizeChange={setCatalogPageSize}
                    className="mt-8"
                  />
                </>
              )}
            </div>
          )}

          {/* LOCAL TEMPLATES GRID (Fallback) */}
          {sourceMode === 'local' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedLocalTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="group rounded-[24px] bg-white border border-[#e2e8f0] hover:border-slate-400 transition flex flex-col justify-between overflow-hidden shadow-sm p-4"
                  >
                    <div className="relative h-48 bg-[#f1f5f9] rounded-[18px] overflow-hidden flex items-center justify-center border border-[#e2e8f0]">
                      {t.thumbnail ? (
                        <img
                          src={t.thumbnail}
                          alt={t.displayName}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                      ) : (
                        <Palette className="h-10 w-10 text-slate-400" />
                      )}
                      <span className="absolute top-3 left-3 text-[10px] px-3 py-1 rounded-full font-bold bg-white text-[#0f172a] border border-[#e2e8f0] shadow-sm">
                        {t.categoryLabel}
                      </span>
                    </div>

                    <div className="pt-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#0f172a] group-hover:text-slate-700 transition truncate">
                          {t.displayName}
                        </h3>
                        <p className="text-xs text-[#64748b] font-mono mt-1">
                          {t.category}/{t.name}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#e2e8f0]">
                        <Link
                          href={`/editor/${t.category}/${t.name}`}
                          className="w-full py-2.5 px-3 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] text-xs font-semibold text-center transition flex items-center justify-center space-x-1.5 border border-[#e2e8f0]"
                        >
                          <Palette className="h-3.5 w-3.5 text-[#0f172a]" />
                          <span>Edit Template Lokal</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <PaginationBar
                currentPage={catalogPage}
                totalPages={catalogTotalPages}
                pageSize={catalogPageSize}
                totalItems={activeCatalogTotal}
                pageSizeOptions={[12, 24, 36]}
                onPageChange={setCatalogPage}
                onPageSizeChange={setCatalogPageSize}
                className="mt-8"
              />
            </>
          )}
        </div>
      </main>

      {/* NEW CLIENT ORDER WIZARD MODAL */}
      {orderModal.open && orderModal.template && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-[#e2e8f0] rounded-[28px] max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Fixed Modal Header */}
            <div className="p-5 sm:p-6 pb-4 shrink-0 border-b border-[#f1f5f9] space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#f1f5f9] text-[#0f172a] flex items-center justify-center border border-[#e2e8f0] shadow-sm">
                    <FolderPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#0f172a]">Buat Pesanan Klien Baru</h3>
                    <p className="text-xs text-[#64748b]">Kloning template master ke @memou-clients</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOrderModal({
                      open: false,
                      template: null,
                      clientName: '',
                      clientWhatsapp: '',
                      packageTier: 'BASIC',
                      urlType: 'basic',
                      paymentStatus: 'UNPAID',
                      paymentMethod: 'QRIS',
                      eventName: 'birthday',
                      recipientName: '',
                      customUrlSlug: '',
                      creating: false,
                    })
                  }
                  className="h-8 w-8 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] flex items-center justify-center transition border border-[#e2e8f0]"
                  title="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-3 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] flex items-center justify-between text-xs">
                <div className="truncate pr-2">
                  <span className="text-[#64748b] block text-[10px] uppercase font-bold tracking-wider">Template Sumber:</span>
                  <span className="font-bold text-[#0f172a] truncate block">{orderModal.template.name}</span>
                </div>
                <span className="text-[10px] px-3 py-1 rounded-full font-bold bg-[#f1f5f9] text-[#0f172a] border border-[#e2e8f0] shrink-0">
                  Paket {orderModal.packageTier}
                </span>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateOrder} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 py-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Pemesan / Klien <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kevin Sanjaya"
                    value={orderModal.clientName}
                    onChange={(e) =>
                      setOrderModal((prev) => ({ ...prev, clientName: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp Klien <span className="text-[#94a3b8] font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 081234567890"
                    value={orderModal.clientWhatsapp}
                    onChange={(e) =>
                      setOrderModal((prev) => ({ ...prev, clientWhatsapp: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] focus:bg-white transition"
                  />
                </div>
              </div>

              {/* PILIHAN FORMAT URL WEBSITE */}
              <div className="p-4 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0f172a] flex items-center space-x-1.5">
                    <Globe className="h-4 w-4 text-[#0f172a]" />
                    <span>Pilihan Format URL Website</span>
                  </label>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-semibold bg-white text-[#64748b] border border-[#e2e8f0]">
                    .vercel.app
                  </span>
                </div>

                {/* URL Type Switcher */}
                <div className="grid grid-cols-2 gap-2 bg-white p-1 rounded-full border border-[#e2e8f0]">
                  <button
                    type="button"
                    onClick={() => setOrderModal((prev) => ({ ...prev, urlType: 'basic' }))}
                    className={`py-1.5 px-3 rounded-full text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      orderModal.urlType === 'basic'
                        ? 'bg-[#0f172a] text-white shadow-sm font-extrabold'
                        : 'text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    <span>Basic URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderModal((prev) => ({ ...prev, urlType: 'request' }))}
                    className={`py-1.5 px-3 rounded-full text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      orderModal.urlType === 'request'
                        ? 'bg-[#0f172a] text-white shadow-sm font-extrabold'
                        : 'text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    <span>Request URL</span>
                  </button>
                </div>

                {/* Basic URL Form Inputs */}
                {orderModal.urlType === 'basic' ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-slate-700">
                          Nama Event <span className="text-[#64748b] font-normal">(Input manual)</span>
                        </label>
                        <span className="text-[10px] text-[#94a3b8]">Contoh: birthday, sweet-17</span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. birthday, anniversary, sweet-17, valentine"
                        value={orderModal.eventName}
                        onChange={(e) =>
                          setOrderModal((prev) => ({ ...prev, eventName: e.target.value }))
                        }
                        className="w-full px-3.5 py-2 rounded-2xl bg-white border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] font-sans"
                      />

                      {/* Quick preset suggestions */}
                      <div className="flex items-center flex-wrap gap-1.5 mt-2">
                        <span className="text-[10px] text-[#64748b]">Preset:</span>
                        {['birthday', 'anniversary', 'sweet-17', 'valentine', 'graduation'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              setOrderModal((prev) => ({ ...prev, eventName: preset }))
                            }
                            className={`text-[10px] px-2.5 py-0.5 rounded-full border transition ${
                              orderModal.eventName.toLowerCase() === preset
                                ? 'bg-[#0f172a] text-white border-[#0f172a] font-bold'
                                : 'bg-white text-[#64748b] border-[#e2e8f0] hover:text-[#0f172a]'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Nama Penerima <span className="text-[#94a3b8] font-normal">(Untuk perayaan & URL)</span>
                      </label>
                      <input
                        type="text"
                        placeholder={orderModal.clientName || 'e.g. Sarah, Kevin, Angel'}
                        value={orderModal.recipientName}
                        onChange={(e) =>
                          setOrderModal((prev) => ({ ...prev, recipientName: e.target.value }))
                        }
                        className="w-full px-3.5 py-2 rounded-2xl bg-white border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] font-sans"
                      />
                    </div>
                  </div>
                ) : (
                  /* Request URL Form Inputs */
                  <div className="space-y-2 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-slate-700">
                          Request Judul URL <span className="text-[#64748b] font-normal">(Input request klien)</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. our-first-story, kevin-sarah-turns-20"
                        value={orderModal.customUrlSlug}
                        onChange={(e) =>
                          setOrderModal((prev) => ({ ...prev, customUrlSlug: e.target.value }))
                        }
                        className="w-full px-3.5 py-2 rounded-2xl bg-white border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] font-sans"
                      />
                      <p className="text-[10px] text-[#64748b] mt-1">
                        Otomatis berakhiran <code className="text-[#0f172a] font-mono font-bold">-memou.vercel.app</code>
                      </p>
                    </div>
                  </div>
                )}

                {/* Real-Time Live Preview URL Card */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#e2e8f0] flex flex-col space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#64748b] font-medium flex items-center space-x-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                      <span>Live Target URL Preview:</span>
                    </span>
                    <span className="text-[#0f172a] font-bold uppercase tracking-wider">
                      {orderModal.urlType === 'basic' ? 'Basic URL' : 'Request URL'}
                    </span>
                  </div>
                  <div className="font-mono text-xs font-bold text-[#0f172a] truncate py-0.5">
                    {previewUrlInfo.fullUrl}
                  </div>
                  <div className="text-[10px] text-[#64748b] flex items-center justify-between">
                    <span>
                      {orderModal.urlType === 'basic'
                        ? 'Format: nama event-nama penerima-memou.vercel.app'
                        : 'Format: (request judul url)-memou.vercel.app'}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(previewUrlInfo.fullUrl)}
                      className="text-[#64748b] hover:text-[#0f172a] flex items-center space-x-1 text-[10px] transition"
                    >
                      <Copy className="h-3 w-3" />
                      <span>Salin</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* STATUS PEMBAYARAN FORM & FINANCIAL BREAKDOWN */}
              <div className="p-4 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0f172a] flex items-center space-x-1.5">
                    <CreditCard className="h-4 w-4 text-[#0f172a]" />
                    <span>Status Pembayaran (Payment Status)</span>
                  </label>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      orderModal.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : orderModal.paymentStatus === 'PARTIAL'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {orderModal.paymentStatus}
                  </span>
                </div>

                {/* 3 Payment Status Buttons */}
                <div className="grid grid-cols-3 gap-2 bg-white p-1 rounded-2xl border border-[#e2e8f0]">
                  <button
                    type="button"
                    onClick={() => setOrderModal((prev) => ({ ...prev, paymentStatus: 'UNPAID' }))}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center space-y-0.5 ${
                      orderModal.paymentStatus === 'UNPAID'
                        ? 'bg-[#0f172a] text-white shadow-sm'
                        : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <span>UNPAID</span>
                    <span className="text-[10px] font-normal opacity-80">Belum Bayar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderModal((prev) => ({ ...prev, paymentStatus: 'PARTIAL' }))}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center space-y-0.5 ${
                      orderModal.paymentStatus === 'PARTIAL'
                        ? 'bg-[#0f172a] text-white shadow-sm'
                        : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <span>PARTIAL</span>
                    <span className="text-[10px] font-normal opacity-80">DP (Termin)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderModal((prev) => ({ ...prev, paymentStatus: 'PAID' }))}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center space-y-0.5 ${
                      orderModal.paymentStatus === 'PAID'
                        ? 'bg-[#0f172a] text-white shadow-sm'
                        : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <span>PAID</span>
                    <span className="text-[10px] font-normal opacity-80">Lunas</span>
                  </button>
                </div>

                {/* PILIHAN METODE PEMBAYARAN */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Wallet className="h-3.5 w-3.5 text-[#0f172a]" />
                    <span>Metode Pembayaran (Payment Method)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-white p-1 rounded-2xl border border-[#e2e8f0]">
                    <button
                      type="button"
                      onClick={() => setOrderModal((prev) => ({ ...prev, paymentMethod: 'QRIS' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                        orderModal.paymentMethod === 'QRIS'
                          ? 'bg-[#0f172a] text-white shadow-sm font-extrabold'
                          : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                      }`}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>QRIS (Instant)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderModal((prev) => ({ ...prev, paymentMethod: 'BANK_TRANSFER' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                        orderModal.paymentMethod === 'BANK_TRANSFER'
                          ? 'bg-[#0f172a] text-white shadow-sm font-extrabold'
                          : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]'
                      }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      <span>Bank Transfer</span>
                    </button>
                  </div>
                </div>

                {/* Price Breakdown Snapshot Preview */}
                <div className="p-3 bg-white rounded-xl border border-[#e2e8f0] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[#64748b]">
                    <span>Harga Paket ({orderModal.packageTier}):</span>
                    <span className="font-semibold font-mono text-[#0f172a]">
                      Rp {(pricingMap[orderModal.packageTier] || 49000).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#64748b]">
                    <span>Add-on URL:</span>
                    <span className="font-semibold font-mono text-[#0f172a]">
                      {orderModal.urlType === 'request'
                        ? '+ Rp 5.000 (Request URL)'
                        : 'Gratis (Basic URL)'}
                    </span>
                  </div>
                  <div className="pt-2 mt-1 border-t border-[#e2e8f0] flex items-center justify-between font-bold">
                    <span className="text-[#0f172a]">Total Tagihan (totalAmount):</span>
                    <span className="text-sm font-mono text-[#0f172a]">
                      Rp {((pricingMap[orderModal.packageTier] || 49000) + (orderModal.urlType === 'request' ? 5000 : 0)).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-[#64748b] leading-relaxed">
                  {orderModal.paymentStatus === 'PAID' ? (
                    <span className="text-emerald-700 font-medium">
                      ✓ Status <strong>PAID</strong> memungkinkan website langsung di-Publish & Go Live di studio.
                    </span>
                  ) : (
                    <span className="text-amber-700 font-medium">
                      ℹ Status <strong>{orderModal.paymentStatus}</strong> mengizinkan simpan ke GitHub via Commit. Tombol Go Live akan terkunci hingga lunas.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Fixed Modal Footer */}
            <div className="p-4 sm:p-5 shrink-0 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() =>
                  setOrderModal({
                    open: false,
                    template: null,
                    clientName: '',
                    clientWhatsapp: '',
                    packageTier: 'BASIC',
                    urlType: 'basic',
                    paymentStatus: 'UNPAID',
                    paymentMethod: 'QRIS',
                    eventName: 'birthday',
                    recipientName: '',
                    customUrlSlug: '',
                    creating: false,
                  })
                }
                className="px-4 py-2 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] text-xs font-medium transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  orderModal.creating ||
                  !orderModal.clientName.trim() ||
                  (orderModal.urlType === 'basic' && !orderModal.eventName.trim()) ||
                  (orderModal.urlType === 'request' && !orderModal.customUrlSlug.trim())
                }
                className="px-5 py-2.5 rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-extrabold transition flex items-center space-x-1.5 shadow-md disabled:opacity-50"
              >
                {orderModal.creating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Memproses & Menyiapkan URL...</span>
                  </>
                ) : (
                  <>
                    <span>Buat Pesanan & Buka Studio</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
