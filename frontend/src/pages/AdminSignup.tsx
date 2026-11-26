import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Sliders, Lock, Mail, User, Phone, ArrowRight, AlertCircle } from 'lucide-react';

export const AdminSignup: React.FC = () => {
  const { adminSignup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initialRole = (location.state as { defaultRole?: 'ADMIN' | 'OPERATIONS' })?.defaultRole || 'ADMIN';
  const [activeRole, setActiveRole] = useState<'ADMIN' | 'OPERATIONS'>(initialRole);

  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);

  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isRoleAdmin = activeRole === 'ADMIN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      setError('Please provide your full name, email address, and phone number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long for account security.');
      return;
    }

    if (!agreeTerms) {
      setError(`Please confirm ${isRoleAdmin ? 'administrative' : 'operational'} authorization terms.`);
      return;
    }

    setIsLoading(true);

    try {
      const result = await adminSignup({
        name: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role: activeRole
      });

      if (result.success) {
        navigate('/admin/login', {
          state: {
            message: `${isRoleAdmin ? 'Administrator' : 'Operator'} account successfully created! Please sign in with your credentials.`
          }
        });
      } else {
        setError(result.error || `Failed to register ${isRoleAdmin ? 'Administrator' : 'Operator'} account.`);
      }
    } catch {
      setError('Unable to reach the InsureFlow backend API. Make sure PostgreSQL is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F2EB] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
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
            <span>{isRoleAdmin ? 'Administrator Registration' : 'Operations Registration'}</span>
          </span>
          <h2 className="text-3xl font-extrabold text-[#2E3523] tracking-tight">
            {isRoleAdmin ? 'Create Administrator Account' : 'Create Operator Account'}
          </h2>
          <p className="mt-1 text-xs text-stone-600 font-medium">
            {isRoleAdmin
              ? 'Register an administrator account for campaign setup, product configuration, and platform management'
              : 'Register an operations account for policy servicing, claims review, and bank partner workflows'}
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
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

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* First & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  First Name
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Last Name
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
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
                  className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                />
              </div>
            </div>

            {/* Mobile Phone Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Mobile Phone Number
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555-0102"
                  className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                />
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Password
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="pt-2">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  required
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="h-4 w-4 mt-0.5 text-[#5A6644] focus:ring-[#5A6644] border-stone-300 rounded accent-[#5A6644]"
                />
                <span className="ml-2 text-xs text-stone-600 leading-relaxed">
                  I confirm I am an authorized {isRoleAdmin ? 'system administrator' : 'operations team member'} with privileges to manage platform operations under InsureFlow.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center space-x-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#5A6644] hover:bg-[#495436] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5A6644] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <span>
                  {isLoading
                    ? `Creating ${isRoleAdmin ? 'Administrator' : 'Operator'} Account...`
                    : `Register as ${isRoleAdmin ? 'Administrator' : 'Operator'}`}
                </span>
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {/* Switch to Login */}
          <div className="mt-8 pt-5 border-t border-[#D8CBB9] text-center text-xs text-stone-600">
            Already have an account?{' '}
            <Link to="/admin/login" className="font-bold text-[#5A6644] hover:underline">
              Sign in as {isRoleAdmin ? 'Administrator' : 'Operator'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
