// --- Frontend App State ---
const state = {
  chatHistory: [
    {
      role: 'assistant',
      content: 'Ayubowan! 🙏 I am Ayu, your Kapruka shopping assistant. I can help you find products, calculate delivery costs, and guide you all the way through guest checkout. What are you looking to shop for today?'
    }
  ],
  cart: [],
  deliveryCity: '',
  deliveryDate: '',
  deliveryFee: 0,
  deliveryCurrency: 'LKR',
  activeCheckout: null,
  // Stores the full Gemini conversation (incl. tool calls) for proper multi-turn memory
  internalHistory: null
};

// --- DOM Elements ---
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebarPanel = document.getElementById('sidebar-panel');
const cartBadgeCount = document.getElementById('cart-badge-count');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Cart & Quote DOMs
const cartItemsList = document.getElementById('cart-items-list');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartDeliveryCost = document.getElementById('cart-delivery-cost');
const cartTotal = document.getElementById('cart-total');
const deliveryCityInput = document.getElementById('delivery-city-input');
const cityAutocompleteList = document.getElementById('city-autocomplete-list');
const deliveryDateInput = document.getElementById('delivery-date-input');
const checkDeliveryBtn = document.getElementById('check-delivery-btn');
const deliveryStatusBox = document.getElementById('delivery-status-box');
const proceedCheckoutBtn = document.getElementById('proceed-checkout-btn');

// Checkout DOMs
const checkoutForm = document.getElementById('checkout-form');
const recipientCityDisplay = document.getElementById('recipient-city-display');
const orderCreatedTicket = document.getElementById('order-created-ticket');
const ticketRef = document.getElementById('ticket-ref');
const ticketTotal = document.getElementById('ticket-total');
const ticketPayBtn = document.getElementById('ticket-pay-btn');

// Tracking DOMs
const trackOrderInput = document.getElementById('track-order-input');
const trackOrderBtn = document.getElementById('track-order-btn');
const trackResultsContainer = document.getElementById('track-results-container');

// Settings Modal DOMs — removed (settings are backend-only)

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Load Cart from localStorage
  const storedCart = localStorage.getItem('kapruka_cart');
  if (storedCart) {
    state.cart = JSON.parse(storedCart);
    updateCartUI();
  }

  // Load API Key from localStorage — removed, backend handles key

  // Set default delivery date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  state.deliveryDate = `${yyyy}-${mm}-${dd}`;
  deliveryDateInput.value = state.deliveryDate;
  deliveryDateInput.min = `${yyyy}-${mm}-${dd}`;

  // Event Listeners
  chatForm.addEventListener('submit', handleChatSubmit);
  toggleSidebarBtn.addEventListener('click', toggleSidebar);
  closeSidebarBtn.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      closeSidebarMobile();
    } else {
      toggleSidebar();
    }
  });
  
  // Tab Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });


  deliveryCityInput.addEventListener('input', debounce(handleCityInput, 300));
  document.addEventListener('click', (e) => {
    if (e.target !== deliveryCityInput) {
      cityAutocompleteList.innerHTML = '';
    }
  });

  // Check Delivery Rate
  checkDeliveryBtn.addEventListener('click', triggerCheckDelivery);

  // Proceed to Checkout
  proceedCheckoutBtn.addEventListener('click', () => {
    recipientCityDisplay.value = state.deliveryCity;
    const checkoutTabBtn = document.querySelector('[data-tab="checkout-tab"]');
    checkoutTabBtn.click();
  });

  // Submit Checkout
  checkoutForm.addEventListener('submit', handleCheckoutSubmit);

  // Track Order
  trackOrderBtn.addEventListener('click', triggerTrackOrder);
});

// --- Utility Functions ---
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function formatPrice(amount, currency = 'LKR') {
  return `${currency} ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- Cart Operations ---
function saveCart() {
  localStorage.setItem('kapruka_cart', JSON.stringify(state.cart));
}

function addToCart(productId, title, price, image = '') {
  const existing = state.cart.find(item => item.product_id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      product_id: productId,
      title: title,
      price: price,
      image: image,
      quantity: 1
    });
  }
  saveCart();
  updateCartUI();
  
  // Show Cart badge glow
  toggleSidebarBtn.classList.add('animate-pulse');
  setTimeout(() => toggleSidebarBtn.classList.remove('animate-pulse'), 1000);
}

function updateCartQty(productId, delta) {
  const item = state.cart.find(item => item.product_id === productId);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      state.cart = state.cart.filter(i => i.product_id !== productId);
    }
    saveCart();
    updateCartUI();
  }
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(item => item.product_id !== productId);
  saveCart();
  updateCartUI();
}

function updateCartUI() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  cartBadgeCount.innerText = totalItems;

  if (state.cart.length === 0) {
    cartItemsList.innerHTML = '<div class="empty-cart-message">Your cart is empty. Ask Ayu to find products for you!</div>';
    proceedCheckoutBtn.disabled = true;
  } else {
    cartItemsList.innerHTML = '';
    state.cart.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      itemEl.innerHTML = `
        <div class="cart-item-title">${item.title}</div>
        <div class="cart-item-meta">
          <div class="cart-item-price">${formatPrice(item.price * item.quantity)}</div>
          <div class="cart-item-qty-controls">
            <button class="qty-btn" onclick="updateCartQty('${item.product_id}', -1)">-</button>
            <span class="qty-num">${item.quantity}</span>
            <button class="qty-btn" onclick="updateCartQty('${item.product_id}', 1)">+</button>
          </div>
        </div>
      `;
      cartItemsList.appendChild(itemEl);
    });
    // Checkout is available if we have items AND a delivery city is selected
    proceedCheckoutBtn.disabled = !state.deliveryCity;
  }

  // Calculate totals
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  cartSubtotal.innerText = formatPrice(subtotal);
  cartDeliveryCost.innerText = formatPrice(state.deliveryFee, state.deliveryCurrency);
  cartTotal.innerText = formatPrice(subtotal + state.deliveryFee);
}

// --- Sidebar Toggle ---
function toggleSidebar() {
  if (window.innerWidth <= 768) {
    // Mobile: toggle 'open' class (sidebar starts hidden, slides in)
    sidebarPanel.classList.toggle('open');
  } else {
    // Desktop: toggle 'collapsed' class (sidebar starts visible, slides out)
    sidebarPanel.classList.toggle('collapsed');
  }
}

function closeSidebarMobile() {
  sidebarPanel.classList.remove('open');
}


// --- Autocomplete lookups ---
async function handleCityInput() {
  const q = deliveryCityInput.value.trim();
  if (q.length < 2) {
    cityAutocompleteList.innerHTML = '';
    return;
  }

  try {
    const res = await fetch(`/api/cities?q=${encodeURIComponent(q)}`);
    const cities = await res.json();
    
    cityAutocompleteList.innerHTML = '';
    if (cities.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'autocomplete-item';
      emptyDiv.innerText = 'No delivery city found';
      cityAutocompleteList.appendChild(emptyDiv);
      return;
    }

    cities.forEach(city => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.innerText = city.name;
      item.addEventListener('click', () => {
        deliveryCityInput.value = city.name;
        state.deliveryCity = city.name;
        cityAutocompleteList.innerHTML = '';
        updateCartUI(); // Re-validate if checkout is possible
      });
      cityAutocompleteList.appendChild(item);
    });
  } catch (error) {
    console.error('Error fetching city autocomplete:', error);
  }
}

// --- Trigger Delivery Check via Agent ---
function triggerCheckDelivery() {
  const city = deliveryCityInput.value.trim();
  const date = deliveryDateInput.value;
  
  if (!city) {
    alert('Please select or type a delivery city first!');
    return;
  }

  state.deliveryCity = city;
  state.deliveryDate = date;

  // Let's check if there is an item in the cart to provide the product context
  const pId = state.cart.length > 0 ? state.cart[0].product_id : '';
  const messageText = `Can you check if Kapruka delivers to "${city}" on ${date}${pId ? ` for product ${pId}` : ''}?`;
  
  addMessageToHistory('user', messageText);
  appendMessageUI('user', messageText);
  
  // Show sidebar tab and scroll to bottom
  const cartTabBtn = document.querySelector('[data-tab="cart-tab"]');
  cartTabBtn.click();
  
  sendChatMessage(messageText);
}

// --- Checkout Form Submit via Agent ---
function handleCheckoutSubmit(e) {
  e.preventDefault();
  
  const recipient = {
    name: document.getElementById('recipient-name').value.trim(),
    phone: document.getElementById('recipient-phone').value.trim(),
    address: document.getElementById('recipient-address').value.trim(),
    city: state.deliveryCity
  };

  const sender = {
    name: document.getElementById('sender-name').value.trim(),
    anonymous: document.getElementById('sender-anonymous').checked
  };

  const giftMessage = document.getElementById('gift-message').value.trim();

  const cartPayload = state.cart.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity
  }));

  const deliveryPayload = {
    city: state.deliveryCity,
    date: state.deliveryDate,
    address: recipient.address
  };

  const commandText = `Please create a guest checkout order for me.
Here are the checkout details:
- **Cart**: ${JSON.stringify(cartPayload)}
- **Recipient**: ${recipient.name} (${recipient.phone}), Address: ${recipient.address}, City: ${recipient.city}
- **Delivery Date**: ${state.deliveryDate}
- **Sender**: ${sender.name} (Anonymous: ${sender.anonymous})
${giftMessage ? `- **Gift Message**: "${giftMessage}"` : ''}`;

  // Hide old ticket if any
  orderCreatedTicket.classList.add('hidden');

  addMessageToHistory('user', `Please process my checkout order to ${recipient.name} in ${recipient.city}.`);
  appendMessageUI('user', `Please process my checkout order to ${recipient.name} in ${recipient.city}.`);

  sendChatMessage(commandText);
}

// --- Track Order Submissions ---
function triggerTrackOrder() {
  const orderNum = trackOrderInput.value.trim();
  if (!orderNum) {
    alert('Please enter a valid Kapruka order number.');
    return;
  }

  const queryText = `Can you track the Kapruka order number "${orderNum}" for me?`;
  
  addMessageToHistory('user', queryText);
  appendMessageUI('user', queryText);
  
  sendChatMessage(queryText);
}

// --- Handle Chat Input & Sending ---
function handleChatSubmit(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  addMessageToHistory('user', text);
  appendMessageUI('user', text);
  sendChatMessage(text);
}

function sendSuggestion(text) {
  // Quick buttons always start fresh — clear stale tool-call history
  // so Gemini always makes a new tool call instead of using old context
  state.internalHistory = null;

  addMessageToHistory('user', text);
  appendMessageUI('user', text);
  sendChatMessage(text);
}

let isChatRequestInProgress = false;

async function sendChatMessage(text) {
  if (isChatRequestInProgress) return;
  isChatRequestInProgress = true;
  
  typingIndicator.classList.remove('hidden');
  chatInput.disabled = true;
  sendBtn.disabled = true;

  try {
    // Send history + text to server.
    // If we have internalHistory (full Gemini tool-call context), use it for proper memory.
    // Cap it at 40 turns — if too long, reset to null so Gemini starts fresh.
    let historyToSend = state.chatHistory.slice(0, -1);
    if (state.internalHistory && state.internalHistory.length > 40) {
      state.internalHistory = null;
    }
    
    // CRITICAL: If we have no internalHistory (e.g. quick button fresh start), the plain-text
    // history is HARMFUL because it lacks the hidden tool calls. Gemini reads it, sees it
    // previously said "Here are the products" without calling tools, and copies that behavior!
    // So if internalHistory is null, wipe the plain-text history too (keep only greeting).
    if (!state.internalHistory) {
      historyToSend = historyToSend.slice(0, 1);
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: historyToSend,
        text: text,
        internalHistory: state.internalHistory || null
      })
    });

    const data = await response.json();
    typingIndicator.classList.add('hidden');
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();

    if (data.error) {
      appendMessageUI('assistant', `⚠️ **Error:** ${data.error}`);
      isChatRequestInProgress = false;
      return;
    }

    addMessageToHistory('assistant', data.content);
    appendMessageUI('assistant', data.content, data.customUI);

    // Store the full internal history (incl. tool calls) for next request
    // This gives Gemini proper memory of what tools were called and what results came back
    if (data.internalHistory) {
      state.internalHistory = data.internalHistory;
    }

    // If customUI was returned, execute actions on the frontend
    if (data.customUI) {
      handleCustomUIActions(data.customUI);
    }
    
    isChatRequestInProgress = false;

  } catch (error) {
    console.error('Error sending chat message:', error);
    typingIndicator.classList.add('hidden');
    chatInput.disabled = false;
    sendBtn.disabled = false;
    appendMessageUI('assistant', '⚠️ Sorry, I had trouble connecting to Kapruka. Please check if the backend is running and try again.');
    isChatRequestInProgress = false;
  }
}

function addMessageToHistory(role, content) {
  state.chatHistory.push({ role, content });
  // Keep history size reasonable (last 30 messages)
  if (state.chatHistory.length > 30) {
    state.chatHistory.shift();
  }
}

// --- Message UI Rendering ---
function appendMessageUI(role, text, customUI = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'} message-fade`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  // Format markdown-like text to HTML
  contentDiv.innerHTML = formatMessageText(text);

  // Render Custom UI elements inside the assistant bubble if present
  if (customUI) {
    const uiEl = renderCustomUI(customUI);
    if (uiEl) {
      contentDiv.appendChild(uiEl);
    }
  }

  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);
  
  // Smooth scroll to bottom
  const scrollToBottom = () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };
  
  scrollToBottom();

  // Scroll again if images load and change the height
  const images = messageDiv.querySelectorAll('img');
  images.forEach(img => {
    img.addEventListener('load', scrollToBottom);
  });
}

function formatMessageText(text) {
  // Convert standard markdown highlights
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
  
  // Format links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  return `<p>${html}</p>`;
}

// --- Render Rich Custom UI Panels ---
function renderCustomUI(ui) {
  const container = document.createElement('div');
  container.className = 'ui-container';

  switch (ui.type) {
    case 'product_list':
      if (!ui.data || ui.data.length === 0) return null;
      
      const carousel = document.createElement('div');
      carousel.className = 'product-carousel';
      
      ui.data.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'product-card';
        const placeholderImg = `https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&auto=format&fit=crop&q=60`;
        const imgUrl = prod.image || placeholderImg;
            
        card.innerHTML = `
          <div class="product-card-img-wrapper">
            <img src="${imgUrl}" alt="${prod.title}" class="product-card-img" onerror="this.src='${placeholderImg}'" />
            <span class="product-card-badge">${prod.shipping ? 'Ships Local' : 'Kapruka Direct'}</span>
          </div>
          <div class="product-card-info">
            <div class="product-card-title">${prod.title}</div>
            <div class="product-card-meta">
              <span class="product-card-price">${formatPrice(prod.price, prod.currency)}</span>
              <span class="product-card-stock ${prod.stock.toLowerCase().includes('in') ? 'stock-in' : 'stock-low'}">${prod.stock}</span>
            </div>
            <div class="product-card-actions">
              <button class="product-card-btn" onclick="triggerGetDetails('${prod.id}')">Details</button>
              <button class="product-card-btn add-to-cart" onclick="addToCart('${prod.id}', '${prod.title.replace(/'/g, "\\'")}', ${prod.price}, '${imgUrl}')">Add to Cart</button>
            </div>
          </div>
        `;
        carousel.appendChild(card);
      });
      container.appendChild(carousel);
      return container;

    case 'product_details':
      const prod = ui.data;
      const detailCard = document.createElement('div');
      detailCard.className = 'product-detail-card';
      
      const defaultImg = `https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&auto=format&fit=crop&q=60`;
      const prodImg = prod.image || defaultImg;
      // Price might be "LKR 4,900" string or a number — parse it
      const priceNum = parseFloat(String(prod.price).replace(/[^0-9.]/g, '')) || 0;
      const priceDisplay = prod.price || 'Price unavailable';

      detailCard.innerHTML = `
        <img src="${prodImg}" alt="${prod.title}" class="product-detail-img" 
             onerror="this.onerror=null;this.src='${defaultImg}'" />
        <div class="product-detail-info">
          <h4 class="product-detail-title">${prod.title}</h4>
          <p class="product-detail-desc">${prod.description || 'No description available for this item.'}</p>
          <div class="product-detail-meta">
            ${prod.id ? `<span class="meta-item">ID: ${prod.id}</span>` : ''}
            <span class="meta-item">Vendor: ${prod.vendor || 'Kapruka'}</span>
            ${prod.category ? `<span class="meta-item">Category: ${prod.category}</span>` : ''}
            <span class="meta-item">Int. Shipping: ${prod.internationalShipping || 'No'}</span>
          </div>
          <div class="product-detail-actions">
            <span class="product-card-price">${priceDisplay}</span>
            <button class="product-card-btn add-to-cart" 
              onclick="addToCart('${prod.id}', '${prod.title.replace(/'/g, "\\'")}', ${priceNum}, '${prodImg}')">
              Add to Cart
            </button>
            ${prod.url ? `<a href="${prod.url}" target="_blank" class="product-card-btn" style="text-align:center;display:flex;align-items:center;justify-content:center;">View on Kapruka ↗</a>` : ''}
          </div>
        </div>
      `;
      container.appendChild(detailCard);
      return container;


    case 'delivery_check':
      const del = ui.data;
      const quoteCard = document.createElement('div');
      quoteCard.className = `delivery-quote-card ${del.available ? 'available' : 'unavailable'}`;
      quoteCard.innerHTML = `
        <div class="quote-icon">${del.available ? '🚚' : '❌'}</div>
        <div class="quote-info">
          <h4>${del.available ? 'Delivery Available!' : 'Delivery Unavailable'}</h4>
          <p>${del.message}</p>
          ${del.available ? `<p><strong>Shipping Rate:</strong> ${formatPrice(del.fee, del.currency)}</p>` : ''}
        </div>
      `;
      container.appendChild(quoteCard);
      return container;

    case 'checkout':
      const ticket = ui.data;
      const payTicket = document.createElement('div');
      payTicket.className = 'checkout-ticket-card';
      payTicket.innerHTML = `
        <div class="ticket-content">
          <div class="ticket-icon">💳</div>
          <h3>Guest Order Created!</h3>
          <p>We've registered your guest checkout request. Complete payment below to schedule dispatch.</p>
          <div class="ticket-body" style="text-align: left; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom: 6px; font-size:13px;">
              <span>Reference:</span>
              <strong>${ticket.orderRef}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:13px;">
              <span>Order Summary:</span>
              <strong style="color:var(--accent);">${formatPrice(state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + state.deliveryFee)}</strong>
            </div>
          </div>
          <a href="${ticket.payUrl}" target="_blank" class="ticket-btn">Proceed to Secure Payment ➔</a>
        </div>
      `;
      container.appendChild(payTicket);
      return container;

    default:
      return null;
  }
}

// --- Action Hooks (Dynamic State Changes on UI results) ---
function handleCustomUIActions(ui) {
  switch (ui.type) {
    case 'delivery_check':
      const del = ui.data;
      if (del.available) {
        state.deliveryFee = del.fee;
        state.deliveryCurrency = del.currency;
        
        deliveryStatusBox.classList.remove('hidden', 'warn');
        deliveryStatusBox.classList.add('ok');
        deliveryStatusBox.innerHTML = `✅ Delivery available to <strong>${state.deliveryCity}</strong>.<br/>Shipping cost: ${formatPrice(del.fee, del.currency)}`;
      } else {
        state.deliveryFee = 0;
        deliveryStatusBox.classList.remove('hidden', 'ok');
        deliveryStatusBox.classList.add('warn');
        deliveryStatusBox.innerHTML = `❌ Delivery is currently not available to <strong>${state.deliveryCity}</strong> on ${state.deliveryDate}.`;
      }
      updateCartUI();
      break;

    case 'checkout':
      const ticket = ui.data;
      state.activeCheckout = ticket;
      
      // Update the Ticket Sidebar UI
      orderCreatedTicket.classList.remove('hidden');
      ticketRef.innerText = ticket.orderRef;
      ticketTotal.innerText = formatPrice(state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + state.deliveryFee);
      ticketPayBtn.href = ticket.payUrl;

      // Reset cart locally after order created
      state.cart = [];
      state.deliveryFee = 0;
      saveCart();
      updateCartUI();
      
      // Focus Sidebar Tab Checkout
      const checkoutTabBtn = document.querySelector('[data-tab="checkout-tab"]');
      checkoutTabBtn.click();
      break;
  }
}

// --- Trigger get product details programmatically ---
function triggerGetDetails(productId) {
  const queryText = `Show me full details for product "${productId}".`;
  addMessageToHistory('user', queryText);
  appendMessageUI('user', queryText);
  sendChatMessage(queryText);
}

// --- Visualise tracking timeline ---
function renderTrackingUI(markdownData) {
  let trackInfo = null;
  try {
    // Attempt parsing from the JSON response
    // If it's a JSON string, let's parse it
    trackInfo = JSON.parse(markdownData);
  } catch (e) {
    // If tracking is returned as raw markdown, Ayu will output it in chat
    // We can also extract values or display a nice graphic
    return `<div class="section-card"><h4>Order Status</h4><p>${markdownData}</p></div>`;
  }

  if (!trackInfo || trackInfo.Error) {
    return `<div class="section-card"><p style="color:var(--error)">⚠️ ${trackInfo ? trackInfo.Error : 'Order not found'}</p></div>`;
  }

  const stepsHTML = trackInfo.progress.map((step, idx) => {
    const isCompleted = idx < trackInfo.progress.length - 1 || trackInfo.status.toLowerCase() === 'delivered';
    const isActive = idx === trackInfo.progress.length - 1 && trackInfo.status.toLowerCase() !== 'delivered';
    
    return `
      <div class="timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-title">${step.step}</div>
          <div class="timeline-time">${step.timestamp}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="section-card">
      <h3>Order ${trackInfo.order_number}</h3>
      <div style="font-size: 13px; line-height: 1.5; color: var(--text-secondary);">
        <div><strong>Status:</strong> <span style="color:var(--accent); font-weight:700;">${trackInfo.status_display}</span></div>
        <div><strong>Recipient:</strong> ${trackInfo.recipient.name}</div>
        <div><strong>Delivery City:</strong> ${trackInfo.recipient.city}</div>
        <div><strong>Delivery Date:</strong> ${trackInfo.delivery_date}</div>
        <div><strong>Total Paid:</strong> LKR ${trackInfo.amount}</div>
      </div>
    </div>
    <div class="section-card">
      <h3>Timeline Progress</h3>
      <div class="timeline">
        ${stepsHTML}
      </div>
    </div>
  `;
}

// Custom trigger for Order Tracking directly on tracking tab click
async function triggerTrackOrderDirectly(orderNum) {
  trackResultsContainer.classList.remove('hidden');
  trackResultsContainer.innerHTML = '<div style="text-align:center; padding: 20px;"><div class="typing-indicator"><span></span><span></span><span></span> Connecting to tracking registry...</div></div>';
  
  try {
    // Let's ask Ayu through chat to retrieve it as JSON, or we can use a fetch query if we had it.
    // To keep the backend stateless, we call Ayu in chat, but tell her to output it in a JSON block
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: `Track order ${orderNum} and return results as JSON format only. Do not add conversational text.` }
        ],
        geminiKey: localStorage.getItem('gemini_api_key') || ''
      })
    });

    const data = await res.json();
    if (data.error) {
      trackResultsContainer.innerHTML = `<div class="section-card"><p style="color:var(--error)">⚠️ ${data.error}</p></div>`;
      return;
    }

    // Try parsing the json output from the assistant's content
    const cleanJSONText = data.content.replace(/```json/g, '').replace(/```/g, '').trim();
    trackResultsContainer.innerHTML = renderTrackingUI(cleanJSONText);

  } catch (error) {
    trackResultsContainer.innerHTML = `<div class="section-card"><p style="color:var(--error)">⚠️ Failed to fetch tracking details</p></div>`;
  }
}

// Expose functions globally for onclick inline elements
window.addToCart = addToCart;
window.updateCartQty = updateCartQty;
window.triggerGetDetails = triggerGetDetails;
