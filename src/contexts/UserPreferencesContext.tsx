import React from "react";

/**
 * User-facing preferences that persist across sessions. Add new fields here as
 * additional settings ship; keep them serializable so they round-trip through
 * localStorage cleanly.
 */
export interface UserPreferences {
  /**
   * When enabled, double-clicking a resource row navigates to that resource's
   * dedicated page. Single-click behavior (opening the details drawer) is
   * unchanged regardless of this setting. Defaults to on: it is additive and
   * the user asked for the behavior.
   */
  readonly doubleClickNavigates: boolean;
}

export const defaultUserPreferences: UserPreferences = {
  doubleClickNavigates: true,
};

/** localStorage key under which preferences are serialized. */
export const PreferencesStorageKey = "vertex-dashboard.preferences";

interface UserPreferencesContextValue {
  readonly preferences: UserPreferences;
  readonly setPreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => void;
  /** True once localStorage has been read on the client. */
  readonly hydrated: boolean;
}

const UserPreferencesContext =
  React.createContext<UserPreferencesContextValue | null>(null);

function readStoredPreferences(): Partial<UserPreferences> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(PreferencesStorageKey);
    if (raw == null) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object") return {};

    const result: { doubleClickNavigates?: boolean } = {};
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.doubleClickNavigates === "boolean") {
      result.doubleClickNavigates = candidate.doubleClickNavigates;
    }

    return result;
  } catch {
    return {};
  }
}

export function UserPreferencesProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): JSX.Element {
  // Start from a stable default so server and first client render agree and
  // hydration never mismatches. localStorage is read in the effect below.
  const [preferences, setPreferences] = React.useState<UserPreferences>(
    defaultUserPreferences
  );
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const stored = readStoredPreferences();
    if (Object.keys(stored).length > 0) {
      setPreferences((current) => ({ ...current, ...stored }));
    }
    setHydrated(true);
  }, []);

  const setPreference = React.useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((current) => {
        const next = { ...current, [key]: value };
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              PreferencesStorageKey,
              JSON.stringify(next)
            );
          } catch {
            // Ignore storage failures (private mode, quota, etc.); the in-memory
            // value still updates for the current session.
          }
        }
        return next;
      });
    },
    []
  );

  const value = React.useMemo<UserPreferencesContextValue>(
    () => ({ preferences, setPreference, hydrated }),
    [preferences, setPreference, hydrated]
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const context = React.useContext(UserPreferencesContext);
  if (context == null) {
    throw new Error(
      "useUserPreferences must be used within a UserPreferencesProvider."
    );
  }

  return context;
}

const noopSetPreference: UserPreferencesContextValue["setPreference"] = () =>
  undefined;

/**
 * Like {@link useUserPreferences} but tolerates a missing provider, falling
 * back to defaults. Use for widely-reused components (e.g. clickable rows) that
 * may render in isolation (tests, storybook) without the app-level provider.
 */
export function useOptionalUserPreferences(): UserPreferencesContextValue {
  const context = React.useContext(UserPreferencesContext);
  if (context != null) return context;

  return {
    preferences: defaultUserPreferences,
    setPreference: noopSetPreference,
    hydrated: false,
  };
}
