package com.insureflow.api.config;

import com.insureflow.api.service.BillingService;
import com.insureflow.api.support.Db;
import com.insureflow.api.support.Env;
import com.insureflow.api.support.JsDate;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/** Startup work server.js and billing-worker.js did besides serving routes. */
public final class Startup {

    private Startup() {}

    private static final String RETRY_TABLE = """
            CREATE TABLE IF NOT EXISTS payment_retry_queue (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              premium_record_id UUID NOT NULL REFERENCES premium_records(id) ON DELETE CASCADE,
              retry_number INT NOT NULL,
              scheduled_at TIMESTAMPTZ NOT NULL,
              attempted_at TIMESTAMPTZ,
              result TEXT,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
            """;

    /** The API server (default profile). */
    @Component
    @Profile("!worker")
    public static class Api {
        private final Db db;

        public Api(Db db) { this.db = db; }

        @EventListener(ApplicationReadyEvent.class)
        public void ready() {
            String port = Env.get("PORT", "8080");
            System.out.println("=======================================================");
            System.out.println("🚀 InsureFlow Backend API running on http://localhost:" + port);
            System.out.println("📡 Connecting to PostgreSQL at " + Env.get("DB_HOST", "localhost") + ":" + Env.get("DB_PORT", "5432") + "/"
                    + Env.get("DB_NAME", "insureflow"));
            System.out.println("=======================================================");

            // testDbConnection()
            try {
                Map<String, Object> r = db.query("SELECT NOW()").get(0);
                System.out.println("✅ Connected successfully to PostgreSQL database: " + Env.get("DB_NAME", "insureflow"));
                System.out.println("   Database Server Time: " + r.get("now"));
            } catch (Db.DbError e) {
                System.err.println("❌ PostgreSQL Connection Failed: " + e.getMessage());
                System.err.println("   Please ensure PostgreSQL is running on port 5432 with database \"insureflow\".");
            }

            // Ensure payment_retry_queue table exists (idempotent)
            try {
                db.query(RETRY_TABLE);
                try { db.query("ALTER TABLE premium_records ADD COLUMN IF NOT EXISTS payment_attempt_count INT DEFAULT 0"); } catch (Db.DbError ignored) { /* as server.js */ }
                try { db.query("ALTER TABLE premium_records ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ"); } catch (Db.DbError ignored) { /* as server.js */ }
            } catch (Db.DbError e) {
                System.err.println("Billing table init error: " + e.getMessage());
            }
        }
    }

    /**
     * Standalone billing cron process (former billing-worker.js), started with the `worker` profile.
     * Monthly billing: 1st of every month at 00:05 ET. Retry check: daily at 06:00 ET.
     * RUN_BILLING_NOW=true runs both jobs once at startup.
     */
    @Configuration
    @EnableScheduling
    @Profile("worker")
    public static class Worker {
        private final Db db;
        private final BillingService billing;

        public Worker(Db db, BillingService billing) {
            this.db = db;
            this.billing = billing;
        }

        @EventListener(ApplicationReadyEvent.class)
        public void ready() {
            try {
                db.query(RETRY_TABLE);
                try {
                    db.query("""
                            ALTER TABLE premium_records
                            ADD COLUMN IF NOT EXISTS payment_attempt_count INT DEFAULT 0,
                            ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ
                            """);
                } catch (Db.DbError ignored) { /* ignore if already exists */ }
                System.out.println("✅ [Billing Worker] DB tables verified.");
            } catch (Db.DbError e) {
                System.err.println("Fatal error starting billing worker: " + e.getMessage());
                System.exit(1);
            }

            if ("true".equals(Env.raw("RUN_BILLING_NOW"))) {
                System.out.println("⚡ RUN_BILLING_NOW=true — running billing job immediately for testing...");
                runMonthlyBilling();
                runRetryJob();
                System.out.println("\n🎉 Immediate billing run complete. Keeping worker alive for cron...");
            }

            System.out.println("\n🚀 [Billing Worker] Running. Schedules:");
            System.out.println("   📅 Monthly billing : 1st of every month at 00:05 AM ET");
            System.out.println("   🔄 Retry check     : Every day at 06:00 AM ET");
            System.out.println("   💡 To test now     : RUN_BILLING_NOW=true ./mvnw spring-boot:run -Dspring-boot.run.profiles=worker\n");
        }

        @Scheduled(cron = "0 5 0 1 * *", zone = "America/New_York")
        public void runMonthlyBilling() {
            System.out.println("\n════════════════════════════════════════════");
            System.out.println("🏦 [Billing Worker] Monthly billing run started — " + JsDate.ofInstant(Instant.now()).toISOString());
            System.out.println("════════════════════════════════════════════");
            try {
                billing.generateMonthlyPremiumRecords(LocalDate.now(JsDate.zone()));
                billing.processPendingCharges();
                System.out.println("\n✅ [Billing Worker] Monthly billing run complete.");
            } catch (RuntimeException e) {
                System.err.println("❌ [Billing Worker] Monthly billing error: " + e.getMessage());
            }
        }

        @Scheduled(cron = "0 0 6 * * *", zone = "America/New_York")
        public void runRetryJob() {
            System.out.println("\n════════════════════════════════════════════");
            System.out.println("🔄 [Billing Worker] Retry job started — " + JsDate.ofInstant(Instant.now()).toISOString());
            System.out.println("════════════════════════════════════════════");
            try {
                billing.processDueRetries();
                System.out.println("\n✅ [Billing Worker] Retry job complete.");
            } catch (RuntimeException e) {
                System.err.println("❌ [Billing Worker] Retry job error: " + e.getMessage());
            }
        }
    }
}
