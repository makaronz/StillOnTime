import { WeatherData } from "../../types";
import { PolishTemplates, EnglishTemplates } from "./language-templates";

/**
 * Weather Summary Generator
 * Handles weather summary generation
 */
export class WeatherSummaryGenerator {
  private polishTemplates: PolishTemplates;
  private englishTemplates: EnglishTemplates;

  constructor() {
    this.polishTemplates = new PolishTemplates();
    this.englishTemplates = new EnglishTemplates();
  }

  /**
   * Generate weather summary
   */
  generateWeatherSummary(
    weatherData: WeatherData,
    language: "pl" | "en"
  ): string {
    const templates =
      language === "pl" ? this.polishTemplates : this.englishTemplates;

    let summary = `${templates.weather.temperature}: ${weatherData.temperature}°C`;

    if (weatherData.description) {
      summary += `, ${weatherData.description}`;
    }

    if (weatherData.windSpeed) {
      summary += `, ${templates.weather.wind}: ${weatherData.windSpeed} m/s`;
    }

    if (weatherData.precipitation && weatherData.precipitation > 0) {
      summary += `, ${templates.weather.precipitation}: ${weatherData.precipitation}mm`;
    }

    if (weatherData.humidity) {
      summary += `, ${templates.weather.humidity}: ${weatherData.humidity}%`;
    }

    return summary;
  }
}
