import { storage, ref, uploadBytes, getDownloadURL } from '../firebase-config.js';

/**
 * Uploads a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} folder - The folder name (e.g., 'teachers', 'students', 'docs')
 * @param {string} fileName - Optional filename (defaults to file.name)
 * @returns {Promise<string>} - The download URL
 */
export async function uploadFile(file, folder, fileName = null) {
  if (!file) return null;
  
  const name = fileName || `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `${folder}/${name}`);
  
  try {
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return url;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}
