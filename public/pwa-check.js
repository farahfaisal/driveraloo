// PWA Installation Check Script
// افتح Console واكتب: checkPWA()

window.checkPWA = async function() {
  console.log('=== PWA Installation Check ===\n');

  // 1. Check if installed
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                      window.matchMedia('(display-mode: fullscreen)').matches ||
                      (window.navigator).standalone === true;

  console.log('✓ Installation Status:', isStandalone ? '✅ INSTALLED' : '❌ NOT INSTALLED');

  // 2. Check beforeinstallprompt support
  const supportsInstall = 'onbeforeinstallprompt' in window;
  console.log('✓ beforeinstallprompt Support:', supportsInstall ? '✅ SUPPORTED' : '❌ NOT SUPPORTED');

  // 3. Check Service Worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log('✓ Service Worker:', registrations.length > 0 ? '✅ REGISTERED' : '⚠️ NOT REGISTERED');

    if (registrations.length > 0) {
      console.log('  - State:', registrations[0].active?.state);
      console.log('  - Scope:', registrations[0].scope);
    }
  } else {
    console.log('✓ Service Worker: ❌ NOT SUPPORTED');
  }

  // 4. Check HTTPS
  const isSecure = window.location.protocol === 'https:' ||
                  window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1';
  console.log('✓ HTTPS:', isSecure ? '✅ SECURE' : '❌ NOT SECURE');

  // 5. Check Browser
  const ua = navigator.userAgent.toLowerCase();
  let browser = 'Unknown';
  let support = '❌';

  if (ua.includes('chrome') && !ua.includes('edge')) {
    browser = 'Chrome';
    support = '✅';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
    support = '✅';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
    support = '⚠️';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
    support = '❌';
  }

  console.log('✓ Browser:', browser, support);

  // 6. Check if dismissed
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed) {
    const dismissedDate = new Date(dismissed);
    const daysSince = Math.floor((Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log('✓ Install Button:', daysSince < 3 ? `⚠️ DISMISSED ${daysSince} days ago` : '✅ READY');
  } else {
    console.log('✓ Install Button:', '✅ READY');
  }

  // 7. Recommendations
  console.log('\n=== Recommendations ===');

  if (!supportsInstall) {
    console.log('⚠️ Use Chrome or Edge for best PWA support');
  }

  if (!isSecure) {
    console.log('❌ PWA requires HTTPS (or localhost)');
  }

  if (dismissed) {
    console.log('💡 To reset: localStorage.removeItem("pwa-install-dismissed"); location.reload();');
  }

  if (!isStandalone && supportsInstall && isSecure) {
    console.log('✅ Ready to install! Look for install button in address bar or wait for auto-prompt.');
  }

  if (isStandalone) {
    console.log('✅ App is already installed and running in standalone mode!');
  }

  console.log('\n=== Quick Commands ===');
  console.log('resetInstall() - Reset install button and reload');
  console.log('checkPWA() - Run this check again');
  console.log('showManifest() - Display manifest.json');
  console.log('showSW() - Show Service Worker details');
};

// Reset install state
window.resetInstall = function() {
  localStorage.removeItem('pwa-install-dismissed');
  console.log('✅ Install state reset. Reloading...');
  setTimeout(() => location.reload(), 1000);
};

// Show manifest
window.showManifest = async function() {
  try {
    const response = await fetch('/manifest.json');
    const manifest = await response.json();
    console.log('=== Web Manifest ===');
    console.log(manifest);
  } catch (error) {
    console.error('❌ Error loading manifest:', error);
  }
};

// Show Service Worker details
window.showSW = async function() {
  if (!('serviceWorker' in navigator)) {
    console.log('❌ Service Worker not supported');
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();

  console.log('=== Service Workers ===');
  console.log(`Found ${registrations.length} registration(s)\n`);

  registrations.forEach((reg, i) => {
    console.log(`SW ${i + 1}:`);
    console.log('  Scope:', reg.scope);
    console.log('  Installing:', reg.installing?.state || 'none');
    console.log('  Waiting:', reg.waiting?.state || 'none');
    console.log('  Active:', reg.active?.state || 'none');
  });
};

// Auto-run on load
if (document.readyState === 'complete') {
  console.log('💡 Type checkPWA() in console to check PWA status');
} else {
  window.addEventListener('load', () => {
    console.log('💡 Type checkPWA() in console to check PWA status');
  });
}
