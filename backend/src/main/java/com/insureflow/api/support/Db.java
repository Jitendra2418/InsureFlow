package com.insureflow.api.support;

import org.postgresql.util.PSQLException;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * `pool.query(sql, params)` with node-pg semantics: `$n` placeholders, every parameter sent
 * as untyped text (the JDBC URL sets stringtype=unspecified) and result columns converted the
 * way node-pg's default type parsers do (NUMERIC and BIGINT as strings, DATE as local midnight).
 */
@Component
public class Db {

    /** A database error; the message is Postgres's own text, as in node-pg's `err.message`. */
    public static class DbError extends RuntimeException {
        public DbError(String message) { super(message); }
    }

    private static final Pattern PLACEHOLDER = Pattern.compile("\\$(\\d+)");

    private final DataSource dataSource;

    public Db(DataSource dataSource) { this.dataSource = dataSource; }

    public List<Map<String, Object>> query(String sql, Object... params) {
        try (Connection c = connect()) {
            return run(c, sql, params);
        } catch (SQLException e) {
            throw error(e);
        }
    }

    /** `const client = await pool.connect(); await client.query('BEGIN')` */
    public Tx begin() {
        try {
            Connection c = connect();
            c.setAutoCommit(false);
            return new Tx(c);
        } catch (SQLException e) {
            throw error(e);
        }
    }

    public final class Tx implements AutoCloseable {
        private final Connection c;
        private boolean done;

        private Tx(Connection c) { this.c = c; }

        public List<Map<String, Object>> query(String sql, Object... params) {
            try {
                return run(c, sql, params);
            } catch (SQLException e) {
                throw error(e);
            }
        }

        /** Runs a statement whose failure is logged and ignored (the server's inner try/catch). */
        public void queryQuietly(String warning, String sql, Object... params) {
            try {
                query(sql, params);
            } catch (DbError e) {
                System.err.println(warning + " " + e.getMessage());
            }
        }

        public void commit() {
            try {
                c.commit();
                done = true;
            } catch (SQLException e) {
                throw error(e);
            }
        }

        /** ROLLBACK unless committed, then release the connection. */
        @Override public void close() {
            try {
                if (!done) c.rollback();
            } catch (SQLException ignored) {
                // connection is being discarded anyway
            } finally {
                try { c.close(); } catch (SQLException ignored) { /* nothing to do */ }
            }
        }
    }

    private Connection connect() throws SQLException {
        return dataSource.getConnection();
    }

    private static List<Map<String, Object>> run(Connection c, String sql, Object[] params) throws SQLException {
        List<String> ordered = new ArrayList<>();
        Matcher m = PLACEHOLDER.matcher(sql);
        StringBuilder jdbcSql = new StringBuilder();
        while (m.find()) {
            int idx = Integer.parseInt(m.group(1)) - 1;
            ordered.add(idx < params.length ? Js.paramString(params[idx]) : null);
            m.appendReplacement(jdbcSql, "?");
        }
        m.appendTail(jdbcSql);
        try (PreparedStatement ps = c.prepareStatement(jdbcSql.toString())) {
            for (int i = 0; i < ordered.size(); i++) ps.setString(i + 1, ordered.get(i));
            boolean hasRows = ps.execute();
            List<Map<String, Object>> rows = new ArrayList<>();
            if (!hasRows) return rows;
            try (ResultSet rs = ps.getResultSet()) {
                ResultSetMetaData md = rs.getMetaData();
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= md.getColumnCount(); i++) row.put(md.getColumnLabel(i), value(rs, i, md.getColumnTypeName(i)));
                    rows.add(row);
                }
            }
            return rows;
        }
    }

    private static Object value(ResultSet rs, int i, String type) throws SQLException {
        if (rs.getObject(i) == null) return null;
        switch (type) {
            case "bool": return rs.getBoolean(i);
            case "int2": case "int4": case "oid": return rs.getInt(i);
            case "float4": case "float8": return rs.getDouble(i);
            case "date": {
                String s = rs.getString(i);
                return s.matches("\\d{4}-\\d{2}-\\d{2}") ? JsDate.ofLocalDate(LocalDate.parse(s)) : JsDate.parse(Double.NaN);
            }
            case "timestamptz": return JsDate.ofOffsetDateTime(rs.getObject(i, OffsetDateTime.class));
            case "timestamp": return JsDate.ofLocalDateTime(rs.getObject(i, LocalDateTime.class));
            case "json": case "jsonb":
                try {
                    return Js.MAPPER.readValue(rs.getString(i), Object.class);
                } catch (Exception e) {
                    throw new SQLException(e.getMessage());
                }
            default: return rs.getString(i); // uuid, text, varchar, numeric, int8, ...
        }
    }

    private static DbError error(SQLException e) {
        if (e instanceof PSQLException p && p.getServerErrorMessage() != null) {
            return new DbError(p.getServerErrorMessage().getMessage());
        }
        return new DbError(e.getMessage());
    }
}
