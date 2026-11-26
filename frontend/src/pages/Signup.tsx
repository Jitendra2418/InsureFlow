import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, User, Phone, Calendar, ArrowRight, AlertCircle, UserCheck } from 'lucide-react';

export const Signup: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);

  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !dateOfBirth) {
      setError('Please fill in all required customer fields.');
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
      setError('Please agree to the Terms of Coverage and Privacy Policy.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signup({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        phone: phone.trim()
      });

      if (result.success) {
        navigate('/dashboard', {
          state: { message: 'Customer account successfully created in PostgreSQL! Welcome to InsureFlow.' }
        });
      } else {
        setError(result.error || 'Failed to register customer in database.');
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
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#8B9A6E] flex items-center justify-center text-white shadow-lg shadow-[#8B9A6E]/25">
            <Shield className="w-9 h-9 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-4 text-center">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#8B9A6E]/15 text-[#5A6644] border border-[#8B9A6E]/30 mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Customer Registration</span>
          </span>
          <h2 className="text-3xl font-extrabold text-[#2E3523] tracking-tight">
            Register for AD&D Insurance
          </h2>
          <p className="mt-1 text-xs text-stone-600 font-medium">
            Create your customer account to activate and manage partner coverage
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-[#EAE2D6] py-8 px-6 sm:px-10 shadow-xl rounded-3xl border border-[#D8CBB9]">
          
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
                Email Address
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
                  placeholder="customer@example.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                />
              </div>
            </div>

            {/* Date of Birth & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Date of Birth (18–69 yrs)
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                  />
                </div>
                <p className="text-[10px] text-stone-500 mt-1">Underwriting rule: Age 18–69 required</p>
              </div>

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
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0123"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                  />
                </div>
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
                  className="h-4 w-4 mt-0.5 text-[#8B9A6E] focus:ring-[#8B9A6E] border-stone-300 rounded accent-[#8B9A6E]"
                />
                <span className="ml-2 text-xs text-stone-600 leading-relaxed">
                  I agree to the <span className="underline font-semibold text-stone-800">Terms of Coverage</span> and authorize customer policy administration under InsureFlow.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center space-x-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#8B9A6E] hover:bg-[#738258] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B9A6E] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <span>{isLoading ? 'Saving Customer to Database...' : 'Register Customer Account'}</span>
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {/* Switch to Login */}
          <div className="mt-8 pt-5 border-t border-[#D8CBB9] text-center text-xs text-stone-600">
            Already registered?{' '}
            <Link to="/login" className="font-bold text-[#5A6644] hover:underline">
              Sign in as customer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
