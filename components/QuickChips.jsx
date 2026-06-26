'use client';
import React from 'react';

// Chip sets per context
const CHIP_SETS = {
  product_list: [
    { label: '🔍 Show me more options', msg: 'Can you show me more options? Different ones.' },
    { label: '🚚 Check delivery', msg: 'Can you check delivery availability for these?' },
    { label: '💬 Tell me about the best one', msg: 'Which one do you recommend the most and why?' },
    { label: '🎁 Add a gift message', msg: 'I want to send this as a gift with a message.' },
  ],
  delivery_check: [
    { label: '🛒 Proceed to checkout', msg: 'Great! Let me go ahead with checkout.' },
    { label: '📅 Try a different date', msg: 'Can you check delivery for a different date?' },
    { label: '🏙️ Try a different city', msg: 'Can you check delivery to a different city?' },
  ],
  checkout: [
    { label: '🛍️ Continue shopping', msg: 'I want to add more items to my order.' },
    { label: '🎁 What goes well with this?', msg: 'What would complement my order nicely?' },
  ],
  product_details: [
    { label: '🛒 Add to cart', action: 'add_to_cart' },
    { label: '🚚 Check delivery for this', msg: 'Can you check delivery for this product?' },
    { label: '🔍 Show similar products', msg: 'Show me similar products to this one.' },
  ],
  general: [
    { label: '🎂 Order a cake', msg: 'I want to order a birthday cake.' },
    { label: '🌹 Send flowers', msg: 'I want to send flowers to someone.' },
    { label: '📱 Browse electronics', msg: 'Show me popular electronics on Kapruka.' },
    { label: '🛒 What\'s popular?', msg: 'What are the most popular items on Kapruka right now?' },
  ],
};

export default function QuickChips({ customUIType, onSend, onAddToCart, productData }) {
  const chips = CHIP_SETS[customUIType] || CHIP_SETS.general;

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '7px',
      marginTop: '12px',
      paddingTop: '12px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      {chips.map((chip, i) => (
        <button
          key={i}
          onClick={() => {
            if (chip.action === 'add_to_cart' && onAddToCart && productData) {
              onAddToCart(productData);
            } else if (chip.msg) {
              onSend(chip.msg);
            }
          }}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '6px 13px',
            fontSize: '12px',
            color: '#b3aec5',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            fontFamily: 'inherit',
            fontWeight: '500',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(93,63,158,0.2)';
            e.currentTarget.style.borderColor = 'rgba(93,63,158,0.5)';
            e.currentTarget.style.color = '#f5f4f8';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = '#b3aec5';
          }}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
