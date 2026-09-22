import { PaymentTransaction, TERMINAL_STATUSES, type TransactionMethod } from '../models/paymentTransaction.model';
import { Invoice } from '../models/invoice.model';
import { getNextTransactionId } from '../models/counter.model';
import { BillingService } from './billing.service';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';
import { logAuditAction } from '../utils/auditLogger';
import { randomBytes, timingSafeEqual } from 'crypto';

/**
 * A stand-in for a payment gateway and a card terminal.
 *
 * Nothing here talks to a bank - there is no acquirer, no NPCI, no settlement.
 * What is real is the *shape* of the thing, because that is what the rest of
 * the system has to be built against:
 *
 *   - the desk asks for a collection and gets back a handle, not a result;
 *   - the payer acts somewhere the desk cannot see (their phone, the card
 *     terminal), and takes as long as they take;
 *   - the desk polls, and the gateway decides the outcome;
 *   - a terminal state is final - a success never becomes a failure later;
 *   - money is only booked when the gateway says it was captured, and booked
 *     exactly once however many times the desk asks;
 *   - an attempt nobody completes expires on the server's clock, not the
 *     browser's.
 *
 * Swapping this for a real provider means rewriting `resolve` and the two
 * reference generators. Everything around it - the model, the polling, the
 * capture, the screens - is already the real flow.
 */

/** How long the payer has before the attempt lapses. */
const WINDOW_SECONDS: Record<TransactionMethod, number> = {
  // A UPI collect request is good for a few minutes while they find their phone.
  UPI: 300,
  // The terminal gives up much sooner - the patient is standing at the counter.
  Card: 120,
};

/** The centre's own UPI handle. Fake, and clearly so. */
const CENTRE_VPA = process.env.CENTRE_UPI_VPA || 'lmsdiagnostics@demoupi';
const CENTRE_NAME = process.env.CENTRE_NAME || 'LMS Diagnostic Centre';

/** The payer's secret. See the note on `payerToken` in the model. */
const makePayerToken = (): string => randomBytes(24).toString('hex');

/** Compared in constant time, so the check cannot be probed byte by byte. */
const tokenMatches = (given: string, expected: string): boolean => {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
};

const digits = (length: number): string =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');

/** 12 digits, the shape a real bank UTR takes. */
const makeUtr = (): string => digits(12);

/** Retrieval reference number - 12 digits on a card slip. */
const makeRrn = (): string => digits(12);

/** The 6-digit approval code the issuer prints on the charge slip. */
const makeAuthCode = (): string => digits(6);

/**
 * The `upi://pay` deep link a QR encodes. Real UPI apps parse exactly these
 * parameters, so a scan opens a genuine payment sheet - addressed to a handle
 * that does not exist, which is the honest outcome for a simulator.
 */
const buildUpiIntent = (txnId: string, amount: number, note: string): string => {
  const params = new URLSearchParams({
    pa: CENTRE_VPA,
    pn: CENTRE_NAME,
    am: amount.toFixed(2),
    cu: 'INR',
    tr: txnId,
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
};

export interface InitiatePayload {
  invoiceId: string;
  amount: number;
  method: TransactionMethod;
  /** For a UPI collect request. Left blank when the patient scans the QR. */
  vpa?: string;
}

export class PaymentGatewayService {
  /**
   * Open a collection attempt. Returns immediately with something to show the
   * patient - a QR or a terminal prompt - and nothing about whether it worked,
   * because at this point nobody knows.
   */
  static async initiate(payload: InitiatePayload, currentUser: JwtPayload) {
    const { invoiceId, method } = payload;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Invoice record not found');
    if (invoice.dueAmount <= 0) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'This invoice is already fully paid');

    const amount = Math.min(invoice.dueAmount, Math.floor(Number(payload.amount) || 0));
    if (amount <= 0) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Amount must be greater than zero');

    /**
     * Two machines cannot be collecting the same due at once - the patient
     * would tap their card while the UPI request is still live and pay twice.
     * Any attempt still in flight is closed before a new one opens.
     */
    await PaymentTransaction.updateMany(
      { invoice: invoice._id, status: 'Pending' },
      { $set: { status: 'Cancelled', failureReason: 'Superseded by a new attempt', completedAt: new Date() } }
    );

    const txnId = await getNextTransactionId();
    const note = `${invoice.invoiceNumber} at ${CENTRE_NAME}`;

    const transaction = await PaymentTransaction.create({
      txnId,
      invoice: invoice._id,
      patient: invoice.patient,
      amount,
      method,
      status: 'Pending',
      vpa: method === 'UPI' ? (payload.vpa || '').trim() : '',
      upiIntent: method === 'UPI' ? buildUpiIntent(txnId, amount, note) : '',
      payerToken: makePayerToken(),
      expiresAt: new Date(Date.now() + WINDOW_SECONDS[method] * 1000),
      initiatedBy: { userId: currentUser.userId as any, name: currentUser.name },
    });

    logAuditAction({
      action: 'PAYMENT_INITIATED',
      module: 'BILLING',
      user: { id: currentUser.userId, name: currentUser.name, role: currentUser.role },
      targetId: txnId,
      details: { invoice: invoice.invoiceNumber, amount, method, vpa: transaction.vpa || undefined },
    });

    return PaymentGatewayService.present(transaction);
  }

  /**
   * What the desk polls. Expiry is applied here rather than by a background
   * job, so a stale attempt is never reported as still live just because
   * nothing has swept it up yet.
   */
  static async getStatus(txnId: string) {
    const transaction = await PaymentTransaction.findOne({ txnId }).select('+payerToken');
    if (!transaction) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'No such payment attempt');

    if (transaction.status === 'Pending' && transaction.expiresAt.getTime() <= Date.now()) {
      transaction.status = 'Expired';
      transaction.failureReason =
        transaction.method === 'UPI'
          ? 'The patient did not approve the request in time'
          : 'The terminal timed out waiting for a card';
      transaction.completedAt = new Date();
      await transaction.save();
    }

    return PaymentGatewayService.present(transaction);
  }

  /**
   * The payer's side of the counter.
   *
   * With a real provider this is the webhook the bank calls, or the reply the
   * terminal gives. Here it is driven from the simulator panel, which is the
   * one part of this flow that a real deployment deletes. The desk's screen
   * never calls this - it only ever polls - so the two halves stay honestly
   * separated.
   */
  static async simulate(
    txnId: string,
    token: string,
    outcome: 'success' | 'failure',
    options: { reason?: string; cardLast4?: string; cardNetwork?: string; vpa?: string } = {}
  ) {
    const transaction = await PaymentTransaction.findOne({ txnId }).select('+payerToken');
    // The same answer for an unknown id and a wrong token, so this cannot be
    // used to find out which transaction ids exist.
    if (!transaction || !tokenMatches(token, transaction.payerToken)) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'No such payment attempt');
    }

    // Re-running an outcome must not book the money twice.
    if (TERMINAL_STATUSES.includes(transaction.status)) {
      return PaymentGatewayService.present(transaction);
    }

    if (transaction.expiresAt.getTime() <= Date.now()) {
      return PaymentGatewayService.getStatus(txnId);
    }

    if (outcome === 'failure') {
      transaction.status = 'Failed';
      transaction.failureReason =
        options.reason ||
        (transaction.method === 'UPI' ? 'Declined by the payer' : 'Declined by the issuing bank');
      transaction.completedAt = new Date();
      await transaction.save();
      return PaymentGatewayService.present(transaction);
    }

    if (transaction.method === 'UPI') {
      transaction.utr = makeUtr();
      if (options.vpa) transaction.vpa = options.vpa;
    } else {
      transaction.cardLast4 = options.cardLast4 || digits(4);
      transaction.cardNetwork = options.cardNetwork || 'RuPay';
      transaction.authCode = makeAuthCode();
      transaction.rrn = makeRrn();
    }

    transaction.status = 'Success';
    transaction.completedAt = new Date();
    await transaction.save();

    await PaymentGatewayService.capture(transaction._id as any);

    const settled = await PaymentTransaction.findById(transaction._id);
    return PaymentGatewayService.present(settled!);
  }

  /** The desk giving up on an attempt - the patient changed their mind. */
  static async cancel(txnId: string) {
    const transaction = await PaymentTransaction.findOne({ txnId });
    if (!transaction) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'No such payment attempt');

    if (!TERMINAL_STATUSES.includes(transaction.status)) {
      transaction.status = 'Cancelled';
      transaction.failureReason = 'Cancelled at the counter';
      transaction.completedAt = new Date();
      await transaction.save();
    }

    return PaymentGatewayService.present(transaction);
  }

  /**
   * Book the money. Guarded on `payment` already being set, so a retried poll,
   * a duplicated webhook or a double-clicked button all write one receipt.
   */
  private static async capture(transactionObjectId: string) {
    const transaction = await PaymentTransaction.findById(transactionObjectId);
    if (!transaction || transaction.status !== 'Success' || transaction.payment) return;

    const { paymentRecord } = await BillingService.addPayment(
      String(transaction.invoice),
      {
        amount: transaction.amount,
        paymentMethod: transaction.method,
        transactionRef: transaction.method === 'UPI' ? transaction.utr : transaction.rrn,
        notes:
          transaction.method === 'UPI'
            ? `UPI ${transaction.txnId} · UTR ${transaction.utr}`
            : `Card ${transaction.txnId} · auth ${transaction.authCode}`,
      },
      {
        userId: String(transaction.initiatedBy.userId),
        name: transaction.initiatedBy.name,
      } as JwtPayload
    );

    transaction.payment = paymentRecord?._id as any;
    await transaction.save();

    logAuditAction({
      action: 'PAYMENT_CAPTURED',
      module: 'BILLING',
      user: { id: String(transaction.initiatedBy.userId), name: transaction.initiatedBy.name },
      targetId: transaction.txnId,
      details: {
        amount: transaction.amount,
        method: transaction.method,
        reference: transaction.utr || transaction.rrn,
        receipt: (paymentRecord as any)?.receiptNumber,
      },
    });
  }

  /** The attempts against one invoice, newest first - the desk's retry trail. */
  static async listForInvoice(invoiceId: string) {
    return PaymentTransaction.find({ invoice: invoiceId }).sort({ createdAt: -1 }).limit(20);
  }

  /**
   * What goes over the wire. Never the whole document - the desk has no use
   * for internal ids, and a client that cannot see them cannot come to depend
   * on them when this is swapped for a real provider.
   */
  private static async present(transaction: any) {
    const populated = transaction.payment
      ? await transaction.populate({ path: 'payment', select: 'receiptNumber amount' })
      : transaction;

    const secondsLeft = Math.max(0, Math.round((populated.expiresAt.getTime() - Date.now()) / 1000));

    return {
      txnId: populated.txnId,
      /**
       * Handed to the desk because the desk is what renders the simulator
       * panel. With a real provider the equivalent secret never leaves the
       * server - it is the webhook signing key - so nothing outside this
       * simulator should come to rely on it.
       */
      payerToken: populated.payerToken || '',
      method: populated.method,
      amount: populated.amount,
      status: populated.status,
      /** True while the desk should keep polling. */
      pending: populated.status === 'Pending',
      secondsLeft: populated.status === 'Pending' ? secondsLeft : 0,
      expiresAt: populated.expiresAt,
      vpa: populated.vpa || '',
      upiIntent: populated.upiIntent || '',
      payeeVpa: CENTRE_VPA,
      payeeName: CENTRE_NAME,
      utr: populated.utr || '',
      cardLast4: populated.cardLast4 || '',
      cardNetwork: populated.cardNetwork || '',
      authCode: populated.authCode || '',
      rrn: populated.rrn || '',
      failureReason: populated.failureReason || '',
      completedAt: populated.completedAt || null,
      receiptNumber: populated.payment?.receiptNumber || '',
      createdAt: populated.createdAt,
    };
  }
}
