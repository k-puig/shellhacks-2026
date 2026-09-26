FROM denoland/deno:2.9.7

WORKDIR /app
COPY . .

RUN --mount=type=cache,id=deno,target=/deno-dir,sharing=locked \
    deno ci --prod --skip-types

WORKDIR /app/app/protoweb
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
RUN deno run build

WORKDIR /app
CMD ["deno", "run", "rest"]
