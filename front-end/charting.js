// charting.js

// Import necessary utility functions and data handlers
import { showMessageBox } from './ui-components.js';
import {
    saveSavedChart,
    loadSavedCharts,
    deleteSavedChartById,
    parsedData,
    headers
} from './data-handlers.js';

// Export myChartCanvas so it can be accessed globally (e.g., by main.js for saving/exporting)
export let myChartCanvas = {
    chartInstance: null, 
    chartConfig: null,   
    canvasElement: null  
};

let viewedSavedChartInstance = null; 
export let myDistributionChart = null; 
export let myPredictionChart = null; 

/**
 * Clears all active Chart.js instances.
 */
export function clearChartInstances() {
    if (myChartCanvas.chartInstance) {
        myChartCanvas.chartInstance.destroy();
        myChartCanvas.chartInstance = null;
        myChartCanvas.chartConfig = null;
    }
    if (viewedSavedChartInstance) {
        viewedSavedChartInstance.destroy();
        viewedSavedChartInstance = null;
    }
    if (myDistributionChart instanceof Chart) { 
        myDistributionChart.destroy();
        myDistributionChart = null;
    }
    if (myPredictionChart instanceof Chart) { 
        myPredictionChart.destroy();
        myPredictionChart = null;
    }
}

/**
 * Populates select dropdowns for X and Y axes with available data headers.
 * Filters out non-numeric columns for Y-axis and ensures date columns are available for X-axis if needed.
 * @param {Array<Object>} data - The dataset to populate the selects from.
 * @param {Array<string>} hdrs - The array of headers.
 * @param {HTMLElement} xAxisSelect - The select element for the X-axis.
 * @param {HTMLElement} yAxisSelect - The select element for the Y-axis.
 * @param {HTMLElement} [dateColumnSelect] - Optional: The select element for date column (for time series).
 * @param {HTMLElement} [predictionColumnSelect] - Optional: The select element for prediction column (for time series).
 * @param {HTMLElement} [groupByColumnSelect] - Optional: The select element for group by column (for reporting).
 * @param {HTMLElement} [chartFilterColumnSelect] - Optional: The select element for chart filter column (for reporting/time-series).
 * @param {HTMLElement} [dependentVarSelectMLR] - Optional: The select element for MLR dependent variable.
 * @param {HTMLElement} [independentVarsSelectMLR] - Optional: The select element for MLR independent variables.
 * @param {HTMLElement} [dependentVarSelectRF] - Optional: The select element for RF dependent variable.
 * @param {HTMLElement} [independentVarsSelectRF] - Optional: The select element for RF independent variables.
 * @param {HTMLElement} [correlationColumnsSelect] - Optional: The select element for correlation columns.
 */
export function populateAxisSelects(data, hdrs, xAxisSelect, yAxisSelect, dateColumnSelect = null, predictionColumnSelect = null, groupByColumnSelect = null, chartFilterColumnSelect = null, dependentVarSelectMLR = null, independentVarsSelectMLR = null, dependentVarSelectRF = null, independentVarsSelectRF = null, correlationColumnsSelect = null) {
    if (!hdrs || hdrs.length === 0) {
        console.warn("[Charting] No headers available to populate axis selects.");
        return;
    }

    // Clear existing options
    const selectsToClear = [xAxisSelect, yAxisSelect, dateColumnSelect, predictionColumnSelect, groupByColumnSelect, chartFilterColumnSelect, dependentVarSelectMLR, independentVarsSelectMLR, dependentVarSelectRF, independentVarsSelectRF, correlationColumnsSelect];
    selectsToClear.forEach(select => {
        if (select) {
            select.innerHTML = '';
            // Add a default "Select a column" option for single-selects
            if (!select.multiple) {
                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.textContent = "Select a column";
                defaultOption.disabled = true;
                defaultOption.selected = true;
                select.appendChild(defaultOption);
            }
        }
    });

    const firstRow = data[0] || {};

    hdrs.forEach(header => {
        const optionX = document.createElement('option');
        optionX.value = header;
        optionX.textContent = header;
        if (xAxisSelect) xAxisSelect.appendChild(optionX);

        // Check if the column is numeric for Y-axis, MLR, RF, Correlation
        const isNumeric = data.length > 0 && typeof firstRow[header] === 'number';

        if (yAxisSelect && isNumeric) {
            const optionY = document.createElement('option');
            optionY.value = header;
            optionY.textContent = header;
            yAxisSelect.appendChild(optionY);
        }

        // For date column select (time series)
        // A simple check for now, can be improved with more robust date detection
        const isDateColumn = data.length > 0 && (
            (typeof firstRow[header] === 'string' && (new Date(firstRow[header])).toString() !== 'Invalid Date') ||
            (typeof firstRow[header] === 'number' && String(firstRow[header]).length === 5 && firstRow[header] > 25569) // Excel date numbers after 1970
        );

        if (dateColumnSelect && isDateColumn) {
            const optionDate = document.createElement('option');
            optionDate.value = header;
            optionDate.textContent = header;
            dateColumnSelect.appendChild(optionDate);
        }

        // For prediction column (time series) - must be numeric
        if (predictionColumnSelect && isNumeric) {
            const optionPred = document.createElement('option');
            optionPred.value = header;
            optionPred.textContent = header;
            predictionColumnSelect.appendChild(optionPred);
        }

        // For group by column (reporting) - can be any type
        if (groupByColumnSelect) {
            const optionGroup = document.createElement('option');
            optionGroup.value = header;
            optionGroup.textContent = header;
            groupByColumnSelect.appendChild(optionGroup);
        }

        // For chart filter column (reporting/time-series) - can be any type
        if (chartFilterColumnSelect) {
            const optionFilter = document.createElement('option');
            optionFilter.value = header;
            optionFilter.textContent = header;
            chartFilterColumnSelect.appendChild(optionFilter);
        }

        // For MLR dependent variable (numeric)
        if (dependentVarSelectMLR && isNumeric) {
            const optionDepMLR = document.createElement('option');
            optionDepMLR.value = header;
            optionDepMLR.textContent = header;
            dependentVarSelectMLR.appendChild(optionDepMLR);
        }

        // For MLR independent variables (numeric)
        if (independentVarsSelectMLR && isNumeric) {
            const optionIndepMLR = document.createElement('option');
            optionIndepMLR.value = header;
            optionIndepMLR.textContent = header;
            independentVarsSelectMLR.appendChild(optionIndepMLR);
        }

        // For RF dependent variable (numeric)
        if (dependentVarSelectRF && isNumeric) {
            const optionDepRF = document.createElement('option');
            optionDepRF.value = header;
            optionDepRF.textContent = header;
            dependentVarSelectRF.appendChild(optionDepRF);
        }

        // For RF independent variables (numeric)
        if (independentVarsSelectRF && isNumeric) {
            const optionIndepRF = document.createElement('option');
            optionIndepRF.value = header;
            optionIndepRF.textContent = header;
            independentVarsSelectRF.appendChild(optionIndepRF);
        }

        // For correlation columns (numeric)
        if (correlationColumnsSelect && isNumeric) {
            const optionCorr = document.createElement('option');
            optionCorr.value = header;
            optionCorr.textContent = header;
            correlationColumnsSelect.appendChild(optionCorr);
        }
    });
}

/**
 * Populates a filter value select dropdown based on unique values in a given column.
 * @param {Array<Object>} data - The dataset.
 * @param {string} columnHeader - The header of the column to get unique values from.
 * @param {HTMLElement} filterValueSelect - The select element to populate.
 */
export function populateFilterValueSelect(data, columnHeader, filterValueSelect) {
    if (!filterValueSelect) return;

    filterValueSelect.innerHTML = '<option value="">All Values</option>'; // Always add "All Values" option

    if (!columnHeader || !data || data.length === 0) {
        return;
    }

    const uniqueValues = [...new Set(data.map(row => row[columnHeader]))].sort();

    uniqueValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        filterValueSelect.appendChild(option);
    });
}


/**
 * Aggregates data based on the chosen Y-axis aggregation method.
 * @param {Array<Object>} data - The dataset to aggregate.
 * @param {string} xAxisCol - The column used for the X-axis (grouping key).
 * @param {string} yAxisCol - The column to aggregate.
 * @param {string} aggregationType - The type of aggregation (sum, average, count, min, max, median, mode).
 * @returns {Object} An object with `labels` and `values` for charting.
 */
function aggregateData(data, xAxisCol, yAxisCol, aggregationType) {
    const aggregated = {};

    data.forEach(row => {
        const xValue = row[xAxisCol];
        const yValue = row[yAxisCol];

        if (xValue === undefined || yValue === undefined || yValue === null || (typeof yValue === 'number' && isNaN(yValue))) {
            return; // Skip rows with missing or invalid data for the selected columns
        }

        if (!aggregated[xValue]) {
            aggregated[xValue] = [];
        }
        if (typeof yValue === 'number') {
            aggregated[xValue].push(yValue);
        } else if (aggregationType === 'count') {
             // For count, we can count non-numeric values too
            aggregated[xValue].push(1);
        }
    });

    const labels = Object.keys(aggregated).sort((a, b) => {
        // Attempt to sort numerically if possible, otherwise alphabetically
        if (!isNaN(Number(a)) && !isNaN(Number(b))) {
            return Number(a) - Number(b);
        }
        return String(a).localeCompare(String(b));
    });

    const values = labels.map(label => {
        const dataPoints = aggregated[label];
        if (dataPoints.length === 0) return 0; // Should not happen if filtered invalid values earlier

        switch (aggregationType) {
            case 'sum':
                return dataPoints.reduce((a, b) => a + b, 0);
            case 'average':
                return dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
            case 'count':
                return dataPoints.length; // Already pushed 1 for each valid item
            case 'min':
                return Math.min(...dataPoints);
            case 'max':
                return Math.max(...dataPoints);
            case 'median':
                const sorted = [...dataPoints].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
            case 'mode':
                const counts = {};
                let maxCount = 0;
                let mode = dataPoints[0];
                for (const val of dataPoints) {
                    counts[val] = (counts[val] || 0) + 1;
                    if (counts[val] > maxCount) {
                        maxCount = counts[val];
                        mode = val;
                    }
                }
                return mode;
            default:
                return 0;
        }
    });

    return { labels, values };
}

/**
 * Draws a chart on the specified canvas.
 * @param {Object[]} data - The dataset to plot.
 * @param {string} xAxisCol - The header for the X-axis.
 * @param {string} yAxisCol - The header for the Y-axis.
 * @param {string} chartType - The type of chart (bar, line, pie, doughnut, polarArea, scatter).
 * @param {HTMLCanvasElement} canvasElement - The canvas DOM element to draw on.
 * @param {string} yAxisAggregation - The aggregation type for the Y-axis (sum, average, count, min, max, median, mode).
 * @param {string} [filterColumn=null] - Optional column to filter data by.
 * @param {string} [filterValue=null] - Optional value to filter data by.
 */
export function drawChart(data, xAxisCol, yAxisCol, chartType, canvasElement, yAxisAggregation, filterColumn = null, filterValue = null) {
    if (!canvasElement) {
        console.error("[Charting] Canvas element not found.");
        showMessageBox("Error: Chart canvas not found.");
        return;
    }

    if (!data || data.length === 0) {
        showMessageBox("No data available to plot. Please upload a file.");
        return;
    }

    // Filter data if filterColumn and filterValue are provided
    let filteredData = data;
    if (filterColumn && filterValue !== null && filterValue !== undefined && filterValue !== "") {
        filteredData = data.filter(row => String(row[filterColumn]) === String(filterValue));
        if (filteredData.length === 0) {
            showMessageBox(`No data found for filter: ${filterColumn} = ${filterValue}`);
            return;
        }
    }


    const ctx = canvasElement.getContext('2d');

    // Destroy existing chart instance if it exists on this canvas
    if (myChartCanvas.chartInstance && myChartCanvas.canvasElement === canvasElement) {
        myChartCanvas.chartInstance.destroy();
    } else if (viewedSavedChartInstance && viewedSavedChartInstance.canvas === canvasElement) {
        viewedSavedChartInstance.destroy();
    } else if (myDistributionChart instanceof Chart && myDistributionChart.canvas === canvasElement) {
        myDistributionChart.destroy();
    } else if (myPredictionChart instanceof Chart && myPredictionChart.canvas === canvasElement) {
        myPredictionChart.destroy();
    }


    const { labels, values } = aggregateData(filteredData, xAxisCol, yAxisCol, yAxisAggregation);

    if (labels.length === 0 || values.length === 0) {
        showMessageBox("Not enough valid data to plot with the selected columns and aggregation.");
        return;
    }

    let chartConfig;

    const commonChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US').format(context.parsed.y);
                        }
                        return label;
                    }
                }
            },
            legend: {
                display: chartType !== 'pie' && chartType !== 'doughnut' && chartType !== 'polarArea',
                position: 'top',
            },
            title: {
                display: true,
                text: `${yAxisAggregation.charAt(0).toUpperCase() + yAxisAggregation.slice(1)} of ${yAxisCol} by ${xAxisCol}`,
                color: '#06f7f7', // Consistent title color
                font: {
                    size: 16
                }
            }
        },
        scales: {
            x: {
                display: chartType !== 'pie' && chartType !== 'doughnut' && chartType !== 'polarArea',
                title: {
                    display: true,
                    text: xAxisCol,
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
                display: chartType !== 'pie' && chartType !== 'doughnut' && chartType !== 'polarArea',
                title: {
                    display: true,
                    text: `${yAxisAggregation.charAt(0).toUpperCase() + yAxisAggregation.slice(1)} of ${yAxisCol}`,
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
    };

    const backgroundColors = [
        'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
        'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(201, 203, 207, 0.8)',
        'rgba(255, 205, 86, 0.8)', 'rgba(70, 130, 180, 0.8)', 'rgba(60, 179, 113, 0.8)',
        'rgba(218, 112, 214, 0.8)'
    ];
    const borderColors = [
        'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)',
        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(201, 203, 207, 1)',
        'rgba(255, 205, 86, 1)', 'rgba(70, 130, 180, 1)', 'rgba(60, 179, 113, 1)',
        'rgba(218, 112, 214, 1)'
    ];

    switch (chartType) {
        case 'bar':
        case 'line':
            chartConfig = {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: [{
                        label: `${yAxisAggregation.charAt(0).toUpperCase() + yAxisAggregation.slice(1)} of ${yAxisCol}`,
                        data: values,
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 1,
                        fill: chartType === 'line' ? false : true, // Fill area for line charts
                        tension: chartType === 'line' ? 0.3 : 0 // Smooth lines
                    }]
                },
                options: commonChartOptions
            };
            break;
        case 'pie':
        case 'doughnut':
        case 'polarArea':
            chartConfig = {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: [{
                        label: `${yAxisAggregation.charAt(0).toUpperCase() + yAxisAggregation.slice(1)} of ${yAxisCol}`,
                        data: values,
                        backgroundColor: backgroundColors.slice(0, labels.length), // Use enough colors
                        borderColor: borderColors.slice(0, labels.length),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: commonChartOptions.plugins.tooltip,
                        legend: {
                            position: 'right', // Legend for pie/doughnut/polarArea
                            labels: {
                                color: '#06c8fe' // Legend text color
                            }
                        },
                        title: commonChartOptions.plugins.title
                    }
                }
            };
            break;
        case 'scatter':
            // For scatter, we need raw data points, not aggregated
            // Assuming X-axis and Y-axis are both numeric for scatter
            const scatterDataPoints = filteredData.map(row => ({
                x: row[xAxisCol],
                y: row[yAxisCol]
            })).filter(point => typeof point.x === 'number' && typeof point.y === 'number' && !isNaN(point.x) && !isNaN(point.y));

            chartConfig = {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: `${yAxisCol} vs ${xAxisCol}`,
                        data: scatterDataPoints,
                        backgroundColor: 'rgba(75, 192, 192, 0.8)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                        pointRadius: 5
                    }]
                },
                options: commonChartOptions
            };
            break;
        default:
            showMessageBox("Unsupported chart type selected.");
            return;
    }

    // Assign the new chart instance and config to the global myChartCanvas object
    myChartCanvas.chartInstance = new Chart(ctx, chartConfig);
    myChartCanvas.chartConfig = chartConfig;
    myChartCanvas.canvasElement = canvasElement;

    // Show the canvas if it was hidden
    canvasElement.closest('div').classList.remove('hidden');
}


/**
 * Draws a distribution chart for a given column on the specified canvas.
 * This is typically a bar chart showing frequency for categorical or binned data.
 * @param {Array<Object>} data - The dataset.
 * @param {string} columnHeader - The column to draw the distribution for.
 * @param {HTMLCanvasElement} canvasElement - The canvas DOM element.
 */
export function drawColumnDistributionChart(data, columnHeader, canvasElement = document.getElementById('myDistributionChartCanvas')) {
    if (!canvasElement) {
        console.error("[Charting] Distribution canvas element not found.");
        showMessageBox("Error: Distribution chart canvas not found.");
        return;
    }

    if (!data || data.length === 0 || !columnHeader) {
        // showMessageBox("No data or column selected for distribution plot."); // Avoid spamming if initial load
        return;
    }

    const ctx = canvasElement.getContext('2d');

    // Destroy existing distribution chart instance if it exists
    if (myDistributionChart instanceof Chart) {
        myDistributionChart.destroy();
    }

    const valueCounts = {};
    data.forEach(row => {
        const value = row[columnHeader];
        if (value !== undefined && value !== null && value !== '') {
            valueCounts[value] = (valueCounts[value] || 0) + 1;
        }
    });

    const labels = Object.keys(valueCounts).sort((a, b) => {
        // Attempt numeric sort, fallback to alphabetical
        if (!isNaN(Number(a)) && !isNaN(Number(b))) {
            return Number(a) - Number(b);
        }
        return String(a).localeCompare(String(b));
    });
    const values = labels.map(label => valueCounts[label]);

    if (labels.length === 0) {
        showMessageBox(`No valid data found for distribution of column: ${columnHeader}`);
        return;
    }

    const backgroundColors = [
        'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
        'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(201, 203, 207, 0.8)',
        'rgba(255, 205, 86, 0.8)', 'rgba(70, 130, 180, 0.8)', 'rgba(60, 179, 113, 0.8)',
        'rgba(218, 112, 214, 0.8)'
    ];
    const borderColors = [
        'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)',
        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(201, 203, 207, 1)',
        'rgba(255, 205, 86, 1)', 'rgba(70, 130, 180, 1)', 'rgba(60, 179, 113, 1)',
        'rgba(218, 112, 214, 1)'
    ];


    myDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Frequency of ${columnHeader}`,
                data: values,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: `Distribution of ${columnHeader}`,
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
                        text: columnHeader,
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
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count',
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

    // Show the canvas if it was hidden
    canvasElement.closest('div').classList.remove('hidden');
}


/**
 * Renders the table of saved charts.
 * @param {HTMLElement} tableBodyElement - The tbody element of the table.
 * @param {Function} loadChartCallback - Callback function to load a specific chart.
 * @param {Function} deleteChartCallback - Callback function to delete a specific chart.
 * @param {string} pageTag - The tag for the current page (e.g., 'home', 'reporting').
 */
export async function renderSavedChartsTable(tableBodyElement, loadChartCallback, deleteChartCallback, pageTag) {
    if (!tableBodyElement) {
        console.error("[Charting] Saved graphs table body element not found.");
        return;
    }

    tableBodyElement.innerHTML = ''; // Clear existing rows
    const savedCharts = await loadSavedCharts();

    // Filter charts to show only those saved on the current page
    const pageSpecificCharts = savedCharts.filter(chart => chart.chartConfig && chart.chartConfig.page === pageTag);

    if (pageSpecificCharts.length === 0) {
        const noChartsRow = document.createElement('tr');
        noChartsRow.innerHTML = `<td colspan="4" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No saved graphs for this page yet.</td>`;
        tableBodyElement.appendChild(noChartsRow);
        // Hide the whole section if no charts are present for this page
        const savedGraphsSection = document.getElementById('savedGraphsSection');
        if (savedGraphsSection) savedGraphsSection.classList.add('hidden');
        return;
    }

    // Show the whole section if charts are present
    const savedGraphsSection = document.getElementById('savedGraphsSection');
    if (savedGraphsSection) savedGraphsSection.classList.remove('hidden');

    pageSpecificCharts.forEach(chart => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${chart.description}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${chart.chartConfig.chartType}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(chart.dateSaved).toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button data-chart-id="${chart.id}" class="view-chart-btn text-indigo-600 hover:text-indigo-900 mr-2">View</button>
                <button data-chart-id="${chart.id}" class="delete-chart-btn text-red-600 hover:text-red-900">Delete</button>
            </td>
        `;
        tableBodyElement.appendChild(row);
    });

    // Attach event listeners to the new buttons
    tableBodyElement.querySelectorAll('.view-chart-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const chartId = parseInt(event.target.dataset.chartId);
            await loadChartCallback(chartId);
        });
    });

    tableBodyElement.querySelectorAll('.delete-chart-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const chartId = parseInt(event.target.dataset.chartId);
            const confirmDelete = await showMessageBox("Are you sure you want to delete this saved graph?", true);
            if (confirmDelete) {
                await deleteChartCallback(chartId);
                // Re-render the table after deletion
                await renderSavedChartsTable(tableBodyElement, loadChartCallback, deleteChartCallback, pageTag);
            }
        });
    });
}

/**
 * Loads a specific saved chart by its ID and displays it on the viewedSavedChartCanvas.
 * @param {number} chartId - The ID of the chart to load.
 */
export async function loadSavedChart(chartId) {
    try {
        const savedCharts = await loadSavedCharts();
        const chartToLoad = savedCharts.find(chart => chart.id === chartId);

        if (!chartToLoad) {
            showMessageBox("Saved chart not found.");
            return;
        }

        const viewedSavedGraphSection = document.getElementById('viewedSavedGraphSection');
        const viewedSavedChartCanvas = document.getElementById('viewedSavedChartCanvas');
        const viewedGraphDescription = document.getElementById('viewedGraphDescription');

        if (!viewedSavedGraphSection || !viewedSavedChartCanvas || !viewedGraphDescription) {
            console.error("[Charting] Missing DOM elements for viewing saved charts.");
            showMessageBox("Error: Required elements for viewing saved charts are missing.");
            return;
        }

        if (viewedSavedChartInstance) {
            viewedSavedChartInstance.destroy(); // Destroy previous instance
        }

        viewedSavedGraphSection.classList.remove('hidden');
        viewedGraphDescription.textContent = `Viewing: ${chartToLoad.description} (Saved on: ${new Date(chartToLoad.dateSaved).toLocaleString()})`;

        const ctx = viewedSavedChartCanvas.getContext('2d');

        // Recreate the chart using the saved config
        // Note: Chart.js config needs to be parsed if stored as a string or cloned to avoid reference issues
        const chartConfig = JSON.parse(JSON.stringify(chartToLoad.chartConfig.chartConfig)); // Access the nested chartConfig

        viewedSavedChartInstance = new Chart(ctx, chartConfig);
        console.log(`[Charting] Loaded and displayed saved chart with ID: ${chartId}`);

        // If on a main plotting page, hide the interactive chart section temporarily
        const mostRecentGraphSection = document.getElementById('mostRecentGraphSection');
        if (mostRecentGraphSection) mostRecentGraphSection.classList.add('hidden');

    } catch (error) {
        console.error("Error loading saved chart:", error);
        showMessageBox("Error loading saved chart. It might be corrupted or missing.");
    }
}
