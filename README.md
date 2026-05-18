# Family Tree - React Application

A modern, interactive family tree builder application that replicates the core functionality of Family Echo. Build, visualize, and manage your family history with an intuitive interface.

## Features

### Core Functionality
- **Root Person Setup**: Start by entering your own details (given names, surname, gender, birth/death dates, birthplace)
- **Interactive Family Tree Building**: Add family members with relationships:
  - Parents
  - Children
  - Spouses/Partners
  - Siblings

### Person Details
Comprehensive profile information for each family member:
- Names (given names, surname, nickname, title, suffix)
- Demographics (gender, birth date, death date)
- Location (birthplace, death place, burial place)
- Contact Info (email, phone, address, Skype)
- Professional Info (profession, company)
- Personal Info (interests, activities, biography)
- Photo support (via URL)
- Color labels for organization

### Visual Display
- Interactive tree visualization showing family relationships
- Expandable tree structure
- Color-coded family members
- Photo display for each person
- Quick access to details from tree view

### Data Management
- **Privacy**: Mock authentication system - only signed-in users can edit
- **Import/Export**:
  - GEDCOM format support (standard genealogy format)
  - JSON format for backup and sharing
  - Easy import from files
- **Storage**: Local browser storage for tree data
- **Color Labels**: Assign custom colors to people for organization

## Tech Stack

- **Frontend Framework**: React 19
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Routing**: React Router
- **Forms**: React Hook Form
- **Tree Visualization**: React Flow (Interactive node-based graph visualization)
- **Storage**: Browser localStorage

## Getting Started

### Installation

1. Navigate to the project directory:
```bash
cd familytree
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will open at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm preview
```

## Usage

### Initial Setup

1. **Sign In**: Use the login page with any username/password (minimum 3 characters for demo)
   - This creates a mock session to enable editing features

2. **Create Root Person**: Enter your basic information
   - Given names and surname
   - Gender
   - Birth and death dates
   - Birthplace

3. **Build Your Tree**: 
   - Click on any person to select them
   - Use the "Add Family Member" buttons to add parents, children, spouses, or siblings
   - Click on added members to edit their details

### Managing Family Members

- **View Details**: Click on any person in the tree to view their full profile
- **Edit**: Click the person's card and modify any information
- **Delete**: Remove a person from the tree (confirmation required)
- **Add Relationships**: Use contextual buttons to add related family members

### Importing & Exporting

- **Export as GEDCOM**: Compatible with genealogy software
- **Export as JSON**: For backup or sharing your tree
- **Import from JSON**: Restore previously exported trees
- **Import GEDCOM**: Convert genealogy data from other sources

### Color Labels

Organize your family tree by assigning color labels to people:
1. Select a person to edit
2. Choose from 8 color options
3. Save to apply the color

## Project Structure

```
src/
├── components/
│   ├── AddFamilyMemberButtons.jsx    # Button group for adding relations
│   ├── FamilyTreeView.jsx             # Tree visualization component
│   ├── PersonCard.jsx                 # Individual person display card
│   └── PersonForm.jsx                 # Form for editing person details
├── pages/
│   ├── Dashboard.jsx                  # Main app page
│   └── Login.jsx                      # Authentication page
├── store/
│   ├── store.js                       # Redux store configuration
│   └── slices/
│       ├── authSlice.js               # Authentication state
│       └── familyTreeSlice.js         # Family tree data state
├── utils/
│   ├── gedcomParser.js                # GEDCOM import/export
│   └── storageService.js              # Local storage management
├── hooks/
│   └── (custom hooks for future expansion)
├── App.jsx                            # Main app with routing
├── main.jsx                           # Entry point
└── index.css                          # Global styles with Tailwind
```

## Data Structure

### Person Object
```javascript
{
  id: string,                    // Unique identifier
  givenNames: string,            // First name(s)
  surname: string,               // Last name
  nickname: string,              // Optional nickname
  gender: 'Male' | 'Female' | 'Other',
  birthDate: string,             // YYYY-MM-DD format
  birthPlace: string,            // Birth location
  deathDate: string,             // Death date (optional)
  email: string,                 // Contact email
  phone: string,                 // Phone number
  address: string,               // Physical address
  profession: string,            // Job/occupation
  interests: string,             // Hobbies and interests
  bio: string,                   // Biography/notes
  photo: string,                 // URL to photo
  colorLabel: string             // Hex color code for organization
}
```

### Relationship Types
- `parent`: Person A is parent of Person B
- `child`: Person A is child of Person B
- `spouse`: Person A is spouse of Person B (bidirectional)
- `sibling`: Person A is sibling of Person B (bidirectional)

## Authentication & Privacy

The application uses a **mock authentication system**:
- Users sign in with any username/password
- Authentication state is stored in Redux and localStorage
- Editing features are disabled until signed in
- Sign out clears the session but preserves data

**Future Enhancements**: Can be upgraded to real authentication (OAuth, Firebase, etc.)

## Storage

All data is stored locally in the browser:
- Family tree data persists across sessions
- Export functionality allows backing up to files
- Import functionality restores from backups

**Note**: Data is stored per browser/device. To share, use export/import features.

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

- Real authentication system
- Multiple tree sharing/collaboration
- Advanced visualization (D3 tree diagrams)
- Print-friendly reports
- Timeline view
- DNA matching integration
- Mobile app version
- Cloud sync
- Advanced search/filtering
- Photo album per person

## License

ISC

## Contributing

Feel free to fork and submit pull requests for improvements.

---

**Created with React, Redux, and Tailwind CSS** ❤️