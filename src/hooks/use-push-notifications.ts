import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { toast } = useToast();

  const subscribeToPush = useCallback(async (staffId: string, userId: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return false;
    }

    setIsSubscribing(true);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }

      // Get VAPID public key from backend
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-vapid-key');
      
      if (keyError || !keyData?.vapidPublicKey) {
        console.error('Failed to get VAPID key:', keyError);
        return false;
      }

      const vapidPublicKey = keyData.vapidPublicKey;

      // Register custom service worker for push
      let swRegistration = await navigator.serviceWorker.getRegistration('/custom-sw.js');
      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.register('/custom-sw.js', {
          scope: '/',
        });
        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;
      }

      // Check for existing subscription
      let subscription = await swRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe to push notifications
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });
      }

      const subscriptionJson = subscription.toJSON();
      const endpoint = subscriptionJson.endpoint!;
      const p256dh = subscriptionJson.keys!.p256dh!;
      const auth = subscriptionJson.keys!.auth!;

      // Save subscription to database (upsert by endpoint)
      const { error: dbError } = await supabase
        .from('push_subscriptions' as any)
        .upsert(
          {
            staff_id: staffId,
            user_id: userId,
            endpoint,
            p256dh,
            auth,
          },
          { onConflict: 'endpoint' }
        );

      if (dbError) {
        console.error('Failed to save push subscription:', dbError);
        return false;
      }

      console.log('Push notification subscription saved successfully');
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, []);

  const requestPermissionAndSubscribe = useCallback(async (staffId: string, userId: string) => {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      // Already have permission, subscribe silently
      await subscribeToPush(staffId, userId);
    } else if (Notification.permission === 'default') {
      // Show a toast prompting the user
      toast({
        title: 'Enable Notifications',
        description: 'Allow notifications to receive reminders to keep your location updated.',
      });
      await subscribeToPush(staffId, userId);
    }
    // If 'denied', do nothing
  }, [subscribeToPush, toast]);

  return {
    subscribeToPush,
    requestPermissionAndSubscribe,
    isSubscribing,
  };
}
