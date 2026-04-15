FROM node:22-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY server/ ./server/
COPY data/seed/ ./data/seed/
COPY data/taxonomy.json ./data/taxonomy.json
# Also copy to seed-data/ so it survives Volume mount on /app/data
COPY data/seed/ ./seed-data/seed/
COPY data/taxonomy.json ./seed-data/taxonomy.json

RUN npx tsc

FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-xetex \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-lang-chinese \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Pre-warm fontconfig and xelatex font cache so first compilation is fast
RUN fc-cache -fv && \
    mkdir -p /tmp/warmup && \
    printf '\\documentclass{article}\n\\usepackage{xeCJK}\n\\setCJKmainfont{Noto Sans CJK SC}\n\\begin{document}warmup\\end{document}' \
      > /tmp/warmup/warmup.tex && \
    cd /tmp/warmup && xelatex -interaction=nonstopmode warmup.tex || true && \
    rm -rf /tmp/warmup

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/seed-data/ ./seed-data/

ENV NODE_ENV=production
ENV PORT=8787
ENV PDFLATEX_CMD=xelatex

EXPOSE 8787

CMD ["sh", "-c", "node dist/server/src/db/init.js && node dist/server/src/db/seed.js && node dist/server/src/api.js"]
