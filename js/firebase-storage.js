import {
  getStorage, ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js';
import { app } from './firebase-config.js?v=20260628-perf2';

const storage = getStorage(app);

export { storage, ref, uploadBytes, getDownloadURL };
