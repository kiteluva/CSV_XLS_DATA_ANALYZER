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
import requests
import time # Added for exponential backoff

app = Flask(__name__)
CORS(app) # This allows all origins by default, suitable for your Vercel frontend

# Helper function for date parsing (consistent with JS)
def parse_date_value(date_val):
    if isinstance(date_val, (int, float)):
        if date_val > 25569: # Valid dates after 1970
            return pd.to_datetime('1899-12-30') + pd.to_timedelta(date_val, unit='D')
    elif isinstance(date_val, str):
        try:
            return pd.to_datetime(date_val)
        except ValueError:
            pass
    return None

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
            df[col] = pd.to_numeric(df[col], errors='coerce')
        df_numeric = df[columns_to_correlate].dropna()
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

        for col in [dependent_var] + independent_vars:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        df_cleaned = df[[dependent_var] + independent_vars].dropna()

        if df_cleaned.empty:
            return jsonify({"error": "No valid data after cleaning for regression"}), 400

        X = df_cleaned[independent_vars]
        y = df_cleaned[dependent_var]

        # Add a constant to the independent variables for the intercept
        X = sm.add_constant(X)

        model = sm.OLS(y, X).fit()

        results_summary = model.summary().as_html() # Get HTML summary for display
        
        # Extract coefficients as a dictionary
        coefficients_dict = model.params.to_dict()
        
        # Calculate Adj. R-squared if not directly available as model.rsquared_adj
        adj_r_squared = model.rsquared_adj if hasattr(model, 'rsquared_adj') else (1 - (1 - model.rsquared) * (len(y) - 1) / (len(y) - len(independent_vars) - 1))

        # Calculate RMSE
        rmse = np.sqrt(mean_squared_error(y, model.predict(X)))

        insights = (
            f"Multiple Linear Regression completed. R-squared: {model.rsquared:.4f}, Adjusted R-squared: {adj_r_squared:.4f}. "
            f"RMSE: {rmse:.2f}. "
            "Examine coefficients for variable impact and p-values for significance."
        )

        return jsonify({
            "status": "success",
            "summary_html": results_summary,
            "coefficients": coefficients_dict, # Pass as dictionary
            "r_squared": model.rsquared,
            "adj_r_squared": adj_r_squared,
            "rmse": rmse,
            "insights": insights
        })
    except Exception as e:
        app.logger.error(f"Error in run_linear_regression: {e}", exc_info=True)
        return jsonify({"error": f"Linear Regression failed: {str(e)}"}), 500

@app.route('/run_random_forest', methods=['POST'])
def run_random_forest():
    data = request.get_json()
    if not data or 'dataframe' not in data or 'dependent_var' not in data or 'independent_vars' not in data:
        return jsonify({"error": "Missing required data for Random Forest"}), 400
    try:
        df = pd.DataFrame(data['dataframe'])
        dependent_var = data['dependent_var']
        independent_vars = data['independent_vars']
        n_estimators = data.get('n_estimators', 100) # Default to 100 if not provided

        for col in [dependent_var] + independent_vars:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        df_cleaned = df[[dependent_var] + independent_vars].dropna()

        if df_cleaned.empty:
            return jsonify({"error": "No valid data after cleaning for Random Forest"}), 400

        X = df_cleaned[independent_vars]
        y = df_cleaned[dependent_var]

        rf_model = RandomForestRegressor(n_estimators=n_estimators, random_state=42)
        rf_model.fit(X, y)
        y_pred = rf_model.predict(X)

        mse = mean_squared_error(y, y_pred)
        mae = np.mean(np.abs(y - y_pred)) # Calculate MAE
        rmse = np.sqrt(mse) # Calculate RMSE
        r2 = r2_score(y, y_pred)
        feature_importances = dict(zip(X.columns, rf_model.feature_importances_))

        insights = (
            f"Random Forest Regression completed with {n_estimators} estimators. "
            f"Mean Squared Error: {mse:.2f}, R-squared: {r2:.4f}. "
            "Feature importances indicate the relative contribution of each independent variable to the prediction. "
            "Higher importance values suggest a stronger influence."
        )

        return jsonify({
            "status": "success",
            "mse": mse,
            "mae": mae, # Include MAE
            "rmse": rmse, # Include RMSE
            "r_squared": r2,
            "feature_importances": feature_importances,
            "insights": insights
        })
    except Exception as e:
        app.logger.error(f"Error in run_random_forest: {e}", exc_info=True)
        return jsonify({"error": f"Random Forest Regression failed: {str(e)}"}), 500

@app.route('/time_series_predict', methods=['POST'])
def time_series_predict():
    data = request.get_json()
    # Corrected: Expect 'time_series_data', 'prediction_horizon', 'model_type'
    required_params = ['time_series_data', 'prediction_horizon', 'model_type']
    if not all(param in data for param in required_params):
        app.logger.error(f"Missing required parameters for time series prediction: {', '.join([p for p in required_params if p not in data])}")
        return jsonify({"error": "Missing required parameters for time series prediction"}), 400

    try:
        # Frontend now sends 'time_series_data' as list of {'date': iso_string, 'value': number}
        series_data_list = data['time_series_data']
        prediction_horizon = int(data['prediction_horizon'])
        model_type = data.get('model_type', 'arima').lower() # Default to arima

        # Convert list of dicts to pandas Series with DatetimeIndex
        # Assuming 'date' and 'value' keys are consistent as per frontend preprocessing
        df_raw = pd.DataFrame(series_data_list)
        df_raw['date'] = pd.to_datetime(df_raw['date'])
        df_raw['value'] = pd.to_numeric(df_raw['value'], errors='coerce')
        
        df_cleaned = df_raw.dropna(subset=['date', 'value']).sort_values(by='date')
        df_cleaned = df_cleaned.set_index('date')
        series = df_cleaned['value']

        if series.empty or len(series) < 2:
            return jsonify({"error": "Not enough valid data points for time series analysis after cleaning. Need at least 2 data points."}), 400

        model_fit = None

        if model_type == 'arima':
            # Use pmdarima for auto ARIMA model selection
            model = pm.auto_arima(series, seasonal=False, suppress_warnings=True,
                                  stepwise=True, trace=False, error_action='ignore')
            model_fit = model # pmdarima auto_arima returns the fitted model directly
        elif model_type == 'simple_linear_regression':
            # Create a numerical representation of time
            X_lr = np.arange(len(series)).reshape(-1, 1)
            lr_model = LinearRegression()
            lr_model.fit(X_lr, series)
            model_fit = lr_model
        else:
            return jsonify({"error": "Invalid model_type specified. Choose 'arima' or 'simple_linear_regression'"}), 400

        forecast = pd.Series() # Initialize empty series for forecast

        if model_type == 'arima':
            forecast_results = model_fit.predict(n_periods=prediction_horizon)
            last_date = series.index[-1]
            # Infer frequency from historical series for future dates, or default to daily
            freq = pd.infer_freq(series.index) if pd.infer_freq(series.index) else 'D'
            future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=prediction_horizon, freq=freq)
            forecast = pd.Series(forecast_results, index=future_dates)
        elif model_type == 'simple_linear_regression':
            # Predict future values based on linear trend
            future_indices = np.arange(len(series), len(series) + prediction_horizon).reshape(-1, 1)
            future_predictions = model_fit.predict(future_indices)
            last_date = series.index[-1]
            freq = pd.infer_freq(series.index) if pd.infer_freq(series.index) else 'D'
            future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=prediction_horizon, freq=freq)
            forecast = pd.Series(future_predictions, index=future_dates)

        predictions = []
        for date, value in forecast.items():
            predictions.append({'date': date.isoformat(), 'value': value})

        # Calculate RMSE on historical data (in-sample prediction)
        rmse = None
        if model_type == 'arima' and len(series) > 1:
            historical_predictions = model_fit.predict(n_periods=len(series))
            rmse = np.sqrt(mean_squared_error(series, historical_predictions))
        elif model_type == 'simple_linear_regression' and len(series) > 1:
            historical_predictions = model_fit.predict(X_lr) # Use X_lr for historical prediction
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

# NEW: AI Insights Proxy Endpoint
@app.route('/generate_ai_insights', methods=['POST'])
def generate_ai_insights():
    """
    Proxies requests to the Google Gemini API for AI insights.
    Receives content from the frontend, forwards it to Gemini, and returns Gemini's response.
    """
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    if not GEMINI_API_KEY:
        app.logger.error("GEMINI_API_KEY environment variable not set.")
        return jsonify({"error": "Gemini API key not configured on the server."}), 500

    try:
        data = request.get_json()
        if not data or 'contents' not in data:
            return jsonify({"error": "Missing 'contents' in request body for AI insights."}), 400

        # The data['contents'] should be in the format expected by the Gemini API
        # Example: [{"parts": [{"text": "Your prompt text here"}]}]
        gemini_request_payload = {
            "contents": data['contents'],
            "generationConfig": data.get('generationConfig', {}) # Pass through generationConfig if provided by frontend
        }

        # The Gemini API endpoint
        # Use gemini-1.5-flash for broader access unless gemini-pro is explicitly needed and enabled
        gemini_api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        
        headers = {'Content-Type': 'application/json'}

        # Make the request to the Gemini API with exponential backoff
        # Implementing basic exponential backoff for robustness
        retries = 3
        delay = 1 # seconds
        for i in range(retries):
            try:
                gemini_response = requests.post(gemini_api_url, json=gemini_request_payload, headers=headers)
                gemini_response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
                return jsonify(gemini_response.json()) # Return the Gemini API's JSON response directly to the frontend
            except requests.exceptions.RequestException as e:
                app.logger.warning(f"Attempt {i+1}/{retries} to call Gemini API failed: {e}")
                if i < retries - 1:
                    time.sleep(delay) # Wait before retrying
                    delay *= 2 # Exponential backoff
                else:
                    raise # Re-raise on last attempt

    except requests.exceptions.RequestException as req_e:
        app.logger.error(f"Error calling Gemini API: {req_e}", exc_info=True)
        return jsonify({"error": f"Failed to get AI insights from external service: {str(req_e)}"}), 502 # Bad Gateway
    except Exception as e:
        app.logger.error(f"An unexpected error occurred in generate_ai_insights: {e}", exc_info=True)
        return jsonify({"error": f"An internal server error occurred: {str(e)}"}), 500


# if __name__ == '__main__':
#     # This is for local development purposes only.
#     # Render handles running the app in production.
#     app.run(debug=True, port=5000)
