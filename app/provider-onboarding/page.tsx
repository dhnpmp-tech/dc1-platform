'use client';

import { useState, useEffect } from 'react';

export default function ProviderOnboarding() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [hwCheckDone, setHwCheckDone] = useState(false);
  const [runMode, setRunMode] = useState<'always-on' | 'manual' | 'scheduled'>('always-on');
  const [schedStart, setSchedStart] = useState('23:00');
  const [schedEnd, setSchedEnd] = useState('07:00');
  const [apiKey, setApiKey] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [connected, setConnected] = useState(false);

  // Step 2: auto-pass hardware check after 2s
  useEffect(() => {
    if (step === 2) {
      const t = setTimeout(() => setHwCheckDone(true), 2000);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Step 4: poll for connection
  useEffect(() => {
    if (step !== 4 || !apiKey) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/providers/status/${apiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'online' || data.status === 'connected') {
            setConnected(true);
            clearInterval(interval);
          }
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, apiKey]);

  const canContinueStep1 = name.trim() && email.trim() && consent1 && consent2;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/providers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, run_mode: runMode,
          scheduled_start: runMode === 'scheduled' ? schedStart : undefined,
          scheduled_end: runMode === 'scheduled' ? schedEnd : undefined,
        }),
      });
      const data = await res.json();
      const key = data.api_key;
      setApiKey(key);
      window.location.href = `/api/providers/download?key=${key}&platform=windows`;
      setStep(4);
    } catch {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">
          Become a <span className="text-[#FFD700]">DC1 Provider</span>
        </h1>
        <p className="text-gray-400 mb-10">Earn SAR by sharing your GPU compute power.</p>

        {/* Progress */}
        <div className="flex gap-2 mb-10">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1 flex-1 rounded ${s <= step ? 'bg-[#FFD700]' : 'bg-gray-700'}`} />
          ))}
        </div>

        {/* Step 1 */}
        <div className={`mb-8 ${step < 1 ? 'hidden' : ''}`}>
          <h2 className="text-xl font-semibold mb-4">1. Identity &amp; Consent</h2>
          <div className="space-y-4">
            <input
              type="text" placeholder="Your name" value={name}
              onChange={e => setName(e.target.value)}
              disabled={step > 1}
              className="w-full bg-[#252525] border border-gray-700 rounded-lg px-4 py-3 focus:border-[#FFD700] focus:outline-none disabled:opacity-50"
            />
            <input
              type="email" placeholder="Email address" value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={step > 1}
              className="w-full bg-[#252525] border border-gray-700 rounded-lg px-4 py-3 focus:border-[#FFD700] focus:outline-none disabled:opacity-50"
            />
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={consent1} onChange={e => setConsent1(e.target.checked)} disabled={step > 1}
                className="mt-1 accent-[#FFD700]" />
              <span className="text-sm text-gray-300">I agree to share my GPU compute resources with DC1 renters</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={consent2} onChange={e => setConsent2(e.target.checked)} disabled={step > 1}
                className="mt-1 accent-[#FFD700]" />
              <span className="text-sm text-gray-300">I understand I can pause or stop at any time — my GPU, my rules</span>
            </label>
            {step === 1 && (
              <button onClick={() => setStep(2)} disabled={!canContinueStep1}
                className="w-full py-3 rounded-lg font-semibold bg-[#FFD700] text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e6c200] transition">
                Continue →
              </button>
            )}
          </div>
        </div>

        {/* Step 2 */}
        {step >= 2 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Hardware Check</h2>
            {!hwCheckDone ? (
              <div className="flex items-center gap-3 text-gray-400">
                <div className="w-5 h-5 border-2 border-[#00A8E1] border-t-transparent rounded-full animate-spin" />
                Checking your GPU...
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-green-400">✅ We&apos;ll verify your GPU automatically when you install. Minimum: NVIDIA 8GB+ VRAM.</p>
                {step === 2 && (
                  <button onClick={() => setStep(3)}
                    className="w-full py-3 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200] transition">
                    Continue →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3 */}
        {step >= 3 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. How should DC1 use your GPU?</h2>
            <p className="text-gray-400 text-sm mb-4">You can change this anytime from your dashboard.</p>
            <div className="space-y-3">
              {([
                { value: 'always-on' as const, label: 'Always-on', badge: 'Recommended', desc: 'Runs quietly in background. Starts automatically at login. Earn while idle.' },
                { value: 'manual' as const, label: 'Manual only', desc: 'You control when to share. Start/stop from your dashboard or a desktop shortcut.' },
                { value: 'scheduled' as const, label: 'Scheduled', desc: 'Set a time window. DC1 runs only during those hours.' },
              ]).map(opt => (
                <div key={opt.value}
                  onClick={() => { if (step === 3) setRunMode(opt.value); }}
                  className={`p-4 rounded-lg border cursor-pointer transition ${runMode === opt.value ? 'border-[#FFD700] bg-[#252525]' : 'border-gray-700 bg-[#1f1f1f] hover:border-gray-500'} ${step > 3 ? 'opacity-50 cursor-default' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 ${runMode === opt.value ? 'border-[#FFD700] bg-[#FFD700]' : 'border-gray-500'}`} />
                    <span className="font-semibold">{opt.label}</span>
                    {opt.badge && <span className="text-xs bg-[#FFD700] text-black px-2 py-0.5 rounded-full font-medium">{opt.badge}</span>}
                  </div>
                  <p className="text-sm text-gray-400 ml-6">{opt.desc}</p>
                  {opt.value === 'scheduled' && runMode === 'scheduled' && (
                    <div className="flex gap-3 mt-3 ml-6">
                      <label className="text-sm text-gray-400">From
                        <input type="time" value={schedStart} onChange={e => setSchedStart(e.target.value)}
                          className="ml-2 bg-[#333] border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </label>
                      <label className="text-sm text-gray-400">To
                        <input type="time" value={schedEnd} onChange={e => setSchedEnd(e.target.value)}
                          className="ml-2 bg-[#333] border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {step === 3 && (
              <div className="mt-6">
                <button onClick={handleDownload} disabled={downloading}
                  className="w-full py-3 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200] transition disabled:opacity-50">
                  {downloading ? 'Preparing...' : 'Download My Installer →'}
                </button>
              </div>
            )}
            {apiKey && step >= 4 && (
              <p className="text-sm text-gray-400 mt-2">
                <a href={`/api/providers/download?key=${apiKey}&platform=linux`} className="text-[#00A8E1] underline">Linux / Mac</a>
              </p>
            )}
          </div>
        )}

        {/* Step 4 */}
        {step >= 4 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Connect Your GPU</h2>
            {!connected ? (
              <div className="space-y-4">
                <p className="text-green-400">✅ Installer downloaded! Run it on your PC.</p>
                <div className="flex items-center gap-3 text-[#00A8E1]">
                  <div className="w-3 h-3 bg-[#00A8E1] rounded-full animate-pulse" />
                  Waiting for your GPU to connect...
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-2xl">🟢 You&apos;re live! {name}&apos;s GPU just connected.</p>
                <a href={`/provider?key=${apiKey}`}
                  className="inline-block py-3 px-8 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200] transition">
                  View My Dashboard →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
