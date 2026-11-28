import React, { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, UserCheck, Eye, EyeOff, Calendar, KeyRound, X } from 'lucide-react';
import { apiRequest } from '../api';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [bannerSuccess, setBannerSuccess] = useState<string>('');

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotIdentifier, setForgotIdentifier] = useState<string>('');
  const [forgotDob, setForgotDob] = useState<string>('');
  const [forgotNewPassword, setForgotNewPassword] = useState<string>('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState<string>('');
  const [forgotShowPassword, setForgotShowPassword] = useState<boolean>(false);
  const [forgotShowConfirmPassword, setForgotShowConfirmPassword] = useState<boolean>(false);
  const [forgotError, setForgotError] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const forgotDateInputRef = useRef<HTMLInputElement>(null);

  const successMessage = (location.state as { message?: string })?.message || bannerSuccess;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide both your registered email address and password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Failed to sign in. Please verify your credentials.');
      }
    } catch {
      setError('Unable to reach the InsureFlow server. Ensure the backend is running on port 8080.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (!forgotIdentifier.trim() || !forgotDob || !forgotNewPassword) {
      setForgotError('Please fill in your Email or Aadhaar, Date of Birth, and New Password.');
      return;
    }

    if (forgotNewPassword.length < 8) {
      setForgotError('New password must be at least 8 characters long for account security.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match. Please ensure both passwords match.');
      return;
    }

    setIsResetting(true);

    try {
      const response = await apiRequest<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          identifier: forgotIdentifier.trim(),
          dateOfBirth: forgotDob,
          newPassword: forgotNewPassword
        })
      });

      if (response && response.message) {
        setBannerSuccess('Password reset successfully! Please sign in with your new password.');
        setEmail(forgotIdentifier.trim());
        setShowForgotModal(false);
        // Reset modal fields
        setForgotIdentifier('');
        setForgotDob('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotError('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password. Please verify your account information.';
      setForgotError(msg);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F2EB] flex flex-col">
      {/* Top Brand Bar */}
      <div className="w-full bg-[#2E3523] py-3 px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#8B9A6E] flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-white w-5 h-5" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">InsureFlow</span>
          <span className="text-[#8B9A6E] text-xs font-medium border border-[#8B9A6E]/40 px-2 py-0.5 rounded-full">
            Customer Portal
          </span>
        </div>
        <span className="text-[#8B9A6E] text-xs font-medium hidden sm:block">
          Accidental Death &amp; Dismemberment Coverage
        </span>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">

          {/* Brand Icon & Heading */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-[#8B9A6E] flex items-center justify-center text-white shadow-xl shadow-[#8B9A6E]/30">
              <Shield className="w-11 h-11 stroke-[2]" />
            </div>
          </div>

          <div className="mt-5 text-center">
            {/* InsureFlow brand name */}
            <p className="text-[#8B9A6E] font-black text-sm uppercase tracking-widest mb-1">InsureFlow</p>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#8B9A6E]/15 text-[#5A6644] border border-[#8B9A6E]/30 mb-3">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Customer Portal Only</span>
            </span>
            <h2 className="text-3xl font-extrabold text-[#2E3523] tracking-tight">
              Customer Sign In
            </h2>
            <p className="mt-2 text-xs text-stone-600 font-medium max-w-sm mx-auto leading-relaxed">
              Log in with your verified customer credentials to view your policies and enroll in coverage.
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
          <div className="bg-[#EAE2D6] py-8 px-6 sm:px-10 shadow-xl rounded-3xl border border-[#D8CBB9]">

            {successMessage && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Email or Aadhaar Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Customer Email Address or Aadhaar Number
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@example.com or 12-digit Aadhaar"
                    className="block w-full pl-10 pr-3 py-3 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError('');
                      if (email) setForgotIdentifier(email);
                      setShowForgotModal(true);
                    }}
                    className="text-xs text-[#5A6644] hover:underline cursor-pointer font-semibold focus:outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="block w-full pl-10 pr-10 py-3 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] focus:border-transparent text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 transition-colors focus:outline-none"
                    tabIndex={-1}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-[#8B9A6E] focus:ring-[#8B9A6E] border-stone-300 rounded accent-[#8B9A6E]"
                />
                <label htmlFor="remember-me" className="ml-2 block text-xs font-medium text-stone-700">
                  Remember my customer session
                </label>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center space-x-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#8B9A6E] hover:bg-[#738258] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B9A6E] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  <span>{isLoading ? 'Verifying credentials...' : 'Sign In as Customer'}</span>
                  {!isLoading && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </form>

            {/* Switch to Signup */}
            <div className="mt-8 pt-5 border-t border-[#D8CBB9] text-center text-xs text-stone-600">
              First time customer?{' '}
              <Link to="/signup" className="font-bold text-[#5A6644] hover:underline">
                Create a customer account
              </Link>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-5 text-center text-xs text-stone-500 space-y-1">
            <p className="font-semibold text-stone-600">
              🔒 InsureFlow — Live PostgreSQL Authentication
            </p>
            <p className="text-[11px]">
              Only verified CUSTOMER roles are permitted. Admin and Operations users must use the admin portal.
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FBF8F3] max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D8CBB9] relative animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-stone-200/60 hover:bg-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-800 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#8B9A6E]/20 text-[#5A6644] flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold text-[#2E3523]">
                Reset Customer Password
              </h3>
              <p className="text-xs text-stone-600 mt-1 max-w-xs mx-auto">
                Verify your customer identity with your registered Email/Aadhaar and Date of Birth to update your password.
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
                <span className="leading-relaxed">{forgotError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* Identifier */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Customer Email or Aadhaar Number
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="customer@example.com or 12-digit Aadhaar"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-xs"
                  />
                </div>
              </div>

              {/* Date of Birth verification */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Verified Date of Birth
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        forgotDateInputRef.current?.showPicker?.();
                      } catch {
                        forgotDateInputRef.current?.focus();
                      }
                    }}
                    className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-400 hover:text-[#8B9A6E] transition-colors focus:outline-none"
                    tabIndex={-1}
                    title="Open calendar picker"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                  <input
                    ref={forgotDateInputRef}
                    type="date"
                    required
                    value={forgotDob}
                    onChange={(e) => setForgotDob(e.target.value)}
                    onClick={(e) => {
                      try {
                        (e.currentTarget as HTMLInputElement).showPicker?.();
                      } catch {}
                    }}
                    style={{ colorScheme: 'light' }}
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-xs cursor-pointer"
                  />
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  Identity safeguard: Must match date of birth on file (click to pick)
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  New Password (Min 8 Characters)
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={forgotShowPassword ? 'text' : 'password'}
                    required
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="Enter new secure password"
                    className="block w-full pl-10 pr-10 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setForgotShowPassword(!forgotShowPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 transition-colors focus:outline-none"
                    tabIndex={-1}
                    title={forgotShowPassword ? 'Hide password' : 'Show password'}
                  >
                    {forgotShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={forgotShowConfirmPassword ? 'text' : 'password'}
                    required
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="block w-full pl-10 pr-10 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setForgotShowConfirmPassword(!forgotShowConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 transition-colors focus:outline-none"
                    tabIndex={-1}
                    title={forgotShowConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {forgotShowConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 py-2.5 px-4 border border-[#D8CBB9] rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#8B9A6E] hover:bg-[#738258] shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  <span>{isResetting ? 'Updating...' : 'Update Password'}</span>
                  {!isResetting && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
