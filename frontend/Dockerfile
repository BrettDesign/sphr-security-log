# ---- Build the static web PWA with Expo ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Empty value => the PWA calls /api on the same origin (Nginx proxies to backend).
ARG EXPO_PUBLIC_BACKEND_URL=""
ENV EXPO_PUBLIC_BACKEND_URL=$EXPO_PUBLIC_BACKEND_URL

RUN npx expo export --platform web --output-dir dist

# ---- Serve with Nginx (also reverse-proxies /api to the backend) ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
