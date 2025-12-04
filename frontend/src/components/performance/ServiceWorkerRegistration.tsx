import { useEffect, useState } from 'react';

interface ServiceWorkerMetrics {
  cacheHitRate: number;
  offlineRate: number;
  cacheHits: number;
  cacheMisses: number;
  apiCalls: number;
  offlineApiCalls: number;
}

export const ServiceWorkerRegistration: React.FC = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [metrics, setMetrics] = useState<ServiceWorkerMetrics | null>(null);

  useEffect(() => {
    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
      setIsSupported(true);
      
      // Register service worker
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service worker registered:', registration);
          setIsRegistered(true);
          
          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available, show update notification
                  if (window.confirm('New version available! Reload to update?')) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[SW] Service worker registration failed:', error);
        });

      // Handle service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'PERFORMANCE_METRICS') {
          setMetrics(event.data.metrics);
        }
      });

      // Request performance metrics from service worker
      const requestMetrics = () => {
        if (navigator.serviceWorker.controller) {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = (event) => {
            setMetrics(event.data);
          };
          
          navigator.serviceWorker.controller.postMessage(
            { type: 'GET_PERFORMANCE_METRICS' },
            [messageChannel.port2]
          );
        }
      };

      // Request metrics immediately and then every 30 seconds
      requestMetrics();
      const interval = setInterval(requestMetrics, 30000);

      return () => clearInterval(interval);
    } else {
      console.warn('[SW] Service workers are not supported in this browser');
    }
  }, []);

  // Manual service worker update trigger
  const triggerUpdate = () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  return null; // This component doesn't render anything visible
};

export default ServiceWorkerRegistration;
