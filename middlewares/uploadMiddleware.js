const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Vercel's filesystem is read-only except /tmp. Doing mkdirSync at import
// time on /var/task/uploads crashes the entire deployment.
// Use memory storage on Vercel (serverless) and disk storage locally.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let storage;
if (isServerless) {
  storage = multer.memoryStorage();
} else {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  // Defer creation and never crash the process if mkdir fails.
  // Creation also happens lazily inside destination as a fallback.
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (_) {
    // ignore - will try again per-request or fall back to os.tmpdir()
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Lazy-ensure dir exists per-request; fallback to os.tmpdir() if not writable
      try {
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
      } catch (err) {
        const tmpDir = path.join(os.tmpdir(), 'uploads');
        try {
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
          cb(null, tmpDir);
        } catch (e) {
          cb(e);
        }
      }
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });
}

// File size limit (e.g., 50 MB)
const fileSizeLimit = 50 * 1024 * 1024; // 50 MB in bytes


const fileFilter = (req, file, cb) => {

  console.log('File MIME type:', file.mimetype);
  console.log('File extension:', path.extname(file.originalname).toLowerCase());

  // const allowedFileTypes = /jpeg|jpg|png|mp4|avi|mov|mkv|pdf|doc|docx/;
  const allowedFileTypes = /jpeg|jpg|png/;
  const allowedMimeTypes = [
    'image/jpeg', // jpeg
    'image/png', // png
    // 'video/mp4', // mp4
    // 'video/avi', // avi
    // 'video/x-msvideo', // avi
    // 'video/quicktime', // mov
    // 'video/x-matroska', // mkv
    // 'application/pdf', // pdf
    // 'application/msword', // doc
    // 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  ];
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMimeTypes.includes(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG/JPG/PNG images are allowed.'));
  }
};


const upload = multer({
  storage: storage,
  limits: { fileSize: fileSizeLimit },
  fileFilter: fileFilter,
});

module.exports = upload;
