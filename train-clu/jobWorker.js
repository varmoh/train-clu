const { Client } = require('pg'); // PostgreSQL client
const AWS = require('aws-sdk');
const cron = require('node-cron');
const { exec } = require('child_process');

// Initialize AWS S3 client
const s3 = new AWS.S3();
const client = new Client({
  host: process.env.PG_HOST,
  port: 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB,
});
client.connect();

// Function to fetch namespace-specific S3 credentials from Kubernetes
async function getNamespaceS3Credentials(namespace) {
  try {
    // Fetch secret using kubectl command from the Kubernetes cluster (make sure the worker has the correct RBAC permissions)
    const kubectlCommand = `kubectl get secret s3-credentials-${namespace} -n training -o jsonpath='{.data.s3-bucket}'`;
    const bucket = await execCommand(kubectlCommand); 

    const accessKeyCommand = `kubectl get secret s3-credentials-${namespace} -n training -o jsonpath='{.data.s3-access-key}'`;
    const accessKey = await execCommand(accessKeyCommand);

    const secretKeyCommand = `kubectl get secret s3-credentials-${namespace} -n training -o jsonpath='{.data.s3-secret-key}'`;
    const secretKey = await execCommand(secretKeyCommand);

    // Decode base64 values to get the actual credentials
    const decodedBucket = Buffer.from(bucket, 'base64').toString('utf-8');
    const decodedAccessKey = Buffer.from(accessKey, 'base64').toString('utf-8');
    const decodedSecretKey = Buffer.from(secretKey, 'base64').toString('utf-8');

    return {
      s3_bucket: decodedBucket,
      access_key: decodedAccessKey,
      secret_key: decodedSecretKey,
    };
  } catch (error) {
    console.error('Error fetching S3 credentials:', error);
    throw error;
  }
}

// Utility function to execute shell commands (e.g., kubectl)
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`exec error: ${error}`);
        return;
      }
      if (stderr) {
        reject(`stderr: ${stderr}`);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

// Function to upload the model to S3
async function uploadModelToS3(namespace, modelData) {
  const modelPath = `${namespace}/models/${modelData.modelName}`;
  const params = {
    Bucket: process.env.MODEL_BUCKET,
    Key: modelPath,
    Body: modelData.fileData, // The trained model file
  };

  try {
    const uploadRes = await s3.upload(params).promise();
    console.log(`Model uploaded to S3 at ${uploadRes.Location}`);
  } catch (error) {
    console.error('Error uploading model to S3:', error);
  }
}

// CronJob to process jobs from the queue
cron.schedule('* * * * *', async () => {
  try {
    const jobsRes = await client.query(
      'SELECT * FROM training_jobs WHERE status = $1 LIMIT 1',
      ['waiting']
    );

    if (jobsRes.rows.length > 0) {
      const job = jobsRes.rows[0];
      const { id, namespace } = job;

      // Fetch the S3 credentials for the namespace
      const s3Config = await getNamespaceS3Credentials(namespace);

      // Fetch the necessary training data from S3
      const modelData = await fetchTrainingDataFromS3(namespace, s3Config);

      // Run the training job (assuming training is a function that returns model data)
      const trainedModelData = await runTrainingJob(modelData);

      // Upload the trained model to S3
      await uploadModelToS3(namespace, trainedModelData);

      // After uploading, update job status to 'completed'
      await client.query(
        'UPDATE training_jobs SET status = $1 WHERE id = $2',
        ['completed', id]
      );
      console.log(`Job completed and model uploaded for namespace: ${namespace}`);
    }
  } catch (error) {
    console.error('Error processing job:', error);
  }
});

// Function to fetch training data from S3
async function fetchTrainingDataFromS3(namespace, s3Config) {
  const params = {
    Bucket: s3Config.s3_bucket, // Use the correct bucket from the config
    Key: `${namespace}/training/temp`, // S3 has to have a correct path (bucket/path/trainingfile)
    AccessKeyId: s3Config.access_key,
    SecretAccessKey: s3Config.secret_key,
  };

  try {
    const data = await s3.getObject(params).promise();
    console.log('Training data fetched from S3');
    return data.Body; // Return the actual file data
  } catch (error) {
    console.error('Error fetching training data from S3:', error);
    throw error;
  }
}

// Function to run the training job (stub function for now)
async function runTrainingJob(trainingData) {
  // Simulate training and return the trained model data
  return { modelName: 'trained_model_name', fileData: 'trained_model_file_data' };
}
