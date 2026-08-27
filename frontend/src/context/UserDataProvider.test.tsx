/**
 * One read of the account, shared by everyone who wants it.
 *
 * The change this provider made is a performance one, so the tests are counts:
 * three consumers must produce one request, not three. That is not something a
 * rendered screen shows, so it is asserted directly on the service call — and
 * it is the whole reason the provider exists, so it is the first thing here.
 *
 * The second reason is correctness, and it has a visible symptom: completing a
 * task on the dashboard used to leave the top bar showing the XP from before,
 * because each caller held its own copy. Two consumers rendered side by side,
 * one calling `mutate`, is that bug written down.
 */
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AuthContext } from './contexts';
import { UserDataProvider } from './UserDataProvider';
import { useUserData } from '@/hooks/useUserData';
import { stats, task } from '@/test/factories';
import type { AuthValue } from './contexts';
import type { UserData } from '@/services/tasks';

// Mocked at the module boundary the provider actually imports, so the test
// exercises the real `useApi` underneath rather than a stand-in for it.
vi.mock('@/services', () => ({
  tasks: { getUserData: vi.fn() },
}));

const { tasks: taskService } = await import('@/services');
const getUserData = vi.mocked(taskService.getUserData);

const DATA: UserData = { stats: stats({ xp: 640 }), tasks: [task({ title: 'Revise' })] };

function auth(username: string | null): AuthValue {
  return {
    status: username ? 'signed-in' : 'signed-out',
    username,
    profileComplete: true,
    avatar: '/static/images/avatars/star.svg',
    signIn: async () => null,
    signOut: async () => {},
    refresh: async () => {},
  };
}

function wrapper(username: string | null = 'myles') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={auth(username)}>
        <UserDataProvider>{children}</UserDataProvider>
      </AuthContext.Provider>
    );
  };
}

beforeEach(() => {
  getUserData.mockResolvedValue({ success: true, ...DATA });
});

describe('useUserData', () => {
  it('refuses to be read outside the provider', async () => {
    // Without this the failure is a null dereference several frames deep,
    // which is a much worse thing to debug than the message.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useUserData())).toThrow(
      /must be used inside <UserDataProvider>/,
    );
    errors.mockRestore();
  });

  it('hands back the account once it has landed', async () => {
    const { result } = renderHook(() => useUserData(), { wrapper: wrapper() });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toMatchObject(DATA);
    expect(result.current.username).toBe('myles');
  });
});

describe('one read for the whole app', () => {
  it('asks the server once however many consumers mount', async () => {
    // The bug: the dashboard, the top bar and the rail mount together, so
    // arriving at /dashboard asked for the app's largest response three times.
    function Consumer({ label }: { label: string }) {
      const { data } = useUserData();
      return <span>{`${label}:${data?.stats.xp ?? '…'}`}</span>;
    }

    render(
      <AuthContext.Provider value={auth('myles')}>
        <UserDataProvider>
          <Consumer label="dashboard" />
          <Consumer label="topbar" />
          <Consumer label="rail" />
        </UserDataProvider>
      </AuthContext.Provider>,
    );

    await screen.findByText('dashboard:640');
    expect(screen.getByText('topbar:640')).toBeInTheDocument();
    expect(screen.getByText('rail:640')).toBeInTheDocument();
    expect(getUserData).toHaveBeenCalledTimes(1);
  });

  it('re-reads once when the Refresh button asks, not once per consumer', async () => {
    const seen: Array<ReturnType<typeof useUserData>> = [];
    function Consumer() {
      const value = useUserData();
      seen.push(value);
      return null;
    }

    render(
      <AuthContext.Provider value={auth('myles')}>
        <UserDataProvider>
          <Consumer />
          <Consumer />
          <Consumer />
        </UserDataProvider>
      </AuthContext.Provider>,
    );

    await waitFor(() => expect(getUserData).toHaveBeenCalledTimes(1));
    await act(async () => {
      seen[seen.length - 1]!.reload();
    });
    expect(getUserData).toHaveBeenCalledTimes(2);
  });

  it('re-reads when the account changes', async () => {
    const { rerender } = render(
      <AuthContext.Provider value={auth('myles')}>
        <UserDataProvider>
          <Reader />
        </UserDataProvider>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(getUserData).toHaveBeenCalledTimes(1));

    rerender(
      <AuthContext.Provider value={auth('someone-else')}>
        <UserDataProvider>
          <Reader />
        </UserDataProvider>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(getUserData).toHaveBeenCalledTimes(2));
  });
});

function Reader() {
  useUserData();
  return null;
}

describe('mutate moves the whole app', () => {
  it('updates every consumer at once, with no second request', async () => {
    // What it looked like before: completing a task on the dashboard left the
    // top bar showing the XP from before until something re-fetched.
    function Dashboard() {
      const { data, mutate } = useUserData();
      return (
        <button
          onClick={() =>
            mutate((current) => ({
              ...current,
              stats: { ...current.stats, xp: current.stats.xp + 40 },
            }))
          }
        >
          {`complete (${data?.stats.xp ?? '…'})`}
        </button>
      );
    }
    function Topbar() {
      const { data } = useUserData();
      return <output>{data?.stats.xp ?? '…'}</output>;
    }

    render(
      <AuthContext.Provider value={auth('myles')}>
        <UserDataProvider>
          <Dashboard />
          <Topbar />
        </UserDataProvider>
      </AuthContext.Provider>,
    );

    await screen.findByText('complete (640)');
    expect(screen.getByRole('status')).toHaveTextContent('640');

    act(() => screen.getByRole('button').click());

    expect(screen.getByRole('button')).toHaveTextContent('complete (680)');
    expect(screen.getByRole('status')).toHaveTextContent('680');
    expect(getUserData).toHaveBeenCalledTimes(1);
  });
});

describe('signed out', () => {
  it('fetches nothing and says why', async () => {
    const { result } = renderHook(() => useUserData(), { wrapper: wrapper(null) });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getUserData).not.toHaveBeenCalled();
    // The same success:false envelope the endpoint would have returned, so a
    // page says "sign in" rather than spinning forever.
    expect(result.current.error).toBe('Sign in to see your dashboard.');
    expect(result.current.data).toBeNull();
    expect(result.current.username).toBeNull();
  });
});

describe('the context value', () => {
  it('is stable while nothing about it has changed', async () => {
    // The provider sits above the entire app. `useApi` returns a fresh object
    // every render, so an unmemoised value would re-render every consumer on
    // every render of anything above this.
    const seen: Array<ReturnType<typeof useUserData>> = [];
    function Consumer() {
      seen.push(useUserData());
      return null;
    }

    const { rerender } = render(
      <AuthContext.Provider value={auth('myles')}>
        <UserDataProvider>
          <Consumer />
        </UserDataProvider>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(seen[seen.length - 1]!.data).not.toBeNull());

    const settled = seen[seen.length - 1]!;
    rerender(
      <AuthContext.Provider value={auth('myles')}>
        <UserDataProvider>
          <Consumer />
        </UserDataProvider>
      </AuthContext.Provider>,
    );
    expect(seen[seen.length - 1]).toBe(settled);
  });

  it('keeps the shape every call site already destructures', async () => {
    const { result } = renderHook(() => useUserData(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(Object.keys(result.current).sort()).toEqual([
      'data',
      'error',
      'loading',
      'mutate',
      'refreshing',
      'reload',
      'username',
    ]);
  });
});
