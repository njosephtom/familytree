 # Family Tree
 
 A collaborative family tree builder built with React, Firebase, and a custom canvas-style tree renderer inspired by Family Echo.
 
 This project lets users create multiple family trees, invite relatives, store shared tree data in Firestore, and keep personalized layouts per user.
 
 ## Current Stack
 
 - React 19
 - Vite 8
 - React Router 7
 - Firebase 12
   - Firebase Authentication
   - Cloud Firestore
 - Tailwind CSS 4 for global styling primitives
 - Custom tree rendering with SVG + `foreignObject` cards
 - Browser localStorage for local persistence and import/export fallback
 
 ## Rendering Approach
 
 The family tree is not currently powered by React Flow.
 
 Instead, the app uses a custom canvas-style renderer in [src/components/FamilyTreeApp.jsx](src/components/FamilyTreeApp.jsx):
 
 - A custom `computeLayout()` function calculates generation-based positions
 - Relationship connectors are drawn with SVG in `TreeLines`
 - Person cards are rendered as HTML inside SVG via `foreignObject`
 - Users can pan, zoom, drag cards, auto-align, search, and edit directly in the same surface
 
 This gives the app a lightweight, Family Echo-style editing experience while keeping the layout logic fully customizable.
 
 ## Current Features
 
 - Email/password authentication
 - Google sign-in
 - Forgot-password / reset-password flow
 - Multiple family trees per user
 - Invite links for other members
 - Real-time online presence per tree
 - Personalized layout persistence per user
 - Shared family member data stored in Firestore
 - Search members inside the active tree
 - JSON export/import
 - XML export/import
 - Custom drag mode for manual repositioning
 - Per-user saved pan/zoom/card layout
 - Tree toolbar merged into a single top navigation bar
 
 ## Data Model
 
 ### Firestore collections
 
 - `users/{uid}`
   - profile fields
   - `familyTreeIds`
   - `treeLayouts.{treeId}` for each user's saved positions and viewport
 
 - `familyTrees/{treeId}`
   - tree metadata
   - `persons`
   - `members`
 
 - `familyTrees/{treeId}/presence/{uid}`
   - real-time online presence records
 
 - `invites/{inviteId}`
   - tree invite metadata and status
 
 ## Key Application Files
 
 ```text
 src/
 ├── App.jsx                     # App shell, routing, Firebase config fallback screen
 ├── firebase.js                 # Firebase initialization
 ├── components/
 │   └── FamilyTreeApp.jsx       # Main canvas-style tree UI and layout engine
 ├── context/
 │   └── AuthContext.jsx         # Firebase auth state and auth actions
 ├── pages/
 │   ├── Dashboard.jsx           # Tree tabs, presence, layout loading, invite modal
 │   ├── InviteAccept.jsx        # Invite acceptance flow
 │   └── Login.jsx               # Email/Google auth and reset password
 └── utils/
     ├── firestoreService.js     # Firestore reads/writes for trees, presence, layouts, invites
     ├── gedcomParser.js         # Legacy/utility parsing support
     └── storageService.js       # Local storage helpers
 ```
 
 ## Local Development
 
 ### Install
 
 ```bash
 npm install
 ```
 
 ### Run development server
 
 ```bash
 npm run dev
 ```
 
 ### Build for production
 
 ```bash
 npm run build
 ```
 
 ## Environment Variables
 
 Create a `.env.local` file with:
 
 ```env
 VITE_FIREBASE_API_KEY=...
 VITE_FIREBASE_AUTH_DOMAIN=...
 VITE_FIREBASE_PROJECT_ID=...
 VITE_FIREBASE_STORAGE_BUCKET=...
 VITE_FIREBASE_MESSAGING_SENDER_ID=...
 VITE_FIREBASE_APP_ID=...
 ```
 
 For Vercel deployments, set the same `VITE_FIREBASE_*` variables in Project Settings → Environment Variables.
 
 ## Deployment Notes
 
 - The app is configured as a Vite SPA
 - Vercel needs route rewrites to `index.html`
 - Firebase Auth authorized domains must include the deployed host if Google login is enabled
 - Firebase values should be stored without leading or trailing spaces
 
 ## Import / Export Notes
 
 - JSON export stores `{ version, persons, layout }`
 - XML export stores person records plus card positions
 - XML import is hardened to normalize missing fields and recover from partial or invalid layout data
 
 ## Status
 
 Current implementation is centered around the custom canvas-style tree renderer. If the project later moves to another node-graph solution such as React Flow + ELK, that would be a future architectural change rather than the current production setup.