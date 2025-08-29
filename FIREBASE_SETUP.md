# Firebase Setup Guide

## Getting Your Firebase Credentials

To fix the "invalid API key" error, you need to set up Firebase for your project:

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or select an existing project
3. Follow the setup wizard

### Step 2: Enable Authentication

1. In your Firebase project, go to **Authentication** in the left sidebar
2. Click **Get started**
3. Go to the **Sign-in method** tab
4. Enable **Email/Password** authentication

### Step 3: Enable Firestore Database

1. Go to **Firestore Database** in the left sidebar
2. Click **Create database**
3. Choose **Start in test mode** (you can secure it later)
4. Select a location for your database

### Step 4: Get Your Web App Configuration

1. In your Firebase project, click the **gear icon** ⚙️ next to "Project Overview"
2. Select **Project settings**
3. Scroll down to the **Your apps** section
4. If you don't have a web app, click **Add app** and select the **Web** platform `</>`
5. Register your app with a nickname (e.g., "RatChat Web")
6. Copy the `firebaseConfig` object

### Step 5: Update Your .env File

1. Open the `.env` file in your project root
2. Replace the placeholder values with your actual Firebase credentials:

```env
REACT_APP_FIREBASE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abcdef123456789012345
REACT_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Step 6: Restart Your Development Server

After updating the `.env` file, restart your React development server:

```bash
npm start
```

## Security Rules (Optional but Recommended)

For production, update your Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Add other rules as needed for your chat functionality
  }
}
```

## Troubleshooting

- **"Invalid API key"**: Make sure your `.env` file has the correct `REACT_APP_FIREBASE_API_KEY`
- **"Project not found"**: Check your `REACT_APP_FIREBASE_PROJECT_ID`
- **Authentication errors**: Ensure Email/Password is enabled in Firebase Authentication
- **Database errors**: Make sure Firestore is enabled and has appropriate security rules

## Environment Variables

Remember:
- Environment variables in React must start with `REACT_APP_`
- Restart your development server after changing `.env`
- Never commit your `.env` file to version control (it's already in `.gitignore`)