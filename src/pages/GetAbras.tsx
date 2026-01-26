import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Share, CheckCircle2, ArrowRight, Apple, Monitor } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const GetAbras = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const features = [
    "Mark attendance with face recognition",
    "View your salary and payslips",
    "Track work hours & overtime",
    "Access your digital ID card",
    "Works offline",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="px-6 py-8 text-center">
        <div className="flex justify-center mb-4">
          <BrandLogo size={80} />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2 font-playfair">
          Abras Staff Hub
        </h1>
        <p className="text-muted-foreground">
          Staff Attendance & Payroll Management
        </p>
      </header>

      <main className="px-4 pb-12 max-w-md mx-auto space-y-6">
        {/* Install Card */}
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <Download className="h-5 w-5 text-primary" />
              Install the App
            </CardTitle>
            <CardDescription>
              Get the full app experience on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInstalled ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="font-medium text-foreground">App Installed!</p>
                <Button onClick={() => window.location.href = "/login"} className="w-full">
                  Open App <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : deferredPrompt ? (
              <Button onClick={handleInstall} size="lg" className="w-full">
                <Download className="mr-2 h-5 w-5" />
                Install Now
              </Button>
            ) : isIOS ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Apple className="h-8 w-8 text-foreground" />
                  <div className="text-left">
                    <p className="font-medium text-sm">iPhone / iPad</p>
                    <p className="text-xs text-muted-foreground">Follow the steps below</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                    <p>Tap the <Share className="inline h-4 w-4 mx-1" /> Share button in Safari</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                    <p>Scroll and tap "Add to Home Screen"</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                    <p>Tap "Add" to install</p>
                  </div>
                </div>
              </div>
            ) : isAndroid ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Smartphone className="h-8 w-8 text-foreground" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Android</p>
                    <p className="text-xs text-muted-foreground">Follow the steps below</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                    <p>Tap the menu (⋮) in Chrome</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                    <p>Tap "Install app" or "Add to Home screen"</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                    <p>Tap "Install" to confirm</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Monitor className="h-8 w-8 text-foreground" />
                  <div className="text-left">
                    <p className="font-medium text-sm">Desktop</p>
                    <p className="text-xs text-muted-foreground">Install from your browser</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Look for the install icon in your browser's address bar, or open this page on your mobile device for the best experience.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">What you can do</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Already have account */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Already have an account?</p>
          <Button variant="outline" onClick={() => window.location.href = "/login"}>
            Login to Abras Staff Hub
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Abras Natural Spices</p>
      </footer>
    </div>
  );
};

export default GetAbras;
