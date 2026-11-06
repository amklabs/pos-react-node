# API local development

Set `DATABASE_URL` in `api/.env` before generating the Prisma client or starting the API. The API loads that file relative to `api/index.js` and does not replace environment variables that are already set.

From the `api` directory, install dependencies and generate the client:

```sh
npm install
npm run prisma:generate
```

Then, from the project root, start the API with the requested command:

```sh
npx nodemon api/index.js
```

The API listens on `PORT` when it is set, or port `3000` otherwise. If that port is denied or already in use, local startup selects an available port and prints it. Importing the Express app (as Vercel does) does not start a local listener.