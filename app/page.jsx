"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { CustomUI } from '../components/CustomUIs';
import HeroEmptyState from '../components/HeroEmptyState';
import QuickChips from '../components/QuickChips';

// Simple markdown renderer: bold, italic, line breaks, bullet lists
function renderMarkdown(text) {
  if (!text) return '';
  // Normalize Windows line endings to prevent regex failures
  let html = text.replace(/\r/g, '');

  // Escape HTML first
  html = html
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Bullet lists
  html = html.replace(/^[•\-]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, match => `<ul style="margin:6px 0 6px 16px;padding:0;list-style:disc;">${match}</ul>`);
  
  // Paragraphs and Line breaks
  // Split by 2 or more newlines to create paragraphs, applying a controlled bottom margin instead of full <br/><br/>
  html = html.split(/\n{2,}/).map((p, idx, arr) => {
    // Replace remaining single newlines with <br/>
    const content = p.replace(/\n/g, '<br/>');
    const margin = idx === arr.length - 1 ? '0' : '10px';
    return `<p style="margin: 0 0 ${margin} 0; line-height: 1.5;">${content}</p>`;
  }).join('');
  
  return html;
}

export default function Page() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [internalHistory, setInternalHistory] = useState([]);
  const [cart, setCart] = useState([]);
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [cartPulse, setCartPulse] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          setSelectedImage(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('kapruka_cart');
    if (saved) {
      try { setCart(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem('kapruka_cart', JSON.stringify(cart));
  }, [cart]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        product_id: product.id,
        title: product.title,
        price: product.price,
        image: product.image || '',
        quantity: 1,
      }];
    });
    // Pulse animation on cart button
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 700);
  }, []);

  const updateCartQty = useCallback((productId, delta) => {
    setCart(prev =>
      prev.map(i => i.product_id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
          .filter(i => i.quantity > 0)
    );
  }, []);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInput(prev => prev + (prev ? ' ' : '') + transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const sendMessage = useCallback(async (text) => {
    if ((!text?.trim() && !selectedImage) || isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const currentImage = selectedImage;
    const newMsg = { role: 'user', text, image: currentImage };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);
    inputRef.current?.focus();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.concat(newMsg).map(m => ({ role: m.role, content: m.text, image: m.image })),
          text,
          image: currentImage,
          internalHistory,
          cartItems: cart.length > 0 ? cart : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInternalHistory(data.internalHistory || []);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.content || '',
        customUI: data.customUI || null,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `⚠️ **Error:** ${err.message}`,
        customUI: null,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, internalHistory, cart, isLoading, isListening, selectedImage]);

  const handleCheckDelivery = (city, date) => {
    if (!city) { alert('Please select a city first.'); return; }
    const pId = cart.length > 0 ? cart[0].product_id : '';
    const msg = `Can you check if Kapruka delivers to "${city}" on ${date}${pId ? ` for product ${pId}` : ''}?`;
    setIsSidebarOpen(false);
    sendMessage(msg);
  };

  const handleCheckout = (formData) => {
    const cartPayload = cart.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
    const msg = `Please create a guest checkout order for me.
Here are the checkout details:
- **Cart**: ${JSON.stringify(cartPayload)}
- **Recipient**: ${formData.recipient.name} (${formData.recipient.phone}), Address: ${formData.recipient.address}, City: ${formData.city}
- **Delivery Date**: ${deliveryDate}
- **Sender**: ${formData.sender.name} (Anonymous: ${formData.sender.anonymous})
${formData.giftMessage ? `- **Gift Message**: "${formData.giftMessage}"` : ''}`;

    setIsSidebarOpen(false);
    setMessages(prev => [...prev, { role: 'user', text: `Please process my checkout order to ${formData.recipient.name} in ${formData.city}.` }]);
    setIsLoading(true);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.text })), text: msg, internalHistory }),
    })
      .then(r => r.json())
      .then(data => {
        setInternalHistory(data.internalHistory || []);
        setMessages(prev => [...prev, { role: 'assistant', text: data.content, customUI: data.customUI }]);
      })
      .catch(err => setMessages(prev => [...prev, { role: 'assistant', text: `⚠️ **Error:** ${err.message}` }]))
      .finally(() => setIsLoading(false));
  };

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const isEmptyChat = messages.length === 0 && !isLoading;

  return (
    <div style={{ height: '100dvh', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at 50% 0%, #1e1436 0%, #120e1c 70%)' }}>
      
      {/* Header */}
      <header style={{
        height: '64px', flexShrink: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 16px',
        background: 'rgba(18,14,28,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        zIndex: 20,
      }}>
        <div 
          onClick={() => window.location.href = '/'}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
          {/* Kapruka Logo */}
          <img
            src="https://www.kapruka.com/static/image/send-online-logo.png"
            alt="Kapruka"
            style={{ height: '20px', objectFit: 'contain' }}
          />
          <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>
          <div>
            <h1 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#f5f4f8', display: 'flex', alignItems: 'center', gap: '7px' }}>
              Ayu
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px rgba(16,185,129,0.6)',
                animation: 'pulse-glow 2s infinite',
                display: 'inline-block',
              }} />
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#78738a' }}>AI Shopper</p>
          </div>
        </div>

        {/* Cart button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${cartPulse ? 'rgba(248,218,8,0.5)' : 'rgba(255,255,255,0.1)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative', fontSize: '20px',
            transition: 'all 0.2s ease',
            transform: cartPulse ? 'scale(1.15)' : 'scale(1)',
            boxShadow: cartPulse ? '0 0 16px rgba(248,218,8,0.3)' : 'none',
          }}
        >
          🛒
          {totalItems > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              background: '#f8da08', color: '#120e1c',
              fontSize: '10px', fontWeight: '800',
              width: '18px', height: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%',
              boxShadow: '0 2px 8px rgba(248,218,8,0.4)',
            }}>
              {totalItems}
            </span>
          )}
        </button>
      </header>

      {/* Chat area */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: isEmptyChat ? '0' : '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Hero empty state */}
          {isEmptyChat && (
            <HeroEmptyState onSelectScenario={(prompt) => sendMessage(prompt)} />
          )}

          {/* Messages */}
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isLast = idx === messages.length - 1;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  animation: 'message-in 0.35s ease-out forwards',
                  width: '100%',
                }}
              >
                {(msg.text || msg.image) && (
                  <div style={{
                    maxWidth: isUser ? '80%' : '85%',
                    width: 'fit-content',
                    padding: isUser ? '10px 16px' : '14px 16px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    background: isUser
                      ? 'linear-gradient(135deg, #5d3f9e, #402970)'
                      : 'rgba(255,255,255,0.04)',
                    border: isUser
                      ? '1px solid rgba(93,63,158,0.5)'
                      : '1px solid rgba(255,255,255,0.07)',
                    color: '#f5f4f8',
                    borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                    boxShadow: isUser ? '0 4px 16px rgba(93,63,158,0.2)' : 'none',
                    overflow: 'hidden',
                  }}>
                    {msg.image && (
                      <div style={{ marginBottom: msg.text ? '8px' : '0', borderRadius: '8px', overflow: 'hidden', maxWidth: '240px' }}>
                        <img src={msg.image} alt="Upload" style={{ width: '100%', height: 'auto', display: 'block' }} />
                      </div>
                    )}
                    {msg.text && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />}
                  </div>
                )}

                {msg.customUI && (
                  <div style={{ marginTop: '14px', width: '100%', maxWidth: '100%' }}>
                    <CustomUI customUI={msg.customUI} onAddToCart={addToCart} />
                  </div>
                )}

                {/* Quick chips for last assistant message */}
                {!isUser && isLast && !isLoading && (
                  <div style={{ marginTop: '14px', maxWidth: '85%' }}>
                    <QuickChips
                      customUIType={msg.customUI?.type || 'general'}
                      onSend={sendMessage}
                      onAddToCart={addToCart}
                      productData={msg.customUI?.type === 'product_details' ? msg.customUI.data : null}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              animation: 'message-in 0.35s ease-out forwards',
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '4px 18px 18px 18px',
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <div key={i} style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: '#5d3f9e',
                      animation: `typing 1.4s infinite`,
                      animationDelay: `${delay}s`,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: '#78738a' }}>Ayu is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{
          padding: '12px 16px 16px',
          background: 'linear-gradient(to top, #120e1c 60%, transparent)',
          flexShrink: 0,
        }}>
          {selectedImage && (
            <div style={{
              position: 'relative', width: '60px', height: '60px', marginBottom: '8px', marginLeft: '6px',
              borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)',
            }}>
              <img src={selectedImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                style={{
                  position: 'absolute', top: '4px', right: '4px',
                  background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white',
                  borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                }}
              >✕</button>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          <form
            onSubmit={e => { e.preventDefault(); sendMessage(input); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '6px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              transition: 'border-color 0.2s',
            }}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '44px', height: '44px', flexShrink: 0,
                borderRadius: '12px', background: 'transparent',
                border: 'none', color: '#78738a',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease', marginLeft: '4px',
              }}
              title="Upload Image or Take Photo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Ayu anything — English, Singlish, සිංහල or தமிழ்..."
              disabled={isLoading}
              style={{
                flex: 1, background: 'none', border: 'none',
                color: '#f5f4f8', padding: '10px 14px',
                fontSize: '14px', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            {recognitionRef.current && (
              <button
                type="button"
                onClick={toggleListening}
                style={{
                  width: '44px', height: '44px', flexShrink: 0,
                  borderRadius: '12px',
                  background: isListening ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                  border: 'none',
                  color: isListening ? '#ef4444' : '#78738a',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  animation: isListening ? 'pulse-glow 1.5s infinite' : 'none',
                  marginRight: '4px',
                }}
                title={isListening ? "Listening..." : "Click to speak"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="22"></line>
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && !isListening)}
              style={{
                width: '44px', height: '44px', flexShrink: 0,
                borderRadius: '12px',
                background: (isLoading || (!input.trim() && !isListening))
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, #5d3f9e, #402970)',
                border: 'none',
                color: (isLoading || (!input.trim() && !isListening)) ? '#78738a' : 'white',
                cursor: (isLoading || (!input.trim() && !isListening)) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: (isLoading || (!input.trim() && !isListening)) ? 'none' : '0 2px 12px rgba(93,63,158,0.4)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(-1px) translateY(1px)' }}>
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: '10px', color: '#3a3648', margin: '8px 0 0' }}>
            Design and Developed by Prabhashu Samarakkodi
          </p>
        </div>
      </main>

      {/* Sidebar */}
      <Sidebar
        cart={cart}
        updateCartQty={updateCartQty}
        deliveryCity={deliveryCity}
        setDeliveryCity={setDeliveryCity}
        deliveryDate={deliveryDate}
        setDeliveryDate={setDeliveryDate}
        onCheckDelivery={handleCheckDelivery}
        onCheckout={handleCheckout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}
