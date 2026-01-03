import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFaceAuth } from '@/hooks/use-face-auth';
import { FaceCapture } from '@/components/FaceCapture';
import { Camera, CheckCircle, Loader2, ScanFace } from 'lucide-react';
import { format } from 'date-fns';

export default function MarkAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { enrollFace, verifyFace, isEnrolling, isVerifying } = useFaceAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [faceCaptureMode, setFaceCaptureMode] = useState<'enroll' | 'verify-in' | 'verify-out'>('enroll');

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

  // Handle face capture complete
  const handleFaceCaptured = async (imageBase64: string) => {
    if (faceCaptureMode === 'enroll') {
      if (!user?.id || !staffMember?.id) return;
      const success = await enrollFace(user.id, staffMember.id, imageBase64);
      if (success) {
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

  // Handle face check-in
  const handleCheckIn = () => {
    if (!staffMember?.face_image_url) {
      toast({
        title: 'Face not enrolled',
        description: 'Please register your face first.',
        variant: 'destructive',
      });
      return;
    }
    setFaceCaptureMode('verify-in');
    setShowFaceCapture(true);
  };

  // Handle face check-out
  const handleCheckOut = () => {
    if (!staffMember?.face_image_url) {
      toast({
        title: 'Face not enrolled',
        description: 'Please register your face first.',
        variant: 'destructive',
      });
      return;
    }
    setFaceCaptureMode('verify-out');
    setShowFaceCapture(true);
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const checkInTime = format(now, 'HH:mm');
      const isLate = now.getHours() >= 9;
      
      const { error } = await supabase.from('attendance_records').insert({
        staff_id: staffMember?.id,
        date: today,
        check_in: checkInTime,
        status: isLate ? 'late' : 'present',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
      toast({ title: 'Checked in successfully!' });
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
    },
  });

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
          <Button size="lg" className="w-full" onClick={handleCheckIn} disabled={checkInMutation.isPending || isVerifying}>
            {checkInMutation.isPending || isVerifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ScanFace className="h-5 w-5 mr-2" />}
            Verify & Check In
          </Button>
        ) : !todayAttendance.check_out ? (
          <>
            <div className="text-success flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5" /> Checked in at {todayAttendance.check_in}
            </div>
            <Button size="lg" variant="outline" className="w-full" onClick={handleCheckOut} disabled={checkOutMutation.isPending || isVerifying}>
              {checkOutMutation.isPending || isVerifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Camera className="h-5 w-5 mr-2" />}
              Verify & Check Out
            </Button>
          </>
        ) : (
          <div className="space-y-2 text-success">
            <CheckCircle className="h-12 w-12 mx-auto" />
            <p className="font-medium">Attendance Completed</p>
            <p className="text-sm text-muted-foreground">In: {todayAttendance.check_in} | Out: {todayAttendance.check_out}</p>
          </div>
        )}
        <p className="text-xs text-center text-muted-foreground mt-4">
          Use your registered face to verify identity
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
    </div>
  );
}
