package com.insureflow.api.service;

import com.insureflow.api.support.Db;
import com.insureflow.api.support.JsDate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

import static com.insureflow.api.support.Js.*;

/**
 * Core billing logic (former services/billingService.js):
 * 1. generateMonthlyPremiumRecords() creates premium_records for all ACTIVE policies
 * 2. processPendingCharges() charges PENDING records via the mock gateway
 * 3. failed charges are queued into payment_retry_queue; processDueRetries() works through it
 */
@Service
public class BillingService {

    /** Retry schedule: days after the original billing date. */
    static final int[] RETRY_SCHEDULE_DAYS = {3, 7, 14};

    private final Db db;

    public BillingService(Db db) { this.db = db; }

    public Map<String, Object> generateMonthlyPremiumRecords(LocalDate billingDate) {
        // new Date(y, m, 1) is local midnight; toISOString() is UTC, so east of UTC this is the previous day (kept as-is)
        LocalDate firstOfMonth = billingDate.withDayOfMonth(1);
        JsDate billingMonth = JsDate.ofLocalDate(firstOfMonth);
        String billingMonthStr = billingMonth.toISODate();
        String dueDate = JsDate.ofLocalDate(firstOfMonth.plusDays(7)).toISOString();

        System.out.println("\n📋 [Billing] Generating premium records for " + billingMonthStr + "...");

        List<Map<String, Object>> activePolicies = db.query("""
                  SELECT p.id, p.policy_number, p.monthly_premium, p.user_id,
                         u.email, u.first_name, u.last_name
                  FROM policies p
                  JOIN users u ON p.user_id = u.id
                  WHERE p.status = 'ACTIVE'
                """);
        System.out.println("   Found " + activePolicies.size() + " active policies.");

        int created = 0;
        int skipped = 0;
        for (Map<String, Object> policy : activePolicies) {
            if (!db.query("SELECT id FROM premium_records WHERE policy_id = $1::uuid AND billing_month = $2::date",
                    policy.get("id"), billingMonthStr).isEmpty()) {
                skipped++;
                continue;
            }
            db.query("""
                    INSERT INTO premium_records
                      (policy_id, billing_month, amount, status, due_date, retry_count)
                    VALUES ($1::uuid, $2::date, $3::numeric, 'PENDING', $4::timestamptz, 0)
                    """, policy.get("id"), billingMonthStr, policy.get("monthly_premium"), dueDate);
            created++;
        }

        System.out.println("   ✅ Created: " + created + " records | Skipped (already exist): " + skipped);
        return obj("created", created, "skipped", skipped);
    }

    public Map<String, Object> processPendingCharges() {
        System.out.println("\n💳 [Billing] Processing pending charges...");
        List<Map<String, Object>> pending = db.query("""
                  SELECT pr.id, pr.policy_id, pr.amount, pr.billing_month,
                         p.policy_number, u.email, u.first_name, u.last_name
                  FROM premium_records pr
                  JOIN policies p ON pr.policy_id = p.id
                  JOIN users u ON p.user_id = u.id
                  WHERE pr.status = 'PENDING'
                """);
        System.out.println("   Found " + pending.size() + " pending charges.");

        int paid = 0;
        int failed = 0;
        for (Map<String, Object> record : pending) {
            MockPaymentGateway.ChargeResult result = MockPaymentGateway.charge();
            if (result.success()) {
                db.query("""
                        UPDATE premium_records
                        SET status = 'PAID', paid_at = CURRENT_TIMESTAMP,
                            retry_count = retry_count + 1
                        WHERE id = $1::uuid
                        """, record.get("id"));
                System.out.println("   ✅ PAID   — " + str(record.get("policy_number")) + " ($" + str(record.get("amount")) + ")");
                paid++;
            } else {
                db.query("""
                        UPDATE premium_records
                        SET status = 'FAILED', retry_count = retry_count + 1
                        WHERE id = $1::uuid
                        """, record.get("id"));
                System.out.println("   ❌ FAILED — " + str(record.get("policy_number")) + ": " + result.failureReason());
                scheduleRetries(record.get("id"), result.failureReason());
                failed++;
            }
        }

        System.out.println("   Summary → PAID: " + paid + " | FAILED: " + failed);
        return obj("paid", paid, "failed", failed);
    }

    private void scheduleRetries(Object premiumRecordId, String initialFailureReason) {
        ZonedDateTime now = ZonedDateTime.now(JsDate.zone());
        for (int i = 0; i < RETRY_SCHEDULE_DAYS.length; i++) {
            String scheduledAt = JsDate.ofInstant(now.plusDays(RETRY_SCHEDULE_DAYS[i]).toInstant()).toISOString();
            db.query("""
                    INSERT INTO payment_retry_queue
                      (premium_record_id, retry_number, scheduled_at, result)
                    VALUES ($1::uuid, $2::int, $3::timestamptz, $4::text)
                    """, premiumRecordId, i + 1, scheduledAt, "Scheduled after: " + initialFailureReason);
        }
        db.query("UPDATE premium_records SET status = 'RETRY_SCHEDULED' WHERE id = $1::uuid", premiumRecordId);
    }

    public Map<String, Object> processDueRetries() {
        System.out.println("\n🔄 [Billing] Processing due retries...");
        List<Map<String, Object>> dueRetries = db.query("""
                  SELECT rq.id as queue_id, rq.premium_record_id, rq.retry_number,
                         pr.policy_id, pr.amount, pr.billing_month,
                         p.policy_number, u.email, u.first_name, u.last_name
                  FROM payment_retry_queue rq
                  JOIN premium_records pr ON rq.premium_record_id = pr.id
                  JOIN policies p ON pr.policy_id = p.id
                  JOIN users u ON p.user_id = u.id
                  WHERE rq.scheduled_at <= NOW()
                    AND rq.attempted_at IS NULL
                    AND pr.status IN ('RETRY_SCHEDULED', 'FAILED')
                  ORDER BY rq.scheduled_at ASC
                """);
        System.out.println("   Found " + dueRetries.size() + " due retries.");

        int retryPaid = 0;
        int retryFailed = 0;
        for (Map<String, Object> entry : dueRetries) {
            MockPaymentGateway.ChargeResult result = MockPaymentGateway.charge();
            String resultText = result.success() ? "SUCCESS — TXN: " + result.transactionId() : "FAILED — " + result.failureReason();

            db.query("""
                    UPDATE payment_retry_queue
                    SET attempted_at = CURRENT_TIMESTAMP, result = $1::text
                    WHERE id = $2::uuid
                    """, resultText, entry.get("queue_id"));

            String policyNumber = str(entry.get("policy_number"));
            if (result.success()) {
                db.query("""
                        UPDATE premium_records
                        SET status = 'PAID', paid_at = CURRENT_TIMESTAMP
                        WHERE id = $1::uuid
                        """, entry.get("premium_record_id"));
                System.out.println("   ✅ RETRY PAID   — " + policyNumber + " (attempt #" + str(entry.get("retry_number")) + ")");
                retryPaid++;
            } else {
                double pendingRetries = parseInt(db.query("""
                        SELECT COUNT(*) FROM payment_retry_queue
                        WHERE premium_record_id = $1::uuid AND attempted_at IS NULL
                        """, entry.get("premium_record_id")).get(0).get("count"));

                if (pendingRetries == 0) {
                    db.query("UPDATE premium_records SET status = 'FAILED' WHERE id = $1::uuid", entry.get("premium_record_id"));
                    System.out.println("   🚫 EXHAUSTED    — " + policyNumber + " (all " + RETRY_SCHEDULE_DAYS.length + " retries done) — marking FAILED");
                    System.out.println("   📧 [Mock Email] Would notify " + str(entry.get("email")) + " — payment permanently failed for " + policyNumber);
                } else {
                    System.out.println("   ❌ RETRY FAILED — " + policyNumber + " (attempt #" + str(entry.get("retry_number")) + ", "
                            + numberToString(pendingRetries) + " retries remaining)");
                }
                retryFailed++;
            }
        }

        System.out.println("   Summary → RETRY PAID: " + retryPaid + " | RETRY FAILED: " + retryFailed);
        return obj("retryPaid", retryPaid, "retryFailed", retryFailed);
    }
}
