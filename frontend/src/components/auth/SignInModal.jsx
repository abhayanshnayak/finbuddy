import { useEffect, useId, useRef, useCallback } from 'react';
import { X, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/authStore';

let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit() {
  return Boolean(window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay());
}

async function closeTopLayerDialog(dialog) {
  if (!dialog || !dialog.open) return;
  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }
  if (dialog.open) {
    dialog.close();
  }
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  );
}

export default function SignInModal() {
  const {
    signInModalOpen,
    signInPromptReason,
    closeSignInModal,
    signInWithGoogle,
    signInWithFacebook,
    signingInProvider,
    authError,
    authConfigured,
  } = useAuth();

  const dialogRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  const requestAnimatedClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      closeSignInModal();
      return;
    }
    if (dialog.open) {
      closeTopLayerDialog(dialog);
    } else {
      closeSignInModal();
    }
  }, [closeSignInModal]);

  // Synchronize React open state with native <dialog> showModal() / close()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (signInModalOpen && !dialog.open) {
      dialog.removeAttribute('data-closing');
      dialog.showModal();
    } else if (!signInModalOpen && dialog.open) {
      closeTopLayerDialog(dialog);
    }
  }, [signInModalOpen]);

  // Native close/cancel events and Safari light-dismiss fallback when closedby is unsupported
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const onClose = () => {
      dialog.returnValue = '';
      dialog.removeAttribute('data-closing');
      closeSignInModal();
    };

    const onCancel = (event) => {
      if (!supportsTopLayerExit()) {
        event.preventDefault();
        closeTopLayerDialog(dialog);
      }
    };

    dialog.addEventListener('close', onClose);
    dialog.addEventListener('cancel', onCancel);

    let cleanupLightDismiss;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const isOutside = (e) => {
        const rect = dialog.getBoundingClientRect();
        return (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        );
      };
      let pressedOutside = false;
      const onPointerDown = (e) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e) => {
        if (pressedOutside && isOutside(e)) {
          closeTopLayerDialog(dialog);
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
      cleanupLightDismiss = () => {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', onClose);
      dialog.removeEventListener('cancel', onCancel);
      cleanupLightDismiss?.();
    };
  }, [closeSignInModal]);

  const busy = Boolean(signingInProvider);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="sc-dialog w-[calc(100%-2rem)] max-w-md rounded-2xl bg-surface text-ink border border-line-strong shadow-2xl p-0 overflow-hidden no-print"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 id={titleId} className="text-lg font-bold tracking-tight text-ink">
              Sign in to StockClue
            </h1>
            <p id={descId} className="mt-1 text-xs text-ink-muted leading-relaxed">
              {signInPromptReason ||
                'Sign-in is optional — all research reports remain open. Sign in with Google or Facebook to enable upcoming personalized features.'}
            </p>
          </div>
          <button
            type="button"
            onClick={requestAnimatedClose}
            aria-label="Close sign-in dialog"
            className="p-1.5 -mr-1 -mt-1 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">{authError}</span>
          </div>
        )}

        {!authConfigured && !authError && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">
              Firebase credentials are not configured in this environment. Add{' '}
              <code className="font-mono">VITE_FIREBASE_*</code> variables to enable sign-in.
            </span>
          </div>
        )}

        {/* Provider Buttons */}
        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            autoFocus
            disabled={busy || !authConfigured}
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-xl border border-line-strong bg-surface hover:bg-subtle text-ink text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {signingInProvider === 'google' ? (
              <Loader2 className="w-4 h-4 animate-spin text-brand" aria-hidden="true" />
            ) : (
              <GoogleIcon />
            )}
            <span>
              {signingInProvider === 'google' ? 'Signing in with Google...' : 'Continue with Google'}
            </span>
          </button>

          <button
            type="button"
            disabled={busy || !authConfigured}
            onClick={signInWithFacebook}
            className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {signingInProvider === 'facebook' ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
            ) : (
              <FacebookIcon />
            )}
            <span>
              {signingInProvider === 'facebook'
                ? 'Signing in with Facebook...'
                : 'Continue with Facebook'}
            </span>
          </button>
        </div>

        {/* Optional Note Footer */}
        <div className="mt-5 pt-4 border-t border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" aria-hidden="true" />
            <span>Only your name and email are used to personalize your account.</span>
          </div>
          <button
            type="button"
            onClick={requestAnimatedClose}
            className="text-xs font-medium text-ink-secondary hover:text-ink px-2.5 py-1 rounded-lg hover:bg-subtle transition-colors cursor-pointer flex-shrink-0"
          >
            Not now
          </button>
        </div>
      </div>
    </dialog>
  );
}
