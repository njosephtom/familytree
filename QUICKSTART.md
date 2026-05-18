# Quick Start Guide - Family Tree

Get the Family Tree application running in minutes!

## Prerequisites
- Node.js 16+ and npm installed
- A modern web browser

## Installation (< 2 minutes)

1. Navigate to the project folder:
```bash
cd familytree
```

2. Install dependencies (if not already done):
```bash
npm install
```

## Running the Application

### Development Mode (Best for testing)
```bash
npm run dev
```
- Opens automatically at `http://localhost:3000`
- Hot reload on file changes
- Better error messages

### Production Build
```bash
npm run build
npm run preview
```

## First Time Setup

1. **Sign In**
   - Username: anything (min 3 chars)
   - Password: anything (min 3 chars)
   - Click "Create Account" or "Sign In"

2. **Create Your Family Tree Root**
   - Enter your name and basic info
   - Set gender, birth date, birth place
   - Click "Save Person"

3. **Add Family Members**
   - Click on yourself in the tree
   - Use the "Add Family Member" buttons
   - Choose: Parents, Children, Spouse, or Sibling
   - Fill in their details

4. **View Tree**
   - Tree updates automatically
   - Click any person to see details
   - Use color labels to organize

## Key Actions

| Action | How To |
|--------|--------|
| **View Details** | Click person in tree |
| **Edit Person** | Click person → Edit (on card) |
| **Delete Person** | Click person → Delete button |
| **Add Family** | Select person → Use Add buttons |
| **Export** | Click "Export/Import" → Choose format |
| **Import** | Click "Export/Import" → Upload file |
| **Sign Out** | Click "Logout" button |

## Export Options

- **GEDCOM**: For genealogy software (Ancestry.com, FamilySearch, etc.)
- **JSON**: For backup and sharing

## Tips & Tricks

✅ **Do:**
- Use photos (paste image URLs)
- Add birthdates for better organization
- Use color labels to group families
- Export regularly as backup

❌ **Don't:**
- Forget to sign in before editing
- Close browser without saving (auto-saves)
- Use very old browser (Chrome 90+)

## Troubleshooting

**"Port 3000 already in use"**
```bash
# Use different port
npm run dev -- --port 3001
```

**Photos not showing**
- Make sure URL is HTTPS
- Some sites block image loading

**Data not saving**
- Check browser allows localStorage
- Try different browser
- Check browser storage isn't full

**Import not working**
- Verify file format (GEDCOM or JSON)
- Try smaller file first

## Next Steps

- Read [README.md](README.md) for full features
- Check [FEATURES.md](FEATURES.md) for details on each feature
- See [DEVELOPMENT.md](DEVELOPMENT.md) for technical details

## Need Help?

- Check application demo info on login page
- Review feature documentation
- Check browser console for errors (F12)

---

**Happy tree building! 🌳**