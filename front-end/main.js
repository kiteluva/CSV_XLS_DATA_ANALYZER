// main.js
// This file orchestrates the application logic, imports modules, and sets up global event listeners.

import {
    openDatabase,
    loadDataFromIndexedDB,
    clearCSVDataFromIndexedDB, // Now handles all data
    saveActivePlotConfig,
    loadActivePlotConfig,
    clearActivePlotConfig,
    saveSavedChart,
    loadSavedCharts,
    clearAllSavedCharts,
    deleteSavedChartById,
    parsedData, // Directly import parsedData from data-handlers.js
    headers,      // Directly import headers from data-handlers.js
    parseAndSetData // Import the new unified parser
} from './data-handlers.js';

import {
    populateAxisSelects,
    drawChart,
    renderSavedChartsTable,
    loadSavedChart,
    clearChartInstances,
    myChartCanvas // Ensure this is exported from charting.js
} from './charting.js';

import { showMessageBox, hideMessageBox, showPromptBox } from './ui-components.js';

// --- IMPORTANT: Define your deployed backend URL here ---
// This URL points to your Flask backend deployed on Render.
// It should be sourced from Vercel environment variables for production.
// Use 'import.meta.env.VITE_API_BASE_URL' for Vite, 'process.env.NEXT_PUBLIC_API_URL' for Next.js, etc.
// The fallback 'http://localhost:5000' is for local development with your Flask app.
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'; // Replace VITE_API_BASE_URL if using a different framework


// --- DOM Elements (Universal / Main App) ---
// These elements might be present on multiple pages or are globally managed.
const plotGraphBtn = document.getElementById('plotGraphBtn'); // Present on home, reporting, time-series
const getInsightsBtn = document.getElementById('getInsightsBtn'); // Present on home
const clearAllDataBtn = document.getElementById('clearAllDataBtn'); // Present on home
const clearAllSavedGraphsBtn = document.getElementById('clearAllSavedGraphsBtn'); // Present on home, reporting, time-series
const saveGraphBtn = document.getElementById('saveGraphBtn'); // Present on home, reporting, time-series
const exportGraphBtn = document.getElementById('exportGraphBtn'); // Present on home, reporting, time-series
const savedGraphsTableBody = document.getElementById('savedGraphsTableBody'); // Present on home, reporting, time-series
const savedGraphsSection = document.getElementById('savedGraphsSection'); // Present on home, reporting, time-series

// --- Global State ---
// This promise resolves when data is loaded from IndexedDB on app start.
// Pages can await this promise to ensure data is ready before initializing.
export let dataReadyPromise;


/**
 * Initializes the application by opening the database and loading existing data.
 * This function runs once when the DOM is fully loaded.
 */
async function initializeApp() {
    console.log("[main.js] Initializing app...");
    dataReadyPromise = new Promise(async (resolve) => {
        try {
            await openDatabase();
            const { data, headers: loadedHeaders, fileName } = await loadDataFromIndexedDB();
            if (data.length > 0) {
                console.log("[main.js] Data loaded from IndexedDB:", { data, loadedHeaders, fileName });
                // parsedData and headers are already updated by loadDataFromIndexedDB
                // You can dispatch a custom event here if specific components need to react
                // to data loading, e.g., document.dispatchEvent(new CustomEvent('dataLoaded'));
            } else {
                console.log("[main.js] No data found in IndexedDB.");
            }
            resolve(); // Resolve the promise once data loading attempt is complete
        } catch (error) {
            console.error("[main.js] Error during app initialization:", error);
            showMessageBox(`App initialization error: ${error.message}`);
            resolve(); // Resolve anyway to allow the app to proceed even if data loading failed
        }
    });

    // Wait for data to be ready before setting up page-specific listeners that depend on it
    await dataReadyPromise;

    // Set up universal event listeners
    setupUniversalEventListeners();
}


/**
 * Sets up event listeners that are common across multiple pages or global to the app.
 */
function setupUniversalEventListeners() {
    // Listener for clearing all data (on home page)
    if (clearAllDataBtn) {
        clearAllDataBtn.removeEventListener('click', handleClearAllData); // Prevent duplicate listeners
        clearAllDataBtn.addEventListener('click', handleClearAllData);
    }

    // Listener for clearing all saved graphs (on home, reporting, time-series pages)
    if (clearAllSavedGraphsBtn) {
        clearAllSavedGraphsBtn.removeEventListener('click', handleClearAllSavedGraphs); // Prevent duplicate listeners
        clearAllSavedGraphsBtn.addEventListener('click', handleClearAllSavedGraphs);
    }

    // Listener for saving a graph (on home, reporting, time-series pages)
    if (saveGraphBtn) {
        saveGraphBtn.removeEventListener('click', handleSaveGraph); // Prevent duplicate listeners
        saveGraphBtn.addEventListener('click', handleSaveGraph);
    }

    // Listener to export a graph (universal)
    if (exportGraphBtn) {
        exportGraphBtn.removeEventListener('click', handleExportGraph); // Prevent duplicate listeners
        exportGraphBtn.addEventListener('click', handleExportGraph);
    }
}


/**
 * Handles the file input change event for CSV/Excel files.
 * @param {Event} event - The change event from the file input.
 */
export async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const fileNameDisplay = document.getElementById('fileName'); // Specific to home.html
        if (fileNameDisplay) {
            fileNameDisplay.textContent = `File: ${file.name}`;
        }
        await parseAndSetData(file); // Use the unified parser
        // After parsing, trigger re-initialization of relevant page components
        document.dispatchEvent(new CustomEvent('dataUpdated'));
    }
}


/**
 * Handles clearing all data from IndexedDB.
 */
async function handleClearAllData() {
    const confirmClear = await showPromptBox("Are you sure you want to clear ALL loaded data and saved plots? This action cannot be undone.", "yes");
    if (confirmClear && confirmClear.toLowerCase() === 'yes') {
        try {
            await clearCSVDataFromIndexedDB(); // Clears parsed data
            await clearAllSavedCharts(); // Clears saved charts
            await clearActivePlotConfig(); // Clears active plot config
            clearChartInstances(); // Destroy any active Chart.js instances

            // Update UI on home page
            const fileNameDisplay = document.getElementById('fileName');
            if (fileNameDisplay) fileNameDisplay.textContent = 'No file chosen';

            const dataHeadSection = document.getElementById('dataHeadSection');
            if (dataHeadSection) dataHeadSection.classList.add('hidden');
            const descriptiveStatisticsSection = document.getElementById('descriptiveStatisticsSection');
            if (descriptiveStatisticsSection) descriptiveStatisticsSection.classList.add('hidden');
            const distributionPlottingSection = document.getElementById('distributionPlottingSection');
            if (distributionPlottingSection) distributionPlottingSection.classList.add('hidden');
            const insightsSection = document.getElementById('insightsSection');
            if (insightsSection) insightsSection.classList.add('hidden');
            const mostRecentGraphSection = document.getElementById('mostRecentGraphSection');
            if (mostRecentGraphSection) mostRecentGraphSection.classList.add('hidden');
            if (savedGraphsSection) savedGraphsSection.classList.add('hidden');

            const showDataOverviewBtn = document.getElementById('showDataOverviewBtn');
            if (showDataOverviewBtn) showDataOverviewBtn.classList.add('hidden');
            const showPlottingSectionBtn = document.getElementById('showPlottingSectionBtn');
            if (showPlottingSectionBtn) showPlottingSectionBtn.classList.add('hidden');
            const getInsightsBtn = document.getElementById('getInsightsBtn');
            if (getInsightsBtn) getInsightsBtn.classList.add('hidden');


            showMessageBox("All data and saved plots have been cleared!");
            // Dispatch event to notify other modules that data has been cleared
            document.dispatchEvent(new CustomEvent('dataCleared'));

        } catch (error) {
            console.error("Error clearing all data:", error);
            showMessageBox(`Error clearing all data: ${error.message}`);
        }
    } else {
        showMessageBox("Clear all data operation cancelled.");
    }
}

/**
 * Handles clearing all saved graphs specific to the current page.
 * This function needs to be aware of the current page context.
 */
async function handleClearAllSavedGraphs() {
    const currentPage = window.location.pathname.split('/').pop(); // e.g., "home.html"
    let pageTag = '';
    if (currentPage.includes('home.html') || currentPage === '') {
        pageTag = 'home';
    } else if (currentPage.includes('reporting.html')) {
        pageTag = 'reporting';
    } else if (currentPage.includes('time-series.html')) {
        pageTag = 'time-series';
    } else if (currentPage.includes('complex_stats.html')) {
        pageTag = 'complex_stats';
    }

    const confirmClear = await showPromptBox(`Are you sure you want to clear ALL saved graphs on the ${pageTag} page? This action cannot be undone. Type 'yes' to confirm.`, "no");
    if (confirmClear && confirmClear.toLowerCase() === 'yes') {
        try {
            const savedCharts = await loadSavedCharts();
            // Filter for charts specifically tagged for the current page
            const pageSpecificCharts = savedCharts.filter(chart => chart.chartConfig && chart.chartConfig.page === pageTag);
            for (const chart of pageSpecificCharts) {
                await deleteSavedChartById(chart.id);
            }

            // Re-render the saved charts table (which will now be empty for this page)
            if (savedGraphsTableBody) {
                await renderSavedChartsTable(savedGraphsTableBody, loadSavedChart, deleteSavedChartById, pageTag);
            }

            const remainingCharts = await loadSavedCharts(); // Check if any charts remain (from other pages)
            const remainingPageCharts = remainingCharts.filter(chart => chart.chartConfig && chart.chartConfig.page === pageTag);

            if (remainingPageCharts.length === 0) {
                // Hide saved graphs section if no charts left for this page
                if (savedGraphsSection) savedGraphsSection.classList.add('hidden');
            }
            showMessageBox(`All saved graphs on the ${pageTag} page have been cleared!`);
        } catch (error) {
            console.error("Error clearing saved graphs:", error);
            showMessageBox(`Error clearing saved graphs: ${error.message}`);
        }
    } else {
        showMessageBox("Clear saved graphs operation cancelled.");
    }
}


/**
 * Handles saving the currently plotted graph.
 */
async function handleSaveGraph() {
    if (!myChartCanvas.chartInstance || !myChartCanvas.chartConfig) {
        showMessageBox("No chart is currently plotted to save.");
        return;
    }

    const description = await showPromptBox("Enter a description for this graph:", "My Saved Chart");
    if (description === null) { // User cancelled the prompt
        showMessageBox("Graph save cancelled.");
        return;
    }
    if (description.trim() === "") {
        showMessageBox("Description cannot be empty. Graph save cancelled.");
        return;
    }

    try {
        const currentPage = window.location.pathname.split('/').pop();
        let pageTag = '';
        if (currentPage.includes('home.html') || currentPage === '') {
            pageTag = 'home';
        } else if (currentPage.includes('reporting.html')) {
            pageTag = 'reporting';
        } else if (currentPage.includes('time-series.html')) {
            pageTag = 'time-series';
        } else if (currentPage.includes('complex_stats.html')) {
            pageTag = 'complex_stats';
        }

        const chartId = await saveSavedChart(myChartCanvas.chartConfig, description, myChartCanvas.chartConfig.type, pageTag);
        showMessageBox(`Chart "${description}" saved successfully!`);
        console.log("Chart saved with ID:", chartId);

        // Crucial: Re-render the saved charts table after a new chart is saved
        if (savedGraphsTableBody) {
            await renderSavedChartsTable(savedGraphsTableBody, loadSavedChart, deleteSavedChartById, pageTag);
        }
    } catch (error) {
        console.error("Error saving chart:", error);
        showMessageBox(`Error saving chart: ${error.message}`);
    }
}

/**
 * Handles exporting the currently plotted graph as a PNG.
 */
function handleExportGraph() {
    if (!myChartCanvas.chartInstance) {
        showMessageBox("No chart is currently plotted to export.");
        return;
    }

    // Create a temporary link element
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.href = myChartCanvas.chartInstance.toBase64Image('image/png', 1); // Get chart as PNG data URL
    a.download = 'chart.png'; // Suggested filename
    a.click(); // Programmatically click the link to trigger download
    document.body.removeChild(a); // Clean up the temporary link
    showMessageBox('Chart exported as PNG!', false);
}


// Ensure UI initializes on page load
window.addEventListener('DOMContentLoaded', initializeApp);
