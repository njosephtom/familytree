# Family Tree - Development Guide

## Project Overview

This is a full-stack React application for building and managing family trees. It provides a complete solution for creating, editing, visualizing, and exporting family information in standard genealogy formats.

## Architecture

### Technology Stack

#### Frontend
- **React 19**: Modern React with hooks and functional components
- **Redux Toolkit**: Centralized state management with slices
- **React Router**: Client-side routing
- **React Hook Form**: Efficient form handling
- **Tailwind CSS**: Utility-first CSS framework
- **React Flow**: Interactive node-based family tree visualization (https://reactflow.dev/)
- **Vite**: Lightning-fast build tool and dev server

#### Key Libraries
- `reactflow`: Family tree graph visualization with drag-and-drop support
- `@reduxjs/toolkit`: Redux state management
- `react-redux`: Redux bindings for React
- `react-router-dom`: Routing
- `react-hook-form`: Form state management
- `d3` & `d3-tree`: Graph utilities (for future enhancements)
- `axios`: HTTP client (prepared for future API integration)

### State Management Architecture

The application uses **Redux Toolkit** with two main slices:

#### 1. Auth Slice (`src/store/slices/authSlice.js`)
Manages user authentication state:
- `user`: Current user object
- `isAuthenticated`: Boolean flag

**Actions:**
- `login()`: Set user and authenticated status
- `logout()`: Clear user data
- `restoreAuth()`: Restore from localStorage on app load

#### 2. Family Tree Slice (`src/store/slices/familyTreeSlice.js`)
Manages family tree data:
- `people`: Object mapping person IDs to person objects
- `relationships`: Array of relationship objects
- `rootPersonId`: ID of the family tree root
- `selectedPersonId`: Currently selected person

**Key Actions:**
- `setRootPerson()`: Create root family member
- `addPerson()`: Add new family member
- `updatePerson()`: Edit family member details
- `deletePerson()`: Remove family member
- `addRelationship()`: Create relationship between people
- `removeRelationship()`: Delete relationship
- `selectPerson()`: Set active selection

### Component Architecture

#### Page Components
- **Login.jsx**: Authentication form
  - Mock sign-in/sign-up system
  - Uses Redux auth actions
  
- **Dashboard.jsx**: Main application page
  - Orchestrates all other components
  - Handles import/export logic
  - Tab-based navigation for different views

#### Container Components
- **FamilyTreeView.jsx**: React Flow-based tree visualization
  - Renders family tree as interactive node graph
  - Automatic hierarchical layout
  - Drag-and-drop node positioning
  - Pan and zoom controls
  - MiniMap for large trees
  - Animated edges showing relationships
  - Click nodes to select and view details

#### UI Components
- **PersonCard.jsx**: Person information display
  - Shows all person details
  - Photo display with error handling
  - Delete action for authenticated users
  - Color label visual indicator

- **PersonForm.jsx**: Person data entry
  - Comprehensive form with all person fields
  - Uses react-hook-form for efficiency
  - Color label picker with 8 preset colors
  - Read-only mode option

- **AddFamilyMemberButtons.jsx**: Relationship management
  - Button group for adding family relations
  - Inline form for new person entry
  - Automatic relationship linking

## Data Models

### Person Object
```javascript
{
  id: string,                    // Unique identifier (auto-generated)
  givenNames: string,            // First name(s)
  surname: string,               // Family name
  nickname: string,              // Alternative name
  gender: 'Male'|'Female'|'Other',
  birthDate: string,             // ISO date: YYYY-MM-DD
  birthPlace: string,            // Location string
  deathDate: string,             // Optional death date
  email: string,                 // Email address
  phone: string,                 // Phone number
  address: string,               // Street address
  profession: string,            // Job/career
  interests: string,             // Hobbies/interests (comma-separated)
  bio: string,                   // Biography/notes
  photo: string,                 // URL to photo
  colorLabel: string             // Hex color code (#RRGGBB)
}
```

### Relationship Object
```javascript
{
  fromId: string,                // Source person ID
  toId: string,                  // Target person ID
  type: 'parent'|'child'|'spouse'|'sibling'
}
```

### Relationship Types
- `parent`: fromId is parent of toId
- `child`: fromId is child of toId
- `spouse`: fromId is spouse of toId (usually bidirectional)
- `sibling`: fromId is sibling of toId (usually bidirectional)

## Data Persistence

### Local Storage
The app uses browser localStorage for data persistence:

**Keys:**
- `familyTree_data`: Complete family tree state
- `familyTree_user`: Current user data

**Automatic Saving:**
- Redux slices automatically persist after each state change
- Called from reducers using `localStorage.setItem()`

**Loading:**
- `restoreFamilyTree()` action on app initialization
- `restoreAuth()` action on app load

### Storage Service (`src/utils/storageService.js`)
Utility functions for storage operations:
- `saveFamilyTree()`: Persist tree to localStorage
- `loadFamilyTree()`: Retrieve tree from localStorage
- `exportAsFile()`: Download as JSON or GEDCOM file
- `importFromFile()`: Load from uploaded file
- `saveUser()` / `loadUser()` / `clearUser()`: User data management

## Import/Export Functionality

### GEDCOM Support (`src/utils/gedcomParser.js`)

**Export to GEDCOM:**
- Standard genealogy format (GEDCOM 5.5.1)
- Includes person records with key fields
- Supports relationships through family structure
- Generated with proper header and trailer

**Import from GEDCOM:**
- Parses GEDCOM text format
- Extracts person information
- Converts to internal data structure
- Handles multi-line values and complex names

### JSON Export/Import

**Export:**
- Complete state snapshot
- Version and export timestamp
- Can be shared or used as backup

**Import:**
- Version validation
- Complete tree restoration
- Overwrites existing tree

## Routing

Using React Router with two main routes:

```
/login          - Authentication page
/dashboard      - Main application (protected)
/               - Redirects to /dashboard
```

### Route Protection
`ProtectedRoute` component checks `isAuthenticated` in Redux state:
- Redirects to `/login` if not authenticated
- Allows access to `/dashboard` if authenticated

## Form Handling

### React Hook Form Integration
Used in `PersonForm.jsx`:
- `useForm()`: Initialize form with default values
- `register()`: Register input fields
- `handleSubmit()`: Form submission
- `watch()`: Real-time field value watching
- `setValue()`: Programmatic field updates

**Benefits:**
- Minimal re-renders
- Efficient performance
- Built-in validation support

## Styling Approach

### React Flow Visualization
The family tree uses **React Flow** (https://reactflow.dev/), a powerful library for creating interactive node-based diagrams:

**Features:**
- Drag-and-drop node interaction
- Pan and zoom controls
- Minimap for navigation in large trees
- Automatic hierarchical node layout
- Arrow connections showing relationships
- Smooth animations and transitions
- Touch-friendly on mobile

**React Flow Architecture:**
- Nodes: Represent family members with customizable styling
- Edges: Represent relationships (parent, child, spouse, sibling)
- Controls: Pan, zoom, fit view
- MiniMap: Overview of entire family tree
- Background: Customizable grid background

**Node Styling:**
- Selected person highlighted in blue
- Color labels displayed as left border indicator
- Birth/death dates shown on node
- Photos displayed inline (if available)
- Hover effects for interactivity

### Tailwind CSS
Utility-first approach with custom components via `@apply`:

**Key Styles (`src/index.css`):**
- `.form-group`: Form field styling
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`: Button variants
- `.card`: Card container styling
- `.tree-node*`: Tree visualization styles
- `.color-label`: Color picker styling

**Responsive Design:**
- Mobile-first approach
- Breakpoints: `sm`, `md`, `lg` (Tailwind defaults)
- Flexible grid layouts

## Authentication Flow

Current implementation uses **mock authentication**:

1. User enters username/password on login
2. Validation: minimum 3 characters each
3. On success:
   - Create user object with random ID
   - Dispatch `login()` action
   - Save to localStorage
   - Redirect to dashboard
4. On logout:
   - Dispatch `logout()` action
   - Clear localStorage
   - Redirect to login

**Future Enhancement Options:**
- Firebase Authentication
- Auth0
- OAuth 2.0
- Custom backend API

## Extension Points

### Adding New Person Fields
1. Add field to `Person` object in slice
2. Add form input in `PersonForm.jsx`
3. Display in `PersonCard.jsx` if needed
4. Update GEDCOM parser if field is genealogically significant

### Adding New Relationship Types
1. Add type to `Relationship` object
2. Create action in `AddFamilyMemberButtons.jsx`
3. Update tree rendering in `FamilyTreeView.jsx`
4. Handle in GEDCOM export/import

### Custom Visualization
Replace/enhance `FamilyTreeView.jsx` with alternative visualizations:
- **Ancestor Chart**: Fan-shaped display of ancestors
- **Descendant Chart**: Cascading descendants view
- **Timeline View**: Family history on a timeline
- **Force-Directed Graph**: Physics-based layout
- **Circular Hierarchy**: Radial tree layout
- **Sunburst Diagram**: Nested circles visualization

**Note**: Current implementation uses **React Flow** which is highly customizable. See https://reactflow.dev/ for advanced layout options and custom node types.

### Real Backend Integration
1. Replace Redux state with API calls
2. Update storage service to use fetch/axios
3. Implement real authentication
4. Add data validation on server
5. Support collaborative editing

### Search & Filtering
Potential enhancements:
- Full-text search across all fields
- Filter by date range
- Filter by location
- Advanced query language
- Search history

## Performance Optimization

### Current Optimizations
- Redux selectors for efficient re-renders
- React.memo for component memoization (not yet applied)
- React Flow's optimized rendering for graphs
- Code-splitting ready with Vite
- Efficient hierarchical layout algorithm

### Scalability
- React Flow handles 1000+ nodes smoothly
- Efficient edge rendering with animations
- Auto-layout with generational positioning
- MiniMap for large tree navigation
- Pan/zoom without performance degradation

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers supported

### Recommended Further Optimizations
- Memoize computed family relationships
- Custom layout algorithms for better spacing
- Web Worker for expensive calculations
- Virtual scrolling for enormous edge counts
- Lazy loading of family tree sections

## Testing Strategy

### Recommended Testing Libraries
- `@testing-library/react`: Component testing
- `@testing-library/user-event`: User interaction testing
- `vitest`: Fast unit test runner (alternative to Jest)
- `@redux-mock-store`: Redux state testing

### Test Areas
1. **Components**
   - Form submission
   - Person selection
   - Tree rendering

2. **Redux**
   - Action creators
   - Reducer state changes
   - Selectors

3. **Utilities**
   - GEDCOM parsing
   - Storage operations
   - Data transformation

4. **Integration**
   - Full user workflows
   - Import/export cycles

## Deployment

### Build for Production
```bash
npm run build
```

Outputs to `dist/` directory with:
- Minified JavaScript
- Optimized CSS
- Hash-based asset names
- Source maps (optional)

### Hosting Options
- Vercel (Git integration, zero-config)
- Netlify (similar to Vercel)
- GitHub Pages (static hosting)
- AWS S3 + CloudFront
- Firebase Hosting
- Docker container

### Environment Configuration
Add `.env` files for API endpoints:
```
VITE_API_URL=https://api.example.com
VITE_UPLOAD_URL=https://upload.example.com
```

Access via `import.meta.env.VITE_*`

## Browser DevTools

### Redux DevTools
Install extension: https://github.com/reduxjs/redux-devtools

Features:
- Time-travel debugging
- Action history
- State diff viewer
- Dispatch actions manually

### React DevTools
Install extension for React component tree inspection

## Troubleshooting

### Common Issues

**1. Build fails with Tailwind error**
```
Error: It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin
```
Solution: Ensure `@tailwindcss/postcss` is installed and `postcss.config.js` uses it

**2. localStorage throws in private browsing**
Solution: Wrap storage calls in try-catch, gracefully degrade

**3. Redux state not persisting**
Solution: Check localStorage is enabled, verify storage keys

**4. Photo URLs not displaying**
Solution: Ensure CORS is enabled on image host, use placeholder on error

## Code Style

### ESLint Configuration
- Base: `eslint:recommended`
- React plugin enabled
- React 17+ doesn't require JSX import

### Prettier Configuration
- 100 character line width
- Single quotes
- 2-space indentation
- Trailing commas (ES5)
- Automatic formatting on save (IDE config)

## Future Roadmap

### Phase 2
- Real user accounts & authentication
- Cloud storage (Firebase or custom backend)
- Collaborative editing
- User sharing & permissions
- Email invitations

### Phase 3
- Advanced visualization (D3 diagrams)
- Timeline view
- Photo album per person
- Document upload storage
- DNA matching simulation

### Phase 4
- Mobile apps (React Native)
- Offline sync (PWA)
- Advanced search
- AI-powered suggestions
- Social sharing
- Print reports

## Contributing

### Development Setup
1. Fork repository
2. Clone fork
3. `npm install`
4. `npm run dev`
5. Make changes
6. Test thoroughly
7. Submit pull request

### Code Standards
- Write clear, self-documenting code
- Add JSDoc comments for complex functions
- Keep components small and focused
- One component per file
- Use TypeScript comments for type hints

### Pull Request Process
1. Update README if needed
2. Add/update tests
3. Follow code style guidelines
4. Provide clear PR description
5. Request review from maintainers

---

**Built with ❤️ using React, Redux, and Tailwind CSS**