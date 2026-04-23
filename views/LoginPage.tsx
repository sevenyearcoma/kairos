import React, { useState } from 'react';
import { login, register } from '../api/auth';

interface Props {
  onAuth: (displayName: string) => void;
}

const LoginPage: React.FC<Props> = ({ onAuth }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const data = await login(email, password);
        onAuth(data.user.displayName || data.user.email);
      } else {
        const data = await register(email, password, displayName);
        onAuth(data.user.displayName || data.user.email);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="size-10 bg-charcoal rounded-xl flex items-center justify-center text-primary shadow-2xl">
            <span className="material-symbols-outlined text-xl">hourglass_empty</span>
          </div>
          <span className="font-display font-black text-2xl tracking-tighter uppercase">Kairos</span>
        </div>

        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-charcoal/5 shadow-xl p-8">
          <div className="flex bg-beige-soft border border-charcoal/5 rounded-2xl p-1 mb-8">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'login' ? 'bg-charcoal text-cream shadow' : 'text-charcoal/40'}`}
            >
              Login
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'register' ? 'bg-charcoal text-cream shadow' : 'text-charcoal/40'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-charcoal/40 mb-2">Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-beige-soft border border-charcoal/10 text-sm font-medium text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-charcoal/40 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-2xl bg-beige-soft border border-charcoal/10 text-sm font-medium text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:border-primary/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-charcoal/40 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-2xl bg-beige-soft border border-charcoal/10 text-sm font-medium text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:border-primary/50 transition-all"
              />
            </div>

            {error && (
              <p className="text-[11px] font-bold text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-charcoal text-cream rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-charcoal/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
