const CLOUD_NAME = 'dhlxfwmpm';
const UPLOAD_PRESET = 'school';

/**
 * Uploads a file to Cloudinary (Supports Images, PDF, Docs)
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - The download URL
 */
export async function uploadFile(file) {
  if (!file) return null;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (result.secure_url) {
      return result.secure_url;
    } else {
      throw new Error(result.error?.message || 'Upload failed');
    }
  } catch (error) {
    console.error('Cloudinary Upload failed:', error);
    throw error;
  }
}
