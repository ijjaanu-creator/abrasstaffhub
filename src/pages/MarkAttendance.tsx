import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFaceAuth } from '@/hooks/use-face-auth';
import { useGeofence } from '@/hooks/use-geofence';
import { useLocationTracking } from '@/hooks/use-location-tracking';
import { FaceCapture } from '@/components/FaceCapture';
import { Camera, CheckCircle, Loader2, ScanFace, MapPin, Clock, Send } from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function MarkAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { enrollFace, verifyFace, isEnrolling, isVerifying } = useFaceAuth();
  const { checkLocation, isChecking: isCheckingLocation, maxDistance } = useGeofence();
  const { startTracking, stopTracking, isTracking } = useLocationTracking();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [faceCaptureMode, setFaceCaptureMode] = useState<'enroll' | 'verify-in' | 'verify-out'>('enroll');
  const [showReregisterDialog, setShowReregisterDialog] = useState(false);
  const [reregisterReason, setReregisterReason] = useState('');

  const { data: staffMember, isLoading: staffLoading } = useQuery({
    queryKey: ['my-staff-record', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_members')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ['my-attendance-today', staffMember?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('staff_id', staffMember?.id)
        .eq('date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!staffMember?.id,
  });

  // Check if there's an approved re-registration request
  const { data: approvedRequest } = useQuery({
    queryKey: ['approved-reregistration', staffMember?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('face_reregistration_requests')
        .select('*')
        .eq('staff_id', staffMember?.id)
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!staffMember?.id && !!staffMember?.face_image_url,
  });

  // Check if there's a pending request
  const { data: pendingRequest } = useQuery({
    queryKey: ['pending-reregistration', staffMember?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('face_reregistration_requests')
        .select('*')
        .eq('staff_id', staffMember?.id)
        .eq('status', 'pending')
        .maybeSingle();
      return data;
    },
    enabled: !!staffMember?.id && !!staffMember?.face_image_url,
  });

  // Request re-registration mutation
  const requestReregisterMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase
        .from('face_reregistration_requests')
        .insert({
          staff_id: staffMember?.id,
          reason: reason || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reregistration'] });
      setShowReregisterDialog(false);
      setReregisterReason('');
      toast({
        title: 'Request submitted',
        description: 'Your face re-registration request has been sent to admin for approval.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit request. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Delete approved request after using it
  const deleteApprovedRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('face_reregistration_requests')
        .delete()
        .eq('id', requestId);
      if (error) throw error;
    },
  });

  // Handle face enrollment click
  const handleEnrollClick = () => {
    if (!staffMember) {
      toast({
        title: 'Staff record not found',
        description: 'Your account is not linked to a staff record.',
        variant: 'destructive',
      });
      return;
    }
    setFaceCaptureMode('enroll');
    setShowFaceCapture(true);
  };

  // Handle re-register click (requires approval if already enrolled)
  const handleReregisterClick = () => {
    if (approvedRequest) {
      // Has approval, proceed with re-enrollment
      setFaceCaptureMode('enroll');
      setShowFaceCapture(true);
    } else if (pendingRequest) {
      toast({
        title: 'Request pending',
        description: 'Your re-registration request is awaiting admin approval.',
      });
    } else {
      // Show dialog to request approval
      setShowReregisterDialog(true);
    }
  };

  // Handle face capture complete
  const handleFaceCaptured = async (imageBase64: string) => {
    if (faceCaptureMode === 'enroll') {
      if (!user?.id || !staffMember?.id) return;
      const success = await enrollFace(user.id, staffMember.id, imageBase64);
      if (success) {
        // If this was a re-registration with approval, delete the approval
        if (approvedRequest) {
          await deleteApprovedRequestMutation.mutateAsync(approvedRequest.id);
          queryClient.invalidateQueries({ queryKey: ['approved-reregistration'] });
        }
        queryClient.invalidateQueries({ queryKey: ['my-staff-record'] });
        setShowFaceCapture(false);
      }
    } else if (faceCaptureMode === 'verify-in') {
      if (!staffMember?.face_image_url) return;
      const verified = await verifyFace(staffMember.face_image_url, imageBase64);
      if (verified) {
        setShowFaceCapture(false);
        checkInMutation.mutate();
      }
    } else if (faceCaptureMode === 'verify-out') {
      if (!staffMember?.face_image_url) return;
      const verified = await verifyFace(staffMember.face_image_url, imageBase64);
      if (verified) {
        setShowFaceCapture(false);
        checkOutMutation.mutate();
      }
    }
  };

  // Handle face check-in with geofence
  const handleCheckIn = async () => {
    if (!staffMember?.face_image_url) {
      toast({
        title: 'Face not enrolled',
        description: 'Please register your face first.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check geofence first
    const isWithin = await checkLocation();
    if (!isWithin) return;
    
    setFaceCaptureMode('verify-in');
    setShowFaceCapture(true);
  };

  // Handle face check-out with geofence
  const handleCheckOut = async () => {
    if (!staffMember?.face_image_url) {
      toast({
        title: 'Face not enrolled',
        description: 'Please register your face first.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check geofence first
    const isWithin = await checkLocation();
    if (!isWithin) return;
    
    setFaceCaptureMode('verify-out');
    setShowFaceCapture(true);
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const checkInTime = format(now, 'HH:mm');
      const isLate = now.getHours() >= 9;
      
      const { data, error } = await supabase.from('attendance_records').insert({
        staff_id: staffMember?.id,
        date: today,
        check_in: checkInTime,
        status: isLate ? 'late' : 'present',
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
      toast({ title: 'Checked in successfully!' });
      
      // Start location tracking for Executive staff
      if (staffMember?.department === 'Executive' && data?.id) {
        startTracking({
          staffId: staffMember.id,
          attendanceId: data.id,
        });
      }
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const checkOutTime = format(new Date(), 'HH:mm');
      const { error } = await supabase
        .from('attendance_records')
        .update({ check_out: checkOutTime })
        .eq('id', todayAttendance?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
      toast({ title: 'Checked out successfully!' });
      
      // Stop location tracking for Executive staff
      if (staffMember?.department === 'Executive') {
        stopTracking();
      }
    },
  });

  // Resume tracking if Executive staff is already checked in (page refresh)
  useEffect(() => {
    if (
      staffMember?.department === 'Executive' &&
      todayAttendance?.check_in &&
      !todayAttendance?.check_out &&
      !isTracking
    ) {
      startTracking({
        staffId: staffMember.id,
        attendanceId: todayAttendance.id,
      });
    }
  }, [staffMember, todayAttendance, isTracking, startTracking]);

  if (staffLoading || isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!staffMember) {
    return (
      <div className="text-center py-12">
        <h1 className="font-display text-2xl font-bold">Mark Attendance</h1>
        <p className="text-muted-foreground mt-2">Your account is not linked to a staff record.</p>
      </div>
    );
  }

  const hasApprovedReregister = !!approvedRequest;
  const hasPendingRequest = !!pendingRequest;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Mark Attendance</h1>
        <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="rounded-xl border bg-card p-6 text-center space-y-6">
        <div className="flex h-24 w-24 mx-auto items-center justify-center rounded-full gradient-primary">
          <Camera className="h-12 w-12 text-primary-foreground" />
        </div>

        {/* Show enrollment if not enrolled */}
        {!staffMember?.face_image_url ? (
          <div className="space-y-4">
            <div className="bg-warning/10 text-warning rounded-lg p-3 text-sm text-center">
              You need to register your face first
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={isEnrolling}
              onClick={handleEnrollClick}
            >
              {isEnrolling ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <ScanFace className="h-5 w-5 mr-2" />
              )}
              Register Face
            </Button>
          </div>
        ) : !todayAttendance ? (
          <div className="space-y-3">
            <Button size="lg" className="w-full" onClick={handleCheckIn} disabled={checkInMutation.isPending || isVerifying || isCheckingLocation}>
              {checkInMutation.isPending || isVerifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : isCheckingLocation ? <><MapPin className="h-5 w-5 mr-2 animate-pulse" /> Checking Location...</> : <><ScanFace className="h-5 w-5 mr-2" /> Verify & Check In</>}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-muted-foreground" 
              onClick={handleReregisterClick} 
              disabled={isEnrolling}
            >
              {hasPendingRequest ? (
                <><Clock className="h-4 w-4 mr-2" /> Request Pending</>
              ) : hasApprovedReregister ? (
                <><ScanFace className="h-4 w-4 mr-2" /> Re-register Face (Approved)</>
              ) : (
                <><ScanFace className="h-4 w-4 mr-2" /> Request Face Re-registration</>
              )}
            </Button>
          </div>
        ) : !todayAttendance.check_out ? (
          <div className="space-y-3">
            <div className="text-success flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5" /> Checked in at {todayAttendance.check_in}
            </div>
            <Button size="lg" variant="outline" className="w-full" onClick={handleCheckOut} disabled={checkOutMutation.isPending || isVerifying || isCheckingLocation}>
              {checkOutMutation.isPending || isVerifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : isCheckingLocation ? <><MapPin className="h-5 w-5 mr-2 animate-pulse" /> Checking Location...</> : <><Camera className="h-5 w-5 mr-2" /> Verify & Check Out</>}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-muted-foreground" 
              onClick={handleReregisterClick} 
              disabled={isEnrolling}
            >
              {hasPendingRequest ? (
                <><Clock className="h-4 w-4 mr-2" /> Request Pending</>
              ) : hasApprovedReregister ? (
                <><ScanFace className="h-4 w-4 mr-2" /> Re-register Face (Approved)</>
              ) : (
                <><ScanFace className="h-4 w-4 mr-2" /> Request Face Re-registration</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-success">
            <CheckCircle className="h-12 w-12 mx-auto" />
            <p className="font-medium">Attendance Completed</p>
            <p className="text-sm text-muted-foreground">In: {todayAttendance.check_in} | Out: {todayAttendance.check_out}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-muted-foreground" 
              onClick={handleReregisterClick} 
              disabled={isEnrolling}
            >
              {hasPendingRequest ? (
                <><Clock className="h-4 w-4 mr-2" /> Request Pending</>
              ) : hasApprovedReregister ? (
                <><ScanFace className="h-4 w-4 mr-2" /> Re-register Face (Approved)</>
              ) : (
                <><ScanFace className="h-4 w-4 mr-2" /> Request Face Re-registration</>
              )}
            </Button>
          </div>
        )}
        <p className="text-xs text-center text-muted-foreground mt-4">
          <MapPin className="inline h-3 w-3 mr-1" />
          Must be within {maxDistance}m of office to mark attendance
        </p>
      </div>

      {/* Face Capture Modal */}
      {showFaceCapture && (
        <FaceCapture
          mode={faceCaptureMode === 'enroll' ? 'enroll' : 'verify'}
          onCapture={handleFaceCaptured}
          onCancel={() => setShowFaceCapture(false)}
          isProcessing={isEnrolling || isVerifying}
        />
      )}

      {/* Re-registration Request Dialog */}
      <Dialog open={showReregisterDialog} onOpenChange={setShowReregisterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Face Re-registration</DialogTitle>
            <DialogDescription>
              Your request will be sent to an admin for approval. Once approved, you can re-register your face.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Reason for re-registration (optional)"
              value={reregisterReason}
              onChange={(e) => setReregisterReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReregisterDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => requestReregisterMutation.mutate(reregisterReason)}
              disabled={requestReregisterMutation.isPending}
            >
              {requestReregisterMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
