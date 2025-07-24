// firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDClkFgwhLBGpG0DVZE8Y3l7fid6e6sumY",
  authDomain: "capypay-37ae1.firebaseapp.com",
  projectId: "capypay-37ae1",
  storageBucket: "capypay-37ae1.firebasestorage.app",
  messagingSenderId: "406738308950",
  appId: "1:406738308950:web:fc5e74b54a841e31d810f7",
  measurementId: "G-5TW7PZ8HM6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
