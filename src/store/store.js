import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import familyTreeReducer from './slices/familyTreeSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    familyTree: familyTreeReducer,
  },
});
