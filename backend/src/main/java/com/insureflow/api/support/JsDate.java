package com.insureflow.api.support;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A JavaScript Date: epoch milliseconds, local fields in the JVM's default time zone.
 * node-pg turns a Postgres DATE into local midnight, and toISOString() prints it in UTC,
 * which is why dates come back a day early east of UTC. That behaviour is kept on purpose.
 */
public final class JsDate {

    private static final DateTimeFormatter ISO =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);
    private static final Pattern DATE_ONLY = Pattern.compile("^(\\d{4})(?:-(\\d{2})(?:-(\\d{2}))?)?$");
    private static final Pattern DATE_TIME = Pattern.compile(
            "^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d{1,9}))?)?(Z|[+-]\\d{2}:\\d{2})?$");

    private final double ms; // NaN = Invalid Date

    private JsDate(double ms) { this.ms = ms; }

    public static ZoneId zone() { return ZoneId.systemDefault(); }

    public static JsDate now() { return new JsDate(System.currentTimeMillis()); }

    public static JsDate ofInstant(Instant i) { return new JsDate(i.toEpochMilli()); }

    /** node-pg parsing of a DATE column: local midnight. */
    public static JsDate ofLocalDate(LocalDate d) { return ofInstant(d.atStartOfDay(zone()).toInstant()); }

    /** node-pg parsing of a TIMESTAMP (without time zone) column: local time. */
    public static JsDate ofLocalDateTime(LocalDateTime t) { return ofInstant(t.atZone(zone()).toInstant()); }

    public static JsDate ofOffsetDateTime(OffsetDateTime t) { return ofInstant(t.toInstant()); }

    /** `new Date(v)` for the inputs the server receives (numbers and ISO strings). */
    public static JsDate parse(Object v) {
        if (v instanceof JsDate d) return d;
        if (v instanceof Number n) return new JsDate(n.doubleValue());
        if (!(v instanceof String s)) return new JsDate(Double.NaN);
        Matcher m = DATE_ONLY.matcher(s);
        if (m.matches()) { // date-only forms are UTC
            int y = Integer.parseInt(m.group(1));
            int mo = m.group(2) == null ? 1 : Integer.parseInt(m.group(2));
            int d = m.group(3) == null ? 1 : Integer.parseInt(m.group(3));
            if (mo < 1 || mo > 12 || d < 1 || d > 31) return new JsDate(Double.NaN);
            // V8 accepts day 29-31 in short months and rolls over
            return ofInstant(LocalDate.of(y, mo, 1).plusDays(d - 1L).atStartOfDay(ZoneOffset.UTC).toInstant());
        }
        m = DATE_TIME.matcher(s);
        if (m.matches()) {
            try {
                String frac = m.group(7) == null ? "0" : (m.group(7) + "000").substring(0, 3);
                LocalDateTime t = LocalDateTime.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)),
                        Integer.parseInt(m.group(3)), Integer.parseInt(m.group(4)), Integer.parseInt(m.group(5)),
                        m.group(6) == null ? 0 : Integer.parseInt(m.group(6)), Integer.parseInt(frac) * 1_000_000);
                String off = m.group(8);
                if (off == null) return ofLocalDateTime(t); // date-time without offset is local
                return ofInstant(t.atOffset(off.equals("Z") ? ZoneOffset.UTC : ZoneOffset.of(off)).toInstant());
            } catch (RuntimeException e) {
                return new JsDate(Double.NaN);
            }
        }
        return new JsDate(Double.NaN);
    }

    public boolean isValid() { return !Double.isNaN(ms); }

    public double getTime() { return ms; }

    private ZonedDateTime local() { return Instant.ofEpochMilli((long) ms).atZone(zone()); }

    public double getFullYear() { return isValid() ? local().getYear() : Double.NaN; }

    /** 0-based month, as in JavaScript. */
    public double getMonth() { return isValid() ? local().getMonthValue() - 1 : Double.NaN; }

    public double getDate() { return isValid() ? local().getDayOfMonth() : Double.NaN; }

    public String toISOString() {
        if (!isValid()) throw new Js.JsError("Invalid time value");
        return ISO.format(Instant.ofEpochMilli((long) ms));
    }

    /** `d.toISOString().split('T')[0]` */
    public String toISODate() { return toISOString().substring(0, 10); }

    /** `d.toLocaleString('default', { month: 'long', year: 'numeric' })` */
    public String toMonthYear() {
        if (!isValid()) return "Invalid Date";
        ZonedDateTime l = local();
        return l.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH) + " " + l.getYear();
    }

    @Override public String toString() { return isValid() ? toISOString() : "Invalid Date"; }
}
