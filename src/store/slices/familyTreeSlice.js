import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  people: {},
  relationships: [],
  rootPersonId: null,
  selectedPersonId: null,
};

const familyTreeSlice = createSlice({
  name: 'familyTree',
  initialState,
  reducers: {
    setRootPerson: (state, action) => {
      const id = nanoid();
      state.people[id] = {
        id,
        ...action.payload,
      };
      state.rootPersonId = id;
      localStorage.setItem('familyTree', JSON.stringify(state));
    },
    addPerson: (state, action) => {
      const id = action.payload.id || nanoid();
      const person = {
        ...action.payload,
        id,
      };
      state.people[id] = person;
      localStorage.setItem('familyTree', JSON.stringify(state));
    },
    updatePerson: (state, action) => {
      const { id, ...updates } = action.payload;
      if (state.people[id]) {
        state.people[id] = { ...state.people[id], ...updates };
        localStorage.setItem('familyTree', JSON.stringify(state));
      }
    },
    deletePerson: (state, action) => {
      const id = action.payload;
      delete state.people[id];
      state.relationships = state.relationships.filter(
        (rel) => rel.fromId !== id && rel.toId !== id
      );
      localStorage.setItem('familyTree', JSON.stringify(state));
    },
    addRelationship: (state, action) => {
      const { fromId, toId, type } = action.payload;
      const relationship = { fromId, toId, type };
      state.relationships.push(relationship);
      localStorage.setItem('familyTree', JSON.stringify(state));
    },
    removeRelationship: (state, action) => {
      const { fromId, toId } = action.payload;
      state.relationships = state.relationships.filter(
        (rel) => !(rel.fromId === fromId && rel.toId === toId)
      );
      localStorage.setItem('familyTree', JSON.stringify(state));
    },
    selectPerson: (state, action) => {
      state.selectedPersonId = action.payload;
    },
    loadFamilyTree: (state, action) => {
      return action.payload;
    },
    restoreFamilyTree: (state) => {
      const saved = localStorage.getItem('familyTree');
      if (saved) {
        return JSON.parse(saved);
      }
    },
    clearFamilyTree: (state) => {
      return {
        people: {},
        relationships: [],
        rootPersonId: null,
        selectedPersonId: null,
      };
    },
  },
});

export const {
  setRootPerson,
  addPerson,
  updatePerson,
  deletePerson,
  addRelationship,
  removeRelationship,
  selectPerson,
  loadFamilyTree,
  restoreFamilyTree,
  clearFamilyTree,
} = familyTreeSlice.actions;

export default familyTreeSlice.reducer;
