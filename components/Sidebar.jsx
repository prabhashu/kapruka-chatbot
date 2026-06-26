'use client';
import React, { useState, useEffect } from 'react';

export default function Sidebar({ cart, updateCartQty, deliveryCity, setDeliveryCity, deliveryDate, setDeliveryDate, onCheckDelivery, onCheckout, isOpen, onClose }) {
  const [cities, setCities] = useState([]);
  const [cityInput, setCityInput] = useState('');
  const [recipient, setRecipient] = useState({ name: '', phone: '', address: '' });
  const [sender, setSender] = useState({ name: '', anonymous: false });
  const [giftMessage, setGiftMessage] = useState('');
  const [activeTab, setActiveTab] = useState('cart'); // 'cart' | 'checkout'

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = cart.reduce((sum, i) => {
    const p = typeof i.price === 'string' ? parseFloat(i.price.replace(/[^0-9.]/g, '')) : i.price;
    return sum + ((p || 0) * i.quantity);
  }, 0);

  useEffect(() => {
    if (cityInput.length < 2) { setCities([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/cities?q=${encodeURIComponent(cityInput)}`)
        .then(r => r.json()).then(d => setCities(d)).catch(console.error);
    }, 300);
    return () => clearTimeout(t);
  }, [cityInput]);

  const inputStyle = {
    width: '100%', background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
    padding: '10px 12px', fontSize: '13px', color: 'white',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  const labelStyle = { fontSize: '11px', fontWeight: '600', color: '#78738a', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: isOpen ? 'min(100vw, 360px)' : '0',
        background: 'rgba(18,14,28,0.98)', backdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column',
        zIndex: 50,
        transition: 'width 0.3s ease, transform 0.3s ease',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🛒</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f5f4f8' }}>Your Cart</h2>
              <p style={{ margin: 0, fontSize: '11px', color: '#78738a' }}>{totalItems} {totalItems === 1 ? 'item' : 'items'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '6px 10px', color: '#b3aec5', cursor: 'pointer', fontSize: '14px',
          }}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)' }}>
          {['cart', 'checkout'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '10px', fontSize: '12px', fontWeight: '600',
                color: activeTab === tab ? '#f8da08' : '#78738a',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab ? '2px solid #f8da08' : '2px solid transparent',
                transition: 'all 0.2s', fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'cart' ? '🛍️ Cart' : '📦 Checkout'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {activeTab === 'cart' && (
            <>
              {/* Cart items */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px' }}>
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#78738a', fontSize: '13px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛒</div>
                    Your cart is empty
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {cart.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex', gap: '10px', alignItems: 'center',
                        paddingBottom: idx < cart.length - 1 ? '12px' : 0,
                        borderBottom: idx < cart.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}>
                        {/* Thumbnail */}
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0,
                          background: '#1a1430', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                          {item.image ? (
                            <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '18px' }}>📦</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '12px', fontWeight: '600', color: '#f5f4f8',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            marginBottom: '3px',
                          }}>
                            {item.title}
                          </div>
                          <div style={{ color: '#f8da08', fontSize: '12px', fontWeight: '700' }}>
                            LKR {(((typeof item.price === 'string' ? parseFloat(item.price.replace(/[^0-9.]/g, '')) : item.price) || 0) * item.quantity).toLocaleString()}
                          </div>
                        </div>
                        {/* Qty controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => updateCartQty(item.product_id, -1)} style={{
                            width: '24px', height: '24px', borderRadius: '6px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#f5f4f8', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>−</button>
                          <span style={{ fontSize: '12px', fontWeight: '700', minWidth: '16px', textAlign: 'center' }}>{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.product_id, 1)} style={{
                            width: '24px', height: '24px', borderRadius: '6px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#f5f4f8', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtotal */}
              {cart.length > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px',
                  background: 'rgba(248,218,8,0.06)', border: '1px solid rgba(248,218,8,0.15)',
                  borderRadius: '10px',
                }}>
                  <span style={{ fontSize: '13px', color: '#b3aec5', fontWeight: '600' }}>Subtotal</span>
                  <span style={{ fontSize: '15px', color: '#f8da08', fontWeight: '800' }}>
                    LKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Delivery calculator */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: '700', color: '#5d3f9e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🚚 Check Delivery
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <label style={labelStyle}>City</label>
                    <input
                      type="text"
                      value={cityInput}
                      onChange={e => setCityInput(e.target.value)}
                      placeholder="Type city name..."
                      style={inputStyle}
                    />
                    {cities.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: '#1e1436', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px', marginTop: '4px',
                        maxHeight: '180px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      }}>
                        {cities.map((city, i) => (
                          <div key={i} onClick={() => { setCityInput(city.name); setDeliveryCity(city.name); setCities([]); }} style={{
                            padding: '9px 12px', fontSize: '13px', cursor: 'pointer', color: '#f5f4f8',
                            borderBottom: i < cities.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(93,63,158,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            {city.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={e => setDeliveryDate(e.target.value)}
                      style={{ ...inputStyle, colorScheme: 'dark' }}
                    />
                  </div>
                  <button
                    onClick={() => onCheckDelivery(cityInput, deliveryDate)}
                    style={{
                      width: '100%', padding: '10px',
                      background: 'rgba(93,63,158,0.2)', border: '1px solid rgba(93,63,158,0.4)',
                      color: '#b3aec5', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(93,63,158,0.35)'; e.currentTarget.style.color = '#f5f4f8'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(93,63,158,0.2)'; e.currentTarget.style.color = '#b3aec5'; }}
                  >
                    Check Rate →
                  </button>
                </div>
              </div>

              {/* Go to checkout button */}
              {cart.length > 0 && (
                <button
                  onClick={() => setActiveTab('checkout')}
                  style={{
                    width: '100%', padding: '13px',
                    background: 'linear-gradient(135deg, #f8da08, #e6c000)',
                    border: 'none', borderRadius: '12px',
                    color: '#120e1c', fontSize: '14px', fontWeight: '800',
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 4px 16px rgba(248,218,8,0.25)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(248,218,8,0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(248,218,8,0.25)'; }}
                >
                  Checkout ({totalItems} {totalItems === 1 ? 'item' : 'items'}) →
                </button>
              )}
            </>
          )}

          {activeTab === 'checkout' && (
            <form
              onSubmit={e => { e.preventDefault(); onCheckout({ recipient, sender, giftMessage, city: deliveryCity }); }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: '#5d3f9e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📦 Recipient
                </h3>
                <div><label style={labelStyle}>Full Name *</label>
                  <input required type="text" placeholder="John Silva" value={recipient.name} onChange={e => setRecipient({ ...recipient, name: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Phone *</label>
                  <input required type="tel" placeholder="0771234567" value={recipient.phone} onChange={e => setRecipient({ ...recipient, phone: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Address *</label>
                  <input required type="text" placeholder="123, Main Street" value={recipient.address} onChange={e => setRecipient({ ...recipient, address: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>City (select from cart tab)</label>
                  <input readOnly type="text" value={deliveryCity} placeholder="Select city above →" style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} /></div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: '#5d3f9e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  👤 Sender
                </h3>
                <div><label style={labelStyle}>Your Name *</label>
                  <input required type="text" placeholder="Your name" value={sender.name} onChange={e => setSender({ ...sender, name: e.target.value })} style={inputStyle} /></div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#b3aec5', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sender.anonymous} onChange={e => setSender({ ...sender, anonymous: e.target.checked })} style={{ accentColor: '#5d3f9e' }} />
                  Send anonymously
                </label>
                <div><label style={labelStyle}>Gift Message (optional)</label>
                  <textarea
                    placeholder="Happy Birthday! With love... 💕"
                    value={giftMessage}
                    onChange={e => setGiftMessage(e.target.value)}
                    rows="3"
                    style={{ ...inputStyle, resize: 'none', lineHeight: '1.5' }}
                  /></div>
              </div>

              <button
                type="submit"
                disabled={!deliveryCity || cart.length === 0}
                style={{
                  width: '100%', padding: '13px',
                  background: (!deliveryCity || cart.length === 0)
                    ? 'rgba(255,255,255,0.05)'
                    : 'linear-gradient(135deg, #5d3f9e, #402970)',
                  border: `1px solid ${(!deliveryCity || cart.length === 0) ? 'rgba(255,255,255,0.08)' : 'rgba(93,63,158,0.5)'}`,
                  borderRadius: '12px',
                  color: (!deliveryCity || cart.length === 0) ? '#78738a' : 'white',
                  fontSize: '14px', fontWeight: '800',
                  cursor: (!deliveryCity || cart.length === 0) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: (!deliveryCity || cart.length === 0) ? 'none' : '0 4px 16px rgba(93,63,158,0.3)',
                }}
              >
                {(!deliveryCity || cart.length === 0) ? 'Add items & select city first' : 'Create Order & Get Payment Link →'}
              </button>
            </form>
          )}
        </div>
      </aside>
    </>
  );
}
