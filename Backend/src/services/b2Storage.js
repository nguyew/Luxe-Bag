const crypto = require('crypto');
const { S3Client, DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  b2ApplicationKey,
  b2ApplicationKeyId,
  b2BucketName,
  b2Endpoint,
  b2PublicUrl,
} = require('../config/env');

const configured = Boolean(
  b2ApplicationKey && b2ApplicationKeyId && b2BucketName && b2Endpoint && b2PublicUrl
);
const client = configured
  ? new S3Client({
    endpoint: b2Endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: b2ApplicationKeyId, secretAccessKey: b2ApplicationKey },
  })
  : null;

const assertConfigured = () => {
  if (!client) throw Object.assign(new Error('Backblaze B2 storage is not configured.'), { status: 503 });
};

const publicUrl = (key) => `${b2PublicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function createUpload({ contentType }) {
  assertConfigured();
  const extension = contentType.split('/')[1].replace(/[^a-z0-9]/gi, '').toLowerCase();
  const key = `products/${crypto.randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: b2BucketName,
    Key: key,
    ContentType: contentType,
  });
  return { key, url: await getSignedUrl(client, command, { expiresIn: 300 }), publicUrl: publicUrl(key) };
}

async function deleteObject(key) {
  if (!key || !client) return;
  await client.send(new DeleteObjectCommand({ Bucket: b2BucketName, Key: key }));
}

async function uploadObject({ key, body, contentType }) {
  assertConfigured();
  await client.send(new PutObjectCommand({
    Bucket: b2BucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return publicUrl(key);
}

module.exports = { createUpload, deleteObject, uploadObject };
