import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDM9svc34kIrpcI4FgzIZOKu6C9ZErInow",
    authDomain: "afom-e475f.firebaseapp.com",
    projectId: "afom-e475f",
};

let app: FirebaseApp;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

export { db, auth };
