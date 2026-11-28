# ─────────────────────────────────────────────────────────────
# Stage 1: Build — compile and package the Spring Boot fat JAR
# ─────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Copy Maven wrapper and pom first (layer cache: deps only re-download when pom changes)
COPY mvnw pom.xml ./
COPY .mvn .mvn

# Download dependencies (cached layer)
RUN chmod +x mvnw && ./mvnw dependency:go-offline -q

# Copy source and build the fat JAR, skipping tests
COPY src ./src
RUN ./mvnw package -DskipTests -q

# ─────────────────────────────────────────────────────────────
# Stage 2: Runtime — minimal JRE image, no build tools
# ─────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S insureflow && adduser -S insureflow -G insureflow

# Copy only the fat JAR from the builder stage
COPY --from=builder /app/target/insureflow-api-1.0.0.jar app.jar

# Change ownership to non-root user
RUN chown insureflow:insureflow app.jar
USER insureflow

# Expose the Spring Boot port
EXPOSE 8080

# ─────────────────────────────────────────────────────────────
# Environment variables (override via docker run -e or compose)
# ─────────────────────────────────────────────────────────────
# DB_HOST     — hostname of the Postgres container (default: insureflow-db)
# DB_PORT     — Postgres port inside the Docker network (default: 5432)
# DB_NAME     — database name (default: insureflow)
# DB_USER     — database user (default: insureflow_user)
# DB_PASSWORD — database password
# JWT_SECRET  — secret key for JWT signing
ENV DB_HOST=insureflow-db \
    DB_PORT=5432 \
    DB_NAME=insureflow \
    DB_USER=insureflow_user \
    DB_PASSWORD=your_db_password \
    JWT_SECRET=your_jwt_secret

ENTRYPOINT ["java", "-jar", "app.jar"]
