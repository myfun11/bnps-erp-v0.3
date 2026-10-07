import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Sun,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  AtSign,
} from 'lucide-react';
import { BnpsLogo } from '../common/BnpsLogo';

const LoginPage: React.FC = () => {
  const {
    loginWithPassword,
    isLiveSupabase,
    isLoading,
  } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError('');

    const email = identifier.trim().toLowerCase();

    if (!isLiveSupabase) {
      setLoginError(
        'Supabase authentication is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to log in.'
      );
      return;
    }

    if (!email) {
      setLoginError('Please enter your email address or employee ID.');
      return;
    }

    if (!email.includes('@') && !email.startsWith('bnps') && !email.startsWith('agt')) {
      setLoginError('Please enter a valid official email address or employee code.');
      return;
    }

    if (!password) {
      setLoginError('Please enter your password.');
      return;
    }

    if (!loginWithPassword) {
      setLoginError('Authentication service is initializing.');
      return;
    }

    try {
      setSubmitting(true);
      await loginWithPassword(email, password);
    } catch (error: any) {
      console.error('[LoginPage] Login error:', error);
      setLoginError(
        error?.message || 'Authentication failed. Please verify your credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-between bg-[#030812] text-slate-100 overflow-x-hidden selection:bg-amber-500 selection:text-slate-950">
      {/* =========================================================================
          BACKGROUND: CINEMATIC ROOFTOP SOLAR PANELS ARCHITECTURAL IMAGE BACKDROP
          ========================================================================= */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url('/rooftop_solar_bg.svg')`,
        }}
      >
        {/* Soft atmospheric gradient overlays for optical depth and contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/80 via-[#051124]/70 to-[#030814]/90" />
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full bg-amber-500/15 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />
      </div>

      {/* =========================================================================
          TOP BANNER: PM SURYA GHAR NATIONAL MISSION HEADER STRIP
          ========================================================================= */}
      <header className="relative z-10 w-full px-4 sm:px-8 py-3.5 border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Sun className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                PM Surya Ghar Muft Bijli Yojana
              </span>
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline-block text-[11px] font-semibold text-emerald-400">
                Authorized Vendor Network
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Bhumi Nidhi Power Solution (BNPS) • Chhattisgarh Operational Directorate
            </span>
          </div>
        </div>

        {/* Live district branches badge list */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400">
          <span className="text-slate-500">Active Branches:</span>
          <span className="text-slate-300 font-medium">Raipur</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300 font-medium">Bilaspur</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300 font-medium">Korba</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300 font-medium">Janjgir</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300 font-medium">Jaijaipur</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300 font-medium">Sakti</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300 font-medium">Raigarh</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-300 font-medium">Basana</span>
        </div>
      </header>

      {/* =========================================================================
          MAIN CENTER: COHESIVE DARK ENTERPRISE LOGIN CARD
          ========================================================================= */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-2xl grid grid-cols-1 lg:grid-cols-12 min-h-[580px] ring-1 ring-white/10">
          
          {/* =====================================================================
              LEFT PANEL (DARK NAVY BRAND HERO - FROM IMAGE 1)
              ===================================================================== */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#061021] via-[#091a33] to-[#0d264a] p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800/80">
            {/* Ambient solar rays & contour lines */}
            <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full border border-blue-400/10 pointer-events-none" />
            <div className="absolute -top-12 -left-12 w-96 h-96 rounded-full border border-blue-400/10 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-gradient-to-tl from-amber-500/15 via-blue-500/10 to-transparent blur-2xl pointer-events-none" />

            {/* Top Brand Header */}
            <div className="relative z-10">
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-12 h-12 rounded-xl bg-white/10 p-2 flex items-center justify-center shadow-inner border border-white/10">
                  <BnpsLogo variant="icon" size="sm" inverted={true} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black tracking-tight text-white">BNPS</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      ERP v0.3
                    </span>
                  </div>
                  <p className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
                    Bhumi Nidhi Power Solution
                  </p>
                </div>
              </div>

              {/* Category Kicker */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-[11px] font-semibold text-blue-300 tracking-wider uppercase mb-4">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Rooftop Solar · Business Operating System
              </div>

              {/* Main Headline */}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug mb-3">
                Run your solar business with one connected system.
              </h1>

              {/* Body Subtext */}
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                CRM, customer registration, site surveys, rooftop installation, finance, multi-tier agent commissions, and PM Surya Ghar portal operations — connected in one secure workspace.
              </p>

              {/* Value Checkmark List (from Image 1) */}
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-white">One connected workflow</h3>
                    <p className="text-[11px] text-slate-300">From consumer lead to solar rooftop installation & net-metering</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-white">Role-based access</h3>
                    <p className="text-[11px] text-slate-300">Access is strictly governed for Directors, Branch Managers, Field Staff & Agents</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-white">Built for BNPS operations</h3>
                    <p className="text-[11px] text-slate-300">Engineered for PM Surya Ghar National Portal scale & multi-branch expansion</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Proof Strip & Tagline */}
            <div className="relative z-10 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">BNPS · BUSINESS OPERATING SYSTEM</span>
              <span className="text-amber-400 font-mono">⚡ 100% On-Grid Ready</span>
            </div>
          </div>

          {/* =====================================================================
              RIGHT PANEL (COHESIVE DARK SLATE / NAVY SIGN-IN)
              ===================================================================== */}
          <div className="lg:col-span-7 bg-[#081220]/95 backdrop-blur-2xl p-8 sm:p-10 flex flex-col justify-between text-slate-100">
            <div>
              {/* Header inside right card */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <BnpsLogo variant="icon" size="sm" inverted={true} />
                  <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">
                    Bhumi Nidhi Power Solution
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isLiveSupabase ? 'Supabase Live' : 'Supabase Required'}
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="mb-6">
                <span className="text-[11px] font-bold text-blue-400 tracking-widest uppercase">
                  WELCOME BACK
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                  Welcome to BNPS ERP
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
                  Sign in securely to continue to your solar business workspace.
                </p>
              </div>

              {/* ===============================================================
                  CLEAN SIGN IN FORM (NO QUICK ROLE ACCORDION - AS REQUESTED)
                  =============================================================== */}
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* Email Field */}
                <div>
                  <label
                    htmlFor="email-input"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <AtSign className="w-4 h-4" />
                    </div>
                    <input
                      id="email-input"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="admin@bnps.local or mukesh@bhuminidhi.com"
                      className="w-full pl-10 pr-3.5 py-3 bg-[#040914]/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                      disabled={submitting || isLoading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="password-input"
                      className="block text-xs font-semibold text-slate-300"
                    >
                      Password
                    </label>
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Secure sign in
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-11 py-3 bg-[#040914]/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                      disabled={submitting || isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={submitting || isLoading}
                  className="w-full mt-3 py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#081220] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting || isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating Solar Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to ERP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom Security / Trust Notice */}
            <div className="mt-8 pt-4 border-t border-slate-800/80">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-300 leading-snug">
                  {isLiveSupabase
                    ? 'Connected to Live Supabase: Authenticated accounts and roles are verified strictly by the server.'
                    : 'Supabase Auth Required: Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to log in.'}
                </p>
              </div>
              <p className="text-center text-[10px] text-slate-500 mt-2.5">
                Authorized BNPS Personnel Only · All Actions Audited Under PM Surya Ghar Compliance
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          FOOTER STRIP: CORPORATE & SOLAR SYSTEM TELEMETRY
          ========================================================================= */}
      <footer className="relative z-10 w-full px-4 sm:px-8 py-3 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <span>BNPS ERP v0.3</span>
          <span>·</span>
          <span>Bhumi Nidhi Power Solution</span>
          <span>·</span>
          <span>Rooftop Solar EPC Directorate</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">⚡ 3kW – 10kW On-Grid Solar Systems</span>
          <span className="text-amber-400/90 font-medium">₹78,000 Direct DBT Subsidy Support</span>
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;
