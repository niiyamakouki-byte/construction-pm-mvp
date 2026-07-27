// Provenance: LAPOSITE-STRIPE-IDEMPOTENCY-20260728 / Codex
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { processStripeEventOnce } from "../../api/stripe-webhook";

type BillingEvent = {
  processed_at: string | null;
};

class BillingEventsTable {
  private readonly events = new Map<string, BillingEvent>();

  insert(row: { stripe_event_id: string }) {
    if (this.events.has(row.stripe_event_id)) {
      return Promise.resolve({
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      });
    }
    this.events.set(row.stripe_event_id, { processed_at: null });
    return Promise.resolve({ error: null });
  }

  select() {
    return this;
  }

  update(update: { processed_at: string }) {
    return new BillingEventMutation(this.events, "update", update.processed_at);
  }

  delete() {
    return new BillingEventMutation(this.events, "delete");
  }

  eq(_column: string, eventId: string) {
    return {
      maybeSingle: async () => ({
        data: this.events.get(eventId) ?? null,
        error: null,
      }),
    };
  }
}

class BillingEventMutation {
  private eventId: string | null = null;

  constructor(
    private readonly events: Map<string, BillingEvent>,
    private readonly operation: "update" | "delete",
    private readonly processedAt?: string,
  ) {}

  eq(_column: string, eventId: string) {
    this.eventId = eventId;
    if (this.operation === "update") {
      const event = this.events.get(eventId);
      if (event) event.processed_at = this.processedAt ?? null;
      return Promise.resolve({ error: null });
    }
    return this;
  }

  is(_column: string, value: null) {
    const event = this.eventId ? this.events.get(this.eventId) : null;
    if (this.eventId && event?.processed_at === value) {
      this.events.delete(this.eventId);
    }
    return Promise.resolve({ error: null });
  }
}

function createSupabaseFake(): SupabaseClient {
  const billingEvents = new BillingEventsTable();
  return {
    from: (table: string) => {
      expect(table).toBe("billing_events");
      return billingEvents;
    },
  } as unknown as SupabaseClient;
}

function stripeEvent(id: string): Stripe.Event {
  return {
    id,
    type: "customer.subscription.updated",
  } as Stripe.Event;
}

describe("processStripeEventOnce", () => {
  it("同一 event.id の逐次再送では副作用を1回だけ実行する", async () => {
    const supabase = createSupabaseFake();
    const event = stripeEvent("evt_sequential");
    let sideEffects = 0;
    const processEvent = async () => {
      sideEffects += 1;
    };

    await expect(processStripeEventOnce(supabase, event, processEvent)).resolves.toBe(
      "processed",
    );
    await expect(processStripeEventOnce(supabase, event, processEvent)).resolves.toBe(
      "duplicate",
    );

    expect(sideEffects).toBe(1);
  });

  it("同一 event.id の並行再送では副作用を1回だけ実行する", async () => {
    const supabase = createSupabaseFake();
    const event = stripeEvent("evt_concurrent");
    let sideEffects = 0;
    let releaseSideEffect: (() => void) | undefined;
    const sideEffectGate = new Promise<void>((resolve) => {
      releaseSideEffect = resolve;
    });
    const processEvent = async () => {
      sideEffects += 1;
      await sideEffectGate;
    };

    const first = processStripeEventOnce(supabase, event, processEvent);
    const concurrent = processStripeEventOnce(supabase, event, processEvent);

    await expect(concurrent).resolves.toBe("in_progress");
    expect(sideEffects).toBe(1);
    releaseSideEffect?.();
    await expect(first).resolves.toBe("processed");
    expect(sideEffects).toBe(1);
  });
});
