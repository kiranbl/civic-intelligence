import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { transcribe } from '../controllers/speech.controller.js';
import { MAX_AUDIO_BYTES, SPEECH_LANGUAGES, validSpeechDistrict } from '../config/speech.js';
import { ServiceError } from '../errors/serviceError.js';

export function createSpeechRouter({ limit = process.env.NODE_ENV === 'production' ? 5 : 30, windowMs = 10 * 60 * 1000 } = {}) {
  const router = Router();
  const rateOptions = { windowMs, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, message: 'Too many transcription requests. Please try again later.' } };
  // Process-wide cap also bounds spending if clients rotate IPs. Single-instance MVP.
  const globalLimit = rateLimit({ ...rateOptions, limit: 60, keyGenerator: () => 'speech-global' });
  const perClientLimit = rateLimit({ ...rateOptions, limit }); // IPv6 subnet grouping included.
  const upload = multer({ storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 2, parts: 3, fieldSize: 64 },
    fileFilter(req, file, cb) {
      cb(['audio/webm', 'audio/webm;codecs=opus'].includes(file.mimetype) ? null : new ServiceError('SPEECH_FORMAT'), true);
    },
  }).single('audio');
  router.post('/transcribe', globalLimit, perClientLimit, (req, res, next) => {
    upload(req, res, error => {
      if (error) return next(error instanceof ServiceError ? error : new ServiceError(error.code === 'LIMIT_FILE_SIZE' ? 'SPEECH_SIZE' : 'SPEECH_INPUT'));
      if (!SPEECH_LANGUAGES.includes(req.body?.languageCode) || Object.keys(req.body).some(key => !['languageCode', 'districtName'].includes(key))
        || !validSpeechDistrict(req.body.districtName)
        || !req.file?.buffer?.length) return next(new ServiceError('SPEECH_INPUT'));
      // Reject obvious non-WebM files; provider validates the actual codec/container.
      if (!req.file.buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return next(new ServiceError('SPEECH_FORMAT'));
      next();
    });
  }, transcribe);
  return router;
}
export default createSpeechRouter();
