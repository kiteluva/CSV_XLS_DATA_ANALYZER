// data-handlers.js
// This file manages all data-related operations, including CSV/Excel parsing and IndexedDB interactions.

import { showMessageBox } from './ui-components.js'; // Import the message box utility

// --- IndexedDB Constants ---
const DB_NAME = 'CSVPlotterDB';
const DB_VERSION = 5; // Increased version for `mode` aggregation and data head rows
const STORE_NAME_CSV_DATA = 'csvDataStore'; // This will now store parsed data from CSV/Excel
const STORE_NAME_SAVED_CHARTS = 'savedCharts';
const STORE_NAME_LOADED_DATASETS = 'loadedDatasets'; // Not currently used, but kept for future
const STORE_NAME_ACTIVE_PLOT_CONFIG = 'activePlotConfig';

// --- Local Storage Constants (only for filename, as it's a small string) ---
const LOCAL_STORAGE_KEY_FILENAME = 'csvPlotterFileName';

let db; // Global IndexedDB instance

// Global variables for parsed data and headers (will be updated by functions that load/save data)
export let parsedData = [];
export let headers = [];

/**
 * Opens or creates the IndexedDB database.
 * This function is asynchronous and returns a Promise.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the IDBDatabase instance.
 */
export function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains(STORE_NAME_CSV_DATA)) {
                db.createObjectStore(STORE_NAME_CSV_DATA, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(STORE_NAME_SAVED_CHARTS)) {
                db.createObjectStore(STORE_NAME_SAVED_CHARTS, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(STORE_NAME_LOADED_DATASETS)) {
                db.createObjectStore(STORE_NAME_LOADED_DATASETS, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(STORE_NAME_ACTIVE_PLOT_CONFIG)) {
                db.createObjectStore(STORE_NAME_ACTIVE_PLOT_CONFIG, { keyPath: 'id' }); // Only one active plot config
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            showMessageBox("Error opening database: " + event.target.errorCode);
            reject(new Error("IndexedDB error: " + event.target.errorCode));
        };
    });
}

/**
 * Parses a CSV string into an array of objects and an array for headers.
 * Assumes the first row is headers. Handles potential malformed rows by skipping them.
 * @param {string} csvString - The CSV data as a string.
 * @returns {{data: Array<Object>, headers: Array<string>}} An object containing the parsed data and headers.
 * @throws {Error} If the CSV file is empty.
 */
function parseCSV(csvString) {
    const lines = csvString.trim().split('\n');
    if (lines.length === 0) {
        throw new Error("The CSV file is empty.");
    }

    const hdrs = lines[0].split(',').map(header => header.trim());
    const dataRows = lines.slice(1);

    const prsdData = dataRows.map((row, rowIndex) => {
        const values = row.split(',').map(value => value.trim());
        if (values.length !== hdrs.length) {
            console.warn(`[CSV Parse] Skipping malformed row ${rowIndex + 2}: Mismatch in column count. Expected ${hdrs.length}, got ${values.length}. Row: "${row}"`);
            return null; // Return null for malformed rows
        }
        const rowObject = {};
        hdrs.forEach((header, index) => {
            // Attempt to convert to number if possible, otherwise keep as string
            rowObject[header] = isNaN(Number(values[index])) || values[index].trim() === '' ? values[index] : Number(values[index]);
        });
        return rowObject;
    }).filter(row => row !== null); // Filter out nulls (malformed rows)

    if (prsdData.length === 0 && lines.length > 1) {
        showMessageBox("No valid data rows found after parsing. Check CSV format.");
    } else if (prsdData.length === 0 && lines.length === 1) {
         showMessageBox("CSV file contains only headers and no data.");
    }

    return { data: prsdData, headers: hdrs };
}

/**
 * Parses an Excel file (Blob or ArrayBuffer) into an array of objects and headers.
 * Uses the SheetJS library (XLSX).
 * @param {ArrayBuffer} arrayBuffer - The Excel file data as an ArrayBuffer.
 * @returns {{data: Array<Object>, headers: Array<string>}} An object containing the parsed data and headers.
 * @throws {Error} If the Excel file is empty or parsing fails.
 */
async function parseExcel(arrayBuffer) {
    // Ensure XLSX is loaded
    if (typeof XLSX === 'undefined') {
        throw new Error("XLSX library not loaded. Cannot parse Excel files.");
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0]; // Get the first sheet
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
        throw new Error("No worksheets found in the Excel file.");
    }

    // Convert sheet to JSON, including header row
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (json.length === 0) {
        throw new Error("The Excel file is empty or contains no data.");
    }

    const hdrs = json[0].map(header => String(header).trim()); // Ensure headers are strings
    const prsdData = json.slice(1).map(row => {
        const rowObject = {};
        // Ensure row has enough elements for all headers, fill with empty string if not
        const values = row.map(value => String(value).trim()); // Ensure values are strings
        if (values.length < hdrs.length) {
            // Pad with empty strings if row is shorter than headers
            for (let i = values.length; i < hdrs.length; i++) {
                values.push('');
            }
        }

        hdrs.forEach((header, index) => {
            // Attempt to convert to number if possible, otherwise keep as string
            const value = values[index];
            rowObject[header] = isNaN(Number(value)) || value.trim() === '' ? value : Number(value);
        });
        return rowObject;
    }).filter(row => Object.values(row).some(val => val !== '')); // Filter out entirely empty rows

    if (prsdData.length === 0 && json.length > 1) {
        showMessageBox("No valid data rows found after parsing. Check Excel format or sheet content.");
    } else if (prsdData.length === 0 && json.length === 1) {
         showMessageBox("Excel file contains only headers and no data.");
    }

    return { data: prsdData, headers: hdrs };
}


/**
 * Parses a file (CSV or Excel) and updates global parsedData and headers.
 * @param {File} file - The file object from the input.
 * @returns {Promise<void>} A promise that resolves when parsing and data update is complete.
 */
export async function parseAndSetData(file) {
    if (!file) {
        showMessageBox("No file selected.");
        return;
    }

    const fileExtension = file.name.split('.').pop().toLowerCase();
    let result = { data: [], headers: [] };

    try {
        if (fileExtension === 'csv') {
            const text = await file.text();
            result = parseCSV(text);
        } else if (fileExtension === 'xls' || fileExtension === 'xlsx') {
            // Dynamically load XLSX library if not already loaded
            if (typeof XLSX === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            const arrayBuffer = await file.arrayBuffer();
            result = await parseExcel(arrayBuffer);
        } else {
            showMessageBox("Unsupported file type. Please upload a CSV or Excel file.");
            return;
        }

        parsedData = result.data;
        headers = result.headers;

        // Save to IndexedDB
        await saveDataToIndexedDB(parsedData, file.name);
        localStorage.setItem(LOCAL_STORAGE_KEY_FILENAME, file.name);
        showMessageBox(`File "${file.name}" loaded and parsed successfully!`);
        console.log("Parsed Data:", parsedData);
        console.log("Headers:", headers);

    } catch (error) {
        console.error("Error parsing file:", error);
        showMessageBox(`Error parsing file: ${error.message}`);
        parsedData = []; // Clear data on error
        headers = [];
        localStorage.removeItem(LOCAL_STORAGE_KEY_FILENAME);
    }
}


/**
 * Saves the parsed data to IndexedDB.
 * @param {Array<Object>} data - The parsed data to save.
 * @param {string} fileName - The name of the uploaded file.
 * @returns {Promise<void>} A promise that resolves when data is saved.
 */
export function saveDataToIndexedDB(data, fileName) {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDatabase();
            const transaction = database.transaction([STORE_NAME_CSV_DATA], 'readwrite');
            const store = transaction.objectStore(STORE_NAME_CSV_DATA);

            // Clear existing data before adding new
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => {
                console.log("Cleared existing data from IndexedDB.");
                // Add new data with a single ID for easy retrieval
                const addRequest = store.put({ id: 'currentData', data: data, fileName: fileName });

                addRequest.onsuccess = () => {
                    console.log("Data saved to IndexedDB.");
                    resolve();
                };

                addRequest.onerror = (event) => {
                    console.error("Error saving data to IndexedDB:", event.target.errorCode);
                    reject(new Error("Error saving data to IndexedDB: " + event.target.errorCode));
                };
            };
            clearRequest.onerror = (event) => {
                console.error("Error clearing existing data from IndexedDB:", event.target.errorCode);
                reject(new Error("Error clearing existing data from IndexedDB: " + event.target.errorCode));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Loads parsed data from IndexedDB.
 * Updates the global parsedData and headers variables.
 * @returns {Promise<{data: Array<Object>, headers: Array<string>, fileName: string|null}>} A promise that resolves with the loaded data, headers, and filename.
 */
export function loadDataFromIndexedDB() {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDatabase();
            const transaction = database.transaction([STORE_NAME_CSV_DATA], 'readonly');
            const store = transaction.objectStore(STORE_NAME_CSV_DATA);

            const getRequest = store.get('currentData');

            getRequest.onsuccess = (event) => {
                const result = event.target.result;
                if (result && result.data) {
                    parsedData = result.data;
                    // Re-derive headers in case they changed or were not stored explicitly
                    headers = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
                    const fileName = localStorage.getItem(LOCAL_STORAGE_KEY_FILENAME) || result.fileName || null;
                    console.log("Data loaded from IndexedDB.");
                    resolve({ data: parsedData, headers: headers, fileName: fileName });
                } else {
                    console.log("No data found in IndexedDB.");
                    parsedData = [];
                    headers = [];
                    resolve({ data: [], headers: [], fileName: null });
                }
            };

            getRequest.onerror = (event) => {
                console.error("Error loading data from IndexedDB:", event.target.errorCode);
                reject(new Error("Error loading data from IndexedDB: " + event.target.errorCode));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Clears all CSV/Excel data from IndexedDB and local storage.
 * @returns {Promise<void>} A promise that resolves when data is cleared.
 */
export function clearCSVDataFromIndexedDB() {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDatabase();
            const transaction = database.transaction([STORE_NAME_CSV_DATA], 'readwrite');
            const store = transaction.objectStore(STORE_NAME_CSV_DATA);

            const clearRequest = store.clear();
            clearRequest.onsuccess = () => {
                localStorage.removeItem(LOCAL_STORAGE_KEY_FILENAME);
                parsedData = []; // Clear global data
                headers = [];    // Clear global headers
                console.log("All CSV/Excel data cleared from IndexedDB and Local Storage.");
                resolve();
            };

            clearRequest.onerror = (event) => {
                console.error("Error clearing CSV/Excel data from IndexedDB:", event.target.errorCode);
                reject(new Error("Error clearing CSV/Excel data from IndexedDB: " + event.target.errorCode));
            };
        } catch (error) {
            reject(error);
        }
    });
}


/**
 * Saves the current active plot configuration to IndexedDB.
 * @param {Object} config - The chart configuration object.
 * @returns {Promise<void>}
 */
export function saveActivePlotConfig(config) {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDatabase();
            const transaction = database.transaction([STORE_NAME_ACTIVE_PLOT_CONFIG], 'readwrite');
            const store = transaction.objectStore(STORE_NAME_ACTIVE_PLOT_CONFIG);

            // Use a fixed ID as there's only one active plot config
            const request = store.put({ id: 'currentPlot', config: config });

            request.onsuccess = () => {
                console.log("Active plot configuration saved.");
                resolve();
            };

            request.onerror = (event) => {
                console.error("Error saving active plot config:", event.target.errorCode);
                reject(new Error("Error saving active plot config: " + event.target.errorCode));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Loads the active plot configuration from IndexedDB.
 * @returns {Promise<Object|null>} The saved configuration or null if not found.
 */
export function loadActivePlotConfig() {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDatabase();
            const transaction = database.transaction([STORE_NAME_ACTIVE_PLOT_CONFIG], 'readonly');
            const store = transaction.objectStore(STORE_NAME_ACTIVE_PLOT_CONFIG);

            const request = store.get('currentPlot');

            request.onsuccess = (event) => {
                const result = event.target.result;
                if (result && result.config) {
                    console.log("Active plot configuration loaded.");
                    resolve(result.config);
                } else {
                    console.log("No active plot configuration found.");
                    resolve(null);
                }
            };

            request.onerror = (event) => {
                console.error("Error loading active plot config:", event.target.errorCode);
                reject(new Error("Error loading active plot config: " + event.target.errorCode));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Clears the active plot configuration from IndexedDB.
 * @returns {Promise<void>}
 */
export function clearActivePlotConfig() {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDatabase();
            const transaction = database.transaction([STORE_NAME_ACTIVE_PLOT_CONFIG], 'readwrite');
            const store = transaction.objectStore(STORE_NAME_ACTIVE_PLOT_CONFIG);

            const request = store.delete('currentPlot');

            request.onsuccess = () => {
                console.log("Active plot configuration cleared.");
                resolve();
            };

            request.onerror = (event) => {
                console.error("Error clearing active plot config:", event.target.errorCode);
                reject(new Error("Error clearing active plot config: " + event.target.errorCode));
            };
        } catch (error) {
            reject(error);
        }
    });
}


/**
 * Saves a chart configuration to IndexedDB.
 * @param {Object} chartConfig - The chart configuration object to save.
 * @param {string} description - A user-provided description for the chart.
 * @param {string} chartType - The type of chart (e.g., 'bar', 'line').
 * @param {string} page - The page where the chart was saved (e.g., 'home', 'time-series', 'reporting').
 * @returns {Promise<number>} A promise that resolves with the ID of the saved chart.
 */
export function saveSavedChart(chartConfig, description, chartType, page) {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDatabase();
            const transaction = database.transaction([STORE_NAME_SAVED_CHARTS], 'readwrite');
            const store = transaction.objectStore(STORE_NAME_SAVED_CHARTS);

            const chartRecord = {
                chartConfig: {
                    chartConfig: chartConfig, // Store the actual Chart.js config
                    chartType: chartType,
                    page: page // Store the page context
                },
                description: description,
                dateSaved: new Date().toISOString()
            };

            const request = store.add(chartRecord);

            request.onsuccess = (event) => {
                console.log("Chart saved successfully with ID:", event.target.result);
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error("Error saving chart:", event.target.errorCode);
                reject(new Error("Error saving chart: " + event.target.errorCode));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Loads all saved charts from IndexedDB.
 * @returns {Promise<Array<Object>>} A promise that resolves with an array of saved chart objects.
 */
export function loadSavedCharts() {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDatabase();
            const transaction = database.transaction([STORE_NAME_SAVED_CHARTS], 'readonly');
            const store = transaction.objectStore(STORE_NAME_SAVED_CHARTS);

            const request = store.getAll();

            request.onsuccess = (event) => {
                console.log("Saved charts loaded:", event.target.result);
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error("Error loading saved charts:", event.target.errorCode);
                reject(new Error("Error loading saved charts: " + event.target.errorCode));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Deletes a saved chart by its ID from IndexedDB.
 * @param {number} chartId - The ID of the chart to delete.
 * @returns {Promise<void>} A promise that resolves when the chart is deleted.
 */
export function deleteSavedChartById(chartId) {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDatabase();
            const transaction = database.transaction([STORE_NAME_SAVED_CHARTS], 'readwrite');
            const store = transaction.objectStore(STORE_NAME_SAVED_CHARTS);

            const request = store.delete(chartId);

            request.onsuccess = () => {
                console.log(`Chart with ID ${chartId} deleted.`);
                resolve();
            };

            request.onerror = (event) => {
                console.error(`Error deleting chart with ID ${chartId}:`, event.target.errorCode);
                reject(new Error(`Error deleting chart with ID ${chartId}: ` + event.target.errorCode));
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Clears all saved charts from IndexedDB.
 * @returns {Promise<void>} A promise that resolves when all charts are cleared.
 */
export function clearAllSavedCharts() {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDatabase();
            const transaction = database.transaction([STORE_NAME_SAVED_CHARTS], 'readwrite');
            const store = transaction.objectStore(STORE_NAME_SAVED_CHARTS);

            const request = store.clear();

            request.onsuccess = () => {
                console.log("All saved charts cleared from IndexedDB.");
                resolve();
            };

            request.onerror = (event) => {
                console.error("Error clearing all saved charts:", event.target.errorCode);
                reject(new Error("Error clearing all saved charts: " + event.target.errorCode));
            };
        } catch (error) {
            reject(error);
        }
    });
}
