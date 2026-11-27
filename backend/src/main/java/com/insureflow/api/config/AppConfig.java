package com.insureflow.api.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.insureflow.api.support.ApiError;
import com.insureflow.api.support.Env;
import com.insureflow.api.support.Js;
import com.zaxxer.hikari.HikariDataSource;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.server.ConfigurableServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import javax.sql.DataSource;
import java.io.IOException;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

@Configuration
public class AppConfig {

    public static final String DEFAULT_JWT_SECRET = "insureflow-super-secret-key-change-in-production-2026";

    /** `process.env.JWT_SECRET || '...'` */
    public static String jwtSecret() { return Env.get("JWT_SECRET", DEFAULT_JWT_SECRET); }

    /** Same pool settings as `new Pool({...})` in server.js, including the 5s connection timeout. */
    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:postgresql://" + Env.get("DB_HOST", "localhost") + ":" + Env.get("DB_PORT", "5433") + "/"
                + Env.get("DB_NAME", "insureflow") + "?stringtype=unspecified");
        ds.setUsername(Env.get("DB_USER", "insureflow_user"));
        ds.setPassword(Env.get("DB_PASSWORD", "your_db_password"));
        ds.setConnectionTimeout(5000);
        ds.setMaximumPoolSize(10);
        // node-pg leaves the session TimeZone at the server default; pgjdbc sends the JVM zone instead.
        // Restore what node-pg gets (ALTER DATABASE/ROLE setting, else the server's configured zone):
        // it decides CURRENT_DATE and how json_agg prints timestamps.
        ds.setConnectionInitSql("""
                SELECT set_config('TimeZone', COALESCE(
                  (SELECT split_part(s, '=', 2) FROM pg_db_role_setting r, unnest(r.setconfig) s
                    WHERE lower(split_part(s, '=', 1)) = 'timezone'
                      AND r.setdatabase IN (0, (SELECT oid FROM pg_database WHERE datname = current_database()))
                      AND r.setrole IN (0, (SELECT oid FROM pg_roles WHERE rolname = current_user))
                    ORDER BY (r.setrole <> 0) DESC, (r.setdatabase <> 0) DESC LIMIT 1),
                  current_setting('log_timezone')), false)""");
        ds.setInitializationFailTimeout(-1); // start even when Postgres is down, like Node
        return ds;
    }

    /** `process.env.PORT || 8080` */
    @Bean
    public WebServerFactoryCustomizer<ConfigurableServletWebServerFactory> port() {
        return f -> f.setPort(Integer.parseInt(Env.get("PORT", "8080")));
    }

    @Bean
    @Primary
    public ObjectMapper objectMapper() { return Js.MAPPER; }

    /** cors({ origin: true, credentials: true }) */
    @Bean
    public WebMvcConfigurer cors() {
        return new WebMvcConfigurer() {
            @Override public void addCorsMappings(CorsRegistry r) {
                r.addMapping("/**").allowedOriginPatterns("*").allowCredentials(true)
                        .allowedMethods("GET", "HEAD", "PUT", "PATCH", "POST", "DELETE").allowedHeaders("*");
            }
        };
    }

    /** `[time] METHOD url` request log. */
    @Bean
    public OncePerRequestFilter requestLog() {
        DateTimeFormatter time = DateTimeFormatter.ofPattern("h:mm:ss a", Locale.US);
        return new OncePerRequestFilter() {
            @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                    throws ServletException, IOException {
                String q = req.getQueryString();
                System.out.println("[" + LocalTime.now().format(time) + "] " + req.getMethod() + " " + req.getRequestURI() + (q == null ? "" : "?" + q));
                chain.doFilter(req, res);
            }
        };
    }

    /** Turns ApiError into its response, and strips JS `undefined` from every JSON body. */
    @RestControllerAdvice
    public static class Responses implements ResponseBodyAdvice<Object> {

        @ExceptionHandler(ApiError.class)
        public ResponseEntity<Object> apiError(ApiError e) {
            return ResponseEntity.status(e.status).contentType(MediaType.APPLICATION_JSON).body(e.body);
        }

        /** Express would leave the request hanging on an uncaught error; answering 500 is the closest safe behaviour. */
        @ExceptionHandler(RuntimeException.class)
        public ResponseEntity<Object> unexpected(RuntimeException e) {
            System.err.println("Unhandled error: " + e);
            return ResponseEntity.status(500).contentType(MediaType.APPLICATION_JSON).body(Map.of("error", String.valueOf(e.getMessage())));
        }

        @Override
        public boolean supports(MethodParameter p, Class<? extends HttpMessageConverter<?>> c) { return true; }

        @Override
        public Object beforeBodyWrite(Object body, MethodParameter p, MediaType t, Class<? extends HttpMessageConverter<?>> c,
                                      ServerHttpRequest req, ServerHttpResponse res) {
            return Js.clean(body);
        }
    }
}
