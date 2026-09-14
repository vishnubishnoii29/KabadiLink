import React, { useState } from 'react';
import { useAuth } from './auth';
import { useI18n } from './i18n';
import { api } from './api';

export default function Login() {
  const { loginWithPassword, loginWithOtp, register } = useAuth();
  const { t, lang, setLang } = useI18n();

  const [mode, setMode] = useState('otp'); // 'otp' | 'password' | 'register'
  const [phone, setPhone] = useState('9876543210');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState(null);

  // Register fields
  const [name, setName] = useState('');
  const [role, setRole] = useState('COLLECTOR');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.requestOtp(phone, 'DEV_LOG');
      setOtpSent(true);
      if (res.dev_code) {
        setDevCode(res.dev_code);
        setOtpCode(res.dev_code); // Auto-populate for fast testing/demo
      }
    } catch (err) {
      setError(err.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithOtp(phone, otpCode);
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithPassword(phone, password);
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        phone,
        password: password || undefined,
        role,
        name,
        preferred_language: lang
      });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
        
        {/* Header & Lang */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
              ♻️ {t('app_title')}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              {t('tagline')}
            </p>
          </div>
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)}
            className="select" 
            style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
            <option value="mr">मराठी</option>
          </select>
        </div>

        {/* Tab Selection */}
        <div className="tabs-nav" style={{ marginBottom: '1.5rem' }}>
          <button 
            type="button" 
            className={`tab-btn ${mode === 'otp' ? 'active' : ''}`}
            onClick={() => { setMode('otp'); setError(''); }}
          >
            ⚡ {t('otp')}
          </button>
          <button 
            type="button" 
            className={`tab-btn ${mode === 'password' ? 'active' : ''}`}
            onClick={() => { setMode('password'); setError(''); }}
          >
            🔑 {t('password')}
          </button>
          <button 
            type="button" 
            className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            ➕ {t('register')}
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Mode 1: OTP Login */}
        {mode === 'otp' && (
          <div>
            {!otpSent ? (
              <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {t('phone')}
                  </label>
                  <input 
                    type="tel" 
                    className="input" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="e.g. 9876543210" 
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Sending...' : t('request_otp')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleOtpLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {devCode && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: '#6ee7b7' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('dev_otp_banner')}</div>
                    <div style={{ fontSize: '1.4rem', letterSpacing: '0.2em', fontWeight: 800, marginTop: '0.2rem' }}>{devCode}</div>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Enter 6-Digit OTP for {phone}
                  </label>
                  <input 
                    type="text" 
                    className="input" 
                    value={otpCode} 
                    onChange={(e) => setOtpCode(e.target.value)} 
                    placeholder="123456" 
                    maxLength={6} 
                    required 
                    style={{ letterSpacing: '0.2em', fontSize: '1.2rem', textAlign: 'center' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setOtpSent(false)} style={{ flex: 1 }}>
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2 }}>
                    {loading ? 'Verifying...' : t('verify_and_login')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Mode 2: Password Login */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {t('phone')}
              </label>
              <input 
                type="tel" 
                className="input" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {t('password')}
              </label>
              <input 
                type="password" 
                className="input" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Signing in...' : t('login')}
            </button>
          </form>
        )}

        {/* Mode 3: Register */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Name / Business Name
              </label>
              <input 
                type="text" 
                className="input" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ramesh Kabadi / EcoRecycle Hub" 
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {t('phone')}
              </label>
              <input 
                type="tel" 
                className="input" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Role
              </label>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="COLLECTOR">Collector (कबाड़ी / Waste Picker)</option>
                <option value="RECYCLER">CPCB Authorized Recycler</option>
                <option value="ADMIN">System Admin</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Password (Optional for OTP users)
              </label>
              <input 
                type="password" 
                className="input" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Optional" 
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Creating...' : t('register')}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          🔒 Zero-cost deployment | Powered by FastAPI + Supabase Postgres
        </div>

      </div>
    </div>
  );
}
