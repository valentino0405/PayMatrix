'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, UserPlus } from 'lucide-react';

function InviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  const [phase, setPhase] = useState<'loading' | 'accepting' | 'success' | 'error' | 'already'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isLoaded) return;

    if (!token) {
      setPhase('error');
      setErrorMsg('No invite token found in this link. It may be broken or expired.');
      return;
    }

    if (!isSignedIn) {
      // Show sign-in prompt (we render the prompt UI)
      setPhase('loading');
      return;
    }

    // User is signed in — accept the invite
    setPhase('accepting');
    fetch('/api/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.alreadyAccepted || data.alreadyFriends) {
          setPhase('already');
          setTimeout(() => router.push('/dashboard'), 2500);
        } else if (data.error) {
          setPhase('error');
          setErrorMsg(data.error);
        } else {
          setPhase('success');
          setTimeout(() => router.push('/dashboard'), 2500);
        }
      })
      .catch(() => {
        setPhase('error');
        setErrorMsg('Failed to connect. Please try again.');
      });
  }, [isLoaded, isSignedIn, token, router]);

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-indigo-700/15 blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-700/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-2xl font-extrabold">
            <span className="text-indigo-400">Pay</span><span className="text-emerald-400">Matrix</span>
          </Link>
        </div>

        <div className="rounded-3xl border border-white/[0.09] bg-[#111118] overflow-hidden shadow-2xl">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="p-8 text-center">

            {/* Not signed in → Show welcome + sign-in button */}
            {(!isSignedIn && isLoaded) && (
              <>
                <div className="mb-5 mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <UserPlus className="h-8 w-8 text-indigo-400" />
                </div>
                <h1 className="text-xl font-extrabold text-white mb-2">You're invited!</h1>
                <p className="text-sm text-slate-400 mb-6">
                  Someone wants to split expenses with you on PayMatrix. Sign in or create an account to accept.
                </p>
                <Link
                  href={`/sign-in?redirect_url=${encodeURIComponent(`/invite?token=${token}`)}`}
                  className="block w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                >
                  Sign In to Accept →
                </Link>
                <Link
                  href={`/sign-up?redirect_url=${encodeURIComponent(`/invite?token=${token}`)}`}
                  className="block w-full mt-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all"
                >
                  Create Account
                </Link>
              </>
            )}

            {/* Loading Clerk */}
            {(!isLoaded) && (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-indigo-400 mx-auto mb-4" />
                <p className="text-sm text-slate-400">Loading...</p>
              </>
            )}

            {/* Accepting */}
            {phase === 'accepting' && (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-indigo-400 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-white">Accepting invitation...</h2>
                <p className="text-sm text-slate-400 mt-2">Connecting your accounts.</p>
              </>
            )}

            {/* Success */}
            {(phase === 'success' || phase === 'already') && (
              <>
                <div className="mb-4 mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  {phase === 'already' ? 'Already connected!' : 'You\'re connected! 🎉'}
                </h2>
                <p className="text-sm text-slate-400 mt-2">
                  {phase === 'already'
                    ? 'You\'re already friends. Redirecting to dashboard...'
                    : 'Redirecting you to the dashboard to manage your expenses...'}
                </p>
                <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 animate-[width_2.5s_linear]" style={{ width: '100%', transition: 'width 2.5s linear', animationFillMode: 'forwards' }} />
                </div>
              </>
            )}

            {/* Error */}
            {phase === 'error' && (
              <>
                <div className="mb-4 mx-auto w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-rose-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Something went wrong</h2>
                <p className="text-sm text-rose-400 mt-2">{errorMsg}</p>
                <Link href="/dashboard" className="mt-6 block w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all">
                  Go to Dashboard
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
