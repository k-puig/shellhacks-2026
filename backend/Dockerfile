FROM denoland/deno:2.9.7

WORKDIR /app
COPY . .

WORKDIR /app/app/rest
RUN deno ci --prod --skip-types

CMD ["deno", "run", "start"]
