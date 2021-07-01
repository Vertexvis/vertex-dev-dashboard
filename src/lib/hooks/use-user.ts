import Router from "next/router";
import { useEffect } from "react";
import useSWR from "swr";

interface UseUserResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly user: any;
  readonly mutate: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any,
    shouldRevalidate?: boolean | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>;
}

export default function useUser({
  redirectTo = "",
  redirectIfFound = false,
} = {}): UseUserResponse {
  const { data: user, mutate } = useSWR("/api/user");

  useEffect(() => {
    // if no redirect needed, just return (example: already on /dashboard)
    // if user data not yet there (fetch in progress, logged in or not) then don't do anything yet
    if (!redirectTo || !user) return;

    if (
      // If redirectTo is set, redirect if the user was not found.
      (redirectTo && !redirectIfFound && !user?.isLoggedIn) ||
      // If redirectIfFound is also set, redirect if the user was found
      (redirectIfFound && user?.isLoggedIn)
    ) {
      Router.push(redirectTo);
    }
  }, [user, redirectIfFound, redirectTo]);

  return { user, mutate };
}
