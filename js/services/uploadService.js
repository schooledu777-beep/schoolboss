const CLOUD_NAME = 'dhlxfwmpm';
const UPLOAD_PRESET = 'school';

/**
 * Uploads a file to Cloudinary (Supports Images, PDF, Docs)
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - The download URL
 */
function isImage(file) {
  return file?.type?.startsWith('image/');
}

function getResourceType(file) {
  return isImage(file) ? 'image' : 'raw';
}

function isPdf(file) {
  return file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
}

async function assertPdfDelivery(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.status === 401 || response.status === 403) {
      throw new Error('Cloudinary is blocking PDF delivery. Enable "Allow delivery of PDF and ZIP files" from Cloudinary security settings, then upload the PDF again.');
    }
  } catch (error) {
    if (error?.message?.includes('Cloudinary is blocking')) throw error;
    console.warn('Could not verify PDF delivery:', error);
  }
}

export async function uploadFile(file, folder = 'uploads') {
  if (!file) return null;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  try {
    const resourceType = getResourceType(file);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (result.secure_url) {
      if (isPdf(file)) await assertPdfDelivery(result.secure_url);
      return result.secure_url;
    } else {
      throw new Error(result.error?.message || `Upload failed (${response.status})`);
    }
  } catch (error) {
    console.error('Cloudinary Upload failed:', error);
    throw error;
  }
}
