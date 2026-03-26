const fs = require('fs');
const path = require('path');

async function extractText(filePath, mimeType) {
  try {
    const ext = path.extname(filePath).toLowerCase();

    // Word documents
    if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    }

    // Excel spreadsheets
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel') {
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(filePath);
      let text = '';
      for (const sheetName of workbook.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        text += `[Sheet: ${sheetName}]\n${csv}\n\n`;
      }
      return text;
    }

    // PDF
    if (ext === '.pdf' || mimeType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || '';
    }

    // Plain text files
    const textExtensions = ['.txt', '.md', '.json', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.log', '.yaml', '.yml', '.ini', '.cfg', '.conf', '.sh', '.bat'];
    if (textExtensions.includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8');
    }

    // CSV handled above via xlsx, but also try plain read
    if (ext === '.csv' || ext === '.tsv') {
      return fs.readFileSync(filePath, 'utf-8');
    }

    return '';
  } catch (err) {
    console.error(`Text extraction failed for ${filePath}:`, err.message);
    return '';
  }
}

function categorize(mimeType, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (mimeType && mimeType.startsWith('image/')) return 'images';
  if (mimeType === 'application/pdf' || ext === '.pdf') return 'pdfs';

  const docTypes = ['.doc', '.docx', '.odt', '.rtf', '.txt', '.md'];
  const spreadTypes = ['.xls', '.xlsx', '.csv', '.tsv', '.ods'];
  const presentTypes = ['.ppt', '.pptx', '.odp'];

  if (docTypes.includes(ext)) return 'documents';
  if (spreadTypes.includes(ext)) return 'spreadsheets';
  if (presentTypes.includes(ext)) return 'presentations';

  if (mimeType) {
    if (mimeType.includes('word') || mimeType.includes('document')) return 'documents';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheets';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentations';
  }

  return 'other';
}

module.exports = { extractText, categorize };
