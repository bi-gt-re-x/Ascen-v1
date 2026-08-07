/**
 * The subject catalogue, fetched once per account.
 *
 * The list is a hundred fixed rows and the only thing about it that moves is
 * the ordering, which follows how often the account has used each subject —
 * so a fetch per opened dialog would be a hundred rows re-sent to answer a
 * question whose answer changes about once a day. It is cached module-wide
 * instead, keyed by account, and the in-flight promise is cached too so two
 * dialogs opening at once make one request rather than two.
 *
 * The cache is deliberately not invalidated when a task is created. Creating
 * one task moves a subject up the order at most one place, and re-fetching a
 * hundred rows to reflect that in a dialog the reader has just closed is not
 * worth it; the next page load has it right.
 */
import { useEffect, useState } from 'react';
import { list as listSubjects, type Subject } from '@/services/subjects';

const cache = new Map<string, Subject[]>();
const inFlight = new Map<string, Promise<Subject[]>>();

function load(username: string): Promise<Subject[]> {
  const cached = cache.get(username);
  if (cached) return Promise.resolve(cached);

  const running = inFlight.get(username);
  if (running) return running;

  const request = listSubjects(username)
    .then((result) => {
      const list = result.success ? result.subjects : [];
      // Only a real answer is cached. An empty list from a failed request
      // would otherwise be the answer for the rest of the session.
      if (result.success) cache.set(username, list);
      return list;
    })
    .catch(() => [] as Subject[])
    .finally(() => {
      inFlight.delete(username);
    });

  inFlight.set(username, request);
  return request;
}

export function useSubjects(username: string | null): Subject[] {
  const [list, setList] = useState<Subject[]>(() =>
    username ? cache.get(username) ?? [] : [],
  );

  useEffect(() => {
    if (!username) {
      setList([]);
      return;
    }
    let live = true;
    void load(username).then((result) => {
      if (live) setList(result);
    });
    return () => {
      live = false;
    };
  }, [username]);

  return list;
}
