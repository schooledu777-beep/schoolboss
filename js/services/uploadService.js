import { storage, ref, uploadBytes, getDownloadURL } from '../firebase-config.js';

const CLOUD_NAME = 'dhlxfwmpm';
const UPLOAD_PRESET = 'school';

/**
 * Uploads a file to Cloudinary (Supports Images, PDF, Docs)
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - The download URL
 */
function safePathPart(value = 'file') {
  return value.replace(/[\\/:*?"<>|#%{}[\]^~`]+/g, '-').trim() || 'file';
}

function isImage(file) {
  return file?.type?.startsWith('image/');
}

async function uploadToFirebaseStorage(file, folder = 'documents') {
  const timestamp = Date.now();
  const safeName = safePathPart(file.name);
  const fileRef = ref(storage, `${folder}/${timestamp}-${safeName}`);
  const snapshot = await uploadBytes(fileRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: { originalName: file.name }
  });
  return getDownloadURL(snapshot.ref);
}

export async function uploadFile(file, folder = 'uploads') {
  if (!file) return null;

  if (!isImage(file)) {
    return uploadToFirebaseStorage(file, folder);
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
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
