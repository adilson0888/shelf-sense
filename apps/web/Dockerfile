# Builds shelf-sense-web into a static bundle served by nginx.
#
# apps/web imports shelf-sense-ds's and shelf-sense-i18n's *built* output
# (both packages' package.json main/module/types/exports all point at their
# own dist/), so the build stage must build both workspace dependencies
# before building the web app itself — see Docker pipeline plan. Missing
# either one fails with "Cannot find module" from tsc, not a runtime error
# — confirmed the hard way when build:i18n was first added here (CI run
# 31731887153): the design system alone isn't enough once a second
# dist-only workspace dependency exists.

# Baked into the bundle at build time by Vite (see apps/web/src/lib/api.ts).
# Defaults to the nginx.conf /api/ proxy in this image, so a published image
# works out of the box wherever the api container is reachable as
# "shelf-api" on the same docker network — override only for an unusual
# topology.
ARG VITE_API_URL=/api

FROM node:24-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci
RUN npm run build:ds
RUN npm run build:i18n
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w shelf-sense-web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
