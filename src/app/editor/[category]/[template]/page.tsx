'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Download,
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
  FolderPlus,
  CheckCircle2
} from 'lucide-react';
import { PhotoSlot } from '@/lib/templateParser';
import BackgroundColorPicker from '@/components/BackgroundColorPicker';

interface TemplateDetail {
  category: string;
  name: string;
  title: string;
  config: Record<string, any> | null;
  configVarName: string | null;
  photoSlots: PhotoSlot[];
  availableImages: { name: string; path: string; url: string; size: number }[];
  rawFiles: {
    'index.html': string;
    'script.js': string;
    'style.css': string;
  };
}

export default function TemplateEditorPage({
  params,
}: {
  params: { category: string; template: string };
}) {
  const { category, template } = params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [data, setData] = useState<TemplateDetail | null>(null);

  // Active Tab: 'info' | 'quotes' | 'photos' | 'code'
  const [activeTab, setActiveTab] = useState<'info' | 'quotes' | 'photos' | 'code'>('info');

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

  // Clone Client Order Modal
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [clientOrderName, setClientOrderName] = useState('');
  const [cloning, setCloning] = useState(false);

  const handleCloneClientOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientOrderName.trim()) return;

    setCloning(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          template,
          action: 'clone',
          clientName: clientOrderName.trim(),
        }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setCloneModalOpen(false);
        window.location.href = resJson.redirectUrl;
      } else {
        alert(resJson.error || 'Failed to create client order');
      }
    } catch {
      alert('Error creating client order');
    } finally {
      setCloning(false);
    }
  };

  // Load Template Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/template/${category}/${template}`);
      const json = await res.json();
      if (json.success && json.details) {
        setData(json.details);
        setTitle(json.details.title || '');
        setConfig(json.details.config || {});
        setRawFiles(json.details.rawFiles);
      }
    } catch (err) {
      console.error('Failed to load template details:', err);
    } finally {
      setLoading(false);
    }
  }, [category, template]);

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
  }, [config, title, photoUpdates, data?.configVarName, activeTab, rawFiles]);

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


  // Handle Save
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload: any = {
        title,
        photoUpdates,
      };

      if (activeTab === 'code') {
        payload.rawFiles = rawFiles;
      } else {
        if (data?.configVarName) {
          payload.config = config;
          payload.configVarName = data.configVarName;
        }
      }

      const res = await fetch(`/api/template/${category}/${template}`, {
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
        alert(json.error || 'Failed to save changes');
      }
    } catch (err) {
      alert('Error saving template');
    } finally {
      setSaving(false);
    }
  };

  // Handle ZIP Download
  const handleDownloadZip = async () => {
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          template,
          action: 'zip',
        }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template}_export.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert('Failed to download ZIP');
    }
  };

  // Handle Direct Photo Upload with Real-Time Progress Tracking
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
      percentage: 10,
      status: 'uploading',
      statusText: 'Uploading photo file...',
    });

    const formData = new FormData();
    formData.append('category', category);
    formData.append('template', template);
    formData.append('file', file);
    if (targetSlotId) {
      formData.append('slotId', targetSlotId);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(85, Math.max(10, Math.round((event.loaded / event.total) * 85)));
        setUploadProgress((prev) => ({
          ...prev,
          percentage: percent,
          status: 'uploading',
          statusText: `Uploading file... ${percent}%`,
        }));
      }
    };

    xhr.upload.onload = () => {
      setUploadProgress((prev) => ({
        ...prev,
        percentage: 92,
        status: 'processing',
        statusText: 'Saving to template assets...',
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
              statusText: 'Photo uploaded successfully!',
            }));
            setPreviewKey(Date.now());
            setTimeout(() => {
              setUploadProgress((prev) => ({ ...prev, active: false }));
            }, 2500);
            return;
          } else {
            throw new Error(json.error || 'Photo upload failed');
          }
        } catch (err: any) {
          setUploadProgress((prev) => ({
            ...prev,
            percentage: 100,
            status: 'error',
            statusText: err.message || 'Upload processing error',
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
        statusText: 'Network connection lost during upload',
      }));
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, active: false }));
      }, 3500);
    };

    xhr.send(formData);
  };

  // Assign existing asset to a slot
  const handleAssignPhotoToSlot = (slotId: string, assetPath: string) => {
    setPhotoUpdates((prev) => {
      const filtered = prev.filter((p) => p.slotId !== slotId);
      return [...filtered, { slotId, newSrc: assetPath }];
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-[#64748b]">
        <div className="flex items-center space-x-3">
          <RefreshCw className="h-6 w-6 animate-spin text-[#0f172a]" />
          <span className="font-medium text-sm text-[#0f172a]">Loading Template Studio...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-[#0f172a] p-6">
        <AlertCircle className="h-12 w-12 text-[#0f172a] mb-3" />
        <h2 className="text-xl font-bold">Template Not Found</h2>
        <p className="text-sm text-[#64748b] mt-1">
          Could not find template at {category}/{template}
        </p>
        <Link
          href="/"
          className="mt-6 px-5 py-2.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] rounded-xl text-xs font-semibold border border-[#e2e8f0] hover:border-slate-400 transition"
        >
          Return to Dashboard
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
        k.toLowerCase().includes('coupon'))
  );
  const hasStories = storyKeys.length > 0;
  const isBasicTier =
    category?.toLowerCase().includes('basic') ||
    template?.toLowerCase().includes('basic') ||
    data?.configVarName === 'BASIC_CONFIG' ||
    config.backgroundColor !== undefined;


  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] text-[#0f172a] overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-2 rounded-xl bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] border border-[#e2e8f0] transition"
            title="Back to Templates"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Breadcrumbs */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400">{category}</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <span className="font-bold text-[#0f172a] max-w-[200px] truncate">
              {data.title || template}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-mono text-[10px] border border-rose-500/20">
              {template}
            </span>
          </div>
        </div>

        {/* Center: Viewport & Layout Switchers */}
        <div className="flex items-center space-x-3">
          {/* Viewport switcher */}
          <div className="hidden sm:flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
            <button
              onClick={() => setViewport('desktop')}
              className={`p-1.5 rounded-lg text-xs transition ${
                viewport === 'desktop'
                  ? 'bg-rose-600 text-[#0f172a] shadow'
                  : 'text-slate-400 hover:text-[#0f172a]'
              }`}
              title="Desktop View"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewport('tablet')}
              className={`p-1.5 rounded-lg text-xs transition ${
                viewport === 'tablet'
                  ? 'bg-rose-600 text-[#0f172a] shadow'
                  : 'text-slate-400 hover:text-[#0f172a]'
              }`}
              title="Tablet View (768px)"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewport('mobile')}
              className={`p-1.5 rounded-lg text-xs transition ${
                viewport === 'mobile'
                  ? 'bg-rose-600 text-[#0f172a] shadow'
                  : 'text-slate-400 hover:text-[#0f172a]'
              }`}
              title="Mobile View (375px)"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          {/* Layout Mode (Split / Editor / Preview) */}
          <div className="hidden md:flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setLayoutMode('editor')}
              className={`px-2.5 py-1 rounded-lg transition ${
                layoutMode === 'editor'
                  ? 'bg-slate-700 text-[#0f172a] font-medium'
                  : 'text-slate-400 hover:text-[#0f172a]'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setLayoutMode('split')}
              className={`px-2.5 py-1 rounded-lg transition ${
                layoutMode === 'split'
                  ? 'bg-slate-700 text-[#0f172a] font-medium'
                  : 'text-slate-400 hover:text-[#0f172a]'
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setLayoutMode('preview')}
              className={`px-2.5 py-1 rounded-lg transition ${
                layoutMode === 'preview'
                  ? 'bg-slate-700 text-[#0f172a] font-medium'
                  : 'text-slate-400 hover:text-[#0f172a]'
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPreviewKey(Date.now())}
            title="Reload Preview Frame"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[#0f172a] transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <a
            href={`/api/preview/${category}/${template}`}
            target="_blank"
            rel="noreferrer"
            title="Open Live Preview in New Tab"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[#0f172a] transition"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          <button
            onClick={() => setCloneModalOpen(true)}
            title="Duplicate as New Client Order"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[#0f172a] transition"
          >
            <Copy className="h-4 w-4" />
          </button>

          <button
            onClick={handleDownloadZip}
            title="Export Website ZIP"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[#0f172a] transition"
          >
            <Download className="h-4 w-4" />
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg ${
              saveSuccess
                ? 'bg-emerald-600 text-[#0f172a]'
                : 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-[#0f172a] shadow-rose-600/20'
            }`}
          >
            {saving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Saved Live!</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Editor Panel */}
        {(layoutMode === 'split' || layoutMode === 'editor') && (
          <div
            className={`flex flex-col bg-[#0b101f] border-r border-slate-800 overflow-hidden ${
              layoutMode === 'editor' ? 'w-full' : 'w-full md:w-1/2 lg:w-[45%]'
            }`}
          >
            {/* Editor Tabs Navigation */}
            <div className="flex items-center border-b border-slate-800 bg-[#0e1529] px-4 space-x-1 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab('info')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'info'
                    ? 'border-rose-500 text-[#0f172a]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Client & Event Info</span>
              </button>

              {hasStories && (
                <button
                  onClick={() => setActiveTab('quotes')}
                  className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
                    activeTab === 'quotes'
                      ? 'border-rose-500 text-[#0f172a]'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquareQuote className="h-3.5 w-3.5" />
                  <span>Quotes & Photo Stories</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('photos')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'photos'
                    ? 'border-rose-500 text-[#0f172a]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Photos & Scrapbook ({data.photoSlots.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('code')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'code'
                    ? 'border-rose-500 text-[#0f172a]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code className="h-3.5 w-3.5" />
                <span>Raw Code</span>
              </button>
            </div>

            {/* Tab Contents Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: CLIENT & EVENT INFO */}
              {activeTab === 'info' && (
                <div className="space-y-6 max-w-xl">
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <h3 className="text-sm font-bold text-[#0f172a] flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-rose-400" />
                      <span>General Website Setup</span>
                    </h3>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Website Page Title (&lt;title&gt;)
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                        placeholder="e.g. Happy Birthday My Love! ❤️"
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

                  {/* Config Keys dynamically mapped */}
                  {data.config && (
                    <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
                      <h3 className="text-sm font-bold text-[#0f172a] flex items-center space-x-2">
                        <UserCheck className="h-4 w-4 text-rose-400" />
                        <span>Client Personalization Variables</span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        These values automatically populate headers, intro cards, banners, and letter sign-offs.
                      </p>

                      <div className="space-y-4">
                        {Object.entries(config).map(([key, val]) => {
                          // Skip complex objects (like castDialogues) handled in Quotes tab
                          if (typeof val === 'object' && val !== null) return null;
                          if (key === 'backgroundColor' || key === 'textColor' || key === 'elementColor') return null;

                          let label = key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, (str) => str.toUpperCase());
                          if (key === 'girlfriendName') label = "Girlfriend's Real Name / Recipient";
                          else if (key === 'boyfriendName') label = "Boyfriend's Name / Partner";
                          else if (key === 'nickname') label = "Special Nickname / Title";
                          else if (key === 'birthdayDate') label = "Celebration Date / Event Date";
                          else if (key === 'signOffName') label = "Love Letter Sign-off / Signature";

                          return (
                            <div key={key}>
                              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                {label}
                              </label>
                              <input
                                type="text"
                                value={val ?? ''}
                                onChange={(e) =>
                                  setConfig((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                        <div className="border-b border-slate-800 pb-2">
                          <h3 className="text-sm font-bold text-[#0f172a] flex items-center space-x-2">
                            <Sparkles className="h-4 w-4 text-rose-400" />
                            <span>{formattedTitle}</span>
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
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
                                  className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3"
                                >
                                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 font-mono text-xs font-bold border border-rose-500/20">
                                        #{String(index + 1).padStart(2, '0')}
                                      </span>
                                      <span className="font-bold text-xs text-[#0f172a]">
                                        {cardTitle}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      Card {index + 1} / {sData.length}
                                    </span>
                                  </div>

                                  {isObject ? (
                                    <>
                                      {(item.title !== undefined || item.name !== undefined) && (
                                        <div>
                                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
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
                                            className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                                            placeholder="Contoh: First Day, The Laugh, dll."
                                          />
                                        </div>
                                      )}

                                      <div>
                                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
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
                                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
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
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
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
                                className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3"
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
                                    className="font-bold text-xs text-rose-300 bg-transparent border-b border-slate-700 focus:border-rose-500 focus:outline-none px-1 py-0.5"
                                  />
                                  {charVal.role && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      • {charVal.role}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <label className="block text-[11px] text-slate-400 mb-1">Quote Message</label>
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
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
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

              {/* TAB 3: PHOTOS & SCRAPBOOK */}
              {activeTab === 'photos' && (
                <div className="space-y-6">
                  {/* Real-time Upload Progress Card */}
                  {uploadProgress.active && (
                    <div className="bg-slate-900 border border-rose-500/30 p-4 rounded-2xl shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div
                            className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                              uploadProgress.status === 'success'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : uploadProgress.status === 'error'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-rose-500/20 text-rose-400'
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
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({uploadProgress.fileSize})
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
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
                                ? 'text-rose-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {uploadProgress.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ease-out ${
                            uploadProgress.status === 'success'
                              ? 'bg-emerald-500'
                              : uploadProgress.status === 'error'
                              ? 'bg-rose-600'
                              : 'bg-gradient-to-r from-rose-500 via-pink-500 to-emerald-400 shadow-sm shadow-rose-500/50'
                          }`}
                          style={{ width: `${uploadProgress.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* General Upload Box */}
                  <div className="bg-slate-900/70 p-5 rounded-2xl border border-dashed border-slate-700 hover:border-rose-500/50 transition text-center">
                    <Upload className="h-8 w-8 text-rose-400 mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-[#0f172a]">Upload New Client Photo</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Uploads directly into <code>assets/images/</code>
                    </p>
                    <label className="mt-3 inline-block px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[#0f172a] text-xs font-semibold cursor-pointer border border-slate-700">
                      Choose Photo
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

                  {/* Photo Slots List */}
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a] mb-3">
                      Detected Memory & Polaroid Photo Slots
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Assign photos to specific memory spots on the template.
                    </p>

                    <div className="grid grid-cols-1 gap-4">
                      {data.photoSlots.map((slot) => {
                        // Check if an update is staged
                        const staged = photoUpdates.find((u) => u.slotId === slot.id);
                        const effectiveSrc = staged ? staged.newSrc : slot.src;
                        const isUploadingThisSlot = uploadProgress.active && uploadProgress.slotId === slot.id;

                        // Calculate preview URL
                        let previewImgUrl = effectiveSrc;
                        if (effectiveSrc && !effectiveSrc.startsWith('http')) {
                          previewImgUrl = `/api/preview/${category}/${template}/${effectiveSrc.replace(
                            /^\//,
                            ''
                          )}`;
                        }

                        return (
                          <div
                            key={slot.id}
                            className={`p-4 rounded-2xl bg-slate-900/60 border transition flex flex-col gap-3 ${
                              isUploadingThisSlot ? 'border-rose-500/50 bg-slate-900/90' : 'border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <div className="h-16 w-16 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                                  {effectiveSrc ? (
                                    <img
                                      src={previewImgUrl}
                                      alt={slot.alt}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="h-6 w-6 text-slate-600" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-[#0f172a] truncate">
                                    {slot.label}
                                  </h4>
                                  <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                                    {effectiveSrc || '(Empty Placeholder Slot)'}
                                  </p>
                                  {staged && (
                                    <span className="inline-block text-[10px] text-amber-400 font-medium mt-1">
                                      ★ Pending Save
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center space-x-2 shrink-0">
                                {isUploadingThisSlot ? (
                                  <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-semibold flex items-center space-x-1.5">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    <span>{uploadProgress.percentage}%</span>
                                  </div>
                                ) : (
                                  <label className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[#0f172a] transition cursor-pointer text-xs flex items-center space-x-1">
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

                                {/* Pick from existing images dropdown */}
                                {data.availableImages.length > 0 && (
                                  <select
                                    value={effectiveSrc}
                                    onChange={(e) =>
                                      handleAssignPhotoToSlot(slot.id, e.target.value)
                                    }
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 max-w-[140px]"
                                  >
                                    <option value="">Select Asset...</option>
                                    {data.availableImages.map((img) => (
                                      <option key={img.path} value={img.path}>
                                        {img.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>

                            {/* Slot-specific mini progress bar */}
                            {isUploadingThisSlot && (
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400 transition-all duration-200"
                                  style={{ width: `${uploadProgress.percentage}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Available Assets Gallery */}
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a] mb-3">Template Asset Images</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {data.availableImages.map((img) => (
                        <div
                          key={img.path}
                          className="rounded-xl bg-slate-900 border border-slate-800 p-2 text-center overflow-hidden group"
                        >
                          <div className="h-24 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center mb-2">
                            <img
                              src={img.url}
                              alt={img.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition"
                            />
                          </div>
                          <p className="text-[10px] text-slate-300 truncate font-mono">{img.name}</p>
                          <span className="text-[9px] text-slate-500">
                            {(img.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: RAW CODE */}
              {activeTab === 'code' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                    {(['script.js', 'index.html', 'style.css'] as const).map((fileName) => (
                      <button
                        key={fileName}
                        onClick={() => setActiveCodeFile(fileName)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono transition ${
                          activeCodeFile === fileName
                            ? 'bg-rose-600 text-[#0f172a] font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-[#0f172a]'
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
                    className="w-full h-[550px] p-4 font-mono text-xs bg-slate-950 text-emerald-400 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
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
            className={`flex-1 bg-[#050811] flex flex-col items-center justify-center p-4 overflow-hidden relative ${
              layoutMode === 'preview' ? 'w-full' : ''
            }`}
          >
            {/* Viewport Frame Container */}
            <div
              className={`h-full transition-all duration-300 flex flex-col items-center justify-center ${
                viewport === 'mobile'
                  ? 'w-[375px] max-w-full'
                  : viewport === 'tablet'
                  ? 'w-[768px] max-w-full'
                  : 'w-full'
              }`}
            >
              <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-[#f8fafc] flex flex-col relative">
                {/* Browser top indicator bar */}
                <div className="h-7 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="flex items-center space-x-2 truncate px-2">
                    <span className="text-[10px] text-slate-400 font-mono truncate">
                      /api/preview/{category}/{template}
                    </span>
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>REAL-TIME</span>
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {viewport.toUpperCase()}
                  </div>
                </div>

                {/* Embedded Live Iframe */}
                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  src={`/api/preview/${category}/${template}`}
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

      {/* Clone Client Order Modal */}
      {cloneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-[#e2e8f0] rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-[#ecfdf5] text-[#0f172a] flex items-center justify-center border border-[#e2e8f0]">
                <FolderPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0f172a]">Save as Client Order</h3>
                <p className="text-xs text-[#64748b]">Clone into a distinct folder under client_orders</p>
              </div>
            </div>

            <p className="text-xs text-[#64748b] mb-4">
              Base template: <strong className="text-[#0f172a]">{data.title || template}</strong>.
            </p>

            <form onSubmit={handleCloneClientOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748b] mb-1">
                  Client / Order Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sarah_24th_birthday or tom_and_jen"
                  value={clientOrderName}
                  onChange={(e) => setClientOrderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] text-xs focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-slate-900/20 transition"
                />
                <span className="text-[10px] text-[#64748b] mt-1 block">
                  Creates <code>client_orders/{'{client_name}'}</code> without modifying this base template.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCloneModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cloning || !clientOrderName.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[#0f172a] text-xs font-semibold transition flex items-center space-x-1.5 shadow-lg shadow-indigo-600/20"
                >
                  {cloning ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating Order...</span>
                    </>
                  ) : (
                    <span>Create & Switch to Order</span>
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
