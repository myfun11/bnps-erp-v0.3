import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Sun,
  User,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const LoginPage: React.FC = () => {
  const {
    loginWithPassword,
    isLiveSupabase,
    isLoading,
  } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoginError('');

    const email = identifier.trim().toLowerCase();

    if (!isLiveSupabase) {
      setLoginError(
        'Secure login is currently unavailable. Supabase authentication is not configured.'
      );
      return;
    }

    if (!email) {
      setLoginError('Please enter your email address.');
      return;
    }

    if (!email.includes('@')) {
      setLoginError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setLoginError('Please enter your password.');
      return;
    }

    if (!loginWithPassword) {
      setLoginError('Password login is not available.');
      return;
    }

    try {
      setSubmitting(true);

      await loginWithPassword(email, password);
    } catch (error: any) {
      console.error('[LoginPage] Login failed:', error);

      setLoginError(
        error?.message ||
          'Login failed. Please verify your email and password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-8 py-8 text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Sun className="w-7 h-7 text-yellow-400" />
              </div>

              <div>
                <h1 className="text-xl font-bold">BNPS ERP</h1>
                <p className="text-sm text-slate-300">
                  Bhumi Nidhi Power Solution
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold">Secure Login</h2>
            <p className="text-sm text-slate-300 mt-1">
              Sign in with your authorized ERP account.
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-8 space-y-5">
            {loginError && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Email Address
              </label>

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                <input
                  id="login-email"
                  type="email"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoComplete="username"
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  disabled={submitting || isLoading}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Password
              </label>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  disabled={submitting || isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || isLoading || !isLiveSupabase}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white py-3.5 font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting || isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />

                <div className="text-sm text-emerald-800">
                  <p className="font-semibold">
                    Supabase Authentication
                  </p>
                  <p className="mt-1">
                    ERP access is controlled by the authenticated account
                    and its authorized profile.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">
          BNPS ERP v0.3
        </p>
      </div>
    </div>
  );
};

export default LoginPage;