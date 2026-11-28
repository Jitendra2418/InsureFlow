import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Sliders, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Role toggle: 'ADMIN' or 'OPERATIONS'
  const [activeRole, setActiveRole] = useState<'ADMIN' | 'OPERATIONS'>('ADMIN');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const successMessage = (location.state as { message?: string })?.message;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError(`Please provide your ${activeRole === 'ADMIN' ? 'administrator' : 'operator'} email address and password.`);
      return;
    }

    setIsLoading(true);

    try {
      const result = await adminLogin(email.trim(), password, activeRole);
      if (result.success) {
        if (activeRole === 'OPERATIONS') {
          navigate('/operations/dashboard');
        } else {
          navigate('/admin/dashboard');
        }
      } else {
        setError(result.error || `Failed to sign in as ${activeRole === 'ADMIN' ? 'Administrator' : 'Operator'}. Please verify credentials.`);
      }
    } catch {
      setError('Unable to reach the InsureFlow database API. Ensure backend and PostgreSQL are running.');
    } finally {
      setIsLoading(false);
    }
  };

  const isRoleAdmin = activeRole === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#F7F2EB] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Icon & Heading */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#5A6644] flex items-center justify-center text-white shadow-lg shadow-[#5A6644]/25">
            {isRoleAdmin ? (
              <ShieldCheck className="w-9 h-9 stroke-[2.2]" />
            ) : (
              <Sliders className="w-9 h-9 stroke-[2.2]" />
            )}
          </div>
        </div>
        <div className="mt-4 text-center">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#5A6644]/15 text-[#3D472E] border border-[#5A6644]/30 mb-2">
            {isRoleAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Sliders className="w-3.5 h-3.5" />}
            <span>{isRoleAdmin ? 'Administrator Portal' : 'Operations Portal'}</span>
          </span>
          <h2 className="text-3xl font-extrabold text-[#2E3523] tracking-tight">
            {isRoleAdmin ? 'Admin Sign In' : 'Operator Sign In'}
          </h2>
          <p className="mt-1 text-xs text-stone-600 font-medium max-w-sm mx-auto">
            {isRoleAdmin
              ? 'Sign in with your administrative credentials to manage bank partners, products, and platform campaigns.'
              : 'Sign in with your operations credentials to manage customer claims, service requests, and policy enrollments.'}
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-[#EAE2D6] py-8 px-6 sm:px-10 shadow-xl rounded-3xl border border-[#D8CBB9]">
          
          {/* Role Selector Toggle */}
          <div className="bg-[#D8CBB9]/60 p-1.5 rounded-2xl flex items-center mb-6 border border-[#D8CBB9]">
            <button
              type="button"
              onClick={() => {
                setActiveRole('ADMIN');
                setError('');
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                isRoleAdmin
                  ? 'bg-[#5A6644] text-white shadow-md'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Administrator</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRole('OPERATIONS');
                setError('');
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                !isRoleAdmin
                  ? 'bg-[#5A6644] text-white shadow-md'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Operator</span>
            </button>
          </div>

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
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                {isRoleAdmin ? 'Administrator Email Address' : 'Operator Email Address'}
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isRoleAdmin ? 'admin@insureflow.com' : 'operator@insureflow.com'}
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
                <span className="text-xs text-[#5A6644] hover:underline cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full pl-10 pr-3 py-3 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="admin-remember-me"
                  name="admin-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-[#8B9A6E] focus:ring-[#8B9A6E] border-stone-300 rounded accent-[#8B9A6E]"
                />
                <label htmlFor="admin-remember-me" className="ml-2 block text-xs font-medium text-stone-700">
                  Remember my {isRoleAdmin ? 'administrator' : 'operator'} session
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center space-x-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#5A6644] hover:bg-[#495436] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5A6644] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <span>
                  {isLoading
                    ? `Verifying ${isRoleAdmin ? 'Administrator' : 'Operator'} Credentials...`
                    : `Sign In as ${isRoleAdmin ? 'Administrator' : 'Operator'}`}
                </span>
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {/* Switch to Signup */}
          <div className="mt-8 pt-5 border-t border-[#D8CBB9] text-center text-xs text-stone-600">
            Need an account?{' '}
            <Link 
              to="/admin/signup" 
              state={{ defaultRole: activeRole }}
              className="font-bold text-[#5A6644] hover:underline"
            >
              Sign up as {isRoleAdmin ? 'Administrator' : 'Operator'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
