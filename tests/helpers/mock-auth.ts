let currentUser: { id: string; email: string; name?: string | null } | null = null;

export function setAuthUser(user: { id: string; email: string; name?: string | null } | null) {
  currentUser = user;
}

export function getAuthUser() {
  return currentUser;
}

export function clearAuthUser() {
  currentUser = null;
}

/**
 * Auth mock factory. Use with `vi.mock("@/lib/auth", () => authMockFactory());`
 * at the top of each integration test file so that vi.mock is hoisted properly.
 */
export function authMockFactory() {
  return {
    auth: async () => {
      if (!currentUser) return null;
      return {
        user: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name ?? null,
        },
      };
    },
    handlers: { GET: async () => new Response(), POST: async () => new Response() },
    signIn: async () => {},
    signOut: async () => {},
  };
}
