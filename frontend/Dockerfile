# SPDX-FileCopyrightText: 2023 Marlon W (Mawoka)
#
# SPDX-License-Identifier: MPL-2.0

### Build Step
# pull the Node.js Docker image
FROM node:24-trixie AS builder
ENV CI=true
# Default points at the internal docker-compose service name, not an external host, so a build
# run without an explicit override never silently talks to someone else's server.
ENV API_URL=http://api:80
ENV REDIS_URL=redis://localhost:6379
# Set your own hCaptcha site key here (or via build arg) if you enable captcha protection.
#ENV VITE_HCAPTCHA=
#ENV VITE_GOOGLE_AUTH_ENABLED=true
#ENV VITE_GITHUB_AUTH_ENABLED=true
ENV VITE_CAPTCHA_ENABLED=false
#ENV VITE_REGISTRATION_DISABLED=True
# change working directory
WORKDIR /usr/src/app


# copy the package.json files from local machine to the workdir in container
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# run npm install in our local machine
RUN corepack enable && corepack prepare pnpm@11.6 --activate && pnpm ci --ignore-scripts

# copy the generated modules and all other files to the container
COPY . .

# build the application
RUN pnpm run build

### Serve Step
# pull the Node.js Docker image
FROM node:24-trixie-slim
ENV CI=true

# change working directory
WORKDIR /app
COPY --from=builder /usr/src/app/package.json .
COPY --from=builder /usr/src/app/pnpm-lock.yaml .
RUN corepack enable && corepack prepare pnpm@11.6 --activate && pnpm ci --ignore-scripts
# copy files from previous step
COPY --from=builder /usr/src/app/build .
COPY --from=builder /usr/src/app/node_modules ./node_modules

# our app is running on port 3000 within the container, so need to expose it
EXPOSE 3000

# the command that starts our app
CMD ["pnpm", "run", "run:prod"]
