FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
COPY services/api ./services/api
COPY tsconfig*.json ./
RUN npm ci
RUN npm run build:core && npm run build --workspace @dazat/api

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/api ./services/api
EXPOSE 3001
CMD ["npm","run","start","--workspace","@dazat/api"]
