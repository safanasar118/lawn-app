import React, { useState, useEffect } from "react";
import { addItem, fetchItems, updateItem, deleteItem, fetchSortedItems, fetchFilteredItems } from "./firestore-functions";

const App = () => {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [editItem, setEditItem] = useState(null);
  const [sortField, setSortField] = useState("name");
  const [filterField, setFilterField] = useState("name");
  const [filterValue, setFilterValue] = useState("");

  useEffect(() => {
    loadItems().then(() => console.log("items loaded successfully"));
  }, []);

  const loadItems = async () => {
    const fetchedItems = await fetchItems();
    setItems(fetchedItems);
  };

  const handleAdd = async () => {
    if (newItem.trim()) {
      await addItem({ name: newItem });
      setNewItem("");
      await loadItems();
    }
  };

  const handleUpdate = async (id, name) => {
    setEditItem(null);
    await updateItem(id, { name });
    await loadItems();
  };

  const handleDelete = async (id) => {
    await deleteItem(id);
    await loadItems();
  };

  const handleSort = async () => {
    const sortedItems = await fetchSortedItems(sortField);
    setItems(sortedItems);
  };

  const handleFilter = async () => {
    const filteredItems = await fetchFilteredItems(filterField, filterValue);
    setItems(filteredItems);
  };

  return (
      <div>
        <h1>Items Manager</h1>

        {/* Add Item */}
        <div>
          <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add new item"
          />
          <button onClick={handleAdd}>Add</button>
        </div>

        {/* Items List */}
        <ul>
          {items.map((item) => (
              <li key={item.id}>
                {editItem === item.id ? (
                    <input
                        type="text"
                        defaultValue={item.name}
                        onBlur={(e) => handleUpdate(item.id, e.target.value)}
                    />
                ) : (
                    <span>{item.name}</span>
                )}
                <button onClick={() => setEditItem(item.id)}>Edit</button>
                <button onClick={() => handleDelete(item.id)}>Delete</button>
              </li>
          ))}
        </ul>

        {/* Sort Items */}
        <div>
          <select value={sortField} onChange={(e) => setSortField(e.target.value)}>
            <option value="name">Name</option>
            <option value="date">Date</option>
          </select>
          <button onClick={handleSort}>Sort</button>
        </div>

        {/* Filter Items */}
        <div>
          <input
              type="text"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder="Filter value"
          />
          <select value={filterField} onChange={(e) => setFilterField(e.target.value)}>
            <option value="name">Name</option>
            <option value="category">Category</option>
          </select>
          <button onClick={handleFilter}>Filter</button>
        </div>
      </div>
  );
};

export default App;