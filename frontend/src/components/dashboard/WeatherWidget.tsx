import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  CloudIcon,
  SunIcon,
  CloudRainIcon,
  WindIcon,
  DropletsIcon,
  EyeIcon,
  ThermometerIcon,
  ExclamationTriangleIcon
} from 'lucide-react';
import { format } from 'date-fns';

interface WeatherData {
  location: string;
  date: Date;
  current: {
    temperature: number;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    visibility: number;
    feelsLike: number;
  };
  forecast: Array<{
    time: string;
    temperature: number;
    description: string;
    precipitation: number;
  }>;
  alerts?: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

interface WeatherWidgetProps {
  location?: string;
  date: Date;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  location = 'Los Angeles, CA',
  date
}) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeatherData();
  }, [location, date]);

  const fetchWeatherData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Mock API call - replace with actual weather API
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockWeather: WeatherData = {
        location,
        date,
        current: {
          temperature: 72,
          description: 'Partly Cloudy',
          icon: 'partly-cloudy',
          humidity: 65,
          windSpeed: 12,
          visibility: 10,
          feelsLike: 75
        },
        forecast: [
          { time: '6 AM', temperature: 65, description: 'Clear', precipitation: 0 },
          { time: '9 AM', temperature: 70, description: 'Sunny', precipitation: 0 },
          { time: '12 PM', temperature: 78, description: 'Partly Cloudy', precipitation: 10 },
          { time: '3 PM', temperature: 82, description: 'Partly Cloudy', precipitation: 15 },
          { time: '6 PM', temperature: 76, description: 'Cloudy', precipitation: 20 },
          { time: '9 PM', temperature: 68, description: 'Clear', precipitation: 5 }
        ],
        alerts: [
          {
            type: 'Wind Advisory',
            message: 'Gusty winds expected in the afternoon',
            severity: 'medium'
          }
        ]
      };

      setWeather(mockWeather);
    } catch (err) {
      setError('Failed to fetch weather data');
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (icon: string) => {
    switch (icon) {
      case 'sunny':
        return <SunIcon className="w-8 h-8 text-yellow-500" />;
      case 'cloudy':
      case 'partly-cloudy':
        return <CloudIcon className="w-8 h-8 text-gray-500" />;
      case 'rainy':
        return <CloudRainIcon className="w-8 h-8 text-blue-500" />;
      default:
        return <SunIcon className="w-8 h-8 text-yellow-500" />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const isGoodForFilming = (weather: WeatherData) => {
    return (
      weather.current.windSpeed < 20 &&
      weather.current.visibility >= 5 &&
      !weather.alerts?.some(a => a.severity === 'high')
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CloudIcon className="w-5 h-5" />
            <span>Weather</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-gray-200 rounded-lg"></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CloudIcon className="w-5 h-5" />
            <span>Weather</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">{error || 'Weather data unavailable'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <CloudIcon className="w-5 h-5" />
            <span>Weather</span>
          </span>
          {isGoodForFilming(weather) ? (
            <Badge variant="success">Good for filming</Badge>
          ) : (
            <Badge variant="warning">Check conditions</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Weather */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">{weather.location}</p>
          <div className="flex items-center justify-center mb-3">
            {getWeatherIcon(weather.current.icon)}
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {weather.current.temperature}°F
          </p>
          <p className="text-sm text-gray-600">
            Feels like {weather.current.feelsLike}°F
          </p>
          <p className="text-sm text-gray-500">{weather.current.description}</p>
        </div>

        {/* Weather Details */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-blue-50 p-3 rounded-lg">
            <WindIcon className="w-4 h-4 text-blue-600 mx-auto mb-1" />
            <p className="text-xs text-blue-600">Wind</p>
            <p className="text-sm font-semibold text-blue-900">
              {weather.current.windSpeed} mph
            </p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <DropletsIcon className="w-4 h-4 text-green-600 mx-auto mb-1" />
            <p className="text-xs text-green-600">Humidity</p>
            <p className="text-sm font-semibold text-green-900">
              {weather.current.humidity}%
            </p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <EyeIcon className="w-4 h-4 text-purple-600 mx-auto mb-1" />
            <p className="text-xs text-purple-600">Visibility</p>
            <p className="text-sm font-semibold text-purple-900">
              {weather.current.visibility} mi
            </p>
          </div>
        </div>

        {/* Hourly Forecast */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Hourly Forecast</h4>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {weather.forecast.map((hour, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 text-center bg-gray-50 p-2 rounded-lg min-w-[70px]"
              >
                <p className="text-xs text-gray-600">{hour.time}</p>
                <p className="text-sm font-semibold">{hour.temperature}°</p>
                {hour.precipitation > 0 && (
                  <p className="text-xs text-blue-600">{hour.precipitation}%</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Weather Alerts */}
        {weather.alerts && weather.alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">Alerts</h4>
            {weather.alerts.map((alert, idx) => (
              <div
                key={idx}
                className="flex items-start space-x-2 p-3 bg-yellow-50 rounded-lg"
              >
                <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge variant={getAlertColor(alert.severity)} size="sm">
                      {alert.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-700">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};