/**
 * The account gate, client side.
 *
 * The backend gate (backend/middleware/gate.py) is the one that matters — it
 * is what actually stops a signed-out request, and it cannot be got around.
 * This is the same rule expressed in the router so a signed-out visitor sees
 * the sign-in popup instead of a page that renders empty and then errors.
 *
 * Waiting on `status` rather than treating unknown as signed-out is the whole
 * point of having three states: without it, a signed-in visitor is bounced to
 * the popup for the moment before the session check comes back.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loading } from '@/components';
import { useAuth } from '@/hooks';

export function RequireAccount() {
  const { status, profileComplete } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <Loading label="Checking your account" />;
  }

  if (status === 'signed-out') {
    // `next` carries where they were headed, so finishing the flow lands them
    // there rather than on the home page — same contract as the backend gate.
    const next = encodeURIComponent(location.pathname);
    return <Navigate to={`/home?auth=login&next=${next}`} replace />;
  }

  if (!profileComplete) {
    const next = encodeURIComponent(location.pathname);
    return <Navigate to={`/home?auth=profile&next=${next}`} replace />;
  }

  return <Outlet />;
}
