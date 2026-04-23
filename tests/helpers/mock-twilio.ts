/**
 * Minimal Twilio client mock covering methods used during provisioning,
 * phone number search/purchase/release.
 */

export const mockTwilioState = {
  subAccounts: new Map<string, { sid: string; authToken: string; friendlyName: string }>(),
  trunks: new Map<string, { sid: string; friendlyName: string; domainName: string }>(),
  purchasedNumbers: new Map<string, { sid: string; phoneNumber: string }>(),
  calls: [] as Array<{ op: string; args: unknown[] }>,
  failMode: null as null | "createSubAccount" | "createTrunk" | "purchase",
};

export function resetMockTwilio() {
  mockTwilioState.subAccounts.clear();
  mockTwilioState.trunks.clear();
  mockTwilioState.purchasedNumbers.clear();
  mockTwilioState.calls.length = 0;
  mockTwilioState.failMode = null;
}

let idCounter = 0;
const nextSid = (prefix: string) =>
  `${prefix}${String(Date.now()).padStart(20, "0")}${String(++idCounter).padStart(8, "0")}`.slice(
    0,
    34
  );

function makeTrunk(sid: string) {
  return {
    originationUrls: {
      async create(params: unknown) {
        mockTwilioState.calls.push({ op: "trunks.originationUrls.create", args: [sid, params] });
        return { sid: nextSid("OU") };
      },
    },
    phoneNumbers: {
      async create(params: { phoneNumberSid: string }) {
        mockTwilioState.calls.push({ op: "trunks.phoneNumbers.create", args: [sid, params] });
        return { sid: nextSid("PN") };
      },
    },
  };
}

function makeSubAccount(sid: string) {
  return {
    incomingPhoneNumbers: Object.assign(
      async (pnSid: string) => ({
        async remove() {
          mockTwilioState.calls.push({ op: "incomingPhoneNumbers.remove", args: [pnSid] });
          return true;
        },
      }),
      {
        async create(params: { phoneNumber: string }) {
          mockTwilioState.calls.push({ op: "incomingPhoneNumbers.create", args: [params] });
          if (mockTwilioState.failMode === "purchase") {
            throw new Error("Twilio: purchase failed");
          }
          const psid = nextSid("PN");
          mockTwilioState.purchasedNumbers.set(psid, {
            sid: psid,
            phoneNumber: params.phoneNumber,
          });
          return { sid: psid, phoneNumber: params.phoneNumber };
        },
      }
    ),
  };
}

function masterClient() {
  return {
    api: {
      v2010: {
        accounts: {
          async create(params: { friendlyName: string }) {
            mockTwilioState.calls.push({ op: "subAccounts.create", args: [params] });
            if (mockTwilioState.failMode === "createSubAccount") {
              throw new Error("Twilio: sub-account creation failed");
            }
            const sid = nextSid("AC");
            const authToken = `token-${sid}`;
            mockTwilioState.subAccounts.set(sid, {
              sid,
              authToken,
              friendlyName: params.friendlyName,
            });
            return { sid, authToken };
          },
        },
      },
    },
    trunking: {
      v1: {
        trunks: Object.assign(
          (sid: string) => makeTrunk(sid),
          {
            async create(params: { friendlyName: string; domainName: string }) {
              mockTwilioState.calls.push({ op: "trunks.create", args: [params] });
              if (mockTwilioState.failMode === "createTrunk") {
                throw new Error("Twilio: trunk creation failed");
              }
              const sid = nextSid("TK");
              mockTwilioState.trunks.set(sid, { sid, friendlyName: params.friendlyName, domainName: params.domainName });
              return { sid };
            },
          }
        ),
      },
    },
    availablePhoneNumbers: (_country: string) => ({
      local: {
        async list(params: { limit: number; areaCode?: string }) {
          mockTwilioState.calls.push({ op: "availablePhoneNumbers.list", args: [params] });
          const area = params.areaCode ?? "555";
          return Array.from({ length: Math.min(params.limit, 3) }, (_, i) => ({
            phoneNumber: `+1${area}55500${i}0`,
            friendlyName: `(${area}) 555-00${i}0`,
            locality: "TestCity",
            region: "CA",
            capabilities: { voice: true, sms: true },
          }));
        },
      },
    }),
  };
}

export function twilioMockFactory() {
  return {
    getMasterClient: () => masterClient(),
    getSubAccountClient: (sid: string, _authToken: string) => ({
      ...masterClient(),
      ...makeSubAccount(sid),
    }),
  };
}
