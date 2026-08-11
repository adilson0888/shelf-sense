# Builds shelf-sense-api into a standalone image.
#
# apps/api has no dependency on any other workspace (only "express" in its
# own package.json) — see Docker pipeline plan — so the runtime stage below
# is a plain, non-workspace-aware npm install, not a workspace-aware one.
# The build stage still needs the full monorepo (npm ci at root) because
# the TypeScript toolchain is resolved from root/workspace devDependencies.

FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci
RUN npm run build -w shelf-sense-api

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=build /repo/apps/api/package.json ./package.json
RUN npm install --omit=dev
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
