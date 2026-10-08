'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Rocket,
  Smartphone,
  Tablet,
  Monitor,
  RefreshCw,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  MessageSquareQuote,
  UserCheck,
  Code,
  Sparkles,
  Check,
  AlertCircle,
  ChevronRight,
  Copy,
  CheckCircle2,
  Music,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Disc3,
  Lock,
  CreditCard
} from 'lucide-react';
import { GitHubTemplateContent } from '@/lib/githubService';
import BackgroundColorPicker from '@/components/BackgroundColorPicker';

const YouTubeIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export default function GitHubTemplateEditorPage({
  params,
}: {
  params: { owner: string; repo: string };
}) {
  const { owner, repo } = params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [data, setData] = useState<GitHubTemplateContent | null>(null);
  const [clientOrder, setClientOrder] = useState<{
    id: string;
    orderCode: string;
    clientName: string;
    clientWhatsapp: string | null;
    packageTier: string;
    packagePriceSnapshot: number;
    totalAmount: number;
    paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
    status: string;
    liveUrl: string | null;
  } | null>(null);

  // Active Tab: 'info' | 'quotes' | 'photos' | 'music' | 'code'
  const [activeTab, setActiveTab] = useState<'info' | 'quotes' | 'photos' | 'music' | 'code'>('info');

  // Viewport mode: 'desktop' | 'tablet' | 'mobile'
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Layout mode: 'split' | 'editor' | 'preview'
  const [layoutMode, setLayoutMode] = useState<'split' | 'editor' | 'preview'>('split');

  // Live preview refresh counter
  const [previewKey, setPreviewKey] = useState<number>(Date.now());
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [rawFiles, setRawFiles] = useState<{
    'index.html': string;
    'script.js': string;
    'style.css': string;
  }>({
    'index.html': '',
    'script.js': '',
    'style.css': '',
  });
  const [activeCodeFile, setActiveCodeFile] = useState<'index.html' | 'script.js' | 'style.css'>('script.js');

  // Photo slot replacements queued
  const [photoUpdates, setPhotoUpdates] = useState<{ slotId: string; newSrc: string }[]>([]);

  // Photo Upload Progress State
  const [uploadProgress, setUploadProgress] = useState<{
    active: boolean;
    fileName: string;
    fileSize: string;
    slotId?: string;
    percentage: number;
    status: 'uploading' | 'processing' | 'success' | 'error';
    statusText: string;
  }>({
    active: false,
    fileName: '',
    fileSize: '',
    percentage: 0,
    status: 'uploading',
    statusText: '',
  });

  // Publish / Go Live Modal state
  const [publishModal, setPublishModal] = useState<{
    open: boolean;
    publishing: boolean;
    liveUrl: string | null;
    copied: boolean;
  }>({
    open: false,
    publishing: false,
    liveUrl: null,
    copied: false,
  });

  // Audio State & In-Editor Player
  const [audioTrack, setAudioTrack] = useState<{ src: string; name: string; hasTag?: boolean } | null>(null);
  const [audioInputUrl, setAudioInputUrl] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Audio Upload Progress State
  const [audioUploadProgress, setAudioUploadProgress] = useState<{
    active: boolean;
    fileName: string;
    fileSize: string;
    percentage: number;
    status: 'uploading' | 'committing' | 'success' | 'error';
    statusText: string;
  }>({
    active: false,
    fileName: '',
    fileSize: '',
    percentage: 0,
    status: 'uploading',
    statusText: '',
  });

  // YouTube Audio Link State
  const [youtubeInputUrl, setYoutubeInputUrl] = useState('');
  const [youtubePreview, setYoutubePreview] = useState<{
    id: string;
    title?: string;
    author?: string;
    thumbnail: string;
  } | null>(null);
  const [loadingYouTubeMeta, setLoadingYouTubeMeta] = useState(false);

  // Helper to extract YouTube video ID from standard/music URLs
  const getYouTubeId = useCallback((url: string): string | null => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    const match = trimmed.match(
      /(?:youtu\.be\/|(?:[a-zA-Z0-9-]+\.)?youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
    );
    if (match && match[1]) return match[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    return null;
  }, []);

  // Fetch YouTube Metadata when URL is entered
  useEffect(() => {
    const ytId = getYouTubeId(youtubeInputUrl);
    if (!ytId) {
      setYoutubePreview(null);
      return;
    }

    setYoutubePreview({
      id: ytId,
      thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    });
    setLoadingYouTubeMeta(true);

    let isCurrent = true;
    fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`)
      .then((r) => r.json())
      .then((meta) => {
        if (!isCurrent) return;
        if (meta && meta.title) {
          setYoutubePreview((prev) =>
            prev?.id === ytId
              ? { ...prev, title: meta.title, author: meta.author_name }
              : prev
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isCurrent) setLoadingYouTubeMeta(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [youtubeInputUrl, getYouTubeId]);

  // Load Template Data directly from GitHub
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/github/template/${owner}/${repo}`);
      const json = await res.json();
      if (json.success && json.details) {
        setData(json.details);
        setClientOrder(json.clientOrder || null);
        setTitle(json.details.title || '');
        setConfig(json.details.config || {});
        setRawFiles(json.details.rawFiles);
        if (json.details.audio) {
          setAudioTrack(json.details.audio);
          setAudioInputUrl(json.details.audio.src || '');
          const existingYtId = getYouTubeId(json.details.audio.src);
          if (existingYtId) {
            setYoutubeInputUrl(json.details.audio.src);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load GitHub template details:', err);
    } finally {
      setLoading(false);
    }
  }, [owner, repo, getYouTubeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time synchronization with preview iframe
  const syncLivePreview = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const payload = {
      type: 'MEMOU_LIVE_SYNC',
      config,
      title,
      photoUpdates,
      configVarName: data?.configVarName,
      styleCss: activeTab === 'code' ? rawFiles['style.css'] : undefined,
      audioSrc: audioTrack?.src,
    };

    // 1. Direct same-origin bridge call for immediate zero-latency execution
    let synced = false;
    try {
      const win = iframe.contentWindow as any;
      if (win && typeof win.__memouApplyLiveSync === 'function') {
        win.__memouApplyLiveSync(payload);
        synced = true;
      }
    } catch (e) {}

    // 2. Fallback to postMessage only if direct bridge wasn't reachable
    if (!synced) {
      try {
        iframe.contentWindow?.postMessage(payload, '*');
      } catch (e) {}
    }
  }, [config, title, photoUpdates, data?.configVarName, activeTab, rawFiles, audioTrack?.src]);


  // Sync on every state change
  useEffect(() => {
    syncLivePreview();
  }, [syncLivePreview]);

  // Listen for bridge ready signal from iframe to perform initial sync
  useEffect(() => {
    const handleBridgeMessage = (e: MessageEvent) => {
      if (e.data?.type === 'MEMOU_LIVE_BRIDGE_READY') {
        syncLivePreview();
      }
    };
    window.addEventListener('message', handleBridgeMessage);
    return () => window.removeEventListener('message', handleBridgeMessage);
  }, [syncLivePreview]);


  // Handle Commit & Save to GitHub
  const handleSaveToGitHub = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload: any = {
        title,
        photoUpdates,
        fileShas: data?.fileShas,
      };

      if (activeTab === 'code') {
        payload.rawFiles = rawFiles;
      } else {
        if (data?.configVarName) {
          payload.config = config;
          payload.configVarName = data.configVarName;
        }
      }

      const res = await fetch(`/api/github/template/${owner}/${repo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setSaveSuccess(true);
        setData(json.details);
        setPhotoUpdates([]);
        // Refresh live preview iframe
        setPreviewKey(Date.now());
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(json.error || 'Gagal menyimpan perubahan ke GitHub');
      }
    } catch {
      alert('Error saat commit ke GitHub');
    } finally {
      setSaving(false);
    }
  };

  // Handle Photo Upload directly to GitHub with Real-Time Progress Tracking
  const handleFileUpload = (file: File, targetSlotId?: string) => {
    const formatBytes = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    setUploadProgress({
      active: true,
      fileName: file.name,
      fileSize: formatBytes(file.size),
      slotId: targetSlotId,
      percentage: 8,
      status: 'uploading',
      statusText: 'Mengunggah file foto...',
    });

    const formData = new FormData();
    formData.append('owner', owner);
    formData.append('repo', repo);
    formData.append('file', file);
    if (targetSlotId) {
      formData.append('slotId', targetSlotId);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/github/upload');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        // Map upload network transfer to 8% - 85%
        const percent = Math.min(85, Math.max(8, Math.round((event.loaded / event.total) * 85)));
        setUploadProgress((prev) => ({
          ...prev,
          percentage: percent,
          status: 'uploading',
          statusText: `Mengunggah file... ${percent}%`,
        }));
      }
    };

    xhr.upload.onload = () => {
      setUploadProgress((prev) => ({
        ...prev,
        percentage: 90,
        status: 'processing',
        statusText: 'Memproses & commit foto ke GitHub...',
      }));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.success) {
            setData(json.details);
            setUploadProgress((prev) => ({
              ...prev,
              percentage: 100,
              status: 'success',
              statusText: 'Foto berhasil diunggah & disimpan ke GitHub!',
            }));
            setPreviewKey(Date.now());
            setTimeout(() => {
              setUploadProgress((prev) => ({ ...prev, active: false }));
            }, 2500);
            return;
          } else {
            throw new Error(json.error || 'Upload foto ke GitHub gagal');
          }
        } catch (err: any) {
          setUploadProgress((prev) => ({
            ...prev,
            percentage: 100,
            status: 'error',
            statusText: err.message || 'Gagal memproses upload',
          }));
          setTimeout(() => {
            setUploadProgress((prev) => ({ ...prev, active: false }));
          }, 3500);
        }
      } else {
        setUploadProgress((prev) => ({
          ...prev,
          percentage: 100,
          status: 'error',
          statusText: `Server error (${xhr.status})`,
        }));
        setTimeout(() => {
          setUploadProgress((prev) => ({ ...prev, active: false }));
        }, 3500);
      }
    };

    xhr.onerror = () => {
      setUploadProgress((prev) => ({
        ...prev,
        percentage: 100,
        status: 'error',
        statusText: 'Koneksi jaringan terputus saat upload',
      }));
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, active: false }));
      }, 3500);
    };

    xhr.send(formData);
  };

  // Assign existing image from assets
  const handleAssignPhotoToSlot = (slotId: string, assetPath: string) => {
    setPhotoUpdates((prev) => {
      const filtered = prev.filter((p) => p.slotId !== slotId);
      return [...filtered, { slotId, newSrc: assetPath }];
    });
  };

  // Audio Playback URL Helper
  const getAudioUrl = (src?: string) => {
    if (!src) return '';
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    const clean = src.replace(/^\//, '');
    return `/api/github/preview/${owner}/${repo}/${clean}?t=${previewKey}`;
  };

  // Toggle audio preview in Studio
  const togglePlayAudio = () => {
    if (!audioPlayerRef.current) return;
    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch((e) => {
          console.warn('Playback error:', e);
          setIsPlayingAudio(false);
        });
    }
  };

  // Handle Audio File Upload to GitHub
  const handleAudioUpload = (file: File) => {
    const formatBytes = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    setAudioUploadProgress({
      active: true,
      fileName: file.name,
      fileSize: formatBytes(file.size),
      percentage: 10,
      status: 'uploading',
      statusText: 'Mengunggah file audio ke server...',
    });

    const formData = new FormData();
    formData.append('owner', owner);
    formData.append('repo', repo);
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/github/upload-audio');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(85, Math.max(10, Math.round((event.loaded / event.total) * 85)));
        setAudioUploadProgress((prev) => ({
          ...prev,
          percentage: percent,
          statusText: `Mengunggah file audio... ${percent}%`,
        }));
      }
    };

    xhr.upload.onload = () => {
      setAudioUploadProgress((prev) => ({
        ...prev,
        percentage: 90,
        status: 'committing',
        statusText: 'Memproses & commit audio ke GitHub...',
      }));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.success) {
            setData(json.details);
            if (json.details?.audio) {
              setAudioTrack(json.details.audio);
              setAudioInputUrl(json.details.audio.src || '');
            } else if (json.filePath) {
              setAudioTrack({ src: json.filePath, name: json.fileName || json.filePath.split('/').pop() || 'bgm.mp3', hasTag: true });
              setAudioInputUrl(json.filePath);
            }

            setAudioUploadProgress((prev) => ({
              ...prev,
              percentage: 100,
              status: 'success',
              statusText: 'Audio berhasil diunggah & diaktifkan di template!',
            }));

            // Refresh preview iframe
            setPreviewKey(Date.now());
            setTimeout(() => {
              setAudioUploadProgress((prev) => ({ ...prev, active: false }));
            }, 3000);
            return;
          } else {
            throw new Error(json.error || 'Upload audio ke GitHub gagal');
          }
        } catch (err: any) {
          setAudioUploadProgress((prev) => ({
            ...prev,
            percentage: 100,
            status: 'error',
            statusText: err.message || 'Gagal memproses upload audio',
          }));
          setTimeout(() => {
            setAudioUploadProgress((prev) => ({ ...prev, active: false }));
          }, 3500);
        }
      } else {
        setAudioUploadProgress((prev) => ({
          ...prev,
          percentage: 100,
          status: 'error',
          statusText: `Server error (${xhr.status})`,
        }));
        setTimeout(() => {
          setAudioUploadProgress((prev) => ({ ...prev, active: false }));
        }, 3500);
      }
    };

    xhr.onerror = () => {
      setAudioUploadProgress((prev) => ({
        ...prev,
        percentage: 100,
        status: 'error',
        statusText: 'Koneksi jaringan terputus saat upload audio',
      }));
      setTimeout(() => {
        setAudioUploadProgress((prev) => ({ ...prev, active: false }));
      }, 3500);
    };

    xhr.send(formData);
  };

  // Assign existing audio track or custom URL
  const handleAssignAudio = async (newSrc: string) => {
    if (!newSrc.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/github/template/${owner}/${repo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          config,
          configVarName: data?.configVarName,
          fileShas: data?.fileShas,
          audioUpdate: { newSrc: newSrc.trim() },
        }),
      });

      const json = await res.json();
      if (json.success) {
        if (json.details) {
          setData(json.details);
          if (json.details.audio) {
            setAudioTrack(json.details.audio);
            setAudioInputUrl(json.details.audio.src || '');
          }
        } else {
          setAudioTrack({ src: newSrc, name: newSrc.split('/').pop() || newSrc, hasTag: true });
          setAudioInputUrl(newSrc);
        }
        setPreviewKey(Date.now());
      } else {
        alert(json.error || 'Gagal memperbarui audio');
      }
    } catch {
      alert('Error saat menyimpan perubahan audio');
    } finally {
      setSaving(false);
    }
  };

  // Trigger Vercel Deploy & Publish
  const handlePublishAndGoLive = async () => {
    setPublishModal({ open: true, publishing: true, liveUrl: null, copied: false });
    try {
      const res = await fetch('/api/vercel/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: repo,
          repoFullName: `${owner}/${repo}`,
          clientName: config.recipientName || repo,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setPublishModal((prev) => ({
          ...prev,
          publishing: false,
          liveUrl: json.liveUrl,
        }));
      } else {
        alert(json.error || 'Gagal deploy website');
        setPublishModal((prev) => ({ ...prev, publishing: false, open: false }));
      }
    } catch {
      alert('Error saat deploy ke Vercel');
      setPublishModal((prev) => ({ ...prev, publishing: false, open: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setPublishModal((prev) => ({ ...prev, copied: true }));
    setTimeout(() => {
      setPublishModal((prev) => ({ ...prev, copied: false }));
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-[#64748b]">
        <div className="flex items-center space-x-3">
          <RefreshCw className="h-6 w-6 animate-spin text-[#0f172a]" />
          <span className="font-medium text-sm text-[#0f172a]">Memuat Template Cloud dari GitHub (@{owner}/{repo})...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-[#0f172a] p-6">
        <AlertCircle className="h-12 w-12 text-[#0f172a] mb-3" />
        <h2 className="text-xl font-bold">Template GitHub Tidak Ditemukan</h2>
        <p className="text-sm text-[#64748b] mt-1">
          Tidak dapat memuat repositori {owner}/{repo}. Pastikan repo memiliki file index.html.
        </p>
        <Link
          href="/"
          className="mt-6 px-5 py-2.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] rounded-xl text-xs font-semibold border border-[#e2e8f0] hover:border-slate-400 transition"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  // Find all story, dialogue, memory, quote, reason keys (both Arrays and Objects)
  const storyKeys = Object.keys(config).filter(
    (k) =>
      typeof config[k] === 'object' &&
      config[k] !== null &&
      (k.toLowerCase().includes('dialogue') ||
        k.toLowerCase().includes('cast') ||
        k.toLowerCase().includes('quote') ||
        k.toLowerCase().includes('character') ||
        k.toLowerCase().includes('memor') ||
        k.toLowerCase().includes('story') ||
        k.toLowerCase().includes('moment') ||
        k.toLowerCase().includes('reason') ||
        k.toLowerCase().includes('coupon') ||
        k.toLowerCase().includes('caption') ||
        k.toLowerCase().includes('photo'))
  );
  const hasStories = storyKeys.length > 0;
  const isBasicTier =
    clientOrder?.packageTier?.toUpperCase() === 'BASIC' ||
    repo.toLowerCase().includes('basic') ||
    data?.configVarName === 'BASIC_CONFIG' ||
    config.backgroundColor !== undefined;


  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] text-[#0f172a] overflow-hidden">
      {/* Header Bar */}
      <header className="h-16 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-4">
          <Link
            href="/orders"
            className="p-2 rounded-full bg-white hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition border border-[#e2e8f0]"
            title="Kembali ke Daftar Pesanan"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-[#64748b] font-mono">@{owner}</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
            <span className="font-bold text-[#0f172a] max-w-[200px] truncate">{repo}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#0f172a] font-mono text-[10px] font-bold border border-[#e2e8f0]">
              GitHub Cloud
            </span>
          </div>
        </div>

        {/* Viewport switchers */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center bg-white rounded-full p-1 border border-[#e2e8f0]">
            <button
              onClick={() => setViewport('desktop')}
              className={`p-1.5 rounded-full text-xs transition ${
                viewport === 'desktop' ? 'bg-[#0f172a] text-white shadow-sm font-bold' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
              title="Desktop View"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewport('tablet')}
              className={`p-1.5 rounded-full text-xs transition ${
                viewport === 'tablet' ? 'bg-[#0f172a] text-white shadow-sm font-bold' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
              title="Tablet View (768px)"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewport('mobile')}
              className={`p-1.5 rounded-full text-xs transition ${
                viewport === 'mobile' ? 'bg-[#0f172a] text-white shadow-sm font-bold' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
              title="Mobile View (375px)"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <div className="hidden md:flex items-center bg-white rounded-full p-1 border border-[#e2e8f0] text-xs">
            <button
              onClick={() => setLayoutMode('editor')}
              className={`px-3 py-1 rounded-full transition font-semibold ${
                layoutMode === 'editor' ? 'bg-white text-black' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setLayoutMode('split')}
              className={`px-3 py-1 rounded-full transition font-semibold ${
                layoutMode === 'split' ? 'bg-white text-black' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setLayoutMode('preview')}
              className={`px-3 py-1 rounded-full transition font-semibold ${
                layoutMode === 'preview' ? 'bg-white text-black' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPreviewKey(Date.now())}
            title="Reload Preview Frame"
            className="p-2.5 rounded-full bg-white hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition border border-[#e2e8f0]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <a
            href={`https://github.com/${owner}/${repo}`}
            target="_blank"
            rel="noreferrer"
            title="Buka Repositori di GitHub"
            className="p-2.5 rounded-full bg-white hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition border border-[#e2e8f0]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          {/* Payment Status Pill if it's an Order */}
          {clientOrder && (
            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded-full border border-[#e2e8f0] text-xs font-semibold bg-white shadow-sm">
              <span className="text-[#64748b] text-[11px]">Pembayaran:</span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center space-x-1 ${
                  clientOrder.paymentStatus === 'PAID'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : clientOrder.paymentStatus === 'PARTIAL'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    clientOrder.paymentStatus === 'PAID'
                      ? 'bg-emerald-500'
                      : clientOrder.paymentStatus === 'PARTIAL'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
                <span>
                  {clientOrder.paymentStatus === 'PAID'
                    ? 'PAID (Lunas)'
                    : clientOrder.paymentStatus === 'PARTIAL'
                    ? 'PARTIAL (DP)'
                    : 'UNPAID (Belum Bayar)'}
                </span>
              </span>
            </div>
          )}

          {/* Save to GitHub */}
          <button
            onClick={handleSaveToGitHub}
            disabled={saving}
            className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition ${
              saveSuccess
                ? 'bg-[#0f172a] text-white font-bold'
                : 'bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] border border-[#e2e8f0]'
            }`}
          >
            {saving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Committing...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Committed!</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Commit to GitHub</span>
              </>
            )}
          </button>

          {/* Publish & Go Live Button with Payment Gate */}
          {(!repo.startsWith('order-') && !clientOrder) || clientOrder?.paymentStatus === 'PAID' ? (
            <button
              onClick={handlePublishAndGoLive}
              className="px-5 py-2 rounded-full text-xs font-bold flex items-center space-x-1.5 transition bg-[#0f172a] hover:bg-[#1e293b] text-white shadow-lg shadow-slate-900/10"
            >
              <Rocket className="h-3.5 w-3.5" />
              <span>Publish & Go Live</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                alert(
                  `Fitur 'Publish & Go Live' belum dapat digunakan karena status pembayaran pesanan ini adalah '${clientOrder?.paymentStatus || 'UNPAID'}'.\n\nUntuk menerbitkan website ke Vercel dan mengaktifkan link publik, status pembayaran pesanan harus 'PAID' (Lunas).\n\nAnda tetap dapat menyimpan perubahan kustomisasi template menggunakan tombol 'Commit to GitHub'.`
                );
              }}
              title={`Publish & Go Live terkunci. Status pembayaran: ${clientOrder?.paymentStatus || 'UNPAID'}. Ubah status menjadi PAID untuk menerbitkan website.`}
              className="px-4 py-2 rounded-full text-xs font-bold flex items-center space-x-1.5 transition bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] border border-[#e2e8f0] cursor-not-allowed group shadow-sm"
            >
              <Lock className="h-3.5 w-3.5 text-[#94a3b8] group-hover:text-[#0f172a] transition" />
              <span>Publish & Go Live</span>
              <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                {clientOrder?.paymentStatus || 'UNPAID'}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Editor Panel */}
        {(layoutMode === 'split' || layoutMode === 'editor') && (
          <div
            className={`flex flex-col bg-[#f8fafc] border-r border-[#e2e8f0] overflow-hidden ${
              layoutMode === 'editor' ? 'w-full' : 'w-full md:w-1/2 lg:w-[45%]'
            }`}
          >
            {/* Tabs Navigation */}
            <div className="flex items-center border-b border-[#e2e8f0] bg-white px-4 py-2.5 space-x-1.5 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'info'
                    ? 'bg-[#0f172a] text-white shadow-sm'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white/5'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Client & Event Info</span>
              </button>

              {hasStories && (
                <button
                  onClick={() => setActiveTab('quotes')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition flex items-center space-x-1.5 whitespace-nowrap ${
                    activeTab === 'quotes'
                      ? 'bg-[#0f172a] text-white shadow-sm'
                      : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white/5'
                  }`}
                >
                  <MessageSquareQuote className="h-3.5 w-3.5" />
                  <span>Quotes & Stories</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('photos')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'photos'
                    ? 'bg-[#0f172a] text-white shadow-sm'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white/5'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Photos & Scrapbook ({data?.photoSlots?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('music')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'music'
                    ? 'bg-[#0f172a] text-white shadow-sm'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white/5'
                }`}
              >
                <Music className="h-3.5 w-3.5" />
                <span>Background Music</span>
                {audioTrack?.src && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d4af37]" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('code')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'code'
                    ? 'bg-[#0f172a] text-white shadow-sm'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-white/5'
                }`}
              >
                <Code className="h-3.5 w-3.5" />
                <span>Raw Code</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: CLIENT & EVENT INFO */}
              {activeTab === 'info' && (
                <div className="space-y-6 max-w-xl">
                  {/* General Website Setup */}
                  <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0] space-y-4">
                    <h3 className="text-sm font-bold text-[#0f172a] flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-[#0f172a]" />
                      <span>General Website Setup</span>
                    </h3>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748b] mb-1.5">
                        Website Page Title (&lt;title&gt;)
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] transition"
                        placeholder="Contoh: Happy Birthday My Angel! ❤️"
                      />
                    </div>
                  </div>

                  {/* Basic Package Theme, Background, Text & Element Color Customization */}
                  {isBasicTier && (
                    <BackgroundColorPicker
                      value={config.backgroundColor || '#FAF6F2'}
                      textColor={config.textColor || '#331E23'}
                      elementColor={config.elementColor || '#FFFFFF'}
                      onChange={(newColor) =>
                        setConfig((prev) => ({ ...prev, backgroundColor: newColor }))
                      }
                      onThemeChange={({ backgroundColor, textColor, elementColor }) =>
                        setConfig((prev) => ({
                          ...prev,
                          backgroundColor,
                          textColor,
                          elementColor,
                        }))
                      }
                    />
                  )}

                  {/* Quick Audio Overview Card */}
                  <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0] space-y-3.5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Music className="h-4 w-4 text-[#0f172a]" />
                        <h3 className="text-sm font-bold text-[#0f172a]">Background Music</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('music')}
                        className="px-3 py-1 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] border border-[#e2e8f0] text-xs font-semibold flex items-center space-x-1 transition"
                      >
                        <span>Ganti Audio</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                      <div className="flex items-center space-x-3 truncate flex-1 min-w-0 mr-3">
                        <div className={`h-9 w-9 rounded-xl bg-[#f1f5f9] flex items-center justify-center shrink-0 border border-[#e2e8f0] text-[#0f172a] ${isPlayingAudio ? 'border-[#e2e8f0]' : ''}`}>
                          <Disc3 className={`h-4.5 w-4.5 ${isPlayingAudio ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-[#0f172a] truncate">
                            {audioTrack?.name || 'Default Audio / Belum Diatur'}
                          </p>
                          <p className="text-[10px] text-[#64748b] font-mono truncate">
                            {audioTrack?.src || 'assets/audio/bgm.mp3'}
                          </p>
                        </div>
                      </div>

                      {audioTrack?.src && (
                        <button
                          type="button"
                          onClick={togglePlayAudio}
                          className="px-3.5 py-1.5 rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold flex items-center space-x-1.5 shrink-0 shadow-sm"
                        >
                          {isPlayingAudio ? (
                            <>
                              <Pause className="h-3.5 w-3.5" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" />
                              <span>Play</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {data.config && (
                    <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0] space-y-4 shadow-xl">
                      <h3 className="text-sm font-bold text-[#0f172a] flex items-center space-x-2">
                        <UserCheck className="h-4 w-4 text-[#0f172a]" />
                        <span>Client Personalization Variables</span>
                      </h3>

                      <div className="space-y-4">
                        {Object.entries(config).map(([key, val]) => {
                          if (typeof val === 'object' && val !== null) return null;
                          if (key === 'backgroundColor' || key === 'textColor' || key === 'elementColor') return null;

                          let label = key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, (str) => str.toUpperCase());
                          if (key === 'girlfriendName' || key === 'recipientName')
                            label = "Recipient's Name (Penerima)";
                          else if (key === 'boyfriendName' || key === 'senderName')
                            label = "Partner / Sender's Name (Pengirim)";
                          else if (key === 'nickname') label = 'Special Nickname / Title';
                          else if (key === 'birthdayDate' || key === 'eventDate')
                            label = 'Event Date (Tanggal Perayaan)';
                          else if (key === 'loveLetter') label = 'Love Letter / Heartfelt Message';
                          else if (/^photoCaption(\d+)$/i.test(key)) {
                            const num = key.match(/\d+/)?.[0];
                            label = `Caption Foto #${num} (Galeri ${num})`;
                          } else if (/^caption(\d+)$/i.test(key)) {
                            const num = key.match(/\d+/)?.[0];
                            label = `Caption Foto #${num} (Galeri ${num})`;
                          }

                          if (key === 'loveLetter') {
                            return (
                              <div key={key}>
                                <label className="block text-xs font-semibold text-[#64748b] mb-1.5">
                                  {label}
                                </label>
                                <textarea
                                  rows={4}
                                  value={val ?? ''}
                                  onChange={(e) =>
                                    setConfig((prev) => ({ ...prev, [key]: e.target.value }))
                                  }
                                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-slate-900/20 leading-relaxed transition"
                                />
                              </div>
                            );
                          }

                          return (
                            <div key={key}>
                              <label className="block text-xs font-semibold text-[#64748b] mb-1.5">
                                {label}
                              </label>
                              <input
                                type="text"
                                value={val ?? ''}
                                onChange={(e) =>
                                  setConfig((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-slate-900/20 transition"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: QUOTES & PHOTO STORIES */}
              {activeTab === 'quotes' && hasStories && (
                <div className="space-y-6 max-w-xl">
                  {storyKeys.map((sKey) => {
                    const sData = config[sKey];
                    if (!sData) return null;

                    const formattedTitle = sKey
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (str) => str.toUpperCase());

                    return (
                      <div key={sKey} className="space-y-4">
                        <div className="border-b border-[#e2e8f0] pb-2">
                          <h3 className="text-sm font-bold text-[#0f172a] flex items-center space-x-2">
                            <Sparkles className="h-4 w-4 text-[#0f172a]" />
                            <span>{formattedTitle}</span>
                          </h3>
                          <p className="text-xs text-[#64748b] mt-0.5">
                            Kustomisasi teks cerita kenangan, kartu memori, dan kutipan interaktif di website.
                          </p>
                        </div>

                        {Array.isArray(sData) ? (
                          <div className="space-y-4">
                            {sData.map((item: any, index: number) => {
                              const isObject = typeof item === 'object' && item !== null;
                              const cardTitle = isObject
                                ? item.title || item.name || `Memory #${index + 1}`
                                : `Item #${index + 1}`;

                              return (
                                <div
                                  key={index}
                                  className="p-4 rounded-2xl bg-white border border-[#e2e8f0] space-y-3.5 shadow-xl"
                                >
                                  <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="px-2 py-0.5 rounded-lg bg-[#ecfdf5] text-[#0f172a] font-mono text-xs font-bold border border-[#e2e8f0]">
                                        #{String(index + 1).padStart(2, '0')}
                                      </span>
                                      <span className="font-bold text-xs text-[#0f172a]">
                                        {cardTitle}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-[#64748b] font-mono">
                                      Card {index + 1} / {sData.length}
                                    </span>
                                  </div>

                                  {isObject ? (
                                    <>
                                      {(item.title !== undefined || item.name !== undefined) && (
                                        <div>
                                          <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                                            Judul Kartu / Foto ({item.title !== undefined ? 'title' : 'name'})
                                          </label>
                                          <input
                                            type="text"
                                            value={item.title || item.name || ''}
                                            onChange={(e) => {
                                              const newArr = [...sData];
                                              const k = item.title !== undefined ? 'title' : 'name';
                                              newArr[index] = { ...item, [k]: e.target.value };
                                              setConfig((prev) => ({ ...prev, [sKey]: newArr }));
                                            }}
                                            className="w-full px-3.5 py-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-slate-900/20 transition"
                                            placeholder="Contoh: First Day, The Laugh, dll."
                                          />
                                        </div>
                                      )}

                                      <div>
                                        <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                                          Pesan / Cerita Kenangan (Story / Quote)
                                        </label>
                                        <textarea
                                          rows={3}
                                          value={item.quote || item.text || item.description || ''}
                                          onChange={(e) => {
                                            const newArr = [...sData];
                                            const k = item.quote !== undefined
                                              ? 'quote'
                                              : item.text !== undefined
                                              ? 'text'
                                              : 'description';
                                            newArr[index] = { ...item, [k]: e.target.value };
                                            setConfig((prev) => ({ ...prev, [sKey]: newArr }));
                                          }}
                                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-slate-900/20 leading-relaxed transition"
                                          placeholder="Tulis pesan atau cerita saat foto ini diklik..."
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <div>
                                      <textarea
                                        rows={2}
                                        value={String(item)}
                                        onChange={(e) => {
                                          const newArr = [...sData];
                                          newArr[index] = e.target.value;
                                          setConfig((prev) => ({ ...prev, [sKey]: newArr }));
                                        }}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-slate-900/20 leading-relaxed transition"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {Object.entries(sData).map(([charKey, charVal]: [string, any]) => (
                              <div
                                key={charKey}
                                className="p-4 rounded-2xl bg-white border border-[#e2e8f0] space-y-3.5 shadow-xl"
                              >
                                <div className="flex items-center space-x-2">
                                  {charVal.emoji && <span className="text-lg">{charVal.emoji}</span>}
                                  <input
                                    type="text"
                                    value={charVal.name || charKey}
                                    onChange={(e) => {
                                      const newObj = {
                                        ...sData,
                                        [charKey]: { ...charVal, name: e.target.value },
                                      };
                                      setConfig((prev) => ({ ...prev, [sKey]: newObj }));
                                    }}
                                    className="font-bold text-xs text-[#0f172a] bg-transparent border-b border-[#e2e8f0] focus:border-[#0f172a] focus:outline-none px-1 py-0.5 transition"
                                  />
                                  {charVal.role && (
                                    <span className="text-[10px] text-[#64748b] font-mono">
                                      • {charVal.role}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <label className="block text-[11px] text-[#64748b] mb-1">Quote Message</label>
                                  <textarea
                                    rows={3}
                                    value={charVal.quote || ''}
                                    onChange={(e) => {
                                      const newObj = {
                                        ...sData,
                                        [charKey]: { ...charVal, quote: e.target.value },
                                      };
                                      setConfig((prev) => ({ ...prev, [sKey]: newObj }));
                                    }}
                                    className="w-full px-3 py-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-slate-900/20 leading-relaxed transition"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: PHOTOS */}
              {activeTab === 'photos' && (
                <div className="space-y-6">
                  {/* Real-time Upload Progress Card */}
                  {uploadProgress.active && (
                    <div className="bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div
                            className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                              uploadProgress.status === 'success'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : uploadProgress.status === 'error'
                                ? 'bg-red-500/15 text-red-400'
                                : 'bg-[#ecfdf5] text-[#0f172a]'
                            }`}
                          >
                            {uploadProgress.status === 'success' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : uploadProgress.status === 'error' ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-xs font-bold text-[#0f172a] truncate">
                                {uploadProgress.fileName}
                              </h4>
                              {uploadProgress.fileSize && (
                                <span className="text-[10px] text-[#64748b] font-mono">
                                  ({uploadProgress.fileSize})
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#64748b] truncate mt-0.5">
                              {uploadProgress.statusText}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-3">
                          <span
                            className={`text-xs font-mono font-bold ${
                              uploadProgress.status === 'success'
                                ? 'text-emerald-400'
                                : uploadProgress.status === 'error'
                                ? 'text-red-400'
                                : 'text-[#0f172a]'
                            }`}
                          >
                            {uploadProgress.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="w-full h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ease-out ${
                            uploadProgress.status === 'success'
                              ? 'bg-emerald-500'
                              : uploadProgress.status === 'error'
                              ? 'bg-red-500'
                              : 'bg-gradient-to-r from-[#d4af37] to-[#f3d987]'
                          }`}
                          style={{ width: `${uploadProgress.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Upload Box */}
                  <div className="bg-white p-5 rounded-2xl border border-dashed border-[#e2e8f0] hover:border-[#e2e8f0] transition text-center shadow-xl">
                    <Upload className="h-8 w-8 text-[#0f172a] mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-[#0f172a]">Upload Foto Baru ke GitHub</h4>
                    <p className="text-[11px] text-[#64748b] mt-0.5">
                      Foto otomatis di-commit ke folder <code>assets/images/</code> di repo @{owner}/{repo}
                    </p>
                    <label className="mt-3 inline-block px-4 py-2 rounded-xl bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] text-xs font-semibold cursor-pointer border border-[#e2e8f0] hover:border-slate-400 transition">
                      Pilih Foto Klien
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Detected Photo Slots */}
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a] mb-3">
                      Slot Foto Polaroid & Kenangan yang Terdeteksi
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                      {data.photoSlots.map((slot, slotIndex) => {
                        const staged = photoUpdates.find((u) => u.slotId === slot.id);
                        const effectiveSrc = staged ? staged.newSrc : slot.src;
                        const isUploadingThisSlot = uploadProgress.active && uploadProgress.slotId === slot.id;

                        let previewImgUrl = effectiveSrc;
                        if (effectiveSrc && !effectiveSrc.startsWith('http')) {
                          previewImgUrl = `/api/github/preview/${owner}/${repo}/${effectiveSrc.replace(
                            /^\//,
                            ''
                          )}`;
                        }

                        return (
                          <div
                            key={slot.id}
                            className={`p-4 rounded-2xl bg-white border transition flex flex-col gap-3 shadow-xl ${
                              isUploadingThisSlot ? 'border-[#d4af37] bg-[#141419]' : 'border-[#e2e8f0]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <div className="h-16 w-16 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] overflow-hidden flex items-center justify-center shrink-0">
                                  {effectiveSrc ? (
                                    <img
                                      src={previewImgUrl}
                                      alt={slot.alt}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="h-6 w-6 text-[#64748b]" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-[#0f172a] truncate">{slot.label}</h4>
                                  <p className="text-[11px] text-[#64748b] font-mono truncate mt-0.5">
                                    {effectiveSrc || '(Empty Placeholder)'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2 shrink-0">
                                {isUploadingThisSlot ? (
                                  <div className="px-3 py-1.5 rounded-xl bg-[#ecfdf5] border border-[#e2e8f0] text-[#0f172a] text-xs font-mono font-semibold flex items-center space-x-1.5">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    <span>{uploadProgress.percentage}%</span>
                                  </div>
                                ) : (
                                  <label className="p-2 rounded-xl bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] transition cursor-pointer text-xs flex items-center space-x-1 border border-[#e2e8f0]">
                                    <Upload className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Upload</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          handleFileUpload(e.target.files[0], slot.id);
                                        }
                                      }}
                                    />
                                  </label>
                                )}

                                {data.images.length > 0 && (
                                  <select
                                    value={effectiveSrc}
                                    onChange={(e) => handleAssignPhotoToSlot(slot.id, e.target.value)}
                                    className="px-2.5 py-1.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] max-w-[140px]"
                                  >
                                    <option value="">Pilih Aset...</option>
                                    {data.images.map((img) => (
                                      <option key={img.path} value={img.path}>
                                        {img.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>

                            {/* Slot-specific Photo Caption Input */}
                            {(() => {
                              const capKey = config[`photoCaption${slotIndex}`] !== undefined
                                ? `photoCaption${slotIndex}`
                                : config[`caption${slotIndex}`] !== undefined
                                ? `caption${slotIndex}`
                                : slotIndex > 0
                                ? `photoCaption${slotIndex}`
                                : null;

                              if (!capKey) return null;
                              const currentCap = config[capKey] ?? '';

                              return (
                                <div className="pt-2.5 border-t border-[#18181c] flex items-center gap-2.5">
                                  <span className="text-[11px] font-semibold text-[#64748b] shrink-0">
                                    Caption Teks:
                                  </span>
                                  <input
                                    type="text"
                                    value={currentCap}
                                    onChange={(e) =>
                                      setConfig((prev) => ({ ...prev, [capKey]: e.target.value }))
                                    }
                                    placeholder="Tulis caption untuk foto ini (misal: Setiap detik bersamamu selalu istimewa ✨)..."
                                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-slate-900/20 transition placeholder-[#8e8a80]/40"
                                  />
                                </div>
                              );
                            })()}

                            {/* Slot-specific mini progress bar */}
                            {isUploadingThisSlot && (
                              <div className="w-full bg-[#f1f5f9] h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#f3d987] transition-all duration-200"
                                  style={{ width: `${uploadProgress.percentage}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: BACKGROUND MUSIC & AUDIO */}
              {activeTab === 'music' && (
                <div className="space-y-6 max-w-xl">
                  {/* Hidden Audio Element for In-Studio Preview */}
                  <audio
                    ref={audioPlayerRef}
                    src={getAudioUrl(audioTrack?.src)}
                    onPlay={() => setIsPlayingAudio(true)}
                    onPause={() => setIsPlayingAudio(false)}
                    onEnded={() => setIsPlayingAudio(false)}
                    preload="none"
                  />

                  {/* Header Title */}
                  <div className="border-b border-[#e2e8f0] pb-3">
                    <h3 className="text-sm font-bold text-[#0f172a] flex items-center space-x-2">
                      <Music className="h-4 w-4 text-[#0f172a]" />
                      <span>Background Music & Audio</span>
                    </h3>
                    <p className="text-xs text-[#64748b] mt-1">
                      Kustomisasi musik latar website sesuai dengan lagu romantis atau pilihan klien.
                    </p>
                  </div>

                  {/* 1. CURRENT ACTIVE AUDIO PLAYER */}
                  <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] space-y-4 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                      <span className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">
                        Musik Aktif Saat Ini
                      </span>
                      {audioTrack?.src ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#0f172a] border border-[#e2e8f0] text-[10px] font-bold">
                          <span className={`h-1.5 w-1.5 rounded-full bg-[#d4af37] ${isPlayingAudio ? 'animate-pulse' : ''}`} />
                          <span>{isPlayingAudio ? 'PLAYING NOW' : 'ACTIVE IN SITE'}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#64748b] font-mono">Belum Diatur</span>
                      )}
                    </div>

                    {(() => {
                      const activeYtId = getYouTubeId(audioTrack?.src || '');
                      if (activeYtId) {
                        return (
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                                <div className="h-14 w-20 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] overflow-hidden shrink-0 relative group">
                                  <img
                                    src={`https://img.youtube.com/vi/${activeYtId}/mqdefault.jpg`}
                                    alt="YouTube Thumbnail"
                                    className="h-full w-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <YouTubeIcon className="h-5 w-5 text-red-500" />
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold font-mono">
                                      YOUTUBE BGM
                                    </span>
                                    <span className="text-xs font-bold text-[#0f172a] truncate">
                                      ID: {activeYtId}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#0f172a] font-mono truncate mt-1">
                                    {audioTrack?.src}
                                  </p>
                                </div>
                              </div>

                              <a
                                href={`https://www.youtube.com/watch?v=${activeYtId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 rounded-xl bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] text-xs font-semibold transition flex items-center justify-center space-x-1.5 border border-[#e2e8f0] shrink-0"
                              >
                                <span>Buka Video</span>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>

                            <p className="text-[11px] text-[#64748b] bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0] leading-relaxed">
                              ✨ <strong className="text-[#0f172a]">Engine YouTube Aktif:</strong> Musik latar diputar otomatis secara mulus oleh sistem hidden proxy saat pengunjung menekan tombol interaksi di website.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                            <div className={`h-14 w-14 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center shrink-0 ${isPlayingAudio ? 'border-[#e2e8f0] shadow-lg shadow-[#d4af37]/10' : ''}`}>
                              <Disc3 className={`h-7 w-7 text-[#0f172a] ${isPlayingAudio ? 'animate-spin' : ''}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-[#0f172a] truncate">
                                {audioTrack?.name || 'Belum Ada Audio'}
                              </h4>
                              <p className="text-xs text-[#0f172a] font-mono truncate mt-0.5">
                                {audioTrack?.src || 'assets/audio/bgm.mp3'}
                              </p>
                              <p className="text-[10px] text-[#64748b] mt-1">
                                Format didukung: MP3, M4A, WAV, OGG, AAC
                              </p>
                            </div>
                          </div>

                          {audioTrack?.src && (
                            <button
                              type="button"
                              onClick={togglePlayAudio}
                              className="px-5 py-2.5 rounded-full bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold transition flex items-center justify-center space-x-2 shrink-0 shadow-lg shadow-slate-900/10"
                            >
                              {isPlayingAudio ? (
                                <>
                                  <Pause className="h-4 w-4" />
                                  <span>Pause Lagu</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4" />
                                  <span>Dengarkan Preview</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 2. PASTE LINK YOUTUBE / YOUTUBE MUSIC */}
                  <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                      <div className="flex items-center space-x-2 text-[#0f172a]">
                        <YouTubeIcon className="h-4 w-4 text-red-500" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
                          Gunakan Link YouTube / YouTube Music
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold">
                        Paling Praktis
                      </span>
                    </div>

                    <p className="text-xs text-[#64748b]">
                      Cukup copy &amp; paste link lagu dari YouTube atau YouTube Music. Pengunjung website akan mendengar musiknya tanpa gangguan iklan atau popup video.
                    </p>

                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={youtubeInputUrl}
                          onChange={(e) => setYoutubeInputUrl(e.target.value)}
                          placeholder="Contoh: https://www.youtube.com/watch?v=... atau https://music.youtube.com/..."
                          className="w-full pl-3.5 pr-20 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#0f172a] placeholder-[#8e8a80] focus:outline-none focus:border-[#0f172a] font-mono transition"
                        />
                        {youtubeInputUrl && (
                          <button
                            type="button"
                            onClick={() => setYoutubeInputUrl('')}
                            className="absolute right-3 top-2.5 text-xs text-[#64748b] hover:text-[#0f172a]"
                          >
                            Hapus
                          </button>
                        )}
                      </div>

                      {/* YouTube Track Detected Card */}
                      {youtubePreview && (
                        <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-3 animate-in fade-in duration-300">
                          <div className="flex items-start space-x-3.5">
                            <div className="h-16 w-24 rounded-lg overflow-hidden bg-[#f8fafc] shrink-0 relative border border-[#e2e8f0]">
                              <img
                                src={youtubePreview.thumbnail}
                                alt="Thumbnail"
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <YouTubeIcon className="h-6 w-6 text-red-500" />
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#ecfdf5] text-[#0f172a] border border-[#e2e8f0] text-[10px] font-bold">
                                <span>Lagu YouTube Terdeteksi</span>
                              </span>
                              <h5 className="text-xs font-bold text-[#0f172a] truncate mt-1">
                                {loadingYouTubeMeta
                                  ? 'Mengambil judul video...'
                                  : youtubePreview.title || `YouTube Video (${youtubePreview.id})`}
                              </h5>
                              {youtubePreview.author && (
                                <p className="text-[11px] text-[#64748b] truncate">
                                  {youtubePreview.author}
                                </p>
                              )}
                              <p className="text-[10px] text-[#64748b] font-mono mt-0.5">
                                Video ID: {youtubePreview.id}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-[#e2e8f0]">
                            <a
                              href={`https://www.youtube.com/watch?v=${youtubePreview.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#64748b] hover:text-[#0f172a] flex items-center space-x-1"
                            >
                              <span>Cek di YouTube</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>

                            <button
                              type="button"
                              onClick={() => handleAssignAudio(youtubeInputUrl)}
                              disabled={saving || audioTrack?.src === youtubeInputUrl}
                              className="px-4 py-2 rounded-xl bg-[#0f172a] text-white text-xs font-bold hover:brightness-110 disabled:opacity-40 transition shadow-md shadow-slate-900/10 flex items-center space-x-1.5"
                            >
                              {saving ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span>Menerapkan...</span>
                                </>
                              ) : audioTrack?.src === youtubeInputUrl ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Sedang Digunakan</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>Terapkan Lagu YouTube Ini</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. UPLOAD NEW AUDIO FILE */}
                  <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] space-y-4 shadow-xl">
                    <div className="flex items-center space-x-2 text-[#0f172a]">
                      <Upload className="h-4 w-4 text-[#0f172a]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
                        Unggah File Audio Baru
                      </h4>
                    </div>

                    <div className="border-2 border-dashed border-[#e2e8f0] hover:border-[#e2e8f0] rounded-2xl p-6 text-center transition bg-[#f8fafc] relative group">
                      <div className="h-12 w-12 rounded-2xl bg-white border border-[#e2e8f0] flex items-center justify-center mx-auto mb-3 text-[#0f172a] group-hover:scale-110 transition duration-300">
                        <Music className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-bold text-[#0f172a]">
                        Klik atau Tarik File Audio ke Sini
                      </p>
                      <p className="text-[11px] text-[#64748b] mt-1">
                        MP3, M4A, WAV, OGG, atau AAC (Maksimal 25MB)
                      </p>

                      <input
                        type="file"
                        accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac"
                        disabled={audioUploadProgress.active}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleAudioUpload(e.target.files[0]);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Audio Upload Progress Indicator */}
                    {audioUploadProgress.active && (
                      <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2 truncate">
                            <RefreshCw className={`h-3.5 w-3.5 text-[#0f172a] ${audioUploadProgress.status === 'success' ? '' : 'animate-spin'}`} />
                            <span className="font-semibold text-[#0f172a] truncate">
                              {audioUploadProgress.fileName}
                            </span>
                            <span className="text-[10px] text-[#64748b] font-mono">
                              ({audioUploadProgress.fileSize})
                            </span>
                          </div>
                          <span className="font-mono font-bold text-[#0f172a]">
                            {audioUploadProgress.percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-[#f1f5f9] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#f3d987] transition-all duration-300"
                            style={{ width: `${audioUploadProgress.percentage}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[#64748b] font-medium">
                          {audioUploadProgress.statusText}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 4. PRESETS IN REPOSITORY */}
                  {data?.audioFiles && data.audioFiles.length > 0 && (
                    <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] space-y-3.5 shadow-xl">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
                          Preset Audio di Repository ({data.audioFiles.length})
                        </h4>
                        <span className="text-[10px] text-[#64748b] font-mono">assets/audio/</span>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {data.audioFiles.map((audio) => {
                          const isCurrent = audioTrack?.src === audio.path || audioTrack?.name === audio.name;
                          return (
                            <div
                              key={audio.path}
                              className={`p-3 rounded-xl border flex items-center justify-between transition ${
                                isCurrent
                                  ? 'bg-[#f8fafc] border-[#e2e8f0]'
                                  : 'bg-[#f8fafc] border-[#e2e8f0] hover:border-[#e2e8f0]/80'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                                <Music className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-[#0f172a]' : 'text-[#64748b]'}`} />
                                <div className="truncate">
                                  <p className={`text-xs font-bold truncate text-[#0f172a]`}>
                                    {audio.name}
                                  </p>
                                  <p className="text-[10px] text-[#64748b] font-mono">
                                    {(audio.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2 shrink-0">
                                {isCurrent ? (
                                  <span className="px-2.5 py-1 rounded-full bg-[#f1f5f9] text-[#0f172a] border border-[#e2e8f0] text-[10px] font-bold">
                                    Sedang Digunakan
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAssignAudio(audio.path)}
                                    disabled={saving}
                                    className="px-3 py-1 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] text-[11px] font-semibold transition border border-[#e2e8f0] hover:border-slate-400"
                                  >
                                    Pilih Lagu
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 5. DIRECT AUDIO URL / STREAMING */}
                  <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] space-y-3.5 shadow-xl">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
                      Pilihan Alternatif: Input URL Audio Langsung
                    </h4>
                    <p className="text-[11px] text-[#64748b]">
                      Gunakan jika klien memiliki link hosting audio langsung (CDN / Cloudinary / hosting sendiri).
                    </p>

                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={audioInputUrl}
                        onChange={(e) => setAudioInputUrl(e.target.value)}
                        placeholder="Contoh: https://.../audio.mp3 atau assets/audio/lagu.mp3"
                        className="flex-1 px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#0f172a] placeholder-[#8e8a80] focus:outline-none focus:border-[#0f172a] font-mono transition"
                      />
                      <button
                        type="button"
                        onClick={() => handleAssignAudio(audioInputUrl)}
                        disabled={saving || !audioInputUrl.trim() || audioInputUrl === audioTrack?.src}
                        className="px-4 py-2.5 rounded-xl bg-[#0f172a] text-white text-xs font-bold transition hover:brightness-110 disabled:opacity-40 shrink-0 shadow-md shadow-slate-900/10"
                      >
                        Terapkan
                      </button>
                    </div>
                  </div>

                  {/* 6. NOTES & BEST PRACTICES */}
                  <div className="p-4 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#64748b] space-y-1.5 shadow-xl">
                    <div className="flex items-center space-x-1.5 text-[#0f172a] font-semibold text-[11px]">
                      <Sparkles className="h-3.5 w-3.5 text-[#0f172a]" />
                      <span>Catatan Autoplay Browser:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Sebagian besar browser modern (Chrome, Safari, iOS/Android) memblokir suara sebelum ada interaksi klik dari pengunjung. Template MEMOu telah dilengkapi tombol interaksi awal (seperti <em>&quot;ENTER OUR STORY&quot;</em> atau <em>&quot;UNWRAP SURPRISE&quot;</em>) sehingga musik akan berputar otomatis secara mulus setelah tombol tersebut ditekan.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 5: RAW CODE */}
              {activeTab === 'code' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b border-[#e2e8f0] pb-2">
                    {(['script.js', 'index.html', 'style.css'] as const).map((fileName) => (
                      <button
                        key={fileName}
                        onClick={() => setActiveCodeFile(fileName)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition ${
                          activeCodeFile === fileName
                            ? 'bg-[#0f172a] text-white font-bold shadow-md shadow-slate-900/10'
                            : 'bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] border border-[#e2e8f0]'
                        }`}
                      >
                        {fileName}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={rawFiles[activeCodeFile]}
                    onChange={(e) =>
                      setRawFiles((prev) => ({ ...prev, [activeCodeFile]: e.target.value }))
                    }
                    className="w-full h-[550px] p-4 font-mono text-xs bg-[#f8fafc] text-[#0f172a] border border-[#e2e8f0] rounded-2xl focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-slate-900/20 leading-relaxed transition"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right: Live Interactive Preview Panel */}
        {(layoutMode === 'split' || layoutMode === 'preview') && (
          <div
            className={`flex-1 bg-[#f8fafc] flex flex-col items-center justify-center p-4 overflow-hidden relative ${
              layoutMode === 'preview' ? 'w-full' : ''
            }`}
          >
            <div
              className={`h-full transition-all duration-300 flex flex-col items-center justify-center ${
                viewport === 'mobile'
                  ? 'w-[375px] max-w-full'
                  : viewport === 'tablet'
                  ? 'w-[768px] max-w-full'
                  : 'w-full'
              }`}
            >
              <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-[#e2e8f0] bg-[#f8fafc] flex flex-col relative">
                <div className="h-7 bg-white border-b border-[#e2e8f0] px-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#d4af37]/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#c58f37]/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#f3d987]/60" />
                  </div>
                  <div className="flex items-center space-x-2 truncate px-2">
                    <span className="text-[10px] text-[#64748b] font-mono truncate">
                      GitHub Cloud Preview: @{owner}/{repo}
                    </span>
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#0f172a] border border-[#e2e8f0] text-[9px] font-mono font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#d4af37] animate-pulse" />
                      <span>REAL-TIME</span>
                    </span>
                  </div>
                  <div className="text-[10px] text-[#64748b] font-medium font-mono">
                    {viewport.toUpperCase()}
                  </div>
                </div>

                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  src={`/api/github/preview/${owner}/${repo}/index.html`}
                  className="w-full flex-1 border-0 bg-white"
                  title="Live Template Preview"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-modals allow-forms allow-presentation"
                  allow="autoplay; encrypted-media; fullscreen"
                  onLoad={() => {
                    setTimeout(syncLivePreview, 150);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Publish & Go Live Modal */}
      {publishModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-[#e2e8f0] rounded-3xl max-w-lg w-full p-8 shadow-2xl text-center space-y-6">
            {publishModal.publishing ? (
              <div className="py-8 space-y-4">
                <RefreshCw className="h-12 w-12 text-[#0f172a] animate-spin mx-auto" />
                <h3 className="text-lg font-bold text-[#0f172a]">Menerbitkan Website ke Vercel...</h3>
                <p className="text-xs text-[#64748b] max-w-sm mx-auto">
                  Sistem sedang menghubungkan repositori ke jaringan cloud Vercel global.
                </p>
              </div>
            ) : publishModal.liveUrl ? (
              <div className="space-y-6 py-2">
                <div className="h-16 w-16 bg-[#ecfdf5] text-[#0f172a] rounded-full flex items-center justify-center mx-auto border border-[#e2e8f0]">
                  <CheckCircle2 className="h-8 w-8 text-[#0f172a]" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[#0f172a] tracking-tight">Website Berhasil Go Live! 🎉</h3>
                  <p className="text-xs text-[#64748b] mt-1">
                    Website hadiah klien sudah aktif dan bisa diakses dari mana saja.
                  </p>
                </div>

                {/* Live URL Display Box */}
                <div className="p-4 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-[#64748b] block tracking-wider">
                      Link Publik Klien
                    </span>
                    <a
                      href={publishModal.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-mono font-bold text-[#0f172a] hover:underline truncate block mt-0.5"
                    >
                      {publishModal.liveUrl}
                    </a>
                  </div>

                  <button
                    onClick={() => copyToClipboard(publishModal.liveUrl!)}
                    className="p-3 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white transition shrink-0 shadow-lg shadow-slate-900/10 flex items-center space-x-1.5 text-xs font-semibold"
                  >
                    {publishModal.copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Salin Link</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-center space-x-3 pt-2">
                  <button
                    onClick={() => setPublishModal((prev) => ({ ...prev, open: false }))}
                    className="px-5 py-2.5 rounded-xl bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] text-xs font-medium border border-[#e2e8f0] transition"
                  >
                    Tutup
                  </button>
                  <a
                    href={publishModal.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-slate-900/10"
                  >
                    <span>Buka Website</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
