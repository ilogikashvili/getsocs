FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=client-build /app/client/build /app/client/build
RUN mkdir -p uploads private_uploads && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "server.js"]
