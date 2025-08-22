import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDM9svc34KIrpcI4FgzIZOKu6C9ZCrInow",
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

export { db };
