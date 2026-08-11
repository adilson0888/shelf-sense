# Builds shelf-sense-web into a static bundle served by nginx.
#
# apps/web imports shelf-sense-ds's *built* output (packages/design-system's
# package.json main/module/types all point at its dist/), so the build stage
# must build the design system before building the web app — see Docker
# pipeline plan.

FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci
RUN npm run build:ds
RUN npm run build -w shelf-sense-web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
