'use client';
import React, { useEffect, useRef } from 'react';
import ProductCarousel from './ProductCarousel';

export function DeliveryStatus({ data }) {
  if (!data) return null;
  const ok = data.available;

  return (
    <div style={{
      marginTop: '10px',
      padding: '14px 16px',
      borderRadius: '14px',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
      background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
      display: 'flex', alignItems: 'flex-start', gap: '12px',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
        fontSize: '18px',
      }}>
        {ok ? '✓' : '✗'}
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{
          margin: '0 0 4px',
          fontSize: '14px', fontWeight: '700',
          color: ok ? '#10b981' : '#ef4444',
        }}>
          {ok ? 'Delivery Available!' : 'Delivery Not Available'}
        </h4>
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#b3aec5', lineHeight: '1.5' }}>
          {data.message}
        </p>
        {ok && data.fee > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: '8px', padding: '4px 10px',
          }}>
            <span style={{ fontSize: '11px', color: '#b3aec5' }}>Delivery fee:</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>
              {data.currency} {parseFloat(data.fee).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function CheckoutTicket({ data }) {
  if (!data) return null;
  return (
    <div style={{
      marginTop: '12px',
      background: 'linear-gradient(135deg, rgba(248,218,8,0.06) 0%, rgba(64,41,112,0.15) 100%)',
      border: '1px solid rgba(248,218,8,0.2)',
      borderRadius: '16px',
      padding: '18px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: 'linear-gradient(90deg, #f8da08, #402970)',
      }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <span style={{
            fontSize: '9px', fontWeight: '800', letterSpacing: '1.5px',
            color: '#f8da08', textTransform: 'uppercase',
            background: 'rgba(248,218,8,0.1)', padding: '3px 8px',
            borderRadius: '5px', border: '1px solid rgba(248,218,8,0.2)',
          }}>
            🎉 Order Created
          </span>
          <h4 style={{ margin: '8px 0 0', fontSize: '15px', fontWeight: '700', color: '#f5f4f8' }}>
            Ready to pay!
          </h4>
        </div>
        <span style={{ fontSize: '28px' }}>💳</span>
      </div>

      <p style={{ fontSize: '12px', color: '#b3aec5', margin: '0 0 12px', lineHeight: '1.5' }}>
        Your guest order has been created. Click below to complete your secure payment and schedule delivery.
      </p>

      {data.orderRef && (
        <div style={{
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '8px', padding: '8px 12px',
          display: 'flex', justifyContent: 'space-between',
          marginBottom: '14px', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: '11px', color: '#78738a' }}>Reference:</span>
          <strong style={{ fontSize: '12px', color: '#f8da08', letterSpacing: '1px' }}>
            {data.orderRef}
          </strong>
        </div>
      )}

      {data.payUrl && (
        <a
          href={data.payUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', width: '100%',
            background: 'linear-gradient(135deg, #f8da08, #e6c000)',
            color: '#120e1c',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '13px', fontWeight: '800',
            textAlign: 'center', textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(248,218,8,0.3)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          Proceed to Secure Payment →
        </a>
      )}
    </div>
  );
}

export function ProductDetails({ data }) {
  if (!data) return null;
  return (
    <div style={{
      marginTop: '10px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      {data.image && (
        <div style={{ height: '200px', overflow: 'hidden' }}>
          <img src={data.image} alt={data.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ padding: '14px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#f5f4f8', margin: '0 0 8px' }}>{data.title}</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
          {data.price && <span style={{ color: '#f8da08', fontWeight: '800', fontSize: '16px' }}>{data.price}</span>}
          {data.stock && <span style={{ fontSize: '11px', color: '#10b981' }}>✓ {data.stock}</span>}
          {data.category && <span style={{ fontSize: '11px', color: '#78738a' }}>• {data.category}</span>}
        </div>
        {data.description && (
          <p style={{ fontSize: '12px', color: '#b3aec5', lineHeight: '1.6', margin: '0 0 12px' }}>
            {data.description}
          </p>
        )}

      </div>
    </div>
  );
}

export function CustomUI({ customUI, onAddToCart }) {
  if (!customUI) return null;
  switch (customUI.type) {
    case 'product_list':
      return <ProductCarousel products={customUI.data} onAddToCart={onAddToCart} />;
    case 'delivery_check':
      return <DeliveryStatus data={customUI.data} />;
    case 'checkout':
      return <CheckoutTicket data={customUI.data} />;
    case 'product_details':
      return <ProductDetails data={customUI.data} />;
    default:
      return null;
  }
}
