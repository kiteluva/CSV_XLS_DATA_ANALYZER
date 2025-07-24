// home.js
// This file contains logic specific to home.html, including CSV/Excel upload, data display, and distribution plotting.

import { showMessageBox } from './ui-components.js';
import {
    parseAndSetData, // Use the new unified parser
    saveDataToIndexedDB,
    parsedData, // Global parsed data from data-handlers.js
    headers, // Global headers from data-handlers.js
    loadDataFromIndexedDB // Import to check if data is already present on load
} from './data-handlers.js';
import {
    populateAxisSelects,
    drawChart,
    clearChartInstances,
    renderSavedChartsTable,
    loadSavedChart,
    myChartCanvas, // Global reference to the main plotting canvas instance
    myDistributionChart, // Import the distribution chart instance
    drawColumnDistributionChart // Import the function to draw distribution chart
} from './charting.js';

// Import dataReadyPromise from main.js
import { dataReadyPromise, handleFileUpload } from './main.js'; // Import handleFileUpload from main.js

// --- IMPORTANT: Define your deployed backend URL here ---
// This URL dynamically points to your Flask backend deployed on Render.
// It checks if the frontend is running locally (e.g., 'localhost') or is deployed.
// For deployed environments, it points directly to your Render backend URL.
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000' // Use this if your Flask backend is running locally
    : 'https://csv-xls-data-analyzer.onrender.com'; // Your deployed Render backend URL


// --- DOM Elements specific to home.html ---
const csvFileInput = document.getElementById('csvFile');
const fileNameDisplay = document.getElementById('fileName'); // Displays file status

const showDataOverviewBtn = document.getElementById('showDataOverviewBtn');
const showPlottingSectionBtn = document.getElementById('showPlottingSectionBtn');

// Section references for visibility toggling
const dataHeadSection = document.getElementById('dataHeadSection');
const dataHeadTable = document.getElementById('dataHeadTable'); // Table inside dataHeadSection

const descriptiveStatisticsSection = document.getElementById('descriptiveStatisticsSection');
const statisticsTable = document.getElementById('statisticsTable'); // Table inside descriptiveStatisticsSection

const distributionPlottingSection = document.getElementById('distributionPlottingSection');
const distributionColumnSelect = document.getElementById('distributionColumnSelect');
const myDistributionChartCanvas = document.getElementById('myDistributionChartCanvas');

const insightsSection = document.getElementById('insightsSection');
const getInsightsBtn = document.getElementById('getInsightsBtn');
const insightsOutput = document.getElementById('insightsOutput');
const insightsText = document.getElementById('insightsText');
const insightsLoading = document.getElementById('insightsLoading');

const mostRecentGraphSection = document.getElementById('mostRecentGraphSection');
const recentGraphDescription = document.getElementById('recentGraphDescription');
const recentSavedChartCanvas = document.getElementById('recentSavedChartCanvas');

const savedGraphsTableBody = document.getElementById('savedGraphsTableBody');
const savedGraphsSection = document.getElementById('savedGraphsSection');


/**
 * Initializes the home page.
 * This function is called when the DOM is fully loaded and after global data is potentially loaded.
 */
async function initializeHomePage() {
    console.log("[home.js] Initializing home page...");

    // Wait for the global dataReadyPromise to ensure IndexedDB data is loaded
    await dataReadyPromise;

    // Attach event listener for file input
    if (csvFileInput) {
        csvFileInput.removeEventListener('change', handleFileUpload); // Prevent duplicates
        csvFileInput.addEventListener('change', handleFileUpload);
    }

    // Attach event listeners for section toggling buttons
    if (showDataOverviewBtn) {
        showDataOverviewBtn.removeEventListener('click', toggleDataOverviewSection);
        showDataOverviewBtn.addEventListener('click', toggleDataOverviewSection);
    }
    if (showPlottingSectionBtn) {
        showPlottingSectionBtn.removeEventListener('click', togglePlottingSection);
        showPlottingSectionBtn.addEventListener('click', togglePlottingSection);
    }
    if (getInsightsBtn) {
        getInsightsBtn.removeEventListener('click', handleGetInsights);
        getInsightsBtn.addEventListener('click', handleGetInsights);
    }
    if (distributionColumnSelect) {
        distributionColumnSelect.removeEventListener('change', handleDistributionColumnChange);
        distributionColumnSelect.addEventListener('change', handleDistributionColumnChange);
    }


    // Listen for custom event indicating data has been updated (e.g., new file uploaded)
    document.removeEventListener('dataUpdated', handleDataUpdated); // Prevent duplicates
    document.addEventListener('dataUpdated', handleDataUpdated);

    // Listen for custom event indicating data has been cleared
    document.removeEventListener('dataCleared', handleDataCleared); // Prevent duplicates
    document.addEventListener('dataCleared', handleDataCleared);

    // Initial render based on currently loaded data
    await renderHomePageUI();
}

/**
 * Handles the custom 'dataUpdated' event, re-rendering UI elements that depend on data.
 */
async function handleDataUpdated() {
    console.log("[home.js] Data updated event received. Re-rendering UI.");
    await renderHomePageUI();
}

/**
 * Handles the custom 'dataCleared' event, resetting UI elements.
 */
async function handleDataCleared() {
    console.log("[home.js] Data cleared event received. Resetting UI.");
    fileNameDisplay.textContent = 'No file chosen';
    dataHeadSection.classList.add('hidden');
    descriptiveStatisticsSection.classList.add('hidden');
    distributionPlottingSection.classList.add('hidden');
    insightsSection.classList.add('hidden');
    mostRecentGraphSection.classList.add('hidden');
    savedGraphsSection.classList.add('hidden');

    showDataOverviewBtn.classList.add('hidden');
    showPlottingSectionBtn.classList.add('hidden');
    getInsightsBtn.classList.add('hidden');

    clearChartInstances(); // Clear any active charts
}

/**
 * Renders the UI elements on the home page based on whether data is loaded.
 */
async function renderHomePageUI() {
    clearChartInstances(); // Clear any existing chart instances before re-rendering

    if (parsedData && parsedData.length > 0) {
        fileNameDisplay.textContent = `File: ${localStorage.getItem('csvPlotterFileName') || 'Unnamed File'}`;
        showDataOverviewBtn.classList.remove('hidden');
        showPlottingSectionBtn.classList.remove('hidden');
        getInsightsBtn.classList.remove('hidden');

        // Populate distribution column select
        populateDistributionColumnSelect(headers);

        // Render saved charts table for the home page
        await renderSavedChartsTable(savedGraphsTableBody, loadSavedChart, deleteSavedChartById, 'home');

        // Load and display the most recent saved chart if it exists for the home page
        const savedCharts = await loadSavedCharts();
        const homePageCharts = savedCharts.filter(chart => chart.chartConfig && chart.chartConfig.page === 'home');

        if (homePageCharts.length > 0) {
            const mostRecentChart = homePageCharts.sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved))[0];
            if (mostRecentChart && mostRecentGraphSection && recentSavedChartCanvas) {
                mostRecentGraphSection.classList.remove('hidden');
                recentGraphDescription.textContent = `Description: ${mostRecentChart.description || 'N/A'} (Saved: ${new Date(mostRecentChart.dateSaved).toLocaleString()})`;
                // Pass parsedData to drawChart for rendering
                drawChart(parsedData,
                          mostRecentChart.chartConfig.chartConfig.options.scales.x.title.text,
                          mostRecentChart.chartConfig.chartConfig.options.scales.y.title.text.replace(/^(Sum|Average|Count|Minimum|Maximum|Median|Mode) of /, ''), // Extract original Y-axis column
                          mostRecentChart.chartConfig.chartType,
                          recentSavedChartCanvas,
                          mostRecentChart.chartConfig.chartConfig.plugins.title.text.split(' ')[0].toLowerCase()); // Extract aggregation type
            }
        }
    } else {
        fileNameDisplay.textContent = 'No file loaded. Please upload a CSV/Excel file on the Home page.';
        showDataOverviewBtn.classList.add('hidden');
        showPlottingSectionBtn.classList.add('hidden');
        getInsightsBtn.classList.add('hidden');
        dataHeadSection.classList.add('hidden');
        descriptiveStatisticsSection.classList.add('hidden');
        distributionPlottingSection.classList.add('hidden');
        insightsSection.classList.add('hidden');
        mostRecentGraphSection.classList.add('hidden');
        savedGraphsSection.classList.add('hidden');
    }
}


/**
 * Populates the distribution column select dropdown.
 * @param {Array<string>} hdrs - The array of headers.
 */
function populateDistributionColumnSelect(hdrs) {
    if (!distributionColumnSelect) return;
    distributionColumnSelect.innerHTML = ''; // Clear existing options

    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Select a column";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    distributionColumnSelect.appendChild(defaultOption);

    hdrs.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        distributionColumnSelect.appendChild(option);
    });
}


/**
 * Toggles the visibility of the data overview section and populates tables.
 */
function toggleDataOverviewSection() {
    dataHeadSection.classList.toggle('hidden');
    descriptiveStatisticsSection.classList.toggle('hidden');
    insightsSection.classList.add('hidden'); // Hide insights if showing overview

    if (!dataHeadSection.classList.contains('hidden')) {
        renderDataHeadTable();
        renderDescriptiveStatistics();
    }
}

/**
 * Toggles the visibility of the plotting section.
 */
function togglePlottingSection() {
    distributionPlottingSection.classList.toggle('hidden');
    insightsSection.classList.add('hidden'); // Hide insights if showing plotting

    if (!distributionPlottingSection.classList.contains('hidden') && distributionColumnSelect.value) {
        // If a column is already selected, redraw the chart
        drawColumnDistributionChart(parsedData, distributionColumnSelect.value);
    }
}

/**
 * Renders the first 10 rows of the parsed data into the dataHeadTable.
 */
function renderDataHeadTable() {
    const tableHeadRow = dataHeadTable.querySelector('thead tr');
    const tableBody = dataHeadTable.querySelector('tbody');

    tableHeadRow.innerHTML = ''; // Clear existing headers
    tableBody.innerHTML = '';    // Clear existing rows

    if (headers.length === 0 || parsedData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="100%" class="text-center py-4 text-gray-500">No data available.</td></tr>';
        return;
    }

    // Create table headers
    headers.forEach(header => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = header;
        tableHeadRow.appendChild(th);
    });

    // Populate table body with first 10 rows
    parsedData.slice(0, 10).forEach(rowData => {
        const tr = document.createElement('tr');
        tr.className = 'bg-white';
        headers.forEach(header => {
            const td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
            td.textContent = rowData[header] !== undefined && rowData[header] !== null ? rowData[header] : '';
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

/**
 * Renders descriptive statistics for numeric columns.
 */
function renderDescriptiveStatistics() {
    const statsTableHeadRow = statisticsTable.querySelector('thead tr');
    const statsTableBody = statisticsTable.querySelector('tbody');

    statsTableHeadRow.innerHTML = '<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statistic</th>'; // Reset
    statsTableBody.innerHTML = ''; // Clear existing rows

    if (parsedData.length === 0 || headers.length === 0) {
        statsTableBody.innerHTML = '<tr><td colspan="100%" class="text-center py-4 text-gray-500">No data available for statistics.</td></tr>';
        return;
    }

    const numericHeaders = headers.filter(header =>
        parsedData.some(row => typeof row[header] === 'number' && !isNaN(row[header]))
    );

    if (numericHeaders.length === 0) {
        statsTableBody.innerHTML = '<tr><td colspan="100%" class="text-center py-4 text-gray-500">No numeric columns found for statistics.</td></tr>';
        return;
    }

    // Add numeric headers to the statistics table header
    numericHeaders.forEach(header => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = header;
        statsTableHeadRow.appendChild(th);
    });

    const statistics = {
        'Count': col => parsedData.filter(row => typeof row[col] === 'number' && !isNaN(row[col])).length,
        'Mean': col => {
            const values = parsedData.map(row => row[col]).filter(val => typeof val === 'number' && !isNaN(val));
            return values.length ? (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(2) : 'N/A';
        },
        'Median': col => {
            const values = parsedData.map(row => row[col]).filter(val => typeof val === 'number' && !isNaN(val)).sort((a, b) => a - b);
            if (values.length === 0) return 'N/A';
            const mid = Math.floor(values.length / 2);
            return values.length % 2 === 0 ? ((values[mid - 1] + values[mid]) / 2).toFixed(2) : values[mid].toFixed(2);
        },
        'Mode': col => {
            const values = parsedData.map(row => row[col]).filter(val => typeof val === 'number' && !isNaN(val));
            if (values.length === 0) return 'N/A';
            const counts = {};
            let maxCount = 0;
            let mode = [];
            for (const val of values) {
                counts[val] = (counts[val] || 0) + 1;
                if (counts[val] > maxCount) {
                    maxCount = counts[val];
                    mode = [val];
                } else if (counts[val] === maxCount && !mode.includes(val)) {
                    mode.push(val);
                }
            }
            return mode.length === values.length ? 'N/A (No distinct mode)' : mode.join(', ');
        },
        'Min': col => {
            const values = parsedData.map(row => row[col]).filter(val => typeof val === 'number' && !isNaN(val));
            return values.length ? Math.min(...values).toFixed(2) : 'N/A';
        },
        'Max': col => {
            const values = parsedData.map(row => row[col]).filter(val => typeof val === 'number' && !isNaN(val));
            return values.length ? Math.max(...values).toFixed(2) : 'N/A';
        },
        'Standard Deviation': col => {
            const values = parsedData.map(row => row[col]).filter(val => typeof val === 'number' && !isNaN(val));
            if (values.length < 2) return 'N/A';
            const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
            return Math.sqrt(variance).toFixed(2);
        }
    };

    for (const statName in statistics) {
        const tr = document.createElement('tr');
        tr.className = 'bg-white';
        const th = document.createElement('th');
        th.scope = 'row';
        th.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
        th.textContent = statName;
        tr.appendChild(th);

        numericHeaders.forEach(header => {
            const td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
            td.textContent = statistics[statName](header);
            tr.appendChild(td);
        });
        statsTableBody.appendChild(tr);
    }
}

/**
 * Event handler for distribution column select change.
 */
function handleDistributionColumnChange(event) {
    if (parsedData.length > 0 && event.target.value) {
        drawColumnDistributionChart(parsedData, event.target.value, myDistributionChartCanvas);
    } else {
        if (myDistributionChart instanceof Chart) {
            myDistributionChart.destroy();
            myDistributionChart = null;
        }
    }
}

/**
 * Handles getting AI insights for the loaded data.
 */
async function handleGetInsights() {
    if (parsedData.length === 0) {
        showMessageBox("Please upload a CSV/Excel file first to get insights.");
        return;
    }

    insightsSection.classList.remove('hidden');
    insightsOutput.classList.remove('hidden');
    insightsText.textContent = '';
    insightsLoading.classList.remove('hidden'); // Show spinner

    try {
        const prompt = `Analyze the following dataset. Provide a summary of its key characteristics, potential trends, and any interesting observations. Focus on column types, ranges, missing values, and general patterns.
        Dataset Headers: ${JSON.stringify(headers)}
        First 5 rows of data: ${JSON.stringify(parsedData.slice(0, 5))}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
            }
        };

        // --- NEW: Call to Render Flask backend ---
        const apiUrl = `${BACKEND_URL}/api/generate-ai-insights`; // Using the generic insights endpoint

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Backend error: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
        }

        const result = await response.json();
        // Expecting { insights: "..." } from the Flask backend
        if (result.insights) {
            insightsText.textContent = result.insights;
        } else if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            insightsText.textContent = result.candidates[0].content.parts[0].text;
        }
        else {
            insightsText.textContent = "No insights could be generated by the backend.";
            console.warn("Unexpected backend API response structure:", result);
        }
    } catch (error) {
        console.error("Error fetching AI insights:", error);
        insightsText.textContent = `Failed to get insights: ${error.message}. Please try again later.`;
    } finally {
        insightsLoading.classList.add('hidden'); // Hide spinner
    }
}

// Attach the initialization function to the DOMContentLoaded event
window.addEventListener('DOMContentLoaded', initializeHomePage);
