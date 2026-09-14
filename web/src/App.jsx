import React from 'react';
import { useAuth } from './auth';
import Login from './Login';
import CollectorApp from './CollectorApp';
import RecyclerApp from './RecyclerApp';
import AdminApp from './AdminApp';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1.5s linear infinite' }}>♻️</div>
          <p style={{ color: 'var(--text-muted)' }}>Loading KabadiLink...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  switch (user.role) {
    case 'RECYCLER':
      return <RecyclerApp />;
    case 'ADMIN':
      return <AdminApp />;
    case 'COLLECTOR':
    default:
      return <CollectorApp />;
  }
}
