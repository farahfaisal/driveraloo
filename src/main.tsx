import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { Geolocation } from '@capacitor/geolocation';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

// Polyfill Buffer for the browser environment
window.Buffer = Buffer;

// Initialize Capacitor plugins
const initializeApp = async () => {
  try {
    // Service Worker will be automatically registered by Vite PWA plugin

    // Only initialize native plugins when running on a device
    if (Capacitor.isNativePlatform()) {
      try {
        // Hide status bar completely for fullscreen experience
        await StatusBar.hide();
      } catch (error) {
        // Silently handle status bar error
      }

      try {
        // Check location permissions without requesting them
        const permissions = await Geolocation.checkPermissions();
      } catch (error) {
        // Silently handle permissions check error
      }

      // Handle back button
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          CapacitorApp.exitApp();
        } else {
          window.history.back();
        }
      });
    }
  } catch (error) {
    // Silently handle initialization error
  }
};

// Create root and render app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </StrictMode>
  );

  // Initialize after render
  initializeApp().catch(error => {
    console.error('Failed to initialize app:', error);
  });
}