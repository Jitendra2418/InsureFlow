import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Policy } from '../types';
import { apiRequest } from '../api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  policies: Policy[];
  isLoadingPolicies: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phone: string;
    aadharNumber: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshPolicies: () => Promise<void>;
  updatePolicy: (policyId: string, updateData: {
    coverAmount?: number;
    addressLine1?: string;
    addressLine2?: string | null;
    city?: string;
    state?: string;
    zipCode?: string;
    beneficiaries?: { firstName: string; lastName: string; relationship: string; percentage: number; phone?: string }[];
  }) => Promise<{ success: boolean; error?: string }>;
  cancelPolicy: (policyId: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('insureflow_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('insureflow_token') || null;
  });

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('insureflow_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('insureflow_user');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('insureflow_token', token);
    } else {
      localStorage.removeItem('insureflow_token');
    }
  }, [token]);

  // Load real policies for authenticated customer from PostgreSQL
  const refreshPolicies = useCallback(async () => {
    if (!token) {
      setPolicies([]);
      return;
    }
    setIsLoadingPolicies(true);
    try {
      const data = await apiRequest<Policy[]>('/policies');
      setPolicies(data);
    } catch (err) {
      console.error('Failed to load policies from database:', err);
      setPolicies([]);
    } finally {
      setIsLoadingPolicies(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      refreshPolicies();
    } else {
      setPolicies([]);
    }
  }, [token, refreshPolicies]);

  // Customer Login (Strictly verifies against PostgreSQL)
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      setUser(res.user);
      setToken(res.token);
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please verify credentials.';
      return { success: false, error: errorMessage };
    }
  };

  // Customer Signup (Writes directly to PostgreSQL)
  const signup = async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phone: string;
    aadharNumber: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiRequest<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      setUser(res.user);
      setToken(res.token);
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed.';
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setPolicies([]);
    localStorage.removeItem('insureflow_user');
    localStorage.removeItem('insureflow_token');
  };

  const updatePolicy = async (policyId: string, updateData: {
    coverAmount?: number;
    addressLine1?: string;
    addressLine2?: string | null;
    city?: string;
    state?: string;
    zipCode?: string;
    beneficiaries?: { firstName: string; lastName: string; relationship: string; percentage: number; phone?: string }[];
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiRequest(`/policies/${policyId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      await refreshPolicies();
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update policy.';
      return { success: false, error: errorMessage };
    }
  };

  const cancelPolicy = async (policyId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiRequest(`/policies/${policyId}`, { method: 'DELETE' });
      await refreshPolicies();
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel policy.';
      return { success: false, error: errorMessage };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      policies,
      isLoadingPolicies,
      login,
      signup,
      logout,
      refreshPolicies,
      updatePolicy,
      cancelPolicy
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
