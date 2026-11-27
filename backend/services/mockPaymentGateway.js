/**
 * mockPaymentGateway.js
 * ─────────────────────
 * Simulates a real payment gateway (Razorpay / Stripe style).
 * SUCCESS_RATE: 70% success, 30% failure — swap this file for real integration.
 *
 * Usage:
 *   const { charge } = require('./services/mockPaymentGateway');
 *   const result = await charge({ policyId, amount, customerEmail });
 */

const SUCCESS_RATE = 0.70; // 70% success

const FAILURE_REASONS = [
  'Insufficient funds',
  'Card declined by issuer',
  'Payment gateway timeout',
  'Invalid account details',
  'Transaction limit exceeded',
];

/**
 * Simulates a payment charge.
 * @param {Object} params
 * @param {string} params.policyId
 * @param {number} params.amount
 * @param {string} params.customerEmail
 * @param {string} params.policyNumber
 * @returns {Promise<{ success: boolean, transactionId?: string, failureReason?: string }>}
 */
async function charge({ policyId, amount, customerEmail, policyNumber }) {
  // Simulate network delay (100-400ms)
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));

  const success = Math.random() < SUCCESS_RATE;

  if (success) {
    return {
      success: true,
      transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      amount,
      policyId,
      policyNumber,
      processedAt: new Date().toISOString(),
    };
  } else {
    const reason = FAILURE_REASONS[Math.floor(Math.random() * FAILURE_REASONS.length)];
    return {
      success: false,
      failureReason: reason,
      amount,
      policyId,
      policyNumber,
      processedAt: new Date().toISOString(),
    };
  }
}

module.exports = { charge };
