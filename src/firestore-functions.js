import {collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy} from "firebase/firestore";
import {db} from "./firebase";

// Create an item
const addItem = async (item) => {
    try {
        await addDoc(collection(db, "items"), item);
    } catch (error) {
        console.error("Error adding document: ", error);
    }
};

// Read all items
const fetchItems = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "items"));
        return querySnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error("Error fetching documents: ", error);
    }
};

// Update an item
const updateItem = async (id, updatedData) => {
    try {
        const itemRef = doc(db, "items", id);
        await updateDoc(itemRef, updatedData);
    } catch (error) {
        console.error("Error updating document: ", error);
    }
};

// Delete an item
const deleteItem = async (id) => {
    try {
        const itemRef = doc(db, "items", id);
        await deleteDoc(itemRef);
    } catch (error) {
        console.error("Error deleting document: ", error);
    }
};

// Sort items by field
const fetchSortedItems = async (field) => {
    try {
        const q = query(collection(db, "items"), orderBy(field));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error("Error fetching sorted documents: ", error);
    }
};

// Filter items by field and value
const fetchFilteredItems = async (field, value) => {
    try {
        const q = query(collection(db, "items"), where(field, "==", value));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error("Error fetching filtered documents: ", error);
    }
};

export {db, addItem, fetchItems, updateItem, deleteItem, fetchSortedItems, fetchFilteredItems};