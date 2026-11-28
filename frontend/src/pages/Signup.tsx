import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, User, Phone, Calendar, ArrowRight, AlertCircle, UserCheck, CheckCircle2, CreditCard, Eye, EyeOff } from 'lucide-react';

export const Signup: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [aadharNumber, setAadharNumber] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);

  const dateInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Safe local date formatting for underwriting bounds (18 to 69 years old)
  const today = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const maxDate = formatYMD(new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()));
  const minDate = formatYMD(new Date(today.getFullYear() - 69, today.getMonth(), today.getDate()));

  // Aadhaar validation & formatting
  const cleanAadhar = aadharNumber.replace(/[\s-]/g, '');
  const aadharValid = cleanAadhar.length === 12 && /^\d{12}$/.test(cleanAadhar);
  const aadharInvalid = cleanAadhar.length > 0 && (cleanAadhar.length !== 12 || !/^\d+$/.test(cleanAadhar));

  const handleAadharChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Keep only digits, limit to 12 digits
    const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
    // Format as XXXX XXXX XXXX
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    setAadharNumber(formatted);
  };

  // Compute age for real-time validation
  const computeAge = (dob: string): number | null => {
    if (!dob) return null;
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };
  const age = computeAge(dateOfBirth);
  const ageValid = age !== null && age >= 18 && age <= 69;
  const ageInvalid = age !== null && (age < 18 || age > 69);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !dateOfBirth || !cleanAadhar) {
      setError('Please fill in all required customer fields, including Aadhaar Number.');
      return;
    }

    if (!aadharValid) {
      setError('Aadhaar Number must be exactly 12 numeric digits.');
      return;
    }

    if (ageInvalid || age === null) {
      setError('Underwriting requirement: You must be between 18 and 69 years of age to enroll.');
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
        phone: phone.trim(),
        aadharNumber: cleanAadhar
      });

      if (result.success) {
        navigate('/login', {
          state: { message: 'Account created successfully! Please sign in with your email or Aadhaar Number.' }
        });
      } else {
        setError(result.error || 'Failed to register customer in database.');
      }
    } catch {
      setError('Unable to reach the InsureFlow backend. Make sure the backend server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F2EB] flex flex-col">
      {/* Top Brand Bar */}
      <div className="w-full bg-[#2E3523] py-3 px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#8B9A6E] flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
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
        <div className="sm:mx-auto sm:w-full sm:max-w-lg">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-[#8B9A6E] flex items-center justify-center text-white shadow-xl shadow-[#8B9A6E]/30">
              <Shield className="w-11 h-11 stroke-[2]" />
            </div>
          </div>
          <div className="mt-5 text-center">
            <p className="text-[#8B9A6E] font-black text-sm uppercase tracking-widest mb-1">InsureFlow</p>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#8B9A6E]/15 text-[#5A6644] border border-[#8B9A6E]/30 mb-3">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Customer Registration</span>
            </span>
            <h2 className="text-3xl font-extrabold text-[#2E3523] tracking-tight">
              Create Your Account
            </h2>
            <p className="mt-2 text-xs text-stone-600 font-medium leading-relaxed">
              Register to activate and manage your AD&amp;D insurance coverage
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

              {/* Aadhaar Number Field (Unique Customer Identification) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Aadhaar Number (12 Digits)
                  </label>
                  <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider">
                    Anti-Duplicate ID
                  </span>
                </div>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={aadharNumber}
                    onChange={handleAadharChange}
                    maxLength={14}
                    placeholder="1234 5678 9012"
                    className={`block w-full pl-10 pr-3 py-2.5 bg-white border rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 text-sm font-mono tracking-wider ${
                      aadharInvalid
                        ? 'border-red-400 focus:ring-red-400'
                        : aadharValid
                        ? 'border-emerald-400 focus:ring-emerald-400'
                        : 'border-[#D8CBB9] focus:ring-[#8B9A6E]'
                    }`}
                  />
                </div>
                {/* Real-time Aadhaar validation message */}
                {aadharValid && (
                  <p className="text-[11px] text-emerald-700 mt-1 flex items-center space-x-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Valid 12-digit Aadhaar Number format</span>
                  </p>
                )}
                {aadharInvalid && (
                  <p className="text-[11px] text-red-600 mt-1 flex items-center space-x-1 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    <span>Must be exactly 12 numeric digits ({cleanAadhar.length}/12 entered)</span>
                  </p>
                )}
                {!cleanAadhar && (
                  <p className="text-[10px] text-stone-500 mt-1">
                    Mandatory unique customer identifier to prevent duplicate enrollments
                  </p>
                )}
              </div>

              {/* Date of Birth & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Date of Birth
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          dateInputRef.current?.showPicker?.();
                        } catch {
                          dateInputRef.current?.focus();
                        }
                      }}
                      className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-400 hover:text-[#8B9A6E] transition-colors focus:outline-none"
                      tabIndex={-1}
                      title="Open calendar picker"
                    >
                      <Calendar className="h-4 w-4" />
                    </button>
                    <input
                      ref={dateInputRef}
                      type="date"
                      required
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      onClick={(e) => {
                        try {
                          (e.currentTarget as HTMLInputElement).showPicker?.();
                        } catch {}
                      }}
                      max={maxDate}
                      min={minDate}
                      style={{ colorScheme: 'light' }}
                      className={`block w-full pl-10 pr-3 py-2.5 bg-white border rounded-xl text-stone-900 focus:outline-none focus:ring-2 text-sm cursor-pointer ${
                        ageInvalid
                          ? 'border-red-400 focus:ring-red-400'
                          : ageValid
                          ? 'border-emerald-400 focus:ring-emerald-400'
                          : 'border-[#D8CBB9] focus:ring-[#8B9A6E]'
                      }`}
                    />
                  </div>
                  {/* Real-time age feedback */}
                  {age !== null && (
                    <p className={`text-[11px] mt-1 flex items-center space-x-1 ${ageInvalid ? 'text-red-600' : 'text-emerald-700'}`}>
                      {ageValid
                        ? <><CheckCircle2 className="w-3 h-3" /><span>Age {age} — Eligible (18–69 yrs)</span></>
                        : <><AlertCircle className="w-3 h-3" /><span>Age {age} — Must be 18–69 to enroll</span></>
                      }
                    </p>
                  )}
                  {age === null && (
                    <p className="text-[10px] text-stone-500 mt-1">Underwriting rule: Age 18–69 required (click to select)</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Mobile Phone
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

              {/* Password & Confirm */}
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
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="block w-full pl-10 pr-10 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 transition-colors focus:outline-none"
                      tabIndex={-1}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
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
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className={`block w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 text-sm ${
                        confirmPassword && password !== confirmPassword
                          ? 'border-red-400 focus:ring-red-400'
                          : confirmPassword && password === confirmPassword
                          ? 'border-emerald-400 focus:ring-emerald-400'
                          : 'border-[#D8CBB9] focus:ring-[#8B9A6E]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 transition-colors focus:outline-none"
                      tabIndex={-1}
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[11px] text-red-600 mt-1 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" /><span>Passwords do not match</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="pt-2">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="h-4 w-4 mt-0.5 text-[#8B9A6E] focus:ring-[#8B9A6E] border-stone-300 rounded accent-[#8B9A6E]"
                  />
                  <span className="ml-2 text-xs text-stone-600 leading-relaxed">
                    I agree to the{' '}
                    <span className="underline font-semibold text-stone-800 cursor-pointer">Terms of Coverage</span>
                    {' '}and authorize customer policy administration under InsureFlow.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || ageInvalid || !aadharValid}
                  className="w-full flex justify-center items-center space-x-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#8B9A6E] hover:bg-[#738258] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B9A6E] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{isLoading ? 'Creating Account...' : 'Register Customer Account'}</span>
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

          {/* Footer note */}
          <div className="mt-5 text-center text-xs text-stone-500 space-y-1">
            <p className="font-semibold text-stone-600">
              🔒 InsureFlow — Secure Customer Registration
            </p>
            <p className="text-[11px]">
              Your data is stored securely in PostgreSQL. Admin and Operations users cannot register here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
