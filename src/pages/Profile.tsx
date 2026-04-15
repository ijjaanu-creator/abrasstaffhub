import { useState, useRef, type Ref } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, Building2, Calendar, Loader2, Save, Camera, BadgeCheck, Download, RotateCcw, MapPin, Cake, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { BrandLogo } from '@/components/BrandLogo';

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idCardFrontRef = useRef<HTMLDivElement>(null);
  const idCardBackRef = useRef<HTMLDivElement>(null);
  const idCardExportFrontRef = useRef<HTMLDivElement>(null);
  const idCardExportBackRef = useRef<HTMLDivElement>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setFormData({ name: data.name, phone: data.phone || '' });
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: staffMember } = useQuery({
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

  const captureIdCardSide = async (element: HTMLDivElement) => {
    await document.fonts.ready;

    return html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });
  };

  const getIdCardCanvases = async () => {
    if (!idCardExportFrontRef.current || !idCardExportBackRef.current) {
      throw new Error('ID card is not ready yet');
    }

    const frontCanvas = await captureIdCardSide(idCardExportFrontRef.current);
    const backCanvas = await captureIdCardSide(idCardExportBackRef.current);

    return { frontCanvas, backCanvas };
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('profiles')
        .update({ name: data.name, phone: data.phone })
        .eq('id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['my-profile', user.id] });
        queryClient.invalidateQueries({ queryKey: ['verify-staff-profile', user.id] });
      }
      toast({ title: 'Profile updated successfully' });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating profile', description: error.message, variant: 'destructive' });
    },
  });

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image file', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image must be less than 5MB', variant: 'destructive' });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      queryClient.setQueryData(['my-profile', user.id], (oldData: any) =>
        oldData ? { ...oldData, avatar_url: avatarUrl } : oldData
      );
      queryClient.invalidateQueries({ queryKey: ['my-profile', user.id] });
      queryClient.invalidateQueries({ queryKey: ['verify-staff-profile', user.id] });
      toast({ title: 'Avatar updated successfully' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error uploading avatar', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDownloadIdCard = async () => {
    if (!idCardExportFrontRef.current || !idCardExportBackRef.current) return;

    setIsDownloading(true);
    try {
      const { frontCanvas, backCanvas } = await getIdCardCanvases();

      // Download front
      const frontLink = document.createElement('a');
      frontLink.download = `${staffMember?.employee_id || 'staff'}-id-card-front.png`;
      frontLink.href = frontCanvas.toDataURL('image/png');
      frontLink.click();

      // Small delay before downloading back
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Download back
      const backLink = document.createElement('a');
      backLink.download = `${staffMember?.employee_id || 'staff'}-id-card-back.png`;
      backLink.href = backCanvas.toDataURL('image/png');
      backLink.click();

      toast({ title: 'Both sides of ID card downloaded' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error downloading ID card', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrintIdCard = async () => {
    if (!idCardExportFrontRef.current || !idCardExportBackRef.current) return;

    setIsDownloading(true);
    try {
      const { frontCanvas, backCanvas } = await getIdCardCanvases();

      const front = frontCanvas.toDataURL('image/png');
      const back = backCanvas.toDataURL('image/png');

      const w = window.open('', '_blank');
      if (!w) throw new Error('Popup blocked');

      w.document.open();
      w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Print ID Card</title>
  <style>
    @page { margin: 12mm; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrap { display:flex; gap:16mm; align-items:flex-start; flex-wrap:wrap; }
    figure { margin:0; }
    figcaption { margin: 6mm 0 3mm; font-size: 12px; color: #444; }
    img { display:block; width: 86mm; height: 54mm; object-fit: cover; border-radius: 4mm; box-shadow: 0 2mm 8mm rgba(0,0,0,.12); }
  </style>
</head>
<body>
  <div class="wrap">
    <figure>
      <figcaption>Front</figcaption>
      <img src="${front}" alt="Staff ID card front" />
    </figure>
    <figure>
      <figcaption>Back</figcaption>
      <img src="${back}" alt="Staff ID card back" />
    </figure>
  </div>
  <script>window.onload = () => { window.focus(); window.print(); };</script>
</body>
</html>`);
      w.document.close();

      toast({ title: 'Print dialog opened' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error printing ID card', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    // Swipe left to flip to back, swipe right to flip to front
    if (Math.abs(diff) > 50) {
      if (diff > 0 && !isFlipped) {
        setIsFlipped(true);
      } else if (diff < 0 && isFlipped) {
        setIsFlipped(false);
      }
    }
    setTouchStart(null);
  };

  // QR code now contains a URL to the verification page
  const qrData = staffMember 
    ? `${window.location.origin}/verify?id=${staffMember.employee_id}`
    : '';

  const renderIdCardFront = (cardRef: Ref<HTMLDivElement>, mode: 'preview' | 'export') => {
    if (!staffMember) return null;

    const isExport = mode === 'export';
    const email = staffMember.email || profile?.email || 'Not set';

    return (
      <div
        ref={cardRef}
        className={isExport
          ? 'relative h-[540px] w-[860px] overflow-hidden rounded-[32px] bg-white p-0 shadow-xl'
          : `absolute inset-0 [backface-visibility:hidden] rounded-2xl bg-white p-0 shadow-xl ${isFlipped ? 'invisible' : ''}`}
      >
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-gradient-radial from-pink-400/60 via-pink-300/30 to-transparent blur-xl" />
        <div className="absolute -top-4 right-8 h-24 w-24 rounded-full bg-gradient-radial from-yellow-400/50 via-yellow-300/25 to-transparent blur-xl" />
        <div className="absolute top-16 -right-6 h-28 w-28 rounded-full bg-gradient-radial from-green-400/50 via-green-300/25 to-transparent blur-xl" />
        <div className="absolute -bottom-6 left-12 h-32 w-32 rounded-full bg-gradient-radial from-blue-400/50 via-blue-300/25 to-transparent blur-xl" />
        <div className="absolute bottom-8 -right-4 h-24 w-24 rounded-full bg-gradient-radial from-purple-400/50 via-purple-300/25 to-transparent blur-xl" />
        <div className="absolute top-1/2 left-1/4 h-20 w-20 rounded-full bg-gradient-radial from-orange-400/40 via-orange-300/20 to-transparent blur-xl" />
        <div className="absolute bottom-1/3 right-1/3 h-16 w-16 rounded-full bg-gradient-radial from-red-400/40 via-red-300/20 to-transparent blur-lg" />
        <div className="absolute top-1/4 right-1/4 h-14 w-14 rounded-full bg-gradient-radial from-cyan-400/40 via-cyan-300/20 to-transparent blur-lg" />

        <div className={`relative flex h-full flex-col rounded-xl bg-white/90 backdrop-blur ${isExport ? 'p-8' : 'p-3 sm:p-6'}`}>
          <div className={`flex items-start justify-between ${isExport ? 'mb-8' : 'mb-3 sm:mb-5'}`}>
            <div className={`flex items-center ${isExport ? 'gap-3' : 'gap-2'}`}>
              <div className={isExport
                ? 'flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15'
                : 'flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15 sm:h-10 sm:w-10'}>
                <BrandLogo size={isExport ? 34 : 28} className={isExport ? 'h-8 w-8' : 'h-7 w-7'} />
              </div>
              <div className="leading-tight">
                <p className={isExport
                  ? 'font-display text-xl font-bold text-foreground'
                  : 'font-display text-sm font-bold text-foreground sm:text-base'}>
                  Abras Natural Spices
                </p>
                <p className={isExport ? 'text-sm text-muted-foreground' : 'text-[10px] text-muted-foreground sm:text-xs'}>
                  Staff Identity Card
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className={`inline-flex items-center ${isExport ? 'gap-2.5' : 'gap-1.5 sm:gap-2'}`}>
                <BadgeCheck className={isExport ? 'h-6 w-6 text-primary' : 'h-4 w-4 text-primary sm:h-5 sm:w-5'} />
                <span className={isExport
                  ? 'font-display text-lg font-bold text-primary'
                  : 'font-display text-sm font-bold text-primary sm:text-base'}>
                  VALID
                </span>
              </div>
              <p className={isExport ? 'mt-1 text-sm text-muted-foreground' : 'text-[10px] text-muted-foreground sm:text-xs'}>
                ID: {staffMember.employee_id}
              </p>
            </div>
          </div>

          <div className={isExport ? 'flex flex-1 items-start gap-8' : 'flex flex-col gap-3 sm:flex-row sm:gap-6'}>
            <div className="flex flex-shrink-0 justify-center sm:justify-start">
              <div className={`relative ${isExport ? '' : 'group'}`}>
                <div className={isExport
                  ? 'h-40 w-40 overflow-hidden rounded-2xl border-2 border-primary/20 bg-muted'
                  : 'h-20 w-20 rounded-xl border-2 border-primary/20 bg-muted overflow-hidden sm:h-28 sm:w-28'}>
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Staff photo"
                      className="h-full w-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                      <span className={isExport
                        ? 'font-display text-5xl font-bold text-primary'
                        : 'font-display text-2xl font-bold text-primary sm:text-3xl'}>
                        {profile?.name?.charAt(0) || staffMember.name?.charAt(0) || 'U'}
                      </span>
                    </div>
                  )}
                </div>

                {!isExport && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="h-5 w-5 animate-spin text-white sm:h-6 sm:w-6" />
                      ) : (
                        <Camera className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </>
                )}
              </div>
            </div>

            <div className={isExport ? 'min-w-0 flex-1 space-y-4 text-left' : 'flex-1 space-y-2 text-center sm:space-y-3 sm:text-left'}>
              <div>
                <h2 className={isExport
                  ? 'font-display text-3xl font-bold leading-tight text-foreground'
                  : 'font-display text-base font-bold leading-tight text-foreground sm:text-xl'}>
                  {staffMember.name}
                </h2>
                <p className={isExport ? 'mt-1 text-base font-medium text-primary' : 'text-xs font-medium text-primary sm:text-sm'}>
                  {staffMember.position}
                </p>
              </div>

              {isExport ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm leading-tight">
                  <div className="flex min-w-0 items-start gap-2 text-muted-foreground">
                    <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span className="break-words">{staffMember.department}</span>
                  </div>
                  <div className="flex min-w-0 items-start gap-2 text-muted-foreground">
                    <Phone className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span className="break-words">{staffMember.phone}</span>
                  </div>
                  <div className="col-span-2 flex min-w-0 items-start gap-2 text-muted-foreground">
                    <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span className="break-all">{email}</span>
                  </div>
                  <div className="flex min-w-0 items-start gap-2 text-muted-foreground">
                    <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>Since {new Date(staffMember.join_date).getFullYear()}</span>
                  </div>
                  {staffMember.date_of_birth && (
                    <div className="flex min-w-0 items-start gap-2 text-muted-foreground">
                      <Cake className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{new Date(staffMember.date_of_birth).toLocaleDateString()}</span>
                    </div>
                  )}
                  {staffMember.address && (
                    <div className="col-span-2 flex min-w-0 items-start gap-2 text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span className="break-words">{staffMember.address}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:gap-3 sm:text-sm">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground sm:justify-start sm:gap-2">
                    <Building2 className="h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate">{staffMember.department}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground sm:justify-start sm:gap-2">
                    <Phone className="h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate">{staffMember.phone}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-1 text-muted-foreground sm:col-span-1 sm:justify-start sm:gap-2">
                    <Mail className="h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />
                    <span className="max-w-[120px] truncate sm:max-w-none">{email}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-1 text-muted-foreground sm:col-span-1 sm:justify-start sm:gap-2">
                    <Calendar className="h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />
                    <span>Since {new Date(staffMember.join_date).getFullYear()}</span>
                  </div>
                  {staffMember.date_of_birth && (
                    <div className="col-span-2 flex items-center justify-center gap-1 text-muted-foreground sm:col-span-1 sm:justify-start sm:gap-2">
                      <Cake className="h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />
                      <span>{new Date(staffMember.date_of_birth).toLocaleDateString()}</span>
                    </div>
                  )}
                  {staffMember.address && (
                    <div className="col-span-2 flex items-center justify-center gap-1 text-muted-foreground sm:justify-start sm:gap-2">
                      <MapPin className="h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />
                      <span className="truncate">{staffMember.address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={isExport
            ? 'mt-auto flex items-center justify-between border-t border-border/50 pt-6'
            : 'mt-2 flex items-center justify-between border-t border-border/50 pt-2 sm:mt-4 sm:pt-4'}>
            <div className={`flex items-center ${isExport ? 'gap-2' : 'gap-1.5 sm:gap-2'}`}>
              <div className={`${isExport ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5 sm:h-2 sm:w-2'} rounded-full ${staffMember.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className={isExport ? 'text-sm capitalize text-muted-foreground' : 'text-[10px] capitalize text-muted-foreground sm:text-xs'}>
                {staffMember.status}
              </span>
            </div>
            <span className={isExport ? 'text-sm text-muted-foreground' : 'text-[10px] text-muted-foreground sm:text-xs'}>
              {isExport ? 'Back side has QR verification' : 'Swipe left for QR →'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderIdCardBack = (cardRef: Ref<HTMLDivElement>, mode: 'preview' | 'export') => {
    if (!staffMember) return null;

    const isExport = mode === 'export';

    return (
      <div
        ref={cardRef}
        className={isExport
          ? 'relative h-[540px] w-[860px] overflow-hidden rounded-[32px] bg-white p-0 shadow-xl'
          : `absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl bg-white p-0 shadow-xl ${!isFlipped ? 'invisible' : ''}`}
      >
        <div className="absolute -top-6 right-4 h-28 w-28 rounded-full bg-gradient-radial from-purple-400/60 via-purple-300/30 to-transparent blur-xl" />
        <div className="absolute -top-4 -left-6 h-24 w-24 rounded-full bg-gradient-radial from-orange-400/50 via-orange-300/25 to-transparent blur-xl" />
        <div className="absolute top-1/3 -right-8 h-32 w-32 rounded-full bg-gradient-radial from-pink-400/50 via-pink-300/25 to-transparent blur-xl" />
        <div className="absolute -bottom-8 right-8 h-28 w-28 rounded-full bg-gradient-radial from-yellow-400/50 via-yellow-300/25 to-transparent blur-xl" />
        <div className="absolute bottom-1/4 -left-4 h-24 w-24 rounded-full bg-gradient-radial from-green-400/50 via-green-300/25 to-transparent blur-xl" />
        <div className="absolute top-1/2 right-1/4 h-16 w-16 rounded-full bg-gradient-radial from-blue-400/40 via-blue-300/20 to-transparent blur-lg" />
        <div className="absolute bottom-1/2 left-1/3 h-14 w-14 rounded-full bg-gradient-radial from-red-400/40 via-red-300/20 to-transparent blur-lg" />
        <div className="absolute top-1/4 left-1/4 h-12 w-12 rounded-full bg-gradient-radial from-cyan-400/40 via-cyan-300/20 to-transparent blur-lg" />

        <div className={`relative flex h-full flex-col items-center justify-center rounded-xl bg-white/90 backdrop-blur ${isExport ? 'p-8' : 'p-4 sm:p-6'}`}>
          <div className={`absolute flex items-center ${isExport ? 'left-8 top-8 gap-3' : 'left-4 top-4 gap-2'}`}>
            <div className={isExport
              ? 'flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15'
              : 'flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15'}>
              <BrandLogo size={isExport ? 34 : 24} className={isExport ? 'h-8 w-8' : 'h-6 w-6'} />
            </div>
            <div className={isExport ? 'block leading-tight' : 'hidden leading-tight sm:block'}>
              <p className={isExport
                ? 'font-display text-xl font-bold text-foreground'
                : 'font-display text-sm font-bold text-foreground'}>
                Abras Natural Spices
              </p>
              <p className={isExport ? 'text-sm text-muted-foreground' : 'text-[10px] text-muted-foreground'}>
                Staff Identity Card
              </p>
            </div>
          </div>

          <div className={`flex items-center ${isExport ? 'mb-6 gap-2.5' : 'mb-3 gap-1.5 sm:mb-4 sm:gap-2'}`}>
            <BadgeCheck className={isExport ? 'h-6 w-6 text-primary' : 'h-4 w-4 text-primary sm:h-5 sm:w-5'} />
            <span className={isExport
              ? 'font-display text-lg font-bold text-primary'
              : 'font-display text-sm font-bold text-primary sm:text-base'}>
              SCAN TO VERIFY
            </span>
          </div>

          <div className={isExport ? 'rounded-2xl bg-white p-5 shadow-inner' : 'rounded-xl bg-white p-2 shadow-inner sm:p-4'}>
            <QRCodeSVG
              value={qrData}
              size={isExport ? 200 : 120}
              level="H"
              includeMargin={false}
              className={isExport ? 'h-[200px] w-[200px]' : 'h-[100px] w-[100px] sm:h-[140px] sm:w-[140px]'}
            />
          </div>

          <div className={isExport ? 'mt-6 text-center' : 'mt-3 text-center sm:mt-4'}>
            <p className={isExport
              ? 'font-display text-2xl font-bold text-foreground'
              : 'font-display text-sm font-bold text-foreground sm:text-base'}>
              {staffMember.name}
            </p>
            <p className={isExport ? 'mt-1 text-sm text-muted-foreground' : 'text-[10px] text-muted-foreground sm:text-xs'}>
              {staffMember.employee_id}
            </p>
          </div>

          <span className={isExport ? 'mt-6 text-sm text-muted-foreground' : 'mt-3 text-[10px] text-muted-foreground sm:mt-4 sm:text-xs'}>
            {isExport ? 'Verify this staff card using the QR code above' : '← Swipe right for details'}
          </span>
        </div>
      </div>
    );
  };

  if (profileLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">View and update your profile information</p>
      </div>

      {/* Staff ID Card with Flip */}
      {staffMember && (
        <div className="space-y-3">
          <div
            aria-hidden="true"
            className="pointer-events-none fixed top-0"
            style={{ left: '-2000px', width: 0, height: 0, overflow: 'visible' }}
          >
            {renderIdCardFront(idCardExportFrontRef, 'export')}
            <div className="h-6" />
            {renderIdCardBack(idCardExportBackRef, 'export')}
          </div>

          <div 
            className="relative [perspective:1000px] h-[420px] sm:h-[320px]"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
            >
              {renderIdCardFront(idCardFrontRef, 'preview')}
              {renderIdCardBack(idCardBackRef, 'preview')}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsFlipped(!isFlipped)} className="flex-1">
              <RotateCcw className="h-4 w-4 mr-2" />
              Flip Card
            </Button>
            <Button variant="outline" onClick={handlePrintIdCard} disabled={isDownloading} className="flex-1">
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Print
            </Button>
            <Button variant="outline" onClick={handleDownloadIdCard} disabled={isDownloading} className="flex-1">
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download
            </Button>
          </div>
        </div>
      )}

      {/* Profile Edit Card */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold mb-4">Account Information</h3>
        
        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <User className="h-5 w-5" />
              <span>{profile?.name}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Mail className="h-5 w-5" />
              <span>{profile?.email}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Phone className="h-5 w-5" />
              <span>{profile?.phone || 'Not set'}</span>
            </div>
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}