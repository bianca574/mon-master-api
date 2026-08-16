require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const programsRouter = require('./routes/programs');
const recommendationsRouter = require('./routes/recommendations');
const criteriaRouter = require('./routes/criteria');
const lettersRouter = require('./routes/letters');
const journalRouter = require('./routes/journal');
const authRouter = require('./routes/auth');

const requireAuth = require('./middleware/auth');

const backupRouter = require('./routes/backup');

const app = express(); // creates the app — this object is what every future endpoint gets attached to

app.use(cors());    // applies to every request, allows your frontend to call this API

app.use(express.json()); // without this, req.body would be undefined; this tells Express to parse incoming JSON automatically

app.get('/health', (req, res) => {  // defines one endpoint: when a GET request hits /health, run this function
  // req is the incoming request, res is the response
  res.json({ status: 'ok', time: new Date().toISOString() }); // sends back JSON, and sets the right headers automatically
});

app.get('/db-health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'connected', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/programs', requireAuth, programsRouter);
app.use('/recommendations', requireAuth, recommendationsRouter);
app.use('/criteria', requireAuth, criteriaRouter);
app.use('/letters', requireAuth, lettersRouter);
app.use('/journal', requireAuth, journalRouter);

app.use('/auth', authRouter);

app.use('/backup', backupRouter);

module.exports = app;