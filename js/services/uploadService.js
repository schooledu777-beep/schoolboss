const CLOUD_NAME = 'dhlxfwmpm';
const UPLOAD_PRESET = 'school';

/**
 * Uploads a file to Cloudinary (Supports Images, PDF, Docs)
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - The download URL
 */
function getResourceType(file) {
  if (file?.type?.startsWith('image/')) return 'image';
  return 'raw';
}

export async function uploadFile(file) {
  if (!file) return null;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  try {
    const resourceType = getResourceType(file);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (result.secure_url) {
      return result.secure_url;
    } else {
      throw new Error(result.error?.message || `Upload failed (${response.status})`);
    }
  } catch (error) {
    console.error('Cloudinary Upload failed:', error);
    throw error;
  }
}
