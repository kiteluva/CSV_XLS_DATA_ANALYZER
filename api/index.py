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

app = Flask(__name__)
CORS(app)

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
        return jsonify({"error": "Missing data for regression"}), 400
    try:
        df = pd.DataFrame(data['dataframe'])
        y_col = data['dependent_var']
        x_cols = data['independent_vars']
        for col in [y_col] + x_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        df_cleaned = df[[y_col] + x_cols].dropna()

        Y = df_cleaned[y_col]
        X = df_cleaned[x_cols]
        X = sm.add_constant(X)

        model = sm.OLS(Y, X)
        results = model.fit()

        return jsonify({
            "status": "success",
            "summary": results.summary().as_html(),
            "coefficients": results.params.to_dict(),
            "r_squared": results.rsquared
        })
    except Exception as e:
        app.logger.error(f"Error in run_linear_regression: {e}", exc_info=True)
        return jsonify({"error": f"Linear Regression failed: {str(e)}"}), 500

@app.route('/run_random_forest', methods=['POST'])
def run_random_forest():
    data = request.get_json()
    if not data or 'dataframe' not in data or 'dependent_var' not in data or 'independent_vars' not in data or 'n_estimators' not in data:
        return jsonify({"error": "Missing data for Random Forest"}), 400
    try:
        df = pd.DataFrame(data['dataframe'])
        y_col = data['dependent_var']
        x_cols = data['independent_vars']
        n_estimators = int(data['n_estimators'])

        for col in [y_col] + x_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        df_cleaned = df[[y_col] + x_cols].dropna()

        X = df_cleaned[x_cols]
        Y = df_cleaned[y_col]

        model = RandomForestRegressor(n_estimators=n_estimators, random_state=42)
        model.fit(X, Y)

        feature_importances = dict(zip(X.columns, model.feature_importances_))

        return jsonify({
            "status": "success",
            "feature_importances": feature_importances,
            "r_squared_score": model.score(X, Y)
        })
    except Exception as e:
        app.logger.error(f"Error in run_random_forest: {e}", exc_info=True)
        return jsonify({"error": f"Random Forest failed: {str(e)}"}), 500

@app.route('/time_series_predict', methods=['POST'])
def time_series_predict():
    data = request.get_json()
    required_params = ['dataframe', 'date_column', 'value_column', 'prediction_horizon', 'model_type']
    if not all(param in data for param in required_params):
        return jsonify({"error": "Missing required parameters for time series prediction"}), 400

    try:
        df_raw = pd.DataFrame(data['dataframe'])
        date_column = data['date_column']
        value_column = data['value_column']
        prediction_horizon = int(data['prediction_horizon'])
        model_type = data['model_type'].lower()

        # Parse dates using the helper function
        df_raw[date_column] = df_raw[date_column].apply(parse_date_value)
        df_cleaned = df_raw.dropna(subset=[date_column, value_column]).sort_values(by=date_column)
        df_cleaned[value_column] = pd.to_numeric(df_cleaned[value_column], errors='coerce').dropna()

        if df_cleaned.empty:
            return jsonify({"error": "No valid data for time series analysis after cleaning."}), 400

        # Set date column as index
        df_cleaned.set_index(date_column, inplace=True)
        series = df_cleaned[value_column]

        model = None
        model_fit = None

        if model_type == 'arima':
            # Auto ARIMA to find best parameters
            # Use suppress_warnings=True to avoid stdout messages from pmdarima
            auto_arima_model = pm.auto_arima(series, seasonal=False, suppress_warnings=True,
                                             stepwise=True, trace=False, error_action='ignore')
            model_fit = auto_arima_model
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
            future_dates = pd.date_range(start=series.index[-1] + pd.Timedelta(days=1), periods=prediction_horizon, freq=series.index.freq or 'D') # Use inferred freq or 'D'
            forecast = pd.Series(future_predictions, index=future_dates)

        else:
            return jsonify({"error": "Invalid model_type specified."}), 400

        # ARIMA specific forecasting
        if model_type == 'arima':
            forecast_results = model_fit.predict(n_periods=prediction_horizon)
            future_dates = pd.date_range(start=series.index[-1] + pd.Timedelta(days=1), periods=prediction_horizon, freq=series.index.freq or 'D')
            forecast = pd.Series(forecast_results, index=future_dates)

        predictions = []
        for date, value in forecast.items():
            predictions.append({'date': date.isoformat(), 'value': value})

        # Calculate RMSE on historical data (in-sample prediction)
        rmse = None
        if model_type == 'arima' and len(series) > 1:
            historical_predictions = model_fit.predict(n_periods=len(series))
            rmse = np.sqrt(mean_squared_error(series, historical_predictions))
        elif model_type == 'simple_linear_regression' and len(series) > 1:
            historical_predictions = lr_model.predict(X)
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


# if __name__ == '__main__':
#     # This is for local development only
#     # On Vercel, this won't be executed directly.
#     app.run(debug=True, port=5000)