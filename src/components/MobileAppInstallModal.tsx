import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  Apple,
  CheckCircle2,
  Copy,
  Terminal,
  Share2,
  PlusSquare,
  ShieldCheck,
  WifiOff,
  Cloud,
  QrCode,
  X,
  ExternalLink,
  Layers,
  Sparkles,
  Check,
} from 'lucide-react';
import appIconImg from '../assets/images/app_mobile_icon_1786750492443.jpg';

interface MobileAppInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileAppInstallModal: React.FC<MobileAppInstallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'ios' | 'android' | 'native' | 'offline'>('pwa');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasCopiedCli, setHasCopiedCli] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else {
      setActiveTab('ios');
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const capacitorCode = `
# 1. Install Capacitor packages
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# 2. Initialize Capacitor project
npx cap init "Zambia Airways Crew" "zm.co.zambiaairways.crew"

# 3. Build the production web bundle
npm run build

# 4. Add Android & iOS native project platforms
npx cap add android
npx cap add ios

# 5. Sync web build assets into native containers
npx cap copy

# 6. Open in Android Studio (for APK / Google Play)
npx cap open android

# 7. Open in Xcode (for iOS App Store / TestFlight)
npx cap open ios
  `.trim();

  const handleCopyCli = () => {
    navigator.clipboard.writeText(capacitorCode);
    setHasCopiedCli(true);
    setTimeout(() => setHasCopiedCli(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="bg-[#2E2C2B] text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md border border-slate-700 bg-black shrink-0">
              <img
                src={appIconImg}
                alt="Zambia Airways Mobile App Icon"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#F37C1C] uppercase font-mono tracking-wider">
                  Mobile App & PWA Hub
                </span>
                <span className="px-2 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-mono font-bold border border-emerald-500/30">
                  Ready for iOS & Android
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white">
                Zambia Airways Mobile Crew App
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1 overflow-x-auto select-none">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`px-3.5 py-2 rounded-t-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'pwa'
                ? 'border-[#F37C1C] text-[#F37C1C] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>1-Click Install (PWA)</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`px-3.5 py-2 rounded-t-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'ios'
                ? 'border-[#F37C1C] text-[#F37C1C] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Apple className="w-3.5 h-3.5" />
            <span>iOS (iPhone / iPad)</span>
          </button>

          <button
            onClick={() => setActiveTab('android')}
            className={`px-3.5 py-2 rounded-t-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'android'
                ? 'border-[#F37C1C] text-[#F37C1C] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android (Chrome / Play)</span>
          </button>

          <button
            onClick={() => setActiveTab('native')}
            className={`px-3.5 py-2 rounded-t-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'native'
                ? 'border-[#F37C1C] text-[#F37C1C] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Native Capacitor SDK</span>
          </button>

          <button
            onClick={() => setActiveTab('offline')}
            className={`px-3.5 py-2 rounded-t-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border-b-2 ${
              activeTab === 'offline'
                ? 'border-[#F37C1C] text-[#F37C1C] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline Sync</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: 1-CLICK PWA INSTALL */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              {/* App Icon & Details Card */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center gap-4 shadow-md border border-slate-800">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl border-2 border-[#F37C1C]/40 bg-black shrink-0">
                  <img
                    src={appIconImg}
                    alt="Zambia Airways App Icon"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-white truncate">Zambia Airways Crew</h4>
                    <span className="px-1.5 py-0.2 bg-[#F37C1C] text-white rounded text-[9px] font-mono font-bold">
                      PRO
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate">Zambia Airways (ZN) • Flight Operations</p>
                  <p className="text-[11px] text-emerald-400 font-mono">v3.2.0 • Standalone Mobile PWA</p>
                </div>
              </div>

              <div className="p-4 bg-orange-50/80 rounded-xl border border-orange-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-sm font-extrabold text-[#2E2C2B]">
                    Install Directly to Your Mobile Device
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Installs the full Zambia Airways OCC & Crew Portal as a standalone native-feeling app on your Home Screen without needing an app store download.
                  </p>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="px-5 py-2.5 bg-[#F37C1C] hover:bg-[#D96B12] text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-2 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>{isInstallable ? 'Install App Now' : 'Show Installation Steps'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-1">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">TLS 1.3 Encryption</h4>
                  <p className="text-[11px] text-slate-500">AES-256 secure biometric-ready mobile login.</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-1">
                    <WifiOff className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Flight Mode Offline</h4>
                  <p className="text-[11px] text-slate-500">Access duty rosters at 35,000 ft in airplane mode.</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mx-auto mb-1">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Real-Time Sync</h4>
                  <p className="text-[11px] text-slate-500">Instant flight updates across all pilot devices.</p>
                </div>
              </div>

              {/* Share link box */}
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="truncate">
                  <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">
                    Share App URL with Flight & Cabin Crew:
                  </span>
                  <span className="text-xs font-mono text-slate-700 font-bold truncate block">
                    {window.location.href}
                  </span>
                </div>
                <button
                  onClick={handleCopyUrl}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {hasCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: iOS SAFARI STEP-BY-STEP */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Apple className="w-5 h-5 text-slate-900" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  How to Install on iPhone & iPad (Safari)
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-[#2E2C2B] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <p className="font-bold text-slate-900">Open in Safari</p>
                    <p className="text-slate-600">
                      Navigate to the Zambia Airways Crew app URL in Apple Safari on your iPhone or iPad.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-[#2E2C2B] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      Tap the Share Button <Share2 className="w-4 h-4 text-blue-600 inline" />
                    </p>
                    <p className="text-slate-600">
                      Tap the square icon with the upward arrow at the bottom (iPhone) or top (iPad) of the Safari screen.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-[#2E2C2B] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      Select "Add to Home Screen" <PlusSquare className="w-4 h-4 text-slate-700 inline" />
                    </p>
                    <p className="text-slate-600">
                      Scroll down the share sheet menu and tap <em>"Add to Home Screen"</em>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-[#2E2C2B] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <p className="font-bold text-slate-900">Tap "Add" (Top-Right)</p>
                    <p className="text-slate-600">
                      The Zambia Airways app icon will be placed on your home screen. It will open in full-screen standalone mode without any browser URL bars!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ANDROID CHROME STEP-BY-STEP */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  How to Install on Android (Chrome / Samsung Browser)
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <p className="font-bold text-slate-900">Open in Google Chrome or Edge</p>
                    <p className="text-slate-600">
                      Open this URL on your Android smartphone or tablet.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <p className="font-bold text-slate-900">Tap the 3-Dots Menu (⋮) or "Install" banner</p>
                    <p className="text-slate-600">
                      Tap the three vertical dots in the top-right corner of Chrome.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="text-xs text-slate-700 space-y-0.5">
                    <p className="font-bold text-slate-900">Select "Install app" or "Add to Home screen"</p>
                    <p className="text-slate-600">
                      Confirm the installation prompt. Android will create a native app package on your device.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NATIVE CAPACITOR SDK PACKAGING GUIDE */}
          {activeTab === 'native' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Exporting to Native Android (.APK) & iOS (.IPA) with Capacitor
                  </h3>
                </div>
                <button
                  onClick={handleCopyCli}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  {hasCopiedCli ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{hasCopiedCli ? 'Copied!' : 'Copy Script'}</span>
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                You can wrap this complete React & Tailwind web application into store-ready native mobile builds for Google Play and the Apple App Store using Capacitor:
              </p>

              <div className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto shadow-inner">
                <pre>{capacitorCode}</pre>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-950 space-y-1">
                <span className="font-bold font-mono text-[10px] text-purple-700 uppercase">
                  Native Mobile Hardware Capabilities:
                </span>
                <p>
                  With Capacitor, you can seamlessly add native Biometric FaceID/Fingerprint authentication, push notifications (FCM), camera barcode scanning for airport security badges, and local SQLite offline database storage.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: OFFLINE SYNC */}
          {activeTab === 'offline' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <WifiOff className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  Offline Caching & In-Flight Operations
                </h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                The Zambia Airways Crew Control System integrates a progressive Service Worker (`sw.js`) and client-side data engine that guarantees flight deck and cabin crew access during in-flight operations without cellular data or Wi-Fi:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Offline Roster Inspection
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Captains and Cabin Crew can view their published monthly flight pairings, STD/STA report times, and aircraft tail numbers even in airplane mode.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    90-Day Recency Status
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Pilots can verify their takeoff and landing currency calculations offline before boarding.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Instant Reconnection Sync
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Once the device reconnects at the destination airport (e.g. Ndola or Johannesburg), any logged sectors are synchronized with the cloud database.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Encrypted Local Storage
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    All local state is protected under browser sandboxing with SHA-256 session integrity checks.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
            <Smartphone className="w-4 h-4 text-[#F37C1C]" />
            <span>PWA v3.2.0 • Standalone Ready</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2E2C2B] hover:bg-[#1a1918] text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
