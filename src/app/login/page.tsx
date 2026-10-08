'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Sparkles, Clock } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  const isExpired = searchParams.get('expired') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Mouse & input tracking coordinates for animated character
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPasswordFocused) return;
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        setMousePos({
          x: Math.max(-1, Math.min(1, x)),
          y: Math.max(-1, Math.min(1, y)),
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isPasswordFocused]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (!isPasswordFocused) {
      const len = e.target.value.length;
      const xOffset = Math.min(1, Math.max(-1, (len - 15) / 15));
      setMousePos({ x: xOffset * 0.8, y: 0.65 });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Silakan lengkapi email dan kata sandi Anda.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Email atau kata sandi tidak sesuai.');
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push(redirectUrl);
        router.refresh();
      }, 700);
    } catch (err: any) {
      setErrorMessage('Koneksi terganggu. Silakan periksa jaringan Anda.');
      setIsSubmitting(false);
    }
  };

  // Eye pupil calculation
  const pupilX = isPasswordFocused ? 0 : mousePos.x * 6;
  const pupilY = isPasswordFocused ? 0 : mousePos.y * 4;

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-sans selection:bg-[#0f172a] selection:text-white"
    >
      {/* Subtle clean background blur accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-indigo-50/60 via-slate-100/40 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-4 right-8 w-72 h-72 bg-emerald-50/40 rounded-full blur-3xl pointer-events-none" />

      {/* Main card wrapper */}
      <div className="w-full max-w-[420px] relative z-10">
        {/* Animated Mascot Head */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* Mascot SVG Body */}
            <svg
              viewBox="0 0 160 160"
              className="w-full h-full drop-shadow-[0_12px_20px_rgba(15,23,42,0.12)]"
            >
              <defs>
                <linearGradient id="bodyGradLight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
                <linearGradient id="earGradLight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                <linearGradient id="pawGradLight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
                <linearGradient id="blushGradLight" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#fb7185" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Ears */}
              <ellipse cx="40" cy="45" rx="16" ry="22" fill="url(#earGradLight)" transform="rotate(-20 40 45)" />
              <ellipse cx="40" cy="45" rx="9" ry="14" fill="#0f172a" transform="rotate(-20 40 45)" />

              <ellipse cx="120" cy="45" rx="16" ry="22" fill="url(#earGradLight)" transform="rotate(20 120 45)" />
              <ellipse cx="120" cy="45" rx="9" ry="14" fill="#0f172a" transform="rotate(20 120 45)" />

              {/* Head Base */}
              <rect x="28" y="32" width="104" height="100" rx="42" fill="url(#bodyGradLight)" />

              {/* Cheeks Blush */}
              <ellipse cx="44" cy="95" rx="10" ry="6" fill="url(#blushGradLight)" />
              <ellipse cx="116" cy="95" rx="10" ry="6" fill="url(#blushGradLight)" />

              {/* Eyebrows */}
              <path
                d={
                  isSuccess
                    ? 'M 46 60 Q 56 53 66 60'
                    : errorMessage
                    ? 'M 46 58 Q 56 65 66 61'
                    : 'M 48 62 Q 56 58 64 62'
                }
                stroke="#94a3b8"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d={
                  isSuccess
                    ? 'M 94 60 Q 104 53 114 60'
                    : errorMessage
                    ? 'M 94 61 Q 104 65 114 58'
                    : 'M 96 62 Q 104 58 112 62'
                }
                stroke="#94a3b8"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />

              {/* Eyes Sclera */}
              <ellipse cx="56" cy="76" rx="14" ry="17" fill="#FFFFFF" />
              <ellipse cx="104" cy="76" rx="14" ry="17" fill="#FFFFFF" />

              {/* Pupils */}
              {isSuccess ? (
                <>
                  <path d="M 44 76 Q 56 64 68 76" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" fill="none" />
                  <path d="M 92 76 Q 104 64 116 76" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" fill="none" />
                </>
              ) : (
                <>
                  {/* Left Pupil */}
                  <g transform={`translate(${pupilX}, ${pupilY})`}>
                    <circle cx="56" cy="76" r="7" fill="#0f172a" />
                    <circle cx="54" cy="73" r="2.5" fill="#FFFFFF" />
                    <circle cx="58" cy="78" r="1.2" fill="#FFFFFF" />
                  </g>
                  {/* Right Pupil */}
                  <g transform={`translate(${pupilX}, ${pupilY})`}>
                    <circle cx="104" cy="76" r="7" fill="#0f172a" />
                    <circle cx="102" cy="73" r="2.5" fill="#FFFFFF" />
                    <circle cx="106" cy="78" r="1.2" fill="#FFFFFF" />
                  </g>
                </>
              )}

              {/* Snout & Nose */}
              <ellipse cx="80" cy="90" rx="14" ry="10" fill="#f8fafc" />
              <polygon points="80,87 75,82 85,82" fill="#0f172a" />

              {/* Mouth */}
              <path
                d={
                  isSuccess
                    ? 'M 72 94 Q 80 104 88 94'
                    : isSubmitting
                    ? 'M 76 96 Q 80 99 84 96'
                    : errorMessage
                    ? 'M 74 97 Q 80 92 86 97'
                    : 'M 75 93 Q 80 97 85 93'
                }
                stroke="#334155"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />

              {/* Hands / Paws for Covering Eyes */}
              {/* Left Hand */}
              <g
                className="transition-all duration-300 ease-out"
                style={{
                  transformOrigin: '40px 140px',
                  transform: isPasswordFocused
                    ? showPassword
                      ? 'translate(2px, -36px) rotate(-15deg)'
                      : 'translate(14px, -52px) rotate(15deg)'
                    : 'translate(0px, 30px)',
                  opacity: isPasswordFocused ? 1 : 0,
                }}
              >
                <ellipse cx="45" cy="120" rx="18" ry="14" fill="url(#pawGradLight)" stroke="#475569" strokeWidth="1.5" />
                <circle cx="40" cy="116" r="3" fill="#cbd5e1" />
                <circle cx="46" cy="114" r="3" fill="#cbd5e1" />
                <circle cx="52" cy="116" r="3" fill="#cbd5e1" />
              </g>

              {/* Right Hand */}
              <g
                className="transition-all duration-300 ease-out"
                style={{
                  transformOrigin: '120px 140px',
                  transform: isPasswordFocused
                    ? showPassword
                      ? 'translate(-2px, -36px) rotate(15deg)'
                      : 'translate(-14px, -52px) rotate(-15deg)'
                    : 'translate(0px, 30px)',
                  opacity: isPasswordFocused ? 1 : 0,
                }}
              >
                <ellipse cx="115" cy="120" rx="18" ry="14" fill="url(#pawGradLight)" stroke="#475569" strokeWidth="1.5" />
                <circle cx="108" cy="116" r="3" fill="#cbd5e1" />
                <circle cx="114" cy="114" r="3" fill="#cbd5e1" />
                <circle cx="120" cy="116" r="3" fill="#cbd5e1" />
              </g>
            </svg>

            {/* Sparkle icon when successful */}
            {isSuccess && (
              <div className="absolute -top-2 -right-2 text-amber-500 animate-bounce">
                <Sparkles className="w-8 h-8 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]" />
              </div>
            )}
          </div>

          <div className="text-center mt-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-[#0f172a] text-white font-black text-xs tracking-tighter mb-2 shadow-md shadow-slate-900/10">
              MO
            </div>
            <h1 className="text-lg font-bold tracking-tight text-[#0f172a]">
              MEMOu Controller
            </h1>
            <p className="text-xs text-[#64748b] mt-0.5">Masuk untuk mengelola pesanan & template klien</p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-xl shadow-slate-900/5 relative">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs animate-shake"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSuccess && (
            <div
              role="status"
              className="mb-5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-700 text-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Autentikasi berhasil! Mengalihkan...</span>
            </div>
          )}

          {isExpired && !errorMessage && !isSuccess && (
            <div
              role="status"
              className="mb-5 p-3 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-amber-800 text-xs"
            >
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="font-semibold text-amber-900">Sesi Telah Berakhir</span>
                <span className="text-amber-700 mt-0.5 leading-relaxed">
                  Sesi Anda telah mencapai batas 1 jam. Silakan masuk kembali untuk melanjutkan.
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-[#0f172a] mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94a3b8]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nama@memo.u"
                  value={email}
                  onChange={handleEmailChange}
                  onFocus={() => setIsPasswordFocused(false)}
                  disabled={isSubmitting || isSuccess}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-xs font-medium text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#0f172a] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-bold text-[#0f172a]">
                  Kata Sandi
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94a3b8]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  disabled={isSubmitting || isSuccess}
                  className="w-full pl-10 pr-10 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl text-xs font-mono text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#0f172a] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  tabIndex={0}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94a3b8] hover:text-[#0f172a] focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className="w-full py-3 px-4 bg-[#0f172a] hover:bg-[#1e293b] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-2xl shadow-md shadow-slate-900/10 transition-all duration-200 flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Memverifikasi...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Berhasil Masuk</span>
                </>
              ) : (
                <span>Masuk ke Dashboard</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-[#94a3b8] mt-6">
          MEMOu Controller &copy; {new Date().getFullYear()} &bull; Studio & Client Orchestration
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-[#64748b]">
          <Loader2 className="w-8 h-8 animate-spin text-[#0f172a]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
