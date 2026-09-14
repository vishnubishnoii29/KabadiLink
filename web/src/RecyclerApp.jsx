import React, { useState, useEffect } from 'react';
import { useAuth } from './auth';
import { useI18n } from './i18n';
import { api } from './api';

export default function RecyclerApp() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();

  const [activeTab, setActiveTab] = useState('marketplace'); // 'marketplace' | 'pickups' | 'settings'

  // Marketplace & Lots
  const [openLots, setOpenLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [estimateData, setEstimateData] = useState(null);

  // Pickups
  const [pickups, setPickups] = useState([]);
  const [selectedPickup, setSelectedPickup] = useState(null);
  const [otpVerifyInput, setOtpVerifyInput] = useState('');
  const [scaleWeightInput, setScaleWeightInput] = useState('');

  // Settings & Profile
  const [recyclerProfile, setRecyclerProfile] = useState(null);
  const [materialsAccepted, setMaterialsAccepted] = useState([]);
  const [pickupAvailable, setPickupAvailable] = useState(true);
  const [serviceAreaKm, setServiceAreaKm] = useState(25);
  const [docFile, setDocFile] = useState(null);
  const [docType, setDocType] = useState('CPCB Authorization');
  const [docUploadStatus, setDocUploadStatus] = useState('');

  const ALL_MATERIALS = ['PCB', 'BATTERY', 'CABLE', 'LCD', 'CRT', 'MOTOR', 'MAGNET', 'PLASTIC', 'OTHER'];

  const loadData = async () => {
    try {
      const [lotsRes, profileRes] = await Promise.all([
        api.listLots({ status: 'OPEN' }).catch(() => ({ lots: [] })),
        api.getRecycler(user?.id).catch(() => null)
      ]);
      setOpenLots(lotsRes?.lots || []);
      if (profileRes) {
        setRecyclerProfile(profileRes);
        setMaterialsAccepted(profileRes.materials_accepted || []);
        setPickupAvailable(profileRes.pickup_available ?? true);
        setServiceAreaKm(profileRes.service_area_km || 25);
      }
    } catch (err) {
      console.warn('Recycler load data error:', err);
    }
  };

  const loadPickups = async () => {
    try {
      const res = await api.getRecyclerPickups(user?.id);
      setPickups(res || []);
    } catch (err) {
      console.warn('Failed to load pickups:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadPickups();
  }, [user]);

  // Inspect lot and fetch Explainable Fair Price estimate
  const inspectLot = async (lot) => {
    setSelectedLot(lot);
    setOfferPrice('');
    try {
      const est = await api.getPriceEstimate(lot.id);
      setEstimateData(est);
    } catch (err) {
      console.warn('Estimate fetch failed:', err);
      setEstimateData(null);
    }
  };

  const handleMakeOffer = async (e) => {
    e.preventDefault();
    if (!selectedLot || !offerPrice) return;
    try {
      await api.createOffer(selectedLot.id, parseFloat(offerPrice));
      alert(`Offer of ₹${offerPrice} submitted successfully!`);
      setSelectedLot(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyOtp = async (lotId) => {
    if (!otpVerifyInput) {
      alert('Please enter the collector’s 6-digit OTP code');
      return;
    }
    try {
      await api.verifyHandoverOtp(lotId, otpVerifyInput, parseFloat(scaleWeightInput) || undefined);
      alert('Handover OTP verified successfully! Weight recorded.');
      setOtpVerifyInput('');
      setScaleWeightInput('');
      loadPickups();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await api.updateRecycler(user?.id, {
        materials_accepted: materialsAccepted,
        pickup_available: pickupAvailable,
        service_area_km: parseFloat(serviceAreaKm)
      });
      alert('Settings saved successfully!');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!docFile) return;
    setDocUploadStatus('Uploading document...');
    try {
      const upRes = await api.uploadGenericFile(docFile);
      await api.uploadVerificationDoc(user?.id, docType, upRes.file_url || 'uploaded_doc');
      setDocUploadStatus('Uploaded successfully! Status: PENDING review by admin.');
      setDocFile(null);
      loadData();
    } catch (err) {
      setDocUploadStatus(`Upload failed: ${err.message}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header className="nav-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ color: '#10b981' }}>♻️ {t('app_title')}</h2>
          <span className="badge badge-blue">{t('recycler')} Dashboard</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)} 
            className="select" 
            style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
          >
            <option value="en">EN</option>
            <option value="hi">हिंदी</option>
            <option value="mr">मराठी</option>
          </select>

          <button type="button" className="btn btn-secondary" onClick={logout} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            {t('logout')}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="layout-container">
        <div className="tabs-nav">
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'marketplace' ? 'active' : ''}`}
            onClick={() => setActiveTab('marketplace')}
          >
            🏪 Marketplace ({openLots.length})
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'pickups' ? 'active' : ''}`}
            onClick={() => { setActiveTab('pickups'); loadPickups(); }}
          >
            🚚 Active Pickups ({pickups.length})
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Facility & Compliance Settings
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: MARKETPLACE                                           */}
        {/* ============================================================ */}
        {activeTab === 'marketplace' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedLot ? '1.2fr 1fr' : '1fr', gap: '1.5rem' }}>
            {/* Feed */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Available Scrap Lots</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filtered by your service area ({serviceAreaKm} km)</span>
              </div>

              {openLots.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No open lots currently in your area.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {openLots.map(lot => (
                    <div 
                      key={lot.id} 
                      onClick={() => inspectLot(lot)}
                      className="glass-panel card-interactive"
                      style={{ padding: '1rem', cursor: 'pointer', borderColor: selectedLot?.id === lot.id ? 'var(--primary)' : 'var(--border-subtle)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b>{lot.lot_code}</b>
                        <span className="badge badge-green">{lot.weight_kg} kg</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>
                        Condition: {lot.condition}
                      </div>
                      <button type="button" className="btn btn-secondary" style={{ width: '100%', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        Review & Offer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Lot Offering Console */}
            {selectedLot && (
              <div className="glass-panel fade-in" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h3>Lot: {selectedLot.lot_code}</h3>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedLot(null)} style={{ padding: '0.2rem 0.5rem' }}>✕</button>
                </div>

                <div style={{ background: '#192236', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Weight: {selectedLot.weight_kg} kg</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Condition: {selectedLot.condition}</div>

                  {estimateData && (
                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Explainable Fair Price:</span>
                        <span className="badge badge-blue">{estimateData.confidence} confidence</span>
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', margin: '0.25rem 0' }}>
                        ₹{estimateData.min} – ₹{estimateData.max} <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>(median ₹{estimateData.median})</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{estimateData.explanation}</p>
                    </div>
                  )}
                </div>

                {/* Offer Input Form */}
                <form onSubmit={handleMakeOffer} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your Buying Offer Price (₹):</label>
                  <input 
                    type="number" 
                    step="1" 
                    min="1" 
                    className="input" 
                    value={offerPrice} 
                    onChange={(e) => setOfferPrice(e.target.value)} 
                    placeholder="e.g. 850" 
                    required 
                    autoFocus 
                  />
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Submit Binding Offer
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: ACTIVE PICKUPS & HANDOVER VERIFICATION                */}
        {/* ============================================================ */}
        {activeTab === 'pickups' && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Active Pickups & Handover Verification</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              When picking up lots, verify the collector’s 6-digit OTP code and record actual weight on your scale.
            </p>

            {pickups.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No active pickups scheduled.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                {pickups.map(item => (
                  <div key={item.id} className="glass-panel" style={{ padding: '1.25rem', background: '#192236' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <b>{item.lot_code}</b>
                      <span className="badge badge-amber">{item.status}</span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      <div>Estimated Weight: {item.weight_kg} kg</div>
                      <div>Accepted Price: ₹{item.price}</div>
                    </div>

                    {/* Verify Form */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>
                        Collector 6-Digit OTP:
                      </label>
                      <input 
                        type="text" 
                        maxLength={6} 
                        className="input" 
                        value={otpVerifyInput} 
                        onChange={(e) => setOtpVerifyInput(e.target.value)} 
                        placeholder="e.g. 123456" 
                        style={{ marginBottom: '0.5rem', textAlign: 'center', letterSpacing: '0.15em' }}
                      />

                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>
                        Actual Scale Weight (kg):
                      </label>
                      <input 
                        type="number" 
                        step="0.1" 
                        className="input" 
                        value={scaleWeightInput} 
                        onChange={(e) => setScaleWeightInput(e.target.value)} 
                        placeholder="e.g. 10.4" 
                        style={{ marginBottom: '0.75rem' }}
                      />

                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        onClick={() => handleVerifyOtp(item.lot_id)} 
                        style={{ width: '100%' }}
                      >
                        Verify Handover OTP
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: SETTINGS & CPCB COMPLIANCE                            */}
        {/* ============================================================ */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            
            {/* Operational Settings */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Recycler Operational Settings</h3>
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                    Service Radius (km):
                  </label>
                  <input 
                    type="number" 
                    className="input" 
                    value={serviceAreaKm} 
                    onChange={(e) => setServiceAreaKm(e.target.value)} 
                    min="1" 
                    max="100" 
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={pickupAvailable} 
                      onChange={(e) => setPickupAvailable(e.target.checked)} 
                    />
                    Provide On-Site Pickup Service
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                    Accepted Material Categories:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {ALL_MATERIALS.map(m => {
                      const selected = materialsAccepted.includes(m);
                      return (
                        <button 
                          key={m} 
                          type="button" 
                          onClick={() => {
                            setMaterialsAccepted(selected ? materialsAccepted.filter(x => x !== m) : [...materialsAccepted, m]);
                          }}
                          className={`btn ${selected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                  Save Operational Settings
                </button>
              </form>
            </div>

            {/* CPCB Authorization Documents */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>CPCB Compliance Documents</h3>
                <span className={`badge ${recyclerProfile?.authorization_status === 'VERIFIED' ? 'badge-green' : 'badge-amber'}`}>
                  {recyclerProfile?.authorization_status || 'PENDING'}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Upload valid State Pollution Control Board or Central Pollution Control Board registration certificate to generate compliant EPR records.
              </p>

              <form onSubmit={handleUploadDoc} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Document Type</label>
                  <select className="select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                    <option value="CPCB Authorization">CPCB Recycler Authorization</option>
                    <option value="SPCB Consent to Operate">SPCB Consent to Operate (CTO)</option>
                    <option value="GST Certificate">GST / Business Registration</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Upload PDF / Image</label>
                  <input 
                    type="file" 
                    accept="image/*,.pdf" 
                    onChange={(e) => setDocFile(e.target.files?.[0])} 
                    className="input" 
                    required 
                  />
                </div>

                <button type="submit" className="btn btn-secondary" style={{ borderColor: 'var(--primary)', color: '#34d399' }}>
                  Upload for Admin Verification
                </button>

                {docUploadStatus && (
                  <div style={{ fontSize: '0.8rem', color: '#6ee7b7', marginTop: '0.5rem' }}>
                    {docUploadStatus}
                  </div>
                )}
              </form>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
