FROM node:22-alpine

# Set up workspace with permissions for node user (uid 1000)
RUN mkdir -p /workspace && chown -R node:node /workspace

# Copy runner script
COPY --chown=node:node run.sh /usr/local/bin/run.sh
RUN chmod +x /usr/local/bin/run.sh

USER node
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/run.sh"]
