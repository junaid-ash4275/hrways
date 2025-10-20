import express from 'express';
import cors from 'cors';
import { routes } from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();
app.use(cors());
app.use(express.json());

app.use(routes);

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`HRWays server listening on http://localhost:${port}`);
});

