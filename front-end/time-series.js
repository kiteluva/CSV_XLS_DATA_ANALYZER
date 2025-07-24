// time-series.js
// This file contains logic specific to time-series.html, focusing on plotting time-series data and predictions.

import { populateAxisSelects, populateFilterValueSelect, drawChart, renderSavedChartsTable, loadSavedChart, myChartCanvas, myPredictionChart } from './charting.js';
import { showMessageBox, showPromptBox } from './ui-components.js';
import { parsedData, headers, saveSavedChart, loadSavedCharts, deleteSavedChartById } from './data-handlers.js';
import { dataReadyPromise } from './main.js';

// --- IMPORTANT: Define your deployed backend proxy server URL here ---\
const PROXY_SERVER_URL = 'https://reporting0and0analytics.vercel.app';

// --- DOM Elements specific to time-series.html ---
const startDateInput = document.getElementById('startDateInput');
const endDateInput = document.getElementById('endDateInput');
const dateColumnSelect = document.getElementById('dateColumnSelect');
const applyDateRangeBtn = document.getElementById('applyDateRangeBtn');

// Elements related to displaying data status and plotting controls
const fileNameDisplay = document.getElementById('fileNameDisplay');
const dateRangeSection = document.getElementById('dateRangeSection');
const plottingControlsSection = document.getElementById('plottingControlsSection');
const plotGraphBtn = document.getElementById('plotGraphBtn');
const saveGraphBtn = document.getElementById('saveGraphBtn');
const exportGraphBtn = document.getElementById('exportGraphBtn');

// Selects for plotting
const xAxisSelect = document.getElementById('xAxisSelect');
const yAxisSelect = document.getElementById('yAxisSelect');
const chartTypeSelect = document.getElementById('chartTypeSelect');
const yAxisAggregationSelect = document.getElementById('yAxisAggregationSelect');
const myChartCanvasElement = document.getElementById('myChartCanvas');
const timeSeriesFilterColumnSelect = document.getElementById('timeSeriesFilterColumnSelect');
const timeSeriesFilterValueSelect = document.getElementById('timeSeriesFilterValueSelect');

// Prediction section elements
const predictionSection = document.getElementById('predictionSection');
const predictionColumnSelect = document.getElementById('predictionColumnSelect');
const predictionModelSelect = document.getElementById('predictionModelSelect');
const predictionHorizonInput = document.getElementById('predictionHorizonInput');
const predictionFilterColumnSelect = document.getElementById('predictionFilterColumnSelect');
const predictionFilterValueSelect = document.getElementById('predictionFilterValueSelect');
const runPredictionBtn = document.getElementById('runPredictionBtn');
const predictionResultsOutput = document.getElementById('predictionResultsOutput');
const predictionLoading = document.getElementById('predictionLoading');
const predictionChartCanvas = document.getElementById('predictionChartCanvas');
const predictionAccuracyText = document.getElementById('predictionAccuracyText');
const predictionInsightsText = document.getElementById('predictionInsightsText');

// Saved Graphs elements
const savedGraphsTableBody = document.getElementById('savedGraphsTableBody');
const savedGraphsSection = document.getElementById('savedGraphsSection');
const clearAllSavedGraphsBtn = document.getElementById('clearAllSavedGraphsBtn');
const viewedSavedGraphSection = document.getElementById('viewedSavedGraphSection');


let filteredTimeSeriesData = []; // Data filtered by date range and optional column filter

/**
 * Initializes the time series page.
 */
async function initializeTimeSeriesPage() {
    console.log("[time-series.js] Initializing time series page...");

    // Wait for the global dataReadyPromise to ensure IndexedDB data is loaded
    await dataReadyPromise;

    // Attach event listeners
    if (applyDateRangeBtn) {
        applyDateRangeBtn.removeEventListener('click', handleApplyDateRange);
        applyDateRangeBtn.addEventListener('click', handleApplyDateRange);
    }
    if (plotGraphBtn) {
        plotGraphBtn.removeEventListener('click', handlePlotGraph);
        plotGraphBtn.addEventListener('click', handlePlotGraph);
    }
    if (runPredictionBtn) {
        runPredictionBtn.removeEventListener('click', handleRunPrediction);
        runPredictionBtn.addEventListener('click', handleRunPrediction);
    }
    if (dateColumnSelect) {
        dateColumnSelect.removeEventListener('change', handleDateColumnChange);
        dateColumnSelect.addEventListener('change', handleDateColumnChange);
    }
    if (timeSeriesFilterColumnSelect) {
        timeSeriesFilterColumnSelect.removeEventListener('change', handleTimeSeriesFilterColumnChange);
        timeSeriesFilterColumnSelect.addEventListener('change', handleTimeSeriesFilterColumnChange);
    }
     if (predictionFilterColumnSelect) {
        predictionFilterColumnSelect.removeEventListener('change', handlePredictionFilterColumnChange);
        predictionFilterColumnSelect.addEventListener('change', handlePredictionFilterColumnChange);
    }


    // Listen for custom event indicating data has been updated (e.g., new file uploaded)
    document.removeEventListener('dataUpdated', handleDataUpdated); // Prevent duplicates
    document.addEventListener('dataUpdated', handleDataUpdated);

    // Listen for custom event indicating data has been cleared
    document.removeEventListener('dataCleared', handleDataCleared); // Prevent duplicates
    document.addEventListener('dataCleared', handleDataCleared);

    // Initial render based on currently loaded data
    await renderTimeSeriesPageUI();
}

/**
 * Handles the custom 'dataUpdated' event, re-rendering UI elements that depend on data.
 */
async function handleDataUpdated() {
    console.log("[time-series.js] Data updated event received. Re-rendering UI.");
    await renderTimeSeriesPageUI();
}

/**
 * Handles the custom 'dataCleared' event, resetting UI elements.
 */
async function handleDataCleared() {
    console.log("[time-series.js] Data cleared event received. Resetting UI.");
    fileNameDisplay.textContent = 'No file loaded. Please upload a CSV/Excel file on the Home page.';
    dateRangeSection.classList.add('hidden');
    plottingControlsSection.classList.add('hidden');
    predictionSection.classList.add('hidden');
    savedGraphsSection.classList.add('hidden');
    viewedSavedGraphSection.classList.add('hidden');
    predictionResultsOutput.classList.add('hidden');

    // Clear select options
    if (dateColumnSelect) dateColumnSelect.innerHTML = '';
    if (xAxisSelect) xAxisSelect.innerHTML = '';
    if (yAxisSelect) yAxisSelect.innerHTML = '';
    if (timeSeriesFilterColumnSelect) timeSeriesFilterColumnSelect.innerHTML = '<option value="">No Filter</option>';
    if (timeSeriesFilterValueSelect) timeSeriesFilterValueSelect.innerHTML = '<option value="">All Values</option>';
    if (predictionColumnSelect) predictionColumnSelect.innerHTML = '';
    if (predictionFilterColumnSelect) predictionFilterColumnSelect.innerHTML = '<option value="">No Filter</option>';
    if (predictionFilterValueSelect) predictionFilterValueSelect.innerHTML = '<option value="">All Values</option>';

    startDateInput.value = '';
    endDateInput.value = '';
    startDateInput.removeAttribute('min'); // Clear min/max
    startDateInput.removeAttribute('max');
    endDateInput.removeAttribute('min');
    endDateInput.removeAttribute('max');

    predictionHorizonInput.value = '7';
    predictionAccuracyText.textContent = '';
    predictionInsightsText.textContent = '';

    filteredTimeSeriesData = []; // Clear filtered data
}


/**
 * Renders the UI elements on the time series page based on whether data is loaded.
 */
async function renderTimeSeriesPageUI() {
    // Clear any existing chart instances before re-rendering
    if (myChartCanvas.chartInstance) myChartCanvas.chartInstance.destroy();
    if (myChartCanvasElement) myChartCanvasElement.closest('div').classList.add('hidden'); // Hide canvas div
    if (myPredictionChart) myPredictionChart.destroy();
    if (predictionChartCanvas) predictionChartCanvas.closest('div').classList.add('hidden'); // Hide prediction canvas div

    if (parsedData && parsedData.length > 0) {
        fileNameDisplay.textContent = `File: ${localStorage.getItem('csvPlotterFileName') || 'Unnamed File'}`;
        dateRangeSection.classList.remove('hidden');
        plottingControlsSection.classList.remove('hidden');
        predictionSection.classList.remove('hidden');

        // Populate selects for plotting and prediction
        populateAxisSelects(parsedData, headers, xAxisSelect, yAxisSelect, dateColumnSelect, predictionColumnSelect, null, timeSeriesFilterColumnSelect);
        // Populate prediction filter column separately
        populateAxisSelects(parsedData, headers, null, null, null, null, null, predictionFilterColumnSelect);

        // Set min/max dates for date inputs
        handleDateColumnChange(); // Call this to populate xAxisSelect and set min/max dates initially


        // Render saved charts table for the time-series page
        await renderSavedChartsTable(savedGraphsTableBody, loadSavedChart, deleteSavedChartById, 'time-series');

    } else {
        fileNameDisplay.textContent = 'No file loaded. Please upload a CSV/Excel file on the Home page.';
        dateRangeSection.classList.add('hidden');
        plottingControlsSection.classList.add('hidden');
        predictionSection.classList.add('hidden');
        savedGraphsSection.classList.add('hidden');
        viewedSavedGraphSection.classList.add('hidden');
        predictionResultsOutput.classList.add('hidden');
    }
}


/**
 * Handles change event for the date column select.
 * Ensures that the X-axis select for plotting is also updated with the chosen date column.
 * Also sets the min/max attributes for the date input fields.
 */
function handleDateColumnChange() {
    const selectedDateColumn = dateColumnSelect.value;
    if (!selectedDateColumn) {
        startDateInput.removeAttribute('min');
        startDateInput.removeAttribute('max');
        endDateInput.removeAttribute('min');
        endDateInput.removeAttribute('max');
        return;
    }

    if (xAxisSelect) {
        // Clear existing options first, then add the selected date column
        xAxisSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = selectedDateColumn;
        option.textContent = selectedDateColumn;
        xAxisSelect.appendChild(option);
        xAxisSelect.value = selectedDateColumn; // Ensure it's selected
    }

    // Determine min and max dates from the dataset for the selected column
    let minDate = null;
    let maxDate = null;

    parsedData.forEach(row => {
        const rowDateValue = row[selectedDateColumn];
        if (rowDateValue === undefined || rowDateValue === null || rowDateValue === '') return;

        let date;
        if (typeof rowDateValue === 'number' && rowDateValue > 25569) { // Excel dates
            date = new Date(Date.UTC(1899, 11, 30) + rowDateValue * 24 * 60 * 60 * 1000);
        } else {
            date = new Date(rowDateValue);
        }

        if (isNaN(date.getTime())) {
            console.warn(`Invalid date encountered in column '${selectedDateColumn}': ${rowDateValue}`);
            return;
        }

        // Normalize to YYYY-MM-DD for input type="date"
        const formattedDate = date.toISOString().split('T')[0];

        if (!minDate || formattedDate < minDate) {
            minDate = formattedDate;
        }
        if (!maxDate || formattedDate > maxDate) {
            maxDate = formattedDate;
        }
    });

    if (minDate && maxDate) {
        startDateInput.setAttribute('min', minDate);
        startDateInput.setAttribute('max', maxDate);
        endDateInput.setAttribute('min', minDate);
        endDateInput.setAttribute('max', maxDate);

        // Optionally set initial values to min/max if not already set
        if (!startDateInput.value) startDateInput.value = minDate;
        if (!endDateInput.value) endDateInput.value = maxDate;
    } else {
        startDateInput.removeAttribute('min');
        startDateInput.removeAttribute('max');
        endDateInput.removeAttribute('min');
        endDateInput.removeAttribute('max');
    }
}


/**
 * Handles change event for the time series chart filter column select.
 * Populates the time series chart filter value select based on the chosen column.
 */
function handleTimeSeriesFilterColumnChange() {
    const selectedColumn = timeSeriesFilterColumnSelect.value;
    populateFilterValueSelect(parsedData, selectedColumn, timeSeriesFilterValueSelect);
}

/**
 * Handles change event for the prediction filter column select.
 * Populates the prediction filter value select based on the chosen column.
 */
function handlePredictionFilterColumnChange() {
    const selectedColumn = predictionFilterColumnSelect.value;
    populateFilterValueSelect(parsedData, selectedColumn, predictionFilterValueSelect);
}


/**
 * Applies the selected date range to filter the data.
 */
function handleApplyDateRange() {
    const dateColumn = dateColumnSelect.value;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!dateColumn) {
        showMessageBox("Please select a Date Column first.");
        return;
    }

    if (!startDate || !endDate) {
        showMessageBox("Please select both a start and end date.");
        return;
    }

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || sDate.getTime() > eDate.getTime()) {
        showMessageBox("Invalid date range. Please select a valid start and end date.");
        return;
    }

    // Filter data based on date range
    filteredTimeSeriesData = parsedData.filter(row => {
        const rowDateValue = row[dateColumn];
        if (rowDateValue === undefined || rowDateValue === null || rowDateValue === '') return false;

        let rowDate;
        // Handle Excel numeric dates (e.g., 44927 for 2023-01-01)
        if (typeof rowDateValue === 'number' && rowDateValue > 25569) { // Excel dates start from 1900-01-01 (day 1) or 1899-12-31 (day 0)
            rowDate = new Date(Date.UTC(1899, 11, 30) + rowDateValue * 24 * 60 * 60 * 1000);
        } else {
            rowDate = new Date(rowDateValue);
        }

        if (isNaN(rowDate.getTime())) {
            console.warn(`Skipping row due to invalid date in '${dateColumn}': ${rowDateValue}`);
            return false;
        }
        // Normalize dates to start of day for accurate range comparison
        const normalizedRowDate = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate());
        const normalizedSDate = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
        const normalizedEDate = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate());

        return normalizedRowDate >= normalizedSDate && normalizedRowDate <= normalizedEDate;
    });

    if (filteredTimeSeriesData.length === 0) {
        showMessageBox("No data found for the selected date range. Please adjust your dates.");
        // Clear any existing plot if the filter results in no data
        if (myChartCanvas.chartInstance) myChartCanvas.chartInstance.destroy();
        myChartCanvasElement.closest('div').classList.add('hidden');
        return;
    }

    showMessageBox(`Data filtered for date range: ${startDate} to ${endDate}.`);
    // Re-plot the graph if already plotted, or prepare for new plot
    // The plotGraphBtn click handler will use filteredTimeSeriesData
}


/**
 * Handles plotting a graph based on user selections in the plotting controls section.
 */
function handlePlotGraph() {
    const dateColumn = dateColumnSelect.value;
    const xAxisCol = xAxisSelect.value; // This should be the same as dateColumn after handleDateColumnChange
    const yAxisCol = yAxisSelect.value;
    const chartType = chartTypeSelect.value;
    const yAxisAggregation = yAxisAggregationSelect.value;
    const filterColumn = timeSeriesFilterColumnSelect.value;
    const filterValue = timeSeriesFilterValueSelect.value;

    if (!dateColumn || !xAxisCol || !yAxisCol) {
        showMessageBox("Please select Date Column, X-axis, and Y-axis columns to plot.");
        return;
    }

    if (filteredTimeSeriesData.length === 0) {
        showMessageBox("No data available for plotting. Please apply a date range first or upload a file.");
        return;
    }

    // Check if yAxisCol is numeric for aggregation
    const isYAxisNumeric = parsedData.some(row => typeof row[yAxisCol] === 'number' && !isNaN(row[yAxisCol]));
    if (!isYAxisNumeric && yAxisAggregation !== 'count') {
        showMessageBox(`The selected Y-axis column '${yAxisCol}' is not numeric. Please select a numeric column or choose 'Count' aggregation.`);
        return;
    }

    // Hide viewed saved graph section if a new chart is plotted
    if (viewedSavedGraphSection) viewedSavedGraphSection.classList.add('hidden');

    drawChart(filteredTimeSeriesData, xAxisCol, yAxisCol, chartType, myChartCanvasElement, yAxisAggregation, filterColumn, filterValue);
}


/**
 * Handles running a time series prediction.
 */
async function handleRunPrediction() {
    if (filteredTimeSeriesData.length === 0) {
        showMessageBox("No data available for prediction. Please apply a date range first.");
        return;
    }

    const dateColumn = dateColumnSelect.value;
    const predictionColumn = predictionColumnSelect.value;
    const predictionModel = predictionModelSelect.value;
    const predictionHorizon = parseInt(predictionHorizonInput.value, 10);
    const filterColumn = predictionFilterColumnSelect.value;
    const filterValue = predictionFilterValueSelect.value;

    if (!dateColumn || !predictionColumn || isNaN(predictionHorizon) || predictionHorizon <= 0) {
        showMessageBox("Please select a date column, a column to predict, and a valid prediction horizon.");
        return;
    }

    // Filter data for prediction if filter is applied
    let dataForPrediction = filteredTimeSeriesData;
    if (filterColumn && filterValue !== null && filterValue !== undefined && filterValue !== "") {
        dataForPrediction = filteredTimeSeriesData.filter(row => String(row[filterColumn]) === String(filterValue));
        if (dataForPrediction.length === 0) {
            showMessageBox(`No data found for prediction with filter: ${filterColumn} = ${filterValue}`);
            predictionResultsOutput.classList.add('hidden');
            return;
        }
    }

    // Ensure prediction column is numeric
    const isPredictionColNumeric = dataForPrediction.some(row => typeof row[predictionColumn] === 'number' && !isNaN(row[predictionColumn]));
    if (!isPredictionColNumeric) {
        showMessageBox(`The selected prediction column '${predictionColumn}' is not numeric.`);
        predictionResultsOutput.classList.add('hidden');
        return;
    }

    predictionResultsOutput.classList.remove('hidden');
    predictionInsightsText.textContent = '';
    predictionAccuracyText.textContent = '';
    predictionLoading.classList.remove('hidden'); // Show spinner

    // Prepare data for the backend: extract date and value, sort by date
    const seriesData = dataForPrediction
        .map(row => {
            let date;
            const rowDateValue = row[dateColumn];
            if (typeof rowDateValue === 'number' && rowDateValue > 25569) {
                date = new Date(Date.UTC(1899, 11, 30) + rowDateValue * 24 * 60 * 60 * 1000);
            } else {
                date = new Date(rowDateValue);
            }
            return { date: date.toISOString(), value: row[predictionColumn] };
        })
        .filter(item => !isNaN(new Date(item.date).getTime()) && typeof item.value === 'number' && !isNaN(item.value))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (seriesData.length < 2) {
        showMessageBox("Not enough data points to perform a time series prediction. Need at least 2 data points.");
        predictionLoading.classList.add('hidden');
        predictionResultsOutput.classList.add('hidden');
        return;
    }

    try {
        const payload = {
            time_series_data: seriesData,
            prediction_horizon: predictionHorizon,
            model_type: predictionModel,
            date_column: dateColumn,
            value_column: predictionColumn
        };

        const apiKey = ""; // Canvas will provide this at runtime
        const apiUrl = `${PROXY_SERVER_URL}/time-series-predict?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.detail || errorData.message || JSON.stringify(errorData)}`);
        }

        const result = await response.json();
        console.log("Prediction Result:", result);

        // Display prediction chart
        renderPredictionChart(seriesData, result.predictions, dateColumn, predictionColumn);

        // Display accuracy and insights
        predictionAccuracyText.textContent = `Prediction Accuracy (RMSE): ${result.rmse ? result.rmse.toFixed(4) : 'N/A'}`;
        predictionInsightsText.textContent = result.insights || "No specific insights generated.";

    } catch (error) {
        console.error("Error running prediction:", error);
        showMessageBox(`Failed to run prediction: ${error.message}. Please ensure your data is suitable for time series analysis and try again.`);
        predictionResultsOutput.classList.add('hidden');
    } finally {
        predictionLoading.classList.add('hidden'); // Hide spinner
    }
}


/**
 * Renders the time series prediction chart.
 * @param {Array<Object>} historicalData - Original historical data points.
 * @param {Array<Object>} predictedData - Predicted data points.
 * @param {string} dateColumn - The name of the date column.
 * @param {string} valueColumn - The name of the value column being predicted.
 */
function renderPredictionChart(historicalData, predictedData, dateColumn, valueColumn) {
    if (!predictionChartCanvas) {
        console.error("[Charting] Prediction chart canvas element not found.");
        showMessageBox("Error: Prediction chart canvas not found.");
        return;
    }

    const ctx = predictionChartCanvas.getContext('2d');

    if (myPredictionChart) {
        myPredictionChart.destroy(); // Destroy previous instance
    }

    const allLabels = [];
    const historicalValues = [];
    const predictedValues = [];

    // Combine historical and predicted dates to get all labels
    const combinedData = [...historicalData, ...predictedData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    combinedData.forEach(item => {
        const date = new Date(item.date);
        // Format date for display (e.g., YYYY-MM-DD)
        const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        if (!allLabels.includes(formattedDate)) {
            allLabels.push(formattedDate);
        }
    });

    // Populate historical and predicted values arrays, aligning with allLabels
    allLabels.forEach(label => {
        const histPoint = historicalData.find(item => {
            const date = new Date(item.date);
            return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}` === label;
        });
        historicalValues.push(histPoint ? histPoint.value : null); // Use null for gaps

        const predPoint = predictedData.find(item => {
            const date = new Date(item.date);
            return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}` === label;
        });
        predictedValues.push(predPoint ? predPoint.value : null); // Use null for gaps
    });

    // Create a dataset that combines historical and predicted, with a break point
    const combinedDataset = [];
    let lastHistoricalIndex = historicalData.length > 0 ? allLabels.indexOf(
        `${new Date(historicalData[historicalData.length - 1].date).getFullYear()}-` +
        `${(new Date(historicalData[historicalData.length - 1].date).getMonth() + 1).toString().padStart(2, '0')}-` +
        `${new Date(historicalData[historicalData.length - 1].date).getDate().toString().padStart(2, '0')}`
    ) : -1;

    // Historical data
    combinedDataset.push({
        label: 'Historical Data',
        data: historicalValues.map((val, idx) => idx <= lastHistoricalIndex ? val : null),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderWidth: 2,
        pointRadius: 3,
        fill: false,
        tension: 0.1
    });

    // Predicted data
    combinedDataset.push({
        label: 'Predicted Data',
        data: predictedValues.map((val, idx) => idx >= lastHistoricalIndex ? val : null), // Start from last historical point
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        borderWidth: 2,
        pointRadius: 3,
        borderDash: [5, 5], // Dashed line for predictions
        fill: false,
        tension: 0.1
    });

    myPredictionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: combinedDataset
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#06c8fe'
                    }
                },
                title: {
                    display: true,
                    text: `Time Series Prediction for ${valueColumn}`,
                    color: '#06f7f7',
                    font: {
                        size: 16
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: dateColumn,
                        color: '#06c8fe'
                    },
                    ticks: {
                        color: '#06c8fe'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: valueColumn,
                        color: '#06c8fe'
                    },
                    ticks: {
                        color: '#06c8fe'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
    predictionChartCanvas.closest('div').classList.remove('hidden');
}


// Attach the initialization function to the DOMContentLoaded event
window.addEventListener('DOMContentLoaded', initializeTimeSeriesPage);
