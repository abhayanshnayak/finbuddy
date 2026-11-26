import { useId, useRef, useState } from 'react';
import { LogIn, LogOut, ChevronsUpDown, X } from 'lucide-react';
import { useAuth } from '../../context/authStore';

function UserAvatar({ user, size = 'sm' }) {
  const [imgError, setImgError] = useState(false);
  const dim = size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';

  if (user.photoURL && !imgError) {
    return (
      <img
        src={user.photoURL}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${dim} rounded-full object-cover border border-line flex-shrink-0`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${dim} rounded-full bg-brand-soft text-brand border border-brand/20 font-bold inline-flex items-center justify-center flex-shrink-0`}
    >
      {user.initials}
    </span>
  );
}

function ProviderBadge({ providerId, providerLabel }) {
  if (providerId === 'facebook.com') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#1877F2]/12 text-[#1877F2] dark:text-[#60A5FA] border border-[#1877F2]/20">
        {providerLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-brand-soft text-brand border border-brand/20">
      {providerLabel}
    </span>
  );
}

export default function SidebarUserSection({ collapsed = false, onAction }) {
  const { user, loading, openSignInModal, signOut } = useAuth();
  const popoverId = useId();
  const popoverRef = useRef(null);

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Checking account status"
        className={`rounded-lg animate-pulse ${
          collapsed ? 'flex justify-center p-2' : 'flex items-center gap-2.5 px-2.5 py-2'
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-subtle flex-shrink-0" />
        {!collapsed && (
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-3 w-24 rounded bg-subtle" />
            <div className="h-2.5 w-16 rounded bg-subtle" />
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    const handleOpenSignIn = () => {
      onAction?.();
      openSignInModal();
    };

    if (collapsed) {
      return (
        <button
          type="button"
          onClick={handleOpenSignIn}
          title="Sign in (Google or Facebook)"
          aria-label="Sign in"
          className="w-full flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-ink-secondary hover:text-brand hover:bg-subtle transition-colors cursor-pointer"
        >
          <LogIn className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] font-medium leading-none">Sign in</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleOpenSignIn}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-line bg-subtle/60 hover:bg-subtle hover:border-line-strong text-left transition-colors cursor-pointer group"
      >
        <span className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-ink-secondary group-hover:text-brand group-hover:border-brand/30 flex-shrink-0 transition-colors">
          <LogIn className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-ink block leading-tight truncate">
            Sign in
          </span>
          <span className="text-[11px] text-ink-muted block truncate mt-0.5">
            Optional · Google / Facebook
          </span>
        </div>
      </button>
    );
  }

  const handleSignOut = async () => {
    popoverRef.current?.hidePopover?.();
    onAction?.();
    await signOut();
  };

  return (
    <div className="relative">
      <button
        type="button"
        popoverTarget={popoverId}
        title={collapsed ? `${user.displayName} (${user.providerLabel})` : user.displayName}
        aria-label={`Signed in as ${user.displayName}. Open account options.`}
        className={`w-full rounded-lg transition-colors cursor-pointer hover:bg-subtle text-left ${
          collapsed
            ? 'flex flex-col items-center justify-center gap-1 py-1.5 px-1'
            : 'flex items-center gap-2.5 px-2 py-2'
        }`}
      >
        <span className="relative flex-shrink-0">
          <UserAvatar key={user.photoURL || user.uid} user={user} size="sm" />
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface"
          />
        </span>

        {collapsed ? (
          <span className="text-[10px] font-semibold text-ink-secondary truncate max-w-[52px] leading-tight">
            {user.firstName}
          </span>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-ink block truncate leading-tight">
                {user.displayName}
              </span>
              <span className="text-[11px] text-ink-muted block truncate mt-0.5">
                {user.email || `Signed in via ${user.providerLabel}`}
              </span>
            </div>
            <ChevronsUpDown
              className="w-3.5 h-3.5 text-ink-muted flex-shrink-0"
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {/* Native Popover Panel (button-revealing-a-panel, not an ARIA menu) */}
      <div
        ref={popoverRef}
        id={popoverId}
        popover="auto"
        className="sc-account-popover w-64 rounded-xl bg-surface text-ink border border-line-strong shadow-xl p-3.5 no-print"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar key={`pop-${user.photoURL || user.uid}`} user={user} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate leading-tight">
                {user.displayName}
              </p>
              {user.email && (
                <p className="text-xs text-ink-muted truncate mt-0.5">{user.email}</p>
              )}
              <div className="mt-1.5">
                <ProviderBadge
                  providerId={user.providerId}
                  providerLabel={user.providerLabel}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            popoverTarget={popoverId}
            popoverTargetAction="hide"
            aria-label="Close account panel"
            className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 text-[11px] text-ink-muted bg-subtle/70 border border-line rounded-lg px-2.5 py-2 leading-relaxed">
          Signed in and ready for upcoming personalized StockClue features.
        </p>

        <div className="mt-3 pt-2.5 border-t border-line">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
