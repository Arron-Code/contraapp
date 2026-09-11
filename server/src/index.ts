import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import * as helmetModule from 'helmet';
import morgan from 'morgan';
import { ZodError } from 'zod';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import resourceRoutes from './routes/resources.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(helmetModule.default());
app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', async (_request, response) => {
  await pool.query('SELECT 1');
  response.json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', resourceRoutes);

app.use((_request, response) => {
  response.status(404).json({ message: 'Endpunkt nicht gefunden.' });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ message: 'Ungültige Eingabedaten.', issues: error.issues });
    return;
  }
  if ((error as { code?: string }).code === '23505') {
    response.status(409).json({ message: 'Die Nummer oder E-Mail ist bereits vergeben.' });
    return;
  }
  console.error(error);
  response.status(500).json({ message: 'Ein interner Fehler ist aufgetreten.' });
};
app.use(errorHandler);

app.listen(port, () => {
  console.log(`eriCargo API läuft auf http://localhost:${port}`);
});
