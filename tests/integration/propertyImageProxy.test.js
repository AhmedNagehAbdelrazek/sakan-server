const request = require('supertest');
const { Readable } = require('stream');

const { createApp } = require('../../app');
const ObjectStorageService = require('../../Services/objectStorageService');
const ApiError = require('../../utils/ApiError');

const { describe, beforeAll, afterEach, test, expect, jest: jestObject } = require('@jest/globals');

describe('Property image proxy', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    jestObject.restoreAllMocks();
  });

  test('streams image from storage by key', async () => {
    const imageBytes = Buffer.from('fake-image-bytes');

    jestObject.spyOn(ObjectStorageService, 'getImageFromStorage').mockResolvedValue({
      body: Readable.from([imageBytes]),
      contentType: 'image/png',
      contentLength: imageBytes.length,
      cacheControl: 'public, max-age=3600',
      eTag: '"test-etag"',
      lastModified: new Date('2026-01-01T00:00:00.000Z'),
    });

    const response = await request(app)
      .get('/api/properties/image')
      .query({ key: 'properties/sample.png' });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['cache-control']).toBe('public, max-age=3600');
    expect(response.headers['content-length']).toBe(String(imageBytes.length));
    expect(ObjectStorageService.getImageFromStorage).toHaveBeenCalledWith('properties/sample.png');
  });

  test('returns 400 when key is missing', async () => {
    const response = await request(app).get('/api/properties/image');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', 'Image key is required.');
  });

  test('returns 404 when storage key does not exist', async () => {
    jestObject.spyOn(ObjectStorageService, 'getImageFromStorage').mockRejectedValue(
      new ApiError('Image not found.', 404),
    );

    const response = await request(app)
      .get('/api/properties/image')
      .query({ key: 'properties/missing.png' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', 'Image not found.');
  });
});
