# Builds shelf-sense-api into a standalone image.
#
# apps/api has no dependency on any other workspace (its own package.json
# deps — express, pg, drizzle-orm, zod, dotenv — are all plain npm packages)
# — see Docker pipeline plan — so the runtime stage below is a plain,
# non-workspace-aware npm install, not a workspace-aware one. The build
# stage still needs the full monorepo (npm ci at root) because the
# TypeScript toolchain is resolved from root/workspace devDependencies.

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
# Checked-in migration files (specs/Persistence.md) — applied automatically
# on boot by src/db/migrate.ts, which resolves this folder relative to
# itself, so it has to ship in the image alongside dist/.
COPY --from=build /repo/apps/api/drizzle ./drizzle
EXPOSE 3001
CMD ["node", "dist/index.js"]
