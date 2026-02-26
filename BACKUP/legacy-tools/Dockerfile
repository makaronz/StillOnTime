FROM alpine:3.18

# Install required packages
RUN apk add --no-cache \
    postgresql15-client \
    aws-cli \
    bash \
    curl \
    gzip \
    tar \
    gpg \
    rsync \
    coreutils \
    tzdata

# Create backup user
RUN addgroup -g 1001 backup && \
    adduser -D -u 1001 -G backup backup

# Create backup directories
RUN mkdir -p /backups/postgres \
             /backups/redis \
             /backups/uploads \
             /backups/logs \
             /scripts && \
    chown -R backup:backup /backups /scripts

# Copy backup scripts
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh && \
    chown -R backup:backup /scripts

# Set timezone
ENV TZ=UTC

# Switch to backup user
USER backup

# Set working directory
WORKDIR /backups

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /scripts/health-check.sh

# Default command
CMD ["/scripts/backup-scheduler.sh"]