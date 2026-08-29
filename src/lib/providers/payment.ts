// PAYMENT HAPPENS INSIDE BIT ONLY.
//
// Closet never touches money. It does not process, hold, escrow, route, or
// verify a payment, and it never stores card numbers, bank details, or a real
// Bit transfer confirmation. The transfer is a Bit P2P transaction directly
// between the two women.
//
// All this layer does is RECORD that a transaction was reported — three
// timestamps and a reference code we generated. That record is the only
// payment data on our side, and it is what keeps us out of scope as a payment
// business (payment-contact spec §1–§2).
//
// The interface is deliberately named "record*", not "charge*" / "hold*", so
// no future code can accidentally make Closet a money mover. A real gateway
// (v2, after the pilot clears its gates) would implement a SEPARATE
// `EscrowPaymentProvider` interface, not this one.

export interface PaymentRecorder {
  /** Called when a seller approves a request — a transaction now exists. */
  recordTransactionOpened(txId: string, ref: string): Promise<void>;
  /** Called when the buyer self-reports she sent the Bit transfer. */
  recordBuyerReportedPaid(txId: string, method: string): Promise<void>;
  /** Called when the seller self-reports she received the Bit transfer. */
  recordSellerReportedReceived(txId: string): Promise<void>;
}

class RecordOnlyPaymentRecorder implements PaymentRecorder {
  async recordTransactionOpened(txId: string, ref: string): Promise<void> {
    console.info(
      `[Payment/record-only] tx ${txId} opened, ref ${ref}. Money moves in Bit P2P; Closet records only.`,
    );
  }
  async recordBuyerReportedPaid(txId: string, method: string): Promise<void> {
    console.info(
      `[Payment/record-only] tx ${txId}: buyer self-reported paid (${method}). Not verified — Bit does not expose this.`,
    );
  }
  async recordSellerReportedReceived(txId: string): Promise<void> {
    console.info(
      `[Payment/record-only] tx ${txId}: seller self-reported received. Two matching self-reports is the whole reconciliation.`,
    );
  }
}

let _recorder: PaymentRecorder | null = null;
export function paymentRecorder(): PaymentRecorder {
  if (!_recorder) _recorder = new RecordOnlyPaymentRecorder();
  return _recorder;
}
