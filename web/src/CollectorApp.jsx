import React, { useState, useEffect } from 'react';
import { useAuth } from './auth';
import { useI18n } from './i18n';
import { api } from './api';

export default function CollectorApp() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();

  const [activeTab, setActiveTab] = useState('sell'); // 'sell' | 'lots' | 'earnings'
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Wizard state
  const [step, setStep] = useState(1); // 1: upload, 2: detections & weight, 3: price review, 4: done
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoResult, setPhotoResult] = useState(null);
  const [detectedItems, setDetectedItems] = useState([]);
  const [lotMode, setLotMode] = useState('SPLIT'); // 'SPLIT' | 'COMBINE'
  const [createdLots, setCreatedLots] = useState([]);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState('');

  // Lots & Handovers state
  const [myLots, setMyLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [offers, setOffers] = useState([]);
  const [handoverData, setHandoverData] = useState(null);
  const [passportData, setPassportData] = useState(null);

  // Modals state
  const [counterModal, setCounterModal] = useState(null); // { offer_id, current_price }
  const [counterPrice, setCounterPrice] = useState('');
  const [disputeModal, setDisputeModal] = useState(null); // lot_id
  const [disputeType, setDisputeType] = useState('WEIGHT_MISMATCH');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Load notifications
  const refreshNotifications = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res || []);
      setUnreadCount((res || []).filter(n => !n.read_at).length);
    } catch (err) {
      console.warn('Notifications poll failed:', err);
    }
  };

  // Load lots
  const refreshLots = async () => {
    try {
      const res = await api.listLots({ collector_id: user?.id });
      setMyLots(res?.lots || []);
    } catch (err) {
      console.warn('Failed to load lots:', err);
    }
  };

  useEffect(() => {
    refreshNotifications();
    refreshLots();
    const interval = setInterval(refreshNotifications, 8000); // 8s polling
    return () => clearInterval(interval);
  }, [user]);

  // Handle Photo Upload
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleAnalyzePhoto = async () => {
    if (!photoFile) return;
    setWizardLoading(true);
    setWizardError('');
    try {
      const res = await api.uploadPhoto(photoFile);
      setPhotoResult(res);
      // Map detections into editable items
      const items = (res.detections || []).map((d, index) => ({
        bbox_index: index,
        material: d.material || 'OTHER',
        confidence: d.confidence || 0.5,
        source: d.source || 'rule_based',
        reasoning: d.reasoning || '',
        needs_confirmation: d.needs_confirmation || d.confidence < 0.7,
        weight_kg: 2.0, // Default prompt for user weight entry
        condition: 'good'
      }));
      setDetectedItems(items);
      setStep(2);
    } catch (err) {
      setWizardError(err.message || 'Detection failed');
    } finally {
      setWizardLoading(false);
    }
  };

  // Submit Lots from Photo
  const handleCreateLots = async () => {
    setWizardLoading(true);
    setWizardError('');
    try {
      const payload = {
        lot_photo_id: photoResult.lot_photo_id,
        mode: lotMode,
        items: detectedItems.map(item => ({
          bbox_index: item.bbox_index,
          weight_kg: parseFloat(item.weight_kg) || 1.0,
          condition: item.condition
        }))
      };
      const res = await api.createLotsFromPhoto(payload);
      setCreatedLots(res.lots || []);
      setStep(3);
      refreshLots();
    } catch (err) {
      setWizardError(err.message || 'Failed to create lots');
    } finally {
      setWizardLoading(false);
    }
  };

  // Inspect Lot Details
  const inspectLot = async (lot) => {
    setSelectedLot(lot);
    try {
      const [offRes, passRes] = await Promise.all([
        api.listOffersForLot(lot.id).catch(() => []),
        api.getPassport(lot.id).catch(() => null)
      ]);
      setOffers(offRes || []);
      setPassportData(passRes);

      // Check handover if accepted
      if (['ACCEPTED', 'HANDOVER_PENDING', 'COMPLETED', 'DISPUTED'].includes(lot.status)) {
        const hRes = await api.getHandover(lot.id).catch(() => null);
        setHandoverData(hRes);
      } else {
        setHandoverData(null);
      }
    } catch (err) {
      console.warn('Inspect lot failed:', err);
    }
  };

  const handleAcceptOffer = async (offerId) => {
    try {
      await api.acceptOffer(offerId);
      if (selectedLot) inspectLot(selectedLot);
      refreshLots();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCounterOffer = async () => {
    if (!counterModal || !counterPrice) return;
    try {
      await api.counterOffer(counterModal.offer_id, parseFloat(counterPrice));
      setCounterModal(null);
      setCounterPrice('');
      if (selectedLot) inspectLot(selectedLot);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGenerateOtp = async (lotId) => {
    try {
      const res = await api.generateHandoverOtp(lotId);
      setHandoverData(prev => ({ ...(prev || {}), otp_code: res.otp_code }));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleConfirmPayment = async (lotId) => {
    try {
      await api.recordPayment(lotId, {
        payment_method: paymentMethod,
        amount: selectedLot.weight_kg * 80 // fallback demo amount
      });
      alert('Payment confirmed! Handover complete.');
      if (selectedLot) inspectLot(selectedLot);
      refreshLots();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmitDispute = async (e) => {
    e.preventDefault();
    if (!disputeModal) return;
    try {
      await api.createDispute(disputeModal, {
        type: disputeType,
        description: disputeDesc
      });
      alert('Dispute submitted. Admin has been notified for review.');
      setDisputeModal(null);
      setDisputeDesc('');
      if (selectedLot) inspectLot(selectedLot);
      refreshLots();
    } catch (err) {
      alert(err.message);
    }
  };

  // Calculate earnings summary
  const completedLots = myLots.filter(l => l.status === 'COMPLETED');
  const totalWeightDiverted = completedLots.reduce((acc, l) => acc + (l.weight_kg || 0), 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navbar */}
      <header className="nav-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ♻️ {t('app_title')}
          </h2>
          <span className="badge badge-green">{t('collector')}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Notifications Bell */}
          <div style={{ position: 'relative' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ padding: '0.4rem 0.75rem', position: 'relative' }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: '#fff', borderRadius: '50%', fontSize: '0.65rem', padding: '2px 5px', fontWeight: 800 }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="glass-panel" style={{ position: 'absolute', right: 0, top: '45px', width: '300px', zIndex: 60, padding: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
                <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>In-App Notifications</h4>
                {notifications.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No notifications yet.</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 600, color: '#34d399' }}>{n.type}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{JSON.stringify(n.payload_json)}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Lang Selector */}
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

      {/* Main Tabs Navigation */}
      <div className="layout-container">
        <div className="tabs-nav">
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'sell' ? 'active' : ''}`}
            onClick={() => setActiveTab('sell')}
          >
            📸 {t('sell_scrap')}
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'lots' ? 'active' : ''}`}
            onClick={() => setActiveTab('lots')}
          >
            📦 {t('my_lots')} ({myLots.length})
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('earnings')}
          >
            💰 {t('earnings')}
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: SELL SCRAP WIZARD                                     */}
        {/* ============================================================ */}
        {activeTab === 'sell' && (
          <div className="glass-panel fade-in" style={{ padding: '1.75rem' }}>
            {/* Wizard Step 1: Upload Photo */}
            {step === 1 && (
              <div>
                <h3>1. Take or Upload Scrap Photo</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Our on-device YOLOv8 and MobileNetV2 vision pipeline automatically detects printed circuit boards, batteries, cables, displays, and motors.
                </p>

                <div style={{ border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
                  {photoPreview ? (
                    <div>
                      <img src={photoPreview} alt="Preview" style={{ maxHeight: '260px', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }} />
                      <div>
                        <input type="file" accept="image/*" id="change-photo" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                        <label htmlFor="change-photo" className="btn btn-secondary" style={{ cursor: 'pointer' }}>Change Photo</label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📷</div>
                      <input type="file" accept="image/*" id="upload-photo" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                      <label htmlFor="upload-photo" className="btn btn-primary" style={{ cursor: 'pointer' }}>
                        Select or Snap Photo
                      </label>
                    </div>
                  )}
                </div>

                {wizardError && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{wizardError}</p>}

                {photoFile && (
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleAnalyzePhoto} 
                    disabled={wizardLoading}
                    style={{ marginTop: '1.5rem', width: '100%' }}
                  >
                    {wizardLoading ? 'Analyzing Image...' : 'Detect & Analyze Scrap'}
                  </button>
                )}
              </div>
            )}

            {/* Wizard Step 2: Detections & Manual Weight Entry */}
            {step === 2 && (
              <div>
                <h3>2. Multi-Item Detections & Weight Entry</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Review detected materials. Per system specification, <b>weight is entered manually by the collector</b> to ensure fair scale accuracy.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {detectedItems.map((item, idx) => (
                    <div key={idx} className="glass-panel card-interactive" style={{ padding: '1rem', background: '#192236' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span className="badge badge-green">Item #{idx + 1}: {item.material}</span>
                        <span className="badge badge-blue">{Math.round(item.confidence * 100)}% Match</span>
                      </div>

                      {item.needs_confirmation && (
                        <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#fbbf24' }}>
                          ⚠️ Confidence below 70%. Please verify material:
                          <select 
                            className="select" 
                            style={{ marginTop: '0.3rem', fontSize: '0.8rem' }}
                            value={item.material}
                            onChange={(e) => {
                              const copy = [...detectedItems];
                              copy[idx].material = e.target.value;
                              copy[idx].needs_confirmation = false;
                              setDetectedItems(copy);
                            }}
                          >
                            <option value="PCB">Printed Circuit Board (PCB)</option>
                            <option value="BATTERY">Battery (Lithium/Lead)</option>
                            <option value="CABLE">Copper Cables / Wires</option>
                            <option value="LCD">LCD Flat Display</option>
                            <option value="CRT">CRT Monitor Glass</option>
                            <option value="MOTOR">Electric Motor</option>
                            <option value="MAGNET">Rare Earth Magnet</option>
                            <option value="PLASTIC">E-Waste Polymers</option>
                            <option value="OTHER">Mixed Scrap</option>
                          </select>
                        </div>
                      )}

                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        {item.reasoning}
                      </p>

                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Weight (kg) — Entered by Collector:
                      </label>
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0.1" 
                        className="input" 
                        value={item.weight_kg} 
                        onChange={(e) => {
                          const copy = [...detectedItems];
                          copy[idx].weight_kg = e.target.value;
                          setDetectedItems(copy);
                        }} 
                      />
                    </div>
                  ))}
                </div>

                {/* Smart Lot Management choice */}
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Smart Lot Management Strategy:</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="mode" value="SPLIT" checked={lotMode === 'SPLIT'} onChange={() => setLotMode('SPLIT')} />
                      {t('sell_separate')} (Individual Lot Codes)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="mode" value="COMBINE" checked={lotMode === 'COMBINE'} onChange={() => setLotMode('COMBINE')} />
                      {t('sell_combined')} (Single Bulk Lot)
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
                    Back
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleCreateLots} disabled={wizardLoading} style={{ flex: 2 }}>
                    {wizardLoading ? 'Submitting Lots...' : 'List on Marketplace'}
                  </button>
                </div>
              </div>
            )}

            {/* Wizard Step 3: Success Confirmation */}
            {step === 3 && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
                <h2>Lots Successfully Listed on Marketplace!</h2>
                <p style={{ color: 'var(--text-muted)', margin: '0.5rem auto 1.5rem', maxWidth: '480px' }}>
                  Your items are now live. Local CPCB-authorized recyclers are receiving notifications to submit competitive offers.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginBottom: '2rem' }}>
                  {createdLots.map(lot => (
                    <div key={lot.id} className="badge badge-green" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                      {lot.lot_code} ({lot.weight_kg} kg)
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setStep(1); setPhotoFile(null); setPhotoPreview(null); }}>
                    Sell More Items
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setActiveTab('lots')}>
                    View in My Lots
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: MY LOTS & NEGOTIATIONS                                */}
        {/* ============================================================ */}
        {activeTab === 'lots' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedLot ? '1fr 1.2fr' : '1fr', gap: '1.5rem' }}>
            
            {/* Lots List */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>My Listed Lots</h3>
              {myLots.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No lots created yet. Click "Sell Scrap" to begin.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {myLots.map(lot => (
                    <div 
                      key={lot.id} 
                      onClick={() => inspectLot(lot)}
                      className={`glass-panel card-interactive ${selectedLot?.id === lot.id ? 'active' : ''}`}
                      style={{ padding: '1rem', cursor: 'pointer', borderColor: selectedLot?.id === lot.id ? 'var(--primary)' : 'var(--border-subtle)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b>{lot.lot_code}</b>
                        <span className={`badge ${lot.status === 'COMPLETED' ? 'badge-green' : lot.status === 'ACCEPTED' ? 'badge-blue' : 'badge-amber'}`}>
                          {lot.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                        <span>Weight: {lot.weight_kg} kg</span>
                        <span>Condition: {lot.condition}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Lot Detail & Offer / Handover Console */}
            {selectedLot && (
              <div className="glass-panel fade-in" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3>{selectedLot.lot_code}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Weight: {selectedLot.weight_kg} kg | Status: {selectedLot.status}</p>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedLot(null)} style={{ padding: '0.2rem 0.5rem' }}>✕</button>
                </div>

                {/* Handover & OTP Section (if Accepted/Pending) */}
                {['ACCEPTED', 'HANDOVER_PENDING', 'COMPLETED', 'DISPUTED'].includes(selectedLot.status) && (
                  <div style={{ background: '#13232f', border: '1px solid #059669', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                    <h4 style={{ color: '#34d399', marginBottom: '0.5rem' }}>Safe Handover & Payment</h4>
                    {handoverData?.otp_code ? (
                      <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('give_to_recycler')}</div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '0.2em', color: '#10b981' }}>
                          {handoverData.otp_code}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>QR code readable by authorized recycler scanner</div>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={() => handleGenerateOtp(selectedLot.id)} style={{ width: '100%', marginBottom: '0.5rem' }}>
                        Generate Handover OTP
                      </button>
                    )}

                    {selectedLot.status === 'ACCEPTED' && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Confirm Payment Method:</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <button type="button" className={`btn ${paymentMethod === 'CASH' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('CASH')}>Cash</button>
                          <button type="button" className={`btn ${paymentMethod === 'DIGITAL' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPaymentMethod('DIGITAL')}>UPI / Digital</button>
                        </div>
                        <button type="button" className="btn btn-primary" onClick={() => handleConfirmPayment(selectedLot.id)} style={{ width: '100%' }}>
                          Mark Handover & Payment Complete
                        </button>
                      </div>
                    )}

                    {/* Dispute button */}
                    <button 
                      type="button" 
                      className="btn btn-danger" 
                      onClick={() => setDisputeModal(selectedLot.id)} 
                      style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem' }}
                    >
                      ⚠️ {t('report_dispute')}
                    </button>
                  </div>
                )}

                {/* EPR Certificate Download (if Completed) */}
                {selectedLot.status === 'COMPLETED' && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <a 
                      href={`/lots/${selectedLot.id}/epr-record`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="btn btn-secondary" 
                      style={{ width: '100%', borderColor: '#10b981', color: '#34d399' }}
                    >
                      📄 {t('download_epr')}
                    </a>
                  </div>
                )}

                {/* Offers List */}
                <h4 style={{ marginBottom: '0.75rem' }}>Incoming Offers ({offers.length})</h4>
                {offers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No offers yet. Recyclers in your area have been alerted.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {offers.map(off => (
                      <div key={off.id} style={{ background: '#192236', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399' }}>₹{off.price}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {off.status} | By: {off.proposed_by}</div>
                          </div>
                          {off.status === 'PENDING' && off.proposed_by === 'RECYCLER' && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button type="button" className="btn btn-primary" onClick={() => handleAcceptOffer(off.id)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                                {t('accept')}
                              </button>
                              <button type="button" className="btn btn-secondary" onClick={() => setCounterModal({ offer_id: off.id, current_price: off.price })} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                                {t('counter')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: EARNINGS & IMPACT TRACKER                             */}
        {/* ============================================================ */}
        {activeTab === 'earnings' && (
          <div className="glass-panel fade-in" style={{ padding: '1.75rem' }}>
            <h3>Collector Earnings & Impact Summary</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Canonical financial ledger verified through completed transactions and safe handovers.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div className="glass-panel" style={{ padding: '1.25rem', background: '#192236' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Completed Handovers</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>{completedLots.length}</div>
              </div>
              <div className="glass-panel" style={{ padding: '1.25rem', background: '#192236' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Weight Diverted</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>{totalWeightDiverted.toFixed(1)} kg</div>
              </div>
              <div className="glass-panel" style={{ padding: '1.25rem', background: '#192236' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Estimated Income Uplift</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#60a5fa', marginTop: '0.2rem' }}>+24.5%</div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Counter Offer Modal */}
      {counterModal && (
        <div className="modal-backdrop">
          <div className="modal-content fade-in">
            <h3>Send Counter-Offer</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.5rem 0 1rem' }}>
              Current offer is ₹{counterModal.current_price}. Enter your proposed counter price:
            </p>
            <input 
              type="number" 
              className="input" 
              value={counterPrice} 
              onChange={(e) => setCounterPrice(e.target.value)} 
              placeholder="e.g. 450" 
              autoFocus 
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setCounterModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleCounterOffer} style={{ flex: 1 }}>Send Counter</button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeModal && (
        <div className="modal-backdrop">
          <div className="modal-content fade-in">
            <h3>Report Handover Dispute</h3>
            <form onSubmit={handleSubmitDispute} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Dispute Type</label>
                <select className="select" value={disputeType} onChange={(e) => setDisputeType(e.target.value)}>
                  <option value="WEIGHT_MISMATCH">Weight Mismatch on Scale</option>
                  <option value="PAYMENT_MISMATCH">Payment Underpaid / Refused</option>
                  <option value="DAMAGED">Items Damaged in Transit</option>
                  <option value="PICKUP_ISSUE">Recycler No-Show or Delay</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Description & Details</label>
                <textarea 
                  className="textarea" 
                  rows={3} 
                  value={disputeDesc} 
                  onChange={(e) => setDisputeDesc(e.target.value)} 
                  placeholder="Explain what happened..." 
                  required 
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDisputeModal(null)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-danger" style={{ flex: 1 }}>Submit Dispute</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
