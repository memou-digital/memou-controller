'use client';

import React, { useState, useEffect } from 'react';
import { Palette, Check, Pipette, Type, Layers } from 'lucide-react';

export interface ThemePreset {
  id: string;
  name: string;
  bg: string;
  text: string;
  element: string;
  border?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'romantic-cream',
    name: 'Romantic Cream (Default)',
    bg: '#FAF6F2',
    text: '#331E23',
    element: '#FFFFFF',
    border: '#E8DED6',
  },
  {
    id: 'midnight-charcoal',
    name: 'Midnight Dark (Gelap Elegan)',
    bg: '#0F172A',
    text: '#F8FAFC',
    element: '#1E293B',
    border: '#334155',
  },
  {
    id: 'blush-rose',
    name: 'Blush Pink',
    bg: '#FDF2F8',
    text: '#4C1D24',
    element: '#FFFFFF',
    border: '#FBCFE8',
  },
  {
    id: 'soft-lavender',
    name: 'Soft Lavender',
    bg: '#F5F3FF',
    text: '#2E1065',
    element: '#FFFFFF',
    border: '#DDD6FE',
  },
  {
    id: 'mint-sage',
    name: 'Mint Sage',
    bg: '#F0FDF4',
    text: '#14532D',
    element: '#FFFFFF',
    border: '#BBF7D0',
  },
  {
    id: 'sunset-peach',
    name: 'Sunset Peach',
    bg: '#FFF7ED',
    text: '#431407',
    element: '#FFFFFF',
    border: '#FED7AA',
  },
  {
    id: 'deep-charcoal',
    name: 'Deep Minimalist Dark',
    bg: '#18181B',
    text: '#FAFAFA',
    element: '#27272A',
    border: '#3F3F46',
  },
  {
    id: 'sky-blue',
    name: 'Sky Blue',
    bg: '#F0F9FF',
    text: '#0C4A6E',
    element: '#FFFFFF',
    border: '#BAE6FD',
  },
];

export interface BackgroundColorPickerProps {
  value?: string; // Background color
  textColor?: string;
  elementColor?: string;
  onChange?: (color: string) => void;
  onThemeChange?: (colors: { backgroundColor: string; textColor: string; elementColor: string }) => void;
  className?: string;
}

export default function BackgroundColorPicker({
  value = '#FAF6F2',
  textColor = '#331E23',
  elementColor = '#FFFFFF',
  onChange,
  onThemeChange,
  className = '',
}: BackgroundColorPickerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'bg' | 'text' | 'element'>('all');

  const [bgHex, setBgHex] = useState<string>(value || '#FAF6F2');
  const [textHex, setTextHex] = useState<string>(textColor || '#331E23');
  const [elemHex, setElemHex] = useState<string>(elementColor || '#FFFFFF');

  useEffect(() => {
    if (value) setBgHex(value);
  }, [value]);

  useEffect(() => {
    if (textColor) setTextHex(textColor);
  }, [textColor]);

  useEffect(() => {
    if (elementColor) setElemHex(elementColor);
  }, [elementColor]);

  const notifyChange = (newBg: string, newText: string, newElem: string) => {
    if (onChange) {
      onChange(newBg);
    }
    if (onThemeChange) {
      onThemeChange({
        backgroundColor: newBg,
        textColor: newText,
        elementColor: newElem,
      });
    }
  };

  const handleApplyPreset = (preset: ThemePreset) => {
    setBgHex(preset.bg);
    setTextHex(preset.text);
    setElemHex(preset.element);
    notifyChange(preset.bg, preset.text, preset.element);
  };

  const handleBgChange = (newColor: string) => {
    setBgHex(newColor);
    notifyChange(newColor, textHex, elemHex);
  };

  const handleTextChange = (newColor: string) => {
    setTextHex(newColor);
    notifyChange(bgHex, newColor, elemHex);
  };

  const handleElemChange = (newColor: string) => {
    setElemHex(newColor);
    notifyChange(bgHex, textHex, newColor);
  };

  const normalizedBg = (bgHex || '#FAF6F2').toLowerCase();

  return (
    <div className={`bg-white p-5 rounded-2xl border border-[#e2e8f0] space-y-4 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600">
            <Palette className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">Kustomisasi Warna Tema &amp; Kontras</h3>
            <p className="text-[11px] text-[#64748b]">
              Atur warna latar belakang, warna teks, dan elemen kartu agar tampilan selalu terbaca jelas
            </p>
          </div>
        </div>

        {/* Live Swatch Preview Badge */}
        <div className="flex items-center space-x-1.5 p-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
          <div
            className="h-5 w-5 rounded-lg border shadow-xs"
            style={{ backgroundColor: bgHex }}
            title={`Background: ${bgHex}`}
          />
          <div
            className="h-5 w-5 rounded-lg border shadow-xs flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: elemHex, color: textHex }}
            title={`Elemen & Teks: ${elemHex} / ${textHex}`}
          >
            A
          </div>
        </div>
      </div>

      {/* Preset Harmonis Card */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-[#0f172a]">
            Pilihan Palet Tema Harmonis (1-Klik):
          </label>
          <span className="text-[10px] text-[#64748b]">Otomatis serasi</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {THEME_PRESETS.map((preset) => {
            const isSelected =
              normalizedBg === preset.bg.toLowerCase() &&
              textHex.toLowerCase() === preset.text.toLowerCase();

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`p-2.5 rounded-xl border transition text-left cursor-pointer flex items-center space-x-2.5 ${
                  isSelected
                    ? 'border-[#0f172a] ring-2 ring-slate-900/10 shadow-xs bg-[#f8fafc]'
                    : 'border-[#e2e8f0] hover:border-slate-300 hover:bg-[#f8fafc]'
                }`}
              >
                {/* Visual Palette Representation */}
                <div
                  className="h-6 w-6 rounded-lg shrink-0 flex items-center justify-center border shadow-xs relative overflow-hidden"
                  style={{ backgroundColor: preset.bg, borderColor: preset.border || '#cbd5e1' }}
                >
                  <div
                    className="h-3 w-3 rounded-full flex items-center justify-center text-[8px] font-bold"
                    style={{ backgroundColor: preset.element, color: preset.text }}
                  >
                    {isSelected ? <Check className="h-2.5 w-2.5" /> : '•'}
                  </div>
                </div>
                <div className="truncate min-w-0">
                  <p className="text-[11px] font-bold text-[#0f172a] truncate">{preset.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Custom Pickers Section */}
      <div className="pt-3 border-t border-[#f1f5f9] space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[#0f172a] flex items-center space-x-1.5">
            <Pipette className="h-3.5 w-3.5 text-slate-500" />
            <span>Kustomisasi Detail Tiap Elemen:</span>
          </label>

          {/* Quick tab switchers */}
          <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-[#f1f5f9] text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2 py-0.5 rounded-md transition ${activeTab === 'all' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b]'}`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bg')}
              className={`px-2 py-0.5 rounded-md transition ${activeTab === 'bg' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b]'}`}
            >
              Latar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`px-2 py-0.5 rounded-md transition ${activeTab === 'text' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b]'}`}
            >
              Teks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('element')}
              className={`px-2 py-0.5 rounded-md transition ${activeTab === 'element' ? 'bg-white text-[#0f172a] shadow-xs' : 'text-[#64748b]'}`}
            >
              Elemen/Kartu
            </button>
          </div>
        </div>

        {/* 1. Latar Belakang */}
        {(activeTab === 'all' || activeTab === 'bg') && (
          <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <div
                className="h-6 w-6 rounded-lg border shadow-xs shrink-0"
                style={{ backgroundColor: bgHex }}
              />
              <div>
                <p className="text-xs font-bold text-[#0f172a] flex items-center space-x-1">
                  <Palette className="h-3 w-3 text-slate-600" />
                  <span>Warna Latar Belakang (Page Background)</span>
                </p>
                <p className="text-[10px] text-[#64748b]">Mengubah seluruh warna kanvas halaman website</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {/* Native Picker */}
              <div className="relative">
                <div
                  className="h-7 w-7 rounded-lg border border-slate-300 cursor-pointer shadow-xs hover:scale-105 transition overflow-hidden"
                  style={{ backgroundColor: bgHex }}
                >
                  <input
                    type="color"
                    value={/^#([0-9A-F]{3}){1,2}$/i.test(bgHex) ? bgHex : '#FAF6F2'}
                    onChange={(e) => handleBgChange(e.target.value)}
                    aria-label="Pilih warna latar belakang"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              </div>
              <input
                type="text"
                value={bgHex}
                onChange={(e) => {
                  const val = e.target.value;
                  setBgHex(val);
                  if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) handleBgChange(val);
                }}
                className="w-24 px-2.5 py-1 rounded-lg bg-white border border-[#e2e8f0] text-[#0f172a] font-mono text-xs uppercase focus:outline-none focus:border-[#0f172a]"
              />
            </div>
          </div>
        )}

        {/* 2. Warna Teks */}
        {(activeTab === 'all' || activeTab === 'text') && (
          <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <div
                className="h-6 w-6 rounded-lg border shadow-xs shrink-0 flex items-center justify-center font-bold text-xs"
                style={{ backgroundColor: '#ffffff', color: textHex }}
              >
                T
              </div>
              <div>
                <p className="text-xs font-bold text-[#0f172a] flex items-center space-x-1">
                  <Type className="h-3 w-3 text-slate-600" />
                  <span>Warna Teks Utama &amp; Judul (Typography)</span>
                </p>
                <p className="text-[10px] text-[#64748b]">Mengubah teks judul, ucapan, dan deskripsi</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {/* Quick Contrast Swatches */}
              <div className="flex items-center space-x-1 mr-1">
                <button
                  type="button"
                  onClick={() => handleTextChange('#FFFFFF')}
                  title="Putih Bersih (Untuk mode gelap)"
                  className="h-5 w-5 rounded-full border border-slate-300 bg-white hover:scale-110 transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => handleTextChange('#331E23')}
                  title="Cokelat Romantis Gelap (Untuk mode terang)"
                  className="h-5 w-5 rounded-full border border-slate-300 bg-[#331E23] hover:scale-110 transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => handleTextChange('#0F172A')}
                  title="Hitam Charcoal"
                  className="h-5 w-5 rounded-full border border-slate-300 bg-[#0F172A] hover:scale-110 transition shadow-2xs"
                />
              </div>

              {/* Native Picker */}
              <div className="relative">
                <div
                  className="h-7 w-7 rounded-lg border border-slate-300 cursor-pointer shadow-xs hover:scale-105 transition overflow-hidden"
                  style={{ backgroundColor: textHex }}
                >
                  <input
                    type="color"
                    value={/^#([0-9A-F]{3}){1,2}$/i.test(textHex) ? textHex : '#331E23'}
                    onChange={(e) => handleTextChange(e.target.value)}
                    aria-label="Pilih warna teks"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              </div>
              <input
                type="text"
                value={textHex}
                onChange={(e) => {
                  const val = e.target.value;
                  setTextHex(val);
                  if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) handleTextChange(val);
                }}
                className="w-24 px-2.5 py-1 rounded-lg bg-white border border-[#e2e8f0] text-[#0f172a] font-mono text-xs uppercase focus:outline-none focus:border-[#0f172a]"
              />
            </div>
          </div>
        )}

        {/* 3. Warna Elemen & Kartu */}
        {(activeTab === 'all' || activeTab === 'element') && (
          <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <div
                className="h-6 w-6 rounded-lg border shadow-xs shrink-0"
                style={{ backgroundColor: elemHex }}
              />
              <div>
                <p className="text-xs font-bold text-[#0f172a] flex items-center space-x-1">
                  <Layers className="h-3 w-3 text-slate-600" />
                  <span>Warna Elemen &amp; Kartu (Cards &amp; Badges)</span>
                </p>
                <p className="text-[10px] text-[#64748b]">Mengubah latar kartu polaroid, amplop surat, dan badge tanggal</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {/* Quick Contrast Swatches */}
              <div className="flex items-center space-x-1 mr-1">
                <button
                  type="button"
                  onClick={() => handleElemChange('#FFFFFF')}
                  title="Putih Kartu (Mode Terang)"
                  className="h-5 w-5 rounded-full border border-slate-300 bg-white hover:scale-110 transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => handleElemChange('#1E293B')}
                  title="Dark Navy Slate (Mode Gelap)"
                  className="h-5 w-5 rounded-full border border-slate-300 bg-[#1E293B] hover:scale-110 transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => handleElemChange('#27272A')}
                  title="Dark Zinc"
                  className="h-5 w-5 rounded-full border border-slate-300 bg-[#27272A] hover:scale-110 transition shadow-2xs"
                />
              </div>

              {/* Native Picker */}
              <div className="relative">
                <div
                  className="h-7 w-7 rounded-lg border border-slate-300 cursor-pointer shadow-xs hover:scale-105 transition overflow-hidden"
                  style={{ backgroundColor: elemHex }}
                >
                  <input
                    type="color"
                    value={/^#([0-9A-F]{3}){1,2}$/i.test(elemHex) ? elemHex : '#FFFFFF'}
                    onChange={(e) => handleElemChange(e.target.value)}
                    aria-label="Pilih warna elemen"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              </div>
              <input
                type="text"
                value={elemHex}
                onChange={(e) => {
                  const val = e.target.value;
                  setElemHex(val);
                  if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) handleElemChange(val);
                }}
                className="w-24 px-2.5 py-1 rounded-lg bg-white border border-[#e2e8f0] text-[#0f172a] font-mono text-xs uppercase focus:outline-none focus:border-[#0f172a]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
