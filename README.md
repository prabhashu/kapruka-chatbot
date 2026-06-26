# Kapruka Chatbot

A smart conversational agent and shopping assistant for Kapruka. Built with Next.js, React, and integrated with the Kapruka Model Context Protocol (MCP) to provide real-time product search, detailed information, and an integrated shopping cart.

## Features

- **Conversational Interface:** Chat naturally to search for products.
- **MCP Integration:** Directly connects to Kapruka's backend via `mcp.kapruka.com` to fetch live products, pricing, and availability.
- **Integrated Shopping Cart:** View product details in dynamic modals, select quantities, and manage your cart directly in the sidebar.
- **Smart Formatting:** Safely handles and renders product data and pricing dynamically.
- **Modern UI:** Built with dark-mode optimized aesthetics, glassmorphism elements, and smooth micro-animations.

## Tech Stack

- **Framework:** Next.js
- **UI:** React, Vanilla CSS (`app/globals.css`, `public/style.css`)
- **Backend/API:** Node.js, Express (`server.js`)
- **Integration:** Model Context Protocol (MCP) SDK

## Getting Started

First, install the required dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application running.

## Project Structure

- `/app` - Next.js App Router containing pages and API routes.
- `/components` - Reusable React components (`Sidebar.jsx`, `ProductCarousel.jsx`, `CustomUIs.jsx`, etc.).
- `/public` - Static assets and global styles.
- `server.js` - Custom server entry point initializing the Kapruka MCP client.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
