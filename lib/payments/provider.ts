/**
 * PaymentProvider abstraction so Razorpay, Cashfree, or any other gateway
 * can be swapped in without touching application code. In development
 * (PAYMENTS_ENABLED=false), the app never calls this at all — all reports
 * are unlocked for free. In production, wire up a real provider by
 * implementing this interface and swapping the export below.
 */

export type PaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

export interface CreateOrderParams {
  amountPaise: number;
  donationPaise: number;
  receiptId: string;
}

export interface CreateOrderResult {
  providerOrderId: string;
  checkoutUrl?: string;
}

export interface VerifyPaymentParams {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<boolean>;
  refund(providerPaymentId: string, amountPaise: number): Promise<boolean>;
  /** Called from the webhook route; must be idempotent. */
  handleWebhook(rawBody: string, signatureHeader: string): Promise<{
    providerPaymentId: string;
    status: PaymentStatus;
  } | null>;
}

/** Dev-mode mock provider — always "succeeds" instantly, never touches a
 * real gateway. Used automatically when PAYMENTS_ENABLED=false or when no
 * RAZORPAY_KEY_ID is configured. */
export class MockPaymentProvider implements PaymentProvider {
  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    return { providerOrderId: `mock_order_${Date.now()}` };
  }
  async verifyPayment(): Promise<boolean> {
    return true;
  }
  async refund(): Promise<boolean> {
    return true;
  }
  async handleWebhook(): Promise<{ providerPaymentId: string; status: PaymentStatus } | null> {
    return { providerPaymentId: `mock_payment_${Date.now()}`, status: "PAID" };
  }
}

// TODO(production): implement RazorpayPaymentProvider / CashfreePaymentProvider
// against this same interface, using RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET /
// RAZORPAY_WEBHOOK_SECRET (or Cashfree equivalents) from environment
// variables — never hard-code secrets, and never trust a frontend claim of
// payment success without verifying the signed webhook.

export function getPaymentProvider(): PaymentProvider {
  return new MockPaymentProvider();
}
