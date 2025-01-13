const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const { Client } = require('pg'); // PostgreSQL client

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });

// Setup database connection
const client = new Client({
  host: process.env.PG_HOST,
  port: 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB,
});
client.connect();

app.use(bodyParser.json());

// Main endpoint to handle training requests
app.post('/train', upload.single('file'), async (req, res) => {
  const { namespace } = req.body;
  const file = req.file;

  if (!namespace) {
    return res.status(400).send({ error: 'Namespace is required' });
  }

  try {
    // Insert into the database that a new training job has been requested
    await client.query(
      'INSERT INTO training_jobs (namespace, status) VALUES ($1, $2)',
      [namespace, 'waiting']
    );

    res.status(202).send({ message: 'Job queued', namespace });

  } catch (error) {
    console.error('Error saving to DB:', error);
    res.status(500).send({ error: 'Failed to process request' });
  }
});

app.listen(port, () => {
  console.log(`Training app listening on port ${port}`);
});
