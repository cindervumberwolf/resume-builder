FROM node:22-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY server/ ./server/
COPY data/seed/ ./data/seed/
COPY data/taxonomy.json ./data/taxonomy.json

RUN npx tsc

FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-xetex \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/data/ ./data/

ENV NODE_ENV=production
ENV PORT=8787
ENV PDFLATEX_CMD=xelatex

EXPOSE 8787

CMD ["sh", "-c", "node dist/server/src/db/init.js && node dist/server/src/db/seed.js && node dist/server/src/api.js"]
