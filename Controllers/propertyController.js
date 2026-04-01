// /Controllers/propertyController.js
const asyncHandler = require('express-async-handler');
const PropertyService = require('../Services/propertyService');
const ObjectStorageService = require('../Services/objectStorageService');
const ApiError = require('../utils/ApiError');

async function sendStorageBody(res, body) {
  if (!body) {
    throw new ApiError('Image stream is empty.', 502);
  }

  if (typeof body.pipe === 'function') {
    await new Promise((resolve, reject) => {
      body.once('error', reject);
      res.once('finish', resolve);
      body.pipe(res);
    });
    return;
  }

  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    res.send(Buffer.from(body));
    return;
  }

  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray();
    res.send(Buffer.from(bytes));
    return;
  }

  throw new ApiError('Unsupported image stream returned by storage provider.', 500);
}

exports.createProperty = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (typeof payload.amenities === 'string') {
    try {
      payload.amenities = JSON.parse(payload.amenities);
    } catch (error) {
      throw new ApiError({message:'amenities must be a valid JSON object',error:error}, 400);
    }
  }

  if (Array.isArray(req.files) && req.files.length > 0) {
    const uploadedImages = await ObjectStorageService.uploadImagesFromDisk(req.files, {
      folder: 'properties',
    });
    payload.images = uploadedImages.map((file) => ObjectStorageService.buildProxyImageUrl(file.key, req));
  }

  const prop = await PropertyService.createForLandlord(req.user.id, payload);

  res.status(201).json(prop);
});

exports.listProperties = asyncHandler(async (req, res) => {
  const { page, limit, isActive } = req.query;
  const paging = {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
  };

  const result = req.user.role === 'student'
    ? await PropertyService.listForStudent(req.user, paging)
    : await PropertyService.listForUser(req.user, {
        ...paging,
        isActive: typeof isActive === 'undefined' ? true : isActive === 'true',
      });
  res.json(result);
});

exports.getProperty = asyncHandler(async (req, res) => {
  const prop = await PropertyService.getByIdForViewer(req.user, req.params.id);
  res.json(prop);
});

exports.updateProperty = asyncHandler(async (req, res) => {
  const updated = await PropertyService.updateForOwnerOrAdmin(req.user, req.params.id, req.body);
  res.json(updated);
});

exports.deleteProperty = asyncHandler(async (req, res) => {
  const out = await PropertyService.softDelete(req.user, req.params.id);
  res.json(out);
});

exports.nearbyCount = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.long);
  const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 5;

  const result = await PropertyService.nearbyCount({ lat, lng, radiusKm });
  res.json(result);
});

exports.getPropertyImage = asyncHandler(async (req, res) => {
  const key = req.query.key;
  const image = await ObjectStorageService.getImageFromStorage(key);

  res.set('Content-Type', image.contentType || 'application/octet-stream');
  if (image.contentLength != null) {
    res.set('Content-Length', String(image.contentLength));
  }
  if (image.eTag) {
    res.set('ETag', image.eTag);
  }
  if (image.lastModified) {
    res.set('Last-Modified', new Date(image.lastModified).toUTCString());
  }
  res.set('Cache-Control', image.cacheControl || 'public, max-age=3600');
  res.set('Content-Disposition', 'inline');

  await sendStorageBody(res, image.body);
});

exports.uploadPropertyImage = asyncHandler(async (req, res) => {
  const uploadResult = await ObjectStorageService.uploadImageFromDisk(req.file, {
    folder: 'properties',
  });

  res.status(201).json({
    message: 'Image uploaded successfully',
    ...uploadResult,
    url: ObjectStorageService.buildProxyImageUrl(uploadResult.key, req),
  });
});
