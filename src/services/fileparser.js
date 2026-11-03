// Turns an uploaded resume/certificate (pdf, docx, txt, md) into plain text.
const path = require('path');

async function fileToText(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = file.mimetype || '';
  if (ext === '.pdf' || mime === 'application/pdf') {
    const pdf = require('pdf-parse');
    const out = await pdf(file.buffer);
    return out.text || '';
  }
  if (ext === '.docx' || mime.includes('wordprocessingml')) {
    const mammoth = require('mammoth');
    const out = await mammoth.extractRawText({ buffer: file.buffer });
    return out.value || '';
  }
  if (['.txt', '.md', '.text', '.rtf', ''].includes(ext) || mime.startsWith('text/')) {
    return file.buffer.toString('utf8');
  }
  const err = new Error(`Unsupported file type "${ext || mime}". Upload a PDF, DOCX or TXT file.`);
  err.status = 415;
  throw err;
}

module.exports = { fileToText };
