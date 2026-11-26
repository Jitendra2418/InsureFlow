import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LogOut, LayoutDashboard, Sparkles } from 'lucide-react';

export const Navbar: React.FC<{ onOpenEnroll?: () => void }> = ({ onOpenEnroll }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F7F2EB]/95 backdrop-blur-md border-b border-[#EAE2D6] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-11 h-11 rounded-xl bg-[#8B9A6E] flex items-center justify-center text-white shadow-md shadow-[#8B9A6E]/20 group-hover:scale-105 transition-transform">
            <Shield className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-2xl font-bold tracking-tight text-[#2E3523]">Insure<span className="text-[#8B9A6E]">Flow</span></span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#8B9A6E]/15 text-[#5A6644] px-1.5 py-0.5 rounded">Bank Partner</span>
            </div>
            <p className="text-xs text-stone-500 font-medium hidden sm:block">Customer AD&D Enrollment Portal</p>
          </div>
        </Link>

        {/* Navigation Items */}
        <div className="flex items-center space-x-3 sm:space-x-5">
          {user ? (
            <>
              {onOpenEnroll && (
                <button
                  onClick={onOpenEnroll}
                  className="hidden md:inline-flex items-center space-x-2 bg-[#8B9A6E] hover:bg-[#738258] text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Enroll in AD&D</span>
                </button>
              )}

              <Link
                to="/dashboard"
                className="flex items-center space-x-1.5 text-sm font-medium text-stone-700 hover:text-[#5A6644] px-3 py-2 rounded-md hover:bg-[#EAE2D6]/40 transition"
              >
                <LayoutDashboard className="w-4 h-4 text-[#8B9A6E]" />
                <span className="hidden sm:inline">My Policies</span>
              </Link>

              {/* User Profile Pill */}
              <div className="flex items-center space-x-2 bg-[#EAE2D6] px-3 py-1.5 rounded-full border border-[#D8CBB9]/60">
                <div className="w-7 h-7 rounded-full bg-[#8B9A6E] text-white flex items-center justify-center text-xs font-bold">
                  {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                </div>
                <div className="text-xs text-left hidden lg:block">
                  <p className="font-semibold text-stone-800 leading-tight">{user.firstName} {user.lastName}</p>
                  <p className="text-[11px] text-[#5A6644] capitalize font-medium">{user.role.toLowerCase()}</p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                title="Sign out"
                className="flex items-center space-x-1 text-sm text-stone-600 hover:text-red-700 p-2 rounded-lg hover:bg-[#EEEEEE] transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-medium">Logout</span>
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                to="/login"
                className="text-sm font-medium text-stone-700 hover:text-[#5A6644] px-4 py-2 rounded-lg transition"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="bg-[#8B9A6E] hover:bg-[#738258] text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-sm transition hover:shadow"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
