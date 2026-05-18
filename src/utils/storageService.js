/**
 * Local storage service for family tree persistence
 */

const STORAGE_KEY = 'familyTree_data';
const USER_KEY = 'familyTree_user';

export const storageService = {
  /**
   * Save family tree to localStorage
   */
  saveFamilyTree: (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error saving family tree:', error);
      return false;
    }
  },

  /**
   * Load family tree from localStorage
   */
  loadFamilyTree: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading family tree:', error);
      return null;
    }
  },

  /**
   * Clear family tree from localStorage
   */
  clearFamilyTree: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing family tree:', error);
      return false;
    }
  },

  /**
   * Export family tree as file
   */
  exportAsFile: (data, filename, format = 'json') => {
    const content = format === 'json' ? JSON.stringify(data, null, 2) : data;
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  },

  /**
   * Import family tree from file
   */
  importFromFile: async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid file format'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      reader.readAsText(file);
    });
  },

  /**
   * Save user data
   */
  saveUser: (user) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return true;
    } catch (error) {
      console.error('Error saving user:', error);
      return false;
    }
  },

  /**
   * Load user data
   */
  loadUser: () => {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading user:', error);
      return null;
    }
  },

  /**
   * Clear user data
   */
  clearUser: () => {
    try {
      localStorage.removeItem(USER_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing user:', error);
      return false;
    }
  },
};
