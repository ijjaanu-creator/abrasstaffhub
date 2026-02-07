import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Bell, Loader2, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export function SendPushNotification() {
  const { toast } = useToast();
  const [title, setTitle] = useState('Abras Staff Hub');
  const [body, setBody] = useState('Open the app to keep your location updated 📍');
  const [isSending, setIsSending] = useState(false);

  const { data: subscriptionCount } = useQuery({
    queryKey: ['push-subscription-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('push_subscriptions' as any)
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const handleSend = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-tracking-reminder', {
        body: { test: true, title, message: body },
      });

      if (error) throw error;

      toast({
        title: 'Notifications sent',
        description: `Sent: ${data?.sent || 0}, Failed: ${data?.failed || 0}`,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to send',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Send a push notification to all subscribed staff. {subscriptionCount} active subscription{subscriptionCount !== 1 ? 's' : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notif-title">Title</Label>
          <Input
            id="notif-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notif-body">Message</Label>
          <Textarea
            id="notif-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notification message"
            rows={2}
          />
        </div>
        <Button
          onClick={handleSend}
          disabled={isSending || !title || !body}
          className="w-full"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send to All Subscribed Staff
        </Button>
      </CardContent>
    </Card>
  );
}
