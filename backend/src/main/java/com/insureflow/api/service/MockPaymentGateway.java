package com.insureflow.api.service;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Simulates a payment gateway (Razorpay / Stripe style): 70% success, 30% failure,
 * 100-400 ms of simulated network delay. Swap this class for a real integration.
 */
public final class MockPaymentGateway {

    private MockPaymentGateway() {}

    private static final double SUCCESS_RATE = 0.70;
    private static final List<String> FAILURE_REASONS = List.of(
            "Insufficient funds",
            "Card declined by issuer",
            "Payment gateway timeout",
            "Invalid account details",
            "Transaction limit exceeded");

    public record ChargeResult(boolean success, String transactionId, String failureReason) {}

    public static ChargeResult charge() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        try {
            Thread.sleep((long) (100 + r.nextDouble() * 300));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        if (r.nextDouble() < SUCCESS_RATE) {
            String suffix = Long.toString(Math.abs(r.nextLong()), 36).toUpperCase();
            return new ChargeResult(true, "TXN-" + System.currentTimeMillis() + "-" + suffix.substring(0, Math.min(8, suffix.length())), null);
        }
        return new ChargeResult(false, null, FAILURE_REASONS.get(r.nextInt(FAILURE_REASONS.size())));
    }
}
