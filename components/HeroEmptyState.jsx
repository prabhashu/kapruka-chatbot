'use client';
import React from 'react';

const SCENARIOS = [
  {
    emoji: '💔',
    title: 'Broke up recently...',
    subtitle: 'Need flowers. Fast.',
    prompt: "Machang, I just broke up with my girlfriend. I need to send her flowers to say sorry. Help me out noh.",
    color: '#ef4444',
    glow: 'rgba(239,68,68,0.15)',
    border: 'rgba(239,68,68,0.25)',
  },
  {
    emoji: '🎂',
    title: 'Birthday surprise!',
    subtitle: 'Cake + gifts sorted',
    prompt: "It's my mom's birthday tomorrow! I need a birthday cake and maybe a small gift. What do you have?",
    color: '#f8da08',
    glow: 'rgba(248,218,8,0.12)',
    border: 'rgba(248,218,8,0.25)',
  },
  {
    emoji: '🛒',
    title: 'Just shopping for me',
    subtitle: 'Everyday essentials',
    prompt: "I need to order some groceries and household items. What's popular right now?",
    color: '#10b981',
    glow: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.25)',
  },
  {
    emoji: '🎁',
    title: 'Sending a gift overseas',
    subtitle: 'To Sri Lanka, with love',
    prompt: "I'm abroad and I want to send a nice gift to my parents in Colombo. What can I send?",
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.25)',
  },
  {
    emoji: '📱',
    title: 'New phone / electronics',
    subtitle: 'Tech deals await',
    prompt: "I'm looking for a good Android phone under LKR 50,000. What do you have?",
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.25)',
  },
  {
    emoji: '🌸',
    title: 'Valentine / Anniversary',
    subtitle: 'Make it memorable',
    prompt: "Our anniversary is coming up. I want flowers, a cake, and maybe something special. Budget around 5000 rupees.",
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.12)',
    border: 'rgba(236,72,153,0.25)',
  },
];

export default function HeroEmptyState({ onSelectScenario }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '24px 16px 16px',
      gap: '28px',
      overflowY: 'auto',
    }}>
      {/* Logo + greeting */}
      <div style={{ textAlign: 'center', animation: 'message-in 0.5s ease-out forwards' }}>
        <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
          <img
            src="https://www.kapruka.com/static/image/send-online-logo.png"
            alt="Kapruka"
            style={{ height: '36px', objectFit: 'contain' }}
          />
        </div>
        <h2 style={{
          fontSize: '22px', fontWeight: '800',
          color: '#f5f4f8', margin: '0 0 6px',
          letterSpacing: '-0.3px',
        }}>
          Ayubowan! I'm <span style={{ color: '#f8da08' }}>Ayu</span> 👋
        </h2>
        <p style={{
          fontSize: '14px', color: '#b3aec5',
          margin: 0, lineHeight: '1.5',
          maxWidth: '320px',
        }}>
          Your personal Kapruka shopper. Tell me what you need — in English, Singlish, or even Sinhala!
        </p>
      </div>

      {/* Scenario cards */}
      <div style={{
        width: '100%', maxWidth: '680px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
        gap: '10px',
      }}>
        {SCENARIOS.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelectScenario(s.prompt)}
            style={{
              background: s.glow,
              border: `1px solid ${s.border}`,
              borderRadius: '14px',
              padding: '14px 16px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              animationDelay: `${i * 0.07}s`,
              animation: 'message-in 0.4s ease-out forwards',
              opacity: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${s.glow}`;
              e.currentTarget.style.borderColor = s.color;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = s.border;
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>{s.emoji}</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#f5f4f8', marginBottom: '2px' }}>{s.title}</div>
            <div style={{ fontSize: '11px', color: '#b3aec5' }}>{s.subtitle}</div>
          </button>
        ))}
      </div>

      {/* Hint text */}
      <p style={{
        fontSize: '12px', color: '#78738a',
        textAlign: 'center', margin: 0,
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span>⌨️</span> Or just type anything — I understand Singlish & Sinhala too
      </p>
    </div>
  );
}
