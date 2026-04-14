import { useState, useRef } from 'react';
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
    if (!idCardFrontRef.current || !idCardBackRef.current) return;

    setIsDownloading(true);
    try {
      // Capture front side
      const frontCanvas = await html2canvas(idCardFrontRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });

      // Temporarily remove the rotateY transform and visibility restrictions for capturing the back side
      const backElement = idCardBackRef.current;
      const originalTransform = backElement.style.transform;
      const originalClassName = backElement.className;
      
      // Remove all visibility restrictions and transforms
      backElement.style.transform = 'none';
      backElement.className = backElement.className
        .replace(/invisible/g, '')
        .replace(/\[transform:rotateY\(180deg\)\]/g, '')
        .replace(/\[backface-visibility:hidden\]/g, '');
      
      // Force all hidden elements to be visible for capture
      const hiddenElements = backElement.querySelectorAll('.hidden, .sm\\:hidden, .invisible');
      const originalStyles: { el: Element; display: string; visibility: string }[] = [];
      hiddenElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        originalStyles.push({ 
          el, 
          display: htmlEl.style.display,
          visibility: htmlEl.style.visibility 
        });
        htmlEl.style.display = 'block';
        htmlEl.style.visibility = 'visible';
      });
      
      // Capture back side without restrictions
      const backCanvas = await html2canvas(backElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });
      
      // Restore original styles
      backElement.style.transform = originalTransform;
      backElement.className = originalClassName;
      originalStyles.forEach(({ el, display, visibility }) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.display = display;
        htmlEl.style.visibility = visibility;
      });

      // Download front
      const frontLink = document.createElement('a');
      frontLink.download = `${staffMember?.employee_id || 'staff'}-id-card-front.png`;
      frontLink.href = frontCanvas.toDataURL('image/png');
      frontLink.click();

      // Small delay before downloading back
      await new Promise((resolve) => setTimeout(resolve, 500));

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
    if (!idCardFrontRef.current || !idCardBackRef.current) return;

    setIsDownloading(true);
    try {
      const frontCanvas = await html2canvas(idCardFrontRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      
      // Temporarily remove the rotateY transform and visibility restrictions for capturing the back side
      const backElement = idCardBackRef.current;
      const originalTransform = backElement.style.transform;
      const originalClassName = backElement.className;
      
      // Remove all visibility restrictions and transforms
      backElement.style.transform = 'none';
      backElement.className = backElement.className
        .replace(/invisible/g, '')
        .replace(/\[transform:rotateY\(180deg\)\]/g, '')
        .replace(/\[backface-visibility:hidden\]/g, '');
      
      // Force all hidden elements to be visible for capture
      const hiddenElements = backElement.querySelectorAll('.hidden, .sm\\:hidden, .invisible');
      const originalStyles: { el: Element; display: string; visibility: string }[] = [];
      hiddenElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        originalStyles.push({ 
          el, 
          display: htmlEl.style.display,
          visibility: htmlEl.style.visibility 
        });
        htmlEl.style.display = 'block';
        htmlEl.style.visibility = 'visible';
      });
      
      const backCanvas = await html2canvas(backElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      
      // Restore original styles
      backElement.style.transform = originalTransform;
      backElement.className = originalClassName;
      originalStyles.forEach(({ el, display, visibility }) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.display = display;
        htmlEl.style.visibility = visibility;
      });

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
            className="relative [perspective:1000px] h-[320px] sm:h-[280px]"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
            >
              {/* Front of Card */}
              <div
                ref={idCardFrontRef}
                className={`absolute inset-0 [backface-visibility:hidden] overflow-hidden rounded-2xl bg-white p-0 shadow-xl ${isFlipped ? 'invisible' : ''}`}
              >
                {/* Holi powder splashes */}
                <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-gradient-radial from-pink-400/60 via-pink-300/30 to-transparent blur-xl" />
                <div className="absolute -top-4 right-8 w-24 h-24 rounded-full bg-gradient-radial from-yellow-400/50 via-yellow-300/25 to-transparent blur-xl" />
                <div className="absolute top-16 -right-6 w-28 h-28 rounded-full bg-gradient-radial from-green-400/50 via-green-300/25 to-transparent blur-xl" />
                <div className="absolute -bottom-6 left-12 w-32 h-32 rounded-full bg-gradient-radial from-blue-400/50 via-blue-300/25 to-transparent blur-xl" />
                <div className="absolute bottom-8 -right-4 w-24 h-24 rounded-full bg-gradient-radial from-purple-400/50 via-purple-300/25 to-transparent blur-xl" />
                <div className="absolute top-1/2 left-1/4 w-20 h-20 rounded-full bg-gradient-radial from-orange-400/40 via-orange-300/20 to-transparent blur-xl" />
                <div className="absolute bottom-1/3 right-1/3 w-16 h-16 rounded-full bg-gradient-radial from-red-400/40 via-red-300/20 to-transparent blur-lg" />
                <div className="absolute top-1/4 right-1/4 w-14 h-14 rounded-full bg-gradient-radial from-cyan-400/40 via-cyan-300/20 to-transparent blur-lg" />
                
                <div className="relative rounded-xl bg-white/90 backdrop-blur p-3 sm:p-6 h-full">
                  <div className="flex items-start justify-between mb-3 sm:mb-5">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                        <BrandLogo size={28} className="h-7 w-7" />
                      </div>
                      <div className="leading-tight">
                        <p className="font-display font-bold text-sm sm:text-base text-foreground">Abras Natural Spices</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Staff Identity Card</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 sm:gap-2">
                        <BadgeCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        <span className="font-display font-bold text-sm sm:text-base text-primary">VALID</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">ID: {staffMember.employee_id}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                    {/* Avatar Section */}
                    <div className="flex-shrink-0 flex justify-center sm:justify-start">
                      <div className="relative group">
                        <div className="h-20 w-20 sm:h-28 sm:w-28 rounded-xl overflow-hidden border-2 border-primary/20 bg-muted">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt="Staff photo"
                              className="h-full w-full object-cover"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                              <span className="font-display text-2xl sm:text-3xl font-bold text-primary">
                                {profile?.name?.charAt(0) || staffMember.name?.charAt(0) || 'U'}
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer"
                        >
                          {isUploadingAvatar ? (
                            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-white" />
                          ) : (
                            <Camera className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                          )}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Info Section */}
                    <div className="flex-1 space-y-2 sm:space-y-3 text-center sm:text-left">
                      <div>
                        <h2 className="font-display text-base sm:text-xl font-bold text-foreground leading-tight">{staffMember.name}</h2>
                        <p className="text-xs sm:text-sm text-primary font-medium">{staffMember.position}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 sm:gap-3 text-[11px] sm:text-sm">
                        <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 text-muted-foreground">
                          <Building2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">{staffMember.department}</span>
                        </div>
                        <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">{staffMember.phone}</span>
                        </div>
                        <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 text-muted-foreground col-span-2 sm:col-span-1">
                          <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{staffMember.email || profile?.email}</span>
                        </div>
                        <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 text-muted-foreground col-span-2 sm:col-span-1">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span>Since {new Date(staffMember.join_date).getFullYear()}</span>
                        </div>
                        {staffMember.date_of_birth && (
                          <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 text-muted-foreground col-span-2 sm:col-span-1">
                            <Cake className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span>{new Date(staffMember.date_of_birth).toLocaleDateString()}</span>
                          </div>
                        )}
                        {staffMember.address && (
                          <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2 text-muted-foreground col-span-2">
                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">{staffMember.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${staffMember.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className="text-[10px] sm:text-xs text-muted-foreground capitalize">{staffMember.status}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Swipe left for QR →</span>
                  </div>
                </div>
              </div>

              {/* Back of Card */}
              <div
                ref={idCardBackRef}
                className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-hidden rounded-2xl bg-white p-0 shadow-xl ${!isFlipped ? 'invisible' : ''}`}
              >
                {/* Holi powder splashes */}
                <div className="absolute -top-6 right-4 w-28 h-28 rounded-full bg-gradient-radial from-purple-400/60 via-purple-300/30 to-transparent blur-xl" />
                <div className="absolute -top-4 -left-6 w-24 h-24 rounded-full bg-gradient-radial from-orange-400/50 via-orange-300/25 to-transparent blur-xl" />
                <div className="absolute top-1/3 -right-8 w-32 h-32 rounded-full bg-gradient-radial from-pink-400/50 via-pink-300/25 to-transparent blur-xl" />
                <div className="absolute -bottom-8 right-8 w-28 h-28 rounded-full bg-gradient-radial from-yellow-400/50 via-yellow-300/25 to-transparent blur-xl" />
                <div className="absolute bottom-1/4 -left-4 w-24 h-24 rounded-full bg-gradient-radial from-green-400/50 via-green-300/25 to-transparent blur-xl" />
                <div className="absolute top-1/2 right-1/4 w-16 h-16 rounded-full bg-gradient-radial from-blue-400/40 via-blue-300/20 to-transparent blur-lg" />
                <div className="absolute bottom-1/2 left-1/3 w-14 h-14 rounded-full bg-gradient-radial from-red-400/40 via-red-300/20 to-transparent blur-lg" />
                <div className="absolute top-1/4 left-1/4 w-12 h-12 rounded-full bg-gradient-radial from-cyan-400/40 via-cyan-300/20 to-transparent blur-lg" />
                
                <div className="relative rounded-xl bg-white/90 backdrop-blur p-4 sm:p-6 h-full flex flex-col items-center justify-center">
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                      <BrandLogo size={24} className="h-6 w-6" />
                    </div>
                    <div className="hidden sm:block leading-tight">
                      <p className="font-display font-bold text-sm text-foreground">Abras</p>
                      <p className="text-[10px] text-muted-foreground">Natural Spices</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    <BadgeCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    <span className="font-display font-bold text-sm sm:text-base text-primary">SCAN TO VERIFY</span>
                  </div>

                  <div className="bg-white p-2 sm:p-4 rounded-xl shadow-inner">
                    <QRCodeSVG
                      value={qrData}
                      size={120}
                      level="H"
                      includeMargin={false}
                      className="w-[100px] h-[100px] sm:w-[140px] sm:h-[140px]"
                    />
                  </div>

                  <div className="mt-3 sm:mt-4 text-center">
                    <p className="font-display font-bold text-sm sm:text-base text-foreground">{staffMember.name}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{staffMember.employee_id}</p>
                  </div>

                  <span className="text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-4">← Swipe right for details</span>
                </div>
              </div>
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