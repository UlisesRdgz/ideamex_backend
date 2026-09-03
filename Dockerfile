# ---------------------------------------------------------------
# RECETA DE CONSTRUCCION DEL CONTENEDOR DE BACKEND (API Node.js)
# Actualizada para usar un Docker CLI compatible con el daemon del host.
# ---------------------------------------------------------------

FROM node:18-bookworm

RUN npm install -g npm@9 pm2@5

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    poppler-utils \
    zip \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

ENV NODE_ENV=development
RUN npm install

COPY . .

RUN npm run build
RUN npm prune --production

EXPOSE 5000
USER node
CMD ["pm2-runtime", "dist/index.js"]
