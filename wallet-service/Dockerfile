# --- Stage 1: Build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: Production ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/certs ./certs
COPY --from=build /app/templates ./templates
EXPOSE 3003
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=10s \
  CMD node -e "fetch('http://localhost:3003/wallet/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
