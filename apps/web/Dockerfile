# Builds shelf-sense-web into a static bundle served by nginx.
#
# apps/web imports shelf-sense-ds's *built* output (packages/design-system's
# package.json main/module/types all point at its dist/), so the build stage
# must build the design system before building the web app — see Docker
# pipeline plan.

# Baked into the bundle at build time by Vite (see apps/web/src/lib/api.ts).
# Defaults to the nginx.conf /api/ proxy in this image, so a published image
# works out of the box wherever the api container is reachable as
# "shelf-api" on the same docker network — override only for an unusual
# topology.
ARG VITE_API_URL=/api

FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci
RUN npm run build:ds
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w shelf-sense-web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
