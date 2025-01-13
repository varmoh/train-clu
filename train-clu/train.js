const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const k8s = require('@kubernetes/client-node');
const secretsConfig = require('./config.json');  // Load the static config file

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });

const jobQueue = [];
const maxConcurrentJobs = 2;
let activeJobs = 0;

// Load Kubernetes configuration
const kc = new k8s.KubeConfig();
kc.loadFromDefault(); // This loads the kubeconfig from the default location

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const batchApi = kc.makeApiClient(k8s.BatchV1Api);

app.use(bodyParser.json());

// Main endpoint to handle training requests
app.post('/train', upload.single('file'), async (req, res) => {
  const { namespace, payload } = req.body;
  const file = req.file;

  if (!namespace) {
    return res.status(400).send({ error: 'Namespace is required' });
  }

  try {
    // Check if the namespace exists in the config.json
    if (!secretsConfig[namespace]) {
      return res.status(400).send({ error: `No S3 credentials found for namespace ${namespace}` });
    }

    // Retrieve the S3 credentials for the given namespace
    const s3Config = secretsConfig[namespace];

    // Decode base64-encoded values
    const decodedS3Bucket = Buffer.from(s3Config.s3_bucket, 'base64').toString('utf-8');
    const decodedAccessKey = Buffer.from(s3Config.access_key, 'base64').toString('utf-8');
    const decodedSecretKey = Buffer.from(s3Config.secret_key, 'base64').toString('utf-8');

    console.log(`Fetched S3 config for namespace: ${namespace}`);
    console.log(`S3 Bucket: ${decodedS3Bucket}`);
    console.log(`Access Key: ${decodedAccessKey}`);
    console.log('Secret Key: <hidden>');  // Avoid printing secret key to logs

    if (file) {
      console.log(`File received: ${file.originalname}`);
      console.log(`File saved at: ${file.path}`);
    }

    // Create Kubernetes Job spec
    const jobName = `rasa-train-${Date.now()}`;
    const jobSpec = createJobSpec(jobName, namespace, decodedS3Bucket, decodedAccessKey, decodedSecretKey, payload);

    // Add job to the queue and process it
    jobQueue.push({ namespace, jobSpec, filePath: file?.path });
    console.log(`Job added to queue. Queue length: ${jobQueue.length}`);
    processQueue();

    res.status(202).send({ message: 'Job queued or started', jobName });

  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).send({ error: 'Failed to process request' });
  }
});

// Function to process the job queue
function processQueue() {
  if (activeJobs < maxConcurrentJobs && jobQueue.length > 0) {
    const { namespace, jobSpec, filePath } = jobQueue.shift();
    activeJobs++;
    console.log(`Starting job for namespace ${namespace}. Active jobs: ${activeJobs}`);

    batchApi.createNamespacedJob(namespace, jobSpec)
      .then(() => {
        console.log(`Job completed for namespace ${namespace}`);

        // File cleanup after job completion
        if (filePath) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error(`Failed to delete file ${filePath}:`, err);
            } else {
              console.log(`File ${filePath} deleted successfully.`);
            }
          });
        }

        activeJobs--;
        processQueue();  // Process next job in the queue
      })
      .catch(error => {
        console.error(`Failed to complete job for namespace ${namespace}:`, error);
        activeJobs--;
        processQueue();  // Ensure queue continues processing
      });
  }
}

// Function to create a Kubernetes Job spec
function createJobSpec(jobName, namespace, s3Bucket, accessKey, secretKey, payload) {
  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: jobName,
      namespace: namespace,
    },
    spec: {
      template: {
        spec: {
          containers: [
            {
              name: 'rasa-train',
              image: 'rasa-train-image:latest',
              env: [
                { name: 'S3_BUCKET', value: s3Bucket },
                { name: 'ACCESS_KEY', value: accessKey },
                { name: 'SECRET_KEY', value: secretKey },
                { name: 'PAYLOAD', value: JSON.stringify(payload) },
              ],
            },
          ],
          restartPolicy: 'Never',
        },
      },
    },
  };
}

app.listen(port, () => {
  console.log(`Training cluster app listening on port ${port}`);
});
