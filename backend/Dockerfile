FROM denoland/deno:2.9.7

WORKDIR /app

COPY ./backend .
WORKDIR /app/backend/app/rest

CMD ["deno", "run", "start"]
