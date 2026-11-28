package com.insureflow.api.controller;

import com.insureflow.api.service.BillingService;
import com.insureflow.api.support.Auth;
import com.insureflow.api.support.Db;
import com.insureflow.api.support.JsDate;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static com.insureflow.api.support.Http.*;
import static com.insureflow.api.support.Js.*;

/** Billing routes (INS-7). */
@RestController
public class BillingController {

    private final Db db;
    private final BillingService billing;

    public BillingController(Db db, BillingService billing) {
        this.db = db;
        this.billing = billing;
    }

    @GetMapping("/api/admin/billing")
    public ResponseEntity<Object> list(HttpServletRequest req) {
        Auth.staff(req);
        String status = req.getParameter("status");
        String search = req.getParameter("search");
        try {
            StringBuilder query = new StringBuilder("""
                      SELECT
                        pr.id,
                        pr.billing_month AS "billingMonth",
                        pr.amount,
                        pr.status,
                        pr.retry_count AS "retryCount",
                        pr.due_date AS "dueDate",
                        pr.paid_at AS "paidAt",
                        pr.created_at AS "createdAt",
                        p.id AS "policyId",
                        p.policy_number AS "policyNumber",
                        p.cover_amount AS "coverAmount",
                        p.monthly_premium AS "monthlyPremium",
                        p.effective_date AS "effectiveDate",
                        p.address_line1 AS "addressLine1",
                        p.address_line2 AS "addressLine2",
                        p.city,
                        p.state,
                        p.zip_code AS "zipCode",
                        u.id AS "userId",
                        u.first_name AS "firstName",
                        u.last_name AS "lastName",
                        CONCAT(u.first_name, ' ', u.last_name) AS "customerName",
                        u.email AS "customerEmail",
                        u.phone AS "customerPhone",
                        pr2.name AS "productName",
                        COALESCE(
                          (SELECT json_agg(json_build_object(
                            'id', rq.id,
                            'retryNumber', rq.retry_number,
                            'scheduledAt', rq.scheduled_at,
                            'attemptedAt', rq.attempted_at,
                            'result', rq.result
                          ) ORDER BY rq.retry_number)
                          FROM payment_retry_queue rq
                          WHERE rq.premium_record_id = pr.id),
                          '[]'::json
                        ) AS "retryHistory"
                      FROM premium_records pr
                      JOIN policies p ON pr.policy_id = p.id
                      JOIN users u ON p.user_id = u.id
                      JOIN products pr2 ON p.product_id = pr2.id
                    """);
            List<Object> params = new ArrayList<>();
            List<String> conditions = new ArrayList<>();
            if (truthy(status) && !"ALL".equals(status)) {
                params.add(status);
                conditions.add("pr.status = $" + params.size() + "::text");
            }
            if (truthy(search) && !jsTrim(search).isEmpty()) {
                params.add("%" + jsTrim(search).toLowerCase(Locale.ROOT) + "%");
                String n = "$" + params.size();
                conditions.add("(LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE " + n + " OR LOWER(p.policy_number) LIKE " + n
                        + " OR LOWER(u.email) LIKE " + n + ")");
            }
            if (!conditions.isEmpty()) query.append(" WHERE ").append(String.join(" AND ", conditions));
            query.append(" ORDER BY pr.billing_month DESC, pr.created_at DESC");

            return ok(db.query(query.toString(), params.toArray()));
        } catch (RuntimeException e) {
            return dbFail("Error fetching billing records:", e);
        }
    }

    @GetMapping("/api/admin/billing/stats")
    public ResponseEntity<Object> stats(HttpServletRequest req) {
        Auth.staff(req);
        try {
            Map<String, Object> row = db.query("""
                      SELECT
                        COUNT(*) FILTER (WHERE status = 'PAID') AS paid,
                        COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
                        COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
                        COUNT(*) FILTER (WHERE status = 'RETRY_SCHEDULED') AS retry_scheduled,
                        COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0) AS total_collected,
                        COALESCE(SUM(amount) FILTER (WHERE status IN ('PENDING','RETRY_SCHEDULED','FAILED')), 0) AS total_outstanding,
                        COUNT(DISTINCT policy_id) AS total_policies
                      FROM premium_records
                    """).get(0);
            return ok(obj(
                    "paid", parseInt(row.get("paid")),
                    "pending", parseInt(row.get("pending")),
                    "failed", parseInt(row.get("failed")),
                    "retryScheduled", parseInt(row.get("retry_scheduled")),
                    "totalCollected", parseFloat(row.get("total_collected")),
                    "totalOutstanding", parseFloat(row.get("total_outstanding")),
                    "totalPolicies", parseInt(row.get("total_policies"))));
        } catch (RuntimeException e) {
            return dbFail("Error fetching billing stats:", e);
        }
    }

    @PostMapping("/api/admin/billing/trigger")
    public ResponseEntity<Object> trigger(HttpServletRequest req) {
        Auth.staff(req);
        try {
            Map<String, Object> genResult = billing.generateMonthlyPremiumRecords(LocalDate.now(JsDate.zone()));
            Map<String, Object> chargeResult = billing.processPendingCharges();
            return ok(obj("message", "Billing run triggered successfully.", "generated", genResult, "charged", chargeResult));
        } catch (RuntimeException e) {
            return fail("Error triggering billing run:", "Billing trigger error: ", e);
        }
    }

    @PostMapping("/api/admin/billing/retry")
    public ResponseEntity<Object> retry(HttpServletRequest req) {
        Auth.staff(req);
        try {
            return ok(obj("message", "Retry job triggered successfully.", "result", billing.processDueRetries()));
        } catch (RuntimeException e) {
            return fail("Error triggering retry run:", "Retry trigger error: ", e);
        }
    }

    @PostMapping("/api/admin/billing/{id}/send-reminder")
    public ResponseEntity<Object> sendReminder(HttpServletRequest req, @PathVariable String id) {
        Auth.staff(req);
        try {
            List<Map<String, Object>> result = db.query("""
                      SELECT pr.id, pr.amount, pr.billing_month, pr.status,
                             p.policy_number, u.email, u.first_name, u.last_name
                      FROM premium_records pr
                      JOIN policies p ON pr.policy_id = p.id
                      JOIN users u ON p.user_id = u.id
                      WHERE pr.id = $1::uuid
                    """, id);
            if (result.isEmpty()) return error(404, "Billing record not found.");

            Map<String, Object> record = result.get(0);
            String billingMonth = JsDate.parse(record.get("billing_month")).toMonthYear();
            String email = str(record.get("email"));

            // Mock email (in production: integrate Nodemailer / SendGrid / SES)
            System.out.println("\n📧 [Mock Email] Payment reminder sent to " + email);
            System.out.println("   Policy: " + str(record.get("policy_number")));
            System.out.println("   Amount: $" + str(record.get("amount")));
            System.out.println("   Month:  " + billingMonth);
            System.out.println("   Status: " + str(record.get("status")) + "\n");

            return ok(obj(
                    "message", "Payment reminder email sent to " + email,
                    "recipient", obj("name", str(record.get("first_name")) + " " + str(record.get("last_name")), "email", record.get("email")),
                    "policyNumber", record.get("policy_number"),
                    "amount", parseFloat(record.get("amount")),
                    "billingMonth", billingMonth,
                    "sentAt", JsDate.now().toISOString()));
        } catch (RuntimeException e) {
            return dbFail("Error sending reminder:", e);
        }
    }

    @PostMapping("/api/admin/billing/{id}/send-invoice")
    public ResponseEntity<Object> sendInvoice(HttpServletRequest req, @PathVariable String id) {
        Auth.staff(req);
        try {
            List<Map<String, Object>> result = db.query("""
                      SELECT pr.id, pr.amount, pr.billing_month, pr.status, pr.paid_at,
                             p.policy_number, p.cover_amount, pr2.name AS product_name,
                             u.email, u.first_name, u.last_name, u.phone,
                             p.address_line1, p.address_line2, p.city, p.state, p.zip_code
                      FROM premium_records pr
                      JOIN policies p ON pr.policy_id = p.id
                      JOIN users u ON p.user_id = u.id
                      JOIN products pr2 ON p.product_id = pr2.id
                      WHERE pr.id = $1::uuid
                    """, id);
            if (result.isEmpty()) return error(404, "Billing record not found.");

            Map<String, Object> record = result.get(0);
            String status = str(record.get("status"));
            if (!"PAID".equalsIgnoreCase(status)) {
                return error(400, "Invoices can only be generated and sent for PAID records. Current status: " + status);
            }

            String billingMonth = JsDate.parse(record.get("billing_month")).toMonthYear();
            String email = str(record.get("email"));
            String customerName = str(record.get("first_name")) + " " + str(record.get("last_name"));
            String policyNumber = str(record.get("policy_number"));
            String shortId = id.length() >= 8 ? id.substring(0, 8).toUpperCase() : id.toUpperCase();
            String invoiceNumber = "INV-" + policyNumber.replace("POL-", "") + "-" + shortId;
            String paidAtStr = record.get("paid_at") != null ? record.get("paid_at").toString() : JsDate.now().toISOString();

            // Mock email dispatch log (in production: integrate SendGrid / SES / SMTP mailer)
            System.out.println("\n🧾 [Mock Email] Official Paid Invoice #" + invoiceNumber + " dispatched to " + email);
            System.out.println("   Recipient:    " + customerName + " <" + email + ">");
            System.out.println("   Policy #:     " + policyNumber);
            System.out.println("   Product:      " + str(record.get("product_name")));
            System.out.println("   Billing Month:" + billingMonth);
            System.out.println("   Total Paid:   $" + str(record.get("amount")));
            System.out.println("   Payment Date: " + paidAtStr);
            System.out.println("   Status:       PAID IN FULL (Settled via Payment Gateway)\n");

            return ok(obj(
                    "message", "Payment invoice " + invoiceNumber + " sent successfully to " + email,
                    "invoiceNumber", invoiceNumber,
                    "recipient", obj("name", customerName, "email", email),
                    "policyNumber", policyNumber,
                    "productName", record.get("product_name"),
                    "amount", parseFloat(record.get("amount")),
                    "billingMonth", billingMonth,
                    "paidAt", paidAtStr,
                    "sentAt", JsDate.now().toISOString()));
        } catch (RuntimeException e) {
            return dbFail("Error sending invoice:", e);
        }
    }

    @GetMapping("/api/admin/billing/{id}/invoice")
    public ResponseEntity<Object> getInvoice(HttpServletRequest req, @PathVariable String id) {
        Auth.staff(req);
        try {
            List<Map<String, Object>> result = db.query("""
                      SELECT pr.id, pr.amount, pr.billing_month, pr.status, pr.paid_at, pr.created_at,
                             p.policy_number, p.cover_amount, p.monthly_premium, pr2.name AS product_name,
                             u.email, u.first_name, u.last_name, u.phone,
                             p.address_line1, p.address_line2, p.city, p.state, p.zip_code
                      FROM premium_records pr
                      JOIN policies p ON pr.policy_id = p.id
                      JOIN users u ON p.user_id = u.id
                      JOIN products pr2 ON p.product_id = pr2.id
                      WHERE pr.id = $1::uuid
                    """, id);
            if (result.isEmpty()) return error(404, "Billing record not found.");

            Map<String, Object> record = result.get(0);
            String status = str(record.get("status"));
            if (!"PAID".equalsIgnoreCase(status)) {
                return error(400, "Invoices are only available for PAID billing records.");
            }

            String billingMonth = JsDate.parse(record.get("billing_month")).toMonthYear();
            String policyNumber = str(record.get("policy_number"));
            String shortId = id.length() >= 8 ? id.substring(0, 8).toUpperCase() : id.toUpperCase();
            String invoiceNumber = "INV-" + policyNumber.replace("POL-", "") + "-" + shortId;

            return ok(obj(
                    "invoiceNumber", invoiceNumber,
                    "recordId", record.get("id"),
                    "policyNumber", policyNumber,
                    "productName", record.get("product_name"),
                    "amount", parseFloat(record.get("amount")),
                    "monthlyPremium", parseFloat(record.get("monthly_premium")),
                    "coverAmount", parseFloat(record.get("cover_amount")),
                    "status", "PAID",
                    "billingMonth", billingMonth,
                    "paidAt", record.get("paid_at"),
                    "customer", obj(
                            "name", str(record.get("first_name")) + " " + str(record.get("last_name")),
                            "email", record.get("email"),
                            "phone", record.get("phone"),
                            "address", str(record.get("address_line1")) + ", " + str(record.get("city")) + ", " + str(record.get("state")) + " " + str(record.get("zip_code"))
                    )
            ));
        } catch (RuntimeException e) {
            return dbFail("Error fetching invoice:", e);
        }
    }
}
