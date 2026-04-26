const IMGBB_API_KEY = '6e45d0954c9e0237267c61579f096faf';

/**
 * Uploads a file to imgBB (Free Image Hosting)
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - The download URL
 */
export async function uploadFile(file) {
  if (!file) return null;
  
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data.url;
    } else {
      throw new Error(result.error?.message || 'Upload failed');
    }
  } catch (error) {
    console.error('imgBB Upload failed:', error);
    throw error;
  }
}
