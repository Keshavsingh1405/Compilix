FROM python:3.12-alpine

# Create non-root runner user and set up workspace
RUN addgroup -g 1000 runner && \
    adduser -u 1000 -G runner -s /bin/sh -D runner && \
    mkdir -p /workspace && \
    chown -R runner:runner /workspace

# Copy runner script
COPY --chown=runner:runner run.sh /usr/local/bin/run.sh
RUN chmod +x /usr/local/bin/run.sh

USER runner
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/run.sh"]
