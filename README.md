# ☁️ CloudLearn – Cloud-Based E-Learning Platform

**Micro Project – Cloud Computing**

## Aim
To build a simple e-learning website and host it on the cloud, so students can reach it from anywhere.

## Features
- Course catalog with search and category filter
- Student login (simple, stored in the browser)
- Enroll in courses and watch video lessons
- Mark lessons as complete and track progress
- Dashboard showing enrolled courses, completed courses and average progress
- Works on mobile and desktop

## Technologies Used
| Part | Technology |
|------|-----------|
| Frontend | HTML, CSS, JavaScript |
| Storage | Browser LocalStorage |
| Videos | YouTube embeds (content delivered from the cloud) |
| Hosting | Cloud platform (AWS S3 / Firebase / Netlify / GitHub Pages) |

## Project Files
```
index.html   → page structure
style.css    → design and layout
script.js    → courses, login, enrollment and progress logic
```

## How to Run Locally
Double-click `index.html` to open it in a browser.

## How to Deploy on the Cloud

### Option 1: AWS S3 (static website hosting)
1. Log in to the AWS Console and open **S3**.
2. Create a bucket (for example `cloudlearn-project`) and untick **Block all public access**.
3. Upload `index.html`, `style.css` and `script.js`.
4. Go to **Properties → Static website hosting**, enable it, and set the index document to `index.html`.
5. Under **Permissions → Bucket policy**, add:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::cloudlearn-project/*"
     }]
   }
   ```
6. Open the website endpoint URL shown under Static website hosting.

### Option 2: Netlify (easiest)
1. Go to https://app.netlify.com/drop
2. Drag and drop the project folder. You'll get a live link right away.

### Option 3: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # public directory: .
firebase deploy
```

## Cloud Concepts Used
- **SaaS**: students use the platform through a browser with nothing to install.
- **Cloud storage**: website files are stored in S3 or on Firebase.
- **Scalability**: the cloud host handles more users automatically.
- **Pay-as-you-go**: static hosting costs little or nothing.
- **Availability**: accessible 24/7 from any device.

## Future Scope
- Real user authentication (AWS Cognito / Firebase Auth)
- Cloud database for progress (DynamoDB / Firestore)
- Upload your own videos to cloud storage
- Quizzes and certificates
# Cloud-based-e-learning-platform
