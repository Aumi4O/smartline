/**
 * Minimal in-memory Stripe mock for the subset of methods used by
 * stripe-service.ts and the webhook handler. Fully deterministic.
 */

interface MockSession {
  id: string;
  url: string;
  customer: string;
  mode: string;
  metadata: Record<string, string>;
  amount_total: number | null;
  subscription: string | null;
  success_url: string;
  cancel_url: string;
}

interface MockCustomer {
  id: string;
  email: string;
  name?: string;
  metadata: Record<string, string>;
}

interface MockSubscription {
  id: string;
  customer: string;
  status: string;
  metadata: Record<string, string>;
}

interface MockPortalSession {
  id: string;
  url: string;
  customer: string;
  return_url: string;
}

export const mockStripeState = {
  customers: new Map<string, MockCustomer>(),
  sessions: new Map<string, MockSession>(),
  subscriptions: new Map<string, MockSubscription>(),
  portals: new Map<string, MockPortalSession>(),
  calls: [] as Array<{ op: string; args: unknown[] }>,
  signatureValid: true,
  constructedEvents: [] as unknown[],
};

export function resetMockStripe() {
  mockStripeState.customers.clear();
  mockStripeState.sessions.clear();
  mockStripeState.subscriptions.clear();
  mockStripeState.portals.clear();
  mockStripeState.calls.length = 0;
  mockStripeState.signatureValid = true;
  mockStripeState.constructedEvents.length = 0;
}

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now()}_${++idCounter}`;

export const mockStripe = {
  customers: {
    async create(params: { email: string; name?: string; metadata?: Record<string, string> }) {
      const customer: MockCustomer = {
        id: nextId("cus_test"),
        email: params.email,
        name: params.name,
        metadata: params.metadata ?? {},
      };
      mockStripeState.customers.set(customer.id, customer);
      mockStripeState.calls.push({ op: "customers.create", args: [params] });
      return customer;
    },
    async retrieve(id: string) {
      return mockStripeState.customers.get(id) ?? null;
    },
  },
  checkout: {
    sessions: {
      async create(params: {
        customer: string;
        mode: string;
        line_items: Array<{ price_data: { unit_amount: number } }>;
        metadata?: Record<string, string>;
        subscription_data?: { metadata?: Record<string, string> };
        success_url: string;
        cancel_url: string;
      }) {
        const id = nextId("cs_test");
        const amount = params.line_items.reduce(
          (sum, li) => sum + (li.price_data?.unit_amount ?? 0),
          0
        );
        const session: MockSession = {
          id,
          url: `https://checkout.stripe.com/c/pay/${id}`,
          customer: params.customer,
          mode: params.mode,
          metadata: params.metadata ?? {},
          amount_total: amount,
          subscription: params.mode === "subscription" ? nextId("sub_test") : null,
          success_url: params.success_url,
          cancel_url: params.cancel_url,
        };
        mockStripeState.sessions.set(id, session);
        mockStripeState.calls.push({ op: "checkout.sessions.create", args: [params] });
        return session;
      },
    },
  },
  billingPortal: {
    sessions: {
      async create(params: { customer: string; return_url: string }) {
        const id = nextId("bps_test");
        const portal: MockPortalSession = {
          id,
          url: `https://billing.stripe.com/p/session/${id}`,
          customer: params.customer,
          return_url: params.return_url,
        };
        mockStripeState.portals.set(id, portal);
        mockStripeState.calls.push({ op: "billingPortal.sessions.create", args: [params] });
        return portal;
      },
    },
  },
  subscriptions: {
    async retrieve(id: string) {
      return mockStripeState.subscriptions.get(id) ?? null;
    },
  },
  webhooks: {
    constructEvent(_body: string | Buffer, _signature: string, _secret: string) {
      if (!mockStripeState.signatureValid) {
        throw new Error("Invalid signature");
      }
      const event =
        mockStripeState.constructedEvents.shift() ?? {
          id: nextId("evt_test"),
          type: "ping",
          data: { object: {} },
        };
      return event;
    },
  },
  billing: {
    meterEvents: {
      async create(_params: unknown) {
        mockStripeState.calls.push({ op: "billing.meterEvents.create", args: [_params] });
        return { id: nextId("mev_test") };
      },
    },
  },
};

export function stripeMockFactory() {
  return { stripe: mockStripe };
}
