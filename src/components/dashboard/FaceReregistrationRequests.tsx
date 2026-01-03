import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, ScanFace, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface FaceRequest {
  id: string;
  staff_id: string;
  reason: string | null;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  staff_members: {
    name: string;
    employee_id: string;
    department: string;
  };
}

export function FaceReregistrationRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['face-reregistration-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('face_reregistration_requests')
        .select(`
          id,
          staff_id,
          reason,
          status,
          requested_at,
          reviewed_at,
          staff_members (
            name,
            employee_id,
            department
          )
        `)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as FaceRequest[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('face_reregistration_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['face-reregistration-requests'] });
      toast({ title: 'Request approved', description: 'Staff can now re-register their face.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to approve request.', variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('face_reregistration_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['face-reregistration-requests'] });
      toast({ title: 'Request rejected' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to reject request.', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5" />
            Face Re-registration Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5" />
            Face Re-registration Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">No pending requests</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanFace className="h-5 w-5" />
          Face Re-registration Requests
          <Badge variant="secondary" className="ml-auto">{requests.length} pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="space-y-1">
              <p className="font-medium">{request.staff_members?.name}</p>
              <p className="text-sm text-muted-foreground">
                {request.staff_members?.employee_id} • {request.staff_members?.department}
              </p>
              {request.reason && (
                <p className="text-sm text-muted-foreground italic">"{request.reason}"</p>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(request.requested_at), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => rejectMutation.mutate(request.id)}
                disabled={rejectMutation.isPending || approveMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => approveMutation.mutate(request.id)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Approve
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
