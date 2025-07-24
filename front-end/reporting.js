// reporting.js
// This file contains logic specific to reporting.html, focusing on dynamic report generation and plotting.

import { populateAxisSelects, populateFilterValueSelect, drawChart, renderSavedChartsTable, loadSavedChart, myChartCanvas } from './charting.js';
import { showMessageBox, showPromptBox } from './ui-components.js';
import { parsedData, headers, deleteSavedChartById } from './data-handlers.js';
import { dataReadyPromise } from './main.js';

// --- IMPORTANT: Define your deployed backend proxy server URL here ---
const PROXY_SERVER_URL = 'https://reporting0and0analytics.vercel.app';

// --- DOM Elements specific to reporting.html ---
const fileNameDisplay = document.getElementById('fileNameDisplay');
const reportConfigurationSection = document.getElementById('reportConfigurationSection');
const groupByColumnSelect = document.getElementById('groupByColumnSelect');
const filterByValueSelect = document.getElementById('filterByValueSelect');
const generateReportBtn = document.getElementById('generateReportBtn');
const reportDisplaySection = document.getElementById('reportDisplaySection');
const reportDescription = document.getElementById('reportDescription');
const reportTable = document.getElementById('reportTable');
const reportTableHeader = document.getElementById('reportTableHeader');
const reportTableBody = document.getElementById('reportTableBody');
const exportReportPdfBtn = document.getElementById('exportReportPdfBtn');
const getAIReportInsightsBtn = document.getElementById('getAIReportInsightsBtn');
const reportInsightsOutput = document.getElementById('reportInsightsOutput');
const reportInsightsText = document.getElementById('reportInsightsText');
const reportInsightsLoading = document.getElementById('reportInsightsLoading');

const plottingControlsSection = document.getElementById('plottingControlsSection');
const xAxisSelect = document.getElementById('xAxisSelect');
const yAxisSelect = document.getElementById('yAxisSelect');
const chartTypeSelect = document.getElementById('chartTypeSelect');
const yAxisAggregationSelect = document.getElementById('yAxisAggregationSelect');
const chartFilterColumnSelect = document.getElementById('chartFilterColumnSelect');
const chartFilterValueSelect = document.getElementById('chartFilterValueSelect');
const plotGraphBtn = document.getElementById('plotGraphBtn');
const saveGraphBtn = document.getElementById('saveGraphBtn');
const exportGraphBtn = document.getElementById('exportGraphBtn');
const myChartCanvasElement = document.getElementById('myChartCanvas');

const savedGraphsTableBody = document.getElementById('savedGraphsTableBody');
const savedGraphsSection = document.getElementById('savedGraphsSection');
const viewedSavedGraphSection = document.getElementById('viewedSavedGraphSection');


let currentReportData = []; // To store the currently generated report data for PDF export


/**
 * Initializes the reporting page.
 * This function is called when the DOM is fully loaded and after global data is potentially loaded.
 */
async function initializeReportingPage() {
    console.log("[reporting.js] Initializing reporting page...");

    // Wait for the global dataReadyPromise to ensure IndexedDB data is loaded
    await dataReadyPromise;

    // Attach event listeners
    if (groupByColumnSelect) {
        groupByColumnSelect.removeEventListener('change', handleGroupByColumnChange);
        groupByColumnSelect.addEventListener('change', handleGroupByColumnChange);
    }
    if (generateReportBtn) {
        generateReportBtn.removeEventListener('click', handleGenerateReport);
        generateReportBtn.addEventListener('click', handleGenerateReport);
    }
    if (plotGraphBtn) {
        plotGraphBtn.removeEventListener('click', handlePlotGraph);
        plotGraphBtn.addEventListener('click', handlePlotGraph);
    }
    if (exportReportPdfBtn) {
        exportReportPdfBtn.removeEventListener('click', handleExportReportPdf);
        exportReportPdfBtn.addEventListener('click', handleExportReportPdf);
    }
    if (getAIReportInsightsBtn) {
        getAIReportInsightsBtn.removeEventListener('click', handleGetAIReportInsights);
        getAIReportInsightsBtn.addEventListener('click', handleGetAIReportInsights);
    }
    if (chartFilterColumnSelect) {
        chartFilterColumnSelect.removeEventListener('change', handleChartFilterColumnChange);
        chartFilterColumnSelect.addEventListener('change', handleChartFilterColumnChange);
    }


    // Listen for custom event indicating data has been updated (e.g., new file uploaded)
    document.removeEventListener('dataUpdated', handleDataUpdated); // Prevent duplicates
    document.addEventListener('dataUpdated', handleDataUpdated);

    // Listen for custom event indicating data has been cleared
    document.removeEventListener('dataCleared', handleDataCleared); // Prevent duplicates
    document.addEventListener('dataCleared', handleDataCleared);

    // Initial render based on currently loaded data
    await renderReportingPageUI();
}

/**
 * Handles the custom 'dataUpdated' event, re-rendering UI elements that depend on data.
 */
async function handleDataUpdated() {
    console.log("[reporting.js] Data updated event received. Re-rendering UI.");
    await renderReportingPageUI();
}

/**
 * Handles the custom 'dataCleared' event, resetting UI elements.
 */
async function handleDataCleared() {
    console.log("[reporting.js] Data cleared event received. Resetting UI.");
    fileNameDisplay.textContent = 'No file loaded. Please upload a CSV/Excel file on the Home page.';
    reportConfigurationSection.classList.add('hidden');
    reportDisplaySection.classList.add('hidden');
    plottingControlsSection.classList.add('hidden');
    savedGraphsSection.classList.add('hidden');
    viewedSavedGraphSection.classList.add('hidden');
    reportInsightsOutput.classList.add('hidden');

    // Clear select options
    if (groupByColumnSelect) groupByColumnSelect.innerHTML = '';
    if (filterByValueSelect) filterByValueSelect.innerHTML = '<option value="">All Values</option>';
    if (xAxisSelect) xAxisSelect.innerHTML = '';
    if (yAxisSelect) yAxisSelect.innerHTML = '';
    if (chartFilterColumnSelect) chartFilterColumnSelect.innerHTML = '<option value="">No Filter</option>';
    if (chartFilterValueSelect) chartFilterValueSelect.innerHTML = '<option value="">All Values</option>';

    reportTableBody.innerHTML = ''; // Clear table content
    reportTableHeader.innerHTML = ''; // Clear table headers

    currentReportData = []; // Clear report data
    reportInsightsText.textContent = ''; // Clear insights text
}


/**
 * Renders the UI elements on the reporting page based on whether data is loaded.
 */
async function renderReportingPageUI() {
    // Clear any existing chart instances before re-rendering
    if (myChartCanvas.chartInstance) myChartCanvas.chartInstance.destroy();
    if (myChartCanvasElement) myChartCanvasElement.closest('div').classList.add('hidden'); // Hide canvas div

    if (parsedData && parsedData.length > 0) {
        fileNameDisplay.textContent = `File: ${localStorage.getItem('csvPlotterFileName') || 'Unnamed File'}`;
        reportConfigurationSection.classList.remove('hidden');
        plottingControlsSection.classList.remove('hidden');

        // Populate selects for report configuration and plotting
        populateAxisSelects(parsedData, headers, xAxisSelect, yAxisSelect, null, null, groupByColumnSelect, chartFilterColumnSelect);

        // Render saved charts table for the reporting page
        await renderSavedChartsTable(savedGraphsTableBody, loadSavedChart, deleteSavedChartById, 'reporting');

    } else {
        fileNameDisplay.textContent = 'No file loaded. Please upload a CSV/Excel file on the Home page.';
        reportConfigurationSection.classList.add('hidden');
        reportDisplaySection.classList.add('hidden');
        plottingControlsSection.classList.add('hidden');
        savedGraphsSection.classList.add('hidden');
        viewedSavedGraphSection.classList.add('hidden');
        reportInsightsOutput.classList.add('hidden');
    }
}


/**
 * Handles change event for the Group By Column select.
 * Populates the Filter By Value select based on the chosen column.
 */
function handleGroupByColumnChange() {
    const selectedColumn = groupByColumnSelect.value;
    populateFilterValueSelect(parsedData, selectedColumn, filterByValueSelect);
}

/**
 * Handles change event for the Chart Filter Column select.
 * Populates the Chart Filter Value select based on the chosen column.
 */
function handleChartFilterColumnChange() {
    const selectedColumn = chartFilterColumnSelect.value;
    populateFilterValueSelect(parsedData, selectedColumn, chartFilterValueSelect);
}

/**
 * Generates and displays the report based on user selections.
 */
async function handleGenerateReport() {
    if (parsedData.length === 0) {
        showMessageBox("No data loaded. Please upload a file first.");
        return;
    }

    const groupByColumn = groupByColumnSelect.value;
    const filterByValue = filterByValueSelect.value;

    if (!groupByColumn) {
        showMessageBox("Please select a 'Group By Column' for the report.");
        return;
    }

    reportInsightsOutput.classList.add('hidden'); // Hide insights when generating new report

    let filteredData = parsedData;
    if (filterByValue) {
        filteredData = parsedData.filter(row => String(row[groupByColumn]) === String(filterByValue));
        if (filteredData.length === 0) {
            showMessageBox(`No data found for the selected filter: ${groupByColumn} = ${filterByValue}`);
            reportDisplaySection.classList.add('hidden');
            return;
        }
    }

    const aggregatedReport = aggregateReportData(filteredData, groupByColumn);
    renderReportTable(aggregatedReport, groupByColumn, filterByValue);
    reportDisplaySection.classList.remove('hidden');
}

/**
 * Aggregates data for the report table.
 * Calculates count, sum, average, min, max for numeric columns within each group.
 * Also calculates density distribution for numeric columns.
 * @param {Array<Object>} data - The filtered data.
 * @param {string} groupByColumn - The column to group by.
 * @returns {Array<Object>} Aggregated report data.
 */
function aggregateReportData(data, groupByColumn) {
    const groupedData = {};

    data.forEach(row => {
        const groupKey = row[groupByColumn];
        if (groupKey === undefined || groupKey === null) return;

        if (!groupedData[groupKey]) {
            groupedData[groupKey] = {
                _count: 0,
                _rawRows: [] // Store raw rows for density distribution
            };
            headers.forEach(header => {
                if (typeof row[header] === 'number') {
                    groupedData[groupKey][`${header}_sum`] = 0;
                    groupedData[groupKey][`${header}_min`] = Infinity;
                    groupedData[groupKey][`${header}_max`] = -Infinity;
                }
            });
        }

        groupedData[groupKey]._count++;
        groupedData[groupKey]._rawRows.push(row); // Add raw row

        headers.forEach(header => {
            const value = row[header];
            if (typeof value === 'number' && !isNaN(value)) {
                groupedData[groupKey][`${header}_sum`] += value;
                groupedData[groupKey][`${header}_min`] = Math.min(groupedData[groupKey][`${header}_min`], value);
                groupedData[groupKey][`${header}_max`] = Math.max(groupedData[groupKey][`${header}_max`], value);
            }
        });
    });

    const report = Object.keys(groupedData).sort().map(groupKey => {
        const groupStats = {
            [groupByColumn]: groupKey,
            'Count': groupedData[groupKey]._count
        };

        headers.forEach(header => {
            // Check if the original column is numeric and has data
            const numericValuesInColumn = data.filter(r => typeof r[header] === 'number' && !isNaN(r[header]));
            if (numericValuesInColumn.length > 0) {
                const sum = groupedData[groupKey][`${header}_sum`];
                const count = groupedData[groupKey]._count;
                const min = groupedData[groupKey][`${header}_min`];
                const max = groupedData[groupKey][`${header}_max`];

                groupStats[`${header} (Sum)`] = sum.toFixed(2);
                groupStats[`${header} (Avg)`] = (sum / count).toFixed(2);
                groupStats[`${header} (Min)`] = min.toFixed(2);
                groupStats[`${header} (Max)`] = max.toFixed(2);

                // Calculate density distribution data
                const values = groupedData[groupKey]._rawRows.map(row => row[header]).filter(val => typeof val === 'number' && !isNaN(val));
                if (values.length > 0) {
                    groupStats[`${header} (Density Data)`] = values; // Store raw values for density plot
                }
            }
        });
        return groupStats;
    });

    return report;
}

/**
 * Renders the aggregated report data into a table.
 * @param {Array<Object>} reportData - The aggregated data.
 * @param {string} groupByColumn - The column used for grouping.
 * @param {string} filterByValue - The value used for filtering (or empty string).
 */
function renderReportTable(reportData, groupByColumn, filterByValue) {
    reportTableHeader.innerHTML = '';
    reportTableBody.innerHTML = '';

    if (reportData.length === 0) {
        reportTableBody.innerHTML = `<tr><td colspan="100%" class="text-center py-4 text-gray-500">No data to display for this report.</td></tr>`;
        return;
    }

    // Determine all unique headers present in the reportData objects
    const allReportHeaders = new Set();
    reportData.forEach(row => {
        Object.keys(row).forEach(key => {
            if (!key.includes('(Density Data)')) { // Exclude density data from table headers
                allReportHeaders.add(key);
            }
        });
    });

    const sortedReportHeaders = Array.from(allReportHeaders).sort((a, b) => {
        // Keep group by column first, then 'Count', then others alphabetically
        if (a === groupByColumn) return -1;
        if (b === groupByColumn) return 1;
        if (a === 'Count') return -1;
        if (b === 'Count') return 1;
        return a.localeCompare(b);
    });

    // Create table headers
    sortedReportHeaders.forEach(header => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = header;
        reportTableHeader.appendChild(th);
    });

    // Populate table body
    reportData.forEach(rowData => {
        const tr = document.createElement('tr');
        tr.className = 'bg-white';
        sortedReportHeaders.forEach(header => {
            const td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
            td.textContent = rowData[header] !== undefined && rowData[header] !== null ? rowData[header] : '';
            tr.appendChild(td);
        });
        reportTableBody.appendChild(tr);
    });

    let descriptionText = `Report for '${groupByColumn}'`;
    if (filterByValue) {
        descriptionText += ` filtered by '${filterByValue}'`;
    }
    reportDescription.textContent = descriptionText;
    currentReportData = reportData; // Store for PDF export
}


/**
 * Handles plotting a graph based on user selections in the plotting controls section.
 */
function handlePlotGraph() {
    if (parsedData.length === 0) {
        showMessageBox("No data loaded. Please upload a file first.");
        return;
    }

    const xAxisCol = xAxisSelect.value;
    const yAxisCol = yAxisSelect.value;
    const chartType = chartTypeSelect.value;
    const yAxisAggregation = yAxisAggregationSelect.value;
    const chartFilterColumn = chartFilterColumnSelect.value;
    const chartFilterValue = chartFilterValueSelect.value;

    if (!xAxisCol || !yAxisCol) {
        showMessageBox("Please select both X-axis and Y-axis columns to plot.");
        return;
    }

    // Check if yAxisCol is numeric for aggregation
    const isYAxisNumeric = parsedData.some(row => typeof row[yAxisCol] === 'number' && !isNaN(row[yAxisCol]));
    if (!isYAxisNumeric && yAxisAggregation !== 'count') {
        showMessageBox(`The selected Y-axis column '${yAxisCol}' is not numeric. Please select a numeric column or choose 'Count' aggregation.`);
        return;
    }

    // For scatter plot, ensure both X and Y are numeric
    if (chartType === 'scatter') {
        const isXAxisNumeric = parsedData.some(row => typeof row[xAxisCol] === 'number' && !isNaN(row[xAxisCol]));
        if (!isXAxisNumeric || !isYAxisNumeric) {
            showMessageBox("For a Scatter Plot, both X-axis and Y-axis columns must be numeric.");
            return;
        }
    }

    // Hide viewed saved graph section if a new chart is plotted
    if (viewedSavedGraphSection) viewedSavedGraphSection.classList.add('hidden');

    drawChart(parsedData, xAxisCol, yAxisCol, chartType, myChartCanvasElement, yAxisAggregation, chartFilterColumn, chartFilterValue);
}


/**
 * Handles exporting the generated report as a PDF.
 * Uses jsPDF and html2canvas, and jspdf-autotable for table.
 */
async function handleExportReportPdf() {
    if (currentReportData.length === 0) {
        showMessageBox("No report generated to export. Please generate a report first.");
        return;
    }

    // Dynamically load jsPDF, jspdf-autotable, and html2canvas if not already loaded
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined' || typeof window.autoTable === 'undefined') {
        showMessageBox("Loading PDF export libraries... Please wait.");
        try {
            await Promise.all([
                new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                    script.onload = () => {
                        // Ensure jspdf is available globally if loaded as UMD
                        if (typeof window.jspdf === 'undefined' && typeof jspdf !== 'undefined') {
                            window.jspdf = jspdf;
                        }
                        resolve();
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                }),
                new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                }),
                new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                })
            ]);
            showMessageBox("PDF export libraries loaded. Please click 'Export Report as PDF' again.");
            return; // Exit and let user click again
        } catch (error) {
            console.error("Error loading PDF libraries:", error);
            showMessageBox(`Failed to load PDF export libraries: ${error.message}`);
            return;
        }
    }

    showMessageBox("Generating PDF... This may take a moment.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let yPos = 10; // Initial Y position

    // Add title
    doc.setFontSize(20);
    doc.text("Dynamic Data Report", 105, yPos, { align: 'center' });
    yPos += 10;
    doc.setFontSize(12);
    doc.text(reportDescription.textContent, 105, yPos, { align: 'center' });
    yPos += 20;

    // Prepare table data for jspdf-autotable
    const tableHeaders = Array.from(reportTableHeader.children).map(th => th.textContent);
    const tableRows = currentReportData.map(rowData => {
        return tableHeaders.map(header => {
            // Exclude (Density Data) from the PDF table content
            if (header.includes('(Density Data)')) {
                return ''; // Or some placeholder
            }
            return rowData[header] !== undefined && rowData[header] !== null ? String(rowData[header]) : '';
        });
    });

    // Use autoTable for the main report table
    doc.autoTable({
        head: [tableHeaders],
        body: tableRows,
        startY: yPos,
        theme: 'striped',
        styles: {
            fontSize: 8,
            cellPadding: 2,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: [224, 231, 255], // Light indigo
            textColor: [67, 56, 202], // Darker indigo
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [249, 250, 251] // Lighter gray
        },
        didDrawPage: function (data) {
            yPos = data.cursor.y + 10; // Update yPos after table
        }
    });

    // Add AI Insights if visible
    if (!reportInsightsOutput.classList.contains('hidden') && reportInsightsText.textContent.trim() !== '') {
        doc.addPage(); // Start AI insights on a new page for clarity
        yPos = 10; // Reset yPos for new page
        doc.setFontSize(16);
        doc.text("AI Report Insights", 105, yPos, { align: 'center' });
        yPos += 10;
        doc.setFontSize(10);

        const insights = reportInsightsText.textContent;
        const splitText = doc.splitTextToSize(insights, doc.internal.pageSize.width - 20); // 20mm margin
        doc.text(splitText, 10, yPos);
    }

    // Note: Embedding distribution plots per column is complex for auto-generated PDF
    // and might lead to very large files. Consider interactive display or separate exports.

    doc.save('report.pdf');
    showMessageBox("Report exported as PDF!");
}


/**
 * Handles getting AI insights for the generated report.
 */
async function handleGetAIReportInsights() {
    if (currentReportData.length === 0) {
        showMessageBox("Please generate a report first to get AI insights.");
        return;
    }

    reportInsightsOutput.classList.remove('hidden');
    reportInsightsText.textContent = '';
    reportInsightsLoading.classList.remove('hidden'); // Show spinner

    try {
        // Prepare a summary of the report data for the AI
        const reportSummary = currentReportData.map(row => {
            const summaryRow = {};
            for (const key in row) {
                if (row.hasOwnProperty(key) && !key.includes('(Density Data)')) { // Exclude raw density data
                    summaryRow[key] = row[key];
                }
            }
            return summaryRow;
        });

        const prompt = `Analyze the following aggregated report data. Provide key insights, trends, and observations. Highlight significant values, comparisons between groups, and any anomalies.
        Report Description: ${reportDescription.textContent}
        Aggregated Report Data (first 10 rows): ${JSON.stringify(reportSummary.slice(0, 10))}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
            }
        };

        const apiKey = ""; // Canvas will provide this at runtime
        const apiUrl = `${PROXY_SERVER_URL}/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error.message}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            reportInsightsText.textContent = result.candidates[0].content.parts[0].text;
        } else {
            reportInsightsText.textContent = "No insights could be generated for this report.";
            console.warn("Unexpected API response structure:", result);
        }
    } catch (error) {
        console.error("Error fetching AI report insights:", error);
        reportInsightsText.textContent = `Failed to get AI insights: ${error.message}. Please try again later.`;
    } finally {
        reportInsightsLoading.classList.add('hidden'); // Hide spinner
    }
}


// Attach the initialization function to the DOMContentLoaded event
window.addEventListener('DOMContentLoaded', initializeReportingPage);
