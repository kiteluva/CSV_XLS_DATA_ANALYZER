// complex_stats.js
// This file contains logic specific to complex_stats.html,
// including correlation matrix, multiple linear regression (MLR), and Random Forest Regression.

import { populateAxisSelects } from './charting.js';
import { parsedData, headers } from './data-handlers.js'; // Import global data
import { showMessageBox as showUIMessageBox } from './ui-components.js'; // Alias to avoid conflict if showMessageBox is also in charting.js
import { dataReadyPromise } from './main.js'; // Import dataReadyPromise

// --- IMPORTANT: Define your deployed backend URL here ---
// This URL dynamically points to your Flask backend deployed on Render.
// It checks if the frontend is running locally (e.g., 'localhost') or is deployed.
// For deployed environments, it points directly to your Render backend URL.
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000' // Use this if your Flask backend is running locally
    : 'https://csv-xls-data-analyzer.onrender.com'; // Your deployed Render backend URL


// --- DOM Elements specific to complex_stats.html ---
const fileNameDisplay = document.getElementById('fileNameDisplay'); // Add this for consistent data status display
const complexStatsControlsSection = document.getElementById('complexStatsControlsSection'); // Assuming a wrapper for all controls

// Correlation Matrix Elements
const calculateCorrelationBtn = document.getElementById('calculateCorrelationBtn');
const correlationColumnsSelect = document.getElementById('correlationColumnsSelect');
const correlationOrderSelect = document.getElementById('correlationOrderSelect');
const correlationMatrixOutput = document.getElementById('correlationMatrixOutput');
const correlationMatrixContainer = document.getElementById('correlationMatrixContainer'); // Container for the table
const getAICorrelationInterpretationBtn = document.getElementById('getAICorrelationInterpretationBtn');
const correlationInsightsOutput = document.getElementById('correlationInsightsOutput');
const correlationInsightsText = document.getElementById('correlationInsightsText');
const correlationInsightsLoading = document.getElementById('correlationInsightsLoading');

// Multiple Linear Regression Elements
const dependentVarSelectMLR = document.getElementById('dependentVarSelectMLR');
const independentVarsSelectMLR = document.getElementById('independentVarsSelectMLR');
const runRegressionBtn = document.getElementById('runRegressionBtn');
const regressionResultsOutput = document.getElementById('regressionResultsOutput');
const regressionResultsText = document.getElementById('regressionResultsText');
const getAILinearRegressionInterpretationBtn = document.getElementById('getAILinearRegressionInterpretationBtn');
const linearRegressionInsightsOutput = document.getElementById('linearRegressionInsightsOutput');
const linearRegressionInsightsText = document.getElementById('linearRegressionInsightsText');
const linearRegressionInsightsLoading = document.getElementById('linearRegressionInsightsLoading');

// Random Forest Regression Elements
const dependentVarSelectRF = document.getElementById('dependentVarSelectRF');
const independentVarsSelectRF = document.getElementById('independentVarsSelectRF');
const numEstimatorsRF = document.getElementById('numEstimatorsRF');
const runRandomForestBtn = document.getElementById('runRandomForestBtn');
const randomForestResultsOutput = document.getElementById('randomForestResultsOutput');
const randomForestResultsText = document.getElementById('randomForestResultsText');
const featureImportanceText = document.getElementById('featureImportanceText');
const getAIRandomForestInterpretationBtn = document.getElementById('getAIRandomForestInterpretationBtn');
const randomForestInsightsOutput = document.getElementById('randomForestInsightsOutput');
const randomForestInsightsText = document.getElementById('randomForestInsightsText');
const randomForestInsightsLoading = document.getElementById('randomForestInsightsLoading');


/**
 * Initializes the complex stats page.
 * This function is called when the DOM is fully loaded and after global data is potentially loaded.
 */
async function initializeComplexStatsPage() {
    console.log("[complex_stats.js] Initializing complex stats page...");

    // Wait for the global dataReadyPromise to ensure IndexedDB data is loaded
    await dataReadyPromise;

    // Attach event listeners
    if (calculateCorrelationBtn) {
        calculateCorrelationBtn.removeEventListener('click', handleCalculateCorrelation);
        calculateCorrelationBtn.addEventListener('click', handleCalculateCorrelation);
    }
    if (correlationOrderSelect) {
        correlationOrderSelect.removeEventListener('change', handleCorrelationOrderChange);
        correlationOrderSelect.addEventListener('change', handleCorrelationOrderChange);
    }
    if (getAICorrelationInterpretationBtn) {
        getAICorrelationInterpretationBtn.removeEventListener('click', handleGetAICorrelationInterpretation);
        getAICorrelationInterpretationBtn.addEventListener('click', handleGetAICorrelationInterpretation);
    }

    if (runRegressionBtn) {
        runRegressionBtn.removeEventListener('click', handleRunLinearRegression);
        runRegressionBtn.addEventListener('click', handleRunLinearRegression);
    }
    if (getAILinearRegressionInterpretationBtn) {
        getAILinearRegressionInterpretationBtn.removeEventListener('click', handleGetAILinearRegressionInterpretation);
        getAILinearRegressionInterpretationBtn.addEventListener('click', handleGetAILinearRegressionInterpretation);
    }

    if (runRandomForestBtn) {
        runRandomForestBtn.removeEventListener('click', handleRunRandomForest);
        runRandomForestBtn.addEventListener('click', handleRunRandomForest);
    }
    if (getAIRandomForestInterpretationBtn) {
        getAIRandomForestInterpretationBtn.removeEventListener('click', handleGetAIRandomForestInterpretation);
        getAIRandomForestInterpretationBtn.addEventListener('click', handleGetAIRandomForestInterpretation);
    }

    // Listen for custom event indicating data has been updated (e.g., new file uploaded)
    document.removeEventListener('dataUpdated', handleDataUpdated); // Prevent duplicates
    document.addEventListener('dataUpdated', handleDataUpdated);

    // Listen for custom event indicating data has been cleared
    document.removeEventListener('dataCleared', handleDataCleared); // Prevent duplicates
    document.addEventListener('dataCleared', handleDataCleared);

    // Initial render based on currently loaded data
    await renderComplexStatsPageUI();
}

/**
 * Handles the custom 'dataUpdated' event, re-rendering UI elements that depend on data.
 */
async function handleDataUpdated() {
    console.log("[complex_stats.js] Data updated event received. Re-rendering UI.");
    await renderComplexStatsPageUI();
}

/**
 * Handles the custom 'dataCleared' event, resetting UI elements.
 */
async function handleDataCleared() {
    console.log("[complex_stats.js] Data cleared event received. Resetting UI.");
    fileNameDisplay.textContent = 'No file loaded. Please upload a CSV/Excel file on the Home page.';
    complexStatsControlsSection.classList.add('hidden');

    // Clear correlation elements
    if (correlationColumnsSelect) correlationColumnsSelect.innerHTML = '';
    correlationMatrixOutput.classList.add('hidden');
    correlationInsightsOutput.classList.add('hidden');
    correlationInsightsText.textContent = '';
    correlationMatrixContainer.innerHTML = '';

    // Clear MLR elements
    if (dependentVarSelectMLR) dependentVarSelectMLR.innerHTML = '';
    if (independentVarsSelectMLR) independentVarsSelectMLR.innerHTML = '';
    regressionResultsOutput.classList.add('hidden');
    linearRegressionInsightsOutput.classList.add('hidden');
    regressionResultsText.textContent = '';
    linearRegressionInsightsText.textContent = '';

    // Clear RF elements
    if (dependentVarSelectRF) dependentVarSelectRF.innerHTML = '';
    if (independentVarsSelectRF) independentVarsSelectRF.innerHTML = '';
    randomForestResultsOutput.classList.add('hidden');
    randomForestInsightsOutput.classList.add('hidden');
    randomForestResultsText.textContent = '';
    featureImportanceText.textContent = '';
    randomForestInsightsText.textContent = '';
}


/**
 * Renders the UI elements on the complex stats page based on whether data is loaded.
 */
async function renderComplexStatsPageUI() {
    if (parsedData && parsedData.length > 0) {
        fileNameDisplay.textContent = `File: ${localStorage.getItem('csvPlotterFileName') || 'Unnamed File'}`;
        complexStatsControlsSection.classList.remove('hidden');

        // Populate selects for correlation, MLR, and RF
        populateAxisSelects(parsedData, headers, null, null, null, null, null, null,
            dependentVarSelectMLR, independentVarsSelectMLR, dependentVarSelectRF, independentVarsSelectRF, correlationColumnsSelect);

    } else {
        fileNameDisplay.textContent = 'No file loaded. Please upload a CSV/Excel file on the Home page.';
        complexStatsControlsSection.classList.add('hidden');
        correlationMatrixOutput.classList.add('hidden');
        regressionResultsOutput.classList.add('hidden');
        randomForestResultsOutput.classList.add('hidden');
    }
}


/**
 * Performs Multiple Linear Regression and displays results.
 * @param {Array<Object>} data - The dataset.
 * @param {string} dependentVar - The name of the dependent variable.
 * @param {Array<string>} independentVars - The names of the independent variables.
 */
async function performMultipleLinearRegression(data, dependentVar, independentVars) {
    if (data.length === 0) {
        showUIMessageBox("No data available to perform regression.");
        return;
    }

    // Filter out non-numeric values and ensure all selected columns are present
    const regressionData = data.map(row => {
        const newRow = {};
        let isValid = true;
        const allVars = [dependentVar, ...independentVars];
        for (const col of allVars) {
            const value = row[col];
            if (typeof value !== 'number' || isNaN(value)) {
                isValid = false;
                break;
            }
            newRow[col] = value;
        }
        return isValid ? newRow : null;
    }).filter(row => row !== null);

    if (regressionData.length < independentVars.length + 1) {
        showUIMessageBox("Not enough valid numeric data rows to perform regression with the selected variables. Ensure all selected columns are numeric and have sufficient data.");
        regressionResultsOutput.classList.add('hidden');
        return;
    }

    regressionResultsOutput.classList.remove('hidden');
    regressionResultsText.textContent = 'Calculating...';
    linearRegressionInsightsOutput.classList.add('hidden'); // Hide insights during recalculation
    linearRegressionInsightsText.textContent = '';
    linearRegressionInsightsLoading.classList.add('hidden'); // Ensure hidden

    try {
        const payload = {
            dataframe: regressionData, // Pass as 'dataframe' for consistency with Flask
            dependent_var: dependentVar,
            independent_vars: independentVars
        };

        // --- Call to Render Flask backend ---
        const apiUrl = `${BACKEND_URL}/run_linear_regression`; // Correct endpoint for Flask

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Backend error: ${response.status} ${response.statusText} - ${errorData.detail || errorData.error || JSON.stringify(errorData)}`);
        }

        const result = await response.json();
        console.log("Regression Results:", result);

        let resultsString = `Dependent Variable: ${dependentVar}\n`;
        resultsString += `Independent Variables: ${independentVars.join(', ')}\n\n`;
        resultsString += `R-squared: ${result.r_squared.toFixed(4)}\n`;
        resultsString += `Adjusted R-squared: ${result.adj_r_squared.toFixed(4)}\n`;
        resultsString += `F-statistic: ${result.f_statistic.toFixed(2)} (p-value: ${result.f_p_value.toExponential(2)})\n\n`;

        resultsString += `Coefficients:\n`;
        // Assuming coefficients come back as an object with variable names as keys
        if (result.coefficients) {
            for (const [key, value] of Object.entries(result.coefficients)) {
                resultsString += `  ${key}: ${value.toFixed(4)}\n`;
            }
        } else if (result.parameters) { // If backend returns 'parameters' as array
             result.parameters.forEach(param => {
                 resultsString += `  ${param.Variable}: ${param.Coefficient.toFixed(4)}\n`;
             });
        }
        
        // The intercept might be a separate field or part of coefficients
        // if (result.intercept) {
        //     resultsString += `\nIntercept: ${result.intercept.toFixed(4)}\n`;
        // }


        regressionResultsText.textContent = resultsString;
        getAILinearRegressionInterpretationBtn.classList.remove('hidden');

    } catch (error) {
        console.error("Error performing linear regression:", error);
        regressionResultsText.textContent = `Failed to perform linear regression: ${error.message}. Please check your data and selected columns.`;
        getAILinearRegressionInterpretationBtn.classList.add('hidden');
    }
}

/**
 * Performs Random Forest Regression and displays results.
 * @param {Array<Object>} data - The dataset.
 * @param {string} dependentVar - The name of the dependent variable.
 * @param {Array<string>} independentVars - The names of the independent variables.
 * @param {number} numEstimators - Number of trees in the forest.
 */
async function performRandomForestRegression(data, dependentVar, independentVars, numEstimators) {
    if (data.length === 0) {
        showUIMessageBox("No data available to perform Random Forest Regression.");
        return;
    }

    // Filter out non-numeric values and ensure all selected columns are present
    const rfData = data.map(row => {
        const newRow = {};
        let isValid = true;
        const allVars = [dependentVar, ...independentVars];
        for (const col of allVars) {
            const value = row[col];
            if (typeof value !== 'number' || isNaN(value)) {
                isValid = false;
                break;
            }
            newRow[col] = value;
        }
        return isValid ? newRow : null;
    }).filter(row => row !== null);

    if (rfData.length < independentVars.length + 1) {
        showUIMessageBox("Not enough valid numeric data rows to perform Random Forest Regression with the selected variables. Ensure all selected columns are numeric and have sufficient data.");
        randomForestResultsOutput.classList.add('hidden');
        return;
    }

    randomForestResultsOutput.classList.remove('hidden');
    randomForestResultsText.textContent = 'Calculating...';
    featureImportanceText.textContent = '';
    randomForestInsightsOutput.classList.add('hidden'); // Hide insights during recalculation
    randomForestInsightsText.textContent = '';
    randomForestInsightsLoading.classList.add('hidden'); // Ensure hidden


    try {
        const payload = {
            dataframe: rfData, // Pass as 'dataframe' for consistency with Flask
            dependent_var: dependentVar,
            independent_vars: independentVars,
            n_estimators: numEstimators
        };

        // --- Call to Render Flask backend ---
        const apiUrl = `${BACKEND_URL}/run_random_forest`; // Correct endpoint for Flask

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Backend error: ${response.status} ${response.statusText} - ${errorData.detail || errorData.error || JSON.stringify(errorData)}`);
        }

        const result = await response.json();
        console.log("Random Forest Results:", result);

        randomForestResultsText.textContent = `R-squared: ${result.r_squared.toFixed(4)}\n`; // Use result.r_squared as per backend
        randomForestResultsText.textContent += `Mean Absolute Error (MAE): ${result.mae.toFixed(4)}\n`;
        randomForestResultsText.textContent += `Mean Squared Error (MSE): ${result.mse.toFixed(4)}\n`;
        randomForestResultsText.textContent += `Root Mean Squared Error (RMSE): ${result.rmse.toFixed(4)}\n`;

        let importanceString = '';
        if (result.feature_importances && Object.keys(result.feature_importances).length > 0) {
            importanceString += 'Feature Importances:\n';
            // Sort feature importances for better readability
            const sortedImportances = Object.entries(result.feature_importances)
                .sort(([, a], [, b]) => b - a); // Sort descending by importance

            sortedImportances.forEach(([feature, importance]) => {
                importanceString += `  ${feature}: ${importance.toFixed(4)}\n`;
            });
        } else {
            importanceString = 'No feature importances available.';
        }
        featureImportanceText.textContent = importanceString;
        getAIRandomForestInterpretationBtn.classList.remove('hidden');

    } catch (error) {
        console.error("Error performing Random Forest Regression:", error);
        randomForestResultsText.textContent = `Failed to perform Random Forest Regression: ${error.message}. Please check your data and selected columns.`;
        featureImportanceText.textContent = '';
        getAIRandomForestInterpretationBtn.classList.add('hidden');
    }
}


/**
 * Displays the correlation matrix in a table.
 * @param {Array<Object>} data - The dataset.
 * @param {Array<string>} selectedColumns - The columns to include in the matrix.
 * @param {string} orderBy - 'alphabetical' or 'absolute' for sorting.
 */
function displayCorrelationMatrix(data, selectedColumns, orderBy) {
    if (selectedColumns.length < 2) {
        showUIMessageBox("Please select at least two numeric columns for correlation.");
        correlationMatrixOutput.classList.add('hidden');
        return;
    }

    // Filter data to only include selected numeric columns and valid rows
    const numericData = data.map(row => {
        const newRow = {};
        let isValid = true;
        selectedColumns.forEach(col => {
            const value = row[col];
            if (typeof value !== 'number' || isNaN(value)) {
                isValid = false;
            }
            newRow[col] = value;
        });
        return isValid ? newRow : null;
    }).filter(row => row !== null);

    if (numericData.length === 0) {
        showUIMessageBox("No valid numeric data found for the selected columns to calculate correlation.");
        correlationMatrixOutput.classList.add('hidden');
        return;
    }

    // Calculate correlation matrix (Pearson correlation)
    const correlationMatrix = {};
    selectedColumns.forEach(col1 => {
        correlationMatrix[col1] = {};
        selectedColumns.forEach(col2 => {
            if (col1 === col2) {
                correlationMatrix[col1][col2] = 1; // Correlation with itself is 1
            } else {
                const values1 = numericData.map(row => row[col1]);
                const values2 = numericData.map(row => row[col2]);
                correlationMatrix[col1][col2] = calculatePearsonCorrelation(values1, values2);
            }
        });
    });

    // Sort columns for display
    let sortedColumns = [...selectedColumns];
    if (orderBy === 'alphabetical') {
        sortedColumns.sort();
    } else if (orderBy === 'absolute' && selectedColumns.length > 1) {
        // Sort by average absolute correlation with other columns
        sortedColumns.sort((a, b) => {
            const avgAbsCorrA = selectedColumns.reduce((sum, col) => sum + Math.abs(correlationMatrix[a][col]), 0) / (selectedColumns.length - 1 || 1);
            const avgAbsCorrB = selectedColumns.reduce((sum, col) => sum + Math.abs(correlationMatrix[b][col]), 0) / (selectedColumns.length - 1 || 1);
            return avgAbsCorrB - avgAbsCorrA; // Descending
        });
    }

    // Render table
    let tableHtml = '<table class="min-w-full divide-y divide-gray-200 shadow-md rounded-lg">';
    tableHtml += '<thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>';
    sortedColumns.forEach(col => {
        tableHtml += `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${col}</th>`;
    });
    tableHtml += '</tr></thead><tbody class="bg-white divide-y divide-gray-200">';

    sortedColumns.forEach(rowCol => {
        tableHtml += `<tr><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${rowCol}</td>`;
        sortedColumns.forEach(colCol => {
            const correlationValue = correlationMatrix[rowCol][colCol];
            const formattedValue = correlationValue !== undefined ? correlationValue.toFixed(4) : 'N/A';
            let cellClass = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';

            if (correlationValue > 0.7) {
                cellClass += ' bg-green-100'; // Strong positive
            } else if (correlationValue < -0.7) {
                cellClass += ' bg-red-100'; // Strong negative
            } else if (correlationValue > 0.3) {
                cellClass += ' bg-blue-50'; // Moderate positive
            } else if (correlationValue < -0.3) {
                cellClass += ' bg-orange-50'; // Moderate negative
            }
            tableHtml += `<td class="${cellClass}">${formattedValue}</td>`;
        });
        tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    correlationMatrixContainer.innerHTML = tableHtml;
    correlationMatrixOutput.classList.remove('hidden');
    getAICorrelationInterpretationBtn.classList.remove('hidden');
    correlationInsightsOutput.classList.add('hidden'); // Hide insights during recalculation
    correlationInsightsText.textContent = '';
    correlationInsightsLoading.classList.add('hidden'); // Ensure hidden
}

/**
 * Calculates Pearson correlation coefficient between two arrays.
 * @param {Array<number>} x - Array of numbers.
 * @param {Array<number>} y - Array of numbers.
 * @returns {number} Pearson correlation coefficient.
 */
function calculatePearsonCorrelation(x, y) {
    const n = x.length;
    if (n === 0 || n !== y.length) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
}

/**
 * Event handler for Calculate Correlation button click.
 */
function handleCalculateCorrelation() {
    if (parsedData.length === 0) {
        showUIMessageBox("Please upload a CSV/Excel file first.");
        return;
    }
    const selectedColumns = Array.from(correlationColumnsSelect.selectedOptions).map(option => option.value);
    const orderBy = correlationOrderSelect.value;

    displayCorrelationMatrix(parsedData, selectedColumns, orderBy);
}

/**
 * Event handler for Correlation Order Select change.
 */
function handleCorrelationOrderChange() {
    if (parsedData.length > 0 && correlationColumnsSelect && Array.from(correlationColumnsSelect.selectedOptions).length >= 2) {
        const selectedColumns = Array.from(correlationColumnsSelect.selectedOptions).map(option => option.value);
        const orderBy = correlationOrderSelect.value;
        displayCorrelationMatrix(parsedData, selectedColumns, orderBy);
    }
}

/**
 * Event handler for Run Linear Regression button click.
 */
function handleRunLinearRegression() {
    if (parsedData.length === 0) {
        showUIMessageBox("Please upload a CSV/Excel file first.");
        return;
    }
    const dependentVar = dependentVarSelectMLR.value;
    const independentVars = Array.from(independentVarsSelectMLR.selectedOptions).map(option => option.value);

    if (!dependentVar || independentVars.length === 0) {
        showUIMessageBox("Please select a dependent variable and at least one independent variable for linear regression.");
        return;
    }

    // Ensure dependent variable is not among independent variables
    const finalIndependentVars = independentVars.filter(col => col !== dependentVar);
    if (independentVars.length > 0 && finalIndependentVars.length === 0) {
        showUIMessageBox("Dependent variable cannot also be an independent variable. Please adjust your selection.");
        return;
    }

    performMultipleLinearRegression(parsedData, dependentVar, finalIndependentVars);
}

/**
 * Event handler for Run Random Forest button click.
 */
function handleRunRandomForest() {
    if (parsedData.length === 0) {
        showUIMessageBox("Please upload a CSV/Excel file first.");
        return;
    }
    const dependentVar = dependentVarSelectRF.value;
    const independentVars = Array.from(independentVarsSelectRF.selectedOptions).map(option => option.value);
    const numEstimators = parseInt(numEstimatorsRF.value, 10);

    if (!dependentVar || independentVars.length === 0) {
        showUIMessageBox("Please select a dependent variable and at least one independent variable for Random Forest Regression.");
        return;
    }
    if (isNaN(numEstimators) || numEstimators < 1) {
        showUIMessageBox("Please enter a valid number of estimators (trees) for Random Forest.");
        return;
    }

    // Ensure dependent variable is not among independent variables
    const finalIndependentVars = independentVars.filter(col => col !== dependentVar);
    if (independentVars.length > 0 && finalIndependentVars.length === 0) {
        showUIMessageBox("Dependent variable cannot also be an independent variable. Please adjust your selection.");
        return;
    }

    performRandomForestRegression(parsedData, dependentVar, finalIndependentVars, numEstimators);
}


/**
 * Handles getting AI interpretation for Correlation Matrix.
 */
async function handleGetAICorrelationInterpretation() {
    const correlationTable = correlationMatrixContainer.querySelector('table');
    if (!correlationTable) {
        showUIMessageBox("No correlation matrix displayed to interpret.");
        return;
    }

    correlationInsightsOutput.classList.remove('hidden');
    correlationInsightsText.textContent = '';
    correlationInsightsLoading.classList.remove('hidden'); // Show spinner

    try {
        // Extract correlation data from the displayed table for AI context
        const headers = Array.from(correlationTable.querySelectorAll('thead th')).slice(1).map(th => th.textContent);
        const matrixData = {};
        Array.from(correlationTable.querySelectorAll('tbody tr')).forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            const rowHeader = cells[0].textContent;
            matrixData[rowHeader] = {};
            cells.slice(1).forEach((cell, index) => {
                matrixData[rowHeader][headers[index]] = parseFloat(cell.textContent);
            });
        });

        const prompt = `Interpret the following correlation matrix. Identify strong positive and negative correlations, discuss any interesting relationships between variables, and provide actionable insights if possible.
        Correlation Matrix: ${JSON.stringify(matrixData)}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
            }
        };

        // --- Corrected Call to Render Flask backend proxy ---
        const apiUrl = `${BACKEND_URL}/generate_ai_insights`;

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
        // Expecting { insights: "..." } from the Flask backend proxy
        if (result.insights) {
            correlationInsightsText.textContent = result.insights;
        } else if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            correlationInsightsText.textContent = result.candidates[0].content.parts[0].text;
        } else {
            correlationInsightsText.textContent = "No insights could be generated by the backend for this correlation matrix.";
            console.warn("Unexpected backend API response structure:", result);
        }
    } catch (error) {
        console.error("Error fetching AI correlation insights:", error);
        correlationInsightsText.textContent = `Failed to get AI insights: ${error.message}. Please try again later.`;
    } finally {
        correlationInsightsLoading.classList.add('hidden'); // Hide spinner
    }
}

/**
 * Handles getting AI interpretation for Linear Regression results.
 */
async function handleGetAILinearRegressionInterpretation() {
    const regressionText = regressionResultsText.textContent;
    if (!regressionText) {
        showUIMessageBox("No linear regression results displayed to interpret.");
        return;
    }

    linearRegressionInsightsOutput.classList.remove('hidden');
    linearRegressionInsightsText.textContent = '';
    linearRegressionInsightsLoading.classList.remove('hidden'); // Show spinner

    try {
        const prompt = `Interpret the following Multiple Linear Regression results. Explain the R-squared, adjusted R-squared, F-statistic, and the meaning of the coefficients. Discuss the significance of the model and individual variables.
        Linear Regression Results:\n${regressionText}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
            }
        };

        // --- Corrected Call to Render Flask backend proxy ---
        const apiUrl = `${BACKEND_URL}/generate_ai_insights`;

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
        // Expecting { insights: "..." } from the Flask backend proxy
        if (result.insights) {
            linearRegressionInsightsText.textContent = result.insights;
        } else if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            linearRegressionInsightsText.textContent = result.candidates[0].content.parts[0].text;
        } else {
            linearRegressionInsightsText.textContent = "No insights could be generated by the backend for these linear regression results.";
            console.warn("Unexpected backend API response structure:", result);
        }
    } catch (error) {
        console.error("Error fetching AI linear regression insights:", error);
        linearRegressionInsightsText.textContent = `Failed to get AI insights: ${error.message}. Please try again later.`;
    } finally {
        linearRegressionInsightsLoading.classList.add('hidden'); // Hide spinner
    }
}

/**
 * Handles getting AI interpretation for Random Forest Regression results.
 */
async function handleGetAIRandomForestInterpretation() {
    const rfResultsText = randomForestResultsText.textContent;
    const featureImpText = featureImportanceText.textContent;
    if (!rfResultsText && !featureImpText) {
        showUIMessageBox("No Random Forest Regression results displayed to interpret.");
        return;
    }

    randomForestInsightsOutput.classList.remove('hidden');
    randomForestInsightsText.textContent = '';
    randomForestInsightsLoading.classList.remove('hidden'); // Show spinner

    try {
        const prompt = `Interpret the following Random Forest Regression results and feature importances. Explain the R-squared, MAE, MSE, RMSE, and the significance of feature importances. Discuss what these results imply about the relationships in the data.
        Random Forest Regression Results:\n${rfResultsText}\n\n${featureImpText}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
            }
        };

        // --- Corrected Call to Render Flask backend proxy ---
        const apiUrl = `${BACKEND_URL}/generate_ai_insights`;

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
        // Expecting { insights: "..." } from the Flask backend proxy
        if (result.insights) {
            randomForestInsightsText.textContent = result.insights;
        } else if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            randomForestInsightsText.textContent = result.candidates[0].content.parts[0].text;
        } else {
            randomForestInsightsText.textContent = "No insights could be generated by the backend for these Random Forest results.";
            console.warn("Unexpected backend API response structure:", result);
        }
    } catch (error) {
        console.error("Error fetching AI Random Forest insights:", error);
        randomForestInsightsText.textContent = `Failed to get AI insights: ${error.message}. Please try again later.`;
    } finally {
        randomForestInsightsLoading.classList.add('hidden'); // Hide spinner
    }
}

// Attach the initialization function to the DOMContentLoaded event
window.addEventListener('DOMContentLoaded', initializeComplexStatsPage);
