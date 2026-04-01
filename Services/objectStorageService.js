const fs = require('fs/promises');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const ApiError = require('../utils/ApiError');

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(`${name} is required for image upload configuration`, 500);
  }
  return value;
}

function sanitizeFileName(fileName) {
  return path.basename(fileName || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function normalizeObjectKey(key) {
  if (typeof key !== 'string' || !key.trim()) {
    throw new ApiError('Image key is required.', 400);
  }

  const normalized = key.trim().replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    throw new ApiError('Invalid image key.', 400);
  }

  return normalized;
}

function createStorageClient() {
  const region = getRequiredEnv('AWS_DEFAULT_REGION');
  const accessKeyId = getRequiredEnv('AWS_ACCESS_KEY_ID');
  const secretAccessKey = getRequiredEnv('AWS_SECRET_ACCESS_KEY');
  const endpoint = process.env.AWS_ENDPOINT_URL;

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function buildProxyImagePath(key) {
  const normalizedKey = normalizeObjectKey(key);
  return `/api/properties/image?key=${encodeURIComponent(normalizedKey)}`;
}

function buildProxyImageUrl(key, req) {
  const relativePath = buildProxyImagePath(key);

  if (!req || typeof req.get !== 'function') {
    return relativePath;
  }

  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) {
    return relativePath;
  }

  const forwardedProtocol = req.get('x-forwarded-proto');
  const protocol = (forwardedProtocol && forwardedProtocol.split(',')[0].trim()) || req.protocol || 'http';
  return `${protocol}://${host}${relativePath}`;
}

class ObjectStorageService {
  static async uploadImagesFromDisk(files, { folder = 'properties' } = {}) {
    if (!files || files.length === 0) {
      return [];
    }

    if (!Array.isArray(files)) {
      throw new ApiError('Uploaded files payload is invalid.', 400);
    }

    const uploadedFiles = [];
    for (const file of files) {
      const uploaded = await this.uploadImageFromDisk(file, { folder });
      uploadedFiles.push(uploaded);
    }

    return uploadedFiles;
  }

  static async uploadImageFromDisk(file, { folder = 'properties' } = {}) {
    if (!file) {
      throw new ApiError('Image file is required. Use form-data field name "image".', 400);
    }

    if (!file.path) {
      throw new ApiError('Uploaded image path is missing.', 400);
    }

    const bucketName = getRequiredEnv('AWS_S3_BUCKET_NAME');
    const key = `${folder}/${Date.now()}-${sanitizeFileName(file.originalname)}`;

    let body;
    try {
      body = await fs.readFile(file.path);
    } catch (error) {
      throw new ApiError('Failed to read uploaded image from disk.', 500);
    }

    try {
      const client = createStorageClient();
      const uploadResult = await client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: file.mimetype || 'application/octet-stream',
      }));

      return {
        bucketName,
        key,
        url: buildProxyImagePath(key),
        contentType: file.mimetype || null,
        size: file.size || body.length,
        eTag: uploadResult.ETag || null,
      };
    } catch (error) {
      throw new ApiError(`Failed to upload image to bucket: ${error.message}`, 500);
    } finally {
      await fs.unlink(file.path).catch(() => {});
    }
  }

  static buildProxyImageUrl(key, req) {
    return buildProxyImageUrl(key, req);
  }

  static async getImageFromStorage(key) {
    const normalizedKey = normalizeObjectKey(key);
    const bucketName = getRequiredEnv('AWS_S3_BUCKET_NAME');

    try {
      const client = createStorageClient();
      const result = await client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: normalizedKey,
      }));

      if (!result?.Body) {
        throw new ApiError('Image stream is empty.', 502);
      }

      return {
        key: normalizedKey,
        body: result.Body,
        contentType: result.ContentType || 'application/octet-stream',
        contentLength: result.ContentLength || null,
        cacheControl: result.CacheControl || 'public, max-age=3600',
        eTag: result.ETag || null,
        lastModified: result.LastModified || null,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
        throw new ApiError('Image not found.', 404);
      }

      throw new ApiError(`Failed to fetch image from storage: ${error.message}`, 500);
    }
  }
}

module.exports = ObjectStorageService;