FROM node:22-alpine

WORKDIR /app

# Install docker CLI in backend image so it can invoke runner containers
RUN apk add --no-cache docker-cli

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy application source
COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "src/server.js"]
