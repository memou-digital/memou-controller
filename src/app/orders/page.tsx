'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import AppNavigation from '@/components/AppNavigation';
import PaginationBar from '@/components/PaginationBar';
import {
  Sparkles,
  Layers,
  FolderHeart,
  ExternalLink,
  Search,
  RefreshCw,
  CheckCircle2,
  Globe,
  Radio,
  Trash2,
  Edit3,
  Clock,
  MessageCircle,
  Copy,
  Check,
  Plus,
  Phone,
  User,
  Calendar,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Image as ImageIcon,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Filter,
  CheckSquare,
  Square,
  ChevronDown
} from 'lucide-react';

const Github = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

interface OrderItem {
  id: string;
  orderCode: string;
  clientName: string;
  clientWhatsapp: string | null;
  templateId: string;
  packageTier: 'BASIC' | 'PREMIUM' | 'DELUXE';
  packagePriceSnapshot?: number;
  addonPriceSnapshot?: any;
  totalAmount?: number;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  paymentMethod?: 'QRIS' | 'BANK_TRANSFER';
  paymentTransactionStatus?: 'PENDING' | 'PAID' | 'CANCELLED';
  status: 'DRAFT' | 'CUSTOMIZED' | 'DEPLOYING' | 'LIVE' | 'ARCHIVED';
  githubRepoUrl: string | null;
  liveUrl: string | null;
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    category: string;
    packageTier: string;
    maxPhotos: number;
    thumbnailUrl: string | null;
  } | null;
  customization?: {
    recipientName: string | null;
    senderName: string | null;
    nickname: string | null;
    eventDate: string | null;
    pageTitle: string | null;
    loveLetter: string | null;
  } | null;
  photos?: {
    id: string;
    slotKey: string;
    fileName: string;
    fileUrl: string;
  }[];
}

interface OrderStats {
  total: number;
  draft: number;
  live: number;
  estimatedRevenue: number;
}

type SortField = 'orderCode' | 'clientName' | 'status' | 'total' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [pricingMap, setPricingMap] = useState<Record<string, number>>({
    BASIC: 49000,
    PREMIUM: 99000,
    DELUXE: 179000,
  });
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    draft: 0,
    live: 0,
    estimatedRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubUser, setGithubUser] = useState<any>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'LIVE' | 'CUSTOMIZED' | 'ARCHIVED'>('ALL');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'BASIC' | 'PREMIUM' | 'DELUXE'>('ALL');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Pagination (Default 20 items per page as requested)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Selection & Sorting
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Modals state
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    order: OrderItem | null;
    deleteGitHub: boolean;
    deleteVercel: boolean;
    deleting: boolean;
  }>({
    open: false,
    order: null,
    deleteGitHub: true,
    deleteVercel: true,
    deleting: false,
  });

  const [editModal, setEditModal] = useState<{
    open: boolean;
    order: OrderItem | null;
    clientName: string;
    clientWhatsapp: string;
    recipientName: string;
    liveUrl: string;
    status: string;
    paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
    paymentMethod: 'QRIS' | 'BANK_TRANSFER';
    paymentTransactionStatus: 'PENDING' | 'PAID' | 'CANCELLED';
    saving: boolean;
  }>({
    open: false,
    order: null,
    clientName: '',
    clientWhatsapp: '',
    recipientName: '',
    liveUrl: '',
    status: 'DRAFT',
    paymentStatus: 'UNPAID',
    paymentMethod: 'QRIS',
    paymentTransactionStatus: 'PENDING',
    saving: false,
  });

  const [whatsappModal, setWhatsappModal] = useState<{
    open: boolean;
    order: OrderItem | null;
    messageText: string;
    copied: boolean;
  }>({
    open: false,
    order: null,
    messageText: '',
    copied: false,
  });

  // Close active action dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch Orders from API
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
        setStats(data.stats || { total: 0, draft: 0, live: 0, estimatedRevenue: 0 });
        if (data.pricing) {
          setPricingMap(data.pricing);
        }
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkGithub = async () => {
    try {
      const authRes = await fetch('/api/github/auth');
      const authData = await authRes.json();
      setGithubConnected(authData.connected);
      if (authData.connected) {
        setGithubUser(authData.user);
      }
    } catch (e) {
      console.error('Failed to check GitHub auth:', e);
    }
  };

  useEffect(() => {
    fetchOrders();
    checkGithub();
  }, []);

  // Sort Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Calculate exact total (Package Price + Addons)
  const calculateOrderTotal = React.useCallback(
    (order: OrderItem) => {
      if (order.totalAmount !== undefined && order.totalAmount !== null && Number(order.totalAmount) > 0) {
        return Number(order.totalAmount);
      }
      const basePrice =
        order.packagePriceSnapshot !== undefined &&
        order.packagePriceSnapshot !== null &&
        Number(order.packagePriceSnapshot) > 0
          ? Number(order.packagePriceSnapshot)
          : (pricingMap[order.packageTier] ?? 49000);

      let addonTotal = 0;
      if (Array.isArray(order.addonPriceSnapshot)) {
        addonTotal = order.addonPriceSnapshot.reduce((sum, a: any) => sum + (Number(a?.price) || 0), 0);
      }
      return basePrice + addonTotal;
    },
    [pricingMap]
  );

  // Filtered & Sorted Orders
  const processedOrders = useMemo(() => {
    const result = orders.filter((o) => {
      // Search
      const matchesSearch =
        o.orderCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customization?.recipientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.clientWhatsapp || '').includes(searchQuery) ||
        (o.template?.name || o.templateId || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter !== 'ALL' && o.status !== statusFilter) {
        return false;
      }

      // Tier Filter
      if (tierFilter !== 'ALL' && o.packageTier !== tierFilter) {
        return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'orderCode') {
        comparison = a.orderCode.localeCompare(b.orderCode);
      } else if (sortField === 'clientName') {
        comparison = a.clientName.localeCompare(b.clientName);
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === 'total') {
        const priceA = calculateOrderTotal(a);
        const priceB = calculateOrderTotal(b);
        comparison = priceA - priceB;
      } else if (sortField === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'updatedAt') {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [orders, searchQuery, statusFilter, tierFilter, sortField, sortDirection, calculateOrderTotal]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, tierFilter, sortField, sortDirection]);

  // Paginated Orders (20 per page by default)
  const totalPages = Math.max(1, Math.ceil(processedOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedOrders.slice(start, start + pageSize);
  }, [processedOrders, currentPage, pageSize]);

  // Selection handlers
  const isAllSelected = paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedIds.includes(o.id));
  const isSomeSelected = paginatedOrders.some((o) => selectedIds.includes(o.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginatedOrders.some((o) => o.id === id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...paginatedOrders.map((o) => o.id)])));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Handle Delete Order
  const handleDeleteConfirm = async () => {
    if (!deleteModal.order) return;
    setDeleteModal((prev) => ({ ...prev, deleting: true }));

    try {
      const { id } = deleteModal.order;
      const url = `/api/orders/${id}?deleteGitHub=${deleteModal.deleteGitHub}&deleteVercel=${deleteModal.deleteVercel}`;
      const res = await fetch(url, { method: 'DELETE' });
      const json = await res.json();

      if (json.success) {
        setDeleteModal({ open: false, order: null, deleteGitHub: true, deleteVercel: true, deleting: false });
        setSelectedIds(prev => prev.filter(itemId => itemId !== id));
        fetchOrders();
      } else {
        alert(json.error || 'Gagal menghapus pesanan');
        setDeleteModal((prev) => ({ ...prev, deleting: false }));
      }
    } catch {
      alert('Error saat menghapus pesanan');
      setDeleteModal((prev) => ({ ...prev, deleting: false }));
    }
  };

  // Handle Save Quick Edit
  const handleSaveEdit = async () => {
    if (!editModal.order) return;
    setEditModal((prev) => ({ ...prev, saving: true }));

    try {
      const { id } = editModal.order;
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: editModal.clientName,
          clientWhatsapp: editModal.clientWhatsapp,
          recipientName: editModal.recipientName,
          liveUrl: editModal.liveUrl,
          status: editModal.status,
          paymentStatus: editModal.paymentStatus,
          paymentMethod: editModal.paymentMethod,
          paymentTransactionStatus: editModal.paymentTransactionStatus,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEditModal((prev) => ({ ...prev, open: false, saving: false }));
        fetchOrders();
      } else {
        alert(json.error || 'Gagal memperbarui pesanan');
        setEditModal((prev) => ({ ...prev, saving: false }));
      }
    } catch {
      alert('Error saat memperbarui data pesanan');
      setEditModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Open WhatsApp Share Dialog
  const openWhatsAppShare = (order: OrderItem) => {
    const recipient = order.customization?.recipientName || order.clientName;
    const link = order.liveUrl || `https://${order.orderCode.toLowerCase()}.vercel.app`;
    const msg = `Halo kak ${order.clientName}! 👋\n\nWebsite hadiah perayaan untuk *${recipient}* sudah siap dan aktif live! ✨\n\nSilakan buka link berikut dari smartphone atau laptop:\n👉 ${link}\n\nSelamat merayakan momen indah dan bahagia bersama! 💖🎉\n- MEMOu Digital Celebration`;
    setWhatsappModal({
      open: true,
      order,
      messageText: msg,
      copied: false,
    });
  };

  const copyShareText = () => {
    navigator.clipboard.writeText(whatsappModal.messageText);
    setWhatsappModal((prev) => ({ ...prev, copied: true }));
    setTimeout(() => {
      setWhatsappModal((prev) => ({ ...prev, copied: false }));
    }, 2000);
  };

  const sendDirectWhatsApp = () => {
    if (!whatsappModal.order?.clientWhatsapp) {
      alert('Nomor WhatsApp klien belum diisi.');
      return;
    }
    const cleanPhone = whatsappModal.order.clientWhatsapp.replace(/[^0-9]/g, '');
    const phone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappModal.messageText)}`;
    window.open(waUrl, '_blank');
  };

  // Extract repo slug for editor redirect
  const getEditorUrl = (order: OrderItem) => {
    if (!order.githubRepoUrl) {
      return `/editor/github/memou-clients/${order.orderCode.toLowerCase()}`;
    }
    const parts = order.githubRepoUrl.replace('https://github.com/', '').split('/');
    if (parts.length >= 2) {
      return `/editor/github/${parts[0]}/${parts[1]}`;
    }
    return `/editor/github/memou-clients/${order.orderCode.toLowerCase()}`;
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeDate = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 24 && now.getDate() === d.getDate()) {
      return 'Today';
    }
    if (diffHours < 48) {
      return 'Yesterday';
    }
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] pb-24 md:pl-20">
      {/* Top Header & Left Navigation Rail */}
      <AppNavigation
        activeRoute="orders"
        githubConnected={githubConnected}
        githubUser={githubUser}
        onRefresh={fetchOrders}
        isRefreshing={loading}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-28 md:pb-12 space-y-7">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] text-[#0f172a] text-[11px] font-bold tracking-wider uppercase mb-2">
              <Clock className="h-3 w-3 text-[#0f172a]" />
              <span>Orders Management System</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0f172a] tracking-tight">Daftar Pesanan Website</h1>
            <p className="mt-1 text-xs text-[#64748b]">
              Kelola seluruh pesanan website perayaan, pantau status live di internet, kirim link ke WhatsApp pembeli, dan edit konten.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-black transition flex items-center space-x-2 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>+ New sales order</span>
            </Link>
          </div>
        </div>

        {/* KPI Statistics Cards (Matching Belleva Style with Soft Pastel Badges) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Orders */}
          <div className="p-5 rounded-[24px] bg-white border border-[#e2e8f0] relative overflow-hidden group hover:border-slate-300 transition shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#64748b]">Total Pesanan</span>
              <div className="h-9 w-9 rounded-full bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-black text-[#0f172a] tracking-tight">{stats.total}</div>
              <p className="mt-1 text-[11px] text-[#94a3b8]">Terdata di TiDB Cloud</p>
            </div>
          </div>

          {/* Card 2: In Progress / Draft */}
          <div className="p-5 rounded-[24px] bg-white border border-[#e2e8f0] relative overflow-hidden group hover:border-slate-300 transition shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#64748b]">Dalam Pengerjaan</span>
              <div className="h-9 w-9 rounded-full bg-[#fef3c7] text-[#d97706] flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-black text-[#d97706] tracking-tight">{stats.draft}</div>
              <p className="mt-1 text-[11px] text-[#94a3b8]">Sedang diedit / belum live</p>
            </div>
          </div>

          {/* Card 3: Live & Completed */}
          <div className="p-5 rounded-[24px] bg-white border border-[#e2e8f0] relative overflow-hidden group hover:border-slate-300 transition shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#64748b]">Selesai & Live</span>
              <div className="h-9 w-9 rounded-full bg-[#dcfce7] text-[#10b981] flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-black text-[#10b981] tracking-tight">{stats.live}</div>
              <p className="mt-1 text-[11px] text-[#94a3b8]">Aktif di Vercel</p>
            </div>
          </div>

          {/* Card 4: Estimated Revenue */}
          <div className="p-5 rounded-[24px] bg-white border border-[#e2e8f0] relative overflow-hidden group hover:border-slate-300 transition shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#64748b]">Estimasi Omset</span>
              <div className="h-9 w-9 rounded-full bg-[#f1f5f9] text-[#0f172a] flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-[#0f172a] truncate tracking-tight">
                {formatRupiah(stats.estimatedRevenue)}
              </div>
              <p className="mt-1 text-[11px] text-[#94a3b8]">Kalkulasi paket order</p>
            </div>
          </div>
        </div>

        {/* Sales Order Toolbar (Search Pill + Filter Button) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Left Pill Search Container */}
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter sales orders..."
                className="w-full pl-11 pr-11 py-2.5 bg-white border border-[#e2e8f0] focus:border-[#0f172a] rounded-full text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none transition shadow-sm"
              />
              <button
                onClick={() => setShowFilterPanel(prev => !prev)}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition ${
                  showFilterPanel || statusFilter !== 'ALL' || tierFilter !== 'ALL'
                    ? 'bg-[#0f172a] text-white'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                }`}
                title="Toggle filter options"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Right Status Indicator & Selection Counter */}
          <div className="flex items-center space-x-3 text-xs">
            {selectedIds.length > 0 && (
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white border border-[#e2e8f0] text-[#0f172a] font-semibold shadow-sm">
                <span>{selectedIds.length} dipilih</span>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-[11px] text-[#64748b] hover:text-[#0f172a] underline ml-1"
                >
                  Batal
                </button>
              </div>
            )}

            <div className="inline-flex bg-[#f1f5f9] p-1 rounded-full border border-[#e2e8f0] text-xs">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-full transition font-bold ${
                  statusFilter === 'ALL' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                All ({orders.length})
              </button>
              <button
                onClick={() => setStatusFilter('LIVE')}
                className={`px-3 py-1.5 rounded-full transition font-bold ${
                  statusFilter === 'LIVE' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                Live ({stats.live})
              </button>
              <button
                onClick={() => setStatusFilter('DRAFT')}
                className={`px-3 py-1.5 rounded-full transition font-bold ${
                  statusFilter === 'DRAFT' ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                Draft ({stats.draft})
              </button>
            </div>
          </div>
        </div>

        {/* Filter Drawer / Panel (if toggled) */}
        {showFilterPanel && (
          <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs shadow-sm animate-in fade-in duration-200">
            <div>
              <label className="block text-[#64748b] mb-1 font-semibold">Filter Paket Tier:</label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
              >
                <option value="ALL">Semua Paket (All Tiers)</option>
                <option value="BASIC">Basic (3 Foto{pricingMap.BASIC ? ` - Rp ${new Intl.NumberFormat('id-ID').format(pricingMap.BASIC)}` : ''})</option>
                <option value="PREMIUM">Premium (8 Foto{pricingMap.PREMIUM ? ` - Rp ${new Intl.NumberFormat('id-ID').format(pricingMap.PREMIUM)}` : ''})</option>
                <option value="DELUXE">Deluxe (15 Foto{pricingMap.DELUXE ? ` - Rp ${new Intl.NumberFormat('id-ID').format(pricingMap.DELUXE)}` : ''})</option>
              </select>
            </div>

            <div>
              <label className="block text-[#64748b] mb-1 font-semibold">Status Lengkap:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
              >
                <option value="ALL">Semua Status</option>
                <option value="DRAFT">DRAFT (Pengerjaan)</option>
                <option value="CUSTOMIZED">CUSTOMIZED (Tersimpan di GitHub)</option>
                <option value="LIVE">LIVE (Aktif di Vercel)</option>
                <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setTierFilter('ALL');
                }}
                className="px-4 py-2 rounded-xl bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] border border-[#e2e8f0] transition w-full text-center"
              >
                Reset Semua Filter
              </button>
            </div>
          </div>
        )}

        {/* ORDER LIST TABLE (Clean Minimalist White Theme) */}
        <div className="bg-white border border-[#e2e8f0] rounded-[24px] overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-24 text-center">
              <RefreshCw className="h-8 w-8 text-[#0f172a] animate-spin mx-auto mb-3" />
              <p className="text-xs text-[#64748b] font-medium">Memuat data sales orders dari TiDB Cloud...</p>
            </div>
          ) : processedOrders.length === 0 ? (
            <div className="text-center py-20 p-8 max-w-md mx-auto">
              <div className="h-14 w-14 bg-[#f8fafc] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#94a3b8] border border-[#e2e8f0]">
                <Clock className="h-7 w-7 text-[#0f172a]" />
              </div>
              <h3 className="text-base font-bold text-[#0f172a]">Tidak Ada Pesanan Ditemukan</h3>
              <p className="text-xs text-[#64748b] mt-1">
                {searchQuery || statusFilter !== 'ALL' || tierFilter !== 'ALL'
                  ? 'Tidak ada pesanan yang sesuai dengan parameter filter.'
                  : 'Belum ada pesanan klien yang dibuat.'}
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-[#0f172a] text-white text-xs font-bold transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Buat Pesanan Baru</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                {/* Table Header */}
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-[#64748b] text-[11px] font-semibold select-none bg-[#f8fafc]">
                    {/* Checkbox Col */}
                    <th className="py-4 pl-6 pr-3 w-12 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="inline-flex items-center justify-center text-slate-400 hover:text-[#0f172a]"
                        title={isAllSelected ? "Deselect All" : "Select All"}
                      >
                        {isAllSelected ? (
                          <div className="h-4 w-4 rounded bg-[#0f172a] text-white flex items-center justify-center">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        ) : isSomeSelected ? (
                          <div className="h-4 w-4 rounded bg-[#0f172a]/40 text-white flex items-center justify-center">
                            <div className="h-1.5 w-2 bg-white rounded-sm" />
                          </div>
                        ) : (
                          <div className="h-4 w-4 rounded border border-[#cbd5e1] bg-white hover:border-[#0f172a]" />
                        )}
                      </button>
                    </th>

                    {/* Order # Col with sort arrow */}
                    <th className="py-4 px-3 font-semibold cursor-pointer group" onClick={() => handleSort('orderCode')}>
                      <div className="flex items-center space-x-1.5 text-slate-700 group-hover:text-[#0f172a] transition">
                        <span>Order #</span>
                        {sortField === 'orderCode' ? (
                          sortDirection === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 text-[#0f172a]" />
                          ) : (
                            <ArrowUp className="h-3.5 w-3.5 text-[#0f172a]" />
                          )
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition" />
                        )}
                      </div>
                    </th>

                    {/* Client Name */}
                    <th className="py-4 px-4 font-semibold cursor-pointer group" onClick={() => handleSort('clientName')}>
                      <div className="flex items-center space-x-1.5 text-slate-700 group-hover:text-[#0f172a] transition">
                        <span>Client name</span>
                        {sortField === 'clientName' && (
                          sortDirection === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 text-[#0f172a]" />
                          ) : (
                            <ArrowUp className="h-3.5 w-3.5 text-[#0f172a]" />
                          )
                        )}
                      </div>
                    </th>

                    {/* Status Col */}
                    <th className="py-4 px-3 font-semibold cursor-pointer group" onClick={() => handleSort('status')}>
                      <div className="flex items-center space-x-1.5 text-slate-700 group-hover:text-[#0f172a] transition">
                        <span>Status</span>
                        {sortField === 'status' && (
                          sortDirection === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 text-[#0f172a]" />
                          ) : (
                            <ArrowUp className="h-3.5 w-3.5 text-[#0f172a]" />
                          )
                        )}
                      </div>
                    </th>

                    {/* Total Col */}
                    <th className="py-4 px-4 font-semibold text-right cursor-pointer group" onClick={() => handleSort('total')}>
                      <div className="flex items-center justify-end space-x-1.5 text-slate-700 group-hover:text-[#0f172a] transition">
                        <span>Total</span>
                        {sortField === 'total' && (
                          sortDirection === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 text-[#0f172a]" />
                          ) : (
                            <ArrowUp className="h-3.5 w-3.5 text-[#0f172a]" />
                          )
                        )}
                      </div>
                    </th>

                    {/* Created Col */}
                    <th className="py-4 px-4 font-semibold cursor-pointer group" onClick={() => handleSort('createdAt')}>
                      <div className="flex items-center space-x-1.5 text-slate-700 group-hover:text-[#0f172a] transition">
                        <span>Created</span>
                        {sortField === 'createdAt' && (
                          sortDirection === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 text-[#0f172a]" />
                          ) : (
                            <ArrowUp className="h-3.5 w-3.5 text-[#0f172a]" />
                          )
                        )}
                      </div>
                    </th>

                    {/* Last updated Col */}
                    <th className="py-4 px-4 font-semibold cursor-pointer group" onClick={() => handleSort('updatedAt')}>
                      <div className="flex items-center space-x-1.5 text-slate-700 group-hover:text-[#0f172a] transition">
                        <span>Last updated</span>
                        {sortField === 'updatedAt' && (
                          sortDirection === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 text-[#0f172a]" />
                          ) : (
                            <ArrowUp className="h-3.5 w-3.5 text-[#0f172a]" />
                          )
                        )}
                      </div>
                    </th>

                    {/* Actions Menu */}
                    <th className="py-4 pr-6 pl-2 text-right w-14"></th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-[#f1f5f9]">
                  {paginatedOrders.map((order) => {
                    const isSelected = selectedIds.includes(order.id);
                    const isLive = order.status === 'LIVE';
                    const isDraft = order.status === 'DRAFT';
                    const isCustomized = order.status === 'CUSTOMIZED';
                    const orderTotal = calculateOrderTotal(order);
                    const recipientName = order.customization?.recipientName || order.customization?.nickname;
                    const paidAddons = Array.isArray(order.addonPriceSnapshot)
                      ? order.addonPriceSnapshot.filter((a: any) => Number(a?.price) > 0)
                      : [];

                    return (
                      <tr
                        key={order.id}
                        className={`transition-colors duration-150 group ${
                          isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-4 pl-6 pr-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(order.id)}
                            className="inline-flex items-center justify-center"
                          >
                            {isSelected ? (
                              <div className="h-4 w-4 rounded bg-[#0f172a] text-white flex items-center justify-center">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="h-4 w-4 rounded border border-[#cbd5e1] bg-white group-hover:border-[#0f172a] transition" />
                            )}
                          </button>
                        </td>

                        {/* Order # */}
                        <td className="py-4 px-3 whitespace-nowrap font-medium">
                          <div className="flex items-center space-x-2">
                            <Link
                              href={getEditorUrl(order)}
                              className="font-mono text-xs font-bold text-[#0f172a] hover:underline flex items-center space-x-1"
                            >
                              <span>#{order.orderCode}</span>
                            </Link>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                order.packageTier === 'BASIC'
                                  ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
                                  : order.packageTier === 'PREMIUM'
                                  ? 'bg-[#fef3c7] text-[#b45309] border border-[#fde68a]'
                                  : 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]'
                              }`}
                            >
                              {order.packageTier}
                            </span>
                          </div>
                        </td>

                        {/* Company / Client Name */}
                        <td className="py-4 px-4">
                          <div>
                            <div className="font-bold text-[#0f172a] text-xs transition">
                              {order.clientName}
                            </div>
                            <div className="text-[11px] text-[#64748b] flex items-center space-x-2 mt-0.5">
                              {recipientName && (
                                <span>
                                  Untuk: <strong className="text-[#334155]">{recipientName}</strong>
                                </span>
                              )}
                              {order.clientWhatsapp && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  • {order.clientWhatsapp}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status (Pill matching reference image) */}
                        <td className="py-4 px-3 whitespace-nowrap">
                          {isLive ? (
                            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] text-[10px] font-black tracking-wider uppercase">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
                              <span>FULFILLED / LIVE</span>
                            </span>
                          ) : isCustomized ? (
                            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] text-[10px] font-black tracking-wider uppercase">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#0284c7]" />
                              <span>CONFIRMED / CUSTOMIZED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#fffbeb] text-[#b45309] border border-[#fde68a] text-[10px] font-black tracking-wider uppercase">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
                              <span>IN PROGRESS / DRAFT</span>
                            </span>
                          )}
                        </td>

                        {/* Total */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="font-black text-[#0f172a] text-xs font-mono">
                            {new Intl.NumberFormat('id-ID').format(orderTotal)} IDR
                          </div>
                          {paidAddons.length > 0 && (
                            <div
                              className="text-[10px] text-indigo-600 font-sans font-medium mt-0.5"
                              title={paidAddons.map((a: any) => `${a.name}: ${formatRupiah(Number(a.price))}`).join(', ')}
                            >
                              + Addon ({paidAddons.map((a: any) => a.name).join(', ')})
                            </div>
                          )}
                        </td>

                        {/* Created */}
                        <td className="py-4 px-4 whitespace-nowrap text-[#64748b] text-xs">
                          {formatDisplayDate(order.createdAt)}
                        </td>

                        {/* Last updated */}
                        <td className="py-4 px-4 whitespace-nowrap text-[#64748b] text-xs">
                          {formatRelativeDate(order.updatedAt)}
                        </td>

                        {/* Actions Menu (...) */}
                        <td className="py-4 pr-6 pl-2 text-right relative action-menu-container">
                          <div className="inline-flex items-center space-x-1">
                            {/* Direct Quick Link to Live if available */}
                            {order.liveUrl && (
                              <a
                                href={order.liveUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition"
                                title="Buka Live Website"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}

                            {/* Direct Quick Edit in Studio */}
                            <Link
                              href={getEditorUrl(order)}
                              className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition"
                              title="Buka Editor Studio"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Link>

                            {/* More Actions Three Dots Button */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionMenuId(prev => prev === order.id ? null : order.id);
                                }}
                                className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition"
                                title="Aksi lainnya"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>

                              {/* Dropdown Menu */}
                              {activeActionMenuId === order.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 rounded-2xl bg-white border border-[#e2e8f0] shadow-xl py-1.5 z-30 text-left animate-in fade-in zoom-in-95 duration-150">
                                  <Link
                                    href={getEditorUrl(order)}
                                    className="w-full px-3.5 py-2 text-xs text-[#0f172a] hover:bg-[#f1f5f9] flex items-center space-x-2 transition"
                                  >
                                    <Edit3 className="h-3.5 w-3.5 text-[#0f172a]" />
                                    <span>Edit di Studio</span>
                                  </Link>

                                  <button
                                    onClick={() => {
                                      setActiveActionMenuId(null);
                                      openWhatsAppShare(order);
                                    }}
                                    className="w-full px-3.5 py-2 text-xs text-[#0f172a] hover:bg-[#f1f5f9] flex items-center space-x-2 transition text-left"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Kirim ke WhatsApp</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setActiveActionMenuId(null);
                                      setEditModal({
                                        open: true,
                                        order,
                                        clientName: order.clientName,
                                        clientWhatsapp: order.clientWhatsapp || '',
                                        recipientName: order.customization?.recipientName || '',
                                        liveUrl: order.liveUrl || '',
                                        status: order.status,
                                        paymentStatus: order.paymentStatus || 'UNPAID',
                                        paymentMethod: order.paymentMethod || 'QRIS',
                                        paymentTransactionStatus: order.paymentTransactionStatus || (order.paymentStatus === 'PAID' ? 'PAID' : 'PENDING'),
                                        saving: false,
                                      });
                                    }}
                                    className="w-full px-3.5 py-2 text-xs text-[#0f172a] hover:bg-[#f1f5f9] flex items-center space-x-2 transition text-left"
                                  >
                                    <User className="h-3.5 w-3.5 text-[#64748b]" />
                                    <span>Edit Info Pesanan</span>
                                  </button>

                                  {order.githubRepoUrl && (
                                    <a
                                      href={order.githubRepoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="w-full px-3.5 py-2 text-xs text-[#0f172a] hover:bg-[#f1f5f9] flex items-center space-x-2 transition text-left"
                                    >
                                      <Github className="h-3.5 w-3.5 text-[#64748b]" />
                                      <span>Buka di GitHub</span>
                                    </a>
                                  )}

                                  <div className="my-1 border-t border-[#e2e8f0]" />

                                  <button
                                    onClick={() => {
                                      setActiveActionMenuId(null);
                                      setDeleteModal({
                                        open: true,
                                        order,
                                        deleteGitHub: true,
                                        deleteVercel: true,
                                        deleting: false,
                                      });
                                    }}
                                    className="w-full px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition text-left"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Hapus Pesanan</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table Footer with Pagination */}
              <div className="p-4 border-t border-[#f1f5f9] bg-[#fafbfc]/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-[#64748b]">
                  Menampilkan {processedOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
                  {Math.min(currentPage * pageSize, processedOrders.length)} dari {processedOrders.length} pesanan
                </span>
                <PaginationBar
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={processedOrders.length}
                  pageSizeOptions={[10, 20, 50, 100]}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  className="py-0"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-[#e2e8f0] rounded-[28px] max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="h-10 w-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0f172a]">Hapus Pesanan Klien?</h3>
                <p className="text-xs text-[#64748b] font-mono">{deleteModal.order.orderCode}</p>
              </div>
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Anda akan menghapus pesanan atas nama <strong className="text-[#0f172a]">{deleteModal.order.clientName}</strong>. Tindakan ini tidak dapat dibatalkan.
            </p>

            {/* Deletion Cascade Checkboxes */}
            <div className="p-4 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] space-y-3 text-xs">
              <label className="flex items-center space-x-2.5 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={deleteModal.deleteGitHub}
                  onChange={(e) =>
                    setDeleteModal((prev) => ({ ...prev, deleteGitHub: e.target.checked }))
                  }
                  className="rounded border-[#cbd5e1] text-[#0f172a] focus:ring-0 h-4 w-4"
                />
                <span className="flex items-center space-x-1.5">
                  <Github className="h-3.5 w-3.5 text-[#64748b]" />
                  <span>Hapus Repositori di GitHub (@memou-clients)</span>
                </span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={deleteModal.deleteVercel}
                  onChange={(e) =>
                    setDeleteModal((prev) => ({ ...prev, deleteVercel: e.target.checked }))
                  }
                  className="rounded border-[#cbd5e1] text-[#0f172a] focus:ring-0 h-4 w-4"
                />
                <span className="flex items-center space-x-1.5">
                  <Globe className="h-3.5 w-3.5 text-[#64748b]" />
                  <span>Hapus Project Deployment di Vercel</span>
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, order: null, deleteGitHub: true, deleteVercel: true, deleting: false })}
                disabled={deleteModal.deleting}
                className="px-4 py-2 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] text-xs font-semibold transition border border-[#e2e8f0]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteModal.deleting}
                className="px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
              >
                {deleteModal.deleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Hapus Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Details Modal */}
      {editModal.open && editModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-[#e2e8f0] rounded-[28px] max-w-md w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <h3 className="text-sm font-bold text-[#0f172a] flex items-center space-x-2">
                <Edit3 className="h-4 w-4 text-[#0f172a]" />
                <span>Edit Detail Pesanan</span>
              </h3>
              <span className="font-mono text-xs text-[#64748b]">{editModal.order.orderCode}</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#64748b] mb-1 font-medium">Nama Pemesan (Klien)</label>
                <input
                  type="text"
                  value={editModal.clientName}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, clientName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-[#0f172a] focus:outline-none focus:border-[#0f172a] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[#64748b] mb-1 font-medium">Nama Penerima (Pacar / Pasangan)</label>
                <input
                  type="text"
                  value={editModal.recipientName}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, recipientName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-[#0f172a] focus:outline-none focus:border-[#0f172a] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[#64748b] mb-1 font-medium">Nomor WhatsApp Klien</label>
                <input
                  type="text"
                  value={editModal.clientWhatsapp}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, clientWhatsapp: e.target.value }))}
                  placeholder="Contoh: 08123456789"
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-[#0f172a] focus:outline-none focus:border-[#0f172a] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[#64748b] mb-1 font-medium">
                  URL Website (Vercel)
                </label>
                <input
                  type="text"
                  value={editModal.liveUrl}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, liveUrl: e.target.value }))}
                  placeholder="https://...-memou.vercel.app"
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-[#0f172a] font-mono text-xs focus:outline-none focus:border-[#0f172a] focus:bg-white transition"
                />
                <p className="text-[10px] text-[#94a3b8] mt-1">
                  Format: <code>nama event-nama penerima-memou.vercel.app</code> atau <code>(request)-memou.vercel.app</code>
                </p>
              </div>

              <div>
                <label className="block text-[#64748b] mb-1 font-medium">Status Pesanan</label>
                <select
                  value={editModal.status}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-[#0f172a] focus:outline-none focus:border-[#0f172a] focus:bg-white transition"
                >
                  <option value="DRAFT">DRAFT (Sedang Dikerjakan)</option>
                  <option value="CUSTOMIZED">CUSTOMIZED (Selesai Desain)</option>
                  <option value="LIVE">LIVE (Aktif di Vercel)</option>
                  <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#64748b] font-medium">Status Pembayaran</label>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      editModal.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : editModal.paymentStatus === 'PARTIAL'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {editModal.paymentStatus}
                  </span>
                </div>
                <select
                  value={editModal.paymentStatus}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, paymentStatus: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-[#0f172a] font-semibold text-xs focus:outline-none focus:border-[#0f172a] focus:bg-white transition"
                >
                  <option value="UNPAID">UNPAID (Belum Bayar)</option>
                  <option value="PARTIAL">PARTIAL (DP / Termin)</option>
                  <option value="PAID">PAID (Lunas)</option>
                </select>
                <p className="text-[10px] text-[#94a3b8] mt-1">
                  {editModal.paymentStatus === 'PAID'
                    ? '✓ Status PAID membuka akses tombol Publish & Go Live di studio.'
                    : 'ℹ Status UNPAID/PARTIAL mengunci Go Live dan hanya mengizinkan commit ke GitHub.'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#64748b] font-medium">Status Transaksi</label>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      editModal.paymentTransactionStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : editModal.paymentTransactionStatus === 'CANCELLED'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {editModal.paymentTransactionStatus}
                  </span>
                </div>
                <select
                  value={editModal.paymentTransactionStatus}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, paymentTransactionStatus: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-[#0f172a] font-semibold text-xs focus:outline-none focus:border-[#0f172a] focus:bg-white transition"
                >
                  <option value="PENDING">PENDING (Menunggu Pembayaran)</option>
                  <option value="PAID">PAID (Pembayaran Diterima / Lunas)</option>
                  <option value="CANCELLED">CANCELLED (Transaksi Dibatalkan)</option>
                </select>
                <p className="text-[10px] text-[#94a3b8] mt-1">
                  {editModal.paymentTransactionStatus === 'PAID'
                    ? '✓ Tercatat lunas di tabel transaksi pembayaran (paid_at diperbarui).'
                    : editModal.paymentTransactionStatus === 'CANCELLED'
                    ? '✕ Transaksi dibatalkan / kadaluarsa.'
                    : '⏳ Menunggu konfirmasi pembayaran dari gateway / klien.'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#64748b] font-medium">Metode Pembayaran</label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                    {editModal.paymentMethod === 'BANK_TRANSFER' ? 'Transfer Bank' : 'QRIS'}
                  </span>
                </div>
                <select
                  value={editModal.paymentMethod}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, paymentMethod: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-[#0f172a] font-semibold text-xs focus:outline-none focus:border-[#0f172a] focus:bg-white transition"
                >
                  <option value="QRIS">QRIS (Otomatis / Instant)</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER (Transfer Bank / Manual)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setEditModal((prev) => ({ ...prev, open: false }))}
                disabled={editModal.saving}
                className="px-4 py-2 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] text-xs font-semibold transition border border-[#e2e8f0]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editModal.saving}
                className="px-5 py-2.5 rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
              >
                {editModal.saving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Perubahan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Share Message Modal */}
      {whatsappModal.open && whatsappModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-[#e2e8f0] rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <div className="flex items-center space-x-2 text-[#0f172a]">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-[#0f172a]">Kirim Link ke WhatsApp</h3>
              </div>
              <span className="font-mono text-xs text-[#64748b]">{whatsappModal.order.orderCode}</span>
            </div>

            <p className="text-xs text-[#64748b]">
              Format pesan ramah telah disiapkan otomatis. Anda dapat langsung mengirimkannya ke nomor WhatsApp pembeli atau menyalin teks di bawah ini:
            </p>

            <textarea
              rows={7}
              value={whatsappModal.messageText}
              onChange={(e) => setWhatsappModal((prev) => ({ ...prev, messageText: e.target.value }))}
              className="w-full p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-xs text-[#0f172a] focus:outline-none focus:border-[#0f172a] focus:bg-white font-sans leading-relaxed transition"
            />

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={copyShareText}
                className="px-4 py-2 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] text-xs font-semibold transition flex items-center space-x-1.5 border border-[#e2e8f0]"
              >
                {whatsappModal.copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Teks Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Salin Pesan</span>
                  </>
                )}
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setWhatsappModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] text-xs font-semibold transition border border-[#e2e8f0]"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={sendDirectWhatsApp}
                  className="px-5 py-2.5 rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Kirim ke WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
