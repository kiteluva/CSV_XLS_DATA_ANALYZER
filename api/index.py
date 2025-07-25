from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
import statsmodels.api as sm
from statsmodels.tsa.arima.model import ARIMA
import pmdarima as pm
import os
import requests # NEW: Import the requests library for making HTTP calls

app = Flask(__name__)
CORS(app) # This allows all origins by default, suitable for your Vercel frontend

# Helper function for date parsing (consistent with JS)
def parse_date_value(date_val):
    if isinstance(date_val, (int, float)):
        if date_val > 25569: # Valid dates after 1970 for Excel date format
            # Excel dates start from 1900-01-01 (day 1), but Python's datetime starts
            # from 1899-12-30 if treating 1 as 1900-01-01.
            # Convert Excel serial date to datetime object
            return pd.to_datetime('1899-12-30') + pd.to_timedelta(date_val, unit='D')
    elif isinstance(date_val, str):
        try:
            return pd.to_datetime(date_val)
        except ValueError:
            pass # Fall through if string is not a valid date format
    return None # Return None if parsing fails

@app.route('/')
def index():
    return "Flask Data Calculations API is running!"

@app.route('/calculate_correlation', methods=['POST'])
def calculate_correlation():
    data = request.get_json()
    if not data or 'dataframe' not in data or 'columns' not in data:
        return jsonify({"error": "Missing 'dataframe' or 'columns' in request"}), 400
    try:
        df = pd.DataFrame(data['dataframe'])
        columns_to_correlate = data['columns']
        for col in columns_to_correlate:
            # Convert selected columns to numeric, coercing errors to NaN
            df[col] = pd.to_numeric(df[col], errors='coerce')
        # Drop rows with NaN in the selected numeric columns
        df_numeric = df[columns_to_correlate].dropna()
        
        if df_numeric.empty or len(df_numeric.columns) < 2:
            return jsonify({"error": "Not enough valid numeric data or columns for correlation calculation after cleaning."}), 400

        correlation_matrix = df_numeric.corr().to_dict()
        return jsonify({"status": "success", "correlation_matrix": correlation_matrix})
    except Exception as e:
        app.logger.error(f"Error in calculate_correlation: {e}", exc_info=True)
        return jsonify({"error": f"Correlation calculation failed: {str(e)}"}), 500

@app.route('/run_linear_regression', methods=['POST'])
def run_linear_regression():
    data = request.get_json()
    if not data or 'dataframe' not in data or 'dependent_var' not in data or 'independent_vars' not in data:
        return jsonify({"error": "Missing required data for regression"}), 400
    try:
        df = pd.DataFrame(data['dataframe'])
        dependent_var = data['dependent_var']
        independent_vars = data['independent_vars']

        # Convert all relevant columns to numeric, coercing errors to NaN
        for col in [dependent_var] + independent_vars:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        # Drop rows where dependent or independent variables are NaN
        df_cleaned = df[[dependent_var] + independent_vars].dropna()

        if df_cleaned.empty:
            return jsonify({"error": "No valid data after cleaning for linear regression"}), 400

        X = df_cleaned[independent_vars]
        y = df_cleaned[dependent_var]

        # Add a constant to the independent variables for the intercept term in the regression model
        X = sm.add_constant(X)

        model = sm.OLS(y, X).fit() # Fit the Ordinary Least Squares model

        # Prepare results for the frontend
        results_summary = model.summary().as_html() # Get HTML summary for display in frontend (if needed)
        
        # Extract coefficients and format them
        coefficients = {col: param for col, param in model.params.items()}
        
        r_squared = model.rsquared # R-squared value
        adj_r_squared = model.rsquared_adj # Adjusted R-squared value
        
        # Calculate RMSE (Root Mean Squared Error) for in-sample prediction
        y_pred = model.predict(X)
        rmse = np.sqrt(mean_squared_error(y, y_pred))

        # Generate simple insights based on the results
        insights = (
            f"Multiple Linear Regression completed. "
            f"R-squared: {r_squared:.4f}, Adjusted R-squared: {adj_r_squared:.4f}. "
            f"The model explains approximately {r_squared*100:.2f}% of the variance in the dependent variable. "
            f"RMSE: {rmse:.2f}. "
            "Examine coefficients to understand the impact of each independent variable and their p-values for statistical significance."
        )

        return jsonify({
            "status": "success",
            "summary_html": results_summary,
            "coefficients": coefficients,
            "r_squared": r_squared,
            "adj_r_squared": adj_r_squared,
            "f_statistic": model.fvalue, # F-statistic
            "f_p_value": model.f_pvalue, # F-statistic p-value
            "rmse": rmse,
            "insights": insights
        })
    except Exception as e:
        app.logger.error(f"Error in run_linear_regression: {e}", exc_info=True)
        return jsonify({"error": f"Linear Regression failed: {str(e)}"}), 500

@app.route('/run_random_forest', methods=['POST'])
def run_random_forest():
    data = request.get_json()
    if not data or 'dataframe' not in data or 'dependent_var' not in data or 'independent_vars' not in data or 'n_estimators' not in data:
        return jsonify({"error": "Missing required data for Random Forest"}), 400
    try:
        df = pd.DataFrame(data['dataframe'])
        dependent_var = data['dependent_var']
        independent_vars = data['independent_vars']
        n_estimators = int(data['n_estimators']) # Number of trees in the forest

        # Convert all relevant columns to numeric, coercing errors to NaN
        for col in [dependent_var] + independent_vars:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Drop rows with NaN in the selected columns
        df_cleaned = df[[dependent_var] + independent_vars].dropna()

        if df_cleaned.empty:
            return jsonify({"error": "No valid data after cleaning for Random Forest"}), 400

        X = df_cleaned[independent_vars] # Independent variables
        y = df_cleaned[dependent_var]   # Dependent variable

        rf_model = RandomForestRegressor(n_estimators=n_estimators, random_state=42)
        rf_model.fit(X, y) # Train the Random Forest model
        y_pred = rf_model.predict(X) # Make predictions on the training data

        mse = mean_squared_error(y, y_pred) # Mean Squared Error
        mae = np.mean(np.abs(y - y_pred)) # Mean Absolute Error
        rmse = np.sqrt(mse) # Root Mean Squared Error
        r2 = r2_score(y, y_pred) # R-squared score

        # Get feature importances from the trained model
        feature_importances = dict(zip(X.columns, rf_model.feature_importances_))

        insights = (
            f"Random Forest Regression completed with {n_estimators} estimators. "
            f"R-squared: {r2:.4f}, Mean Absolute Error (MAE): {mae:.2f}, Mean Squared Error (MSE): {mse:.2f}, Root Mean Squared Error (RMSE): {rmse:.2f}. "
            "Feature importances indicate the relative contribution of each independent variable to the prediction. "
            "Higher importance values suggest a stronger influence on the dependent variable."
        )

        return jsonify({
            "status": "success",
            "mse": mse,
            "mae": mae,
            "rmse": rmse,
            "r_squared": r2, # Renamed for consistency with frontend
            "feature_importances": feature_importances,
            "insights": insights
        })
    except Exception as e:
        app.logger.error(f"Error in run_random_forest: {e}", exc_info=True)
        return jsonify({"error": f"Random Forest Regression failed: {str(e)}"}), 500

@app.route('/time_series_predict', methods=['POST'])
def time_series_predict():
    data = request.get_json()
    required_params = ['time_series_data', 'prediction_horizon', 'model_type']
    if not all(param in data for param in required_params):
        return jsonify({"error": "Missing required parameters for time series prediction"}), 400

    try:
        series_data_raw = data['time_series_data']
        prediction_horizon = int(data['prediction_horizon'])
        model_type = data['model_type'].lower()

        # Convert raw list of dicts to pandas Series with DatetimeIndex
        # Ensure values are numeric and drop NaNs
        series_df = pd.DataFrame(series_data_raw)
        series_df['date'] = pd.to_datetime(series_df['date'], errors='coerce')
        series_df['value'] = pd.to_numeric(series_df['value'], errors='coerce')
        series_df_cleaned = series_df.dropna(subset=['date', 'value']).sort_values(by='date')
        series = series_df_cleaned.set_index('date')['value']

        if series.empty:
            return jsonify({"error": "No valid data for time series analysis after cleaning."}), 400
        
        # Ensure the series has a frequency, necessary for some ARIMA operations
        # If no explicit frequency, infer it. If inference fails, default to daily.
        try:
            series = series.asfreq(pd.infer_freq(series.index))
        except ValueError:
            series = series.asfreq('D') # Default to daily frequency if inference fails

        model_fit = None
        forecast = None

        if model_type == 'arima':
            # Auto ARIMA to find best parameters
            auto_arima_model = pm.auto_arima(series, seasonal=False, suppress_warnings=True,
                                             stepwise=True, trace=False, error_action='ignore')
            model_fit = auto_arima_model.fit(series) # Fit the model to the series
            
            # Forecast future values
            forecast_result = model_fit.predict(n_periods=prediction_horizon)
            # Ensure the forecast has a DatetimeIndex aligned with the original series frequency
            last_date = series.index[-1]
            future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=prediction_horizon, freq=series.index.freq)
            forecast = pd.Series(forecast_result.values, index=future_dates)

        elif model_type == 'simple_linear_regression':
            # For time series, create a numerical index for regression
            series_numeric_index = pd.Series(range(len(series)), index=series.index)
            X = series_numeric_index.values.reshape(-1, 1)
            y = series.values

            lr_model = LinearRegression()
            lr_model.fit(X, y)
            model_fit = lr_model

            # Predict future values based on linear trend
            future_indices = np.array(range(len(series), len(series) + prediction_horizon)).reshape(-1, 1)
            future_predictions = lr_model.predict(future_indices)
            
            # Generate future dates for the forecast
            last_date = series.index[-1]
            freq = series.index.freq if series.index.freq else 'D' # Use inferred freq or 'D'
            future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=prediction_horizon, freq=freq)
            forecast = pd.Series(future_predictions, index=future_dates)

        else:
            return jsonify({"error": "Invalid model_type specified. Choose 'arima' or 'simple_linear_regression'."}), 400

        predictions = []
        for date, value in forecast.items():
            predictions.append({'date': date.isoformat(), 'value': value})

        # Calculate RMSE on historical data (in-sample prediction)
        rmse = None
        if len(series) > 1 and model_fit is not None:
            if model_type == 'arima':
                # Use model_fit.predict on historical data for in-sample RMSE
                historical_predictions = model_fit.predict(n_periods=len(series), return_conf_int=False) # Ensure no conf_int
                rmse = np.sqrt(mean_squared_error(series, historical_predictions))
            elif model_type == 'simple_linear_regression':
                historical_predictions = model_fit.predict(X)
                rmse = np.sqrt(mean_squared_error(series, historical_predictions))

        insights = "Time series prediction completed. "
        if rmse is not None:
            insights += f"The in-sample RMSE is approximately {rmse:.2f}. "
        insights += "Observe the trend in the predicted values. Consider external factors that might influence these predictions."

        return jsonify({
            "predictions": predictions,
            "rmse": rmse,
            "insights": insights
        })

    except Exception as e:
        app.logger.error(f"Error in time_series_predict: {e}", exc_info=True)
        return jsonify({"error": f"An error occurred during time series prediction: {str(e)}"}), 500


# NEW: AI Insights Proxy Endpoint for all AI-related queries
@app.route('/generate_ai_insights', methods=['POST'])
def generate_ai_insights():
    """
    Proxies requests from the frontend to the Google Gemini API for AI insights.
    Receives content (prompt, etc.) from the frontend, forwards it to Gemini,
    and returns Gemini's response.
    """
    # Retrieve Gemini API Key securely from environment variables on Render.
    # You MUST set this environment variable on your Render dashboard
    # under your service's "Environment" settings (e.g., GEMINI_API_KEY).
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    if not GEMINI_API_KEY:
        app.logger.error("GEMINI_API_KEY environment variable not set.")
        return jsonify({"error": "Server configuration error: AI API key missing."}), 500

    try:
        data = request.get_json()
        if not data or 'contents' not in data:
            return jsonify({"error": "Missing 'contents' in request body for AI insights."}), 400

        # The 'contents' field should be structured as expected by the Gemini API
        # Example: [{"parts": [{"text": "Your prompt text here"}]}]
        gemini_request_payload = {
            "contents": data['contents'],
            # You can also pass generationConfig, safety_settings if sent from frontend,
            # or define them here.
            "generationConfig": data.get("generationConfig", {
                "temperature": 0.7,
                "topP": 0.95,
                "topK": 40
            })
        }

        # The standard Google Gemini API endpoint for text generation
        # Using gemini-pro is generally robust for various text tasks.
        # If you specifically need 'flash' for speed and are handling image inputs, use gemini-1.5-flash
        gemini_api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GEMINI_API_KEY}"
        
        headers = {'Content-Type': 'application/json'}

        # Make the request to the Google Gemini API
        gemini_response = requests.post(gemini_api_url, json=gemini_request_payload, headers=headers)
        gemini_response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

        # Return the Gemini API's JSON response directly to the frontend
        # The frontend expects 'insights' field, so we need to extract it
        gemini_json_response = gemini_response.json()
        
        # Extract the text content from Gemini's response
        insights_text = "No insights could be generated."
        if gemini_json_response.get('candidates') and len(gemini_json_response['candidates']) > 0:
            if gemini_json_response['candidates'][0].get('content') and \
               gemini_json_response['candidates'][0]['content'].get('parts') and \
               len(gemini_json_response['candidates'][0]['content']['parts']) > 0:
                insights_text = gemini_json_response['candidates'][0]['content']['parts'][0].get('text', insights_text)
        
        return jsonify({"insights": insights_text, "full_response": gemini_json_response})

    except requests.exceptions.RequestException as req_e:
        app.logger.error(f"Error calling Gemini API: {req_e}", exc_info=True)
        return jsonify({"error": f"Failed to get AI insights from external service: {str(req_e)}"}), 502 # Bad Gateway
    except Exception as e:
        app.logger.error(f"An unexpected error occurred in generate_ai_insights: {e}", exc_info=True)
        return jsonify({"error": f"An internal server error occurred: {str(e)}"}), 500


# This block is for local development purposes only and will not be executed on Render.
# if __name__ == '__main__':
#     app.run(debug=True, port=5000)
