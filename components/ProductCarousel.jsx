'use client';
import React, { useState } from 'react';

function formatPrice(amount, currency = 'LKR') {
  return `${currency} ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function decodeHtml(str) {
  if (!str) return str;
  return str
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#8220;/g, '\u201C').replace(/&#8221;/g, '\u201D')
    .replace(/&#8216;/g, '\u2018').replace(/&#8217;/g, '\u2019')
    .replace(/&#8226;/g, '\u2022').replace(/&#8364;/g, '\u20AC')
    .replace(/&nbsp;/g, ' ');
}

// ─── Product Detail Modal (shown inline in chat) ──────────────────────────────
function ProductDetailModal({ product, onClose, onAddToCart, isLoadingDetails }) {
  // ALL hooks must come before any conditional return (React rules)
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  if (!product) return null;

  const images = product.images?.length > 0 ? product.images : product.image ? [product.image] : [];
  const safeImg = activeImg < images.length ? activeImg : 0;

  const handleAdd = () => {
    onAddToCart(product);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const displayPrice = product.price != null && product.price !== ''
    ? (typeof product.price === 'number'
        ? `${product.currency || 'LKR'} ${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        : product.price)
    : null;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
      zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', animation: 'fadeIn 0.2s ease',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'linear-gradient(160deg, #1c1535 0%, #120e1c 100%)',
        border: '1px solid rgba(93,63,158,0.4)',
        borderRadius: '22px',
        width: '100%', maxWidth: '500px',
        maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(93,63,158,0.2)',
        position: 'relative',
        animation: 'slideUp 0.25s ease',
      }}>
        {/* Close btn */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '12px', right: '12px', zIndex: 10,
            width: '30px', height: '30px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: '14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit', backdropFilter: 'blur(4px)',
          }}
        >✕</button>

        {/* Main image */}
        <div style={{
          height: '220px', background: '#0e0b18', overflow: 'hidden',
          borderRadius: '22px 22px 0 0', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {images[safeImg] ? (
            <img src={images[safeImg]} alt={decodeHtml(product.title)}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }} />
          ) : (
            <div style={{ fontSize: '56px', opacity: 0.12 }}>🛍️</div>
          )}
          {/* Gradient overlay at bottom */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px',
            background: 'linear-gradient(transparent, #120e1c)',
          }} />
          {product.shipping && (
            <span style={{
              position: 'absolute', top: '10px', left: '10px',
              background: 'rgba(16,185,129,0.92)', color: 'white',
              padding: '3px 9px', borderRadius: '999px',
              fontSize: '9px', fontWeight: '700', textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>🌍 Intl Shipping</span>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', padding: '10px 14px 2px', overflowX: 'auto' }}>
            {images.slice(0, 6).map((img, i) => (
              <div key={i}
                onClick={() => setActiveImg(i)}
                style={{
                  width: '44px', height: '44px', borderRadius: '8px',
                  overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                  border: `2px solid ${i === safeImg ? '#5d3f9e' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'border-color 0.15s', background: '#0e0b18',
                }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '14px 16px 18px' }}>
          {product.category && (
            <span style={{
              fontSize: '10px', color: '#5d3f9e', textTransform: 'uppercase',
              letterSpacing: '0.1em', fontWeight: '700',
              background: 'rgba(93,63,158,0.15)', padding: '2px 8px', borderRadius: '4px',
            }}>{product.category}</span>
          )}
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#f5f4f8', margin: '8px 0 10px', lineHeight: '1.4' }}>
            {decodeHtml(product.title)}
          </h2>

          {/* Price & stock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {displayPrice && (
              <span style={{
                color: '#f8da08', fontWeight: '800', fontSize: '22px',
                textShadow: '0 0 20px rgba(248,218,8,0.3)',
              }}>{displayPrice}</span>
            )}
            {product.stock && (
              <span style={{
                fontSize: '10px', padding: '3px 8px', borderRadius: '6px',
                background: String(product.stock).toLowerCase().includes('out') ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                color: String(product.stock).toLowerCase().includes('out') ? '#ef4444' : '#10b981',
                border: `1px solid ${String(product.stock).toLowerCase().includes('out') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                fontWeight: '700',
              }}>✓ {product.stock}</span>
            )}
          </div>

          {/* Description — show shimmer if loading */}
          {isLoadingDetails ? (
            <div style={{ marginBottom: '14px' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{
                  height: '12px', borderRadius: '6px', marginBottom: '6px',
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s infinite',
                  width: i === 3 ? '60%' : '100%',
                }} />
              ))}
            </div>
          ) : product.description ? (
            <p style={{ fontSize: '13px', color: '#b3aec5', lineHeight: '1.65', margin: '0 0 14px' }}>
              {decodeHtml(product.description)}
            </p>
          ) : null}

          {/* Meta info */}
          {(product.vendor || product.weight) && (
            <div style={{
              background: 'rgba(255,255,255,0.025)', borderRadius: '10px',
              padding: '10px 12px', marginBottom: '14px',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', gap: '20px', flexWrap: 'wrap',
            }}>
              {product.vendor && product.vendor !== 'Kapruka' && (
                <div>
                  <div style={{ fontSize: '9px', color: '#78738a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Vendor</div>
                  <div style={{ fontSize: '13px', color: '#f5f4f8', fontWeight: '600' }}>{product.vendor}</div>
                </div>
              )}
              {product.weight && product.weight !== 'N/A' && (
                <div>
                  <div style={{ fontSize: '9px', color: '#78738a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Weight</div>
                  <div style={{ fontSize: '13px', color: '#f5f4f8', fontWeight: '600' }}>{product.weight}</div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>

            <button
              onClick={handleAdd}
              style={{
                flex: 1,
                background: addedToCart
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'linear-gradient(135deg, #5d3f9e, #402970)',
                border: 'none', color: 'white',
                padding: '13px', borderRadius: '12px',
                fontSize: '14px', fontWeight: '700',
                cursor: 'pointer', transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                boxShadow: addedToCart ? '0 4px 16px rgba(16,185,129,0.3)' : '0 4px 16px rgba(93,63,158,0.3)',
              }}
            >
              {addedToCart ? '✓ Added to Cart!' : '+ Add to Cart'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
      `}</style>
    </div>
  );
}

// ─── Main Carousel ────────────────────────────────────────────────────────────
export default function ProductCarousel({ products, onAddToCart, onViewDetails }) {
  const [addedIds, setAddedIds] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);

  if (!products || products.length === 0) return null;

  const handleAdd = (product) => {
    onAddToCart(product);
    setAddedIds(prev => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedIds(prev => { const n = { ...prev }; delete n[product.id]; return n; });
    }, 1800);
  };

  const handleDetails = async (product) => {
    // Show the modal immediately with whatever data we have from the search
    // so user sees the product right away, not a blank loading state
    setModalProduct(product);

    // If the product already has rich data, no need to fetch more
    if (product.description && product.description.length > 10) return;
    if (!product.id) return;

    // Fetch full details in background and update the modal
    setLoadingId(product.id);
    try {
      const res = await fetch('/api/product-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();
      if (data.product) {
        // Merge: keep original image/url if API returns empty ones
        const enriched = {
          ...product,              // base: search result data
          ...data.product,         // overlay: API full details
          // Always prefer non-empty values
          image: data.product.image || product.image,
          images: (data.product.images?.length > 0) ? data.product.images : (product.image ? [product.image] : []),
          title: data.product.title || product.title,
          price: data.product.price || product.price,
          url: data.product.url || product.url,
        };
        setModalProduct(enriched);
      }
    } catch {
      // Keep existing modal with original product data
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      {modalProduct && (
        <ProductDetailModal
          product={modalProduct}
          onClose={() => { setModalProduct(null); setLoadingId(null); }}
          onAddToCart={(p) => { onAddToCart(p); }}
          isLoadingDetails={loadingId !== null}
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.15) rgba(255, 255, 255, 0.02);
        }
      `}</style>
      <div
        className="custom-scrollbar"
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '12px',
          width: '100%',
          paddingBottom: '12px', /* extra padding for scrollbar */
          minWidth: 0,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {products.map((product, idx) => (
          <div
            key={idx}
            style={{
              flex: '0 0 auto',
              width: '260px',
              scrollSnapAlign: 'start',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
              minWidth: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(93,63,158,0.22)';
              e.currentTarget.style.borderColor = 'rgba(93,63,158,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            {/* Image — clickable to view details */}
            <div
              style={{
                width: '100%', aspectRatio: '4/3',
                background: 'linear-gradient(135deg, #1a1430 0%, #120e1c 100%)',
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, cursor: 'pointer',
              }}
              onClick={() => handleDetails(product)}
            >
              {product.image ? (
                <img
                  src={product.image}
                  alt={decodeHtml(product.title)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                />
              ) : (
                <div style={{ fontSize: '36px', opacity: 0.25 }}>🛍️</div>
              )}

              {/* Counter pill */}
              <span style={{
                position: 'absolute', top: '8px', left: '8px',
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                color: 'white', padding: '2px 7px', borderRadius: '999px',
                fontSize: '10px', fontWeight: '700',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                {idx + 1}/{products.length}
              </span>

              {/* Int'l badge */}
              {product.shipping && (
                <span style={{
                  position: 'absolute', top: '8px', right: '8px',
                  background: 'rgba(16,185,129,0.85)', backdropFilter: 'blur(4px)',
                  color: 'white', padding: '2px 7px', borderRadius: '999px',
                  fontSize: '9px', fontWeight: '700', textTransform: 'uppercase',
                  border: '1px solid rgba(16,185,129,0.4)',
                }}>
                  🌍 Intl
                </span>
              )}

              {/* Loading overlay */}
              {loadingId === product.id && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(18,14,28,0.7)', backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    border: '3px solid rgba(93,63,158,0.3)',
                    borderTopColor: '#5d3f9e',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                </div>
              )}
            </div>

            {/* Info section */}
            <div style={{ padding: '11px 12px 13px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {/* Title */}
              <h4
                style={{
                  fontSize: '13px', fontWeight: '600',
                  color: '#f5f4f8', lineHeight: '1.4', margin: 0,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  minHeight: '36px', cursor: 'pointer',
                }}
                onClick={() => handleDetails(product)}
              >
                {decodeHtml(product.title)}
              </h4>

              {/* Price row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                <span style={{ color: '#f8da08', fontWeight: '800', fontSize: '14px', whiteSpace: 'nowrap' }}>
                  {formatPrice(product.price, product.currency)}
                </span>
                <StockBadge stock={product.stock} />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                <button
                  onClick={() => handleDetails(product)}
                  disabled={loadingId === product.id}
                  style={{
                    flex: '0 0 auto',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#b3aec5',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    fontSize: '11px', fontWeight: '600',
                    textAlign: 'center', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: '3px',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#f5f4f8'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#b3aec5'; }}
                >
                  {loadingId === product.id ? '...' : 'Details'}
                </button>
                <button
                  onClick={() => handleAdd(product)}
                  disabled={addedIds[product.id]}
                  style={{
                    flex: 1,
                    background: addedIds[product.id]
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'linear-gradient(135deg, #5d3f9e, #402970)',
                    border: `1px solid ${addedIds[product.id] ? 'rgba(16,185,129,0.4)' : 'rgba(93,63,158,0.5)'}`,
                    color: 'white',
                    padding: '8px 6px',
                    borderRadius: '10px',
                    fontSize: '12px', fontWeight: '700',
                    cursor: addedIds[product.id] ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {addedIds[product.id] ? '✓ Added!' : '+ Add to Cart'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function StockBadge({ stock }) {
  const isLow = stock?.toLowerCase().includes('low');
  const isOut = stock?.toLowerCase().includes('out');
  return (
    <span style={{
      fontSize: '9px', padding: '2px 6px', borderRadius: '5px',
      background: isOut ? 'rgba(239,68,68,0.15)' : isLow ? 'rgba(248,218,8,0.12)' : 'rgba(16,185,129,0.12)',
      color: isOut ? '#ef4444' : isLow ? '#f8da08' : '#10b981',
      border: `1px solid ${isOut ? 'rgba(239,68,68,0.3)' : isLow ? 'rgba(248,218,8,0.3)' : 'rgba(16,185,129,0.3)'}`,
      fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em',
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {isOut ? 'Out' : isLow ? 'Low' : 'In Stock'}
    </span>
  );
}
